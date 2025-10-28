# Branch Protection Quickstart Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-01
**Estimated Time:** 5 minutes
**Related Issue:** #455

## Overview

This quickstart enables branch protection on the `main` branch with recommended security settings. Follow these steps in order to ensure safe enablement.

---

## 1. Pre-Flight Checklist

Before enabling branch protection, verify the following:

### Repository Access
- [ ] You have **admin** access to `ryanmaclean/vibecode-webgui`
- [ ] GitHub CLI installed: `gh --version`
- [ ] GitHub CLI authenticated: `gh auth status`

```bash
# Install GitHub CLI (if needed)
brew install gh

# Authenticate
gh auth login
```

### CI/CD Status
- [ ] All CI/CD workflows are passing on main branch
- [ ] Required status checks exist and run successfully:
  - `validate-ci-config` (main-branch-ci.yml)
  - `quick-validation` (main-branch-ci.yml)
  - `security-check` (main-branch-ci.yml)
  - `build-check` (main-branch-ci.yml)
  - `code-quality` (ci-simplified.yml)
  - `root-tests` (ci-simplified.yml)
  - `build-test` (ci-simplified.yml)

```bash
# Verify recent workflow runs
gh run list --branch main --limit 3
```

### Team Readiness
- [ ] Team knows branch protection is being enabled
- [ ] Team understands PR workflow requirements
- [ ] Team has GPG keys configured (for signed commits)

---

## 2. Enable Branch Protection

### Recommended Profile (One Command)

Execute this single command to enable branch protection with recommended settings:

```bash
./scripts/security/enable-branch-protection.sh main recommended
```

**What this enables:**
- Pull request reviews required (1 approval minimum)
- Stale review dismissal on new commits
- All 7 CI/CD status checks required
- Strict mode (branch must be up-to-date before merge)
- Force pushes disabled
- Branch deletions disabled
- Signed commits required
- Admin enforcement enabled

### Alternative Profiles

**Minimal Profile** (Faster velocity, lower security):
```bash
./scripts/security/enable-branch-protection.sh main minimal
```
- Only 4 critical status checks required
- No signed commit requirement

**High Security Profile** (Maximum protection):
```bash
./scripts/security/enable-branch-protection.sh main high-security
```
- 2 approvals required
- Code owner reviews required (needs CODEOWNERS file)
- Linear history enforced
- Conversation resolution required

---

## 3. Validate Configuration

### Run Validation Script

```bash
./scripts/security/check-branch-protection.sh
```

**Expected Output:**
```
Branch Protection Score: 9/10 (90%) - STRONG

✅ Branch protection enabled
✅ Pull request reviews required (1 approval)
✅ Stale review dismissal enabled
✅ Status checks required
✅ Strict status check mode enabled
✅ Required status checks configured: 7
✅ Force pushes disabled
✅ Branch deletions disabled
✅ Signed commits required
✅ Admin enforcement enabled
```

**Minimum acceptable score:** 7/10 (MODERATE)
**Target score:** 9/10 (STRONG)

---

## 4. Test PR Workflow

Create a test pull request to verify protection is working:

### Test 1: Direct Push Blocked

```bash
# Should fail with protection error
git checkout main
echo "# Test" >> README.md
git commit -am "test: direct push"
git push origin main

# Expected: ERROR - Branch protection prevents direct push
```

### Test 2: PR Without Approval Blocked

```bash
# Create test branch and PR
git checkout -b test/branch-protection-validation
echo "# Branch Protection Test" >> test-file.md
git add test-file.md
git commit -m "test: branch protection validation"
git push origin test/branch-protection-validation

# Create PR
gh pr create --base main --head test/branch-protection-validation \
  --title "Test: Branch Protection Validation" \
  --body "Testing branch protection configuration"

# Attempt merge without approval (should fail)
gh pr merge --auto

# Expected: ERROR - Pull request requires 1 approval
```

### Test 3: PR With Approval Succeeds

```bash
# Get PR number
PR_NUMBER=$(gh pr view --json number --jq '.number')

# Approve PR (requires different user or admin override)
gh pr review $PR_NUMBER --approve

# Merge PR
gh pr merge $PR_NUMBER --squash --delete-branch
```

### Cleanup

```bash
# Delete test file
git checkout main
git pull origin main
rm -f test-file.md
git commit -am "cleanup: remove test file"
git push origin main
```

---

## 5. Rollback Plan

If issues arise, branch protection can be temporarily disabled:

### Emergency Disable

```bash
# Disable branch protection completely
gh api --method DELETE \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection
```

### Selective Disable

```bash
# Disable only admin enforcement (allows admins to bypass)
gh api --method DELETE \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection/enforce_admins
```

### Re-enable After Fix

```bash
# Re-apply recommended profile
./scripts/security/enable-branch-protection.sh main recommended
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Status checks not appearing | Workflow hasn't run on main | Push commit or re-run workflow |
| Merge button disabled | Status checks failing | Fix failing tests, push fixes |
| Can't get approval | Team not configured | Temporarily use minimal profile |
| GPG signing errors | Keys not configured | See signed commits setup below |

---

## 6. Team Communication

### Announcement Template

Send this message to your team after enabling:

```
🔒 Branch Protection Enabled

We've enabled branch protection on the main branch to improve code quality and security.

What changed:
- Direct pushes to main are now blocked
- All changes require pull requests with 1 approval
- All CI/CD checks must pass before merging
- Signed commits are required (see setup below)

Your workflow:
1. Create feature branch: git checkout -b feature/your-feature
2. Make changes and commit with signing
3. Push and create PR: gh pr create
4. Request review from teammate
5. Merge after approval + green checks

Signed commit setup:
https://docs.github.com/en/authentication/managing-commit-signature-verification

Questions? See: docs/security/BRANCH_PROTECTION.md
```

### GPG Key Setup (Required for Signed Commits)

Share this with team members:

```bash
# 1. Generate GPG key (if needed)
gpg --full-generate-key

# 2. List keys and get key ID
gpg --list-secret-keys --keyid-format=long

# 3. Export public key
gpg --armor --export YOUR_KEY_ID

# 4. Add to GitHub: Settings → SSH and GPG keys → New GPG key

# 5. Configure Git
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# 6. Test signing
git commit --allow-empty -m "test: signed commit"
git log --show-signature -1
```

---

## Quick Reference

### Essential Commands

```bash
# Enable branch protection
./scripts/security/enable-branch-protection.sh main recommended

# Validate configuration
./scripts/security/check-branch-protection.sh

# View current protection rules
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection | jq

# Create PR from current branch
gh pr create --base main --title "Your title" --body "Description"

# Check PR status
gh pr status

# Merge approved PR
gh pr merge --squash --delete-branch
```

### Status Check Names

Copy-paste for manual configuration:

```
validate-ci-config
quick-validation
security-check
build-check
code-quality
root-tests
build-test
```

### Troubleshooting

**Script fails with "insufficient permissions":**
```bash
# Verify admin access
gh api repos/ryanmaclean/vibecode-webgui --jq '.permissions'
```

**Status checks not required:**
```bash
# Manually add missing check
gh api --method PATCH \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection/required_status_checks \
  -f contexts[]=missing-check-name -f strict=true
```

**Need to temporarily bypass:**
```bash
# Disable admin enforcement (allows admin bypass)
gh api --method DELETE \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection/enforce_admins
```

---

## Success Checklist

After completing enablement, verify:

- [ ] Validation script shows score ≥7/10
- [ ] Direct push to main blocked
- [ ] PR without approval cannot merge
- [ ] All required status checks listed
- [ ] Team notified and trained
- [ ] GPG key setup documentation shared
- [ ] Rollback plan understood and tested
- [ ] GitHub issue #455 updated with completion status

---

## Next Steps

1. **Monitor first week**: Watch for team friction or workflow issues
2. **Adjust if needed**: Switch to minimal profile if velocity drops significantly
3. **Quarterly review**: Verify status checks still match active workflows
4. **Expand protection**: Consider protecting `develop` or `staging` branches
5. **Advanced features**: Explore CODEOWNERS file for required reviewers

---

## Documentation

- **Full Documentation:** `docs/security/BRANCH_PROTECTION.md`
- **Enablement Script:** `scripts/security/enable-branch-protection.sh`
- **Validation Script:** `scripts/security/check-branch-protection.sh`
- **GitHub Docs:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- **Issue #455:** GitHub Actions Secrets and Branch Protection Hardening

---

## Support

**Issues?** Comment on GitHub issue #455 with:
- Script output from `check-branch-protection.sh`
- Error messages from enablement attempt
- Current workflow status: `gh run list --branch main --limit 5`

**Questions?** Review full documentation in `docs/security/BRANCH_PROTECTION.md`
