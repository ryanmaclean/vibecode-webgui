---
title: azure appservice migration
description: blueprint for moving vibecode webgui from aks to managed azure paas
---

# Azure App Service Migration Plan

## 🎯 Goals
- Restore production availability without waiting on AKS quota resets.
- Reduce operating cost and operational toil by leaning on managed PaaS services.
- Preserve RAG capabilities (pgvector-backed embeddings + Azure OpenAI) and make ingestion queue-driven for reliability.

## 🏗️ Target Architecture Overview
| Layer | Azure Service | SKU / Notes |
| --- | --- | --- |
| Web application | App Service (Linux) | Basic B1 plan, 1 instance, VNet integration optional once private endpoints are ready |
| Background processing | Azure Functions (Consumption) | Queue-triggered TypeScript worker for PDF chunking + embedding |
| Database | Azure Database for PostgreSQL Flexible Server | Basic tier (B1ms compute, 32 GB storage to start, pgvector extension enabled) |
| Storage & queueing | Storage Account (General Purpose v2) | Hot tier blob container for uploads, standard queue for work dispatch, file share optional for logs |
| AI services | Azure OpenAI | Existing `gpt-4o-mini` (chat) + `text-embedding-3-large` deployments reused |
| Observability | Application Insights + Log Analytics | App Insights SDK (auto-provisioned) + unified workspace for Functions/App Service |
| Secrets | Key Vault or App Service settings | Centralize secrets, rotate from CI/CD pipeline, mirror `.env` keys |

### Data Flow
1. User uploads a PDF or document via the Next.js app (running on App Service).
2. App saves the raw file to Blob Storage and enqueues metadata (blob URI, tenant/user, requested vectors) to Azure Queue Storage.
3. Queue-triggered Azure Function pulls the message, downloads the blob, chunks it, calls Azure OpenAI embeddings, and writes chunks + metadata to PostgreSQL Flexible Server.
4. App Service reads context from PostgreSQL when serving chat responses; Azure OpenAI chat completions run with retrieved context.
5. Metrics/telemetry flow into Application Insights; structured logs can be exported to Log Analytics for dashboards and alerting.

## 🔐 Networking & Security
- Start with public endpoints to accelerate unblock; add VNet integration and private endpoints once quota issues are solved.
- Enable HTTPS-only on App Service and enforce `WEBSITES_PORT=3000` for Next.js.
- Use Managed Identity for App Service and Functions to access Key Vault secrets; configure role assignments in the remote backend modules.
- PostgreSQL Flexible Server: configure firewall to allow outbound IP of App Service + Function (or enable VNet integration when ready).
- Storage account: require HTTPS, enable shared access signatures only for temporary upload tokens if direct client upload is required.
- Log data retention aligned with cost goals (suggest 30 days default).

## ⚙️ Infrastructure-as-Code Plan
- Remote backend already defined in `tofu/backend.tf` (RG `rg-vibecode-tofu-state`, storage `vibecodetfstate01`, container `opentofu-state`). Run `tofu init -migrate-state` once the current local lock is cleared.
- Create a new OpenTofu root (`tofu/appservice-main.tf`) that wires providers `azurerm`, `random`, `time`, and uses modules:
  - `modules/app_service` – plan + site, deployment slots, diagnostics settings.
  - `modules/storage` – blob container, queue, optional file share, SAS policy outputs.
  - `modules/postgres_flexible` – server, database, firewall rules, private DNS when ready.
  - `modules/function_app` – consumption plan, function app, system-assigned identity, queue trigger.
  - `modules/monitoring` – Application Insights workspace + diagnostic settings.
  - `modules/key_vault` – secrets for connection strings, OpenAI keys, webhook secrets.
- After provisioning, install the [Datadog extension for App Service](https://learn.microsoft.com/azure/azure-monitor/app/azure-monitor-app-service#monitor-app-service-apps-with-datadog) or sidecar container so traces/logs reach Datadog (required for live APM/LLM telemetry).
- CI/CD: reuse GitHub Actions (or Azure DevOps) to `npm run build`, zip deploy to App Service using `az webapp deploy` or the App Service Deploy action.

## 🔧 Runtime Configuration
| Variable | Purpose | Where to store |
| --- | --- | --- |
| `DATABASE_URL` | Postgres Flexible connection string with managed identity or password auth | App Service settings (slot) and Function App settings |
| `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_KEY` | Chat + embeddings endpoint/key | Key Vault secret + reference in App/Function settings |
| `STORAGE_ACCOUNT_NAME` / `STORAGE_CONTAINER` | Blob storage names for uploads | App/Function settings |
| `STORAGE_QUEUE_NAME` | Queue used for ingestion jobs | App/Function settings |
| `EMBEDDING_MODEL` | Embedding deployment name (`text-embedding-3-large`) | App settings |
| `CHAT_MODEL` | Chat deployment (`gpt-4o-mini`) | App settings |
| `APPINSIGHTS_CONNECTION_STRING` | Pull from Application Insights resource | App/Function settings |
| `RAG_NAMESPACE` | Optional schema qualifier for multi-tenant context | App settings |
| `DD_API_KEY` / `DD_SITE` / `DD_ENV` / `DD_SERVICE` / `DD_VERSION` | Datadog tracing + LLM observability | App Service & Function App settings (use Key Vault references in production) |
| `NODE_OPTIONS` | `--require dd-trace/init` to auto-load the tracer | App Service settings (already set by Terraform module) |

Document any new secrets in `docs/src/content/docs/environment-variables.md` and mirror safe defaults in `.env.local.example`.

## 💸 Cost Estimate (Monthly, East US 2)
| Service | Units | Estimated Cost |
| --- | --- | --- |
| App Service Plan B1 | 1 instance | ~\$55 |
| PostgreSQL Flexible B1ms | 730 hours + 32 GB storage | ~\$35 compute + \$5 storage |
| Azure Functions (Consumption) | 1M executions, 400k GB-s | ~\$0 (within free grant) |
| Storage Account (100 GB hot, moderate transactions) | 1 account | ~\$8 |
| Queue Storage | 1 queue, 1M ops | <\$1 |
| Application Insights | 5 GB ingestion | ~\$10 |
| Bandwidth / misc | Egress 50 GB | ~\$4 |
| **Total baseline** |  | **≈ \$113/month** (plus Azure OpenAI usage billed per request)

Notes:
- Azure OpenAI remains consumption-based; monitor spend via quota alerts.
- Scale-up levers: move App Service to S1 (adds staging slots, SSL) or Postgres to General Purpose for higher throughput.

## 🚀 Migration Phases
1. **Design & Approval** – circulate this doc, capture sign-off from Eng + Ops.
2. **Infrastructure Bootstrapping** – run `tofu init`, stand up storage, Postgres, and App Service (without swap).
3. **App Readiness** – adapt Next.js to use Blob + Queue workflow, add Function App project, verify local integration (`npm run dev:queue`).
4. **Data Migration** – run existing vector seeding scripts against the new Postgres server.
5. **Cutover** – update DNS or App Service custom domain, run smoke tests, enable monitoring dashboards.
6. **Decommission AKS** – remove unused Terraform, archive manifests, shut down related Azure resources.

## ⚠️ Risks & Mitigations
- **Throughput limits on Basic SKUs** → add scale rules or plan to upgrade to Standard tiers if CPU >70%.
- **Queue processing latency** → configure max concurrency on Functions and consider Dedicated plan if backlog grows.
- **Security posture drift** → schedule follow-up to add VNet integration/private endpoints once quotas stabilize.
- **State migration errors** → perform `tofu init -migrate-state` with lock cleared and verified credentials; keep backup of local state until remote backend confirmed.
- **Missing Datadog telemetry** → Terraform module now injects Datadog app settings; ensure `datadog_api_key` is populated at plan/apply time and install the Datadog extension or sidecar if additional log collection is needed.
- **Local scripts not reporting traces** → Standardize on `ddtrace-run` (Python/Node) for CLI verification scripts (`scripts/run-rag-verification.ts`, ingestion jobs) so non-production runs still emit APM/LLM spans during smoke tests.

## ✅ Next Steps
- [ ] Review with stakeholders (SRE, Product, Finance).
- [ ] Create skeleton OpenTofu modules + pipelines described above.
- [x] Document PDF ingestion workflow and message schema (`pdf-ingestion-queue`).
- [ ] Update README and operations runbooks to reference App Service deployment.
- [ ] Define monitoring/alert thresholds in Application Insights (request duration, queue backlog, function failures).
