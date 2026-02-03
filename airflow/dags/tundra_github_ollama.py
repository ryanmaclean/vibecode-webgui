from __future__ import annotations

from datetime import datetime
import json
import os
import subprocess
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092").split(",")
TD_CMD = os.environ.get("TD_CMD", "/Users/studio/gt/daemon/kafka-dsm/td")
GH_CMD = os.environ.get("GH_CMD", "/opt/homebrew/bin/gh")
OLLAMA_CMD = os.environ.get("OLLAMA_CMD", "ollama")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "ryanmaclean/vibecode-webgui")
STATE_PATH = Path(os.environ.get("GITHUB_OLLAMA_STATE", "/Users/studio/gt/logs/github-ollama.state.json"))
EVENT_FILE = Path(os.environ.get("EVENT_FILE", "/Users/studio/gt/.events.jsonl"))


def _producer():
    # Lazy import to keep DagBag import fast and avoid Kafka dependency at parse time
    from kafka import KafkaProducer

    return KafkaProducer(bootstrap_servers=KAFKA_BROKERS)


def _send(topic: str, payload: dict) -> None:
    producer = _producer()
    producer.send(topic, json.dumps(payload).encode("utf-8"))
    producer.flush(10)
    producer.close(5)


def _load_state() -> dict:
    if not STATE_PATH.exists():
        return {"processed_issues": [], "processed_prs": []}
    return json.loads(STATE_PATH.read_text())


def _save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2))


def _run_ollama(prompt: str) -> str:
    """Run ollama to analyze issue/PR and suggest action."""
    try:
        result = subprocess.run(
            [OLLAMA_CMD, "run", OLLAMA_MODEL, prompt],
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def _run_gh(args: list[str]) -> str:
    """Run GitHub CLI command."""
    try:
        result = subprocess.run(
            [GH_CMD, *args],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout.strip()
    except Exception:
        return ""


def _run_td(args: list[str]) -> str:
    """Run Tundra Dome command."""
    try:
        result = subprocess.run(
            [TD_CMD, *args],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout.strip()
    except Exception:
        return ""


def _emit_event(actor: str, bead_id: str, message: str) -> None:
    """Emit event to .events.jsonl for td produce to pick up."""
    event = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "service": "gastown",
        "actor": actor,
        "type": "sling",
        "payload": {
            "bead": bead_id,
            "target": actor,
            "message": message
        }
    }
    with EVENT_FILE.open("a") as f:
        f.write(json.dumps(event) + "\n")


def process_github_issues() -> None:
    """Fetch open issues, analyze with ollama, assign to appropriate lane."""
    state = _load_state()
    processed = set(state.get("processed_issues", []))

    issues_json = _run_gh(["issue", "list", "-R", GITHUB_REPO, "--json", "number,title,body,labels", "-L", "20"])
    if not issues_json:
        return

    try:
        issues = json.loads(issues_json)
    except json.JSONDecodeError:
        return

    for issue in issues:
        issue_num = issue.get("number")
        if not issue_num or issue_num in processed:
            continue

        title = issue.get("title", "")
        body = issue.get("body", "")[:500]
        labels = [l.get("name", "") for l in issue.get("labels", [])]

        prompt = f"""Analyze this GitHub issue and suggest assignment:
Title: {title}
Body: {body}
Labels: {', '.join(labels)}

Respond with ONE word: critical, standard, or experimental based on urgency."""

        suggestion = _run_ollama(prompt).lower().strip()
        lane = "standard"
        if "critical" in suggestion:
            lane = "critical"
        elif "experimental" in suggestion:
            lane = "experimental"

        actor = "mayor" if lane == "critical" else "witness" if lane == "standard" else "deacon"
        bead_id = f"gh-issue-{issue_num}"

        _send(f"tundra-lane-{lane}-beads", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "type": "issue",
            "action": "assigned",
            "lane": lane,
            "issue": issue_num,
            "title": title,
            "actor": actor
        })

        _emit_event(actor, bead_id, f"td dispatch && gh issue view {issue_num}")
        _run_td(["emit"])

        processed.add(issue_num)

    state["processed_issues"] = list(processed)[-100:]
    _save_state(state)


def process_github_prs() -> None:
    """Check merged PRs and close related issues via ollama analysis."""
    state = _load_state()
    processed = set(state.get("processed_prs", []))

    prs_json = _run_gh(["pr", "list", "-R", GITHUB_REPO, "--state", "merged", "--json", "number,title,body", "-L", "10"])
    if not prs_json:
        return

    try:
        prs = json.loads(prs_json)
    except json.JSONDecodeError:
        return

    for pr in prs:
        pr_num = pr.get("number")
        if not pr_num or pr_num in processed:
            continue

        title = pr.get("title", "")
        body = pr.get("body", "")[:500]

        prompt = f"""This PR was merged. Extract the issue number it fixes (if any):
Title: {title}
Body: {body}

Respond with ONLY the issue number (e.g., 42) or 'none' if no issue referenced."""

        response = _run_ollama(prompt).strip()

        if response.isdigit():
            issue_num = int(response)
            _run_gh(["issue", "close", str(issue_num), "-R", GITHUB_REPO, "-c", f"Closed by PR #{pr_num}"])

            _send("tundra-lane-standard-beads", {
                "ts": datetime.utcnow().isoformat() + "Z",
                "type": "pr",
                "action": "closed_issue",
                "pr": pr_num,
                "issue": issue_num
            })

            _emit_event("refinery", f"gh-pr-{pr_num}", f"td emit && gh issue view {issue_num}")

        processed.add(pr_num)

    state["processed_prs"] = list(processed)[-100:]
    _save_state(state)


with DAG(
    dag_id="tundra_github_ollama",
    description="Process GitHub issues/PRs with ollama + td (Tundra Dome) + Kafka",
    schedule="*/3 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    default_args={"owner": "tundra", "retries": 1},
    tags=["tundra", "github", "ollama", "kafka", "td"],
) as dag:
    issue_task = PythonOperator(
        task_id="process_github_issues",
        python_callable=process_github_issues
    )
    pr_task = PythonOperator(
        task_id="process_github_prs",
        python_callable=process_github_prs
    )
    issue_task >> pr_task
