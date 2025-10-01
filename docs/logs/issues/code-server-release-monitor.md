# Code-Server Release Monitoring Plan

## Summary
Keep track of upstream `coder/code-server` releases so we can rebuild our multi-arch images promptly (next target: 4.105.x and beyond).

## Proposed Workflow
1. **GitHub RSS/Webhooks**
   - Subscribe to `https://github.com/coder/code-server/releases.atom` in our ops feed (Datadog event monitor or Slack webhook).
   - Alternatively, enable GitHub notification emails for `@ryanmaclean` + `@vibecode-devops`.
2. **Automation Hook**
   - Add a lightweight GitHub Action that runs daily (`schedule: cron`) and checks `gh release view coder/code-server --json tagName`. If the tag differs from the value in `docker/code-server/Dockerfile`, open an issue/PR via `peter-evans/create-issue-from-file`.
   - Store the last synced tag in `.github/code-server-release.json` to avoid duplicate alerts.
3. **Manual Checklist** (when notified)
   - Update base image tags in `docker/code-server/Dockerfile` and `Dockerfile.kind`.
   - Re-run `scripts/build-codeserver-multiarch.sh` (local or ACR) and push the manifest.
   - Run `npm run test:unit:monaco` and the KinD smoke test (`npm run test:kind:code-server`) to validate Monaco + extension bundle.
   - Note the change under `docs/logs/AGENT_ACTIVITY_LOG.md` and update Docker image digests in `docs/logs/workflow-issues/gitops-deployment.yml.md`.

## Owners
- VibeCode DevOps / Platform team.

## Tracking
- TODO references (2025-10-01 00:20 UTC entry).
