# Issue Draft: Re-enable `docs-automation` Workflow Safely

## Summary
The docs automation workflow validates content, runs lychee link checks, and auto-commits generated docs to main. It was paused after repeated failures from rate-limited link checks and branch protection blocking auto-commits. We need to modernize the workflow so doc updates regain automated guardrails without spamming CI.

## Current Status
- Push/PR triggers and weekly cron restored with concurrency guard.
- Lychee link checks now run with GitHub token, concurrency, and retries to reduce rate-limit failures.
- Documentation updates are generated only on manual dispatch; changes are uploaded as an artifact and optional PR via `peter-evans/create-pull-request` instead of direct pushes to `main`.
- Remaining issues: link report still fails hard on transient errors, jobs reinstall dependencies each run, and validation outputs aren’t summarized for contributors.

## Proposed Remediation
1. **Trigger strategy**: Reintroduce push/PR triggers targeting `docs/**`, `.md`, and generator scripts, plus an optional weekly cron. Provide `[skip docs-automation]` opt-out for large doc migrations.
2. **Lychee tuning**: Configure GitHub token and concurrency limits, add retry/backoff, and downgrade transient link errors to warnings while still failing on true errors.
3. **Auto-commit workflow**: Replace direct pushes with a PR creation or artifact upload; ensure generated docs and README changes are visible without breaking branch protection.
4. **Caching**: Cache npm dependencies and lychee results to reduce runtime and rate-limit pressure.
5. **Notifications**: Report link-check warnings via PR comment or summary artifact so doc owners can act without scanning logs.

## Acceptance Criteria
- Workflow runs automatically on docs PRs, completing within ~10 minutes in the common case.
- Link-check stage handles transient failures gracefully; actionable errors produce clear annotations.
- Auto-generated changes surface as artifacts or PRs rather than direct pushes to protected branches.
- TODO entry updated with GitHub issue link once filed; documentation details how to rerun/skip the workflow.

## Follow-ups / Dependencies
- Coordinate with Docs team on acceptable link-check warning thresholds and PR workflow.
- Align with Platform on branch protections for auto-generated doc PRs.

## Progress Log
- **2025-09-30:** Re-enabled triggers/cron with concurrency, tuned lychee retry behavior, and switched auto-update flow to artifact + optional PR on manual dispatch.
