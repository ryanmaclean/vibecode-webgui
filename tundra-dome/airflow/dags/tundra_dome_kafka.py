from __future__ import annotations

from datetime import datetime
import json
import os

from airflow import DAG
from airflow.operators.python import PythonOperator
from kafka import KafkaProducer


def emit_bead_event() -> None:
    brokers = os.environ.get("KAFKA_BROKERS", "localhost:9092").split(",")
    topic = os.environ.get("KAFKA_TOPIC", "tundra-beads-created")
    payload = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "type": "hook",
        "bead": f"tundra-{int(datetime.utcnow().timestamp())}",
        "actor": "tundra/airflow",
        "payload": {"source": "airflow", "rig": "tundra"},
        "rig": "tundra",
        "role": "mayor",
        "stage": "hooked",
        "service": "gastown",
    }
    producer = KafkaProducer(bootstrap_servers=brokers)
    producer.send(topic, json.dumps(payload).encode("utf-8"))
    producer.flush(10)
    producer.close(5)


default_args = {"owner": "tundra", "retries": 0}

with DAG(
    dag_id="tundra_dome_kafka_emit",
    description="Emit real bead events into Kafka for DSM + GT/OC coordination",
    schedule="*/5 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    default_args=default_args,
    tags=["tundra", "gastown", "openclaw", "kafka"],
) as dag:
    PythonOperator(task_id="emit_bead_event", python_callable=emit_bead_event)
