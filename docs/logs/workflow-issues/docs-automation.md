# Issue Draft: Re-enable `docs-automation` Workflow Safely

## Summary
The docs automation workflow validates content, runs lychee link checks, and auto-commits generated docs to main. It was paused after repeated failures from rate-limited link checks and branch protection blocking auto-commits. We need to modernize the workflow so doc updates regain automated guardrails without spamming CI.

## Current Status
- Trigger restricted to manual `workflow_dispatch`; push/PR path filters and weekly cron removed.
- Link checker (`lychee`) fails frequently due to rate limits, causing job failures across unrelated PRs.
- Auto-commit step pushes directly to `main`, conflicting with branch protection rules and retriggering the workflow.
- No secret gating or caching; each run installs dependencies from scratch.

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
- **2025-09-30:** Draft created outlining gating, lychee tuning, and PR-based auto-commit strategy. Awaiting implementation plan.
