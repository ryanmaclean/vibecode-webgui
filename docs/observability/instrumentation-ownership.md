# Instrumentation Ownership: OpenTelemetry vs Datadog APIs

This document defines which instrumentation API to use and when, resolving the
overlap between `@vercel/otel` (removed), the OpenTelemetry SDK, and `dd-trace`
in this repository.

---

## TL;DR

| Layer | Library | Owner | When to use |
|-------|---------|-------|-------------|
| **Server-side tracing (primary)** | `dd-trace` | Platform team | All Node.js server code, API routes, background jobs |
| **OTel auto-instrumentation (optional)** | `@opentelemetry/*` | Platform team | Additional span enrichment, OTLP export to non-Datadog backends, local Jaeger/Tempo |
| **Browser RUM** | `@datadog/browser-logs` | Platform team | Client-side log collection |
| **CI telemetry** | `@datadog/datadog-ci` | Platform team | Test result and coverage uploads to Datadog |
| **Vercel OTel** | ~~`@vercel/otel`~~ **removed** | — | Was a thin wrapper for Vercel deployments; not used (project deploys to Docker/Kubernetes/Azure) |

---

## Architecture

```
Next.js API route / background job
        │
        ├── dd-trace (primary tracer)
        │     ├── Automatic instrumentation: HTTP, Prisma, Express, Redis/Valkey
        │     ├── Manual spans: tracer.startSpan() / tracer.trace()
        │     └── Unified service tagging: DD_SERVICE, DD_ENV, DD_VERSION
        │
        └── OpenTelemetry SDK (optional, additive)
              ├── Only enabled when OTEL_ENABLED=true
              ├── Exports via OTLP → OTEL Collector → Datadog Agent or Jaeger
              └── Does NOT replace dd-trace; runs alongside it
```

---

## Entry Point

Instrumentation is bootstrapped from **two files** that Next.js loads automatically:

| File | Purpose |
|------|---------|
| `instrumentation.ts` (root) | Next.js `register()` hook; guards build/edge/Playwright bypasses, then delegates to `src/instrument.ts` |
| `src/instrumentation.ts` | Registers dd-trace for Node.js runtime; conditionally registers OTel SDK |

Do **not** add a third instrumentation entry point. All initialization must flow through these two files.

---

## When to Use dd-trace

Use `dd-trace` for **all production tracing** in this repository:

```typescript
// Automatic: dd-trace hooks into Node.js http, Prisma, etc. automatically
// Manual span example:
import tracer from 'dd-trace';

const span = tracer.startSpan('my.operation', { childOf: tracer.scope().active() });
try {
  // ... work ...
} finally {
  span.finish();
}
```

**Always** configure dd-trace via environment variables:

```bash
DD_SERVICE=vibecode-webgui
DD_ENV=production
DD_VERSION=<semver>
DD_API_KEY=<secret>
```

---

## When to Use OpenTelemetry SDK

Use the `@opentelemetry/*` packages **only** when:

1. You need to export traces to a **non-Datadog backend** (e.g., local Jaeger for debugging, Grafana Tempo).
2. You are adding **custom metrics** using the OTel Metrics API and exporting via Prometheus (`@opentelemetry/exporter-prometheus`).
3. The code runs in a context where `dd-trace` is unavailable (e.g., edge runtime, browser).

Enable OTel alongside dd-trace:

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=vibecode-webgui
```

> **Note**: Running both dd-trace and OTel SDK simultaneously is safe. dd-trace propagates W3C Trace Context headers, so spans from both systems correlate correctly in Datadog.

---

## What was Removed and Why

### `@vercel/otel`

`@vercel/otel` was a thin convenience wrapper for bootstrapping OpenTelemetry on
the [Vercel platform](https://vercel.com/docs/observability/otel-overview). It was
present in `src/instrumentation.ts` but **VibeCode does not deploy to Vercel** — the
primary deployment targets are Docker/Kubernetes and Azure (see
`config/platforms/` and `platforms/azure/`). The Vercel configuration in the
repository is archived (`archive/root-cleanup/vercel.json`).

Removing `@vercel/otel` from `dependencies`:
- Eliminates an unused transitive dependency tree from the lockfile.
- Removes ambiguity about whether Vercel is a supported deployment target.
- Consolidates OTel bootstrapping into the raw `@opentelemetry/*` SDK, which is
  already present and framework-agnostic.

---

## Datadog Browser Instrumentation

For **client-side** instrumentation use `@datadog/browser-logs` (already in
`dependencies`). The full RUM SDK (`@datadog/browser-rum`) is a devDependency
used for testing and local sampling. Do not add client-side OTel unless there
is a specific requirement to export browser spans to a non-Datadog backend.

---

## Adding New Instrumentation

1. **New server-side span** → Use `dd-trace` manual API (`tracer.startSpan`).
2. **New custom metric** → Use OTel Metrics API + Prometheus exporter, or Datadog
   StatsD (`DD_DOGSTATSD_PORT`).
3. **New deployment target** → If the target requires a different OTel SDK setup,
   add an entry-point under `platforms/<target>/` and document it here.
4. **Never** call `dd-trace.init()` more than once; initialization is centralized
   in `src/instrumentation.ts`.

---

## References

- [dd-trace Node.js docs](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/)
- [OpenTelemetry Node.js SDK](https://opentelemetry.io/docs/instrumentation/js/)
- [`src/instrumentation.ts`](../../src/instrumentation.ts) — OTel + dd-trace init
- [`instrumentation.ts`](../../instrumentation.ts) — Next.js register hook
- [`docs/observability/opentelemetry-setup.md`](./opentelemetry-setup.md) — OTel collector & exporter setup
