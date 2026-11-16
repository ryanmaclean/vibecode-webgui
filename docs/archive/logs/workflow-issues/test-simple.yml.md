# Workflow Audit: .github/workflows/test-simple.yml

- **Workflow file**: `.github/workflows/test-simple.yml`
- **Tracking issue**: #387
- **Current notes**: sanity jobs for Babel config + optional Datadog CI visibility; issue to determine if still needed vs simplified CI and ensure Datadog secrets gating works.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.

- **2025-09-30:** Added concurrency guard to simple test workflow.