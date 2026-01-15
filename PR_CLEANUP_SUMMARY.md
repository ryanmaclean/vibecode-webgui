# PR Cleanup Summary - Quick Reference

**Date:** 2026-01-14
**Repository:** ryanmaclean/vibecode-webgui
**Total Open PRs:** 14

---

## 🚨 CRITICAL ACTION REQUIRED

**PR #789 fixes 3 HIGH severity vulnerabilities - MERGE IMMEDIATELY**

```bash
gh pr merge 789 --squash --delete-branch
```

### Vulnerabilities Fixed:
1. **ReDoS** in @modelcontextprotocol/sdk (CVE-2025-66414)
2. **Serialization Injection** in langchain (secret extraction)
3. **JSON VNode Injection** in preact

---

## Quick Decision Matrix

| PR # | Title | Action | Priority | Risk |
|------|-------|--------|----------|------|
| 789 | npm_and_yarn group updates (3 packages) | ✅ MERGE NOW | CRITICAL | LOW |
| 788 | React 19.2.3 | ✅ MERGE | HIGH | LOW |
| 787 | supertest 7.2.2 (dev) | ✅ MERGE | LOW | VERY LOW |
| 786 | @xterm/addon-fit 0.11.0 | ✅ MERGE | MEDIUM | LOW |
| 785 | recharts 3.6.0 | ✅ MERGE | MEDIUM | LOW |
| 784 | markdownlint-cli2 (dev) | ✅ MERGE | LOW | VERY LOW |
| 783 | @upstash/redis 1.36.1 | ✅ MERGE | MEDIUM | LOW |
| 782 | monacopilot 1.2.12 | ✅ MERGE | MEDIUM | LOW |
| 781 | hot-shots 12.1.0 | ⚠️ TEST THEN MERGE | MEDIUM | MEDIUM |
| 780 | @prisma/client 7.2.0 | ⚠️ TEST THEN MERGE | MEDIUM | MEDIUM |
| 779 | autoprefixer (dev) | ✅ MERGE | LOW | VERY LOW |
| 777 | npm_and_yarn security updates | ✅ MERGE | HIGH | LOW |
| 776 | pip dependencies | ✅ MERGE | MEDIUM | LOW |
| 723 | Unified launcher feature | 🔍 SECURITY REVIEW | HIGH | HIGH |

---

## One-Command Merge (Safe PRs Only)

**After reviewing the full analysis**, you can merge safe PRs with:

```bash
# Phase 1: CRITICAL (do this first)
gh pr merge 789 --squash --delete-branch

# Phase 2: Safe dependency updates (wait for CI on each)
gh pr merge 788 --squash --delete-branch  # React
gh pr merge 786 --squash --delete-branch  # xterm
gh pr merge 785 --squash --delete-branch  # recharts
gh pr merge 783 --squash --delete-branch  # upstash
gh pr merge 782 --squash --delete-branch  # monacopilot
gh pr merge 787 --squash --delete-branch  # supertest (dev)
gh pr merge 784 --squash --delete-branch  # markdownlint (dev)
gh pr merge 779 --squash --delete-branch  # autoprefixer (dev)
gh pr merge 777 --squash --delete-branch  # security updates
gh pr merge 776 --squash --delete-branch  # python deps

# Phase 3: Requires testing first
# Test database migrations: npm run test:db
gh pr merge 780 --squash --delete-branch  # Prisma 7.x

# Test metrics collection: npm run test:metrics
gh pr merge 781 --squash --delete-branch  # hot-shots 12.x
```

---

## Attack Surface Reduction

### Before
- 14 open PRs
- 3 HIGH severity vulnerabilities
- 13 outdated dependencies

### After
- 1 open PR (pending security review)
- 0 vulnerabilities
- All dependencies current

**92.9% reduction in open PRs**
**100% reduction in known vulnerabilities**

---

## PR #723 - Requires Special Attention

**Status:** 🔍 SECURITY REVIEW REQUIRED

This PR is 2.5 months old and adds:
- Rust HTTP service (new attack vector)
- Chromium kiosk launcher (browser security)
- VM integration (isolation concerns)
- 30+ files changed

**Do not merge without:**
1. Security code review
2. Penetration testing of HTTP service
3. Browser security audit
4. Rebase on latest main
5. Remove test artifacts

---

## Next Steps

1. **Read full analysis:** `PR_CLEANUP_ANALYSIS.md`
2. **Merge PR #789 immediately** (fixes 3 HIGH vulns)
3. **Merge other safe PRs** (Phase 2)
4. **Test major version updates** (Phase 3)
5. **Schedule security review** for PR #723

---

## Contact

**Analyst:** Agent AH
**Full Report:** `/Users/ryan.maclean/vibecode-webgui/PR_CLEANUP_ANALYSIS.md`
**Cleanup Script:** Available in full report (review before execution)
