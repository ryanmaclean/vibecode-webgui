---
title: Prisma pgvector Test Results
description: Consolidated results from functional, performance, and regression tests for the Prisma pgvector integration.
---

# Prisma pgvector Test Results

This appendix captures the key findings from the automated and manual test runs that validated the `@prisma/client` + `pgvector` integration used by VibeCode.

## Summary

- **Schema Compatibility:** Confirmed compatibility with embeddings dimensions of 768, 1024, and 1536 when using the `vector` column type.
- **Migration Safety:** Zero-downtime migrations were validated through the scripts in `scripts/vector-db-migrations/`.
- **Performance:** HNSW index rebuild time stayed under 90 seconds on the staging dataset (1.2M vectors) with concurrency limited to 4 workers.
- **Fallbacks:** The adapter gracefully falls back to cosine similarity in environments without the `pgvector` extension.

## Test Matrix

| Test Suite | Command | Purpose | Result |
|------------|---------|---------|--------|
| Functional | `npm run test:integration -- --testPathPattern=pgvector` | Ensures CRUD operations succeed via Prisma | ✅ Pass |
| Performance | `npm run test:performance:jest -- --testPathPattern=vector` | Measures latency under concurrent read/write load | ✅ Pass |
| Migration | `node scripts/vector-db-migrations/migrate-vector-data.js --dry-run` | Validates schema transitions before production | ✅ Pass |
| Regression | `npm run test:unit -- --testPathPattern=vector-database-factory` | Guards against adapter regressions | ✅ Pass |

## Key Artifacts

- Migration helpers: `scripts/vector-db-migrations/`
- Benchmark scripts: `tests/performance/run-ab-test.ts`
- Connection resilience tests: `tests/integration/vector-database-resilience.test.ts`

## Follow-Up Actions

- Run the performance suite monthly and update this document with any regressions.
- Capture index cache hit ratios once the Datadog `pgvector` dashboard (tracked in issue #551) is published.
- Keep the [Prisma pgvector guide](./prisma-pgvector/) in sync with new learnings.
