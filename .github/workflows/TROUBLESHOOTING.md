# GitHub Actions Troubleshooting Guide

This guide provides solutions to common issues encountered with GitHub Actions workflows in the Vibecode WebGUI project.

---

## Quick Diagnostic Commands

```bash
# Check workflow status
gh run list --limit 10

# View specific workflow run
gh run view <run-id>

# View logs for failed run
gh run view <run-id> --log-failed

# Re-run failed jobs
gh run rerun <run-id> --failed

# List all workflows
gh workflow list

# Trigger manual workflow
gh workflow run <workflow-name>.yml
```

---

## Common Issues

### Table of Contents

1. [Workflow Failures](#workflow-failures)
2. [Container Build Issues](#container-build-issues)
3. [Code-Server Build Issues](#codeserver-build-issues)
4. [Release Build Issues](#release-build-issues)
5. [Test Failures](#test-failures)
6. [Service Dependency Issues](#service-dependency-issues)
7. [Network and Timeout Issues](#network-and-timeout-issues)
8. [Setup Workflow Issues](#setup-workflow-issues)
9. [Security and Secrets](#security-and-secrets)
10. [Performance Issues](#performance-issues)

---

## Workflow Failures

### Issue: Workflow Stuck in "Queued" State

**Symptoms**:
- Workflow shows "Queued" for extended period
- No progress after triggering

**Causes**:
1. **Concurrency limit reached** - GitHub Actions concurrent job limit
2. **Required checks pending** - Waiting for other workflows
3. **Runner availability** - No available runners

**Solutions**:

```bash
# Check if other workflows are running
gh run list --status in_progress

# Cancel stuck runs
gh run cancel <run-id>

# Check concurrency groups
grep -A3 "concurrency:" .github/workflows/*.yml
```

**Prevention**:
- Use `cancel-in-progress: true` for PR workflows
- Limit concurrent workflow runs with concurrency groups

---

### Issue: Workflow Passes Despite Test Failures

**Symptoms**:
- Green checkmark on PR
- Tests clearly failed in logs
- PR can be merged

**Cause**: `continue-on-error: true` on critical steps

**Diagnosis**:
```bash
# Find workflows with continue-on-error
grep -n "continue-on-error: true" .github/workflows/*.yml

# Check specific workflow
grep -B5 "continue-on-error: true" .github/workflows/ci-simplified.yml
```

**Solution**:
```yaml
# ❌ WRONG
- name: Run Tests
  run: npm test
  continue-on-error: true

# ✅ CORRECT
- name: Run Tests
  run: npm test
  continue-on-error: false  # Explicit (or omit, false is default)
```

**Emergency Fix**:
If tests are genuinely flaky, add retry logic instead:
```yaml
- name: Run Tests
  uses: nick-fields/retry-action@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: npm test
```

---

### Issue: Workflow Syntax Error

**Symptoms**:
- Workflow won't trigger
- Error: "Invalid workflow file"
- YAML parsing errors

**Diagnosis**:
```bash
# Validate YAML syntax
yamllint .github/workflows/<workflow>.yml

# Check for common issues
cat .github/workflows/<workflow>.yml | grep -E "^\s+\t"  # Mixed tabs/spaces
```

**Common Syntax Issues**:

1. **Mixed tabs and spaces**:
```yaml
# ❌ WRONG (tabs and spaces mixed)
jobs:
	build:
    runs-on: ubuntu-latest

# ✅ CORRECT (consistent spaces)
jobs:
  build:
    runs-on: ubuntu-latest
```

2. **Missing quotes**:
```yaml
# ❌ WRONG
env:
  MESSAGE: ${{ github.event.inputs.version }}  # Special chars need quotes

# ✅ CORRECT
env:
  MESSAGE: "${{ github.event.inputs.version }}"
```

3. **Incorrect indentation**:
```yaml
# ❌ WRONG
steps:
- name: Checkout
  uses: actions/checkout@v4
- name: Build
run: npm run build  # Wrong indentation

# ✅ CORRECT
steps:
  - name: Checkout
    uses: actions/checkout@v4
  - name: Build
    run: npm run build
```

---

## Container Build Issues

### Issue: Docker Build Fails with "No Space Left on Device"

**Symptoms**:
- Build fails mid-process
- Error: `write /var/lib/docker/...: no space left on device`

**Solutions**:

1. **Clean up Docker cache**:
```yaml
- name: Clean Docker Cache
  run: docker system prune -af --volumes
```

2. **Use GitHub Actions cache**:
```yaml
- name: Setup Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    buildkitd-flags: --debug
    config-inline: |
      [worker.oci]
        max-parallelism = 2
```

3. **Split multi-stage builds** to reduce layer size

---

### Issue: Image Tag Collision

**Symptoms**:
- Same tag pushed multiple times
- Wrong image version deployed
- Can't trace image to commit

**Cause**: Non-unique image tags

**Diagnosis**:
```bash
# Check tag format
grep -A10 "tags:" .github/workflows/build-and-push-image.yml

# Verify tags include unique identifiers
grep "github.run_id\|github.sha" .github/workflows/*.yml
```

**Solution**:
```yaml
# ❌ WRONG - Non-unique tags
tags: |
  ghcr.io/${{ github.repository }}:latest
  ghcr.io/${{ github.repository }}:${{ inputs.version }}

# ✅ CORRECT - Unique tags with commit traceability
tags: |
  ghcr.io/${{ github.repository }}:${{ github.sha }}
  ghcr.io/${{ github.repository }}:${{ github.ref_name }}-${{ github.run_id }}
  ghcr.io/${{ github.repository }}:latest
```

**Best Practice**: Always include `github.run_id` or `github.sha` in tags

---

### Issue: Multi-Platform Build Timeout

**Symptoms**:
- Build times out after 6 hours
- ARM64 build extremely slow

**Solutions**:

1. **Add timeout protection**:
```yaml
jobs:
  build:
    timeout-minutes: 90  # Prevent 6-hour hangs
```

2. **Use native builders for ARM64**:
```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3
  with:
    platforms: arm64

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    platforms: linux/amd64,linux/arm64
```

3. **Split into separate jobs**:
```yaml
jobs:
  build-amd64:
    runs-on: ubuntu-latest
    steps:
      - name: Build AMD64
        uses: docker/build-push-action@v5
        with:
          platforms: linux/amd64

  build-arm64:
    runs-on: ubuntu-latest
    steps:
      - name: Build ARM64
        uses: docker/build-push-action@v5
        with:
          platforms: linux/arm64
```

---

## Code-Server Build Issues

### Issue: SBOM Generation Fails Silently

**Symptoms**:
- Workflow passes
- No SBOM artifact uploaded
- Security compliance not met

**Cause**: `continue-on-error: true` on SBOM step

**Diagnosis**:
```bash
# Check SBOM generation configuration
grep -A5 "sbom" .github/workflows/codeserver-profiles.yml | grep "continue-on-error"
```

**Solution**:
```yaml
# ❌ WRONG - Silent failures
- name: Generate SBOM
  run: syft scan --output spdx-json=sbom.json
  continue-on-error: true

# ✅ CORRECT - Fail-fast with validation
- name: Generate SBOM
  run: syft scan --output spdx-json=sbom.json
  continue-on-error: false

- name: Validate SBOM
  run: |
    test -f sbom.json || { echo "SBOM file not found"; exit 1; }
    jq empty sbom.json || { echo "Invalid JSON"; exit 1; }
    jq -e '.spdxVersion' sbom.json > /dev/null || { echo "Missing SPDX version"; exit 1; }
```

**Debugging Failed SBOM**:
```bash
# Download workflow logs
gh run view <run-id> --log > workflow.log

# Search for SBOM errors
grep -i "sbom\|syft" workflow.log

# Common issues:
# - syft not installed → Add installation step
# - Invalid output format → Check syft version
# - Missing dependencies → Install required tools
```

---

### Issue: Concurrent Builds Overwriting Each Other

**Symptoms**:
- Different version builds cancel each other
- Same version builds run in parallel
- Resource waste

**Diagnosis**:
```bash
# Check concurrency configuration
grep -A3 "concurrency:" .github/workflows/codeserver-profiles.yml
```

**Solution**:
```yaml
# ❌ WRONG - Too broad, cancels different versions
concurrency:
  group: codeserver-profiles
  cancel-in-progress: true

# ✅ CORRECT - Granular, allows parallel different versions
concurrency:
  group: codeserver-profiles-${{ inputs.version }}-${{ inputs.profiles }}
  cancel-in-progress: true
```

**Expected Behavior**:
- `version=1.0.0, profiles=python` and `version=2.0.0, profiles=nodejs` → Run in parallel
- Two `version=1.0.0, profiles=python` builds → Second cancels first

---

## Release Build Issues

### Issue: Linux/Windows Builds Disabled

**Symptoms**:
- Only macOS build runs
- Release incomplete
- Users can't download Linux/Windows binaries

**Cause**: Missing dependencies or code signing certificates

**Check Status**:
```bash
# View release workflow
cat .github/workflows/release.yml | grep -A5 "build-linux\|build-windows"
```

**Enable Linux Build**:
```yaml
build-linux:
  runs-on: ubuntu-latest
  # if: false  # ← Remove this line
  steps:
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

    - name: Build Linux
      run: npm run tauri build
```

**Enable Windows Build**:
```yaml
build-windows:
  runs-on: windows-latest
  # if: false  # ← Remove this line
  steps:
    - name: Build Windows
      run: npm run tauri build
      env:
        WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
        WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

**Prerequisites**:
1. **Linux**: Install Tauri dependencies on runner
2. **Windows**: Set up code signing secrets
3. **macOS Intel**: Add `x86_64-apple-darwin` Rust target

---

### Issue: Slow Tauri Builds (15-20 minutes)

**Symptoms**:
- Tauri builds take 15-20 minutes
- Rust dependencies recompiled every time
- Workflow times out

**Solution**: Enable Rust caching

```yaml
- name: Setup Rust Cache
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: src-tauri -> target

- name: Build Tauri
  run: npm run tauri build
```

**Expected Improvement**:
- First build: 15-20 minutes
- Cached builds: 8-12 minutes (40% faster)
- Cache hit rate: ~85%

**Debugging Cache Issues**:
```bash
# Check if cache is being used
gh run view <run-id> --log | grep -i "cache hit"

# Clear cache if corrupted
gh cache delete <cache-key>

# List all caches
gh cache list
```

---

## Test Failures

### Issue: Flaky Tests (Random Failures)

**Symptoms**:
- Tests pass locally
- Tests fail randomly in CI
- Same test fails on retry, then passes

**Common Causes**:
1. **Service race conditions** (PostgreSQL/Redis not ready)
2. **Network flakiness** (npm install failures)
3. **Test race conditions** (parallel execution)
4. **Timing issues** (timeouts too short)

**Solutions**:

**1. Service Health Checks**:
```yaml
# ❌ WRONG - No health check
services:
  postgres:
    image: postgres:14

# ✅ CORRECT - With health check
services:
  postgres:
    image: postgres:14
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

**2. Network Retry Logic**:
```yaml
- name: Install Dependencies
  uses: nick-fields/retry-action@v2
  with:
    timeout_minutes: 5
    max_attempts: 3
    retry_wait_seconds: 10
    command: npm ci --legacy-peer-deps
```

**3. Sequential Test Execution**:
```yaml
# ❌ WRONG - Parallel tests with race conditions
- name: Run Tests
  run: npm test

# ✅ CORRECT - Sequential execution
- name: Run Tests
  run: npm test -- --runInBand --maxWorkers=1
```

**4. Increase Timeouts**:
```yaml
# In jest.config.js
module.exports = {
  testTimeout: 30000,  // 30 seconds (default: 5s)
};
```

---

### Issue: Tests Pass Locally but Fail in CI

**Diagnosis Checklist**:

1. **Environment differences**:
```bash
# Compare Node versions
node --version  # Local
# vs CI (check workflow file)

# Compare npm versions
npm --version
```

2. **Missing environment variables**:
```bash
# Check required vars
grep -r "process.env" . --include="*.test.ts"

# Add to workflow
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
  REDIS_URL: redis://localhost:6379
  NODE_ENV: test
```

3. **Missing services**:
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
```

4. **File system differences**:
- ⚠️ CI uses Linux, local might be macOS/Windows
- ⚠️ Case-sensitive file paths on Linux
- ⚠️ Line ending differences (CRLF vs LF)

---

## Service Dependency Issues

### Issue: PostgreSQL Connection Refused

**Symptoms**:
- Error: `connection refused`
- Error: `could not connect to server`
- Tests fail immediately

**Diagnosis**:
```bash
# Check service configuration
gh run view <run-id> --log | grep -i "postgres"

# Check if service started
gh run view <run-id> --log | grep -i "Starting PostgreSQL"
```

**Solutions**:

1. **Add health check**:
```yaml
services:
  postgres:
    image: postgres:14
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test_db
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

2. **Wait for ready state**:
```yaml
- name: Wait for PostgreSQL
  run: |
    until pg_isready -h localhost -p 5432 -U postgres; do
      echo "Waiting for PostgreSQL..."
      sleep 2
    done
    echo "PostgreSQL is ready"
```

3. **Check connection string**:
```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
  # Format: postgresql://user:password@host:port/database
```

---

### Issue: Redis Connection Timeout

**Symptoms**:
- Error: `Redis connection timeout`
- Error: `ECONNREFUSED 127.0.0.1:6379`

**Solutions**:

1. **Add Redis service**:
```yaml
services:
  redis:
    image: redis:7
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

2. **Wait for Redis**:
```yaml
- name: Wait for Redis
  run: |
    until redis-cli -h localhost -p 6379 ping; do
      echo "Waiting for Redis..."
      sleep 2
    done
    echo "Redis is ready"
```

---

## Network and Timeout Issues

### Issue: npm install Fails Randomly

**Symptoms**:
- Error: `network timeout`
- Error: `ETIMEDOUT`
- ~7% failure rate

**Solution**: Add retry logic

```yaml
# ❌ WRONG - No retry
- name: Install Dependencies
  run: npm ci

# ✅ CORRECT - With retry
- name: Install Dependencies
  uses: nick-fields/retry-action@v2
  with:
    timeout_minutes: 5
    max_attempts: 3
    retry_wait_seconds: 10
    command: npm ci --legacy-peer-deps
```

**Expected Impact**: 93% reduction in npm failures

---

### Issue: Workflow Times Out After 6 Hours

**Symptoms**:
- Workflow runs for 6 hours then times out
- No progress visible
- Stuck on specific step

**Solutions**:

1. **Add job-level timeout**:
```yaml
jobs:
  build:
    timeout-minutes: 30  # Fail after 30 min instead of 6 hours
```

2. **Add step-level timeout**:
```yaml
- name: Long Running Step
  timeout-minutes: 15
  run: ./long-task.sh
```

3. **Debug hanging step**:
```yaml
- name: Debug Hanging Step
  run: |
    echo "Starting step..."
    timeout 300 ./potentially-hanging-command || {
      echo "Command timed out after 5 minutes"
      exit 1
    }
```

---

## Setup Workflow Issues

### Issue: shared-setup.yml Not Found

**Symptoms**:
- Error: `workflow not found`
- Error: `unable to resolve action`

**Cause**: Incorrect path to reusable workflow

**Solution**:
```yaml
# ❌ WRONG - Absolute path
uses: /.github/workflows/shared-setup.yml

# ❌ WRONG - Missing ./
uses: .github/workflows/shared-setup.yml

# ✅ CORRECT - Relative path with ./
uses: ./.github/workflows/shared-setup.yml
```

---

### Issue: Environment File Not Found

**Symptoms**:
- Error: `.env file not found`
- Environment variables undefined

**Diagnosis**:
```bash
# Check if .env.example or .env.template exists
ls -la .env*

# Check shared-setup.yml configuration
grep -A5 "env setup" .github/workflows/shared-setup.yml
```

**Solutions**:

1. **Add .env.example to repository**:
```bash
# Create template
cat > .env.example <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db
REDIS_URL=redis://localhost:6379
NODE_ENV=test
EOF

git add .env.example
git commit -m "Add .env.example for CI"
```

2. **Or skip env setup**:
```yaml
jobs:
  setup:
    uses: ./.github/workflows/shared-setup.yml
    with:
      skip-env-setup: true
```

---

## Security and Secrets

### Issue: Secret Not Found

**Symptoms**:
- Error: `secret not found`
- Error: `undefined is not a valid value`
- Deployment fails

**Diagnosis**:
```bash
# Check secret usage in workflow
grep -r "secrets\." .github/workflows/

# List required secrets
cat .github/workflows/*.yml | grep "secrets\." | sort -u
```

**Solutions**:

1. **Add secret via GitHub UI**:
   - Settings → Secrets and variables → Actions → New repository secret

2. **Use secret with fallback**:
```yaml
# ❌ WRONG - Fails if secret missing
env:
  API_KEY: ${{ secrets.API_KEY }}

# ✅ CORRECT - Fallback for CI
env:
  API_KEY: ${{ secrets.API_KEY || 'ci-test-key' }}
```

3. **Check secret scope** (repository vs organization vs environment)

---

### Issue: Secrets Exposed in Logs

**Symptoms**:
- Warning: `Secret leaked in logs`
- API keys visible in workflow output

**Prevention**:

1. **GitHub auto-masks secrets** (if properly configured)
2. **Manually mask sensitive values**:
```yaml
- name: Use Secret
  run: |
    SECRET_VALUE="${{ secrets.API_KEY }}"
    echo "::add-mask::$SECRET_VALUE"
    echo "Secret: $SECRET_VALUE"  # Will appear as ***
```

3. **Avoid echoing secrets**:
```yaml
# ❌ WRONG
- run: echo "API_KEY=${{ secrets.API_KEY }}"

# ✅ CORRECT
- run: |
    if [ -z "${{ secrets.API_KEY }}" ]; then
      echo "API_KEY not set"
    else
      echo "API_KEY is configured"
    fi
```

---

## Performance Issues

### Issue: PR Checks Take Too Long (>10 minutes)

**Target**: < 10 minutes for PR feedback

**Diagnosis**:
```bash
# View workflow duration
gh run list --workflow=ci-simplified.yml --limit 10

# Identify slow steps
gh run view <run-id> --log | grep "took"
```

**Optimization Strategies**:

1. **Enable caching**:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20.11.0
    cache: npm  # ← Enable npm cache
```

2. **Parallelize jobs**:
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest  # Runs in parallel with lint
    steps:
      - run: npm test
```

3. **Use concurrency control**:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true  # Cancel obsolete runs
```

4. **Skip unnecessary work**:
```yaml
on:
  pull_request:
    paths:
      - 'src/**'          # Only run on source changes
      - 'package.json'
      - '.github/workflows/ci.yml'
```

**Expected Results**:
- Before: 15-25 minutes
- After: 5-8 minutes (50% faster)

---

### Issue: Excessive Workflow Runs (Cost)

**Symptoms**:
- Many concurrent workflow runs
- High GitHub Actions bill
- Workflows running for same commit

**Solutions**:

1. **Add concurrency control**:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

2. **Limit trigger paths**:
```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '**.md'
      - 'LICENSE'
```

3. **Consolidate workflows** (use `shared-setup.yml`)

**Expected Savings**: 50-80% reduction in workflow runs

---

## Emergency Procedures

### Stop All Running Workflows

```bash
# Cancel all in-progress runs
gh run list --status in_progress --json databaseId --jq '.[].databaseId' | \
  xargs -I {} gh run cancel {}
```

### Disable Workflow Temporarily

```yaml
# Add to workflow file
on:
  workflow_dispatch:  # Only manual triggers
  # Comment out automatic triggers
  # push:
  #   branches: [main]
```

Or rename file to disable:
```bash
mv .github/workflows/ci.yml .github/workflows/ci.yml.disabled
```

### Rollback Workflow Changes

```bash
# Revert to previous version
git checkout HEAD~1 -- .github/workflows/<workflow>.yml
git commit -m "Revert workflow changes"
git push
```

---

## Getting Help

### Useful Commands

```bash
# View workflow run details
gh run view <run-id>

# Download logs
gh run view <run-id> --log > workflow.log

# List recent runs
gh run list --limit 20

# View workflow file
gh workflow view <workflow-name>

# Trigger workflow manually
gh workflow run <workflow-name> -f key=value
```

### Debugging Workflow Locally

Use [act](https://github.com/nektos/act) to test workflows locally:

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act -j build  # Run specific job
act push      # Simulate push event
```

### Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Workflow Audit](../../.auto-claude/specs/002-fix-github-actions-ci-cd-pipeline/workflow-audit.md)
- [Systemic Issues Analysis](../../.auto-claude/specs/002-fix-github-actions-ci-cd-pipeline/systemic-issues.md)
- [README.md](./README.md) - Workflow documentation

---

**Last Updated**: 2026-02-21
**Maintained By**: Auto-Claude CI/CD Team
