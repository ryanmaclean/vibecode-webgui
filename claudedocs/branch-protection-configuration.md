# Branch Protection Configuration Guide

**Purpose**: Configure GitHub branch protection for the main branch to prevent unauthorized changes and enforce security gates.

**Priority**: CRITICAL - Must be implemented immediately

## Current Status

Branch protection is **NOT CONFIGURED** on the main branch:

```bash
$ gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection
{"message":"Branch not protected"}
```

## Recommended Configuration

### Required Settings for Main Branch

#### 1. Require Pull Request Reviews

```yaml
require_pull_request_reviews:
  required_approving_review_count: 2
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
  require_last_push_approval: false
```

**Justification**:
- 2 approvers ensure peer review and reduce single points of failure
- Stale review dismissal ensures current code is reviewed
- Code owner reviews enforce domain expertise

#### 2. Require Status Checks

```yaml
required_status_checks:
  strict: true
  checks:
    - context: "security-scan"
      app_id: -1  # GitHub Actions
    - context: "test-coverage"
      app_id: -1
    - context: "secret-scanning / trufflehog"
      app_id: -1
    - context: "build / build"
      app_id: -1
```

**Justification**:
- `strict: true` requires branch to be up-to-date before merge
- Security scan catches vulnerabilities before merge
- Test coverage ensures code quality gates
- Secret scanning prevents credential leaks
- Build verification ensures code compiles

#### 3. Require Conversation Resolution

```yaml
require_conversation_resolution: true
```

**Justification**: Ensures all review comments are addressed before merge

#### 4. Require Linear History

```yaml
required_linear_history: true
```

**Justification**:
- Clean Git history for auditing
- Easier to revert changes
- Better for compliance tracking

#### 5. Restrict Push Access

```yaml
restrictions:
  users: []
  teams: []
  apps: []
```

**Justification**: Only allow merges via pull requests, no direct pushes

#### 6. Enforce for Administrators

```yaml
enforce_admins: true
```

**Justification**: Security rules apply to everyone, including repository admins

#### 7. Allow Force Pushes: Disabled

```yaml
allow_force_pushes: false
```

**Justification**: Prevents history rewriting and accidental data loss

#### 8. Allow Deletions: Disabled

```yaml
allow_deletions: false
```

**Justification**: Prevents accidental branch deletion

## Implementation Methods

### Method 1: GitHub Web UI (Recommended for Initial Setup)

1. Navigate to repository settings
2. Go to "Branches" → "Branch protection rules"
3. Click "Add rule"
4. Enter branch name pattern: `main`
5. Configure settings:
   - ✅ Require a pull request before merging
     - Required approvals: 2
     - ✅ Dismiss stale pull request approvals when new commits are pushed
     - ✅ Require review from Code Owners
   - ✅ Require status checks to pass before merging
     - ✅ Require branches to be up to date before merging
     - Search and add:
       - `security-scan`
       - `test-coverage`
       - `secret-scanning / trufflehog`
       - `build / build`
   - ✅ Require conversation resolution before merging
   - ✅ Require linear history
   - ✅ Do not allow bypassing the above settings
   - ✅ Restrict who can push to matching branches (leave empty for PR-only)
   - ❌ Allow force pushes (keep disabled)
   - ❌ Allow deletions (keep disabled)
6. Click "Create" or "Save changes"

### Method 2: GitHub CLI (Scriptable)

```bash
# Create branch protection rule
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false
  },
  "required_status_checks": {
    "strict": true,
    "checks": [
      {"context": "security-scan", "app_id": -1},
      {"context": "test-coverage", "app_id": -1},
      {"context": "secret-scanning / trufflehog", "app_id": -1},
      {"context": "build / build", "app_id": -1}
    ]
  },
  "enforce_admins": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "restrictions": null
}
EOF
```

### Method 3: Terraform (Infrastructure as Code)

```hcl
resource "github_branch_protection" "main" {
  repository_id = "vibecode-webgui"
  pattern       = "main"

  required_pull_request_reviews {
    required_approving_review_count = 2
    dismiss_stale_reviews          = true
    require_code_owner_reviews     = true
    require_last_push_approval     = false
  }

  required_status_checks {
    strict = true
    contexts = [
      "security-scan",
      "test-coverage",
      "secret-scanning / trufflehog",
      "build / build"
    ]
  }

  enforce_admins              = true
  require_conversation_resolution = true
  require_signed_commits      = false  # Optional
  required_linear_history     = true
  allow_force_pushes          = false
  allow_deletions             = false
}
```

## Optional Enhancements

### 1. Require Signed Commits (Optional)

```yaml
require_signed_commits: true
```

**Considerations**:
- Requires all contributors to set up GPG keys
- Adds verification but increases setup complexity
- Recommended for high-security projects
- **Current recommendation**: Enable after team training

### 2. Require Deployments to Succeed (Optional)

```yaml
required_deployments:
  environments:
    - staging
```

**Considerations**:
- Ensures successful deployment to staging before merge
- Adds time to merge process
- **Current recommendation**: Consider for future implementation

### 3. Lock Branch (Temporary Use Only)

```yaml
lock_branch: true
```

**Use case**: Emergency lock during security incidents or major migrations

## Verification Steps

After configuring branch protection:

1. **Test PR Creation**:
```bash
git checkout -b test-branch-protection
echo "test" > test.txt
git add test.txt
git commit -m "test: verify branch protection"
git push origin test-branch-protection
gh pr create --title "Test Branch Protection" --body "Verification test"
```

2. **Verify Requirements**:
   - Attempt direct push to main (should fail)
   - Create PR without approvals (should block merge)
   - Create PR without passing checks (should block merge)
   - Verify 2 approvals required before merge button enables

3. **Test Status Checks**:
```bash
# Verify these workflows exist and run on PR:
gh pr checks
# Should show: security-scan, test-coverage, secret-scanning, build
```

4. **Verify Protection Applied**:
```bash
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection | jq .
```

Expected output should show all protection rules configured.

## Status Check Workflow Names

Ensure these workflows exist and run on pull_request events:

| Status Check Name | Workflow File | Job Name |
|-------------------|---------------|----------|
| security-scan | security-audit.yml | security-scan |
| test-coverage | test-coverage.yml | test / coverage |
| secret-scanning / trufflehog | secret-scanning.yml | trufflehog |
| build / build | main-branch-ci.yml or ci-simplified.yml | build |

**Action Required**: Verify workflow job names match required status check contexts.

## Rollback Plan

If branch protection causes issues:

1. **Temporary Bypass** (Emergency Only):
   - Settings → Branches → Edit rule → Uncheck "Do not allow bypassing"
   - Admin can then override protection

2. **Full Removal**:
```bash
gh api repos/ryanmaclean/vibecode-webgui/branches/main/protection \
  --method DELETE
```

3. **Adjust Settings**:
   - Reduce required reviewers from 2 to 1
   - Remove specific status checks causing issues
   - Disable linear history if rebasing needed

## Monitoring and Maintenance

### Weekly Review
- Check PR merge times (target: <2 hours with approvals)
- Review bypassed protections (should be zero)
- Verify status checks passing consistently

### Monthly Review
- Review and update required status checks
- Assess reviewer availability and adjust count if needed
- Check for protection rule violations in audit log

### Audit Log Monitoring

```bash
# Check recent branch protection events
gh api repos/ryanmaclean/vibecode-webgui/events \
  --jq '.[] | select(.type == "ProtectedBranchEvent") | {actor: .actor.login, action: .payload.action, timestamp: .created_at}'
```

## Related Documentation

- GitHub Branch Protection Rules: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- Required Status Checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging
- Code Owner Reviews: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

## Implementation Checklist

- [ ] Review and approve protection configuration with team
- [ ] Verify all required status check workflows exist
- [ ] Configure branch protection via GitHub UI or CLI
- [ ] Test protection with dummy PR
- [ ] Document protection rules in repository
- [ ] Train team on new PR workflow
- [ ] Monitor initial PRs for issues
- [ ] Establish bypass procedures for emergencies

---

**Implementation Deadline**: Within 1 week
**Owner**: Repository Administrator
**Approval Required**: Yes (security team + engineering lead)
