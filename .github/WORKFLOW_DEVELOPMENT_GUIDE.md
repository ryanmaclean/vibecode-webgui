# Workflow Development Guide

Guide for creating and maintaining GitHub Actions workflows for the VibeCode project.

## Workflow Structure

### File Organization
```
.github/
├── workflows/
│   ├── ci.yml                 # Main CI pipeline
│   ├── e2e.yml               # End-to-end tests
│   ├── build-macos.yml       # macOS app builds
│   ├── release.yml           # Release automation
│   ├── security-audit.yml    # Security scanning
│   ├── security-scan.yml     # Advanced security
│   ├── pr-checks.yml         # PR validation
│   └── main-branch-ci.yml    # Main branch specific
├── dependabot.yml            # Dependency updates
└── workflows-disabled/       # Archived workflows
```

## Creating a New Workflow

### Basic Template

```yaml
name: My Custom Workflow

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:  # Allow manual triggering

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  my-job:
    name: My Job Name
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Run custom script
        run: npm run my-custom-script

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: my-results
          path: ./results/
          retention-days: 7
```

### Naming Conventions

**Files**: `kebab-case.yml`
```
✅ my-custom-workflow.yml
❌ MyCustomWorkflow.yml
```

**Job names**: Descriptive, sentence case
```yaml
jobs:
  build-and-test:
    name: Build and Test Application
```

**Step names**: Action-oriented
```yaml
steps:
  - name: Install dependencies
  - name: Run tests
  - name: Upload artifacts
```

## Best Practices

### 1. Use Proper Triggers

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'package*.json'
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM
  workflow_dispatch:      # Manual trigger
```

### 2. Implement Caching

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Automatic npm cache

- uses: actions/cache@v3  # Manual cache
  with:
    path: ~/.cache/custom
    key: ${{ runner.os }}-custom-${{ hashFiles('**/custom.lock') }}
    restore-keys: |
      ${{ runner.os }}-custom-
```

### 3. Run Jobs in Parallel

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    # Runs in parallel with test

  test:
    runs-on: ubuntu-latest
    # Runs in parallel with lint

  build:
    needs: [lint, test]  # Waits for both
    runs-on: ubuntu-latest
```

### 4. Add Conditional Logic

```yaml
- name: Deploy to production
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: npm run deploy

- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: 'All checks passed!'
      });

- name: Optional step
  continue-on-error: true
  run: npm run optional-check
```

### 5. Set Proper Timeout Values

```yaml
jobs:
  quick-test:
    timeout-minutes: 5    # Fast jobs

  medium-test:
    timeout-minutes: 15   # Most jobs

  long-build:
    timeout-minutes: 30   # Long operations

  nightly-suite:
    timeout-minutes: 120  # Comprehensive tests
```

### 6. Use Environment Variables

```yaml
env:
  NODE_ENV: test
  CI: true
  CUSTOM_VAR: value

jobs:
  test:
    env:
      REDIS_URL: redis://localhost:6379
    steps:
      - name: Run with env
        env:
          SECRET_KEY: ${{ secrets.API_KEY }}
        run: npm test
```

### 7. Handle Secrets Safely

```yaml
# ❌ Don't print secrets
- name: Bad
  run: echo ${{ secrets.API_KEY }}

# ✅ Do use secrets properly
- name: Good
  run: npm run build
  env:
    API_KEY: ${{ secrets.API_KEY }}

# ✅ Use add-mask for sensitive output
- name: Mask sensitive output
  run: |
    SECRET=$(cat secret.txt)
    echo "::add-mask::${SECRET}"
    echo "Secret: ${SECRET}"
```

### 8. Upload and Use Artifacts

```yaml
jobs:
  build:
    steps:
      - name: Build app
        run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: ./dist/
          retention-days: 7

  test:
    needs: build
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-output

      - name: Run tests
        run: npm test
```

## Advanced Topics

### Matrix Builds

Test across multiple configurations:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
    exclude:
      - node-version: 18
        os: macos-latest  # Don't test Node 18 on macOS
  fail-fast: false  # Continue testing other versions

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### Dynamic Job Generation

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      test-files: ${{ steps.set-matrix.outputs.test-files }}
    steps:
      - uses: actions/checkout@v4
      - id: set-matrix
        run: |
          echo "test-files=$(find tests -name '*.test.ts' | jq -R -s -c 'split("\n")[:-1]')" >> $GITHUB_OUTPUT

  test:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-file: ${{ fromJson(needs.setup.outputs.test-files) }}
    steps:
      - run: npm test -- ${{ matrix.test-file }}
```

### Workflow Status API

```yaml
- name: Check workflow status
  uses: actions/github-script@v7
  with:
    script: |
      const run = await github.rest.actions.getWorkflowRun({
        owner: context.repo.owner,
        repo: context.repo.repo,
        run_id: context.runId,
      });
      console.log(`Status: ${run.data.status}`);
      console.log(`Conclusion: ${run.data.conclusion}`);
```

### Creating Reusable Workflows

Create `.github/workflows/reusable-workflow.yml`:

```yaml
name: Reusable Workflow

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: '20'
    secrets:
      API_KEY:
        required: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm run build
        env:
          API_KEY: ${{ secrets.API_KEY }}
```

Use in another workflow:

```yaml
jobs:
  build:
    uses: ./.github/workflows/reusable-workflow.yml
    with:
      node-version: '20'
    secrets:
      API_KEY: ${{ secrets.API_KEY }}
```

### Docker Services

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - run: npm test
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
```

### Notifications and Reporting

```yaml
- name: Generate report
  run: npm test -- --json > test-results.json

- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
      const comment = `## Test Results\n\nTests: ${results.numTotalTests}\nPassed: ${results.numPassedTests}`;
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
      });
```

## Testing Workflows Locally

### Using Act

```bash
# Install act
brew install act

# List available actions
act -l

# Run specific workflow
act -j build

# Run with specific event
act push -b main

# Use custom secrets
act -s GITHUB_TOKEN=ghp_xxx
```

### Validation

```bash
# Check YAML syntax
yamllint .github/workflows/

# Use GitHub CLI to validate
gh workflow view .github/workflows/ci.yml
```

## Performance Optimization

### Reduce Build Time

```yaml
# 1. Skip unnecessary jobs
- name: Set outputs
  id: check
  run: echo "skip=true" >> $GITHUB_OUTPUT

- name: Expensive job
  if: steps.check.outputs.skip == 'false'
  run: npm run expensive-task

# 2. Use faster runners
runs-on: ubuntu-latest  # Faster than macos/windows

# 3. Parallelize jobs
# Use multiple jobs instead of sequential steps

# 4. Cache everything
cache: 'npm'  # npm dependencies
# Manual cache for other files
```

### Reduce Artifact Size

```yaml
- name: Upload slim artifacts
  uses: actions/upload-artifact@v4
  with:
    path: |
      coverage/
      reports/
    exclusions: |
      **/node_modules/**
      **/*.map
      **/*.test.js
```

## Version Management

### Update Action Versions

```bash
# Keep actions up to date
# Manually or via Dependabot

# Check for updates
git log --oneline | grep "Update.*action"

# Current best practices
actions/checkout@v4        # Latest checkout
actions/setup-node@v4      # Latest Node setup
actions/upload-artifact@v4 # Latest artifact
```

## Debugging

### Enable Debug Logging

```yaml
- name: Enable debug
  run: echo "ACTIONS_STEP_DEBUG=true" >> $GITHUB_ENV

- name: Debug info
  run: |
    echo "Event: ${{ github.event_name }}"
    echo "Ref: ${{ github.ref }}"
    echo "SHA: ${{ github.sha }}"
```

### Save Logs

```bash
# GitHub automatically saves logs
# Download from Actions tab

# Or use GitHub CLI
gh run view --log <run-id> > run.log
```

## Documentation

### Document Your Workflows

Add comments to complex workflows:

```yaml
name: Complex Workflow
# This workflow validates code quality and runs comprehensive tests
# See docs at: CI_CD_SETUP.md

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package*.json'
```

## Common Patterns

### PR Validation
```yaml
# Check that PR meets standards
# - Code review required
# - Tests passing
# - Coverage > 80%
# - No breaking changes
```

### Scheduled Tasks
```yaml
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM
```

### Release Automation
```yaml
on:
  push:
    tags:
      - 'v*'  # Matches v1.0.0, v2.0.0, etc.
```

## Maintenance

### Regular Updates
- [ ] Review workflows monthly
- [ ] Update action versions
- [ ] Check for deprecated features
- [ ] Optimize slow jobs
- [ ] Remove unused workflows

### Archiving Workflows
Move old workflows to `workflows-disabled/`:
```bash
mv .github/workflows/old-workflow.yml .github/workflows-disabled/
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Actions Marketplace](https://github.com/marketplace?type=actions)
- [Best Practices](https://docs.github.com/en/actions/guides)

---

**Last Updated**: 2026-01-14
**Questions?** Check CI_CD_SETUP.md or file an issue
