"""
Tundra Dome – Timed Jobs Template DAG

Use this as a pattern for scheduled (cron) jobs that should remain separate from
ad-hoc slings or backlog drains.
"""
from __future__ import annotations

from datetime import datetime

from airflow.decorators import dag, task


@dag(
    dag_id="tundra_timed_jobs_template",
    description="Template for time-based jobs (replace tasks with real work)",
    schedule="0 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    default_args={"owner": "tundra", "retries": 1},
    tags=["tundra", "timed", "template"],
)
def tundra_timed_jobs_template():
    @task()
    def hourly_health():
        print("[timed] hourly health check placeholder")

    @task()
    def cleanup_tmp():
        print("[timed] cleanup placeholder")

    hourly_health() >> cleanup_tmp()


dag = tundra_timed_jobs_template()
