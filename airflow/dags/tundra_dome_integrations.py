from __future__ import annotations

from datetime import datetime
from airflow import DAG
from airflow.operators.bash import BashOperator


default_args = {"owner": "tundra", "retries": 0}

with DAG(
    dag_id="tundra_dome_integrations",
    description="Coordinate Gas Town + OpenClaw + OpenCode + OpenRouter (placeholders)",
    schedule="*/10 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    default_args=default_args,
    tags=["tundra", "gastown", "openclaw", "opencode", "openrouter"],
) as dag:
    BashOperator(
        task_id="gastown_tick",
        bash_command="echo 'tundra dome: gastown tick'",
    )

    BashOperator(
        task_id="openclaw_tick",
        bash_command="echo 'tundra dome: openclaw tick'",
    )

    BashOperator(
        task_id="opencode_tick",
        bash_command="echo 'tundra dome: opencode tick'",
    )

    BashOperator(
        task_id="openrouter_tick",
        bash_command="echo 'tundra dome: openrouter tick'",
    )
