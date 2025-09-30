# Workflow Audit: .github/workflows/secret-scanning.yml

- **Workflow file**: `.github/workflows/secret-scanning.yml`
- **Tracking issue**: #382
- **Current notes**: standalone TruffleHog diff scan on pushes/PRs; issue should ensure skip logic matches main-branch guard and consider integration with GitHub Advanced Security.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.

- **2025-09-30:** Added concurrency guard to prevent overlapping runs.
