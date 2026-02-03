"""
Tundra Dome – Sling Ingest DAG

Pulls recent sling/work events from Kafka (tundra-work-intake + lane topics) and
maps each event into per-item tasks. Works best when kafka-python is available
inside the Airflow image; otherwise it exits gracefully with an empty batch.
"""
from __future__ import annotations

from datetime import datetime, timedelta
import json
import os
from typing import List, Dict, Any

from airflow.decorators import dag, task
from airflow.exceptions import AirflowSkipException

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "kafka-service:9092")
WORK_TOPICS = os.environ.get(
    "TUNDRA_WORK_TOPICS",
    "tundra-work-intake,tundra-beads-created,tundra-lane-standard-beads",
).split(",")
BATCH_MAX = int(os.environ.get("TUNDRA_SLING_BATCH_MAX", "50"))
POLL_MS = int(os.environ.get("TUNDRA_SLING_POLL_MS", "2000"))


@dag(
    dag_id="tundra_sling_ingest",
    description="Poll sling/work Kafka topics and fan out to per-event tasks",
    schedule="*/2 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "tundra", "retries": 0},
    tags=["tundra", "gastown", "kafka", "sling"],
)
def tundra_sling_ingest():
    @task()
    def fetch_events() -> List[Dict[str, Any]]:
        try:
            from kafka import KafkaConsumer  # type: ignore
        except Exception:
            # kafka-python not present; skip without failing the DAG
            raise AirflowSkipException("kafka-python not installed in image")

        consumer = KafkaConsumer(
            *WORK_TOPICS,
            bootstrap_servers=KAFKA_BROKERS.split(","),
            enable_auto_commit=False,
            consumer_timeout_ms=POLL_MS,
            auto_offset_reset="latest",
        )
        events: List[Dict[str, Any]] = []
        try:
            for msg in consumer:
                try:
                    evt = json.loads(msg.value.decode("utf-8"))
                except Exception:
                    continue
                evt["_topic"] = msg.topic
                events.append(evt)
                if len(events) >= BATCH_MAX:
                    break
        finally:
            consumer.close()
        if not events:
            raise AirflowSkipException("no events fetched")
        return events

    @task()
    def route_event(evt: Dict[str, Any]) -> str:
        # Stub routing; in real use this would decide target DAG/operator
        return evt.get("lane", "standard")

    @task()
    def process_event(evt: Dict[str, Any], lane: str) -> None:
        # Placeholder processing hook; replace with real work (API call, GT sling, etc.)
        print(f"[sling-ingest] lane={lane} topic={evt.get('_topic')} bead={evt.get('bead')} actor={evt.get('actor')}")

    events = fetch_events()
    lanes = route_event.expand(evt=events)
    process_event.partial().expand(evt=events, lane=lanes)


dag = tundra_sling_ingest()
