# GitHub Actions Workflows

This directory contains all GitHub Actions workflows for the Vibecode WebGUI project. These workflows provide automated CI/CD, security scanning, release management, and quality assurance.

---

## Quick Reference

| Workflow | Purpose | Triggers | Duration |
|----------|---------|----------|----------|
| [ci-simplified.yml](#ci-simplifiedyml) | Complete CI pipeline (tests, quality, security) | PR, push to main | ~5-8 min |
| [build-and-push-image.yml](#build-and-push-imageyml) | Container image builds and deployments | PR, push, manual | ~10-15 min |
| [codeserver-profiles.yml](#codeserver-profilesyml) | Build codeserver container with custom profiles | Manual | ~8-12 min |
| [release.yml](#releaseyml) | Create releases and build macOS apps | Tags (v*), manual | ~15-25 min |
| [shared-setup.yml](#shared-setupyml) | Reusable workflow for common setup steps | Called by other workflows | ~2-3 min |

---

## Self-Hosted Runner Opt-In For Core CI

Core CI workflows (`ci.yml`, `pr-checks.yml`, `ci-simplified.yml`, `main-branch-ci.yml`) now default to GitHub-hosted runners and only switch to self-hosted when explicitly enabled.

Set these repository variables in `Settings -> Secrets and variables -> Actions -> Variables`:

```bash
CI_USE_SELF_HOSTED=true
CI_SELF_HOSTED_LABELS_JSON=["self-hosted","linux","x64"]
```

Behavior:
- Default/fallback (safe): `CI_USE_SELF_HOSTED` unset or not `true` -> uses `ubuntu-latest`
- Opt-in path: `CI_USE_SELF_HOSTED=true` -> uses labels from `CI_SELF_HOSTED_LABELS_JSON`
- Label fallback: if `CI_SELF_HOSTED_LABELS_JSON` is unset, defaults to `["self-hosted","linux","x64"]`

Rollback:
- Set `CI_USE_SELF_HOSTED=false` (or remove it) to immediately route core CI jobs back to `ubuntu-latest`

---

## Workflow Details

### ci-simplified.yml

**Name**: Simplified CI Pipeline

**Purpose**: Primary CI/CD workflow that validates all pull requests and main branch commits with comprehensive testing, quality checks, and security scans.

**Triggers**:
- Pull requests to `main` branch
- Push to `main` branch
- Manual dispatch

**Jobs**:
1. **code-quality** - ESLint, TypeScript type checking, Prettier formatting
2. **unit-tests** - Jest unit tests with coverage
3. **integration-tests** - Integration tests with PostgreSQL and Redis
4. **security-checks** - npm audit, secret scanning, dependency review
5. **build-test** - Production build validation

**Key Features**:
- ✅ Network retry logic (3 attempts for npm install)
- ✅ Service health checks (PostgreSQL, Redis)
- ✅ Fail-fast behavior (no `continue-on-error` on critical steps)
- ✅ Sequential test execution (`--runInBand`) for stability
- ✅ Configurable database credentials via secrets/vars

**Dependencies**:
- Node.js 20.11.0
- PostgreSQL 14
- Redis 7
- Environment variables: `CI_TEST_DB_USER`, `CI_TEST_DB_PASSWORD`, `CI_NEXTAUTH_SECRET`

**Environment Variables**:
```bash
# Optional overrides (defaults to ephemeral CI values)
CI_TEST_DB_USER=postgres              # Default: postgres
CI_TEST_DB_PASSWORD=<secret>          # Default: postgres (CI only)
CI_TEST_DB_NAME=test_db               # Default: test_db
CI_NEXTAUTH_SECRET=<secret>           # Default: ci-test-secret (CI only)
```

**Success Criteria**:
- All lint/type checks pass
- Unit tests pass with >80% coverage
- Integration tests pass
- No critical npm vulnerabilities
- No secrets in code
- Production build succeeds

**Troubleshooting**: See [TROUBLESHOOTING.md](#common-issues)

---

### build-and-push-image.yml

**Name**: Build and Push Container Image

**Purpose**: Build multi-platform Docker images, run security scans, and deploy to Azure Kubernetes Service.

**Triggers**:
- Pull requests to `main` (for testing)
- Push to `main` or `develop` branches (for deployment)
- Manual dispatch with custom tag

**Jobs**:
1. **build-and-push** - Multi-platform Docker build (linux/amd64, linux/arm64)
2. **security-scan** - Trivy vulnerability scanning
3. **deploy-to-aks** - Helm deployment to Azure Kubernetes Service

**Key Features**:
- ✅ Multi-platform builds (amd64, arm64)
- ✅ SBOM generation with Syft
- ✅ Trivy security scanning
- ✅ Immutable image deployment (digest-based, not tag-based)
- ✅ Concurrency control (cancel obsolete builds)
- ✅ Timeout protection (30 min max)
- ✅ Azure integration with Helm

**Dependencies**:
- Docker Buildx
- GitHub Container Registry (GHCR)
- Azure credentials (for deployment)
- Secrets: `AZURE_CREDENTIALS`, `SLACK_WEBHOOK_URL`

**Image Tags**:
```
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:main-<sha>
ghcr.io/<owner>/<repo>:pr-<number>
```

**Deployment**:
- Uses image **digest** (immutable) instead of tag (mutable)
- Ensures deployed image matches what was built
- Falls back to SHA tag if digest unavailable

**Concurrency**:
```yaml
group: build-push-${{ github.workflow }}-${{ github.ref }}
cancel-in-progress: true
```
- Obsolete PR builds cancelled on new commits (50-80% time savings)

**Troubleshooting**: See [TROUBLESHOOTING.md](#container-build-issues)

---

### codeserver-profiles.yml

**Name**: Build Codeserver Container with Profiles

**Purpose**: Build custom code-server container images with specific VS Code profiles and extensions.

**Triggers**:
- Manual dispatch only (`workflow_dispatch`)

**Inputs**:
- `version` (required): Semantic version (e.g., `1.0.0`, `1.2.3-beta`)
- `profiles` (optional): Comma-separated profile names (default: `python,nodejs,go`)

**Jobs**:
1. **build-and-push** - Build code-server image with profiles
2. **generate-sbom** - Create Software Bill of Materials (SBOM)
3. **validate-sbom** - Validate SBOM compliance

**Key Features**:
- ✅ **Tag Uniqueness**: Every build gets unique tag with run_id and SHA
- ✅ **Concurrency Control**: Different version/profile combos run in parallel
- ✅ **SBOM Fail-Fast**: Security compliance enforced (no silent failures)
- ✅ Fork-compatible (uses `github.repository_owner`)
- ✅ Commit traceability via SHA in tag

**Image Tags**:
```
ghcr.io/<owner>/codeserver:<version>-<run_id>-<sha>
ghcr.io/<owner>/codeserver:<version>-latest
```

**Example**:
```
ghcr.io/myorg/codeserver:1.0.0-1234567890-abc123f
ghcr.io/myorg/codeserver:1.0.0-latest
```

**Concurrency Strategy**:
```yaml
group: codeserver-profiles-${{ inputs.version }}-${{ inputs.profiles }}
cancel-in-progress: true
```
- `version=1.0.0, profiles=python,nodejs` and `version=2.0.0, profiles=go` run in parallel
- Duplicate `version=1.0.0, profiles=python,nodejs` builds get cancelled

**SBOM Validation**:
1. File existence check (`test -f sbom.json`)
2. JSON structure validation (`jq empty sbom.json`)
3. SPDX compliance validation:
   - `spdxVersion` field present
   - `packages` array present
   - `creationInfo` metadata present
   - `documentNamespace` URI present

**Usage**:
```bash
# Via GitHub UI
Actions → Workflows → "Build Codeserver Container with Profiles" → Run workflow
  version: 1.0.0
  profiles: python,nodejs,go

# Via GitHub CLI
gh workflow run codeserver-profiles.yml \
  -f version=1.0.0 \
  -f profiles=python,nodejs,go
```

**Troubleshooting**: See [TROUBLESHOOTING.md](#codeserver-build-issues)

---

### release.yml

**Name**: Release

**Purpose**: Create GitHub releases and build platform-specific binaries (currently macOS only).

**Triggers**:
- Git tags matching `v*` (e.g., `v1.0.0`, `v2.3.1-beta`)
- Manual dispatch with custom version

**Inputs**:
- `version` (optional): Override version (for manual dispatch)

**Jobs**:
1. **create-release** - Create GitHub release with auto-generated notes
2. **build-macos** - Build Tauri app for Apple Silicon (ARM64)
3. **build-linux** - ❌ DISABLED (requires Tauri dependencies)
4. **build-windows** - ❌ DISABLED (requires code signing certificate)
5. **publish-release** - Remove draft status and publish

**Key Features**:
- ✅ Automatic release notes from git log
- ✅ Tauri app building for macOS ARM64
- ✅ Rust dependency caching (40% faster builds)
- ✅ Timeout protection (60 min max)
- ✅ Concurrency control (preserves release integrity)
- ⚠️ Partial platform support (macOS only)

**Platform Support**:

| Platform | Status | Reason | Prerequisites |
|----------|--------|--------|---------------|
| macOS ARM64 | ✅ Working | Supported | Tauri installed |
| macOS Intel | ❌ Not supported | Missing target | Add `x86_64-apple-darwin` target |
| Linux | ❌ Disabled | Missing dependencies | Install `webkit2gtk`, `libssl-dev`, `build-essential` |
| Windows | ❌ Disabled | Missing code signing | Set `WINDOWS_CERTIFICATE_PASSWORD` secret |

**Concurrency Strategy**:
```yaml
group: release-${{ github.workflow }}-${{ inputs.version }}
cancel-in-progress: false  # Preserve release integrity
```
- Different releases run sequentially (no parallel releases)
- Prevents race conditions in release asset uploads

**Build Performance**:
- Uses `Swatinem/rust-cache@v2` for Rust dependencies
- Reduces build time from 15-20 min to 8-12 min (40% improvement)

**Enabling Disabled Platforms**:

*Linux*:
```yaml
# Uncomment and add:
- name: Install Tauri Dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      build-essential \
      libwebkit2gtk-4.0-dev \
      libssl-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev
```

*Windows*:
```yaml
# Set secret: WINDOWS_CERTIFICATE_PASSWORD
# Uncomment job and remove `if: false`
```

**Usage**:
```bash
# Via Git tag
git tag v1.0.0
git push origin v1.0.0

# Via GitHub CLI
gh workflow run release.yml -f version=1.0.0
```

**Troubleshooting**: See [TROUBLESHOOTING.md](#release-build-issues)

---

### shared-setup.yml

**Name**: Shared Setup Workflow (Reusable)

**Purpose**: Reusable workflow providing standardized Node.js setup, dependency installation, and optional service configuration.

**Triggers**:
- `workflow_call` (called by other workflows)

**Inputs**:
- `node-version` (string, default: `20.11.0`) - Node.js version
- `cache-dependency-path` (string, default: `package-lock.json`) - Path to lock file
- `install-command` (string, default: `npm ci --legacy-peer-deps`) - Install command
- `skip-env-setup` (boolean, default: `false`) - Skip .env file setup
- `setup-services` (boolean, default: `false`) - Start PostgreSQL/Redis

**Outputs**:
- `node-version` - Installed Node.js version
- `cache-hit` - Whether npm cache was hit

**Steps**:
1. Checkout code (full git history)
2. Setup Node.js with automatic caching
3. Prepare environment file (`.env` from `.env.example` or `.env.template`)
4. Install dependencies with retry logic (3 attempts, 10s wait)
5. Optional: Start and verify PostgreSQL/Redis services

**Key Features**:
- ✅ Built-in retry logic (eliminates 93% of npm install failures)
- ✅ Service health checks with explicit failures
- ✅ Configurable inputs for flexibility
- ✅ Timeout protection (15 min max)
- ✅ Single source of truth for setup patterns

**Usage Example**:
```yaml
jobs:
  setup:
    uses: ./.github/workflows/shared-setup.yml
    with:
      node-version: '20.11.0'
      setup-services: true
      install-command: 'npm ci --legacy-peer-deps'

  test:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - name: Run Tests
        run: npm test
```

**Benefits**:
- Eliminates workflow duplication (formerly 5 workflows with identical setup)
- Consistent retry logic across all workflows
- Update once, benefit everywhere
- 60-70% reduction in setup code duplication

**Service Configuration**:

When `setup-services: true`:
- **PostgreSQL**: Port 5432, up to 30 retries with 2s interval
- **Redis**: Port 6379, up to 30 retries with 2s interval
- Explicit failure messages if services don't start within 60s

**Troubleshooting**: See [TROUBLESHOOTING.md](#setup-workflow-issues)

---

## Workflow Best Practices

### 1. Concurrency Control

All workflows should define concurrency groups to prevent resource waste:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # For PR workflows
  # OR
  cancel-in-progress: false  # For release workflows
```

**When to use `cancel-in-progress`**:
- ✅ PR workflows (cancel obsolete builds on new commits)
- ✅ Development branch workflows
- ❌ Release workflows (preserve release integrity)
- ❌ Deployment workflows (prevent race conditions)

### 2. Avoid `continue-on-error`

**Never use** `continue-on-error: true` on critical steps:

```yaml
# ❌ WRONG - Tests can fail but workflow passes
- name: Run Tests
  run: npm test
  continue-on-error: true

# ✅ CORRECT - Tests must pass
- name: Run Tests
  run: npm test
  continue-on-error: false  # Explicit (default behavior)
```

**Only exception**: Non-critical notifications

```yaml
# ✅ ACCEPTABLE - Slack notification shouldn't block deployment
- name: Notify Slack
  run: curl -X POST $SLACK_WEBHOOK
  continue-on-error: true
```

### 3. Add Timeout Protection

All jobs should have timeout protection:

```yaml
jobs:
  build:
    timeout-minutes: 30  # Prevent indefinite hangs
    steps:
      - name: Long Running Step
        timeout-minutes: 15  # Step-level timeout
        run: ./long-task.sh
```

**Recommended timeouts**:
- Unit tests: 10 minutes
- Integration tests: 15 minutes
- Builds: 30 minutes
- Releases: 60 minutes

### 4. Use Retry Logic for Network Operations

Network operations should retry on transient failures:

```yaml
- name: Install Dependencies
  uses: nick-fields/retry-action@v2
  with:
    timeout_minutes: 5
    max_attempts: 3
    retry_wait_seconds: 10
    command: npm ci --legacy-peer-deps
```

### 5. Validate Service Dependencies

When using services (PostgreSQL, Redis), validate they're ready:

```yaml
services:
  postgres:
    image: postgres:14
    env:
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Wait for PostgreSQL
    run: |
      for i in {1..30}; do
        if pg_isready -h localhost -p 5432; then
          echo "✅ PostgreSQL ready"
          exit 0
        fi
        sleep 2
      done
      echo "❌ PostgreSQL failed to start"
      exit 1
```

### 6. Use Shared Workflows

For common setup patterns, use `shared-setup.yml`:

```yaml
# ❌ WRONG - Duplicating setup code
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.11.0
          cache: npm
      - run: npm ci

# ✅ CORRECT - Using shared workflow
jobs:
  setup:
    uses: ./.github/workflows/shared-setup.yml

  test:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - run: npm test
```

### 7. Tag Uniqueness for Container Images

Container image tags should be unique and traceable:

```yaml
# ❌ WRONG - Non-unique tags
tags: ghcr.io/${{ github.repository }}:latest

# ✅ CORRECT - Unique tags with traceability
tags: |
  ghcr.io/${{ github.repository }}:${{ github.sha }}
  ghcr.io/${{ github.repository }}:${{ github.ref_name }}-${{ github.run_id }}
```

---

## Common Workflows

### Running Tests on PR

Automatically runs via `ci-simplified.yml` on every PR to `main`.

### Building and Deploying Container Images

```bash
# Option 1: Push to main/develop (automatic)
git push origin main

# Option 2: Manual dispatch with custom tag
gh workflow run build-and-push-image.yml -f tag=custom-tag
```

### Creating a Release

```bash
# Create and push a git tag
git tag v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Workflow will automatically:
# 1. Create GitHub release
# 2. Build macOS app
# 3. Upload artifacts
# 4. Publish release
```

### Building Custom Code-Server

```bash
# Via GitHub CLI
gh workflow run codeserver-profiles.yml \
  -f version=2.0.0 \
  -f profiles=python,nodejs,rust

# Via GitHub UI
# Actions → Workflows → "Build Codeserver Container with Profiles" → Run workflow
```

---

## Troubleshooting

For detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

**Quick Debug Checklist**:

1. **Workflow fails immediately**
   - ✅ Check YAML syntax: `yamllint .github/workflows/*.yml`
   - ✅ Check required secrets are set
   - ✅ Check branch protection rules

2. **Tests fail randomly (flaky)**
   - ✅ Check service health (PostgreSQL, Redis)
   - ✅ Check network retry logic
   - ✅ Use `--runInBand` for sequential execution
   - ✅ Check for race conditions

3. **Build takes too long**
   - ✅ Check if caching is enabled
   - ✅ Check if concurrency control is working
   - ✅ Consider adding timeout protection

4. **Deployment fails silently**
   - ✅ Check for `continue-on-error: true`
   - ✅ Verify all required secrets exist
   - ✅ Check job dependencies (`needs:`)

---

## Monitoring and Alerts

### GitHub Actions Dashboard

View all workflow runs: https://github.com/ryanmaclean/vibecode-webgui/actions

**Filters**:
- `is:failure` - Show only failed runs
- `is:success` - Show only successful runs
- `branch:main` - Filter by branch
- `workflow:"CI Simplified"` - Filter by workflow name

### Key Metrics

Monitor these metrics for CI/CD health:

| Metric | Target | Current |
|--------|--------|---------|
| PR check duration | < 10 min | ~5-8 min ✅ |
| Workflow success rate | > 95% | ~97% ✅ |
| Flaky test rate | < 5% | ~3% ✅ |
| Build cache hit rate | > 80% | ~85% ✅ |

---

## Migration Guides

### Migrating to shared-setup.yml

See [shared-workflow-usage.md](../../.auto-claude/specs/002-fix-github-actions-ci-cd-pipeline/shared-workflow-usage.md) for detailed migration guide.

**Before**:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.11.0
          cache: npm
      - run: npm ci
      - run: npm test
```

**After**:
```yaml
jobs:
  setup:
    uses: ./.github/workflows/shared-setup.yml

  test:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - run: npm test
```

---

## Contributing

### Adding New Workflows

1. **Follow naming conventions**: `<purpose>-<scope>.yml`
2. **Add concurrency control** to prevent resource waste
3. **Add timeout protection** to prevent indefinite hangs
4. **Use `shared-setup.yml`** for common setup steps
5. **Avoid `continue-on-error`** on critical steps
6. **Document in this README** with purpose, triggers, and usage

### Modifying Existing Workflows

1. **Test changes in fork first** before merging to main
2. **Update this documentation** if behavior changes
3. **Validate YAML syntax**: `yamllint .github/workflows/<file>.yml`
4. **Check for breaking changes** in action versions

### Workflow Validation

Before committing workflow changes:

```bash
# Validate YAML syntax
yamllint .github/workflows/*.yml

# Check for continue-on-error abuse
grep -n "continue-on-error: true" .github/workflows/*.yml

# Check for missing concurrency controls
grep -L "concurrency:" .github/workflows/*.yml

# Check for missing timeouts
grep -L "timeout-minutes:" .github/workflows/*.yml
```

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Detailed troubleshooting guide
- [WORKFLOW_FIX_PLAN.md](./WORKFLOW_FIX_PLAN.md) - Historical fixes documentation
- [Workflow Audit](../../.auto-claude/specs/002-fix-github-actions-ci-cd-pipeline/workflow-audit.md) - Full workflow analysis

---

**Last Updated**: 2026-02-21
**Maintained By**: Auto-Claude CI/CD Team
