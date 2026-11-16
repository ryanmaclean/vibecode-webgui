# Issue Draft: Review `azure-webgui-deploy` Workflow

## Summary
The WebGUI Azure App Service deployment now validates secrets before building or deploying. We should confirm registry/app settings, add notifications, and document smoke tests before relying on automated pushes.

## Current Status
- Push/manual triggers with concurrency guard; deployment skips when Azure secrets missing.
- Health smoke hits `/`; additional API checks not included.
- No notification integration or rollback guidance.

## Proposed Remediation
1. **Secret inventory**: Verify `AZURE_*`, `ACR_NAME`, `APP_NAME_WEBGUI` secrets and document rotation.
2. **Smoke tests**: Expand to include authenticated endpoints if required.
3. **Notifications**: Decide whether to add Slack/Teams notifications or rely on run summaries.
4. **Rollback docs**: Document how to redeploy previous image when smoke fails.

## Acceptance Criteria
- Workflow passes with correct secrets; missing secrets exit gracefully with notices.
- Smoke coverage documented; notifications captured.
- TODO references GitHub issue once opened.

## Progress Log
- **2025-09-30:** Added concurrency + secret gating and skip notice for missing secrets.
