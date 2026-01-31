# RAG Pipeline Architecture Review — 2026-01-22

## Scope
Worklog for bead `st-2zt`. Focused on the Retrieval-Augmented Generation (RAG) system that powers workspace-aware chat/search inside VibeCode.

---

## 1. Current Architecture Snapshot

### 1.1 Ingestion Entry Points
- **Generic upload route is still a stub** — `src/app/api/ai/upload/route.ts:71-188` only validates files and returns early with a comment that "in a real implementation" it should persist data. Nothing in the app calls into chunking, embeddings, or queueing from this path.
- **PDF ingestion is wired** — `src/app/api/uploads/pdf/route.ts:14-198` streams PDFs to Blob storage, registers rows in `uploads`/`rag_ingest_jobs`, and pushes Azure Storage Queue messages. The worker at `infrastructure/queue-worker/src/functions/pdfIngest/index.ts:1-233` consumes those jobs, generates embeddings with Azure OpenAI, and inserts rows into `rag_chunks`.
- **Workspace sync does not emit embeddings** — `src/app/api/files/sync/route.ts:17` imports `vectorStore` but never calls it, so project imports or live edits do not push chunks.
- **Schema support exists** — `prisma/schema.prisma:187-210` defines `rag_ingest_jobs`, but no REST endpoint exposes job status (`/api/uploads/status` is only mentioned in docs).

### 1.2 Storage & Embedding Stack
- Multiple overlapping implementations manage embeddings:
  - Legacy `ragSystem` (`src/lib/rag/index.ts:22-216`) orchestrates Valkey cache + a bespoke vector store but is only referenced in tests.
  - The API uses `src/lib/vector-store.ts:1-320` directly, performing chunk deletes and raw SQL inserts with Prisma.
  - A newer abstraction lives under `src/lib/vector-db/vector-store-service.ts:1-120` and adapter stack in `src/lib/vector-db/*`, but production routes do not consume it yet.
  - Yet another adapter-centric module exists in `src/lib/vector/vector-store.ts:1-120` for MCP tooling.
- `rag_chunks` remains the canonical table (see `prisma/schema.prisma:129-186`). `document_embeddings` is referenced in docs but not actively written by current code.

### 1.3 Retrieval & Context Construction
- All chat/search routes (`src/app/api/ai/chat/enhanced/route.ts:74-177`, `src/app/api/ai/chat/unified/route.ts:40-178`, `src/app/api/ai/chat/stream/route.ts:45-118`, `src/app/api/ai/search/route.ts:59-131`) call `vectorStore.getContext`/`vectorStore.search` from the legacy module. Each route rolls its own `build*RAGContext` helper instead of sharing logic.
- No single service tracks which workspace/project/file produced a chunk across ingestion types; metadata is partially stored per chunk.

### 1.4 Caching, Resilience & Infra
- A full Valkey cache implementation exists (`src/lib/rag/cache.ts:1-200`), but nothing in production code calls it because `ragSystem` is unused.
- The supposed query cache front-end (`src/lib/cache/pgvector-search.ts:1-78`) is a mock that always returns `[]`, so the `PgVectorSearch` shim never accelerates lookups.
- The manually written SQL search in `src/lib/vector-store.ts:203-320` runs per request with no circuit breakers or telemetry around retries.

### 1.5 Observability & Tooling
- Datadog database monitoring (`src/lib/datadog-database.ts:1-209`) samples `rag_chunks` counts and pgvector index size but does not ingest per-request timings or ingestion lag.
- Verification scripts (`scripts/verify-rag-functionality.ts:11-146`) still exercise the legacy vector store API, so CI smoke tests cannot see failures in the adapter-based service.
- Documentation such as `docs/MCP_RAG_MEMORY_SYSTEMS.md:1-120` still references the deprecated `src/lib/rag/*` stack, so onboarding material is misaligned with reality.

---

## 2. Key Gaps & Risks
1. **Competing vector-store implementations** — The app currently ships four different vector store facades (`src/lib/rag`, `src/lib/vector-store.ts`, `src/lib/vector/vector-store.ts`, `src/lib/vector-db/vector-store-service.ts`). Only one is used in runtime routes, making it impossible to enforce cross-cutting concerns (retry policies, telemetry, caching) consistently.
2. **Partial ingestion story** — PDF uploads go through the Azure queue, but all other user flows (workspace sync, manual file upload, CLI ingesters) still call stub code or scripts. As long as `src/app/api/ai/upload/route.ts` is a no-op, engineers will assume ingestion succeeded while nothing was indexed.
3. **Caching is designed but not wired** — The Valkey cache (`src/lib/rag/cache.ts`) and vector cache strategy (`src/lib/cache/vector-cache-strategy.ts`) never execute because production queries bypass them. `PgVectorSearch` is a stub, so every chat/search request hammers Postgres directly.
4. **Context builders are duplicated** — Three different endpoints assemble RAG context with slightly different thresholds, and none share truncation/token-budget logic. Changing ranking rules requires touching four files.
5. **Observability holes** — Datadog only sees total rows/bytes. There are no spans for ingestion latency, queue backlog, vector search duration, or cache hit rates, so regressions in pgvector queries or Azure queue throughput cannot be detected early.
6. **Docs and tests out of sync** — Docs point new contributors to the unused `ragSystem`, and smoke tests call the same legacy API, so regressions in the newer adapter layer would go unnoticed until runtime.
7. **Missing status APIs** — Users cannot poll job status because `/api/uploads/status` was never implemented, even though the queue worker updates `rag_ingest_jobs`.

---

## 3. Recommendations

### 0–2 Weeks (Stabilize & Align)
1. **Pick a canonical vector-store service** — Promote `src/lib/vector-db/vector-store-service.ts` (adapter + retry layers) as the single export. Update chat/search/upload routes to consume it, then deprecate `src/lib/vector-store.ts` and `src/lib/rag/*`. This also unlocks centralized retries/metrics.
2. **Finish ingestion UX** — Implement `/api/uploads/status` backed by `rag_ingest_jobs` and expose queue job IDs in the UI. Either enhance `src/app/api/ai/upload/route.ts` to reuse the PDF pipeline (for non-PDF text/code files) or remove it entirely to avoid confusion.
3. **Wire real caching** — Replace the `PgVectorSearch` placeholder with an implementation that actually queries pgvector or uses `VectorCacheManager`. Until then, disable the stub to avoid false expectations.
4. **Centralize context building** — Extract a `@/lib/rag/context-builder.ts` that encapsulates capped multi-threshold searches + token budgeting, so `enhanced`, `unified`, `stream`, and `/api/ai/search` can call the same function.
5. **Instrument ingestion/search latency** — Wrap `vectorStore.search`/`storeChunks` and the Azure queue worker with Datadog spans and emit metrics for chunk counts, query latency, cache hit rate, and queue backlog. Feed these into the existing `datadog-database` pipeline.

### 2–4 Weeks (Scale & Harden)
6. **Unify ingestion orchestration** — Add a background job or worker that listens to workspace file events (from `src/lib/file-sync`) and enqueues chunking jobs instead of attempting to do it inline. Reuse the queue worker logic for PDFs so every ingestion path flows through the same telemetry + retry surface.
7. **Add failure recovery** — Teach the queue worker to retry transient Azure/OpenAI/Postgres errors with backoff and to flag poison jobs via a secondary queue. Surface job errors through the status endpoint so the UI can prompt for user action.
8. **Backfill documentation & scripts** — Update onboarding docs (`docs/MCP_RAG_MEMORY_SYSTEMS.md`, `docs/POSTGRESQL_PGVECTOR_SETUP.md`) and the verification script to reference the canonical service. Remove guidance that points to `ragSystem`.

### 4+ Weeks (Evolve)
9. **Sharding & multi-provider support** — Once the adapter is canonical, start introducing the provider selection/sharding logic already prototyped under `src/lib/vector-stores/enhanced-vector-store.ts`. This enables routing to dedicated pgvector clusters or hybrid stores without invasive app changes.
10. **Bring cache + embeddings closer to workloads** — Investigate Valkey co-location or pgvector HNSW tuning per workspace. Add scheduled jobs (or triggers) to rebuild indexes using `vectorStore.rebuildIndex()` semantics that currently only exist in the unused `ragSystem`.
11. **Broaden telemetry KPIs** — Track ingestion duration per file type, queue lag, vector-search P99, and cache efficacy. Use these metrics to drive autoscaling policies for Azure Functions/AKS workers.

---

## 4. Suggested Follow-ups & Metrics
- Expose `rag_ingest_jobs.status/requested_at/completed_at` via API and Grafana/Dashboard for ops.
- Add automated smoke tests that upload a doc via `/api/uploads/pdf`, wait for queue completion, and verify `vectorStore.search` returns new context.
- Publish weekly RAG health snapshots (chunk counts, ingestion failures, cache hit rates) so future beads can focus on concrete regressions.
- Document failure runbooks for the queue worker (e.g., how to drain poison queue, reprocess uploads, rotate Azure credentials).

---

Prepared by: Codex (polecat role)
Date: 2026-01-22
