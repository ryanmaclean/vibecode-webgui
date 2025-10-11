---
title: External Service Requirements
description: Auto-generated placeholder. Update as needed.
---

# External Service Requirements for Integration Suites

This guide enumerates the integration and monitoring suites that require live infrastructure. Use it when planning a local run, configuring CI, or deciding which suites to skip. Unless the toggles listed below are enabled, the tests default to `describe.skip` or early-return so you will not accidentally hit live services.

## Quick Reference

| Service / Stack | Dependent Test Suites | Toggle Flags | Required Environment Variables | Local Setup Notes |
| --- | --- | --- | --- | --- |
| Datadog API (metrics, events, Toto) | `tests/integration/datadog-real.test.ts`, `tests/integration/datadog-toto.test.ts`, `tests/integration/real-datadog-integration.test.ts`, `tests/integration/real-monitoring-integration.test.ts` | `ENABLE_DATADOG_INTEGRATION_TESTS=true`, `ENABLE_DATADOG_TESTS=true`, `ENABLE_REAL_DATADOG_TESTS=true`, `ENABLE_REAL_MONITORING_TESTS=true` | `DD_API_KEY`, `DD_APP_KEY` (Toto), optional `DD_SITE` / `DATADOG_SITE` | Use a dedicated Datadog test key; requests are sent to `https://api.<site>`. Ensure rate limits allow multiple writes per run. |
| PostgreSQL + pgvector (Prisma) | `tests/integration/real-database-operations.test.ts`, `tests/integration/feature-flag-persistence.test.ts`, `tests/integration/vector-db-postgres.test.ts`, `tests/integration/cache-pgvector-integration.test.ts`, `tests/integration/vector-search-rag-real.test.ts`, `tests/integration/ai-chat-rag-real.test.ts` | `ENABLE_REAL_DATABASE_TESTS=true` (where present) and/or `ENABLE_REAL_AI_TESTS=true` | `DATABASE_URL` (Prisma), `TEST_POSTGRES_CONNECTION_STRING` or granular `TEST_DB_*` overrides | Use the docker-compose Postgres + pgvector service or point to a disposable branch database. Grant vector extension access; tests create and destroy collections. |
| Redis / Valkey cache | `tests/integration/cache-redis-backend.test.ts`, `tests/integration/real-monitoring-integration.test.ts` | none (auto-detect) | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` or consolidated `REDIS_URL` | Tests will attempt a live connection and fall back to mocks when unavailable. For deterministic results, run `npm run dev:docker` to start Valkey before executing. |
| MongoDB (chat persistence) | `tests/integration/chat-ui-mongodb.test.ts` | none | `MONGODB_TEST_URL` (defaults to `mongodb://localhost:27017/chatui_test`) | Spin up MongoDB locally or via Docker. Tests create temporary collections and clean up automatically. |
| AI Providers via OpenRouter / Anthropic | `tests/integration/real-openrouter-integration.test.ts`, `tests/integration/ai-chat-rag-real.test.ts`, `tests/integration/vector-search-rag-real.test.ts`, `tests/integration/enhanced-terminal-integration.test.ts` | `ENABLE_REAL_AI_TESTS=true`, `ENABLE_AI_INTEGRATION_TESTS=true` | `OPENROUTER_API_KEY`, optional `ANTHROPIC_API_KEY` for Claude CLI scenario | Expect real billing events. Configure `HTTP-Referer` allowlist in OpenRouter. Provide database access too for RAG flows. |
| Kubernetes / KIND docs stack | `tests/integration/docs-kind-integration.test.ts` | Auto-detected via `describeWithInfrastructure` | kubeconfig with `kubectl`, KIND cluster running `vibecode-docs` chart, Helm dependencies installed | Ensure the `vibecode` namespace is deployed and port-forwardable before running. Tests spawn port-forwarders and expect core resources (`svc`, `hpa`) to exist. |

## Service Details

### Datadog API
- **Suites**: `datadog-real`, `datadog-toto`, `real-datadog-integration`, `real-monitoring-integration`
- **Credentials**: 32-character API key (`DD_API_KEY`), application key (`DD_APP_KEY`) when Toto telemetry is enabled.
- **Site**: Defaults to `datadoghq.com`. Override with `DD_SITE` or `DATADOG_SITE` for EU/US3.
- **Toggle strategy**: Only enable the smallest flag set needed. The "real" suites make write calls (`/series`, `/events`, `/check_run`), so prefer sandbox accounts.

### PostgreSQL & pgvector
- **Suites**: Database health (`real-database-operations`), feature flags, cache invalidation + pgvector, and both RAG suites.
- **Configuration**: Provide either a single `DATABASE_URL` (used by Prisma + vector store) or a dedicated `TEST_POSTGRES_CONNECTION_STRING` when running adapter-only tests. `cache-pgvector-integration` allows granular host/port overrides.
- **Local recipe**: `docker-compose.pgvector.yml` exposes a ready instance. Load `setup-document-embeddings.sql` if you need sample data.
- **Cleanup**: RAG suites insert workspaces/files and delete them during teardown; use an isolated database when experimenting.

### Redis / Valkey
- **Suites**: Cache invalidation integration and monitoring health checks.
- **Availability check**: `cache-redis-backend` pings the instance and swaps to mocks if it cannot connect. Running Valkey ensures we actually exercise eviction and TTL logic.
- **Local recipe**: `docker-compose.dev.yml` already provisions Valkey on port 6380; export `REDIS_HOST=localhost` and `REDIS_PORT=6380`.

### MongoDB
- **Suite**: `chat-ui-mongodb.test.ts` exercises the real chat persistence path.
- **Defaults**: Falls back to `mongodb://localhost:27017/chatui_test`. Override `MONGODB_TEST_URL` to reuse an existing cluster.
- **Local recipe**: `docker compose -f docker-compose.dev.yml up mongodb` gives a disposable test instance.

### AI Providers
- **Suites**: Real OpenRouter connectivity, AI chat with RAG, vector search RAG, and the enhanced terminal when Claude integration is enabled.
- **Toggles**: Set `ENABLE_REAL_AI_TESTS=true` to opt into OpenRouter-backed suites. The terminal checks `ENABLE_AI_INTEGRATION_TESTS` separately.
- **Keys**: `OPENROUTER_API_KEY` is mandatory; optionally supply `ANTHROPIC_API_KEY` to verify Claude CLI streaming inside the terminal tests.
- **Supporting services**: The RAG suites also require `DATABASE_URL` so Prisma can persist workspaces/files before querying embeddings.

### Kubernetes / KIND
- **Suite**: `docs-kind-integration.test.ts` validates the documentation stack deployed into a cluster.
- **Prerequisites**: KIND cluster with the docs Helm chart installed, `kubectl` + `helm` on PATH, and the `vibecode` namespace ready. The helper `describeWithInfrastructure` skips automatically when probes fail.
- **Usage**: Run `./scripts/dev-kind.sh` (see `simple-kind-cluster.yaml`) or attach to an existing dev cluster. Tests call `kubectl port-forward`, so ensure you have permissions.

## Running Selected Suites Locally

1. Start the needed services (e.g. `docker compose -f docker-compose.pgvector.yml up postgres`, `docker compose -f docker-compose.dev.yml up redis mongodb`).
2. Export the required environment variables.
3. Enable only the toggles you intend to exercise (e.g. `ENABLE_REAL_AI_TESTS=true npm run test -- tests/integration/ai-chat-rag-real.test.ts`).
4. After the run, reset or unset the flags to avoid hitting live services unintentionally.

Keeping this matrix up to date ensures we can reason about the "Broader integration test failures" item and quickly determine which failures stem from missing infrastructure versus product bugs.
