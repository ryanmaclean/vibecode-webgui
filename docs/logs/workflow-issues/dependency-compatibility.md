# Issue Draft: Streamline `dependency-compatibility` Workflow

## Summary
Node matrix runs weekly and on dependency changes. We added concurrency and made build/type-check optional, but need to capture exit statuses cleanly and decide on failure policy.

## Current Status
- Concurrency guard added; build/type-check now tolerant with `continue-on-error` but summary step doesn’t yet report exit codes accurately.
- Matrix still runs npm audit and tests for each Node version; artifact upload remains.
- Dependency issue creation on schedule can still spam if not deduplicated.

## Proposed Remediation
1. Capture exit statuses and include them in summary with explicit pass/fail markers.
2. Decide when to fail the job versus warn (e.g., scheduled runs only warn, PRs fail).
3. Deduplicate GitHub issue creation and include summary data.
4. Review caching (per Node version) to minimize install cost.

## Acceptance Criteria
- Workflow produces clear summary per Node version with status for build/tests/type-check. Scheduled runs warn; PR runs fail on regression.
- Issue creation includes details and avoids duplicates.
- TODO references the finalized GitHub issue.

## Progress Log
- **2025-09-30:** Added concurrency guard and made build/type-check optional; summary placeholder added (needs exit-code wiring).

- **2025-09-30:** Added concurrency guard and per-node summary with build/test/type exit codes captured.
