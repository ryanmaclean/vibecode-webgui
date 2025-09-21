---
title: TODO
description: Multi-agent coordination log (regenerated 2025-09-19)
---

## Agent Update (2025-09-21 07:57 UTC)

### Summary
- Reconciled Datadog Helm values with the APM autodiscovery guide (socket + RBAC) and verified `datadog-apm.socketEnabled=true`/`clusterAgent.rbac.create=true` are rendered for the AKS release.
- Confirmed runtime instrumentation: `vibecode-app` pods inherit `NODE_OPTIONS=--require ./instrument.cjs` with `DD_TRACE_DEBUG=true`; trace agents now log `traces received` for `service:vibecode-webgui` after live traffic.
- Exercised `/api/ai/chat` via `node scripts/test-ai-chat.js` (port-forward) which returned `200` and produced APM hits (`trace.http.request.hits{service:vibecode-webgui}`) plus OpenAI spans tagged `ml.app=vibecode-ai`.
- Re-ran `scripts/verify-llm-observability.sh` targeting `deployment/vibecode-app`; pod logs include the "✅ Datadog LLM Observability enabled..." banner, confirming agentless LLM telemetry wiring.
- Pointed the Datadog DBM secret back to in-cluster Postgres (service + headless) and removed `hostNetwork` from the DaemonSet (`dnsPolicy: ClusterFirst`); patched `datadog-confd/postgres.yaml` + annotations to set `ssl:"disable"`, and the agent now reports successful `check:postgres` runs against `postgresql.vibecode-platform.svc.cluster.local`.
- Restored `datadog-azure-postgres` (pgadmin creds) with `ssl:"require"` in `datadog-confd/postgres.yaml`; Azure Flexible Server is polled successfully and `pg_stat_statements` is now active after updating `azure.extensions` + running `CREATE EXTENSION` via a temporary pod.

### Blocking Work / Next Steps (updated 2025-09-21 07:28 UTC)
- ✅ Re-ran `scripts/verify-datadog-dbm.sh` with extended timeouts; the script now completes and logs the Datadog daemonset rollout finishing (00:50 UTC).
- ⏳ Confirm `postgresql.pgvector.*` metrics populate in Datadog (API shows connections for `service:vibecode-azure-pg`; pgvector series still backfilling) and capture DBM dashboard evidence once data lands.
- ⏳ Capture Datadog UI screenshots showing the new APM service (`vibecode-webgui`) and LLM spans (filter `ml.app:vibecode-ai`) after traces backfill.

## Agent Update (2025-09-21 03:11 UTC)

## Agent Update (2025-09-21 20:52 UTC)

### Summary
- Reworked `scripts/ingest-docs-to-rag.ts` to support three embedding modes (Azure, OpenRouter, and a new local hashing fallback) with Datadog per-chunk metrics and retry controls; `USE_LOCAL_EMBEDDINGS=true` now routes ingestion through deterministic 1,536-dimension vectors so we avoid OpenAI entirely.
- Seeded the flexible Postgres `document_embeddings` table using the local embedding path (limited to 3 chunks from `production-deployment-guide.md` for fast iteration) and confirmed rows via `psql`.
- Added `scripts/rag-local-demo.ts` to perform similarity search using the local embedding function and call OpenRouter (`mistralai/mistral-small-24b-instruct-2501:free`) for the final answer, demonstrating RAG without OpenAI/Azure.
- Re-ran ingestion with `USE_LOCAL_EMBEDDINGS=false` so embeddings are generated via OpenAI (`text-embedding-3-small`) against the flex Postgres instance; verified retrieval through the demo script (`scripts/rag-local-demo.ts`) which now auto-selects OpenAI when the key is present.
- Full documentation set ingested in waves using OpenAI embeddings over the remote flex Postgres server (`RAG_INCLUDE_REGEX` windows: `^[a-e]`, `^[f-l]`, `^[m-s]`, `^[t-z]`), bringing `document_embeddings` to 2,311 rows. Added `RAG_SKIP_TEST_SEARCH` to avoid long-running validation queries during batch runs.

### Blocking Work / Next Steps (updated 2025-09-21 21:40 UTC)
- ⏳ Decide whether the hashing-based embeddings should be promoted to a shared utility (so the runtime APIs can match the ingestion flow) or replaced with a higher-quality open model (e.g., `@xenova/transformers`).
- ⏳ Point server-side RAG calls to the new local embedding implementation (or the OpenRouter-only path) to keep runtime requests off OpenAI/Azure.

## Agent Update (2025-09-21 21:55 UTC)

### Summary
- Catalogued every runnable app in the repo and captured its current deployment target:
  - `vibecode-webgui` — Docker image published via `Dockerfile.production`, promoted to AKS through `charts/vibecode-aks` and the `build-and-push-image` workflow.
  - `services/ai-gateway` — built from its dedicated Dockerfile and pushed to Azure App Service by `.github/workflows/azure-appservice-deploy.yml` (image hosted in ACR).
  - `docs/` site — rendered with Astro/Next and deployed to GitHub Pages (`deploy-docs.yml`), no container build.
  - `queue-worker/` — Azure Functions queue trigger packaged and published with `func azure functionapp publish` (no container, relies on Function App settings).
  - `code-server/` — Helm templates and values exist inside `helm/vibecode-platform`, but the AKS cluster currently runs only `deployment/vibecode-app`; no code-server pods are present.
- Verified AKS workload inventory (`kubectl get deployments -n vibecode-platform`) to confirm the missing `code-server` rollout before scheduling remedial work.

### Blocking Work / Next Steps (updated 2025-09-21 21:55 UTC)
- ⏳ Produce a Helm values override (or dedicated release) for `codeServer` and deploy it to `vibecode-platform`, ensuring persistence, ingress, and TLS line up with production requirements.
- ⏳ Add operational checks for the non-AKS apps (AI Gateway App Service, Azure Functions queue worker, GitHub Pages docs) so future agents can confirm their pipelines stay green.

### Summary
- Pulled Azure PostgreSQL Flexible Server connection strings for `vibecode-pgflex-1758422944` via `az postgres flexible-server show-connection-string`, confirming target database `vibecode` and login `pgadmin` for upcoming RAG ingestion work.
- Checked firewall rules to ensure current public IP `64.46.2.133` is permitted; direct `psql` login still fails, so the admin password needs verification or rotation before traffic moves over.
- Staged environment variable guidance for pointing `DATABASE_URL` at the flexible server so RAG scripts can be re-run without touching the in-cluster Postgres instance.

### Blocking Work / Next Steps (updated 2025-09-21 03:11 UTC)
- ⏳ Confirm or reset the `pgadmin` administrator password, store it in Key Vault / Kubernetes secret, and re-test connectivity with `psql` (current attempts fail).
- ⏳ Export the verified `DATABASE_URL` and rerun `scripts/setup-rag-db.sh` followed by `npx tsx scripts/ingest-docs-to-rag.ts` to seed embeddings against the flexible server.
- ⏳ Update application/Helm secrets to reference the flexible server connection string once ingestion succeeds, ensuring AKS workloads and Datadog DBM point at the same database.

## Agent Update (2025-09-20 23:45 UTC)

### Summary
- Reinstalled NGINX ingress via Helm; LoadBalancer now serves `20.57.69.198` off managed IP `rg-vibecode-aks-prod/vibecode-ingress-ip`.
- Verified AKS cluster `vibecode-prod-aks-6c3db0e6` node pools Ready and ingress service healthy; Datadog agents awaiting app rollout reattachment.
- Patched `postgresql-0` StatefulSet (`PGDATA` clean-up) and reran `scripts/postgres_setup.py`, bringing the pod back to Running with bound PVC and credentials in `secret/postgresql-secret`.
- Provisioned and attached ACR `vibecodecr84859296`; application image build/push still outstanding.
- Confirmed `TODO.md` trimmed to active workstreams so new items can be logged cleanly.
- Wired Datadog LLM Observability env vars across Helm/Tofu/K8s manifests and added `scripts/verify-llm-observability.sh` for post-deploy validation.

### Blocking Work / Next Steps (updated 2025-09-20 05:35 UTC)
- ✅ Built linux/amd64 image `vibecodecr6c3db0e6.azurecr.io/vibecode-webgui:latest` (digest `sha256:2a0618d2a865d645e4598b8cad1aa615e843f6b7008872b4b514647f9bd30945`) via `az acr build`; Helm release now pulls with `imagePullPolicy=Always`.
- ✅ Helm reinstalled (`vibecode-app` @ revision 3) pointing to `postgresql.vibecode-platform.svc.cluster.local`; migrations disabled pending script wiring; persistence disabled (uses ephemeral `/tmp` & `/app/logs`).
- ⏳ Run Prisma/DB migrations manually (`env DATABASE_URL=... npx prisma migrate deploy`) and re-enable the Helm Job with the proper command once verified.
- ⏳ Update DNS (`vibecode.eastus2.cloudapp.azure.com`) to the current ingress IP `20.57.69.198`, fix TLS host mismatch (ingress TLS section still references `vibecode.eastus.cloudapp.azure.com`), and capture Datadog traces during smoke tests.
- ⏳ Populate `OPENROUTER_API_KEY` secret (currently empty) or wire alternative embedding provider before RAG demo.
- ⏳ Re-run production smoke suite (`npm run test:production:smoke`) against the new ingress and archive `playwright-report/production` artifacts.

### Handoff Notes
- Postgres credentials live in `secret/postgresql-secret` (user `postgres`); rotate once the platform stabilises.
- Keep App Service pivot tasks in view—update timelines if AKS path resumes.

## Agent Progress & Handoff (2025-09-20 04:45 UTC)

### 2025-09-20 05:35 UTC — AKS Recovery Resumed
- Reprovisioned AKS (`vibecode-prod-aks-6c3db0e6` @ k8s `1.33.2`) and ACR (`vibecodecr6c3db0e6`) via OpenTofu + targeted Azure CLI cleanup; kubeconfig restored with admin credentials.
- Fresh Helm deploy of `vibecode-webgui` (rev 3) now serves three replicas pointing at in-cluster Postgres (`postgresql-0` statefulset). Health endpoint responds `200` (`kubectl port-forward svc/vibecode-app 3000:80` ⇒ `/api/health`).
- Secrets now sourced from Kubernetes (`DATABASE_URL`, `NEXTAUTH_SECRET`, `DD_API_KEY`), `OPENROUTER_API_KEY` still pending. Persistent uploads disabled temporarily; follow-up to introduce RWX storage or Azure Files. Prisma migrations applied manually (four pending migrations deployed via port-forward).
- Outstanding: re-enable migrations Job with `npx prisma migrate deploy`, wire Datadog dashboards with new cluster name (`vibecode-prod-aks-6c3db0e6`), flip DNS/TLS, then execute smoke tests + RAG seeding.

### Performance Testing Status
- **Lighthouse Audits**: Homepage LCP, TBT, and Interactive metrics are extremely poor (20+ seconds), even with a simplified "Hello World!" page. This indicates a severe performance bottleneck with the Next.js development server itself in this environment, making accurate performance testing and optimization impossible.
- **Datadog Synthetic Tests**: Unable to successfully run local synthetic tests using `datadog-ci` due to persistent configuration and usage errors (e.g., "No tests to run", "Cannot read properties of undefined (reading 'match')"). The tool's behavior with local test definitions is unclear.
- **Docker Environment**: Attempts to run the application in Docker were blocked by recurring "no space left on device" errors during build and "Cannot connect to Docker daemon" issues. These are environmental problems outside of agent control.

### Current Blockers & Recommendations for Next Agent
- **Critical Environment Issue**: The Next.js development server's performance on this machine is severely degraded. The next agent should investigate the local development environment setup, focusing on:
    - Ensuring the Docker daemon is stable and has sufficient disk space/resources.
    - Reviewing Next.js/Tailwind CSS/PostCSS configurations for any known compatibility issues on ARM64 architectures that might impact development server performance.
    - Verifying that the `npm run dev` process is not being throttled or encountering resource limits.
- **Datadog Synthetic Tests**: Revisit `datadog-ci` usage for local tests. Consider alternative approaches if local execution remains problematic (e.g., uploading tests directly to Datadog and triggering them via API).
- **All changes made during this session have been reverted to their original state.**

## Coordination Snapshot (2025-09-19 17:50 UTC)

### 2025-09-20 22:30 UTC — PaaS Pivot (App Service + Flexible Postgres)
**Directive**: Drop AKS recovery efforts and re-platform on lower-cost Azure services: App Service for the Next.js app, Azure Database for PostgreSQL Flexible Server (pgvector enabled), Azure OpenAI, and a queue-driven PDF ingestion workflow.

**Current state**
- Legacy AKS cluster has been decommissioned. Public IP `vibecode-ingress-ip` (172.203.72.2) still exists but isn’t attached to a load balancer, so `vibecode.eastus2.cloudapp.azure.com` times out.
- Remote OpenTofu backend scaffolding is ready (resource group `rg-vibecode-tofu-state`, storage account `vibecodetfstate01`, container `opentofu-state`).
- App Service Terraform skeleton now provisions Storage, Postgres, Linux Web App, and Function App modules—monitoring/Key Vault/OpenAI modules remain TODO.
- Datadog runbook updated with DBM + LLM prerequisites and verification steps; alert snippets prepared for synthetics/metric monitors but not yet deployed.

**Immediate focus**
1. Author a lean architecture doc describing the App Service + Flexible Postgres + Azure OpenAI design, including cost estimates and network considerations.
2. Produce new infrastructure-as-code scaffolding (OpenTofu with remote backend) to deploy:
   - App Service Plan (Linux, B1) + Web App for SSR Next.js
   - Azure Storage (blob + queue) for PDF uploads and work dispatch
   - Azure PostgreSQL Flexible Server (Basic B1ms) with `pgvector`
   - Consumption Azure Function (queue trigger) for PDF chunking & embedding
   - Application Insights + Key Vault for secrets
3. Bake Datadog instrumentation (dd-trace, AppSec/IAST, agent connectivity) into every deployment flow:
   - Update Dockerfile/Next runtime defaults (`NODE_OPTIONS=--require dd-trace/initialize`, `DD_APPSEC_ENABLED`, `DD_IAST_ENABLED`, etc.).
   - Provide a first-class Datadog agent/sidecar definition for App Service (compose) and AKS (DaemonSet) with required env vars.
   - Extend `.env.defaults`, Helm/Tofu modules, and local docker-compose to include agent + tracer settings so developers get parity.
   - Add CI guardrails that fail deployments if Datadog env vars or agent containers are missing.
   - Document the verification runbook (harness script + Datadog API checks) and wire it into post-deploy smoke tests.
3. Update the application workflow so file uploads land in Blob Storage, enqueue a work item, and the Function processes the file with Azure OpenAI embeddings, persisting chunks to Postgres.

### Priority Ranking (2025-09-20 22:30 UTC)
1. **Document & approve PaaS architecture** — ✅ `docs/src/content/docs/azure-appservice-migration.md` circulated; awaiting stakeholder sign-off.
2. **Bootstrap new OpenTofu project** — ✅ `tofu/appservice/` contains storage, Postgres, App Service, Function App modules; Monitoring, Key Vault secret wiring, and OpenAI modules still pending before a full plan/apply.
3. **Analyse low-cost deployment options** — ✅ decision captured in `docs/DECISION_LOG.md` (App Service vs KinD VM vs ACI/ACA). Next: gather finance/Ops feedback.
4. **Datadog instrumentation everywhere** — Bake tracer env defaults, ensure App Service sidecar (or site extension) + AKS DaemonSet are deployed, and add CI/post-deploy checks so `env:production` spans are mandatory.
5. **Implement queue-based PDF ingestion** — Architecture and Terraform scaffolding ready; Next.js upload API + queue worker still need implementation and deployment scripts.
6. **Reconfigure runtime secrets** — move configuration to Azure App Configuration/Key Vault or App Service settings (DATABASE_URL, AZURE_OPENAI_ENDPOINT, STORAGE_QUEUE_NAME, etc.) and document `.env` parity.
7. **Decommission AKS artifacts** — archive or delete AKS-specific scripts/manifests once migration is proven, updating README/production docs to reference App Service deployment.

### RAG & Demo Readiness (2025-09-20 19:12 UTC)
- [x] **Agent #3 — Vector Data Seeding**: After Postgres is reachable, run `scripts/populate-vector-db-samples.ts` (or `scripts/generate-vector-activity.sh` inside the cluster) to repopulate `document_embeddings` and `rag_chunks`; validate with `scripts/verify-rag-functionality.ts` and record row counts in `POSTGRES_MONITORING_VALIDATION_RESULTS.md`. ✅ Schema + migration ready: re-added `embedding vector(1536)` to `RAGChunk` and committed Prisma migration `20250920190000_add_rag_embedding_column` so future deploys can run `npx prisma migrate deploy` without manual SQL. 2025-09-21: Seeded sample Apache libraries + full docs using OpenAI embeddings (2,311 documents, 3,036 chunks); verification logged via `scripts/run-rag-verification.ts` with Datadog tracing.
- [x] **Agent #4 — Demo Prompt Library**: Curate lovable.ai-style prompts (`src/data/demo-prompts.ts`) and surface them in the chat UI selector so Lovable demo flows are one click away. Next step: capture API telemetry once RAG search is reconnected.
- [ ] **Agent #6 — LLM Observability Enablement**: Set `DD_LLMOBS_ENABLED=1` + `DD_LLMOBS_AGENTLESS_ENABLED=1`, ensure `DD_API_KEY`/`DD_SITE` are exported, and verify spans from `src/lib/datadog-llm.ts` hit Datadog. ✅ Runbook now includes prerequisites and verification links; next capture screenshots/logs once connectivity is restored.
- [x] **Agent #7 — Datadog Dashboard Refresh**: Created comprehensive monitoring setup for AKS with detailed documentation in `docs/aks-datadog-monitoring-guide.sh` and deployment script in `scripts/setup-aks-datadog-monitoring.sh`. Ready to deploy once the AKS cluster is provisioned.

### Immediate Priority Handoff (2025-09-20 22:30 UTC)
1. **Agent #1 — Infra Bootstrap**: Finish the remaining `tofu/appservice` modules (Monitoring, Key Vault integration, Azure OpenAI) and run `tofu plan` pointing at the remote backend (`rg-vibecode-tofu-state`).
2. **Agent #2 — App Service Deployment Flow**: Prototype deployment (zip deploy or GitHub Action) for the Next.js app; document required App Service settings (NODE_VERSION=20, WEBSITE_RUN_FROM_PACKAGE=1, DD_* env vars, connection strings).
3. **Agent #3 — Queue Worker**: Build the `queue-worker` Function (TypeScript) that reads from Storage Queue, extracts PDFs, calls Azure OpenAI embeddings, and writes RAG chunks to Postgres.
4. **Agent #4 — File Upload API**: Update Next.js `/api/ai/upload` to write to Blob Storage + enqueue jobs; expose job status endpoints for the UI.
5. **Agent #5 — Monitoring Automation**: Import/create the Synthetic + metric monitors for ingress/AKS availability in Datadog so future outages trigger alerts automatically.

### AKS Redeploy Checklist (Agent #1 / #2)
- [ ] While OpenTofu recovery is in progress, we've created scripts for direct AKS deployment:
  - `scripts/create-aks-cluster.sh`: Creates a new AKS cluster once old cluster deletion is complete
  - `scripts/deploy-ingress-controller.sh`: Deploys NGINX Ingress Controller with our public IP
  - `scripts/deploy-vibecode.sh`: Master script to deploy the full VibeCode stack (update image repository/tag to amd64-capable build before rerun)
- [ ] Build/publish amd64 (or multi-arch) web app image to ACR (`vibecodecr6c3db0e6.azurecr.io/vibecode-webgui:<tag>`) to resolve `exec format error` on AKS nodes.
- [ ] After new image is available, rerun `scripts/app_deploy.py ... --skip-build --image-tag <tag> --wait` and confirm pods become Ready.
- [ ] Execute `npx prisma migrate deploy` (via Kubernetes Job or queue worker startup) once app image is fixed so `rag_ingest_jobs` and `rag_chunks.embedding` schema changes reach the cluster.

### DNS & External Access Follow-up
- [ ] Run `scripts/create-aks-cluster.sh` once Azure quotas are raised so the new cluster can attach to `rg-vibecode-dns` resources.
- [ ] Use `scripts/deploy-ingress-controller.sh` (or `scripts/deploy-vibecode.sh`) to deploy NGINX Ingress with the existing `vibecode` public IP.
- [ ] Deploy the application (`scripts/app_deploy.py` or `scripts/deploy-vibecode.sh`) and wait for rollout completion.
- [ ] Confirm Let's Encrypt issues a fresh certificate for `vibecode.eastus2.cloudapp.azure.com`.
- [ ] Smoke-test the domain (`curl`/browser) to verify 200 responses over HTTPS.

### Documentation Updates
- [ ] Replace lingering `http://20.36.249.127` references (README/PRODUCTION_STATUS/etc.) with `https://vibecode.eastus2.cloudapp.azure.com` once DNS cutover is confirmed.

**2025-09-20 19:22 UTC Update**: Patched `tofu/k8s-vibecode-app.tf` network policy so kube-dns access uses explicit namespace/pod selectors (`kube-system`/`k8s-app=kube-dns` with TCP+UDP 53), PostgreSQL egress matches both `app=postgres` and `app=postgres-simple`, Datadog traffic targets the `datadog` namespace, and ingress is limited to the managed `ingress-nginx` controller namespace.

**2025-09-21 18:45 UTC Update**: Created comprehensive Datadog monitoring setup for AKS with detailed documentation and setup scripts. Validated approach using existing configurations. Ready to deploy once the AKS cluster is provisioned.

#### 🔧 **Helm Resource Cleanup** (Medium Priority)
- [ ] **ServiceAccount Conflict**: Resolve pre-existing `vibecode-app` ServiceAccount in `vibecode-platform`
- [ ] **Helm Ownership**: Add Helm ownership labels or delete conflicting resources
- [ ] **Dry-run Success**: Enable `helm upgrade --install vibecode-webgui ... --dry-run` to complete

#### 📊 **Datadog Dashboard Cleanup** (Medium Priority)
- [x] **Datadog Monitoring**: Created comprehensive monitoring setup with detailed documentation:
  - Created `scripts/setup-aks-datadog-monitoring.sh` for deploying Datadog to AKS
  - Created detailed `docs/aks-datadog-monitoring-guide.md` with setup and troubleshooting instructions
  - Ready to deploy once AKS cluster is provisioned
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

- Datadog pods are online but DBM/LLM observability require reinstating credentials and workloads.

### AKS App Deployment Status
- [ ] Resolve Helm error `services "vibecode-app" not found` when installing `charts/vibecode` with `fullnameOverride=vibecode-app`.
  - [ ] First deploy without Ingress to bring up `Service`/`Deployment`, then enable Ingress in a second upgrade
  - [ ] If still failing, render chart with `helm template charts/vibecode` and verify the Service name matches the Ingress backend (`{{ include "vibecode.fullname" . }}`)
  - [ ] As fallback, temporarily set `service.type=LoadBalancer` and validate direct service reachability
- [ ] After application is Ready, re-enable Ingress (nginx) for `vibecode.eastus2.cloudapp.azure.com` and validate TLS via cert-manager

### Observability Follow-ups
- [x] Datadog Agents deployed on AKS — DaemonSet `datadog` and Cluster Agent are Running in `datadog` namespace
- [x] Postgres monitoring workload deployed in `vibecode-platform` (`k8s/postgres-with-monitoring.yaml`)
- [x] DBM verifier script fixed to use heredoc for SQL (avoid `$$` expansion) and allow workload override via `POSTGRES_WORKLOAD_KIND/NAME`
- [x] pgvector and pg_stat_statements installed on StatefulSet `postgresql`
- [x] Create `document_embeddings` table and seed sample rows (run updated verifier to completion) — 2025-09-21: seeded 3 docs + 3 rag chunks locally with `scripts/seed-document-embeddings.ts`; ran `scripts/verify-rag-functionality.ts` (embedding checks pending OPENROUTER_API_KEY)
- [ ] Confirm DBM metrics surface in Datadog (Database Monitoring → host: `postgres-service.vibecode-platform.svc.cluster.local`)
- [x] Re-enable Datadog LLM Observability after app deploy (`DD_LLMOBS_*`)
- [x] Add `scripts/verify-llm-observability.sh` helper to confirm env vars/logs before Datadog APM checks
- [x] Add `scripts/test-ai-chat.js` port-forward test harness for `/api/ai/chat`
- [x] Rebuild web image with Prisma client baked in (`vibecode-webgui:llm-20250919233511`) and roll out to AKS
- [x] Move `NEXTAUTH_SECRET` back into `vibecode-app-secrets` and redeploy so envs pull from the secret instead of inline `kubectl set env`
- [x] Resolve `/api/ai/chat` 500 caused by missing Prisma client generation when executing the new test harness
- [x] Provide valid LLM provider credentials (free `mistralai/mistral-small-24b-instruct-2501:free`) so `/api/ai/chat` succeeds instead of `fetch failed`
- [x] Rebuild container/Helm targets to propagate `DD_IAST_ENABLED=true` (Docker + AKS release) — 2025-09-21: rebuilt `Dockerfile.production` → `vibecode-webgui:latest` and verified `helm template` output includes env
- [x] Validate runtime logs report IAST activation during startup — `docker run` with `DD_TRACE_DEBUG=true` emitted `[ASM] Enabled AppsecFsPlugin for iast` and dynamic instrumentation banner (403 expected with dummy key)
 - [ ] Confirm APM traces flow from the web app

### Datadog Internal Developer Portal — Orange Items (Action List)

- [ ] Monitors — create core service monitors for `vibecode-webgui` (error rate, latency, saturation). Owner: Observability. Where: Datadog Monitors. Evidence: screenshots + monitor IDs.
- [ ] SLOs — define latency and availability SLOs with SLIs mapped to the above monitors/traces. Owner: Observability. Evidence: SLO URLs.
- [ ] Link Source Code — connect GitHub repo to Datadog Service Catalog so commits/PRs link to traces and errors. Add `service`, `env`, `version`, and `git.repository_url` tags via CI or App Service settings; validate the Service Catalog entry shows source links.
- [ ] First build tracing — ensure at least one baseline trace is captured in Datadog from App Service (SSR route and an API route). Verify `DD_TRACE_ENABLED=1`, `DD_SERVICE`, `DD_ENV`, `DD_VERSION`; confirm traces appear in APM.
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

- [x] Rebuild documentation image once Astro front matter is fixed — 2025-09-21: added placeholder front matter to wiki archive docs, built `vibecode-docs:latest`, pushed to ACR (sha256:0e601067302ac661a8c3963cef925c207bbde812ae0e6e450cff492fa5c498db).
- [ ] Confirm Datadog APM shows live traces for `vibecode-webgui` after deploying `sha256:fafd3cb615a4c5e9980bcb90f9e72b88f892ee74d5e575320c35042029d051d6`.
  - Note: current pods expose DD_API_KEY empty; populate `vibecode-app-secrets` before traces can be emitted.
- [ ] Confirm Datadog DBM displays pgvector metrics after running `scripts/verify-datadog-dbm.sh` (capture dashboard screenshot).
  - Datadog query `avg:postgresql.pgvector.vector_count{*}` returned empty as of now; allow ingestion or verify agent credentials.
- [x] Re-run `scripts/verify-llm-observability.sh` with correct namespace/deployment and trigger `/api/ai/chat` to smoke test spans — used `DEPLOYMENT=vibecode-app`, saw env vars + log banner, port-forwarded service (401 response) to generate spans.
