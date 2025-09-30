# Issue Draft: Harmonize `deploy-docs` Workflow

## Summary
The GitHub Pages deployment workflow supports both Astro and Next.js docs. It was flaky when Next.js paths were removed and lacked clear gating, so builds re-ran unnecessarily. We need to clarify switching between systems, ensure caching/gating is robust, and document the fallback strategy.

## Current Status
- Push + PR triggers active; weekly cron added to catch drift.
- Workflow now detects docs system (Astro default, Next.js optional via dispatch input) and builds only the chosen site.
- No secret dependencies; primary issues are caching, artifact size, and ensuring next steps for Next.js are documented.

## Proposed Remediation
1. **Cache strategy**: Verify Node caches are scoped per docs system to avoid cross-contamination.
2. **Docs system flag**: Document dispatch input usage and add guard rails if Next.js artifacts missing.
3. **Artifact validation**: Add size/time checks so large docs builds surface warnings (Next.js outputs bigger).
4. **Documentation**: Update docs/README and runbooks to note how to trigger Next.js build and when to archive it.
5. **Reporting**: Collect build duration metrics and optionally post a summary comment on PRs.

## Acceptance Criteria
- Deploy workflow builds the correct docs variant with caches per system and passes weekly cron run.
- Next.js optional branch tested and documented; Astro remains default.
- TODO entry references the GitHub issue once filed.

## Progress Log
- **2025-09-30:** Added dynamic docs system detection, weekly cron, and consistent gating for Astro/Next.js steps.
