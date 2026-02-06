#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "emit-openlineage-beads"
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

import json
import os
import sys
import uuid
import time
import datetime
import urllib.request


def iso_now():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def post_event(event, api_key, site):
    host = f"data-obs-intake.{site}"
    url = f"https://{host}/api/v1/lineage"
    data = json.dumps(event).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status


def main():
    api_key = os.environ.get("DD_API_KEY")
    site = os.environ.get("DD_SITE", "datadoghq.com")
    if not api_key:
        print("DD_API_KEY is required", file=sys.stderr)
        return 1

    rig = os.environ.get("GASTOWN_RIG", "default")
    host = os.environ.get("HOSTNAME", os.uname().nodename)
    bead_id = os.environ.get("BEAD_ID", f"bead-{uuid.uuid4()}")
    stage = os.environ.get("STAGE", "in_progress")

    run_id = str(uuid.uuid4())
    job_namespace = f"gastown/{rig}/{host}"
    job_name = f"bead:{bead_id}:{stage}"

    inputs = [{"namespace": "gastown", "name": "beads"}]
    outputs = [{"namespace": "gastown", "name": f"beads_{stage}"}]

    start_event = {
        "eventTime": iso_now(),
        "eventType": "START",
        "run": {"runId": run_id},
        "job": {"namespace": job_namespace, "name": job_name},
        "producer": "gastown-openlineage-emitter",
        "inputs": inputs,
        "outputs": outputs,
    }

    complete_event = {
        "eventTime": iso_now(),
        "eventType": "COMPLETE",
        "run": {"runId": run_id},
        "job": {"namespace": job_namespace, "name": job_name},
        "producer": "gastown-openlineage-emitter",
        "inputs": inputs,
        "outputs": outputs,
    }

    status = post_event(start_event, api_key, site)
    if status < 200 or status >= 300:
        print(f"Start event failed: {status}", file=sys.stderr)
        return 1

    time.sleep(1)
    status = post_event(complete_event, api_key, site)
    if status < 200 or status >= 300:
        print(f"Complete event failed: {status}", file=sys.stderr)
        return 1

    print(f"OpenLineage events sent for {job_name} in {job_namespace}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())