# Code-Server Release Monitoring Plan

## Summary
Keep track of upstream `coder/code-server` releases so we can rebuild our multi-arch images promptly (next target: 4.105.x and beyond).

## Proposed Workflow
1. **GitHub RSS/Webhooks**
   - Subscribe to `https://github.com/coder/code-server/releases.atom` in our ops feed (Datadog event monitor or Slack webhook).
   - Alternatively, enable GitHub notification emails for `@ryanmaclean` + `@vibecode-devops`.
2. **Automation Hook**
   - GitHub Action (`.github/workflows/code-server-release-monitor.yml`) runs daily + on demand, compares the Dockerfile tag to the latest upstream release, and opens a tracking issue when versions diverge.
   - Workflow guards against duplicates by checking for an existing open issue with the same title before creating a new one.
   - TODO: emit Datadog event + Slack webhook when a new release issue is opened so on-call can triage within one hour.
3. **Manual Checklist** (when notified)
   - Update base image tags in `docker/code-server/Dockerfile` and `Dockerfile.kind`.
   - Re-run `scripts/build-codeserver-multiarch.sh` (local or ACR) and push the manifest.
   - Run `npm run test:unit:monaco` and the KinD smoke test (`npm run test:kind:code-server`) to validate Monaco + extension bundle.
   - Note the change under `docs/logs/AGENT_ACTIVITY_LOG.md` and update Docker image digests in `docs/logs/workflow-issues/gitops-deployment.yml.md`.

## Owners
- VibeCode DevOps / Platform team.

## Tracking
- TODO references (2025-10-01 00:20 UTC entry) – updated to reflect the live workflow.
- 2025-10-01 06:15 UTC – Verified `.github/workflows/code-server-release-monitor.yml` against current upstream tag (`coder/code-server@v4.104.2`) via local curl check to ensure the monitor reports "in sync" before enabling automation.
