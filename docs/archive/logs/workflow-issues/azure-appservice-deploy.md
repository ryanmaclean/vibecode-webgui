# Issue Draft: Streamline `azure-appservice-deploy` Workflow

## Summary
The App Service deployment workflow now validates Azure secrets before building/pushing images, but we still need to confirm registry credentials, smoke coverage, and skip semantics when the API key is missing. Document remaining gaps before reopening automated triggers.

## Current Status
- Push + manual triggers active; concurrency guard and secret validation added so builds/deploys skip when Azure secrets are absent.
- Model smoke test now runs only when `GATEWAY_API_KEY` is provided; otherwise the workflow skips gracefully.
- Deploy job still performs a full App Service restart; no notification integration included.

## Proposed Remediation
1. **Credential audit**: Verify `AZURE_*`, `ACR_NAME`, and `APP_NAME` secrets in GitHub environments; add runbook guidance for rotation.
2. **Notification strategy**: Decide whether to add Slack/Teams notification or rely on run summaries.
3. **Smoke robustness**: Consider adding retry/backoff for health check and verifying additional endpoints.
4. **Security review**: Ensure ACR push uses OIDC or PAT as required; confirm the service principal scope is least privilege.

## Acceptance Criteria
- Workflow fails fast with actionable message when Azure secrets missing; passes end-to-end with known good credentials.
- Smoke tests cover health + API endpoints with documented behavior when API key unavailable.
- TODO entry references the GitHub issue; coordination log notes the re-enabled state.

## Progress Log
- **2025-09-30:** Added concurrency + secret validation gating and optional smoke test; deployment skips with notice when secrets absent.
