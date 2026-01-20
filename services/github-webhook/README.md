# GitHub Webhook Service

FastAPI service that bridges GitHub webhooks to Gas Town automation (bd/gt).

## Endpoints

- `POST /webhook/github` - GitHub webhook receiver
- `GET /health` - Health check
- `GET /metrics` - Prometheus-style counters

## Environment

- `GITHUB_WEBHOOK_SECRET` - Verify `X-Hub-Signature-256` (optional, recommended)
- `GASTOWN_WEBHOOK_TARGET` - Target for `gt sling` (default: `auto`)
- `GASTOWN_WEBHOOK_AGENT` - Agent/runtime override for `gt sling`
- `GASTOWN_WEBHOOK_CREATE` - When true, pass `--create` to `gt sling` (default: true)
- `GASTOWN_DEFAULT_PRIORITY` - Default priority (P0-P4 or 0-4)
- `GASTOWN_WORKFLOW_FAILURE_PRIORITY` - Priority for workflow failure beads (default: P1)
- `GASTOWN_HEALER_TARGET` - Target for workflow failure beads (optional)
- `GASTOWN_HEALER_AGENT` - Agent override for workflow failure beads (optional)
- `GASTOWN_WEBHOOK_CMD_TIMEOUT` - Seconds to wait for bd/gt commands (default: 15)
- `DD_SERVICE` - Datadog service name (default: `gastown-webhook`)

## Local Run

```bash
cd services/github-webhook
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Optional Datadog tracing:

```bash
ddtrace-run uvicorn main:app --host 0.0.0.0 --port 8000
```

## Events

- `issues.opened` -> create bead and sling
- `issues.labeled` -> update bead priority
- `pull_request.closed` (merged) -> close bead
- `workflow_run.completed` (failure) -> create fix bead and sling
- `workflow_run.completed` (success) -> metrics only
