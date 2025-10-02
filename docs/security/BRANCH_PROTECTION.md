# GitHub Branch Protection Configuration

**Version:** 1.0.0
**Last Updated:** 2025-10-01
**Severity:** CRITICAL
**Related Issue:** #455

## Executive Summary

Branch protection rules enforce security and quality standards by preventing direct pushes, requiring code reviews, and ensuring status checks pass before merging. This document provides configuration guidance for implementing branch protection on the `main` branch.

## Threat Model

### Risks Without Branch Protection

| Threat | Impact | Likelihood | Risk Score |
|--------|--------|------------|------------|
| Direct push to production | HIGH - Unreviewed code reaches users | MEDIUM | CRITICAL |
| Force push overwrites history | HIGH - Loss of audit trail | LOW | HIGH |
| Bypassed CI/CD checks | HIGH - Untested code deployed | MEDIUM | CRITICAL |
| Unsigned commits | MEDIUM - Attribution compromise | HIGH | MEDIUM |
| Branch deletion | HIGH - Code loss, workflow disruption | LOW | MEDIUM |

### Attack Vectors

1. **Compromised Credentials**: Attacker gains repo access, pushes malicious code
2. **Insider Threat**: Malicious developer bypasses review process
3. **Accidental Damage**: Developer force pushes, deletes branch inadvertently
4. **Supply Chain Attack**: Compromised CI/CD pipeline pushes vulnerable code

## Required Protection Rules

### 1. Pull Request Reviews (CRITICAL)

**Configuration:**
\`\`\`json
{
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false,
    "bypass_pull_request_allowances": {
      "users": [],
      "teams": [],
      "apps": []
    }
  }
}
\`\`\`

**Rationale:**
- Minimum 1 approval ensures code review before merge
- Stale review dismissal prevents approval of significantly changed code
- Code owner reviews optional (requires CODEOWNERS file)

**Trade-offs:**
- Single approval balances security with velocity for small teams
- Consider 2 approvals for production-critical repositories

### 2. Required Status Checks (CRITICAL)

Based on current CI/CD workflows, the following checks must pass:

**Configuration:**
\`\`\`json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-ci-config",
      "quick-validation",
      "security-check",
      "build-check",
      "code-quality",
      "root-tests",
      "build-test"
    ]
  }
}
\`\`\`

**Status Check Details:**

| Check Name | Workflow | Purpose | Timeout |
|------------|----------|---------|---------|
| \`validate-ci-config\` | main-branch-ci.yml | Verify secrets/vars configured | 2 min |
| \`quick-validation\` | main-branch-ci.yml | Lint, typecheck, unit tests | 10 min |
| \`security-check\` | main-branch-ci.yml | npm audit, TruffleHog secrets scan | 5 min |
| \`build-check\` | main-branch-ci.yml | Production build validation | 10 min |
| \`code-quality\` | ci-simplified.yml | Lint, security audit, secret scan | 20 min |
| \`root-tests\` | ci-simplified.yml | Integration tests with DB/Redis | 25 min |
| \`build-test\` | ci-simplified.yml | Full build with artifacts | 20 min |

**Strict Mode:**
- Requires branches be up-to-date with base before merging
- Prevents race conditions where multiple PRs pass checks independently
- Recommendation: Enable for high-risk repositories

**Trade-offs:**
- Strict mode increases rebase/merge frequency
- May slow down velocity with many concurrent PRs
- Consider disabling for rapid iteration phases

### 3. Restrict Force Pushes (CRITICAL)

**Configuration:**
\`\`\`json
{
  "allow_force_pushes": false
}
\`\`\`

**Rationale:**
- Preserves git history and audit trail
- Prevents accidental or malicious history rewriting
- Maintains commit signature chain integrity

**Exceptions:**
- Force pushes never required for main/master branches
- Use feature branches for experimental work

### 4. Restrict Branch Deletions (CRITICAL)

**Configuration:**
\`\`\`json
{
  "allow_deletions": false
}
\`\`\`

**Rationale:**
- Prevents accidental deletion of primary integration branch
- Maintains long-term history for compliance/audit
- Protects against malicious destruction of codebase

### 5. Require Signed Commits (RECOMMENDED)

**Configuration:**
\`\`\`json
{
  "required_signatures": true
}
\`\`\`

**Rationale:**
- Cryptographic verification of commit author identity
- Prevents commit spoofing and attribution attacks
- Industry best practice for security-conscious projects

**Setup Required:**
1. Developers must configure GPG keys: https://docs.github.com/en/authentication/managing-commit-signature-verification
2. Git client configured with \`git config --global commit.gpgsign true\`
3. Team training on key management

**Trade-offs:**
- Initial setup overhead for team members
- Key rotation/expiry management required
- Some CI/CD systems need special configuration

**Recommendation:**
- Enable for production repositories
- Consider optional for internal/experimental projects
- Enforce organization-wide via GitHub org settings

## Complete Configuration

### Minimal Security Profile (Recommended for Most Projects)

\`\`\`json
{
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-ci-config",
      "quick-validation",
      "security-check",
      "build-check"
    ]
  },
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_signatures": false,
  "enforce_admins": true
}
\`\`\`

### High Security Profile (Production-Critical Systems)

\`\`\`json
{
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2,
    "require_last_push_approval": true
  },
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-ci-config",
      "quick-validation",
      "security-check",
      "build-check",
      "code-quality",
      "root-tests",
      "build-test"
    ]
  },
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_signatures": true,
  "required_linear_history": true,
  "required_conversation_resolution": true,
  "enforce_admins": true
}
\`\`\`

## Implementation Guide

### Method 1: GitHub Web UI (Manual)

**Steps:**

1. Navigate to repository: https://github.com/ryanmaclean/vibecode-webgui
2. Go to **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule**
4. Configure:
   - Branch name pattern: \`main\`
   - Check: **Require a pull request before merging**
     - Required approvals: \`1\`
     - Check: **Dismiss stale pull request approvals when new commits are pushed**
   - Check: **Require status checks to pass before merging**
     - Check: **Require branches to be up to date before merging**
     - Search and add status checks: \`validate-ci-config\`, \`quick-validation\`, \`security-check\`, \`build-check\`
   - Check: **Require conversation resolution before merging** (optional)
   - Check: **Require signed commits** (recommended)
   - Check: **Do not allow bypassing the above settings**
   - **Uncheck**: Allow force pushes
   - **Uncheck**: Allow deletions
5. Click **Create** or **Save changes**

**Validation:**
- Run: \`./scripts/security/check-branch-protection.sh\`
- Attempt direct push to main (should fail)
- Create test PR without approval (merge should be blocked)

### Method 2: Automated Script

**Prerequisites:**
\`\`\`bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login
\`\`\`

**Usage:**
\`\`\`bash
# Apply recommended profile
./scripts/security/enable-branch-protection.sh main recommended

# Apply minimal profile
./scripts/security/enable-branch-protection.sh main minimal

# Apply high security profile
./scripts/security/enable-branch-protection.sh main high-security
\`\`\`

See \`scripts/security/enable-branch-protection.sh\` for implementation details.

## Validation

### Automated Validation Script

**Location:** \`scripts/security/check-branch-protection.sh\`

**Usage:**
\`\`\`bash
./scripts/security/check-branch-protection.sh
\`\`\`

**Expected Output:**
\`\`\`
🔍 Checking branch protection for ryanmaclean/vibecode-webgui:main

✅ Branch protection enabled
✅ Pull request reviews required (1 approval)
✅ Stale review dismissal enabled
✅ Status checks required
✅ Strict status check mode enabled
✅ Required status checks configured: 4
✅ Force pushes disabled
✅ Branch deletions disabled
⚠️  Signed commits not required (recommended)
✅ Admin enforcement enabled

Branch Protection Score: 9/10 (STRONG)
\`\`\`

### Manual Validation Tests

**Test 1: Direct Push Protection**
\`\`\`bash
# Should fail with protection error
git checkout main
echo "test" >> README.md
git commit -am "test: direct push"
git push origin main
# Expected: ERROR: Branch protection prevents direct push
\`\`\`

**Test 2: PR Without Approval**
\`\`\`bash
# Create test PR
gh pr create --base main --head feature/test --title "Test PR"

# Attempt merge without approval
gh pr merge --auto
# Expected: ERROR: Pull request requires 1 approval
\`\`\`

## Maintenance

### Quarterly Review Checklist

- [ ] Verify required status checks match current CI/CD workflows
- [ ] Review bypass allowances (users/teams/apps)
- [ ] Audit admin enforcement settings
- [ ] Check for new GitHub protection features
- [ ] Update documentation with configuration changes
- [ ] Validate signed commit adoption rate (if enabled)

### When to Update Rules

**Add New Status Checks:**
- New critical CI/CD jobs added to workflows
- Security scanning tools integrated
- Performance/compliance gates implemented

**Adjust Approval Count:**
- Team size changes significantly
- Risk profile increases (2+ approvals)
- Velocity bottlenecks require reduction

## Troubleshooting

### Issue: Merge Button Disabled

**Symptom:** PR approved but merge button grayed out

**Diagnosis:**
1. Check required status checks: All must be green
2. Verify branch is up-to-date (if strict mode enabled)
3. Confirm all conversations resolved (if required)
4. Check for admin enforcement blocking admins

**Resolution:**
\`\`\`bash
# Update branch with main
git checkout feature-branch
git pull origin main
git push origin feature-branch
\`\`\`

### Issue: Status Check Not Required

**Symptom:** Status check runs but doesn't block merge

**Diagnosis:**
- Check job name in workflow matches protection rule
- Verify workflow runs on PR events
- Confirm job doesn't use \`continue-on-error: true\`

**Resolution:**
\`\`\`bash
# Get current required checks
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection/required_status_checks

# Add missing check
gh api --method PATCH \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection/required_status_checks \
  -f contexts[]=missing-check-name
\`\`\`

## Compliance & Audit

### Compliance Mappings

| Framework | Control | Branch Protection Rule |
|-----------|---------|------------------------|
| SOC 2 | CC6.1 - Logical Access | PR reviews, status checks |
| PCI DSS | 6.3.2 - Code Reviews | Required approvals |
| ISO 27001 | A.12.1.4 - Separation of Environments | Status checks prevent untested code |
| NIST 800-53 | CM-3 - Configuration Change Control | PR reviews, approval workflow |

## References

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub REST API - Branch Protection](https://docs.github.com/en/rest/branches/branch-protection)
- [Signed Commits Guide](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- Issue #455: GitHub Actions Secrets and Branch Protection Hardening

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-01 | Initial documentation with validation script |

---

**IMPORTANT:** This document provides guidance for manual configuration. Actual branch protection must be enabled by a repository administrator via GitHub web UI, CLI, or API as described above.
