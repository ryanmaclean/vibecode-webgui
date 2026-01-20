# Database Query Performance Audit — 2026-01-20

## Scope
- Chat conversation search (`ConversationSearchOptions.searchTerm` and `MessageSearchOptions.searchTerm`)
- RAG fallback text search used when pgvector similarity fails

Synthetic datasets were generated locally to profile the worst offenders:

```bash
# seeds ~1k conversations + 40k messages
DATABASE_URL=postgresql://... node scripts/profile-chat-data.js
# seeds 50k rag_chunks rows for fallback tests
DATABASE_URL=postgresql://... node scripts/seed-rag-chunks.js
```

## Profiling Highlights

| Query | Before (Seq Scan simulated via `SET enable_*scan=off`) | After (GIN + pg_trgm) |
| --- | --- | --- |
| `SELECT id FROM messages WHERE content ILIKE '%insights 7%'` | 44.29 ms, 40k rows scanned | 0.11 ms, bitmap index scan via `messages_content_trgm_idx` |
| `SELECT id FROM rag_chunks WHERE workspace_id = ... AND content ILIKE '%vector search insights 7%'` | 55.58 ms, 50k rows scanned | 6.36 ms, bitmap index scan via `rag_chunks_content_trgm_idx` |

Notes:
- The chat search API can run several of these filters per request because it checks both `conversation.title` and matching `messages`. Without an index the DB must scan every message for each search term.
- The RAG fallback query is triggered whenever pgvector search fails (cold start, no embeddings, or disabled provider). At real scale (> millions of rows) the sequential scan becomes a multi-second operation.

`EXPLAIN ANALYZE` snippets are stored below for future comparisons.

<details>
<summary>Chat message search (after)</summary>

```
Bitmap Heap Scan on messages
  -> Bitmap Index Scan on messages_content_trgm_idx
Planning Time: 0.77 ms  Execution Time: 0.11 ms
```
</details>

<details>
<summary>RAG fallback search (after)</summary>

```
Bitmap Heap Scan on rag_chunks
  -> Bitmap Index Scan on rag_chunks_content_trgm_idx
Planning Time: 1.03 ms  Execution Time: 6.36 ms
```
</details>

## Changes Implemented
1. **Text-search indexes** (see `prisma/migrations/20260120090000_text_search_indexes/migration.sql`)
   - Enabled `pg_trgm` extension (idempotent) for trigram operations
   - Added GIN trigram indexes on `conversations.title`, `messages.content`, and `rag_chunks.content`
2. **Repeatable profiling scripts** (`scripts/profile-chat-data.js`, `scripts/seed-rag-chunks.js`)
   - Quickly seeds synthetic data required to reproduce the bottlenecks on any environment

## Follow-up / Monitoring
- Attach these datasets to CI perf jobs or Datadog DBM synthetic monitors once we have a staging DB with >1M rows.
- If we need even faster regex-style search, consider pg_trgm similarity operators (`%`, `<->`) together with ranking to reduce application-side filtering.
