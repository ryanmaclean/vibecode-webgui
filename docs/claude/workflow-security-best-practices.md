# GitHub Actions Workflow Security Best Practices

**Purpose**: Comprehensive guide for secure workflow development and secret management

**Audience**: Developers, DevOps engineers, Security team

## Core Security Principles

### 1. Principle of Least Privilege

Every workflow should have explicit, minimal permissions:

```yaml
# BAD: Implicit permissions (gets write access by default)
name: My Workflow
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

# GOOD: Explicit minimal permissions
name: My Workflow
on: push
permissions:
  contents: read  # Only read access to code
  actions: read   # Only read access to workflow artifacts
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
```

### 2. Secret Handling

#### Never Echo Secrets Directly

```yaml
# DANGEROUS: Secret may appear in logs
- run: echo "API Key: ${{ secrets.API_KEY }}"

# DANGEROUS: Base64 decode could expose secret
- run: echo "${{ secrets.KUBECONFIG }}" | base64 -d > config

# SAFE: Use environment variables (auto-masked)
- name: Configure
  env:
    API_KEY: ${{ secrets.API_KEY }}
  run: |
    # Use $API_KEY here, it's automatically masked in logs
    ./configure --api-key "$API_KEY"

# SAFER: Write directly to file without echo
- name: Setup kubeconfig
  env:
    KUBE_CONFIG_DATA: ${{ secrets.KUBECONFIG }}
  run: |
    mkdir -p $HOME/.kube
    echo "$KUBE_CONFIG_DATA" | base64 -d > $HOME/.kube/config
    chmod 600 $HOME/.kube/config
```

#### Use Environment-Scoped Secrets

```yaml
# BAD: Single secret for all environments
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: deploy.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

# GOOD: Environment-scoped secrets
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging  # Secrets scoped to staging
    steps:
      - run: deploy.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}  # staging-scoped

  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Secrets scoped to production
    steps:
      - run: deploy.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}  # production-scoped
```

### 3. Action Version Pinning

```yaml
# RISKY: Mutable reference (main/master can change)
- uses: actions/checkout@main

# BETTER: Semantic version (but can be moved)
- uses: actions/checkout@v4

# BEST: SHA-pinned (immutable)
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608  # v4.1.1

# Acceptable for trusted first-party actions
- uses: actions/checkout@v4  # GitHub-maintained, auto-updated
```

**Use Dependabot to manage action versions**:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Pull Request Security

#### Avoid `pull_request_target`

```yaml
# DANGEROUS: Gives fork PRs access to secrets
on: pull_request_target  # DO NOT USE unless absolutely necessary

# SAFE: Standard PR trigger without secret access
on: pull_request

# IF YOU MUST use pull_request_target:
on: pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Minimal permissions
    steps:
      # Explicitly checkout PR code, not base
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      # NEVER use secrets in fork PRs
```

#### Validate PR Inputs

```yaml
jobs:
  validate-pr:
    runs-on: ubuntu-latest
    steps:
      - name: Validate PR title
        run: |
          title="${{ github.event.pull_request.title }}"
          # Sanitize and validate
          if [[ ! "$title" =~ ^(feat|fix|docs|chore): ]]; then
            echo "::error::PR title must start with feat:, fix:, docs:, or chore:"
            exit 1
          fi
```

### 5. Workflow Triggers

```yaml
# GOOD: Explicit triggers with branch restrictions
on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'src/**'
      - 'package.json'
  pull_request:
    branches:
      - main

# CAREFUL: workflow_dispatch allows manual runs
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options:
          - staging
          - production
        required: true
      # Validate inputs before use!
```

### 6. Container Security

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:20-alpine  # Use specific versions
      # DO NOT use 'latest' tag
      credentials:  # For private registries
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
```

### 7. Artifact Security

```yaml
# Upload artifacts
- uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: dist/
    retention-days: 7  # Don't keep forever

# Never upload sensitive files
- uses: actions/upload-artifact@v4
  with:
    name: logs
    path: |
      logs/*.log
      !logs/*secret*.log  # Exclude sensitive logs
      !logs/*credentials*.log
```

## Secret Management Strategies

### 1. OIDC Authentication (Recommended)

Replace long-lived credentials with OIDC tokens:

```yaml
# Azure example
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # Required for OIDC
      contents: read
    steps:
      - uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          # No client secret needed! OIDC token used automatically

      - run: az account show
```

### 2. Secret Rotation

Establish rotation schedule:

| Secret Type | Rotation Frequency | Method |
|-------------|-------------------|---------|
| API Keys | 90 days | Manual or automated |
| Service Account Credentials | 60 days | Automated |
| Database Passwords | 30 days | Automated via secrets manager |
| Kubernetes Configs | On cluster upgrade | Manual |
| CI/CD Tokens | On team member change | Manual |

### 3. Secret Validation

```yaml
jobs:
  validate-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Check required secrets
        run: |
          missing=0

          if [ -z "${{ secrets.API_KEY }}" ]; then
            echo "::error::Missing API_KEY secret"
            missing=1
          fi

          if [ -z "${{ secrets.DATABASE_URL }}" ]; then
            echo "::error::Missing DATABASE_URL secret"
            missing=1
          fi

          if [ $missing -eq 1 ]; then
            exit 1
          fi
```

## Workflow Patterns

### 1. Reusable Workflows

```yaml
# .github/workflows/reusable-security-scan.yml
name: Reusable Security Scan
on:
  workflow_call:
    inputs:
      scan-type:
        required: true
        type: string
    secrets:
      SNYK_TOKEN:
        required: true

permissions:
  contents: read
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/${{ inputs.scan-type }}@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

Usage:

```yaml
# .github/workflows/main-ci.yml
jobs:
  security:
    uses: ./.github/workflows/reusable-security-scan.yml
    with:
      scan-type: node
    secrets:
      SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 2. Conditional Secret Access

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'  # Only main branch
    steps:
      - name: Deploy with secret
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: ./deploy.sh
```

### 3. Job-Level Permissions

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - run: docker build .
      - run: docker push ghcr.io/org/image

  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # No package write
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

## Security Monitoring

### 1. Automated Security Scanning

```yaml
name: Workflow Security Audit
on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  workflow_dispatch:

jobs:
  audit-workflows:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Scan for insecure patterns
        run: |
          # Check for echo with secrets
          if grep -r "echo.*secrets\." .github/workflows/; then
            echo "::error::Found echo with secrets"
            exit 1
          fi

          # Check for pull_request_target
          if grep -r "pull_request_target" .github/workflows/; then
            echo "::warning::Found pull_request_target usage"
          fi

          # Check for missing permissions
          for file in .github/workflows/*.yml; do
            if ! grep -q "permissions:" "$file"; then
              echo "::warning file=$file::Missing permissions block"
            fi
          done
```

### 2. Secret Scanning Integration

```yaml
name: Secret Scanning
on: [push, pull_request]

permissions:
  contents: read
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          extra_args: --only-verified --fail
```

## Incident Response

### If Secrets Are Exposed

1. **Immediate Actions** (within 1 hour):
   ```bash
   # Revoke compromised secret immediately
   # Rotate all related credentials
   # Review access logs for unauthorized usage
   ```

2. **Investigation** (within 4 hours):
   ```bash
   # Identify scope of exposure
   gh api repos/{owner}/{repo}/actions/secrets
   gh api repos/{owner}/{repo}/actions/runs --jq '.workflow_runs[] | select(.created_at > "2024-01-01")'
   ```

3. **Remediation** (within 24 hours):
   ```bash
   # Update all dependent systems
   # Implement additional controls
   # Document incident and lessons learned
   ```

### Workflow for Secret Rotation

```yaml
name: Rotate Secrets
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 1 * *'  # Monthly

jobs:
  rotate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Generate new secret
        run: |
          NEW_SECRET=$(openssl rand -base64 32)
          echo "::add-mask::$NEW_SECRET"
          # Update in secrets manager

      - name: Test new secret
        run: |
          # Validate new secret works

      - name: Notify team
        run: |
          # Send rotation notification
```

## Compliance and Auditing

### Audit Log Review

```bash
# Check workflow runs
gh api repos/{owner}/{repo}/actions/runs \
  --jq '.workflow_runs[] | {name: .name, conclusion: .conclusion, created_at: .created_at}'

# Check secret access
gh api repos/{owner}/{repo}/actions/secrets \
  --jq '.secrets[] | {name: .name, updated_at: .updated_at}'
```

### Required Documentation

- [ ] Document all secrets and their purpose
- [ ] Maintain secret rotation schedule
- [ ] Track secret owners and approvers
- [ ] Log all secret access and modifications
- [ ] Annual security review of all workflows

## Checklist for New Workflows

- [ ] Explicit `permissions:` block (minimal access)
- [ ] No direct `echo` of secrets
- [ ] Secrets passed via environment variables
- [ ] Action versions pinned (SHA or semantic version)
- [ ] No `pull_request_target` without justification
- [ ] Input validation for `workflow_dispatch`
- [ ] Timeout configured for all jobs
- [ ] Artifacts don't contain sensitive data
- [ ] Secret scanning runs on all commits
- [ ] Branch protection configured for production

## Additional Resources

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP CI/CD Security](https://owasp.org/www-project-top-10-ci-cd-security-risks/)
- [Secret Management Best Practices](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [OIDC Authentication](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Next Review**: 2025-11-02
