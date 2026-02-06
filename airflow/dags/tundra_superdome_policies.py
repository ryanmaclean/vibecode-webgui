from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092").split(",")
KPI_SNAPSHOT = Path(os.environ.get("KPI_SNAPSHOT", "/Users/studio/gt/logs/kpi_snapshot.json"))
KPI_THRESHOLDS = Path(os.environ.get("KPI_THRESHOLDS", "/Users/studio/gt/settings/kpi-thresholds.json"))
DEFAULT_THRESHOLDS = {
    "beads_failed_15m": 3,
    "role_activity_min_15m": 1,
    "agent_churn_15m": 1,
    "escalations_stale_4h": 1,
    "ci_failed_15m": 1,
    "mail_backlog_15m": 5,
    "nudges_unanswered_15m": 3,
    "convoy_stall_4h": 1,
    "merge_backlog_4h": 1,
}


def _producer():
    # Lazy import to keep DagBag import fast and avoid Kafka dependency at parse time
    from kafka import KafkaProducer

    return KafkaProducer(bootstrap_servers=KAFKA_BROKERS)


def _send(topic: str, payload: dict) -> None:
    producer = _producer()
    producer.send(topic, json.dumps(payload).encode("utf-8"))
    producer.flush(10)
    producer.close(5)


def _load_kpi() -> dict:
    if not KPI_SNAPSHOT.exists():
        return {}
    return json.loads(KPI_SNAPSHOT.read_text())

def _load_thresholds() -> dict:
    if KPI_THRESHOLDS.exists():
        return {**DEFAULT_THRESHOLDS, **json.loads(KPI_THRESHOLDS.read_text())}
    return dict(DEFAULT_THRESHOLDS)


def lane_router() -> None:
    kpi = _load_kpi()
    lane = kpi.get("lane") or "standard"
    topic = f"tundra-lane-{lane}-beads"
    _send(topic, {
        "ts": datetime.utcnow().isoformat() + "Z",
        "lane": lane,
        "type": "route",
        "payload": kpi,
    })


def lane_watchdog() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    failed = kpi.get("beads_failed_15m", 0)
    limit = thresholds.get("beads_failed_15m", 3)
    if failed and failed > limit:
        _send("tundra-deacon-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "escalate",
            "severity": "high",
            "message": f"Lane failure spike >{limit} in 15m",
            "reason": "beads.failed threshold",
            "source": "tundra_lane_watchdog",
        })


def role_allocator() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    activity = kpi.get("role_activity_15m")
    if activity is not None and activity < thresholds.get("role_activity_min_15m", 1):
        _send("tundra-polecats-events", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "nudge",
            "target": "deacon",
            "message": "Role activity low; rebalance polecats",
        })


def auto_recovery() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    churn = kpi.get("agent_churn_15m")
    if churn is not None and churn >= thresholds.get("agent_churn_15m", 1):
        _send("tundra-deacon-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "nudge",
            "target": "deacon",
            "message": "Agent churn detected; reassign work",
        })


def escalation_gate() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    stale = kpi.get("escalations_stale_4h")
    if stale is not None and stale >= thresholds.get("escalations_stale_4h", 1):
        _send("tundra-mayor-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "escalate",
            "severity": "critical",
            "message": "Stale escalation >4h",
            "reason": "escalations.unacked threshold",
            "source": "tundra_escalation_gate",
        })


def ci_cd_rigor() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    failed = kpi.get("ci_failed_15m")
    if failed is not None and failed >= thresholds.get("ci_failed_15m", 1):
        _send("tundra-mayor-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "escalate",
            "severity": "high",
            "message": "CI failing on critical lane",
            "reason": "ci pipeline failed",
            "source": "tundra_ci_cd_rigor",
        })


def mail_watchdog() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    backlog = kpi.get("mail_backlog_15m", 0)
    limit = thresholds.get("mail_backlog_15m", 5)
    if backlog >= limit:
        _send("tundra-deacon-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "nudge",
            "target": "deacon",
            "message": f"Mail backlog {backlog} >= {limit} in 15m",
            "reason": "mail backlog threshold",
            "source": "tundra_mail_watchdog",
        })


def nudge_watchdog() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    sent = kpi.get("nudges_sent_15m", 0)
    responded = kpi.get("nudges_responded_15m", 0)
    limit = thresholds.get("nudges_unanswered_15m", 3)
    unanswered = max(0, sent - responded)
    if unanswered >= limit and sent > 0:
        _send("tundra-deacon-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "nudge",
            "target": "deacon",
            "message": f"Nudges unanswered {unanswered} >= {limit} in 15m",
            "reason": "nudge response threshold",
            "source": "tundra_nudge_watchdog",
        })


def convoy_watchdog() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    started = kpi.get("convoy_started_4h", 0)
    completed = kpi.get("convoy_completed_4h", 0)
    limit = thresholds.get("convoy_stall_4h", 1)
    stalled = max(0, started - completed)
    if stalled >= limit and started > 0:
        _send("tundra-mayor-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "escalate",
            "severity": "high",
            "message": f"Convoy stall {stalled} >= {limit} in 4h",
            "reason": "convoy backlog threshold",
            "source": "tundra_convoy_watchdog",
        })


def merge_watchdog() -> None:
    kpi = _load_kpi()
    thresholds = _load_thresholds()
    prs_opened = kpi.get("prs_opened_4h", 0)
    merged = kpi.get("merged_code_4h", 0)
    limit = thresholds.get("merge_backlog_4h", 1)
    backlog = max(0, prs_opened - merged)
    if backlog >= limit and prs_opened > 0:
        _send("tundra-mayor-commands", {
            "ts": datetime.utcnow().isoformat() + "Z",
            "action": "nudge",
            "target": "mayor",
            "message": f"Merge backlog {backlog} >= {limit} in 4h",
            "reason": "merge backlog threshold",
            "source": "tundra_merge_watchdog",
        })


def _dag(dag_id: str, schedule: str, _callable_fn) -> DAG:
    return DAG(
        dag_id=dag_id,
        description="Tundra Dome Superdome policy DAG",
        schedule=schedule,
        start_date=datetime(2026, 2, 1),
        catchup=False,
        default_args={"owner": "tundra", "retries": 0},
        tags=["tundra", "superdome", "kpi"],
    )


with _dag("tundra_lane_router", "*/1 * * * *", lane_router) as dag1:
    PythonOperator(task_id="route_lane", python_callable=lane_router)

with _dag("tundra_lane_watchdog", "*/2 * * * *", lane_watchdog) as dag2:
    PythonOperator(task_id="watch_lane", python_callable=lane_watchdog)

with _dag("tundra_role_allocator", "*/2 * * * *", role_allocator) as dag3:
    PythonOperator(task_id="alloc_roles", python_callable=role_allocator)

with _dag("tundra_auto_recovery", "*/5 * * * *", auto_recovery) as dag4:
    PythonOperator(task_id="auto_recover", python_callable=auto_recovery)

with _dag("tundra_escalation_gate", "*/1 * * * *", escalation_gate) as dag5:
    PythonOperator(task_id="gate_escalations", python_callable=escalation_gate)

with _dag("tundra_ci_cd_rigor", "*/5 * * * *", ci_cd_rigor) as dag6:
    PythonOperator(task_id="ci_cd_rigor", python_callable=ci_cd_rigor)

with _dag("tundra_mail_watchdog", "*/5 * * * *", mail_watchdog) as dag7:
    PythonOperator(task_id="mail_watchdog", python_callable=mail_watchdog)

with _dag("tundra_nudge_watchdog", "*/5 * * * *", nudge_watchdog) as dag8:
    PythonOperator(task_id="nudge_watchdog", python_callable=nudge_watchdog)

with _dag("tundra_convoy_watchdog", "*/10 * * * *", convoy_watchdog) as dag9:
    PythonOperator(task_id="convoy_watchdog", python_callable=convoy_watchdog)

with _dag("tundra_merge_watchdog", "*/10 * * * *", merge_watchdog) as dag10:
    PythonOperator(task_id="merge_watchdog", python_callable=merge_watchdog)
