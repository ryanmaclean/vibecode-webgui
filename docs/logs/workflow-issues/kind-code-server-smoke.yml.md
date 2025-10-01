# Workflow Audit: .github/workflows/kind-code-server-smoke.yml

- **Workflow file**: `.github/workflows/kind-code-server-smoke.yml`
- **Tracking issue**: #395
- **Current notes**: nightly + manual KinD smoke using our script; needs KinD permissions only; issue should monitor runtime (~2m) and decide if diagnostics need retention tweaks.
  - 2025-10-01: Smoke script now exits on `kubectl wait` failures, masks pod names, and Dockerfile binaries (helm/kubectl/kubectx/kubens) verify upstream checksums before install.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.


- **2025-09-30:** Added concurrency guard and duration summary to the smoke test workflow.