# Progress Log

## 2025-09-20
- Documented queue-based PDF ingestion workflow (`docs/src/content/docs/pdf-ingestion-queue.md`).
- Added new App Service OpenTofu scaffolding and storage helpers.
- Implemented `/api/uploads/pdf` route to stream PDFs to Azure Blob Storage and enqueue ingestion jobs.
- Scaffolded `queue-worker/` Azure Functions project for asynchronous PDF processing.
- Added Prisma model & migration for `rag_ingest_jobs`, persisted uploads + job metadata from API route, and implemented queue worker logic to parse PDFs, generate embeddings with Azure OpenAI, and store chunks in `rag_chunks`.
- Attempted AKS redeploy; PostgreSQL statefulset is healthy and `vibecode-app` pods schedule but crash with `exec format error` due to the ACR image `vibecodecr6c3db0e6.azurecr.io/vibecode-webgui:latest` being built for arm64 only. Upload secrets seeded with temporary placeholders.
- AKS cluster `vibecode-prod-aks-6c3db0e6` brought online (system/user pools Ready); core add-ons (Ingress, Datadog agents) verified.

## 2025-09-21
- Ingested all repository documentation into Azure Flexible Postgres using OpenAI embeddings (`text-embedding-3-small`), bringing `document_embeddings` to 2,311 documents representing 3,036 chunks.
- Added `scripts/run-rag-verification.ts` to execute RAG verification under Datadog tracing (`ddtrace-run`) and validated retrieval for Datadog LLM observability and Azure App Service migration prompts.
- Confirmed RAG health with `scripts/verify-rag-functionality.ts`, capturing spans under `service:vibecode-rag-ingest` to provide APM visibility for non-production CLI runs.
