# Tundra Dome Airflow Playbook

This documents how to recreate and operate the Airflow DAGs that coordinate slings, timed jobs, and maintenance backlogs for Tundra Dome.

## DAGs in this repo

| DAG ID | Purpose | Schedule | File |
| --- | --- | --- | --- |
| `tundra_sling_ingest` | Poll Kafka sling/work topics and fan out per event | `*/2 * * * *` | `airflow/dags/tundra_sling_ingest.py` |
| `tundra_maintenance_drain` | Drain stored maintenance backlog (rate-limited) | `*/15 * * * *` | `airflow/dags/tundra_maintenance_drain.py` |
| `tundra_timed_jobs_template` | Example timed/cron job DAG | `0 * * * *` | `airflow/dags/tundra_timed_jobs_template.py` |
| Existing DAGs | Kafka emit test, integrations, etc. | see `airflow/dags/` | |

## Superdome management style (intent)
- Kafka stays the **front door** for live work (slings); Airflow orchestrates, retries, and records lineage.
- Timed jobs live as separate DAGs (no mixing cron with live slings).
- Maintenance backlog is a deliberate queue (Variable) drained at a controlled rate.
- Datadog watches both layers: queue health (Kafka/consumer lag) and orchestration health (Airflow DAG failures/heartbeats).

## Environments / variables

Shared env (already present in the cluster images):
- `DD_API_KEY`, `DD_APP_KEY`, `DD_SITE`
- `KAFKA_BROKERS` (default `kafka-service:9092`)
- `TUNDRA_WORK_TOPICS` (default `tundra-work-intake,tundra-beads-created,tundra-lane-standard-beads`)
- `TUNDRA_SLING_BATCH_MAX` (default `50`)
- `TUNDRA_SLING_POLL_MS` (default `2000`)

Airflow Variables:
- `TUNDRA_MAINTENANCE_QUEUE`: JSON array of maintenance items, e.g.  
  `[{"task":"rotate-logs","target":"mbp_m1","note":"weekly"},{"task":"cleanup-tmp","target":"studio"}]`

## On-demand jobs (manual trigger)

Use `airflow dags trigger` with conf:
```bash
airflow dags trigger tundra_sling_ingest --conf '{"inject":"manual"}'
airflow dags trigger tundra_timed_jobs_template --conf '{"run":"now"}'
```

`tundra_sling_ingest` will skip gracefully if no Kafka client is available (returns AirflowSkip).

## Timed jobs

Add new timed DAGs by copying `tundra_timed_jobs_template.py`, adjusting `schedule` and tasks. Keep each timed job small and single-purpose to avoid cron pileups.

## Maintenance backlog

Load backlog items into the Airflow Variable, then let `tundra_maintenance_drain` run every 15 minutes, processing up to 5 items per run. To bulk add:
```bash
airflow variables set TUNDRA_MAINTENANCE_QUEUE '[{"task":"patch-agents","target":"kind"},{"task":"compact-topics","target":"kafka"}]'
```

## Recreate in another environment

1) Copy DAG files under `airflow/dags/`.
2) Ensure `kafka-python` is installed in the Airflow image if you want live Kafka polling (`pip install kafka-python`).
3) Set env vars (DD keys, KAFKA_BROKERS) in your Helm chart/manifest or Docker Compose.
4) Create Airflow Variable `TUNDRA_MAINTENANCE_QUEUE` as needed.
5) Deploy Datadog Agent with `DD_ENV=kind` and tags `cluster:tundra-dome`.

## Monitors to add in Datadog
- No `tundra.td_sling.emitted` for >5m (any env:kind).
- No `tundra.observer.processed` for >5m.
- Consumer lag for `gastown-bridge` group.
- Airflow DAG failure counts for the three DAGs above.

## Smoke test
1) Produce a bead to Kafka:
   ```bash
   kubectl exec -n tundra-dome deploy/kafka -- sh -lc 'echo "{\"bead\":\"smoke-$(date +%s)\",\"actor\":\"ops\"}" | /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic tundra-work-intake'
   ```
2) Wait for the next `tundra_sling_ingest` run; confirm Datadog metrics: `tundra.td_sling.emitted` increments and `tundra.observer.processed` increases.
3) Set a maintenance queue and wait for `tundra_maintenance_drain` to drain the first batch. Check Airflow logs for `[maintenance]` lines.
