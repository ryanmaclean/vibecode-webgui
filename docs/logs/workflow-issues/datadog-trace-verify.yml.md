# Workflow Audit: .github/workflows/datadog-trace-verify.yml

- **Workflow file**: `.github/workflows/datadog-trace-verify.yml`
- **Current notes**: hourly cron runs `npm run monitoring:trace` (requires DD_API_KEY/DD_APP_KEY, Node+Python setup) and uploads JSON artefacts; issue to note current script failures + retention.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.
