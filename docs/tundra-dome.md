# Tundra Dome (local + ssh studio)

Tundra Dome is the local coordination layer that pushes/consumes Gas Town events via Kafka and runs Airflow DAGs for routing + policy enforcement.

## What’s running (observed)

On this box **and** `ssh studio`, these processes are active:

- **Airflow**
  - `airflow scheduler`
  - `airflow dag-processor`
  - `airflow api-server --port 8080`
- **Kafka (local)**
  - `kafka.Kafka /opt/homebrew/etc/kafka/server.properties`
- **Kafka DSM services**
  - `daemon/kafka-dsm/gt-kafka-consumer.js`
  - `daemon/kafka-dsm/tundra-observer.js`

## Airflow DAGs (Tundra Dome)

Location: `airflow/dags/`

- **tundra_dome_kafka_emit** (`tundra_dome_kafka.py`)
  - Emits bead events into Kafka every 5 minutes.
  - Env:
    - `KAFKA_BROKERS` (default `localhost:9092`)
    - `KAFKA_TOPIC` (default `gastown-beads`)
- **tundra_dome_integrations** (`tundra_dome_integrations.py`)
  - Placeholder ticks for Gas Town/OpenClaw/OpenCode/OpenRouter every 10 minutes.
- **tundra_superdome_policies** (`tundra_superdome_policies.py`)
  - KPI-driven routing + enforcement DAGs:
    - `tundra_lane_router` (*/1)
    - `tundra_lane_watchdog` (*/2)
    - `tundra_role_allocator` (*/2)
    - `tundra_auto_recovery` (*/5)
    - `tundra_escalation_gate` (*/1)
    - `tundra_ci_cd_rigor` (*/5)
  - Env:
    - `KAFKA_BROKERS` (default `localhost:9092`)
    - `KPI_SNAPSHOT` (default `/Users/studio/gt/logs/kpi_snapshot.json`)
    - `KPI_THRESHOLDS` (default `/Users/studio/gt/settings/kpi-thresholds.json`)

## Kafka DSM bridge + observer

Location: `daemon/kafka-dsm/`

### gt-kafka-consumer

- **Script:** `gt-kafka-consumer.sh`
- **Env:** `gt-kafka-consumer.env`
- **Purpose:** Consumes Kafka events and nudges/reroutes Gas Town.
- **Defaults:**
  - `KAFKA_BROKERS=localhost:9092`
  - `KAFKA_TOPICS=gastown-beads,tundra-mayor-commands,tundra-deacon-commands,tundra-audit-actions`
  - `GT_CMD=/Users/studio/go/bin/gt`
  - `GT_NUDGE_TARGET=mayor`
  - `GT_BEAD_NUDGE_TARGET=witness`

### gt-kafka-emitter

- **Script:** `gt-kafka-emitter.sh`
- **Env:** `gt-kafka-emitter.env`
- **Purpose:** Tails `GT_EVENTS_PATH` and emits bead events to Kafka.
- **Defaults:**
  - `KAFKA_BROKERS=localhost:9092`
  - `KAFKA_TOPIC=gastown-beads`
  - `GT_EVENTS_PATH=/Users/studio/gt/.events.jsonl`

### tundra-observer

- **Script:** `tundra-observer.sh`
- **Env:** `tundra-observer.env`
- **Purpose:** Observes Kafka topics and logs to JSONL (plus Datadog).
- **Defaults:**
  - `OBSERVER_TOPICS=tundra-chat-private,tundra-chat-shared,tundra-chat-gossip,tundra-work-intake,tundra-audit-actions,tundra-metrics-kpi`
  - `OBSERVER_LOG=/Users/studio/gt/logs/tundra-observer.jsonl`

## How to get involved (OpenClaw)

- **Monitor**
  - Check Airflow DAG health, schedule drift, and failures.
  - Watch Kafka consumer lag / missing topic messages.
  - Tail observer logs and surface anomalies.
- **Operate**
  - Restart Airflow or Kafka DSM scripts when they stall.
  - Nudge Gas Town based on KPI thresholds.
- **Document**
  - Keep this doc in sync with new DAGs, topics, and scripts.

## Useful commands

> Local

- `ps aux | rg -i "airflow|tundra|kafka|dsm|gt-kafka|tundra-observer"`
- `ls -la /Users/studio/gt/airflow/dags`
- `ls -la /Users/studio/gt/daemon/kafka-dsm`

> Remote (same check)

- `ssh studio "ps aux | rg -i 'airflow|tundra|kafka|dsm|gt-kafka|tundra-observer'"`

## Notes

- Airflow config + DB live in `airflow/`.
- Logs live in `logs/` (including `tundra-observer.jsonl`).
- Kafka topics list: `daemon/kafka-dsm/kafka-topics.txt`.
