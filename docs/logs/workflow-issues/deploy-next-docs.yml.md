# Workflow Summary — deploy-next-docs.yml

_Last updated: 2025-10-01_

## Purpose
Automates deployment of the Next.js documentation experience (pulled from `src/` + `content/wiki/`) to the Azure Web App that powers docs.vibecode.dev. The workflow builds a standalone bundle, ships an OCI image via Azure Container Registry, and restarts the target App Service.

## Triggers
- Pushes to `main` that touch wiki content, the workflow file, or shared Next.js manifests
- Nightly cron (`0 6 * * *`) for heartbeat deploys
- Manual dispatch with environment and optional image tag overrides

## Key Jobs
1. **build-artifact** — runs `next build`, packages `next-standalone/` (includes `.next/static`, `public/`, and `content/wiki/`), uploads the tarball artifact.
2. **deploy** — downloads the artifact, builds `docker/Dockerfile.docs-next`, pushes to ACR, updates the Azure App Service container, and runs an `/api/readyz` smoke test (configurable via `DOCS_NEXT_HEALTHCHECK_URL`). Missing secrets now fail the job up front, and the smoke step retries five times with a growing delay before marking the run red.

## Required Secrets (per GitHub environment)
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `ACR_NAME`, `AZURE_RESOURCE_GROUP`, `AZURE_WEBAPP_NAME`
- Optional: `DOCS_NEXT_HEALTHCHECK_URL`

## Outputs & Observability
- Publishes the deployed image reference and resolved App Service URL to the workflow summary.
- Curl-based smoke test retries five times (15s, 30s, 45s, 60s, 75s) before failing the job if the health endpoint stays unavailable.
- Stream deployment logs via `az webapp log tail --name vibecode-docs-next --resource-group rg-vibecode-docs`; the downloaded bundle places container output in `LogFiles/Application/docker.log`.
- Datadog dashboard (folder `Observability/Docs`) will track `azure.app_service.http.5xx`, `trace.next.render`, and container CPU for this service; request the slug from Observability if it is not yet shared.
- Subscribe to the `docs-next smoke check` and `docs-next 5xx error rate` monitors so alerts land in `#docs-infra-alerts`; file an Observability ticket referencing #405 if those monitors are still pending.

## Follow-up Checks
- Confirm Datadog logs/traces show the new deployment within 5 minutes.
- Run `npm run docs:link-audit` locally if wiki content changed substantially.

## Escalation
- Collect the failing run URL, the App Service log bundle, and a Datadog snapshot before paging the Docs Infra Guild (`#docs-infra-alerts`).
- Loop in Observability on-call (`#observability-oncall`) when monitors remain red after the smoke test retries.

> TODO (#405): Add explicit retention/rollback guidance once Observability finalises log, artifact, and image expiry windows for docs-next.
