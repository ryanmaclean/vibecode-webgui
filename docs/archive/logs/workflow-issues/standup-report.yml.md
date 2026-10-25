# Workflow Audit: .github/workflows/standup-report.yml

- **Workflow file**: `.github/workflows/standup-report.yml`
- **Tracking issue**: #384
- **Current notes**: weekday standup script that files GitHub issues and optionally posts to Slack; issue to confirm GH token scopes and Slack channel usage.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.

- **2025-09-30:** Added concurrency guard, token check, and summary output for created issue/Slack skip.

- **2025-09-30:** Standup workflow supports configurable issue/Slack outputs via dispatch inputs.