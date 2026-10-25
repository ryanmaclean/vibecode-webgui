# Feature Audit 1299: Datadog Integration (optional metrics/APM)

Issue: #1299

## Current signals in repo
- Datadog setup tooling for code-server: `platforms/docker/scripts/code_server/configure_datadog.py`.
- Tauri app sets `DD_SERVICE` and starts vfkit with Datadog tracing envs: `platforms/tauri/src/main.rs`, `platforms/tauri/src/commands.rs`.
- Kubernetes skywalking scripts include Datadog integration checks: `platforms/kubernetes/scripts/skywalking/verify.py`, `platforms/kubernetes/scripts/skywalking/deploy.py`.
- SwiftUI/Apple VM app includes Datadog provider: `platforms/azure/azure/SwiftUI-Apps/Shared/Observability/DatadogProvider.swift`.

## Gaps / missing info
- Release note mentions 3 integration methods (SSH, cloud-init, Lima). Evidence for these paths not confirmed in repo.
- No consolidated doc describing all 3 integration paths in current main.
- No automated test verifying Datadog integration end-to-end for each method.

## Plan / TODO
- [ ] Locate or implement SSH/cloud-init/Lima hooks for Datadog setup (or document them if already present).
- [ ] Add docs to describe supported integration paths and env vars.
- [ ] Add minimal smoke test(s) for Datadog config generation / activation.

## Tests
- N/A (audit doc only).
