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
- **2025-10-01 01:32 UTC:** Re-enabled the Next.js path in `deploy-docs`. The job now builds the standalone bundle, packages `.next/standalone` + static assets into `nextjs-standalone-<run_id>`, uploads it via `actions/upload-artifact`, and skips the GitHub Pages deploy job unless the Astro variant runs. Follow-up recorded in TODO/logs to provision a hosting target for the bundle.
- **2025-10-01 00:47 UTC:** Ran `npm run build` from `docs/` (Astro 5.13.7). Local build completed in ~5.5s and generated 249 pages without warnings, confirming the workflow's default Astro path remains healthy after the recent trigger tweaks. Output archived in local shell history for reference.
- **2025-10-01 00:51 UTC:** Ran `npm run build` at repo root (Next.js 15.5.3) after sourcing `.env.local`. Build completed with existing dynamic `require` warnings but produced `.next/standalone` output (no `out/` directory), so the workflow's Next.js artifact upload step will currently fail unless we either add `next export` or point it at `.next/standalone`. Capture follow-up in TODO.
- **2025-10-01 00:56 UTC:** Tried `NEXT_OUTPUT_MODE=export npm run build` (after updating `next.config.mjs` to honor the env flag). Build failed before export (`Cannot find module .../.next/server/next-font-manifest.json`), indicating the app is not ready for static export yet. Added a guard in `.github/workflows/deploy-docs.yml` so the Next.js path fails fast with a clear message until we fix the export pipeline.
- **2025-10-01 01:00 UTC:** Chose the pragmatic path—leave GitHub Pages for Astro only. The workflow now errors immediately when `docs_system=nextjs`, and the downstream install/build/upload steps are disabled (set to `if: false`) until we either support static export or move the Next.js deploy elsewhere. (Superseded by the 2025-10-01 01:32 UTC update.)
- **2025-10-01 01:05 UTC:** Drafted follow-up plan at `docs/logs/issues/405-next-docs-deployment.md` to track the server-backed deployment strategy for the Next.js site (now GitHub issue #405).
- **2025-10-01 02:34 UTC:** Manual dispatch (`workflow_dispatch`, run 18149455955) confirmed the Astro path completes in ~60s and successfully publishes via Pages; Next.js steps remain skipped and no `next-standalone` artifact is produced yet (by design while we focus on server-backed hosting).
- **2025-10-01 02:46 UTC:** Decided against checking `docs/dist` into git (flate ~10k files). Documented the command for capturing a tarball (`npm run build` in `docs/` then `tar -czf docs/dist-<date>.tgz docs/dist`) and noted that future workflow investigations can stash the artifact alongside this log instead of committing it.
- **2025-09-30:** Added dynamic docs system detection, weekly cron, and consistent gating for Astro/Next.js steps.
