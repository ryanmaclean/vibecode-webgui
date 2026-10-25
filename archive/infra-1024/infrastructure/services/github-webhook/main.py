#!/usr/bin/env python3


"""GitHub Webhook Service for Gas Town.

Receives GitHub webhooks and routes actions into bd/gt.
"""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import hashlib
import hmac
import json
import logging
import os
import re
import subprocess
import time
from collections import Counter
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse

try:
    from ddtrace import patch_all, tracer

    patch_all()
except Exception:  # pragma: no cover - ddtrace should be present in service env
    tracer = None

APP_VERSION = "0.1.0"
SERVICE_NAME = os.getenv("DD_SERVICE", "gastown-webhook")
DEFAULT_PRIORITY = os.getenv("GASTOWN_DEFAULT_PRIORITY", "P2")
DEFAULT_TARGET = os.getenv("GASTOWN_WEBHOOK_TARGET", "auto")
DEFAULT_AGENT = os.getenv("GASTOWN_WEBHOOK_AGENT", "")
CREATE_TARGETS = os.getenv("GASTOWN_WEBHOOK_CREATE", "true").lower() in {"1", "true", "yes"}
HEALER_TARGET = os.getenv("GASTOWN_HEALER_TARGET", "")
HEALER_AGENT = os.getenv("GASTOWN_HEALER_AGENT", "")
COMMAND_TIMEOUT = float(os.getenv("GASTOWN_WEBHOOK_CMD_TIMEOUT", "15"))
WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
SYNC_REPOS = os.getenv("GASTOWN_WEBHOOK_SYNC_REPOS", "false").lower() in {"1", "true", "yes"}
SYNC_REPOS_INTERVAL = float(os.getenv("GASTOWN_WEBHOOK_SYNC_INTERVAL", "60"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("gastown.webhook")

app = FastAPI(title="GitHub Webhook Service", version=APP_VERSION)

start_time = time.time()
metrics = Counter()
metrics_by_event = Counter()
metrics_by_action = Counter()
last_repo_sync = 0.0


def _trace_context_tags() -> Dict[str, Any]:
    if tracer is None:
        return {}
    span = tracer.current_span()
    if not span:
        return {}
    return {
        "dd.trace_id": span.trace_id,
        "dd.span_id": span.span_id,
    }


def log_info(message: str, **fields: Any) -> None:
    context = _trace_context_tags()
    logger.info(message, extra={**context, **fields})


def log_warning(message: str, **fields: Any) -> None:
    context = _trace_context_tags()
    logger.warning(message, extra={**context, **fields})


def log_error(message: str, **fields: Any) -> None:
    context = _trace_context_tags()
    logger.error(message, extra={**context, **fields})


def verify_signature(body: bytes, signature: Optional[str]) -> bool:
    if not WEBHOOK_SECRET:
        return True
    if not signature:
        return False
    expected = "sha256=" + hmac.new(WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def normalize_priority(priority: str) -> str:
    value = priority.strip().upper()
    if value.startswith("P") and value[1:].isdigit():
        return value
    if value.isdigit():
        return f"P{value}"
    return DEFAULT_PRIORITY


def extract_priority(labels: Iterable[Dict[str, Any]]) -> str:
    label_names = [label.get("name", "").strip() for label in labels]
    lowered = [name.lower() for name in label_names]

    for name in lowered:
        match = re.search(r"\bp([0-4])\b", name)
        if match:
            return f"P{match.group(1)}"

    if any(token in lowered for token in ["priority:high", "priority:urgent", "critical", "sev0", "sev-0"]):
        return "P0"
    if any(token in lowered for token in ["priority:medium", "sev1", "sev-1"]):
        return "P1"
    if any(token in lowered for token in ["priority:low", "sev2", "sev-2"]):
        return "P2"

    return normalize_priority(DEFAULT_PRIORITY)


def select_target_and_agent(labels: Iterable[Dict[str, Any]]) -> Tuple[str, str]:
    target = DEFAULT_TARGET
    agent = DEFAULT_AGENT

    for label in labels:
        name = label.get("name", "").strip()
        lower = name.lower()
        if lower.startswith("rig:") or lower.startswith("target:"):
            target = name.split(":", 1)[1].strip()
        if lower.startswith("agent:"):
            agent = name.split(":", 1)[1].strip()

    return target, agent


def run_command(command: List[str], *, capture_output: bool = False) -> subprocess.CompletedProcess:
    log_info("Running command", command=" ".join(command))
    return subprocess.run(
        command,
        check=True,
        capture_output=capture_output,
        text=True,
        timeout=COMMAND_TIMEOUT,
    )


def maybe_sync_repos() -> None:
    global last_repo_sync
    if not SYNC_REPOS:
        return

    now = time.time()
    if now - last_repo_sync < SYNC_REPOS_INTERVAL:
        return

    try:
        run_command(["bd", "repo", "sync"])
        last_repo_sync = now
        metrics["repo_sync_total"] += 1
    except Exception as exc:
        log_warning("Failed to sync repos", error=str(exc))
        metrics["repo_sync_errors_total"] += 1


def create_bead(title: str, description: str, priority: str, external_ref: str) -> Optional[str]:
    command = [
        "bd",
        "create",
        title,
        "--priority",
        normalize_priority(priority),
        "--external-ref",
        external_ref,
        "--description",
        description,
        "--silent",
    ]
    try:
        result = run_command(command, capture_output=True)
    except Exception as exc:
        log_error("Failed to create bead", error=str(exc), external_ref=external_ref)
        metrics["bead_create_errors_total"] += 1
        return None

    bead_id = (result.stdout or "").strip()
    if not bead_id:
        log_warning("Bead creation returned empty ID", external_ref=external_ref)
        return None

    metrics["beads_created_total"] += 1
    return bead_id


def list_beads() -> List[Dict[str, Any]]:
    result = run_command(["bd", "list", "--json", "--all", "--limit", "0"], capture_output=True)
    return json.loads(result.stdout or "[]")


def find_bead_by_external_ref(external_ref: str) -> Optional[str]:
    try:
        beads = list_beads()
    except Exception as exc:
        log_error("Failed to list beads", error=str(exc))
        return None

    for bead in beads:
        if bead.get("external_ref") == external_ref:
            return bead.get("id")
    return None


def update_bead_priority(bead_id: str, priority: str) -> None:
    try:
        run_command(["bd", "update", bead_id, "--priority", normalize_priority(priority)])
    except Exception as exc:
        log_error("Failed to update bead priority", bead_id=bead_id, error=str(exc))
        metrics["bead_update_errors_total"] += 1
        return

    metrics["beads_updated_total"] += 1


def close_bead(bead_id: str, reason: str) -> None:
    try:
        run_command(["bd", "close", bead_id, "--reason", reason])
    except Exception as exc:
        log_error("Failed to close bead", bead_id=bead_id, error=str(exc))
        metrics["bead_close_errors_total"] += 1
        return

    metrics["beads_closed_total"] += 1


def sling_bead(bead_id: str, target: str, agent: str) -> None:
    command = ["gt", "sling", bead_id, target]
    if agent:
        command.extend(["--agent", agent])
    if CREATE_TARGETS:
        command.append("--create")

    try:
        run_command(command)
    except Exception as exc:
        log_error("Failed to sling bead", bead_id=bead_id, error=str(exc))
        metrics["bead_sling_errors_total"] += 1
        return

    metrics["beads_slung_total"] += 1


def format_issue_description(payload: Dict[str, Any]) -> str:
    issue = payload.get("issue", {})
    repo = payload.get("repository", {})
    labels = ", ".join(label.get("name", "") for label in issue.get("labels", []))

    body = (issue.get("body") or "").strip()
    if body:
        body = body[:500]

    return "\n".join(
        line
        for line in [
            f"GitHub: {repo.get('full_name', 'unknown')}",
            f"Issue: #{issue.get('number', 'unknown')} {issue.get('html_url', '')}",
            f"Labels: {labels or 'none'}",
            "",
            body or "(no description)",
        ]
        if line is not None
    )


def format_workflow_description(payload: Dict[str, Any]) -> str:
    run = payload.get("workflow_run", {})
    repo = payload.get("repository", {})

    return "\n".join(
        line
        for line in [
            f"GitHub: {repo.get('full_name', 'unknown')}",
            f"Workflow: {run.get('name', 'unknown')}",
            f"Run ID: {run.get('id', 'unknown')}",
            f"Conclusion: {run.get('conclusion', 'unknown')}",
            f"URL: {run.get('html_url', '')}",
        ]
        if line is not None
    )


def extract_issue_refs(text: str) -> List[int]:
    refs = []
    for match in re.findall(r"#(\d+)", text or ""):
        try:
            refs.append(int(match))
        except ValueError:
            continue
    return refs


@app.get("/health")
async def health() -> JSONResponse:
    uptime = time.time() - start_time
    status = {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": APP_VERSION,
        "uptime_seconds": round(uptime, 3),
    }
    return JSONResponse(status)


@app.get("/metrics")
async def prometheus_metrics() -> PlainTextResponse:
    lines = [
        "# HELP gastown_webhook_events_total Total webhook events processed",
        "# TYPE gastown_webhook_events_total counter",
        f"gastown_webhook_events_total {metrics['events_total']}",
        "# HELP gastown_webhook_beads_created_total Beads created from webhook events",
        "# TYPE gastown_webhook_beads_created_total counter",
        f"gastown_webhook_beads_created_total {metrics['beads_created_total']}",
        "# HELP gastown_webhook_beads_slung_total Beads routed to agents",
        "# TYPE gastown_webhook_beads_slung_total counter",
        f"gastown_webhook_beads_slung_total {metrics['beads_slung_total']}",
        "# HELP gastown_webhook_beads_updated_total Beads updated from labels",
        "# TYPE gastown_webhook_beads_updated_total counter",
        f"gastown_webhook_beads_updated_total {metrics['beads_updated_total']}",
        "# HELP gastown_webhook_beads_closed_total Beads closed from PR merges",
        "# TYPE gastown_webhook_beads_closed_total counter",
        f"gastown_webhook_beads_closed_total {metrics['beads_closed_total']}",
        "# HELP gastown_webhook_signature_failures_total Invalid webhook signatures",
        "# TYPE gastown_webhook_signature_failures_total counter",
        f"gastown_webhook_signature_failures_total {metrics['signature_failures_total']}",
        "# HELP gastown_webhook_command_errors_total Failures running bd/gt commands",
        "# TYPE gastown_webhook_command_errors_total counter",
        f"gastown_webhook_command_errors_total {metrics['bead_create_errors_total'] + metrics['bead_update_errors_total'] + metrics['bead_close_errors_total'] + metrics['bead_sling_errors_total']}",
        "# HELP gastown_webhook_repo_sync_total Repo syncs triggered for cross-rig hydration",
        "# TYPE gastown_webhook_repo_sync_total counter",
        f"gastown_webhook_repo_sync_total {metrics['repo_sync_total']}",
        "# HELP gastown_webhook_repo_sync_errors_total Repo sync failures",
        "# TYPE gastown_webhook_repo_sync_errors_total counter",
        f"gastown_webhook_repo_sync_errors_total {metrics['repo_sync_errors_total']}",
        "# HELP gastown_webhook_events_by_type_total Webhook events by type",
        "# TYPE gastown_webhook_events_by_type_total counter",
        "# HELP gastown_webhook_events_by_action_total Webhook events by action",
        "# TYPE gastown_webhook_events_by_action_total counter",
    ]

    for event, count in metrics_by_event.items():
        lines.append(
            f"gastown_webhook_events_by_type_total{{event=\"{event}\"}} {count}"
        )

    for action, count in metrics_by_action.items():
        lines.append(
            f"gastown_webhook_events_by_action_total{{action=\"{action}\"}} {count}"
        )

    return PlainTextResponse("\n".join(lines) + "\n")


@app.post("/webhook/github")
async def handle_webhook(request: Request) -> JSONResponse:
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    if not verify_signature(body, signature):
        metrics["signature_failures_total"] += 1
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = request.headers.get("X-GitHub-Event", "")
    try:
        payload = json.loads(body.decode("utf-8")) if body else {}
    except json.JSONDecodeError as exc:
        log_warning("Invalid JSON payload", error=str(exc))
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    action = payload.get("action", "")

    metrics["events_total"] += 1
    if event:
        metrics_by_event[event] += 1
    if action:
        metrics_by_action[action] += 1

    maybe_sync_repos()

    if tracer is not None:
        with tracer.trace("github.webhook", service=SERVICE_NAME) as span:
            span.set_tag("event", event)
            span.set_tag("action", action)
            await dispatch_event(event, action, payload)
    else:
        await dispatch_event(event, action, payload)

    return JSONResponse({"status": "ok"})


async def dispatch_event(event: str, action: str, payload: Dict[str, Any]) -> None:
    if event == "issues":
        await handle_issue_event(action, payload)
        return
    if event == "pull_request":
        await handle_pull_request(action, payload)
        return
    if event == "workflow_run":
        await handle_workflow_run(action, payload)
        return

    log_info("Unhandled event", event=event, action=action)


async def handle_issue_event(action: str, payload: Dict[str, Any]) -> None:
    issue = payload.get("issue", {})
    number = issue.get("number")
    labels = issue.get("labels", [])
    external_ref = f"gh-issue:{number}"

    if action == "opened":
        priority = extract_priority(labels)
        title = f"[{priority}] {issue.get('title', 'Untitled')}"
        description = format_issue_description(payload)
        bead_id = create_bead(title, description, priority, external_ref)
        if bead_id:
            target, agent = select_target_and_agent(labels)
            sling_bead(bead_id, target, agent)
        return

    if action == "labeled":
        priority = extract_priority(labels)
        bead_id = find_bead_by_external_ref(external_ref)
        if bead_id:
            update_bead_priority(bead_id, priority)
        else:
            log_warning("No bead found for labeled issue", external_ref=external_ref)
        return

    log_info("Unhandled issue action", action=action, external_ref=external_ref)


async def handle_pull_request(action: str, payload: Dict[str, Any]) -> None:
    if action != "closed":
        return

    pull_request = payload.get("pull_request", {})
    if not pull_request.get("merged"):
        return

    pr_number = pull_request.get("number")
    external_refs = [f"gh-pr:{pr_number}"]
    body = pull_request.get("body", "")
    title = pull_request.get("title", "")
    for issue_number in extract_issue_refs(body + " " + title):
        external_refs.append(f"gh-issue:{issue_number}")

    bead_id = None
    for ref in external_refs:
        bead_id = find_bead_by_external_ref(ref)
        if bead_id:
            break

    if bead_id:
        close_bead(bead_id, reason="Merged PR")
    else:
        log_warning("No bead found for merged PR", external_refs=external_refs)


async def handle_workflow_run(action: str, payload: Dict[str, Any]) -> None:
    if action != "completed":
        return

    run = payload.get("workflow_run", {})
    conclusion = run.get("conclusion")
    if conclusion == "success":
        metrics["workflow_success_total"] += 1
        return

    if conclusion != "failure":
        return

    metrics["workflow_failure_total"] += 1
    run_id = run.get("id")
    external_ref = f"gh-run:{run_id}"
    priority = normalize_priority(os.getenv("GASTOWN_WORKFLOW_FAILURE_PRIORITY", "P1"))
    title = f"[{priority}] CI failure: {run.get('name', 'workflow')}"
    description = format_workflow_description(payload)

    bead_id = create_bead(title, description, priority, external_ref)
    if bead_id:
        target = HEALER_TARGET or DEFAULT_TARGET
        agent = HEALER_AGENT or DEFAULT_AGENT
        sling_bead(bead_id, target, agent)


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, log_level="info")