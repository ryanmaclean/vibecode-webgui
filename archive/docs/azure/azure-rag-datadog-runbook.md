# Azure RAG + Datadog Runbook

This runbook describes how to deploy the Lovable.ai style VibeCode demo on Azure with PostgreSQL + pgvector, Retrieval-Augmented Generation, and Datadog monitoring (Database Monitoring and LLM Observability).

## 📦 Prerequisites

- Azure subscription with permission to create AKS, ACR, Managed Identity, and Postgres resources.
- Datadog account with Database Monitoring and LLM Observability enabled.
- Local tooling:
  - Azure CLI (`az`)
  - OpenTofu 1.7+ (`tofu`)
  - kubectl
  - Helm 3
  - Node.js 20 for application tests (`npm`)
- Environment variables:
  ```bash
  export ARM_SUBSCRIPTION_ID=<subscription-id>
  export ARM_TENANT_ID=<tenant-id>
  export ARM_CLIENT_ID=<service-principal-or-user>
  export DATADOG_API_KEY=<datadog-api-key>
  export DATADOG_APP_KEY=<datadog-app-key>
  export DATADOG_SITE=datadoghq.com
  export OPENROUTER_API_KEY=<optional-openrouter>
  export AZURE_OPENAI_API_KEY=<optional-azure-openai>
  export AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
  ```

## 🚀 Provision Azure infrastructure

1. Authenticate and select the subscription:
   ```bash
   az login
   az account set --subscription "$ARM_SUBSCRIPTION_ID"
   ```
2. Initialize and apply the OpenTofu stack:
   ```bash
   cd tofu
   tofu init
   tofu apply \
     -var datadog_api_key="$DATADOG_API_KEY" \
     -var datadog_app_key="$DATADOG_APP_KEY" \
     -var datadog_site="$DATADOG_SITE" \
     -var openrouter_api_key="$OPENROUTER_API_KEY" \
     -var azure_openai_api_key="$AZURE_OPENAI_API_KEY" \
     -var azure_openai_endpoint="$AZURE_OPENAI_ENDPOINT"
   ```
   This step provisions:
   - AKS cluster + managed identity
   - PostgreSQL 16 with `pgvector` and Datadog DBM auto-discovery
   - Datadog Agent & Cluster Agent with DBM + APM + DogStatsD
   - VibeCode web app deployment wired to ConfigMap/Secret values (including `DD_LLMOBS_*`).

3. Configure kubeconfig and verify rollouts:
   ```bash
   az aks get-credentials --name $(tofu output -raw aks_name) --resource-group $(tofu output -raw resource_group)
   kubectl get pods -n vibecode
   ```

## 📚 Seed RAG content

Use the Upload API to push workspace documents into PostgreSQL + pgvector (Datadog DBM will pick up metrics immediately):

```bash
curl -X POST \
  -F "workspaceId=lovable-demo" \
  -F "files=@docs/azure/minimal-aci-demo.md" \
  -F "files=@README.md" \
  https://<your-app-host>/api/ai/upload
```

To generate sustained load for dashboards, execute:

```bash
./scripts/generate-vector-activity.sh
```

After ingestion you can validate vector search:
```bash
curl -X POST https://<your-app-host>/api/vector-store \
  -H "Content-Type: application/json" \
  -d '{"query":"How is Datadog monitoring configured?","workspaceId":1,"provider":"pgvector"}'
```

## 🤖 Chat with RAG + LLM Observability

1. Launch the web UI (`npm run dev` locally or open the deployed URL).
2. Set the workspace ID (defaults to `lovable-demo`) and ensure the “RAG Context” switch is enabled.
3. Submit prompts—the UI calls `/api/ai/chat`, which injects pgvector context and wraps the LiteLLM request with `dd-trace` instrumentation.

### Datadog dashboards to watch

- **Database Monitoring → Postgres**: see pgvector extensions, query latency, index size (`postgresql.pgvector.*`).
- **APM → Services → vibecode-webgui**: LLM spans (`llm.workflow.*`, `llm.task.*`, `llm.completion`) tagged with model, workspace, latency. Make sure the web app has `DD_LLMOBS_ENABLED=1`, `DD_LLMOBS_AGENTLESS_ENABLED=1`, `DD_LLMOBS_PROJECT=vibecode-code-server-ai-cli` (and optionally `DD_LLMOBS_ML_APP` for legacy agents) plus the standard Datadog keys set before testing.
- **Logs → Query `service:vibecode-webgui`** for structured RAG + LLM events.
- **Dashboards → VibeCode RAG Overview** (Terraform import): validates DBM + LLM panels after running the seed scripts above.

To smoke test instrumentation end-to-end:

```bash
# Run Playwright smoke suite against production to exercise RAG + LLM requests
BASE_URL=https://vibecode.eastus2.cloudapp.azure.com npm run test:production:smoke

# Trigger Datadog DBM verifier with full checks (no skip flags)
NAMESPACE=vibecode-platform DATADOG_AGENT_NAMESPACE=datadog \
  USE_SECRET_PASSWORD=true bash scripts/verify-datadog-dbm.sh

# Annotate LLM spans via the API demo script
DD_LLMOBS_ENABLED=1 DD_API_KEY=$DATADOG_API_KEY DD_SITE=$DATADOG_SITE \
  node scripts/test-llm-observability-final.js

# Verify spans are flowing
open "https://app.datadoghq.com/apm/service/vibecode-webgui"
open "https://app.datadoghq.com/logs?query=service%3Avibecode-webgui"
```

## 🛠 Maintenance scripts

- `./scripts/validate-database-config.sh` – verifies pgvector + monitoring roles.
- `./scripts/generate-vector-activity.sh` – simulates workload to populate DBM dashboards.
- `./scripts/test-llm-observability-final.js` – smoke test for Datadog LLM Observability export.

## 🧹 Teardown

```bash
cd tofu
tofu destroy
```

Remember to delete the Azure resource group and revoke Datadog API keys if they were created for demo purposes.
