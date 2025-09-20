---
title: TODO
description: Multi-agent coordination log (regenerated 2025-09-19)
---

## Coordination Snapshot (2025-09-19 17:50 UTC)

### 2025-09-20 22:30 UTC — PaaS Pivot (App Service + Flexible Postgres)
**Directive**: Drop AKS recovery efforts and re-platform on lower-cost Azure services: App Service for the Next.js app, Azure Database for PostgreSQL Flexible Server (pgvector enabled), Azure OpenAI, and a queue-driven PDF ingestion workflow.

**Current state**
- No Kubernetes resources remain; the previous AKS environment is permanently deleted.
- Remote OpenTofu backend scaffolding is ready (resource group `rg-vibecode-tofu-state`, storage account `vibecodetfstate01`, container `opentofu-state`).
- Application still relies on RAG chunks in Postgres; existing scripts can be reused once a new database is provisioned.

**Immediate focus**
1. Author a lean architecture doc describing the App Service + Flexible Postgres + Azure OpenAI design, including cost estimates and network considerations.
2. Produce new infrastructure-as-code scaffolding (OpenTofu with remote backend) to deploy:
   - App Service Plan (Linux, B1) + Web App for SSR Next.js
   - Azure Storage (blob + queue) for PDF uploads and work dispatch
   - Azure PostgreSQL Flexible Server (Basic B1ms) with `pgvector`
   - Consumption Azure Function (queue trigger) for PDF chunking & embedding
   - Application Insights + Key Vault for secrets
3. Update the application workflow so file uploads land in Blob Storage, enqueue a work item, and the Function processes the file with Azure OpenAI embeddings, persisting chunks to Postgres.

### Priority Ranking (2025-09-20 22:30 UTC)
1. **Document & approve PaaS architecture** — draft completed (`docs/src/content/docs/azure-appservice-migration.md`); circulate for sign-off and capture feedback before marking approved.
2. **Bootstrap new OpenTofu project** — add `backend.tf` pointing at `vibecodetfstate01/opentofu-state`, scaffold modules for App Service, Storage, PostgreSQL Flexible Server, Azure OpenAI, and Azure Functions (queue worker). Run `tofu init` to confirm remote backend works (state will start empty).
3. **Implement queue-based PDF ingestion** — update Next.js API routes to push uploads to Blob + Queue, add `queue-worker` Function project (TypeScript) that reads queue messages, chunks PDFs, calls Azure OpenAI embeddings, and stores results in Postgres.
4. **Reconfigure runtime secrets** — move configuration to Azure App Configuration/Key Vault or App Service settings (DATABASE_URL, AZURE_OPENAI_ENDPOINT, STORAGE_QUEUE_NAME, etc.) and document `.env` parity.
5. **Decommission AKS artifacts** — archive or delete AKS-specific scripts/manifests once migration is proven, updating README/production docs to reference App Service deployment.

### RAG & Demo Readiness (2025-09-20 19:12 UTC)
- [ ] **Agent #3 — Vector Data Seeding**: After Postgres is reachable, run `scripts/populate-vector-db-samples.ts` (or `scripts/generate-vector-activity.sh` inside the cluster) to repopulate `document_embeddings` and `rag_chunks`; validate with `scripts/verify-rag-functionality.ts` and record row counts in `POSTGRES_MONITORING_VALIDATION_RESULTS.md`.
- [x] **Agent #4 — Demo Prompt Library**: Curate lovable.ai-style prompts (`src/data/demo-prompts.ts`) and surface them in the chat UI selector so Lovable demo flows are one click away. Next step: capture API telemetry once RAG search is reconnected.
- [ ] **Agent #6 — LLM Observability Enablement**: Set `DD_LLMOBS_ENABLED=1` + `DD_LLMOBS_AGENTLESS_ENABLED=1`, ensure `DD_API_KEY`/`DD_SITE` are exported, and verify spans from `src/lib/datadog-llm.ts` hit Datadog; document dashboard linkage in `docs/azure/azure-rag-datadog-runbook.md`.
- [ ] **Agent #7 — Datadog Dashboard Refresh**: Re-run Terraform plans in `tofu/datadog-*` (or `scripts/configure-datadog-appservice.sh` as needed) to import both DBM + LLM dashboards, then capture screenshots for the demo packet.

### Immediate Priority Handoff (2025-09-20 22:30 UTC)
1. **Agent #1 — Infra Bootstrap**: Generate `tofu/backend.tf` targeting `vibecodetfstate01/opentofu-state`, add minimal modules for App Service Plan, Web App, Storage (blob + queue), Postgres Flexible Server, Azure OpenAI, and a Function App. Run `tofu init` (expect empty state) and capture the plan stub.
2. **Agent #2 — App Service Deployment Flow**: Prototype GitHub Actions workflow (or manual script) to build the Next.js app and deploy via `az webapp up`/zip deploy. Document required App Service settings (NODE_VERSION=20, WEBSITE_RUN_FROM_PACKAGE=1, etc.).
3. **Agent #3 — Queue Worker**: Scaffold Azure Functions project (`queue-worker/`) in TypeScript with Storage Queue trigger. Wire in PDF chunking (e.g., `pdf-parse`), Azure OpenAI embeddings, and Postgres insert logic.
4. **Agent #4 — File Upload API**: Update Next.js API route(s) to stream uploads to Blob Storage, emit queue messages (`azure-storage-queue` client), and respond with job status ids. Add guards/tests.

### AKS Redeploy Checklist (Agent #1 / #2)
- [ ] While OpenTofu recovery is in progress, we've created scripts for direct AKS deployment:
  - `scripts/create-aks-cluster.sh`: Creates a new AKS cluster once old cluster deletion is complete
  - `scripts/deploy-ingress-controller.sh`: Deploys NGINX Ingress Controller with our public IP
  - `scripts/deploy-vibecode.sh`: Master script to deploy the full VibeCode stack
- [ ] After deployment, use `az aks get-credentials --admin` and `kubectl get ns` to verify API availability.
- [ ] Trigger `scripts/app_deploy.py` with `--fullname-override vibecode-app --wait` and record rollout status.

### DNS & External Access Follow-up
- [ ] Run `scripts/create-aks-cluster.sh` once Azure quotas are raised so the new cluster can attach to `rg-vibecode-dns` resources.
- [ ] Use `scripts/deploy-ingress-controller.sh` (or `scripts/deploy-vibecode.sh`) to deploy NGINX Ingress with the existing `vibecode` public IP.
- [ ] Deploy the application (`scripts/app_deploy.py` or `scripts/deploy-vibecode.sh`) and wait for rollout completion.
- [ ] Confirm Let's Encrypt issues a fresh certificate for `vibecode.eastus2.cloudapp.azure.com`.
- [ ] Smoke-test the domain (`curl`/browser) to verify 200 responses over HTTPS.

### Documentation Updates
- [ ] Replace lingering `http://20.36.249.127` references (README/PRODUCTION_STATUS/etc.) with `https://vibecode.eastus2.cloudapp.azure.com` once DNS cutover is confirmed.

**2025-09-20 19:22 UTC Update**: Patched `tofu/k8s-vibecode-app.tf` network policy so kube-dns access uses explicit namespace/pod selectors (`kube-system`/`k8s-app=kube-dns` with TCP+UDP 53), PostgreSQL egress matches both `app=postgres` and `app=postgres-simple`, Datadog traffic targets the `datadog` namespace, and ingress is limited to the managed `ingress-nginx` controller namespace.

#### 🔧 **Helm Resource Cleanup** (Medium Priority)
- [ ] **ServiceAccount Conflict**: Resolve pre-existing `vibecode-app` ServiceAccount in `vibecode-platform`
- [ ] **Helm Ownership**: Add Helm ownership labels or delete conflicting resources
- [ ] **Dry-run Success**: Enable `helm upgrade --install vibecode-webgui ... --dry-run` to complete

#### 📊 **Datadog Dashboard Cleanup** (Medium Priority)
- [ ] **API Keys Missing**: Dashboard deployment blocked - DD_API_KEY and DD_APP_KEY not configured in .env.local
- [ ] **DBM Validation**: Align Datadog Postgres integration (Agent 4 → Agent 5)
  - [ ] Re-run verifier once Postgres is stable (avoid immediate restarts) and confirm Datadog UI shows healthy Postgres check + DBM metrics (handoff → Agent 5)
    - ⏳ Postgres pods are restarting during the scripted rollout; wait ~2-3 minutes after the deployment settles (`kubectl -n vibecode-platform get pods -l app=postgres`) before invoking the verifier again to avoid vector activity timeouts.
    - ⏳ Latest run (11:37 UTC) timed out because the script-triggered rollout recreated the workload as `postgres-simple-779ff995b4-*`; update the detector to handle the new label (`app=postgres-simple`) or skip the redundant restart before attempting again (Agent 4 follow-up).
  - [ ] Capture evidence (screenshot/log snippet) and update `POSTGRES_MONITORING_VALIDATION_RESULTS.md` once metrics flow (handoff → Agent 5)
- [ ] **Custom Metrics**: Verify postgresql.pgvector.* metrics collection

#### 🐳 **Docker Build Cleanup** (Low Priority)
- [ ] **ACR Push**: Push real image to Azure Container Registry

**Technical Details**:
- External IP: `72.153.39.233`
- Ingress Controller: Running and configured
- Application: Responding with HTTP 200 on port 3000
- Service: Fixed selector to match pod labels
- SSL: TLS termination configured

### Agent #2 — Application / Middleware Safety
- [ ] Wire middleware throttling to shared Redis/Valkey store when available (`MIDDLEWARE_RATE_LIMIT_ENABLED`, `MIDDLEWARE_RATE_LIMIT_MAX`, `MIDDLEWARE_RATE_LIMIT_WINDOW_MS`)

### Deployment Hand-off
- [ ] Execute `scripts/app_deploy.py --acr-name vibecodecr84859296 --image-tag latest --skip-build --fullname-override vibecode-app --wait` once dry-run succeeds
- [ ] Smoke-test ingress endpoints after rollout; confirm latest image digest `sha256:9e81d7736fefce94845c241781a25097a4383ecc9591f63c39d46e319b1fa0cf`

### Observability Follow-ups
- [ ] Update Datadog DBM verifier outputs and rotate credentials once Redis/Valkey and Postgres monitoring alignment is complete
- [ ] Grant metadata permissions (e.g. SELECT on pg_available_extension_versions) to `datadog` role to silence extension warning logs

### Datadog Internal Developer Portal — Orange Items (Action List)

- [ ] Monitors — create core service monitors for `vibecode-webgui` (error rate, latency, saturation). Owner: Observability. Where: Datadog Monitors. Evidence: screenshots + monitor IDs.
- [ ] SLOs — define latency and availability SLOs with SLIs mapped to the above monitors/traces. Owner: Observability. Evidence: SLO URLs.
- [ ] Logs Correlation — enable logs injection and trace/log correlation for Node.js and the queue worker. Set `DD_LOGS_INJECTION=true` and ensure logger emits `dd.trace_id`/`dd.span_id`. Touchpoints: `src/instrument.ts`, `src/lib/monitoring/*`, App Service settings.
- [ ] Live Debugger — evaluate enabling Datadog Live Debugger for production incidents (cost/guardrails). Requires DI; document enable/disable procedure. Env: `DD_LIVE_DEBUGGING_ENABLED=true` (gated).
- [ ] Dynamic Instrumentation — add opt-in support. Env: `DD_DYNAMIC_INSTRUMENTATION_ENABLED=true`. Wire via `scripts/configure-datadog-appservice.sh`. Keep default OFF; add runbook with blast-radius/cost notes.
- [ ] Distributed Tracing — confirm traces for SSR and API routes appear (agentless acceptable). Env: `DD_TRACE_ENABLED=1`, `DD_SERVICE`, `DD_ENV`, `DD_VERSION`. Touchpoints: `src/instrument.ts`, `src/lib/monitoring/opentelemetry*.ts`.
- [ ] Universal Service Monitoring — assess applicability on App Service (often not supported like on hosts/eBPF). Document decision; add alternative (App Insights) if N/A.
- [ ] Continuous Profiler — enable Node.js profiler in App Service when needed. Env: `DD_PROFILING_ENABLED=true`. Validate with profile snapshots. Keep default OFF.
- [ ] Infrastructure Monitoring — connect Azure integration for host/container metrics where relevant; otherwise rely on App Insights + App Service metrics. Document chosen path.
- [ ] Log Management — ensure application logs ship to Datadog. Env: `DD_LOGS_ENABLED=true`. Validate ingestion pipeline; confirm redaction rules for secrets.
- [ ] Synthetics Tests — create HTTP tests for `/api/health`, `/readyz`, homepage, and critical flows. Place in Datadog Synthetics; link configs.
- [ ] App & API Protection — evaluate and, if approved, set `DD_APPSEC_ENABLED=true` with proper WAF rules; document tuning/false-positive playbook. Default OFF.
- [ ] Code Security — wire CI code scanning (Datadog Code Security or alternative). Add an on-demand GH workflow only; no default triggers.
- [ ] Cloud Network — evaluate Azure Network Monitoring or Datadog Cloud Network. If not applicable to App Service, document rationale and close.

### Open Questions for Other Agents
- Should the rate limiter share state via existing Redis/Valkey deployments? (requires connection details)
- Is there a preferred namespace override for Helm release (`fullnameOverride`) to avoid legacy resource conflicts?
- Any remaining Azure cost-control tasks pending after the latest deployments?

> Note: Proprietary rate-limiter integrations were removed repo-wide to comply with open-source requirements. Validate templates/scripts for any downstream automation that may have cached configuration.
