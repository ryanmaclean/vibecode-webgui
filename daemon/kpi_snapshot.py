#!/usr/bin/env python3
"""Generate KPI snapshot from local GT/OC metrics logs."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

DEFAULT_LOGS = [
    Path("/Users/studio/gt/logs/kafka-gt-consumer.jsonl"),
    Path("/Users/studio/gt/logs/td-event-emitter.jsonl"),
]
DEFAULT_OUT = Path("/Users/studio/gt/logs/kpi_snapshot.json")


def _parse_ts(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _iter_events(paths: Iterable[Path]) -> Iterable[dict]:
    for path in paths:
        if not path.exists():
            continue
        with path.open() as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


def _windowed(events: Iterable[dict], since: datetime) -> list[dict]:
    items = []
    for event in events:
        ts = _parse_ts(event.get("ts") or event.get("timestamp"))
        if ts is None:
            continue
        if ts >= since:
            event["_ts"] = ts
            items.append(event)
    return items


def _stage_from_topic(topic: str | None) -> str | None:
    if not topic:
        return None
    mapping = {
        "tundra-beads-created": "hooked",
        "tundra-beads-in-progress": "in_progress",
        "tundra-beads-completed": "completed",
        "tundra-beads-escalated": "escalated",
        "tundra-beads-failed": "failed",
    }
    return mapping.get(topic)


def _event_name(event: dict) -> str | None:
    name = event.get("event") or event.get("type")
    if name in {"issues", "issue"}:
        action = (event.get("body") or {}).get("action")
        if action == "opened":
            return "issue.opened"
        if action == "closed":
            return "issue.closed"
    if name in {"pull_request", "pull"}:
        action = (event.get("body") or {}).get("action")
        if action == "opened":
            return "pr.opened"
        if action == "closed":
            if (event.get("body") or {}).get("pull_request", {}).get("merged"):
                return "merge.completed"
            return "pr.closed"
    if name:
        return str(name)
    topic = event.get("topic")
    if topic == "tundra-nudges":
        return "nudge.sent"
    if topic == "tundra-whispers":
        return "whisper.sent"
    if topic == "tundra-mail-outbox":
        return "mail.sent"
    if topic == "tundra-mail-inbox":
        return "mail.read"
    if topic and topic.endswith("-commands"):
        return "role.activity"
    return None


def _count_beads(events: Iterable[dict]) -> Counter:
    counts = Counter()
    for event in events:
        stage = None
        if event.get("event") == "bead.lifecycle":
            stage = event.get("stage")
        if not stage:
            stage = _stage_from_topic(event.get("topic"))
        if stage:
            counts[stage] += 1
    return counts


def _count_event(events: Iterable[dict], key: str) -> int:
    return sum(1 for event in events if _event_name(event) == key)


def _infer_lane(beads_failed_15m: int, escalations_stale_4h: int, total_events_4h: int) -> str:
    if beads_failed_15m >= 3 or escalations_stale_4h > 0:
        return "critical"
    if total_events_4h < 5:
        return "experimental"
    return "standard"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", default=",".join(str(p) for p in DEFAULT_LOGS))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    window_4h = now - timedelta(hours=4)
    window_15m = now - timedelta(minutes=15)

    log_paths = [Path(p.strip()) for p in str(args.log).split(",") if p.strip()]
    events_4h = _windowed(_iter_events(log_paths), window_4h)
    events_15m = [event for event in events_4h if event["_ts"] >= window_15m]

    bead_counts_4h = _count_beads(events_4h)
    beads_failed_15m = _count_beads(events_15m).get("failed", 0)

    snapshot = {
        "generated_at": now.isoformat(),
        "source": "local",
        "window_hours": 4,
        "beads_hooked_4h": bead_counts_4h.get("hooked", 0),
        "beads_in_progress_4h": bead_counts_4h.get("in_progress", 0),
        "beads_completed_4h": bead_counts_4h.get("completed", 0),
        "beads_escalated_4h": bead_counts_4h.get("escalated", 0),
        "beads_failed_4h": bead_counts_4h.get("failed", 0),
        "beads_failed_15m": beads_failed_15m,
        "role_activity_15m": _count_event(events_15m, "role.activity"),
        "nudges_sent_15m": _count_event(events_15m, "nudge.sent"),
        "nudges_responded_15m": _count_event(events_15m, "nudge.responded"),
        "whispers_sent_15m": _count_event(events_15m, "whisper.sent"),
        "mail_sent_15m": _count_event(events_15m, "mail.sent"),
        "mail_read_15m": _count_event(events_15m, "mail.read"),
        "convoy_started_4h": _count_event(events_4h, "convoy.started"),
        "convoy_completed_4h": _count_event(events_4h, "convoy.completed"),
        "merged_code_4h": _count_event(events_4h, "merge.completed"),
        "issues_opened_4h": _count_event(events_4h, "issue.opened"),
        "issues_closed_4h": _count_event(events_4h, "issue.closed"),
        "prs_opened_4h": _count_event(events_4h, "pr.opened"),
        "prs_closed_4h": _count_event(events_4h, "pr.closed"),
        "branches_opened_4h": _count_event(events_4h, "branch.opened"),
        "branches_closed_4h": _count_event(events_4h, "branch.closed"),
        "agent_churn_15m": _count_event(events_15m, "agent.churn"),
        "escalations_stale_4h": _count_event(events_4h, "escalation.stale"),
        "ci_failed_15m": _count_event(events_15m, "ci.failed"),
    }
    snapshot["mail_backlog_15m"] = max(0, snapshot["mail_sent_15m"] - snapshot["mail_read_15m"])

    snapshot["lane"] = _infer_lane(
        snapshot["beads_failed_15m"],
        snapshot["escalations_stale_4h"],
        len(events_4h),
    )

    Path(args.out).write_text(json.dumps(snapshot, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
