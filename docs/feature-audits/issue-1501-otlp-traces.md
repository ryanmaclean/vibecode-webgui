# Feature Audit: OTLP Traces (Issue #1501)

## Scope
Confirm OTLP trace export support from v1.5.0 release notes is present in current mainline.

## Evidence (repo scan)
- OpenTelemetry stubs: `src/stubs/opentelemetry-*.js`
- Instrumentation: `src/instrumentation.ts`, `instrumentation.ts`
- Monitoring/Datadog integration: `src/components/monitoring/*`, `src/lib/monitoring/*`

## Current Status
- **Tracing-related stubs and instrumentation present**, but **OTLP export path not validated** in this audit.

## TODO
- [ ] Confirm OTLP exporter wiring in runtime config.
- [ ] Add a smoke test that emits a trace span and validates exporter config.
- [ ] Update docs for OTLP endpoint/env var expectations.

## Missing Info / Questions
- Which exporter is canonical (OTLP HTTP vs gRPC) for v1.5.0 parity?
- How is the OTLP endpoint configured in mainline?

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
