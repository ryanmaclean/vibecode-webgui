# Feature Audit 1300: OpenTelemetry tracing (OTLP exporters)

Issue: #1300

## Current signals in repo
- SkyWalking scripts reference an otel collector and OTLP pipeline: `platforms/kubernetes/scripts/skywalking/verify.py`, `platforms/kubernetes/scripts/skywalking/deploy.py`.
- Observability quickstart docs mention tracing in Tauri stack: `platforms/tauri/QUICKSTART_OBSERVABILITY.md`.

## Gaps / missing info
- No explicit OTLP exporter config in app runtime (beyond k8s scripts); need to confirm actual instrumentation.
- Release claim is “Distributed tracing support with OTLP exporters” — not proven in current mainline.

## Plan / TODO
- [ ] Locate OTLP exporter configuration in runtime services (if exists).
- [ ] If missing, add OTLP exporter wiring and document env vars.
- [ ] Add a smoke test verifying exporter config is emitted.

## Tests
- N/A (audit doc only).
