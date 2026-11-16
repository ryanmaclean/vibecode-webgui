# Issue Draft: Review `claude-code-review` Workflow

## Summary
Runs Anthropics' Claude code review action on PRs, requiring `CLAUDE_CODE_OAUTH_TOKEN`. We need to verify token scope, prompt tuning, and whether to keep the workflow.

## Current Status
- Trigger on pull_request; no gating for missing token.
- Uses anthropic/claude-code-action@beta; default prompts not customized.

## Proposed Remediation
1. Add secret validation to skip gracefully when token absent.
2. Review prompt configuration and sticky comments.
3. Document expected behavior and opt-out label.

## Acceptance Criteria
- Workflow runs only when token configured and documents prompts/labels.

## Progress Log
- **2025-09-30:** Added concurrency guard and secret validation so Claude review skips with a notice when token missing.
