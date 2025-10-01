---
title: Docs Verification Runbook
description: Checklist and remediation guide for validating the Astro documentation site before merging or deploying.
lastUpdated: 2025-10-01 03:55 UTC
owners:
  - docs-infra@vibecode.com
---

# Docs Verification Runbook

## Purpose

Ensure the Astro documentation published to GitHub Pages (base `/vibecode-webgui`) builds successfully and ships with no broken internal links. This runbook captures the required commands, CI automation hooks, and manual remediation steps for link migrations.

## Prerequisites

- Node.js 22 (matches CI) with npm 10+
- Clean `docs/` install (`npm ci --legacy-peer-deps` in repo root and again inside `docs/`)
- Access to GitHub Actions logs for `docs-automation.yml`

## Standard Verification Flow

1. **Install dependencies** (root + docs workspace)
   ```bash
   npm ci --legacy-peer-deps
   (cd docs && npm ci --legacy-peer-deps)
   ```
2. **Build Astro output**
   ```bash
   (cd docs && npm run build)
   ```
3. **Static link audit** (fails if any internal route or asset is missing)
   ```bash
   npm run docs:link-audit
   ```
   - Uses `scripts/docs-link-audit.js` to scan `docs/dist` for broken relative links.
4. **Markdown/external link check**
   ```bash
   npm run docs:validate
   ```
   - Runs `scripts/validate-documentation.js` + markdownlint + Lychee (external URLs).
5. **Review artifacts**
   - If CI fails, download the `validation-report` artifact for context.

## CI Automation

`docs-automation.yml` (push/PR/schedule) now executes:
1. `npm run docs:validate`
2. `npm ci` in `docs/`
3. `npm run build` inside `docs/`
4. `npm run docs:link-audit`
5. Lychee crawl of markdown/external links

Any failure in steps 1–4 blocks the job. Link regressions surface both locally and in CI with identical output.

## Link Migration Playbook

When the link audit fails due to repo-relative references:

1. **Identify offending links**
   - `npm run docs:link-audit` prints the source HTML + unresolved target.
   - For markdown sources, locate the path in `docs/src/content/**`. Use `rg "<link>" docs/src/content` to find references.
2. **Classify fix**
   - **Publishable asset**: Copy JSON/scripts/assets into `docs/public` (preserves relative paths).
   - **Astro route**: Update markdown to canonical route (e.g., `/datadog-local-development/`).
   - **GitHub blob**: For notebooks/scripts that should stay in repo, convert to absolute GitHub URL (`https://github.com/…/blob/main/...`).
   - **Legacy wiki placeholder**: Remove or replace `{githubNewFileUrl}` tokens.
3. **Re-run verification**
   ```bash
   (cd docs && npm run build)
   npm run docs:link-audit
   npm run docs:validate
   ```
4. **Document outcome**
   - Update `docs/logs/astro-link-audit-YYYY-MM-DD.md` with the run timestamp and summary.
   - Note automation coverage or manual exceptions in TODO/worklogs.

## Troubleshooting

- **CI fails before link audit**: Ensure `docs/node_modules` is regenerated (`npm ci` inside `docs/`).
- **False positives for templated URLs**: The audit ignores tokens containing `{…}`; keep placeholders wrapped in braces to bypass the static check.
- **External URL failures**: Lychee failures appear in `docs:validate`; update or exclude broken third-party links.

## References

- Workflow: `.github/workflows/docs-automation.yml`
- Audit script: `scripts/docs-link-audit.js`
- Historical runs: `docs/logs/astro-link-audit-2025-10-01.md`
