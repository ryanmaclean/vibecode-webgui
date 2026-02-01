# Feature Audit 1249: Multiple Backends - Jaeger, Zipkin, Datadog support

## Source
- Release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)
- Issue: #1249

## Summary
Audit status: **TBD**

This audit will confirm whether multiple tracing backends (Jaeger, Zipkin, Datadog)
are still supported in mainline and document any gaps.

## Plan
- Locate current tracing configuration and supported backends.
- Verify runtime configuration options (env vars, config files, UI).
- Add/adjust docs to reflect supported backends.
- Add/update tests once the feature surface is identified.

## Missing Info / Questions
- Where is the canonical tracing backend configuration in current mainline?
- Are Jaeger/Zipkin still supported or removed in favor of Datadog-only?

## Tests
- TODO: Add unit/integration coverage once configuration entrypoints are confirmed.
