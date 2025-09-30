# Issue Draft: Review `claude.yml` Workflow

## Summary
Responds to `@claude` mentions using Anthropics' action. No secret gating or guardrail documentation exists. Evaluate usage and permissions before keeping it enabled.

## Current Status
- Triggers on issue/PR comments mentioning `@claude`.
- Requires `CLAUDE_CODE_OAUTH_TOKEN`; no validation if secret missing.
- Additional permissions set to `actions: read`; custom instructions commented out.

## Proposed Remediation
1. Add secret validation to skip gracefully when token absent.
2. Document trigger phrases and optional instructions; consider opt-out label.
3. Review required permissions and rate limits.

## Acceptance Criteria
- Workflow runs only with token present and has documented prompts/instructions.

## Progress Log
- **2025-09-30:** Added concurrency guard and secret validation so the responder skips with a notice when the token is missing.
