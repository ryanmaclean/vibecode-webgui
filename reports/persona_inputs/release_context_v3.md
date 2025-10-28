# Build vs Deployment Snapshot (2025-10-01)
- BUILD_STATUS.md (last updated 06:45 UTC): progress 40%; minimal/standard pushed; ai building; web/full queued.
- DEPLOYMENT_SUMMARY.md (dated 07:24 UTC): progress 60%; minimal/standard/ai verified; web/full building via GitHub Actions.

# Outstanding Issues
- Issue #410: remaining profiles (ai/web/full) unchecked; buildx commands documented; needs confirmation of pushes.
- Issue #418: workflow dispatch updates awaiting merge and post-merge validation; reviewer requested unique validation tag, concurrency guard, SBOM fail-fast, Datadog metrics proof (comments 07:29-07:35 UTC).

# Questions
- Have any builds run after 07:24 UTC? Check `/tmp/build-*.log` or GitHub Actions history.
- What evidence is required before promoting `latest`? (Nightly success + Datadog metrics per TODO).
