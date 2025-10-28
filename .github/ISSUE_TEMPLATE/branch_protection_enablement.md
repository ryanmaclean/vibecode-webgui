---
name: Branch Protection Enablement
about: Admin checklist for enabling branch protection on main branch
title: 'Enable Branch Protection on main Branch'
labels: security, infrastructure, admin-required
assignees: ''
---

## Branch Protection Enablement Request

**Branch:** `main`
**Profile:** Recommended (default)
**Estimated Time:** 5 minutes
**Related Issue:** #455

---

## Pre-Flight Checklist

Complete these checks before proceeding:

### Prerequisites
- [ ] I have **admin** access to this repository
- [ ] GitHub CLI installed: `gh --version`
- [ ] GitHub CLI authenticated: `gh auth status`
- [ ] Current branch is `main` and up-to-date

### CI/CD Verification
- [ ] All workflows passing on main: `gh run list --branch main --limit 3`
- [ ] Required status checks exist and run successfully:
  - [ ] `validate-ci-config`
  - [ ] `quick-validation`
  - [ ] `security-check`
  - [ ] `build-check`
  - [ ] `code-quality`
  - [ ] `root-tests`
  - [ ] `build-test`

### Team Readiness
- [ ] Team notified about branch protection enablement
- [ ] Team understands PR workflow requirements
- [ ] GPG key setup documentation shared (for signed commits)

---

## Enablement Steps

### Step 1: Run Enablement Script

**Recommended Profile** (execute this command):
```bash
./scripts/security/enable-branch-protection.sh main recommended
```

**Expected Output:**
```
✅ Dependencies OK
✅ Admin permissions confirmed
✅ Branch protection configuration complete
```

<details>
<summary>Alternative Profiles (click to expand)</summary>

**Minimal Profile** (faster velocity, lower security):
```bash
./scripts/security/enable-branch-protection.sh main minimal
```

**High Security Profile** (maximum protection):
```bash
./scripts/security/enable-branch-protection.sh main high-security
```
</details>

### Step 2: Validate Configuration

```bash
./scripts/security/check-branch-protection.sh
```

**Expected Score:** ≥7/10 (minimum), 9/10 (target)

**Validation Output:**
```
Paste validation script output here
```

---

## Testing Checklist

### Test 1: Direct Push Blocked
- [ ] Attempted direct push to main
- [ ] Received protection error

```bash
git checkout main
echo "# Test" >> README.md
git commit -am "test: direct push"
git push origin main
# Should fail with: ERROR - Branch protection prevents direct push
```

### Test 2: PR Without Approval Blocked
- [ ] Created test PR
- [ ] Confirmed merge button disabled without approval
- [ ] Verified status checks required

### Test 3: PR Workflow Works
- [ ] PR approved by team member
- [ ] All status checks passed
- [ ] Successfully merged PR

---

## Configuration Applied

**Profile Used:** (check one)
- [ ] Minimal
- [ ] Recommended
- [ ] High Security

**Protection Rules Enabled:**
- [ ] Pull request reviews (1+ approvals required)
- [ ] Stale review dismissal
- [ ] Required status checks (7 checks for recommended)
- [ ] Strict mode (branch up-to-date required)
- [ ] Force push protection
- [ ] Branch deletion protection
- [ ] Signed commits requirement
- [ ] Admin enforcement

---

## Team Notification

- [ ] Team announcement sent with workflow changes
- [ ] GPG key setup documentation shared
- [ ] Full documentation link provided: `docs/security/BRANCH_PROTECTION.md`
- [ ] Quickstart guide shared: `docs/security/BRANCH_PROTECTION_QUICKSTART.md`

**Announcement Template:**
```
🔒 Branch Protection Enabled

We've enabled branch protection on the main branch.

What changed:
- Direct pushes to main are now blocked
- All changes require pull requests with 1 approval
- All CI/CD checks must pass before merging
- Signed commits are required

Your workflow:
1. Create feature branch: git checkout -b feature/your-feature
2. Make changes and commit with signing
3. Push and create PR: gh pr create
4. Request review from teammate
5. Merge after approval + green checks

Documentation: docs/security/BRANCH_PROTECTION_QUICKSTART.md
```

---

## Rollback Plan (If Needed)

**Emergency Disable:**
```bash
gh api --method DELETE \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection
```

**Re-enable:**
```bash
./scripts/security/enable-branch-protection.sh main recommended
```

---

## Completion Verification

- [ ] Validation score ≥7/10
- [ ] All tests passed
- [ ] Team notified
- [ ] Documentation updated
- [ ] Issue #455 updated with completion status

**Final Validation Score:** `__/10`

**Completion Date:** `YYYY-MM-DD`

---

## Post-Enablement Monitoring

**First Week:**
- [ ] Monitor for team workflow friction
- [ ] Address GPG signing issues promptly
- [ ] Verify all PRs follow new workflow

**First Month:**
- [ ] Review merge velocity impact
- [ ] Collect team feedback
- [ ] Adjust configuration if needed

**Quarterly:**
- [ ] Verify status checks match active workflows
- [ ] Review protection rules effectiveness
- [ ] Consider additional protections

---

## Documentation References

- **Quickstart Guide:** `docs/security/BRANCH_PROTECTION_QUICKSTART.md`
- **Full Documentation:** `docs/security/BRANCH_PROTECTION.md`
- **Enablement Script:** `scripts/security/enable-branch-protection.sh`
- **Validation Script:** `scripts/security/check-branch-protection.sh`
- **GitHub Docs:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches

---

## Support

**Issues during enablement?** Add comment with:
- Script output from enablement attempt
- Validation script results
- Error messages received
- Current workflow status: `gh run list --branch main --limit 5`

**Related Issue:** #455 - Harden GitHub Actions secrets and branch protection
