# Azure App Service LLM Observability Demo

This plan shows how to reuse the Microsoft sample [`Azure-Samples/rag-postgres-openai-python`](https://github.com/Azure-Samples/rag-postgres-openai-python) to demo Datadog LLM observability plus Database Monitoring (DBM) on Azure App Service with PostgreSQL `pgvector`.

For a .NET option, you can mirror the same steps with your fork [`ryanmaclean/cosmosdb-chatgpt`](https://github.com/ryanmaclean/cosmosdb-chatgpt) by swapping Cosmos DB for Azure Database for PostgreSQL Flexible Server (`CREATE EXTENSION vector`) and deploying the ASP.NET web app to App Service with the same Datadog configuration (AppSec/IAST + DBM). Keep the runtime upgrades consistent across both samples so you can showcase LLM observability from two language stacks.

## 1. Clone the sample
```bash
cd ~
gh repo clone Azure-Samples/rag-postgres-openai-python
cd rag-postgres-openai-python
```

The sample is a FastAPI + React app that already uses Azure OpenAI and Azure Database for PostgreSQL (with `pgvector`).

## 2. Wire in Datadog APM + IAST

1. Add Datadog to the Python backend:
   ```bash
   python -m pip install ddtrace>=2.8.4
   ```
2. In `src/backend/fastapi_app/main.py`, initialize the tracer before the app object:
   ```python
   from ddtrace import patch_all
   patch_all()
   ```
3. Ensure the App Service (or container) sets:
   ```bash
   DD_SERVICE=rag-postgres-openai
   DD_ENV=demo
   DD_VERSION=1.0.0
   DD_APPSEC_ENABLED=true
   DD_IAST_ENABLED=true
   DD_LOGS_INJECTION=true
   ```
4. Install the Datadog App Service extension (or run the agent as a sidecar) so traces/logs flow to Datadog.
5. Use the helper script in this repo to set the correct App Service settings:
   ```bash
   ./scripts/configure-datadog-appservice.sh \
     --resource-group <rg> \
     --app-name <app-service> \
     --service rag-postgres-openai \
     --env demo \
     --version 1.0.0
   ```
   Add `--dry-run` to preview the `az webapp config appsettings set` commands.

## 3. Enable PostgreSQL DBM

1. Provision Datadog agent with the Postgres integration enabled:
   ```yaml
   instances:
     - host: <POSTGRES_HOST>
       port: 5432
       username: datadog
       password: <DD_POSTGRES_PASSWORD>
       dbname: postgres
       dbm: true
   ```
2. The sample already creates the `vector` extension; grant the `datadog` user access to the target databases:
   ```sql
   CREATE USER datadog WITH PASSWORD '<DD_POSTGRES_PASSWORD>';
   GRANT pg_read_all_stats TO datadog;
   ```
3. Import the existing dashboards from this repo (`datadog-dashboard-embedding-metrics.json`, etc.) to highlight vector query performance and LLM latency.

## 4. Deploy to Azure App Service

1. Use the sample’s Terraform/Bicep (`infra/`) or run:
   ```bash
   azd auth login
   azd env new
   azd up
   ```
2. Once deployed, configure App Service to inject the Datadog env vars above plus your actual Datadog API/app keys.
3. Generate traffic (chat prompts) to populate Datadog traces, AppSec findings, and DBM dashboards.

## 5. Demo Flow

1. Walk through the chat UI answering domain questions.
2. Open Datadog APM to show FastAPI traces with LLM metadata, AppSec/IAST findings, and logs.
3. Show DBM (Postgres) dashboards for vector query latency, ivfflat stats, and connections.
4. Optionally, run the provided Locust script (`locustfile.py`) to simulate load and show metrics.

This gives you a quick reusable blueprint to demo Datadog LLM observability + DBM on an Azure App Service backed by Azure Postgres `pgvector` and Azure OpenAI.
