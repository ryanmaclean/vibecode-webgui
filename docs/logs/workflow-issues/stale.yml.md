# Workflow Audit: .github/workflows/stale.yml

- **Workflow file**: `.github/workflows/stale.yml`
- **Tracking issue**: #383
- **Current notes**: nightly actions/stale sweep (issue/PR labels, exempt list); issue should confirm label conventions and whether security items stay exempt.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.

- **2025-09-30:** Added concurrency guard to avoid overlapping stale sweeps.
