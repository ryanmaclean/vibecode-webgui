#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "emit-role-metrics"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "monitoring"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


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

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass

import time
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from lib.datadog_logging import dd_metric, dd_info

metrics = {
    "gastown.reaper.tasks_completed": 3,
    "gastown.mayor.task.count": 7,
    "gastown.deacon.health_checks": 9,
    "gastown.deacon.dogs_active": 2,
    "gastown.witness.lifecycle_events": 5,
    "gastown.overseer.alerts": 1,
    "gastown.crew.assign.count": 6,
    "gastown.crew.active": 3,
    "gastown.polecats.spawned": 4,
    "gastown.polecats.completed": 3,
    "gastown.polecats.failed": 1,
    "gastown.mail.sent": 6,
    "gastown.mail.read": 5,
    "gastown.nudges.sent": 4,
    "gastown.nudges.responded": 2,
    "gastown.failures.count": 1,
    "gastown.handoff.count": 3,
    "gastown.tmux.sessions_active": 2,
    "gastown.convoy.started": 2,
    "gastown.convoy.completed": 1,
    "gastown.refinery.merges_processed": 2,
    "gastown.polecat.prs_created": 1,
    "github.issues.open": 1,
    "trace.main.merge_branch.hits": 1,
    "trace.main.merge_branch": 1,
}

rig = os.environ.get("GASTOWN_RIG", "default")

stage_counts = {
    "created": ("mayor", 5),
    "in_progress": ("polecat", 3),
    "completed": ("reaper", 4),
    "escalated": ("deacon", 1),
    "failed": ("overseer", 1),
}

dd_info("Emitting role metrics", "component:emit-role-metrics")
for m, v in metrics.items():
    dd_metric(m, v, "gauge", f"rig:{rig}", "component:emit-role-metrics")
    time.sleep(0.05)
    role = m.split(".")[1] if m.startswith("gastown.") else "external"
    action = m.replace("gastown.", "").replace(".", "_")
    dd_info("role_activity", f"role:{role}", f"action:{action}", "source:emit-role-metrics", "component:emit-role-metrics")

for stage, (role, value) in stage_counts.items():
    dd_metric(
        "gastown.beads.stage",
        value,
        "gauge",
        f"stage:{stage}",
        f"role:{role}",
        f"rig:{rig}",
        "component:emit-role-metrics",
    )
    dd_info(
        "bead_provenance",
        f"stage:{stage}",
        f"role:{role}",
        "source:emit-role-metrics",
        "component:emit-role-metrics",
    )
print("ok")