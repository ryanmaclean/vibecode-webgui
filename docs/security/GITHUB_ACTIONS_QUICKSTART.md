# GitHub Actions Security Quickstart

**Estimated Time:** 30 minutes
**Risk Level:** HIGH - Immediate action required
**Related:** Issue #455, #416

## Quick Assessment

Run this one-liner to see your current risk exposure:

```bash
gh api repos/:owner/:repo/actions/secrets | jq -r '.secrets[].name' && \
gh api repos/:owner/:repo/branches/main/protection | jq -r '.required_pull_request_reviews'
```

If you see `null` for branch protection, you're at risk.

---

## Priority Actions (Next 30 Minutes)

### 1. Enable Branch Protection (5 minutes)

Protect main branch from direct pushes and workflow modifications:

```bash
# Set repository variables
REPO_OWNER="ryanmaclean"
REPO_NAME="vibecode-webgui"

# Enable branch protection with required reviews
gh api -X PUT "repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build-and-push", "security-scan"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
```

**Verify it worked:**

```bash
gh api repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection | \
  jq '{reviews: .required_pull_request_reviews.required_approving_review_count, enforce_admins: .enforce_admins.enabled}'
```

### 2. Audit Secrets Usage (10 minutes)

Find all secrets used across workflows:

```bash
# Create audit script
cat > /tmp/audit-secrets.sh <<'SCRIPT'
#!/bin/bash
set -euo pipefail

echo "=== Secrets Usage Audit ==="
echo "Repository: $(git remote get-url origin)"
echo "Date: $(date)"
echo ""

echo "## Configured Secrets"
gh api repos/:owner/:repo/actions/secrets | jq -r '.secrets[] | "- \(.name) (updated: \(.updated_at))"'
echo ""

echo "## Workflow File Analysis"
for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
  if [ -f "$workflow" ]; then
    echo ""
    echo "### $workflow"
    grep -n "secrets\." "$workflow" || echo "  No secrets referenced"
  fi
done

echo ""
echo "## HIGH RISK: Secrets Used Without Environment Protection"
for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
  if [ -f "$workflow" ]; then
    if grep -q "secrets\." "$workflow" && ! grep -q "environment:" "$workflow"; then
      echo "  ⚠️  $workflow - Uses secrets without environment protection"
    fi
  fi
done

echo ""
echo "## Environment Protection Status"
gh api repos/:owner/:repo/environments | jq -r '.environments[]? | "- \(.name): \(.protection_rules | length) protection rules"'
SCRIPT

chmod +x /tmp/audit-secrets.sh
/tmp/audit-secrets.sh > docs/security/secrets-audit-$(date +%Y%m%d).txt

echo "Audit saved to: docs/security/secrets-audit-$(date +%Y%m%d).txt"
```

**Expected output shows:**
- Which secrets exist (not their values)
- Where they're used in workflows
- Workflows missing environment protection

### 3. Create Protected Environments (10 minutes)

Move sensitive secrets behind approval gates:

```bash
# Create production environment with required reviewers
gh api -X PUT "repos/${REPO_OWNER}/${REPO_NAME}/environments/production" \
  --input - <<'EOF'
{
  "wait_timer": 0,
  "reviewers": [
    {
      "type": "User",
      "id": YOUR_GITHUB_USER_ID
    }
  ],
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
EOF

# Get your GitHub user ID
YOUR_USER_ID=$(gh api user | jq -r '.id')
echo "Your GitHub User ID: ${YOUR_USER_ID}"
```

**For Docker Hub credentials:**

```bash
# Move DOCKERHUB_TOKEN to production environment
gh secret set DOCKERHUB_TOKEN --env production
gh secret set DOCKERHUB_USERNAME --env production

# Verify it's in the environment
gh api repos/${REPO_OWNER}/${REPO_NAME}/environments/production/secrets | \
  jq -r '.secrets[].name'
```

---

## Token Rotation Checklist

### Docker Hub Token (Current HIGH RISK)

**Step 1: Create new token with minimal permissions**

```bash
# Manual step: Visit https://hub.docker.com/settings/security
# 1. Click "New Access Token"
# 2. Name: "vibecode-webgui-ghactions-$(date +%Y%m)"
# 3. Permissions: "Read, Write" (NOT Admin)
# 4. Copy the token immediately
```

**Step 2: Test new token locally**

```bash
# Save new token temporarily
export NEW_DOCKER_TOKEN="dckr_pat_xxxxxxxxxxxx"

# Test authentication
echo "$NEW_DOCKER_TOKEN" | docker login -u ryanmaclean --password-stdin

# Test push to verify write permissions
docker pull alpine:latest
docker tag alpine:latest ryanmaclean/test-auth:$(date +%s)
docker push ryanmaclean/test-auth:$(date +%s)

# Cleanup
docker logout
unset NEW_DOCKER_TOKEN
```

**Step 3: Update GitHub secret**

```bash
# Update the secret (paste token when prompted)
gh secret set DOCKERHUB_TOKEN --env production --repo ${REPO_OWNER}/${REPO_NAME}
```

**Step 4: Trigger test workflow**

```bash
# Run build workflow to test new token
gh workflow run build-and-push-image.yml

# Monitor the run
gh run watch
```

**Step 5: Revoke old token**

```bash
# Manual step: Visit https://hub.docker.com/settings/security
# Find the old token and click "Delete"
```

### Azure Credentials

**Check current permissions:**

```bash
# Decode and inspect current credentials (if you have jq)
gh secret list | grep AZURE_CREDENTIALS
# Note: Cannot view actual secret value via CLI
```

**Rotate service principal:**

```bash
# Create new credentials with minimal scope
az ad sp create-for-rbac \
  --name "vibecode-ghactions-$(date +%Y%m)" \
  --role "Contributor" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/YOUR_RG" \
  --sdk-auth > /tmp/azure-creds.json

# Update GitHub secret
gh secret set AZURE_CREDENTIALS < /tmp/azure-creds.json --env production

# Securely delete temporary file
shred -u /tmp/azure-creds.json 2>/dev/null || rm -P /tmp/azure-creds.json
```

**Revoke old credentials:**

```bash
# List service principals
az ad sp list --display-name vibecode-ghactions --output table

# Delete old ones (by app ID)
az ad sp delete --id <OLD_APP_ID>
```

### Datadog API Keys

**Create new API key:**

```bash
# Manual: Visit https://app.datadoghq.com/organization-settings/api-keys
# 1. Click "New Key"
# 2. Name: "vibecode-webgui-ghactions-$(date +%Y%m)"
# 3. Copy key immediately
```

**Update and test:**

```bash
# Update secret
gh secret set DATADOG_API_KEY --env production

# Test with curl
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: ${DATADOG_API_KEY}"
# Should return: {"valid": true}
```

---

## Workflow Configuration Updates

### Add Environment Protection to Workflows

**For workflows using DOCKERHUB_TOKEN:**

```yaml
# In .github/workflows/build-and-push-image.yml
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    environment: production  # ← ADD THIS LINE
    steps:
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
```

**For workflows using AZURE_CREDENTIALS:**

```yaml
# Already configured correctly in deploy-to-aks job
deploy-to-aks:
  environment: production  # ✅ Already protected
  steps:
    - uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
```

### Require Approval for Fork PRs

```bash
# Enable fork PR approval requirement
gh api -X PATCH "repos/${REPO_OWNER}/${REPO_NAME}" \
  --field allow_forking=true

# This is already configured in Settings > Actions > General
# Manual check: Visit https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/actions
# Ensure "Require approval for all outside collaborators" is enabled
```

---

## Verification Steps

### 1. Test Branch Protection

```bash
# Try to push directly to main (should fail)
git checkout main
echo "test" >> test.txt
git add test.txt
git commit -m "Test: Direct push should fail"
git push origin main
# Expected: "refusing to allow an OAuth App to create or update workflow"
```

### 2. Test Environment Protection

```bash
# Trigger a workflow that uses protected secrets
gh workflow run build-and-push-image.yml

# Check if approval is required
gh run list --workflow=build-and-push-image.yml --limit 1 | grep waiting
```

### 3. Validate Secret Isolation

```bash
# Ensure secrets aren't in repository secrets anymore
gh api repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets | \
  jq -r '.secrets[] | select(.name | contains("DOCKER") or contains("AZURE"))'
# Should return empty if moved to environments
```

---

## Rollback Procedures

### If Branch Protection Breaks Automation

```bash
# Temporarily disable enforcement for admins
gh api -X PATCH "repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection" \
  --field enforce_admins=false

# Make necessary changes, then re-enable
gh api -X PATCH "repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection" \
  --field enforce_admins=true
```

### If New Token Fails

```bash
# Use old token temporarily (if not revoked yet)
gh secret set DOCKERHUB_TOKEN --env production
# Paste OLD token when prompted

# Debug the issue
gh run list --workflow=build-and-push-image.yml --limit 1
gh run view <RUN_ID> --log-failed
```

### If Environment Blocks Legitimate Deploy

```bash
# Bypass for emergency (requires admin)
gh api -X POST "repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/<RUN_ID>/approve"
```

---

## Post-Implementation Checklist

- [ ] Branch protection enabled on `main`
- [ ] Required status checks configured
- [ ] `production` environment created with reviewers
- [ ] Docker Hub token rotated and moved to environment
- [ ] Azure credentials rotated and moved to environment
- [ ] Datadog API key rotated and moved to environment
- [ ] Workflow files updated with `environment: production`
- [ ] Fork PR approval enabled
- [ ] All workflows tested with new configuration
- [ ] Old tokens/credentials revoked
- [ ] Documentation updated in `docs/SECURITY.md`
- [ ] Team notified of new approval process

---

## Monitoring and Alerts

### Set Up GitHub Action Alerts

```bash
# Enable email notifications for failed workflows
# Manual: Visit https://github.com/settings/notifications
# Enable "Actions" under "Watching"
```

### Weekly Security Review

```bash
# Add to cron or run manually each Monday
cat > /tmp/weekly-security-check.sh <<'SCRIPT'
#!/bin/bash
echo "Weekly Security Check - $(date)"
echo ""

echo "1. Recent workflow runs with failures:"
gh run list --limit 10 --status failure

echo ""
echo "2. Secrets last updated:"
gh api repos/:owner/:repo/actions/secrets | jq -r '.secrets[] | "\(.name): \(.updated_at)"'

echo ""
echo "3. Branch protection status:"
gh api repos/:owner/:repo/branches/main/protection | jq -r '.required_pull_request_reviews'

echo ""
echo "4. Recent secret access (audit log - requires enterprise):"
gh api repos/:owner/:repo/audit-log --jq '.[] | select(.action == "repo.secret_accessed") | {actor: .actor, secret: .data.secret_name, timestamp: .created_at}'
SCRIPT

chmod +x /tmp/weekly-security-check.sh
```

---

## Additional Security Hardening

### OIDC for Azure (Passwordless)

Replace static credentials with OpenID Connect:

```yaml
# Future enhancement: Use OIDC instead of service principal
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

**Setup guide:** https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure

### IP Allowlisting for Environments

```bash
# Restrict deployment to GitHub Actions IPs only
# This requires GitHub Enterprise
# Manual configuration in environment settings
```

---

## Emergency Contacts

- **Security Issue:** Report via GitHub Security Advisories
- **Compromised Credentials:** Rotate immediately using procedures above
- **Questions:** Reference issue #455 or docs/SECURITY.md

**Last Updated:** 2025-10-01
**Next Review:** 2025-10-08
