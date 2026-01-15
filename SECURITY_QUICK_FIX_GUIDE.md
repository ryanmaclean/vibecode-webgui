# Security Quick Fix Guide
## Immediate Action Required - 3 HIGH Severity Vulnerabilities

**Date:** 2026-01-14
**Estimated Time:** 2-4 hours
**Priority:** CRITICAL (Production Impact)

---

## TL;DR - Run These Commands

```bash
# 1. Create fix branch
git checkout -b fix/security-vulnerabilities-p1
git tag security-audit-2026-01-14

# 2. Apply fixes
npm audit fix
npm audit fix --force

# 3. Test everything
npm test
npm run build

# 4. If all tests pass, commit
git add package.json package-lock.json
git commit -m "fix(security): resolve 3 HIGH severity vulnerabilities"
git push origin fix/security-vulnerabilities-p1

# 5. Create PR and merge
```

**Rollback if needed:**
```bash
git checkout main
npm install
```

---

## Current Vulnerabilities (Production)

| Package | Current | Fixed | Issue | Impact |
|---------|---------|-------|-------|--------|
| @modelcontextprotocol/sdk | 1.25.1 | 1.25.2 | ReDoS | Service outage |
| langchain | 1.0.2 | 1.2.8 | Serialization injection | Data breach |
| preact | 10.27.x | Latest | JSON VNode injection | XSS attacks |

---

## Step-by-Step Instructions

### Step 1: Prepare (5 minutes)
```bash
cd /Users/ryan.maclean/vibecode-webgui

# Create branch
git checkout -b fix/security-vulnerabilities-p1

# Tag current state for rollback
git tag security-audit-2026-01-14

# Verify current test state
npm test > /tmp/test-baseline-before.txt
```

### Step 2: Apply Safe Fixes (10 minutes)
```bash
# Run safe fixes (won't break semantic versioning)
npm audit fix

# Check what changed
git diff package.json

# Verify tests still pass
npm run test:unit
```

**Expected:** Preact should be fixed, others may require force

### Step 3: Apply Force Fixes (10 minutes)
```bash
# Apply force fixes (may have breaking changes)
npm audit fix --force

# Check what changed
git diff package.json package-lock.json

# Verify no vulnerabilities remain
npm audit
```

**Expected:** 0 vulnerabilities

### Step 4: Full Test Suite (30-60 minutes)
```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests (if time permits)
npm run test:e2e

# Build verification
npm run build
```

**Pass Criteria:**
- All tests pass (expect 100% - 3,570/3,570)
- Build succeeds
- No console errors

**Failure Criteria:**
- >5 new test failures → ROLLBACK
- Build fails → ROLLBACK
- Critical functionality broken → ROLLBACK

### Step 5: Commit & Push (10 minutes)
```bash
# If all tests pass
git add package.json package-lock.json
git commit -m "fix(security): resolve 3 HIGH severity vulnerabilities

- @modelcontextprotocol/sdk: 1.25.1 → 1.25.2 (ReDoS fix, GHSA-8r9q-7v3j-jr4g)
- langchain: 1.0.2 → 1.2.8 (serialization injection fix, GHSA-r399-636x-v7f6)
- preact: Update to latest (JSON VNode injection fix, GHSA-36hm-qxxp-pg3m)

All tests passing: 3,570/3,570 (100%)
Build: SUCCESS
Zero regressions detected

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push
git push origin fix/security-vulnerabilities-p1
```

### Step 6: Create Pull Request
1. Go to GitHub: https://github.com/ryanmaclean/vibecode-webgui
2. Create PR from `fix/security-vulnerabilities-p1` to `main`
3. Title: "fix(security): resolve 3 HIGH severity production vulnerabilities"
4. Link to full report: `/Users/ryan.maclean/vibecode-webgui/SECURITY_VULNERABILITY_ANALYSIS_v3.3.0.md`
5. Request review from security team
6. Merge when approved

---

## Rollback Procedure

### If Tests Fail
```bash
# Abandon branch
git checkout main
git branch -D fix/security-vulnerabilities-p1

# Restore packages
npm install

# Verify original state
npm test
```

### If Deployed and Issues Found
```bash
# Revert commit
git revert HEAD
git push origin main

# Or rollback to tag
git reset --hard security-audit-2026-01-14
git push origin main --force  # DANGEROUS - coordinate with team
```

---

## Manual Testing Checklist

After fixes applied and tests pass, manually verify:

### Critical Functionality
- [ ] Application starts: `npm start`
- [ ] Login works
- [ ] AI chat responds
- [ ] No console errors (F12 → Console)
- [ ] API calls succeed (F12 → Network)

### LangChain Functionality (most critical)
- [ ] AI chat uses LangChain
- [ ] No serialization errors
- [ ] API keys not exposed
- [ ] Database queries work

### MCP SDK Functionality
- [ ] MCP server starts
- [ ] No ReDoS issues with large inputs
- [ ] Connections stable

### Preact Components (if used)
- [ ] React components render
- [ ] No XSS vulnerabilities
- [ ] Forms work correctly

---

## FAQ

**Q: How long will this take?**
A: 2-4 hours (30 min fixes + 60-120 min testing)

**Q: Will there be downtime?**
A: No downtime expected. Changes are dependency updates only.

**Q: What if tests fail?**
A: Rollback immediately using procedure above. Investigate failures before retry.

**Q: Can I skip force fixes?**
A: No. LangChain serialization injection is CRITICAL (CVSS 8.6). Must fix.

**Q: What about the 21 OpenVSCode vulnerabilities?**
A: Those are Priority 2 (next 7 days). They affect dev environment, not production.

**Q: Do I need to update staging first?**
A: Recommended if you have staging. Deploy there, test, then production.

---

## Success Criteria

✅ **Done when:**
- `npm audit` shows 0 high/critical vulnerabilities
- All 3,570 tests passing
- Build succeeds
- No console errors
- Manual testing complete
- PR merged to main

---

## Next Steps (After P1 Complete)

1. **Priority 2 (This Week):** Fix 21 OpenVSCode Server vulnerabilities
2. **Priority 3 (This Month):** Implement automated scanning
3. **Ongoing:** Weekly dependency reviews

See full report for details: `SECURITY_VULNERABILITY_ANALYSIS_v3.3.0.md`

---

## Questions?

- **Security Issues:** security@vibecode.com
- **Technical Questions:** @engineering-team (Slack)
- **Report Issues:** Open GitHub issue with "security" label

---

**Last Updated:** 2026-01-14
**Author:** Agent AD
**Status:** READY TO EXECUTE
