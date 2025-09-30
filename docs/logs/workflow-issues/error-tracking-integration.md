# Issue Draft: Restore `error-tracking-integration` Automation

## Summary
The Datadog error tracking workflow auto-commits remediation snippets back to main. It was paused (manual only) after commits without `[skip ci]` re-triggered the same workflow, creating loops, and missing Datadog secrets caused failures. We need to redesign the automation so it is safe to run on pushes and PRs without flooding CI.

## Current Status
- Trigger reduced to `workflow_dispatch`; push/PR hooks removed along with the self-trigger safeguard.
- Secrets required: `DD_API_KEY`, `DD_APP_KEY`, `GITHUB_TOKEN` with `contents:write` scope.
- Workflow attempts to commit changes back to `main` using the default token, which lacks permissions in protected environments.
- No guard preventing repeated runs when the action pushes commits that re-trigger workflows.

## Proposed Remediation
1. **Commit strategy**: Switch to using a dedicated bot token with fine-grained permissions or convert the workflow to open a PR instead of pushing directly.
2. **Loop prevention**: Add commit message filters (`[skip ci][skip error-tracking]`) and `if: github.event.head_commit.message` checks to prevent recursion.
3. **Secret validation**: Introduce an initial job that fails fast when Datadog credentials absent, providing clear instructions.
4. **Dry-run mode**: Add input to allow manual dry-run where suggested changes are uploaded as artifacts for review.
5. **Trigger restoration**: Re-enable PR trigger so teams can validate error tracking changes while keeping push trigger behind branch protection approval.

## Acceptance Criteria
- Workflow successfully creates a PR (or safe commit) when Datadog identifies new error instrumentation gaps.
- No infinite loop occurs when the workflow updates code; confirm via test run on a feature branch.
- Missing secrets produce single failure with actionable guidance, not repeated retries.
- Documentation updated in `docs/logs/WORKFLOW_TRACKING.md` and TODO entry references the new GitHub issue.

## Follow-ups / Dependencies
- Align with Observability owners on the desired remediation path (auto-PR vs. issue creation).
- Ensure branch protection settings permit the workflow’s bot account to push or open PRs as required.

## Progress Log
- **2025-09-30:** Re-enabled PR trigger with concurrency guard, added Datadog secret validation, and replaced direct pushes with a PR-based flow (`peter-evans/create-pull-request`) gated behind `workflow_dispatch` input. Uploads diff artifacts for review when running on PRs without apply permission. Secrets still missing, so the workflow remains validation-only until keys are provided.
