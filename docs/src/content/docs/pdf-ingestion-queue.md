---
title: pdf ingestion queue
description: Shared PDF ingestion workflow for App Service and AKS deployments
---

# Queue-Based PDF Ingestion Blueprint

## 🎯 Goal
Provide a deployment-agnostic ingestion pipeline that works for both Azure App Service and AKS deployments. Users upload PDFs, the system enqueues processing jobs, and a background worker extracts text, generates embeddings with Azure OpenAI, and stores RAG chunks in PostgreSQL.

## 🔁 High-Level Flow

1. **Upload** (Next.js API)
   - Endpoint: `POST /api/uploads/pdf`
   - Accepts multipart form with `file` (PDF) and optional metadata (projectId, labels).
   - Streams the file to Azure Blob Storage under `uploads/{jobId}.pdf` (chunked upload via `@azure/storage-blob`).
   - Writes a message to Azure Storage Queue `pdf-processing` describing the job.
   - Returns `202 Accepted` with `jobId` and status URL for polling (`/api/uploads/status?jobId=...`).

2. **Queue Processing** (Azure Function / Kubernetes worker)
   - Trigger: Storage Queue message
   - Downloads the PDF blob, extracts text (e.g., `pdf-parse` or `pdf-lib` with fallback to OCR later).
   - Chunks text (token-aware splitter, 750-token chunks with 150 overlap).
   - Calls Azure OpenAI embeddings (`text-embedding-3-large`).
   - Writes chunks to `rag_chunks` (or `ai_embeddings`) in PostgreSQL Flexible Server/AKS Postgres.
   - Updates `rag_ingest_jobs` status (queued → processing → completed/failed) with timestamps and counts.
   - Emits Application Insights traces + custom metrics (`pdf.ingest.duration`, `pdf.ingest.chunks`).

3. **Completion**
   - Frontend polls `/api/uploads/status` to display progress and number of chunks stored.
   - Errors bubble through `rag_ingest_jobs.error` field and queue poison-handling (message moved to poison queue after 5 retries).

## 📦 Queue Message Schema

```json
{
  "jobId": "uuid",
  "blobUrl": "https://storage.blob.core.windows.net/uploads/<jobId>.pdf",
  "fileName": "design-doc.pdf",
  "uploader": {
    "userId": "clerk_123",
    "workspaceId": "ws_456"
  },
  "options": {
    "projectId": "proj_789",
    "source": "manual-upload"
  },
  "requestedAt": "2025-09-20T22:45:12.000Z"
}
```

## 🔐 Environment Variables

| Variable | App Service | Function App | Description |
|----------|-------------|--------------|-------------|
| `STORAGE_ACCOUNT_CONNECTION` | ✅ | ✅ | Blob/Queue connection string or MSI endpoint |
| `STORAGE_UPLOADS_CONTAINER` | ✅ | ✅ | Container name (`uploads`) |
| `STORAGE_QUEUE_NAME` | ✅ | ✅ | Queue name (`pdf-processing`) |
| `DATABASE_URL` | ✅ | ✅ | Postgres Flexible connection string with sslmode=require |
| `AZURE_OPENAI_ENDPOINT` | ✅ | ✅ | Cognitive account endpoint |
| `AZURE_OPENAI_API_KEY` | ✅ | ✅ | Access key (use Key Vault references when available) |
| `AZURE_OPENAI_DEPLOYMENT_EMBEDDING` | ✅ | ✅ | Embedding deployment name (`text-embedding-3-large`) |
| `CHUNK_SIZE_TOKENS` | Optional | ✅ | Override default chunk size |
| `CHUNK_OVERLAP_TOKENS` | Optional | ✅ | Override default overlap |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | ✅ | ✅ | Linked Application Insights key |

## 🗂️ Database Touch Points

Tables needed (existing schema):

- `rag_chunks` (`chunk_id`, `file_id`, `content`, `embedding`, `metadata`, `created_at`).
- `rag_files` (`id`, `original_name`, `storage_path`, `size_bytes`, `uploaded_by`).
- `rag_ingest_jobs` (new):
  ```sql
  CREATE TABLE IF NOT EXISTS rag_ingest_jobs (
    job_id uuid PRIMARY KEY,
    file_id uuid REFERENCES rag_files(id),
    status text CHECK (status IN ('queued','processing','completed','failed')),
    chunk_count integer DEFAULT 0,
    error text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  ```

## 🔧 Implementation Tasks

1. **API Route (`src/app/api/uploads/pdf/route.ts`)**
   - Validate PDF MIME type, size (< 25 MB initially).
   - Stream to Blob via `BlockBlobClient.uploadStream`.
   - Insert row into `rag_files` + `rag_ingest_jobs` (status `queued`).
   - Send queue message using `QueueClient` with 5-minute visibility timeout.

2. **Queue Worker (Azure Function)**
   - Project scaffolding: `queue-worker/` with `Azure Functions Core Tools` TypeScript.
   - Use `@azure/storage-blob` to download PDF.
   - Extract text: prefer `pdf-parse` (Node) or optional `Azure Form Recognizer` fallback.
   - Chunk with `langchain/text_splitter` or custom token-aware splitter using tiktoken.
   - Embeddings: call Azure OpenAI using `@azure/openai` SDK.
   - Write to Postgres using `pg` driver with pooled connections.
   - Update job status + metrics; handle retries with exponential backoff.

3. **Shared Utilities**
   - `src/lib/azure/storage.ts` for Blob/Queue clients (MSI-aware).
   - `src/lib/rag/ingest.ts` for chunking + DB insertion helpers (shared between Function and optional CLI scripts).
   - Telemetry helpers to send logs/metrics consistently (App Insights or Datadog).

4. **Testing**
   - Unit tests mocking storage/OpenAI/DB.
   - Integration test using Azurite (storage emulator) + local Postgres (Docker) with `npm run test:integration:pdf`.
   - Load test: ingest 20 PDFs concurrently; target < 2 minutes per 10MB file.

5. **Deployment Notes**
   - App Service: Configure zip deploy Action after `npm run build`.
   - Function App: Publish from `queue-worker` folder using `func azure functionapp publish` or GitHub Action.
   - AKS path: package the worker as a Kubernetes Job/Deployment using the same code (Dockerfile) and connect to Storage Queue.

## 🚨 Failure Modes & Mitigations

| Scenario | Symptom | Mitigation |
|----------|---------|------------|
| Queue backlog | Messages > 10k, ingestion delayed | Enable queue length alerts, add concurrency scaling (Functions scale-out, AKS worker HPA) |
| PDF parsing failure | Job marked `failed` with parse error | Move message to poison queue, notify uploader, allow retry via UI |
| OpenAI throttling | Embedding calls return 429 | Exponential backoff, reduce chunk concurrency, consider rate-limiting on upload API |
| Postgres errors | `rag_chunks` insert fails | Wrap in transaction, retry with jitter, log to App Insights |
| Storage auth issues | 403 on blob/queue operations | Use managed identity for App Service/Functions; rotate secrets in Key Vault |

## ✅ Deliverables for Engineers

- Update TODO priority item #3 once the API + worker are implemented.
- Provide sample `.env.appservice` and `.env.function` entries in `docs/src/content/docs/azure-appservice-migration.md`.
- Record manual verification steps (upload → chunks → search) in the deployment runbook.

---

**Next**: implement the API route and Azure Function, then wire CI/CD to deploy both App Service and queue worker artifacts.
