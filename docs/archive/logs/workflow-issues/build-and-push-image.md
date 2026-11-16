# Issue Draft: Reduce `build-and-push-image` Cost

## Summary
The container build workflow pushes to GHCR and optionally deploys to AKS. We reintroduced gating so AKS deploys skip when secrets missing, but we still need to audit registry credentials, cache strategy, and notifications before re-enabling unattended runs.

## Current Status
- Push/PR triggers plus weekly cron run the workflow; concurrency guard prevents overlapping builds per ref.
- Build stage always runs; deploy stage now requires `AZURE_CREDENTIALS`, and Slack notifications require webhook.
- Secrets still missing in most environments, so the deploy job skips with a notice.

## Proposed Remediation
1. **Credential audit**: Confirm `AZURE_CREDENTIALS` and AKS vars exist for production; document where they live.
2. **Cache review**: Evaluate cache hit rate for Docker Buildx; consider remote cache or multi-arch needs.
3. **Artifact usage**: Decide whether to upload SBOM to security tools or attach to release notes.
4. **Notification strategy**: When Slack webhook unavailable, surface status via PR comment or GitHub check summary.
5. **Deploy safeguards**: Add dry-run option, or limit AKS deploy to manual dispatch until secrets stable.

## Acceptance Criteria
- Workflow succeeds with secrets present and fails fast with actionable guidance when they’re missing.
- Deploy job only runs when environment approved; otherwise it exits gracefully without noise.
- TODO entry links to GitHub issue with owner and remediation steps.

## Progress Log
- **2025-09-30:** Added concurrency, secret validation outputs, gated AKS deploy/Slack steps, and weekly cron.
