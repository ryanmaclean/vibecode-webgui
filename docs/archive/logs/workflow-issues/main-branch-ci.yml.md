# Issue Draft: Enhance main-branch-ci workflow

## Summary
Main branch CI runs lightweight checks with optional lint/type-step warnings. We now record step status in summaries but still rely on exit 0; need to evaluate failure policy and optional notifications.

## Current Status
- Push/PR triggers with concurrency guard.
- Lint/type check outputs recorded in step summary; commands still tolerate non-zero exit.
- Codex CLI install required; might be optional depending on environment.

## Proposed Remediation
1. Decide on lint/type failure thresholds and convert summary to actionable failure or issue creation.
2. Make Codex CLI optional when CODEX_HOME not needed.
3. Add artifact for lint/type logs when non-zero exit occurs.

## Acceptance Criteria
- Main branch CI surfaces failures clearly and optionally blocks merges when thresholds exceeded.

## Progress Log
- **2025-09-30:** Added lint/type status summary for quick validation job.

- **2025-09-30:** PR runs now fail when lint/type-check exit non-zero; summary still displays exit codes.