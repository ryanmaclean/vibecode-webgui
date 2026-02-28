"""
Tundra Dome – GitHub Sync DAG

Monitors GitHub issues and PRs, syncing new items to appropriate lanes based on
labels and metadata. Maintains state to avoid duplicate processing and integrates
with the Kafka-based bead system for downstream orchestration.
"""
from __future__ import annotations

from datetime import datetime
import json
import os
from typing import List, Dict, Any

from airflow.decorators import dag, task
from airflow.models import Variable
from airflow.exceptions import AirflowSkipException


GITHUB_REPO = os.environ.get("TUNDRA_GITHUB_REPO", "ryanmaclean/vibecode-webgui")
GITHUB_SYNC_STATE_KEY = "TUNDRA_GITHUB_SYNC_STATE"


@dag(
    dag_id="tundra_github_sync",
    description="Sync GitHub issues/PRs to lane beads via Kafka",
    schedule="*/5 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "tundra", "retries": 0},
    tags=["tundra", "github", "sync", "lanes"],
)
def tundra_github_sync():
    @task()
    def fetch_github_issues() -> List[Dict[str, Any]]:
        """Fetch open issues from GitHub repo."""
        # Placeholder: replace with actual gh CLI or API call
        # gh issue list -R {GITHUB_REPO} --json number,title,labels,createdAt
        state_raw = Variable.get(GITHUB_SYNC_STATE_KEY, default_var="{}")
        state = json.loads(state_raw)
        processed_issues = set(state.get("issues", []))

        # Stub: return empty list if no new issues
        # In production, this would call GitHub API
        mock_issues = []

        if not mock_issues:
            raise AirflowSkipException("no new github issues")

        return [i for i in mock_issues if i["number"] not in processed_issues]

    @task()
    def route_issue_to_lane(issue: Dict[str, Any]) -> str:
        """Determine target lane based on issue labels."""
        labels = [label.get("name", "") for label in issue.get("labels", [])]

        if "critical" in labels or "urgent" in labels:
            return "critical"
        elif "experimental" in labels or "research" in labels:
            return "experimental"
        else:
            return "standard"

    @task()
    def emit_bead_event(issue: Dict[str, Any], lane: str) -> None:
        """Emit Kafka event for bead creation."""
        # Placeholder: replace with actual Kafka producer or td emit
        print(f"[github-sync] lane={lane} issue={issue.get('number')} title={issue.get('title')}")

        # Update state to mark as processed
        state_raw = Variable.get(GITHUB_SYNC_STATE_KEY, default_var="{}")
        state = json.loads(state_raw)
        issues = set(state.get("issues", []))
        issues.add(issue["number"])
        state["issues"] = list(issues)[-500:]  # Keep last 500
        Variable.set(GITHUB_SYNC_STATE_KEY, json.dumps(state))

    issues = fetch_github_issues()
    lanes = route_issue_to_lane.expand(issue=issues)
    emit_bead_event.partial().expand(issue=issues, lane=lanes)


dag = tundra_github_sync()
