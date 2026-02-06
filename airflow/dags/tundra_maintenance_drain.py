"""
Tundra Dome – Maintenance Drain DAG

Consumes a backlog of maintenance items stored in an Airflow Variable
`TUNDRA_MAINTENANCE_QUEUE` (JSON list of objects), processes up to N items per
run, then writes the remainder back. This keeps cron-style maintenance jobs from
stacking up while preserving rate limits.
"""
from __future__ import annotations

from datetime import datetime
import json
from typing import List, Dict, Any

from airflow.decorators import dag, task
from airflow.models import Variable
from airflow.exceptions import AirflowSkipException


@dag(
    dag_id="tundra_maintenance_drain",
    description="Drain stored maintenance jobs with rate limiting",
    schedule="*/15 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "tundra", "retries": 0},
    tags=["tundra", "maintenance", "backlog"],
)
def tundra_maintenance_drain():
    @task()
    def pop_queue(batch_size: int = 5) -> List[Dict[str, Any]]:
        raw = Variable.get("TUNDRA_MAINTENANCE_QUEUE", default_var="[]")
        queue: List[Dict[str, Any]] = json.loads(raw)
        if not queue:
            raise AirflowSkipException("maintenance queue empty")
        batch = queue[:batch_size]
        Variable.set("TUNDRA_MAINTENANCE_QUEUE", json.dumps(queue[batch_size:]))
        return batch

    @task()
    def process_item(item: Dict[str, Any]) -> None:
        print(f"[maintenance] task={item.get('task')} target={item.get('target')} note={item.get('note')}")

    items = pop_queue()
    process_item.expand(item=items)


dag = tundra_maintenance_drain()
