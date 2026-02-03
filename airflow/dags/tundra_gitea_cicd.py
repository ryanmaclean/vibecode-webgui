from __future__ import annotations

from datetime import datetime
import fnmatch
import json
import os
import re
import subprocess
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092").split(",")
EVENT_LOG = Path(os.environ.get("GITEA_EVENT_LOG", "/Users/studio/gt/logs/gitea-events.jsonl"))
STATE_PATH = Path(os.environ.get("GITEA_EVENT_STATE", "/Users/studio/gt/logs/gitea-events.state.json"))
GT_CMD = os.environ.get("GT_CMD", "gt")
GT_PR_MERGED_ACTION = os.environ.get("GT_PR_MERGED_ACTION", "done")
GT_PR_MERGED_TARGET = os.environ.get("GT_PR_MERGED_TARGET", "mayor")
LANE_CRITICAL = os.environ.get("TUNDRA_LANE_MAP_CRITICAL", "main,master,release/*,hotfix/*")
LANE_STANDARD = os.environ.get("TUNDRA_LANE_MAP_STANDARD", "develop,dev,feature/*")
LANE_EXPERIMENTAL = os.environ.get("TUNDRA_LANE_MAP_EXPERIMENTAL", "test/*,exp/*,spike/*")


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
        return {"offset": 0}
    return json.loads(STATE_PATH.read_text())


def _save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state))

def _split_patterns(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]

def _lane_for_ref(ref: str) -> str:
    ref_name = ref.split("/")[-1] if ref else ""
    for pattern in _split_patterns(LANE_CRITICAL):
        if fnmatch.fnmatch(ref_name, pattern) or fnmatch.fnmatch(ref, pattern):
            return "critical"
    for pattern in _split_patterns(LANE_EXPERIMENTAL):
        if fnmatch.fnmatch(ref_name, pattern) or fnmatch.fnmatch(ref, pattern):
            return "experimental"
    for pattern in _split_patterns(LANE_STANDARD):
        if fnmatch.fnmatch(ref_name, pattern) or fnmatch.fnmatch(ref, pattern):
            return "standard"
    return "standard"

def _topic_for_lane(lane: str) -> str:
    return f"tundra-lane-{lane}-beads"

def _extract_issue_id(*fields: str) -> str | None:
    pattern = re.compile(r"\\b[a-z]{2,3}-[a-z0-9]{3,}\\b", re.IGNORECASE)
    for field in fields:
        if not field:
            continue
        match = pattern.search(field)
        if match:
            return match.group(0)
    return None

def _run_gt(args: list[str]) -> None:
    try:
        subprocess.run([GT_CMD, *args], check=False, capture_output=True, text=True)
    except FileNotFoundError:
        return


def translate_events() -> None:
    if not EVENT_LOG.exists():
        return

    state = _load_state()
    offset = state.get("offset", 0)
    data = EVENT_LOG.read_text()
    lines = data.splitlines()
    if offset >= len(lines):
        return

    for line in lines[offset:]:
        try:
            evt = json.loads(line)
        except Exception:
            continue

        event_type = evt.get("event")
        body = evt.get("body", {})

        if event_type == "pull_request":
            action = body.get("action")
            pr = body.get("pull_request", {})
            title = pr.get("title", "")
            number = pr.get("number", "")
            base_ref = pr.get("base", {}).get("ref", "")
            head_ref = pr.get("head", {}).get("ref", "")
            lane = _lane_for_ref(base_ref or head_ref)
            if action in {"opened", "reopened"}:
                _send(_topic_for_lane(lane), {
                    "ts": datetime.utcnow().isoformat() + "Z",
                    "type": "pr",
                    "lane": lane,
                    "action": "opened",
                    "ref": base_ref or head_ref,
                    "number": number,
                    "title": title,
                })
                _send("tundra-mayor-commands", {
                    "ts": datetime.utcnow().isoformat() + "Z",
                    "action": "nudge",
                    "target": "mayor",
                    "message": f"PR opened #{number}: {title}",
                })
            if action in {"closed"} and pr.get("merged"):
                issue_id = _extract_issue_id(title, head_ref, base_ref)
                if GT_PR_MERGED_ACTION == "sling" and issue_id:
                    _run_gt(["sling", issue_id, GT_PR_MERGED_TARGET])
                elif issue_id:
                    _run_gt(["done", "--issue", issue_id])
                else:
                    _send("tundra-mayor-commands", {
                        "ts": datetime.utcnow().isoformat() + "Z",
                        "action": "nudge",
                        "target": "witness",
                        "message": f"PR merged #{number}: {title}",
                    })

        if event_type == "push":
            ref = body.get("ref", "")
            lane = _lane_for_ref(ref)
            _send(_topic_for_lane(lane), {
                "ts": datetime.utcnow().isoformat() + "Z",
                "type": "push",
                "lane": lane,
                "ref": ref,
                "head": body.get("after", ""),
            })
            if ref.endswith("/main") or ref.endswith("/master"):
                _send("tundra-deacon-commands", {
                    "ts": datetime.utcnow().isoformat() + "Z",
                    "action": "nudge",
                    "target": "deacon",
                    "message": f"Push to {ref}",
                })

    state["offset"] = len(lines)
    _save_state(state)


with DAG(
    dag_id="tundra_gitea_cicd",
    description="Translate Gitea webhooks into GT actions",
    schedule="*/2 * * * *",
    start_date=datetime(2026, 2, 1),
    catchup=False,
    default_args={"owner": "tundra", "retries": 0},
    tags=["tundra", "gitea", "cicd"],
) as dag:
    PythonOperator(task_id="translate_gitea_events", python_callable=translate_events)
