# Tundra Dome on KIND (safe, observable, PA‑RISC Superdome style)

This doc describes a safe, end‑to‑end setup to run Tundra Dome as a “bot” in KIND with full Datadog visibility.

## Goals

- Safe-by-default operation (dry-run, scoped topics, least privilege).
- Reproducible local cluster (KIND) for dev/test.
- End‑to‑end observability (metrics, logs, traces) in Datadog.

## Components (end‑to‑end)

1) **Ingress / intake**
- `td` CLI publishes bead lifecycle + commands to Kafka.
- `gastown-to-tundra-bridge` consumes `gastown-beads` and republishes to Tundra topics.

2) **Routing / policy**
- Airflow DAGs (lane router, watchdogs, escalations) emit actions to Kafka command topics.

3) **Execution / GT**
- `gt-kafka-consumer` consumes Kafka commands and nudges/sling to Gas Town.

4) **Audit / observability**
- `td-event-emitter` consumes topic stream and emits Datadog metrics + OpenLineage.
- `tundra-observer` monitors and logs events for alerting.

## Safety controls

- **Dry-run by default**: set `BRIDGE_DRY_RUN=true` for the bridge until verified.
- **Topic hygiene**: avoid dot topics; use hyphenated names only.
- **Least privilege**: isolate credentials in k8s secrets; no host-level access.
- **Rate limits**: cap Airflow DAG frequency if testing (avoid 1‑min loops in dev).
- **Rollback**: keep versioned manifests; use `kubectl rollout undo`.

## KIND outline (manifests)

Create a folder `tundra-dome/k8s/` with:

- `kafka.yaml` (single‑node dev broker)
- `airflow.yaml` (scheduler + dag‑processor + api‑server)
- `kafka-dsm.yaml` (td‑event‑emitter, tundra‑observer, gt‑kafka‑consumer, gastown‑to‑tundra‑bridge)
- `secrets.yaml` (Datadog API key, GitHub tokens, etc.)
- `configmaps.yaml` (env + topic lists)

> NOTE: Airflow DAGs should be mounted from a ConfigMap or baked into an image.

## Required env vars

- **Kafka**
  - `KAFKA_BROKERS`
  - `KAFKA_TOPICS`

- **Bridge** (`gastown-to-tundra-bridge`)
  - `SOURCE_TOPIC=gastown-beads`
  - `TD_TOPIC_WORK=tundra-work-intake`
  - `TD_TOPIC_CREATED=tundra-beads-created`
  - `TD_LANE_PREFIX=tundra-lane`
  - `TD_DEFAULT_LANE=standard`
  - `BRIDGE_DRY_RUN=true` (start here)

- **Datadog**
  - `DD_API_KEY` (secret)
  - `DD_SITE` (default `datadoghq.com`)
  - `DD_ENV=kind`
  - `DD_SERVICE=<service>`

## Datadog monitoring (minimum viable)

### Metrics to emit/track
- `tundra.td_event_emitter.heartbeat`
- `tundra.td_event_emitter.processed`
- `tundra.observer.processed`
- `gastown.kafka_consumer.processed`

### Kafka health
- Consumer lag per group (`kafka-consumer-groups --describe`)
- Broker up/down (container health)

### Airflow health
- DAG failures / retries
- Scheduler heartbeat

### Recommended monitors
- **Bridge stalled**: no `tundra.td_event_emitter.processed` in 5m
- **Observer stalled**: no `tundra.observer.processed` in 5m
- **Consumer lag**: lag > threshold for `gastown-to-tundra-bridge`
- **Airflow failures**: DAG run failed in last 15m

### Logs
- Ship logs from:
  - `td-event-emitter`
  - `tundra-observer`
  - `gastown-to-tundra-bridge`
  - Airflow scheduler/worker

## Smoke test (KIND)

1) Start Kafka + Airflow + DSM stack
2) Run:
   ```bash
   td hook bead-123 --lane standard
   td sling bead-123 deacon --lane standard --message "hello"
   ```
3) Confirm Kafka topics receive events
4) Verify Datadog metrics/logs appear

## Next steps

- Add manifest templates under `tundra-dome/k8s/`
- Add CI checks for topic list + DAG lint
- Wire dashboards for “Superdome‑style” operations
