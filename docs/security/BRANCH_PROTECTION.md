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
```json
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
```

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
```json
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
```

**Status Check Details:**

| Check Name | Workflow | Purpose | Timeout |
|------------|----------|---------|---------|
| `validate-ci-config` | main-branch-ci.yml | Verify secrets/vars configured | 2 min |
| `quick-validation` | main-branch-ci.yml | Lint, typecheck, unit tests | 10 min |
| `security-check` | main-branch-ci.yml | npm audit, TruffleHog secrets scan | 5 min |
| `build-check` | main-branch-ci.yml | Production build validation | 10 min |
| `code-quality` | ci-simplified.yml | Lint, security audit, secret scan | 20 min |
| `root-tests` | ci-simplified.yml | Integration tests with DB/Redis | 25 min |
| `build-test` | ci-simplified.yml | Full build with artifacts | 20 min |

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
```json
{
  "allow_force_pushes": false
}
```

**Rationale:**
- Preserves git history and audit trail
- Prevents accidental or malicious history rewriting
- Maintains commit signature chain integrity

**Exceptions:**
- Force pushes never required for main/master branches
- Use feature branches for experimental work

### 4. Restrict Branch Deletions (CRITICAL)

**Configuration:**
```json
{
  "allow_deletions": false
}
```

**Rationale:**
- Prevents accidental deletion of primary integration branch
- Maintains long-term history for compliance/audit
- Protects against malicious destruction of codebase

### 5. Require Signed Commits (RECOMMENDED)

**Configuration:**
```json
{
  "required_signatures": true
}
```

**Rationale:**
- Cryptographic verification of commit author identity
- Prevents commit spoofing and attribution attacks
- Industry best practice for security-conscious projects

**Setup Required:**
1. Developers must configure GPG keys: https://docs.github.com/en/authentication/managing-commit-signature-verification
2. Git client configured with `git config --global commit.gpgsign true`
3. Team training on key management

**Trade-offs:**
- Initial setup overhead for team members
- Key rotation/expiry management required
- Some CI/CD systems need special configuration

**Recommendation:**
- Enable for production repositories
- Consider optional for internal/experimental projects
- Enforce organization-wide via GitHub org settings

### 6. Require Linear History (OPTIONAL)

**Configuration:**
```json
{
  "required_linear_history": true
}
```

**Rationale:**
- Prevents merge commits, enforces rebase or squash-merge
- Cleaner git history for auditing and debugging
- Easier to revert specific features

**Trade-offs:**
- Developers must be comfortable with rebase workflows
- May complicate feature branch collaboration
- Not recommended for teams new to git

**Recommendation:** Optional - enable only if team is experienced with rebase

### 7. Conversation Resolution (OPTIONAL)

**Configuration:**
```json
{
  "required_conversation_resolution": true
}
```

**Rationale:**
- Ensures all PR review comments addressed before merge
- Prevents overlooked feedback or unresolved questions

**Trade-offs:**
- May slow PR velocity if reviewers don't actively resolve threads
- Can be bypassed by resolving without addressing feedback

**Recommendation:** Enable for thorough review processes

## Complete Configuration

### Minimal Security Profile (Recommended for Most Projects)

```json
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
```

### High Security Profile (Production-Critical Systems)

```json
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
```

## Implementation Guide

### Method 1: GitHub Web UI (Manual)

**Steps:**

1. Navigate to repository: https://github.com/ryanmaclean/vibecode-webgui
2. Go to **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule**
4. Configure:
   - Branch name pattern: `main`
   - Check: **Require a pull request before merging**
     - Required approvals: `1`
     - Check: **Dismiss stale pull request approvals when new commits are pushed**
   - Check: **Require status checks to pass before merging**
     - Check: **Require branches to be up to date before merging**
     - Search and add status checks:
       - `validate-ci-config`
       - `quick-validation`
       - `security-check`
       - `build-check`
   - Check: **Require conversation resolution before merging** (optional)
   - Check: **Require signed commits** (recommended)
   - Check: **Do not allow bypassing the above settings**
   - **Uncheck**: Allow force pushes
   - **Uncheck**: Allow deletions
5. Click **Create** or **Save changes**

**Validation:**
- Run: `/Users/ryan.maclean/vibecode-webgui/scripts/security/check-branch-protection.sh`
- Attempt direct push to main (should fail)
- Create test PR without approval (merge should be blocked)

### Method 2: GitHub CLI (Automated)

**Prerequisites:**
```bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login
```

**Script:**
```bash
#!/usr/bin/env bash
# File: scripts/security/enable-branch-protection.sh

set -euo pipefail

OWNER="ryanmaclean"
REPO="vibecode-webgui"
BRANCH="main"

echo "Enabling branch protection for ${OWNER}/${REPO}:${BRANCH}..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]=validate-ci-config \
  -f required_status_checks[contexts][]=quick-validation \
  -f required_status_checks[contexts][]=security-check \
  -f required_status_checks[contexts][]=build-check \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f enforce_admins=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f required_signatures=false

echo "✅ Branch protection enabled successfully"
```

**Usage:**
```bash
chmod +x scripts/security/enable-branch-protection.sh
./scripts/security/enable-branch-protection.sh
```

### Method 3: GitHub REST API (Programmatic)

**Prerequisites:**
- GitHub Personal Access Token with `repo` scope
- Export as `GITHUB_TOKEN` environment variable

**cURL Example:**
```bash
#!/usr/bin/env bash

OWNER="ryanmaclean"
REPO="vibecode-webgui"
BRANCH="main"
API_URL="https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"

curl -X PUT "${API_URL}" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": [
        "validate-ci-config",
        "quick-validation",
        "security-check",
        "build-check"
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false,
      "required_approving_review_count": 1
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_signatures": false
  }'
```

## Validation

### Automated Validation Script

**Location:** `/Users/ryan.maclean/vibecode-webgui/scripts/security/check-branch-protection.sh`

**Usage:**
```bash
./scripts/security/check-branch-protection.sh
```

**Expected Output:**
```
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
```

### Manual Validation Tests

**Test 1: Direct Push Protection**
```bash
# Should fail with protection error
git checkout main
echo "test" >> README.md
git commit -am "test: direct push"
git push origin main
# Expected: ERROR: Branch protection prevents direct push
```

**Test 2: PR Without Approval**
```bash
# Create test PR
gh pr create --base main --head feature/test --title "Test PR"

# Attempt merge without approval
gh pr merge --auto
# Expected: ERROR: Pull request requires 1 approval
```

**Test 3: Failed Status Checks**
```bash
# Create PR with failing tests
# Push code that breaks lint/tests
# Expected: Merge button disabled until checks pass
```

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

**Enable/Disable Features:**
- Signed commits: Enable when team trained on GPG
- Linear history: Enable when team comfortable with rebase
- Conversation resolution: Enable for formal review processes

## Troubleshooting

### Issue: Merge Button Disabled

**Symptom:** PR approved but merge button grayed out

**Diagnosis:**
1. Check required status checks: All must be green
2. Verify branch is up-to-date (if strict mode enabled)
3. Confirm all conversations resolved (if required)
4. Check for admin enforcement blocking admins

**Resolution:**
```bash
# Update branch with main
git checkout feature-branch
git pull origin main
git push origin feature-branch

# Or use GitHub UI "Update branch" button
```

### Issue: Status Check Not Required

**Symptom:** Status check runs but doesn't block merge

**Diagnosis:**
- Check job name in workflow matches protection rule
- Verify workflow runs on PR events
- Confirm job doesn't use `continue-on-error: true`

**Resolution:**
```bash
# Get current required checks
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection/required_status_checks

# Add missing check
gh api --method PATCH \
  repos/ryanmaclean/vibecode-webgui/branches/main/protection/required_status_checks \
  -f contexts[]=missing-check-name
```

### Issue: Admin Bypass Not Working

**Symptom:** Repository admin cannot bypass protections

**Diagnosis:**
- Check if "Do not allow bypassing" is enabled
- Verify user has admin role, not just write access

**Resolution:**
- Temporarily disable admin enforcement for emergency fixes
- Re-enable immediately after fix merged

## Compliance & Audit

### Audit Log Queries

**View Protection Changes:**
```bash
gh api /repos/ryanmaclean/vibecode-webgui/events \
  --jq '.[] | select(.type == "ProtectionEvent")'
```

**Track Failed Push Attempts:**
- GitHub UI: Settings → Security → Push protections → View logs
- Webhook events: Configure webhook for `push` events with protected branch filters

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
- [OWASP Secure Development Lifecycle](https://owasp.org/www-project-secure-software-development-lifecycle/)
- Issue #455: GitHub Actions Secrets and Branch Protection Hardening

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-01 | Initial documentation with validation script |

---

**IMPORTANT:** This document provides guidance for manual configuration. Actual branch protection must be enabled by a repository administrator via GitHub web UI, CLI, or API as described above.
