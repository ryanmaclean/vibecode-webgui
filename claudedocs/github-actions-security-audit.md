# GitHub Actions Security Audit Report

**Date**: 2025-10-02
**Issue**: #455 - Harden GitHub Actions secrets and branch protection
**Severity**: MEDIUM
**Status**: In Progress

## Executive Summary

Comprehensive security audit of 54 workflow files across the vibecode-webgui repository. Analysis identified several security issues requiring immediate attention, including potential secret exposure, missing branch protection, and inconsistent permission configurations.

## Scope

- Total workflow files audited: 54 (active) + additional disabled workflows
- Secret usage instances: 38 files with GITHUB_TOKEN, multiple custom secrets
- Branch protection status: **NOT CONFIGURED** on main branch
- Permissions configuration: Mixed (some explicit, many implicit)

## Critical Findings

### 1. Secret Exposure via Echo Commands (HIGH RISK)

**Status**: CONFIRMED VULNERABILITY

**Location**: Multiple workflows contain dangerous echo patterns:

```yaml
# gitops-deployment.yml:251, 357, 444, 626
echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config
echo "${{ secrets.KUBECONFIG_STAGING }}" | base64 -d > ~/.kube/config
echo "${{ secrets.KUBECONFIG_PRODUCTION }}" | base64 -d > ~/.kube/config

# agentapi-cicd.yml:635, 670, 730, 822, 824, 826
echo "${{ secrets.KUBECONFIG_DEV }}" | base64 -d > $HOME/.kube/config
echo "${{ secrets.KUBECONFIG_STAGING }}" | base64 -d > $HOME/.kube/config
echo "${{ secrets.KUBECONFIG_PROD }}" | base64 -d > $HOME/.kube/config

# deploy-next-docs.yml:186
echo "Deploying image ${IMAGE} to ${{ secrets.AZURE_WEBAPP_NAME }}"
```

**Risk**: While GitHub Actions automatically masks secret values, the base64 decode operation could potentially expose secrets in logs if masking fails or is bypassed.

**Impact**:
- KUBECONFIG secrets control full cluster access (production, staging, dev)
- Compromise would allow unauthorized Kubernetes operations
- Azure secrets exposed could lead to deployment hijacking

**Affected Files**:
- gitops-deployment.yml (4 instances)
- agentapi-cicd.yml (6 instances)
- deploy-next-docs.yml (1 instance)
- disabled-expensive/gitops-deployment.yml (4 instances)
- disabled-expensive/k8s-deploy.yml (2 instances)

### 2. Branch Protection Not Configured (CRITICAL)

**Status**: CONFIRMED

**Finding**: The main branch has NO protection rules configured.

```bash
$ gh api repos/.../branches/main/protection
{"message":"Branch not protected"}
```

**Risk**:
- Direct pushes to main without review
- No CI/CD validation gates
- Accidental or malicious code can be merged directly
- No signing requirement for commits

**Recommendation**: Implement comprehensive branch protection (detailed in recommendations section)

### 3. Missing or Inconsistent Permission Restrictions (MEDIUM)

**Status**: PARTIALLY IMPLEMENTED

**Finding**: Only 24 out of 54 active workflows explicitly define `permissions:` blocks.

**Files with explicit permissions** (good):
- secret-scanning.yml (read-only)
- test-arm64-standard.yml
- codeserver-profiles.yml
- deploy-aks-monitoring.yml
- security-audit.yml

**Files without explicit permissions** (30+ files):
- gitops-deployment.yml
- build-minimal.yml
- test-ci-simplified.yml
- ci-simplified.yml
- And 26+ others

**Risk**:
- Workflows inherit default permissions (potentially write access)
- Principle of least privilege not enforced
- Broader attack surface if workflow is compromised

### 4. Pull Request Target Usage (LOW RISK - NOT FOUND)

**Status**: VERIFIED SAFE

**Finding**: No workflows use `pull_request_target` trigger, which is a common attack vector for fork-based PRs accessing secrets.

**Conclusion**: Repository does not have this particular vulnerability.

### 5. Action Version Pinning (MEDIUM)

**Status**: INCONSISTENT

**Finding**: Many workflows use mutable action versions:
- `uses: trufflesecurity/trufflehog@main` (mutable)
- `uses: actions/checkout@v4` (better, but not SHA-pinned)

**Risk**:
- Mutable references can change behavior without warning
- Compromised action repositories could inject malicious code
- Supply chain attack vector

**Best Practice**: Pin to specific commit SHAs for critical workflows

### 6. Secret Usage Patterns

**Inventory of secrets in use**:

| Secret Name | Usage Count | Risk Level | Purpose |
|-------------|-------------|------------|---------|
| GITHUB_TOKEN | 38 files | LOW | Standard GitHub operations |
| DD_API_KEY | 15+ files | MEDIUM | Datadog monitoring |
| DD_APP_KEY | 8+ files | MEDIUM | Datadog app integration |
| KUBECONFIG* | 17 instances | HIGH | Kubernetes cluster access |
| AZURE_* | 10+ files | HIGH | Azure cloud resources |
| OPENAI_API_KEY | 4 files | HIGH | API access ($$$) |
| ANTHROPIC_API_KEY | 4 files | HIGH | API access ($$$) |
| DOCKERHUB_* | 2 files | MEDIUM | Docker registry |
| SNYK_TOKEN | 2 files | LOW | Security scanning |
| DATABASE_PASSWORD* | 6 instances | CRITICAL | Database credentials |
| NEXTAUTH_SECRET* | 6 instances | CRITICAL | Authentication secrets |

**Critical Secrets Requiring Extra Protection**:
- All KUBECONFIG variants (production access)
- DATABASE_PASSWORD variants (data access)
- NEXTAUTH_SECRET variants (auth bypass potential)
- Cloud provider credentials (AZURE_*, AWS_*)
- AI API keys (cost/data exposure)

### 7. Datadog API Key Exposure Patterns

**Status**: LOW RISK (Properly Used)

**Finding**: DD_API_KEY used in curl commands with header authentication:

```yaml
curl -X POST "https://api.${DD_SITE}/api/v1/events" \
  -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}"
```

**Assessment**: This pattern is safe as:
- Secret is passed via header (not echoed)
- GitHub Actions masks the value automatically
- Not exposed in logs or artifacts

### 8. Secret Validation Patterns

**Status**: GOOD PRACTICE OBSERVED

**Finding**: Several workflows check for secret existence before use:

```yaml
# gitops-deployment.yml:48-49
if [ -z "${{ secrets.DD_API_KEY }}" ]; then
  echo "Missing secret: DD_API_KEY";
fi

# codeserver-profiles.yml:122
if [ -n "${{ secrets.DD_API_KEY }}" ]; then
  # Use secret
fi
```

**Assessment**: This is secure and prevents workflow failures when secrets are missing.

## Security Audit Summary

### High-Risk Issues (Immediate Action)
1. Branch protection not configured (CRITICAL)
2. Secret echo commands with base64 decode (HIGH)
3. Missing permission restrictions in 30+ workflows (MEDIUM-HIGH)

### Medium-Risk Issues (Plan to Address)
4. Action version pinning inconsistent (MEDIUM)
5. No automated secret rotation policy (MEDIUM)
6. Missing workflow security scanning (MEDIUM)

### Low-Risk Issues (Best Practices)
7. No secret scanning in CI by default (would catch accidental commits)
8. Missing security policy documentation for workflows
9. No centralized secret management strategy

## Detailed Recommendations

### Immediate Actions (Within 1 Week)

#### 1. Configure Branch Protection for Main

```yaml
# Recommended settings for main branch:
Branch protection rules:
  - Require pull request before merging
    - Require approvals: 2
    - Dismiss stale reviews: true
    - Require review from code owners: true
  - Require status checks to pass:
    - Require branches to be up to date: true
    - Required checks:
      - security-scan
      - test-coverage
      - build
  - Require conversation resolution before merging: true
  - Require signed commits: false (optional, enable if team ready)
  - Require linear history: true
  - Do not allow bypassing settings above: true
  - Restrict who can push to matching branches:
    - Repository admins only
  - Allow force pushes: false
  - Allow deletions: false
```

**Implementation**: Use GitHub UI or API to configure.

#### 2. Fix Secret Echo Vulnerability

**Files to update**:
- gitops-deployment.yml
- agentapi-cicd.yml
- deploy-next-docs.yml
- disabled-expensive/* (if re-enabled)

**Bad Pattern**:
```yaml
- run: echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config
```

**Secure Pattern**:
```yaml
- run: |
    # Create kubeconfig from secret (secret is auto-masked)
    mkdir -p $HOME/.kube
    echo "${{ secrets.KUBECONFIG }}" | base64 -d > $HOME/.kube/config
    chmod 600 $HOME/.kube/config
```

**Additional Protection**:
```yaml
# Add to workflow
- name: Setup kubeconfig
  env:
    KUBE_CONFIG_DATA: ${{ secrets.KUBECONFIG }}
  run: |
    # Safer: use env var instead of inline secret
    mkdir -p $HOME/.kube
    echo "$KUBE_CONFIG_DATA" | base64 -d > $HOME/.kube/config
    chmod 600 $HOME/.kube/config
```

#### 3. Add Explicit Permissions to All Workflows

**Template for read-only workflows**:
```yaml
permissions:
  contents: read
  actions: read
```

**Template for workflows needing write access**:
```yaml
permissions:
  contents: read
  packages: write
  id-token: write  # For OIDC authentication
```

**Files requiring update**: 30+ workflows without explicit permissions.

**Priority order**:
1. Deployment workflows (gitops-deployment.yml, agentapi-cicd.yml)
2. Build workflows (build-*.yml, codeserver-*.yml)
3. Test workflows (test-*.yml)
4. Utility workflows (docs-*.yml, etc.)

### Short-Term Actions (Within 1 Month)

#### 4. Implement Secret Scanning Workflow (ALREADY EXISTS - ENHANCE)

**Current**: secret-scanning.yml exists with TruffleHog

**Enhancement**: Add pre-commit hook prevention

```yaml
# .github/workflows/secret-scanning.yml (enhanced)
name: Secret Scanning

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

permissions:
  contents: read
  security-events: write

jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          extra_args: --only-verified --json --fail

      - name: Upload SARIF results
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

#### 5. Pin Action Versions to SHA Commits

**Current risky pattern**:
```yaml
uses: trufflesecurity/trufflehog@main  # Mutable
uses: actions/checkout@v4              # Tag (better but can be moved)
```

**Secure pattern**:
```yaml
uses: trufflesecurity/trufflehog@a1b2c3d  # SHA commit (immutable)
uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608  # v4 SHA
```

**Tools to help**:
- Dependabot can manage action versions
- GitHub Advanced Security alerts on outdated actions

#### 6. Implement Environment-Specific Secret Segregation

**Current issue**: Some secrets used across multiple environments

**Recommendation**: Use GitHub Environments for secret scoping

```yaml
# Example: gitops-deployment.yml
jobs:
  deploy-staging:
    environment: staging
    steps:
      - run: kubectl apply -f deploy.yml
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}  # staging-scoped

  deploy-production:
    environment: production
    steps:
      - run: kubectl apply -f deploy.yml
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}  # production-scoped
```

**Benefits**:
- Environment-level secret isolation
- Required reviewers for production
- Deployment protection rules
- Audit trail per environment

### Long-Term Actions (Within 3 Months)

#### 7. Implement OIDC for Cloud Provider Authentication

**Replace static credentials with OIDC federation**:

```yaml
# Instead of storing AZURE_CREDENTIALS, use OIDC:
- name: Azure Login
  uses: azure/login@v1
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    # No client secret needed! OIDC token used instead
```

**Benefits**:
- No long-lived credentials stored
- Automatic token rotation
- Reduced secret management overhead
- Azure/AWS/GCP all support OIDC

#### 8. Establish Secret Rotation Policy

**Policy recommendations**:
- API keys: Rotate every 90 days
- Service account credentials: Rotate every 60 days
- Database passwords: Rotate every 30 days (automated)
- Kubernetes configs: Regenerate on cluster upgrades
- CI/CD tokens: Rotate on team member changes

**Implementation**:
- Use secret management tools (Vault, Azure Key Vault, AWS Secrets Manager)
- Automate rotation with GitHub Actions
- Alert on expiring secrets

#### 9. Implement Workflow Security Monitoring

**Proposed monitoring workflow**:

```yaml
name: Workflow Security Monitoring

on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Check for insecure patterns
        run: |
          # Scan for dangerous echo patterns
          # Verify all workflows have permissions
          # Check action version pins
          # Validate secret usage patterns

      - name: Generate security report
        run: |
          # Create security dashboard
          # Alert on violations
```

## Compliance and Best Practices

### OWASP CI/CD Security Risks Mapping

| OWASP Risk | Status | Mitigation |
|------------|--------|------------|
| CICD-SEC-1: Insufficient Flow Control | PARTIAL | Add branch protection |
| CICD-SEC-2: Inadequate Identity and Access | PARTIAL | Add permission blocks |
| CICD-SEC-3: Dependency Chain Abuse | GOOD | Snyk/Trivy scanning active |
| CICD-SEC-4: Poisoned Pipeline Execution | GOOD | No pull_request_target |
| CICD-SEC-5: Insufficient PBAC | WEAK | Missing in many workflows |
| CICD-SEC-6: Insufficient Credential Hygiene | MEDIUM | Some patterns risky |
| CICD-SEC-7: Insecure System Configuration | N/A | Not applicable |
| CICD-SEC-8: Ungoverned Usage of 3rd Party | MEDIUM | Action pinning needed |
| CICD-SEC-9: Improper Artifact Integrity | GOOD | Attestations in use |
| CICD-SEC-10: Insufficient Logging | GOOD | Datadog integration |

### CIS Kubernetes Benchmark Alignment

For workflows deploying to Kubernetes:
- Use least privilege service accounts (IN PROGRESS)
- Implement network policies (RECOMMENDED)
- Enable pod security policies (RECOMMENDED)
- Audit cluster access (PARTIAL via Datadog)

### GitHub Actions Security Best Practices Checklist

- [ ] Branch protection configured
- [x] Secret scanning enabled (TruffleHog)
- [ ] All workflows have explicit permissions
- [ ] No secrets in logs (MOSTLY - fix echo commands)
- [ ] Action versions pinned (PARTIAL)
- [x] No pull_request_target usage
- [ ] Environment-based secret scoping (RECOMMENDED)
- [ ] OIDC authentication implemented (RECOMMENDED)
- [x] Security scanning in CI (Trivy, Snyk)
- [ ] Automated secret rotation (RECOMMENDED)

## Conclusion

The vibecode-webgui repository demonstrates good security practices in many areas (secret scanning, vulnerability scanning, proper secret masking) but has critical gaps that require immediate attention:

1. **Branch protection must be implemented** - This is the most critical finding
2. **Echo commands with secrets should be refactored** - Reduces risk of accidental exposure
3. **Permission blocks should be added to all workflows** - Enforces least privilege

Overall security posture: **MEDIUM** - Good foundation, needs hardening in key areas.

## Next Steps

1. Implement branch protection (this week)
2. Fix secret echo patterns in deployment workflows (this week)
3. Add permission blocks to high-risk workflows (next 2 weeks)
4. Roll out remaining security enhancements (next month)
5. Establish ongoing security monitoring and rotation policies (next quarter)

## References

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/)
- [Secret Scanning Best Practices](https://docs.github.com/en/code-security/secret-scanning)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

---

**Prepared by**: Claude Code Security Agent
**Review Status**: Initial Draft
**Action Items**: See tracking in #455
