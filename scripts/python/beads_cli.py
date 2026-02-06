#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "beads-cli"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Beads CLI - create/update beads and emit Datadog telemetry.
"""

import argparse
import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List

from lib.vibecode_common import run_with_telemetry
from lib.datadog_logging import dd_info, dd_metric


STATUSES = ["created", "in_progress", "completed", "escalated", "failed"]

STAGE_METRICS = {
    "created": "gastown.beads.created",
    "in_progress": "gastown.beads.in_progress",
    "completed": "gastown.beads.completed",
    "escalated": "gastown.beads.escalated",
    "failed": "gastown.polecats.failed",
}


def _data_path() -> Path:
    return Path(os.environ.get("BEADS_DATA_PATH", "data/beads.json"))


@dataclass
class Bead:
    bead_id: str
    agent_id: str
    status: str
    created_at: float
    updated_at: float
    history: List[Dict[str, str]]


def _load_beads() -> List[Bead]:
    path = _data_path()
    if not path.exists():
        return []
    data = json.loads(path.read_text() or "[]")
    return [Bead(**item) for item in data]


def _save_beads(beads: List[Bead]) -> None:
    path = _data_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([asdict(b) for b in beads], indent=2))


def _emit_stage_metric(status: str, ai_agent: bool = False) -> None:
    metric = STAGE_METRICS.get(status)
    if not metric:
        return
    dd_metric(metric, 1, "count", "component:beads-cli")
    if ai_agent:
        dd_metric(f"ai_agent.{metric}", 1, "count", "component:beads-cli")


def _emit_flow_edge(prev_status: str, next_status: str, ai_agent: bool = False) -> None:
    from_tag = f"from:{prev_status}"
    to_tag = f"to:{next_status}"
    dd_metric("gastown.flow.edge", 1, "count", from_tag, to_tag, "component:beads-flow")
    if ai_agent:
        dd_metric("ai_agent.gastown.flow.edge", 1, "count", from_tag, to_tag, "component:beads-flow")


def create_bead(agent_id: str, ai_agent: bool = False) -> Bead:
    now = time.time()
    bead_id = f"bead-{agent_id}-{int(now)}"
    bead = Bead(
        bead_id=bead_id,
        agent_id=agent_id,
        status="created",
        created_at=now,
        updated_at=now,
        history=[{"from": "none", "to": "created", "at": str(int(now))}],
    )
    dd_info("Bead created", f"bead_id:{bead_id}", f"agent_id:{agent_id}")
    _emit_stage_metric("created", ai_agent=ai_agent)
    _emit_flow_edge("created", "in_progress", ai_agent=ai_agent)
    return bead


def transition_bead(bead: Bead, new_status: str, ai_agent: bool = False) -> Bead:
    if new_status not in STATUSES:
        raise ValueError(f"Invalid status: {new_status}")
    prev = bead.status
    if prev == new_status:
        return bead
    now = time.time()
    bead.status = new_status
    bead.updated_at = now
    bead.history.append({"from": prev, "to": new_status, "at": str(int(now))})
    dd_info("Bead transitioned", f"bead_id:{bead.bead_id}", f"from:{prev}", f"to:{new_status}")
    _emit_stage_metric(new_status, ai_agent=ai_agent)
    _emit_flow_edge(prev, new_status, ai_agent=ai_agent)
    return bead


def list_beads(beads: List[Bead]) -> None:
    for bead in beads:
        print(f"{bead.bead_id} {bead.agent_id} {bead.status} updated={int(bead.updated_at)}")


def show_bead(beads: List[Bead], bead_id: str) -> None:
    bead = next((b for b in beads if b.bead_id == bead_id), None)
    if not bead:
        raise ValueError(f"Bead not found: {bead_id}")
    print(json.dumps(asdict(bead), indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Beads CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create", help="Create a bead")
    p_create.add_argument("--agent", required=True)
    p_create.add_argument("--ai-agent", action="store_true")

    p_trans = sub.add_parser("transition", help="Transition a bead")
    p_trans.add_argument("--id", required=True)
    p_trans.add_argument("--to", required=True, choices=STATUSES)
    p_trans.add_argument("--ai-agent", action="store_true")

    p_list = sub.add_parser("list", help="List beads")
    p_show = sub.add_parser("show", help="Show bead")
    p_show.add_argument("--id", required=True)

    args = parser.parse_args()
    beads = _load_beads()

    if args.cmd == "create":
        bead = create_bead(args.agent, ai_agent=args.ai_agent)
        beads.append(bead)
        _save_beads(beads)
        print(bead.bead_id)
    elif args.cmd == "transition":
        bead = next((b for b in beads if b.bead_id == args.id), None)
        if not bead:
            raise ValueError(f"Bead not found: {args.id}")
        transition_bead(bead, args.to, ai_agent=args.ai_agent)
        _save_beads(beads)
        print(args.id)
    elif args.cmd == "list":
        list_beads(beads)
    elif args.cmd == "show":
        show_bead(beads, args.id)


if __name__ == "__main__":
    run_with_telemetry(main, "beads-cli", service_name="vibecode-beads")
