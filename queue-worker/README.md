# VibeCode Queue Worker

Queue-triggered Azure Functions project that processes PDF uploads. The worker downloads PDFs from blob storage, extracts text, generates embeddings via Azure OpenAI, and writes chunks to PostgreSQL Flexible Server.

## Quick Start

```bash
cd queue-worker
npm install
cp local.settings.json.example local.settings.json
# Update secrets (Storage connection string, DATABASE_URL, OpenAI key)
npm run build
func start
```

## Deployment

```bash
npm install
npm run build
FUNCTION_APP_NAME=vibecode-worker func azure functionapp publish $FUNCTION_APP_NAME
```

Set the following App Settings in the Function App:

- `STORAGE_ACCOUNT_CONNECTION`
- `STORAGE_UPLOADS_CONTAINER`
- `STORAGE_QUEUE_NAME`
- `DATABASE_URL`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_EMBEDDING`

## Next Steps

- Implement PDF parsing + chunking
- Generate embeddings and persist to Postgres
- Emit Application Insights telemetry and update `rag_ingest_jobs`
