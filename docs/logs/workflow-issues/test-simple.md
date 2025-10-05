# Issue Draft: Decide Fate of `test-simple`

## Summary
The minimalist `test-simple` workflow used to run lint + unit tests on pushes to `main`. It was set to manual dispatch because the comprehensive pipelines already cover the same checks, but we need to either retire it formally or repurpose it for fast smoke coverage.

## Current Status
- Triggered only via `workflow_dispatch`.
- Runs `npm ci` and `npm run lint`/`npm run test:unit` (exact commands depend on script definitions).
- Adds additional load on GitHub runners when active, but provides quicker feedback compared to full CI.

## Proposed Options
1. **Retire**: Delete the workflow and document that `main-branch-ci` supersedes it.
2. **Repurpose**: Limit triggers to docs-only or low-risk paths where fast validation is helpful.
3. **On-demand utility**: Keep manual trigger but document use cases (e.g., quick lint check after resolving merge conflicts).

## Acceptance Criteria
- Decision captured in `DECISION_LOG` with rationale.
- If retired, workflow removed and TODO item closed.
- If repurposed, triggers/steps updated and README/TODO reference new behavior.
