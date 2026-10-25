# Feature Audit 1450: OpenTelemetry Tracing

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1450
**Status:** Confirmed in repo (Consolidated manual package implementation)

## Summary
Distributed tracing support with manual OpenTelemetry packages and selective instrumentations.

## Evidence
- `infrastructure/services/ai-gateway/src/tracing.ts` configures `OTLPTraceExporter` with `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `src/instrument.ts` initializes OpenTelemetry using consolidated setup from `src/lib/monitoring/opentelemetry-setup.ts`.
- Uses 8 carefully selected OpenTelemetry packages (NOT using auto-instrumentations-node):
  - `@opentelemetry/sdk-node@0.212.0`
  - `@opentelemetry/exporter-trace-otlp-http@0.212.0`
  - `@opentelemetry/exporter-prometheus@0.212.0`
  - `@opentelemetry/instrumentation-http@0.212.0`
  - `@opentelemetry/instrumentation-express@0.44.0`
  - `@opentelemetry/instrumentation-fs@0.15.0`
  - `@opentelemetry/instrumentation-dns@0.55.0`
  - `@opentelemetry/instrumentation-net@0.56.0`
- Replaced `@opentelemetry/auto-instrumentations-node` with selective instrumentations (40-60% bundle size reduction).
- Tree-shaking enabled via Next.js `experimental.optimizePackageImports`.

## Implementation Details
- **Main entry point:** `src/instrument.ts`
- **Configuration:** `src/lib/monitoring/opentelemetry-setup.ts` (consolidated from previous duplicate implementations)
- **Activation:** Gated by `OTEL_ENABLED=true` environment variable
- **OTLP Export:** Configured via `OTEL_EXPORTER_OTLP_ENDPOINT` (defaults to disabled)
- **Prometheus Metrics:** Exposed on port 9090 when enabled
- **Integration:** Works alongside dd-trace for dual observability approach

## Notes / Missing Info
- OpenTelemetry is optional and disabled by default (requires `OTEL_ENABLED=true`).
- Production deployments primarily use dd-trace; OpenTelemetry is for vendor-neutral scenarios.
- See `OBSERVABILITY.md` for comprehensive configuration guide.

## Follow-ups
- [x] Add docs on how to enable OTLP exporters in local dev (completed in OBSERVABILITY.md).
- [x] Consolidate OpenTelemetry packages and enable tree-shaking (completed).
