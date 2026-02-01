# Feature Audit 1450: OpenTelemetry Tracing

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1450
**Status:** Confirmed in repo (OTLP exporter present)

## Summary
Distributed tracing support with OTLP exporters.

## Evidence
- `infrastructure/services/ai-gateway/src/tracing.ts` configures `OTLPTraceExporter` with `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `src/instrumentation.ts` registers OpenTelemetry via `@vercel/otel`.

## Notes / Missing Info
- Confirm whether tracing is enabled by default or gated by env flags in production.

## Follow-ups
- [ ] Add docs on how to enable OTLP exporters in local dev.
