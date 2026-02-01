#!/usr/bin/env python3
"""Send Gas Town metrics to Datadog via DogStatsD."""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Optional, Tuple

STATSD_HOST = os.getenv("DD_AGENT_HOST", "127.0.0.1")
STATSD_PORT = int(os.getenv("DD_DOGSTATSD_PORT", "8125"))

MIRROR_NAMESPACE = os.getenv("GASTOWN_METRICS_MIRROR_NAMESPACE", "ai_agent").strip()
MIRROR_PREFIXES = tuple(
    p.strip()
    for p in os.getenv(
        "GASTOWN_METRICS_MIRROR_PREFIXES",
        "gastown.,ralph.,sequential_thinking.,claude.,openai.,tokens.,mcp.",
    ).split(",")
    if p.strip()
)

STATE_PATH = os.path.join(
    os.getenv("XDG_CACHE_HOME", os.path.expanduser("~/.cache")),
    "gastown_metrics_state.json",
)


class MetricEmitter:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run

    def send(self, metric_name: str, value: float, metric_type: str = "g", tags: Optional[list] = None) -> bool:
        tags = tags or []
        ok = self._send_one(metric_name, value, metric_type, tags)
        if self._should_mirror(metric_name):
            ok = self._send_one(f"{MIRROR_NAMESPACE}.{metric_name}", value, metric_type, tags) and ok
        return ok

    def _send_one(self, metric_name: str, value: float, metric_type: str, tags: list) -> bool:
        tag_str = f"|#{','.join(tags)}" if tags else ""
        message = f"{metric_name}:{value}|{metric_type}{tag_str}"
        if self.dry_run:
            print(message)
            return True
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.sendto(message.encode(), (STATSD_HOST, STATSD_PORT))
            sock.close()
            return True
        except Exception as exc:
            print(f"Error sending {metric_name}: {exc}")
            return False

    def _should_mirror(self, metric_name: str) -> bool:
        if not MIRROR_NAMESPACE:
            return False
        if metric_name.startswith(f"{MIRROR_NAMESPACE}."):
            return False
        return any(metric_name.startswith(prefix) for prefix in MIRROR_PREFIXES)


def run_cmd(cmd: Iterable[str], timeout: int = 10) -> str:
    try:
        result = subprocess.run(list(cmd), capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        return ""
    except subprocess.TimeoutExpired:
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def run_json(cmd: Iterable[str], timeout: int = 10) -> Optional[Dict[str, Any]]:
    output = run_cmd(cmd, timeout=timeout)
    if not output:
        return None
    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return None


def parse_duration(value: str) -> timedelta:
    value = value.strip()
    if not value:
        return timedelta(hours=1)
    try:
        seconds = int(value)
        return timedelta(seconds=seconds)
    except ValueError:
        pass

    unit = value[-1]
    number = value[:-1]
    try:
        amount = float(number)
    except ValueError:
        return timedelta(hours=1)

    if unit == "s":
        return timedelta(seconds=amount)
    if unit == "m":
        return timedelta(minutes=amount)
    if unit == "h":
        return timedelta(hours=amount)
    if unit == "d":
        return timedelta(days=amount)
    return timedelta(hours=1)


def load_state(path: str = STATE_PATH) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def save_state(state: Dict[str, Any], path: str = STATE_PATH) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)


def bd_status() -> Dict[str, Any]:
    return run_json(["bd", "status", "--json"]) or {}


def bd_count(extra_args: Iterable[str]) -> int:
    data = run_json(["bd", "count", "--json", *extra_args]) or {}
    if "count" in data:
        return int(data.get("count", 0))
    if "total" in data:
        return int(data.get("total", 0))
    return 0


def bd_group_counts(extra_args: Iterable[str]) -> Dict[str, int]:
    data = run_json(["bd", "count", "--json", *extra_args]) or {}
    groups = data.get("groups", []) or []
    results: Dict[str, int] = {}
    for group in groups:
        if not isinstance(group, dict):
            continue
        key = (
            group.get("key")
            or group.get("value")
            or group.get("label")
            or group.get("name")
        )
        if key is None:
            continue
        count_value = (
            group.get("count")
            if "count" in group
            else group.get("total")
            if "total" in group
            else group.get("value_count")
        )
        try:
            results[str(key)] = int(count_value or 0)
        except (TypeError, ValueError):
            results[str(key)] = 0
    return results


def get_tmux_sessions() -> int:
    output = run_cmd(["tmux", "list-sessions"])
    if not output:
        return 0
    return len([line for line in output.split("\n") if line.strip()])


def get_zellij_sessions() -> int:
    output = run_cmd(["zellij", "list-sessions"])
    if not output:
        return 0
    return len([line for line in output.split("\n") if line.strip()])


def get_screen_sessions() -> int:
    output = run_cmd(["screen", "-ls"])
    if not output:
        return 0
    lines = output.split("\n")
    sessions = [line for line in lines if "." in line and "(" in line]
    return len(sessions)


def get_all_multiplexer_sessions() -> Dict[str, int]:
    return {
        "tmux": get_tmux_sessions(),
        "zellij": get_zellij_sessions(),
        "screen": get_screen_sessions(),
    }


def get_polecat_sessions() -> int:
    output = run_cmd(["tmux", "list-sessions"])
    if not output:
        return 0
    sessions = output.split("\n")
    agent_sessions = [
        s for s in sessions
        if s.startswith("gt-vibecode") or s.startswith("gt-ollama") or s.startswith("gt-fresh")
    ]
    return len(agent_sessions)


def get_sessions_by_type() -> Dict[str, int]:
    counts = {"vibecode": 0, "ollama": 0, "fresh": 0, "other": 0}
    output = run_cmd(["tmux", "list-sessions"])
    if not output:
        return counts
    sessions = output.split("\n")
    for session in sessions:
        if session.startswith("gt-vibecode"):
            counts["vibecode"] += 1
        elif session.startswith("gt-ollama"):
            counts["ollama"] += 1
        elif session.startswith("gt-fresh"):
            counts["fresh"] += 1
        elif session.startswith("gt-"):
            counts["other"] += 1
    return counts


def get_gt_status() -> Dict[str, Any]:
    status = {
        "active_polecats": 0,
        "total_polecats": 0,
        "active_by_type": {"vibecode": 0, "ollama": 0, "fresh": 0, "other": 0},
        "mayor": False,
        "deacon": False,
        "witness": False,
        "refinery": False,
        "crew_active": 0,
    }

    candidates = [
        ["gt", "status"],
        ["/Users/studio/go/bin/gt", "status"],
    ]
    output = ""
    for cmd in candidates:
        output = run_cmd(cmd, timeout=10)
        if output:
            break

    if not output:
        return status

    in_polecats = False
    for line in output.split("\n"):
        lower = line.lower()
        if "mayor" in lower and "●" in line:
            status["mayor"] = True
        if "deacon" in lower and "●" in line:
            status["deacon"] = True
        if "witness" in lower and "●" in line:
            status["witness"] = True
        if "refinery" in lower and "●" in line:
            status["refinery"] = True

        if "Polecats" in line:
            in_polecats = True
            import re
            match = re.search(r"\((\d+)\)", line)
            if match:
                status["total_polecats"] = int(match.group(1))

        if in_polecats and "●" in line:
            status["active_polecats"] += 1
            if "vibecode" in lower:
                status["active_by_type"]["vibecode"] += 1
            elif "ollama" in lower:
                status["active_by_type"]["ollama"] += 1
            elif "fresh" in lower:
                status["active_by_type"]["fresh"] += 1
            else:
                status["active_by_type"]["other"] += 1

        if "Crew" in line:
            import re
            match = re.search(r"\((\d+)\)", line)
            if match:
                status["crew_active"] = int(match.group(1))

    return status


def get_openclaw_jobs() -> Dict[str, int]:
    jobs = {
        "cron_jobs": 0,
        "poll_jobs": 0,
        "nudges_from_cron": 0,
        "nudges_from_poll": 0,
    }

    config_path = os.path.expanduser("~/.config/openclaw/jobs.json")
    if not os.path.exists(config_path):
        return jobs

    try:
        with open(config_path, "r", encoding="utf-8") as handle:
            config = json.load(handle)
    except Exception:
        return jobs

    jobs["cron_jobs"] = len(config.get("cron", []) or [])
    jobs["poll_jobs"] = len(config.get("poll", []) or [])
    return jobs


def get_process_count() -> int:
    output = run_cmd(["ps", "aux"])
    if not output:
        return 0
    return max(0, len(output.split("\n")) - 1)


def get_memory_stats() -> Dict[str, float]:
    stats = {"total_gb": 0.0, "used_pct": 0.0, "gpu_used_gb": 0.0}
    output = run_cmd(["sysctl", "hw.memsize"])
    if output:
        try:
            total_bytes = int(output.split(":")[1].strip())
            stats["total_gb"] = total_bytes / (1024 ** 3)
        except (IndexError, ValueError):
            pass

    output = run_cmd(["vm_stat"])
    if output and stats["total_gb"]:
        page_size = 16384
        active = inactive = wired = 0
        for line in output.split("\n"):
            if "page size of" in line:
                try:
                    page_size = int(line.split("page size of")[1].split("bytes")[0].strip())
                except (IndexError, ValueError):
                    continue
            elif "Pages active:" in line:
                active = int(line.split(":")[1].strip().replace(".", ""))
            elif "Pages inactive:" in line:
                inactive = int(line.split(":")[1].strip().replace(".", ""))
            elif "Pages wired down:" in line:
                wired = int(line.split(":")[1].strip().replace(".", ""))

        used_bytes = (active + wired) * page_size
        total_bytes = stats["total_gb"] * (1024 ** 3)
        stats["used_pct"] = (used_bytes / total_bytes) * 100 if total_bytes else 0
        stats["gpu_used_gb"] = (inactive * page_size) / (1024 ** 3)

    return stats


def get_git_stats(since: datetime) -> Dict[str, Any]:
    since_arg = since.isoformat()
    commits = run_cmd(["git", "log", f"--since={since_arg}", "--pretty=%H"]).splitlines()
    authors = run_cmd(["git", "log", f"--since={since_arg}", "--pretty=%an"]).splitlines()
    subjects = run_cmd(["git", "log", f"--since={since_arg}", "--pretty=%s"]).splitlines()
    numstat_lines = run_cmd(["git", "log", f"--since={since_arg}", "--numstat", "--pretty="]).splitlines()

    added = deleted = 0
    for line in numstat_lines:
        parts = line.split()
        if len(parts) < 2:
            continue
        if parts[0].isdigit() and parts[1].isdigit():
            added += int(parts[0])
            deleted += int(parts[1])

    pr_merges = 0
    for subject in subjects:
        if "merge pull request" in subject.lower() or "merge pr" in subject.lower() or "(#" in subject:
            pr_merges += 1

    return {
        "commit_count": len([c for c in commits if c]),
        "commits_by_author": Counter([a for a in authors if a]),
        "lines_added": added,
        "lines_deleted": deleted,
        "pr_merges": pr_merges,
    }


def count_lines(path: str) -> int:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            return sum(1 for _ in handle)
    except Exception:
        return 0


def priority_label(priority: str) -> str:
    mapping = {
        "0": "critical",
        "1": "high",
        "2": "medium",
        "3": "low",
        "4": "backlog",
    }
    return mapping.get(str(priority), str(priority))


def send_all_metrics(emitter: MetricEmitter, since: datetime, state: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    since_iso = since.isoformat()

    tmux_count = get_tmux_sessions()
    polecat_count = get_polecat_sessions()
    sessions_by_type = get_sessions_by_type()
    multiplexers = get_all_multiplexer_sessions()
    memory_stats = get_memory_stats()
    process_count = get_process_count()
    gt_status = get_gt_status()
    openclaw_jobs = get_openclaw_jobs()

    active_polecats = gt_status["active_polecats"] or polecat_count
    total_polecats = gt_status["total_polecats"] or active_polecats

    status_data = bd_status()
    summary = status_data.get("summary", {}) if isinstance(status_data, dict) else {}
    open_issues = int(summary.get("open_issues", 0) or 0)
    in_progress_issues = int(summary.get("in_progress_issues", 0) or 0)
    blocked_issues = int(summary.get("blocked_issues", 0) or 0)
    closed_issues = int(summary.get("closed_issues", 0) or 0)
    deferred_issues = int(summary.get("deferred_issues", 0) or 0)
    avg_lead_time_hours = float(summary.get("average_lead_time_hours", 0) or 0)

    created_since = bd_count(["--created-after", since_iso])
    closed_since = bd_count(["--closed-after", since_iso])
    updated_since = bd_count(["--updated-after", since_iso])
    blocked_since = bd_count(["--status", "blocked", "--updated-after", since_iso])

    created_by_priority = bd_group_counts(["--created-after", since_iso, "--by-priority"])
    created_by_type = bd_group_counts(["--created-after", since_iso, "--by-type"])
    created_by_assignee = bd_group_counts(["--created-after", since_iso, "--by-assignee"])
    in_progress_by_assignee = bd_group_counts(["--status", "in_progress", "--by-assignee"])
    closed_by_assignee = bd_group_counts(["--closed-after", since_iso, "--by-assignee"])

    acceptance_since = bd_count(["--status", "in_progress", "--updated-after", since_iso])

    merge_requests_open = bd_count(["--type", "merge-request", "--status", "open"])
    merge_requests_closed = bd_count(["--type", "merge-request", "--closed-after", since_iso])

    molecule_total = bd_count(["--type", "molecule"])
    molecule_closed = bd_count(["--type", "molecule", "--status", "closed"])
    molecule_started = bd_count(["--type", "molecule", "--created-after", since_iso])

    git_stats = get_git_stats(since)
    lines_added = git_stats["lines_added"]
    lines_deleted = git_stats["lines_deleted"]
    pr_merges = git_stats["pr_merges"]
    commits_by_author = git_stats["commits_by_author"]

    logs_combined = count_lines("logs/combined.log")
    logs_error = count_lines("logs/error.log") + count_lines("logs/exceptions.log") + count_lines("logs/rejections.log")

    env_tag = os.getenv("DD_ENV", "studio")
    host_tag = os.getenv("DD_HOST", socket.gethostname())
    common_tags = [f"env:{env_tag}", f"host:{host_tag}"]

    print("Sending Gas Town metrics...")
    print(f"  Gas Town Status: mayor={'●' if gt_status['mayor'] else '○'}, deacon={'●' if gt_status['deacon'] else '○'}, witness={'●' if gt_status['witness'] else '○'}, refinery={'●' if gt_status['refinery'] else '○'}")
    print(f"  Active Polecats: {active_polecats} / {total_polecats}")
    print(f"  Multiplexers: tmux={multiplexers['tmux']}, zellij={multiplexers['zellij']}, screen={multiplexers['screen']}")
    print(f"  Beads: open={open_issues}, in_progress={in_progress_issues}, blocked={blocked_issues}, closed={closed_issues}")
    print(f"  Lines changed: +{lines_added} / -{lines_deleted}")

    # Terminal multiplexers
    emitter.send("gastown.tmux.sessions_active", multiplexers["tmux"], "g", common_tags)
    emitter.send("gastown.zellij.sessions_active", multiplexers["zellij"], "g", common_tags)
    emitter.send("gastown.screen.sessions_active", multiplexers["screen"], "g", common_tags)
    emitter.send("gastown.multiplexers.total", sum(multiplexers.values()), "g", common_tags)

    # Core services
    emitter.send("gastown.mayor.running", 1 if gt_status["mayor"] else 0, "g", common_tags)
    emitter.send("gastown.deacon.running", 1 if gt_status["deacon"] else 0, "g", common_tags)
    emitter.send("gastown.witness.running", 1 if gt_status["witness"] else 0, "g", common_tags)
    emitter.send("gastown.refinery.running", 1 if gt_status["refinery"] else 0, "g", common_tags)

    # Town health
    core_services_up = sum([gt_status["mayor"], gt_status["deacon"], gt_status["witness"], gt_status["refinery"]])
    health_score = min(100, 50 + (core_services_up * 10) + (active_polecats * 2))
    emitter.send("gastown.town.health", health_score, "g", common_tags)

    # Polecats
    emitter.send("gastown.polecats.active", active_polecats, "g", common_tags)
    emitter.send("gastown.polecats.total", total_polecats, "g", common_tags)
    for rig_name, count in gt_status["active_by_type"].items():
        emitter.send("gastown.polecats.active", count, "g", common_tags + [f"rig_name:{rig_name}"])

    # Crew / agent state
    crew_active = gt_status["crew_active"] or len([v for v in in_progress_by_assignee.values() if v > 0])
    emitter.send("gastown.crew.active", crew_active, "g", common_tags)
    emitter.send("gastown.agent.stuck_count", blocked_issues, "g", common_tags)

    # System resources
    emitter.send("gastown.memory.used_pct", memory_stats["used_pct"], "g", common_tags)
    emitter.send("gastown.memory.total_gb", memory_stats["total_gb"], "g", common_tags)
    emitter.send("gastown.gpu.unified_memory_gb", memory_stats["gpu_used_gb"], "g", common_tags)
    emitter.send("system.processes.number", process_count, "g", common_tags)

    # Bead lifecycle (summary + unified metrics)
    lead_time_s = avg_lead_time_hours * 3600
    emitter.send("gastown.bead.lifecycle.duration_s", lead_time_s, "g", common_tags + ["rig:default"])
    emitter.send("gastown.bead.lifecycle.count", closed_since, "c", common_tags + ["outcome:success"])
    emitter.send("gastown.bead.lifecycle.count", blocked_since, "c", common_tags + ["outcome:failed"])
    emitter.send("gastown.bead.stage.created", created_since, "c", common_tags)
    emitter.send("gastown.bead.stage.hooked", created_since, "c", common_tags)
    emitter.send("gastown.bead.stage.assigned", acceptance_since, "c", common_tags)
    emitter.send("gastown.bead.stage.working", acceptance_since, "c", common_tags)
    emitter.send("gastown.bead.stage.completed", closed_since, "c", common_tags)

    # Hooks/assignments approximated by new work
    hook_total = created_since
    emitter.send("gastown.bead.hook.count", hook_total, "c", common_tags + ["agent:mayor"])
    if created_by_assignee:
        for assignee, count in created_by_assignee.items():
            emitter.send("gastown.bead.hook.count", count, "c", common_tags + [f"agent:{assignee}"])
    emitter.send("gastown.crew.assign.count", created_since, "c", common_tags + ["target:unassigned"])
    for assignee, count in created_by_assignee.items():
        emitter.send("gastown.crew.assign.count", count, "c", common_tags + [f"target:{assignee}"])

    # Unified ops metrics
    emitter.send("gastown.polecat.work.count", closed_since, "c", common_tags + ["polecat:all"])
    emitter.send("gastown.polecat.work.duration_ms", lead_time_s * 1000, "h", common_tags + ["polecat:all"])
    emitter.send("gastown.deacon.review.count", 1 if gt_status["deacon"] else 0, "c", common_tags + ["deacon:default"])
    emitter.send("gastown.deacon.review.duration_ms", 0, "h", common_tags + ["deacon:default"])
    emitter.send("gastown.nudge.sent.count", openclaw_jobs["nudges_from_cron"] + openclaw_jobs["nudges_from_poll"], "c", common_tags)
    emitter.send("gastown.nudge.response.count", 0, "c", common_tags)
    emitter.send("gastown.nudge.response_time_ms", 0, "h", common_tags)
    emitter.send("gastown.mayor.task.count", created_since, "c", common_tags + ["task_type:unknown"])

    # Polecat operations (old dashboard)
    emitter.send("gastown.polecats.spawned", created_since, "c", common_tags)
    emitter.send("gastown.polecats.completed", closed_since, "c", common_tags)
    emitter.send("gastown.polecats.failed", blocked_since, "c", common_tags)
    emitter.send("gastown.polecat.tokens_used", 0, "c", common_tags)
    emitter.send("gastown.polecat.prs_created", pr_merges, "c", common_tags)
    emitter.send("gastown.polecat.lines_added", lines_added, "c", common_tags)
    emitter.send("gastown.polecat.lines_deleted", lines_deleted, "c", common_tags)
    emitter.send("gastown.polecat.duration_s", lead_time_s, "g", common_tags)

    # Nudges & communication (old dashboard)
    nudges_total = openclaw_jobs["nudges_from_cron"] + openclaw_jobs["nudges_from_poll"]
    emitter.send("gastown.nudges.sent", nudges_total, "c", common_tags)
    emitter.send("gastown.nudges.responded", 0, "c", common_tags)
    emitter.send("gastown.nudge.duration_ms", 0, "h", common_tags)
    emitter.send("gastown.mail.sent.count", 0, "c", common_tags)
    emitter.send("gastown.mail.read.count", 0, "c", common_tags)

    # Mayor & crew
    for priority, count in created_by_priority.items():
        emitter.send("gastown.mayor.tasks_assigned", count, "c", common_tags + [f"priority:{priority_label(priority)}"])
    for task_type, count in created_by_type.items():
        emitter.send("gastown.mayor.tasks_assigned", count, "c", common_tags + [f"task_type:{task_type}"])

    for assignee, count in closed_by_assignee.items():
        emitter.send("gastown.crew.contributions", count, "c", common_tags + [f"crew_member:{assignee}"])

    emitter.send("gastown.task.assigned", created_since, "c", common_tags)
    emitter.send("gastown.task.accepted", acceptance_since, "c", common_tags)

    # Witness / Deacon / Refinery
    emitter.send("gastown.witness.lifecycle_events", 1 if gt_status["witness"] else 0, "c", common_tags + ["event_type:heartbeat"])
    emitter.send("gastown.deacon.health_checks", 1 if gt_status["deacon"] else 0, "c", common_tags + ["result:healthy" if gt_status["deacon"] else "result:unhealthy"])
    emitter.send("gastown.deacon.dogs_active", 1 if gt_status["deacon"] else 0, "g", common_tags)
    emitter.send("gastown.refinery.merges_queued", merge_requests_open, "g", common_tags)
    emitter.send("gastown.refinery.merges_processed", merge_requests_closed, "c", common_tags + ["outcome:merged"])
    emitter.send("gastown.refinery.integration_time_s", 0, "g", common_tags)

    # Beads & Kanban
    for priority, count in created_by_priority.items():
        emitter.send("gastown.beads.created", count, "c", common_tags + [f"priority:p{priority}"])
    emitter.send("gastown.beads.in_progress", in_progress_issues, "g", common_tags)
    emitter.send("gastown.beads.escalated", blocked_since, "c", common_tags + ["reason:blocked"])
    emitter.send("gastown.kanban.column_count", open_issues, "g", common_tags + ["column:todo"])
    emitter.send("gastown.kanban.column_count", in_progress_issues, "g", common_tags + ["column:in_progress"])
    emitter.send("gastown.kanban.column_count", closed_issues, "g", common_tags + ["column:done"])
    emitter.send("gastown.kanban.wip_limit_violations", 0, "c", common_tags)

    # Convoy & Molecules
    emitter.send("gastown.convoy.started", 0, "c", common_tags)
    emitter.send("gastown.convoy.completed", 0, "c", common_tags)
    emitter.send("gastown.convoy.priority_distribution", 0, "c", common_tags + ["priority:unknown"])
    emitter.send("gastown.convoy.blocked", blocked_issues, "g", common_tags)

    molecule_progress = (molecule_closed / molecule_total * 100) if molecule_total else 0
    emitter.send("gastown.molecule.progress_pct", molecule_progress, "g", common_tags + ["formula_template:default"])
    emitter.send("gastown.molecule.started", molecule_started, "c", common_tags)

    # Agent states
    idle_agents = max(0, total_polecats - active_polecats)
    emitter.send("gastown.agent.state", active_polecats, "g", common_tags + ["state:working"])
    emitter.send("gastown.agent.state", idle_agents, "g", common_tags + ["state:idle"])
    emitter.send("gastown.agent.state", blocked_issues, "g", common_tags + ["state:stuck"])
    emitter.send("gastown.agent.idle_duration_s", 0, "g", common_tags + ["agent_id:unknown"])
    emitter.send("gastown.rig.agents_count", active_polecats, "g", common_tags + ["rig_name:default"])

    # Claude / OpenAI / Ralph / Sequential Thinking (zero fill for dashboards)
    emitter.send("claude.api.request.count", 0, "c", common_tags)
    emitter.send("claude.api.request.duration_ms", 0, "h", common_tags)
    emitter.send("claude.api.tokens.input", 0, "c", common_tags)
    emitter.send("claude.api.tokens.output", 0, "c", common_tags)
    emitter.send("claude.api.tokens.cache_read", 0, "c", common_tags)
    emitter.send("claude.api.cost_usd", 0, "c", common_tags)
    emitter.send("claude.tool_use.count", 0, "c", common_tags)

    emitter.send("openai.api.request.count", 0, "c", common_tags)
    emitter.send("openai.api.request.duration_ms", 0, "h", common_tags)
    emitter.send("openai.api.tokens.input", 0, "c", common_tags)
    emitter.send("openai.api.tokens.output", 0, "c", common_tags)
    emitter.send("openai.embedding.count", 0, "c", common_tags)

    emitter.send("ralph.loop.iteration", 0, "c", common_tags + ["outcome:success"])
    emitter.send("ralph.loop.duration_ms", 0, "h", common_tags + ["outcome:success"])
    emitter.send("ralph.thinking.thought_count", 0, "g", common_tags + ["problem_id:unknown"])
    emitter.send("ralph.thinking.convergence_ms", 0, "h", common_tags)
    emitter.send("sequential_thinking.request.count", 0, "c", common_tags + ["model:unknown"])
    emitter.send("sequential_thinking.request.duration_ms", 0, "h", common_tags + ["model:unknown"])
    emitter.send("sequential_thinking.fallback.count", 0, "c", common_tags + ["reason:none"])

    # MCP metrics
    emitter.send("mcp.tool.calls", 0, "c", common_tags + ["tool:unknown", "status:success"])
    emitter.send("mcp.tool.duration", 0, "h", common_tags + ["tool:unknown", "status:success"])
    emitter.send("mcp.tool.errors", 0, "c", common_tags + ["tool:unknown", "status:error"])
    emitter.send("mcp.auth.attempts", 0, "c", common_tags + ["status:success"])
    emitter.send("mcp.auth.failures", 0, "c", common_tags)
    emitter.send("mcp.resource.access", 0, "c", common_tags + ["resource:unknown", "status:success"])

    # Logs
    emitter.send("logs.count", logs_combined, "c", common_tags + ["service:gastown"])
    emitter.send("logs.error", logs_error, "c", common_tags + ["service:gastown"])

    # Cost analysis (zero fill)
    emitter.send("ai_agent.cost.total_usd", 0, "c", common_tags)
    emitter.send("ai_agent.request.count", 0, "c", common_tags)
    emitter.send("ai_agent.tokens.total", 0, "c", common_tags + ["direction:input"])
    emitter.send("ai_agent.tokens.total", 0, "c", common_tags + ["direction:output"])

    # RUM / DEM (zero fill unless browser events are flowing)
    emitter.send("rum.performance.dom_complete", 0, "h", common_tags)
    emitter.send("rum.largest_contentful_paint", 0, "g", common_tags)
    emitter.send("rum.error.count", 0, "c", common_tags + ["error.source:unknown"])
    emitter.send("rum.session.count", 0, "c", common_tags)

    # GitHub activity
    for author, count in commits_by_author.items():
        emitter.send("github.commits", count, "c", common_tags + [f"author:{author}"])

    # Return state updates
    state_updates = {
        "last_run": now.isoformat(),
        "last_active_polecats": active_polecats,
    }
    return state_updates


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Gas Town metrics to Datadog")
    parser.add_argument("--batch", action="store_true", help="Send multiple batches for quick dashboard population")
    parser.add_argument("--since", default=None, help="Lookback window (e.g. 15m, 1h, 2d) instead of state")
    parser.add_argument("--dry-run", action="store_true", help="Print metrics without sending")
    parser.add_argument("--state-path", default=STATE_PATH, help="Override state file path")
    args = parser.parse_args()

    state = load_state(args.state_path)
    now = datetime.now(timezone.utc)

    if args.since:
        since = now - parse_duration(args.since)
    elif "last_run" in state:
        try:
            since = datetime.fromisoformat(state["last_run"])
            if since.tzinfo is None:
                since = since.replace(tzinfo=timezone.utc)
        except ValueError:
            since = now - timedelta(hours=1)
    else:
        since = now - timedelta(hours=1)

    emitter = MetricEmitter(dry_run=args.dry_run)

    batches = 3 if args.batch else 1
    for i in range(batches):
        updates = send_all_metrics(emitter, since, state)
        state.update(updates)
        if not args.dry_run:
            save_state(state, args.state_path)
        if i < batches - 1:
            time.sleep(2)

    print("\nMetrics sent! They should appear in the dashboard within 1-2 minutes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
