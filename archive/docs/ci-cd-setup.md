# CI/CD Pipeline Setup Guide

This document explains the Continuous Integration and Continuous Deployment (CI/CD) pipeline setup for VibeCode WebGUI.

## Table of Contents

- [Overview](#overview)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Test Reporting](#test-reporting)
- [Coverage Requirements](#coverage-requirements)
- [Running CI Checks Locally](#running-ci-checks-locally)
- [Troubleshooting](#troubleshooting)
- [Badge Status](#badge-status)

---

## Overview

The VibeCode CI/CD pipeline is designed to protect code quality and ensure all tests pass before code is merged to main. It consists of:

1. **GitHub Actions CI Workflow** - Runs on all pushes and PRs
2. **GitHub Actions PR Checks** - Provides detailed PR feedback
3. **Pre-commit Hooks** - Runs checks before allowing commits
4. **Test Coverage Reporting** - Tracks code coverage metrics

### Current Test Status

- **Total Tests**: 3,570
- **Pass Rate**: 100%
- **Coverage Target**: 60-65% (branches, functions, lines, statements)

---

## GitHub Actions Workflows

### Main CI Workflow (`.github/workflows/ci.yml`)

Runs on every push to `main`, `develop`, `release/*` branches and all pull requests.

#### Jobs:

1. **Lint & Type Check** (10 min timeout)
   - Runs ESLint on specified directories
   - Performs TypeScript type checking
   - Checks code formatting with Prettier
   - Validates markdown files

2. **Test (Matrix: Node 18, 20)** (30 min timeout)
   - Runs full test suite with coverage
   - Tests on Node.js 18 and 20
   - Uses Redis service for integration tests
   - Generates test summaries
   - Uploads coverage to Codecov (Node 20 only)
   - Uploads test results as artifacts

3. **Security Audit**
   - Runs `npm audit` for known vulnerabilities
   - Executes security test suite
   - Runs Snyk security scan (if configured)

4. **Dependency Compatibility**
   - Checks for dependency conflicts
   - Validates package compatibility

5. **Build (Matrix: Node 18, 20)**
   - Builds Next.js application
   - Uploads build artifacts (Node 20 only)
   - Verifies build succeeds on both Node versions

6. **Status Check**
   - Aggregates results from all jobs
   - Fails if any critical job fails
   - Posts summary to GitHub Actions UI

#### Features:

- **Concurrency Control**: Cancels in-progress runs when new commits are pushed
- **Matrix Strategy**: Tests on multiple Node.js versions
- **Caching**: Caches npm dependencies for faster runs
- **Artifacts**: Uploads build and test results
- **Test Summaries**: Posts results to GitHub Actions summary

#### Triggering the Workflow:

```bash
# Automatic triggers
git push origin main              # Push to main
git push origin develop           # Push to develop
gh pr create                      # Create a pull request

# Manual trigger
gh workflow run ci.yml            # Run via GitHub CLI
```

---

### PR Checks Workflow (`.github/workflows/pr-checks.yml`)

Runs on pull requests to provide detailed feedback as PR comments.

#### Jobs:

1. **PR Information**
   - Analyzes changed files
   - Posts summary of changes (JS/TS, tests, docs, configs)
   - Provides early feedback on PR scope

2. **Quick Checks** (10 min timeout)
   - Runs ESLint and TypeScript checks
   - Posts results as PR comment
   - Fails fast on lint/type errors

3. **Test PR Changes** (30 min timeout)
   - Runs full test suite
   - Extracts and parses test results
   - Posts detailed test results to PR
   - Includes pass/fail counts

4. **Build PR**
   - Builds the application
   - Posts build status to PR
   - Catches build errors early

5. **PR Status Check**
   - Aggregates all check results
   - Posts final summary table
   - Blocks merge if any check fails

#### Features:

- **PR Comments**: Automatically posts results to PRs
- **Draft PRs**: Skips checks on draft PRs (for WIP)
- **Concurrency**: One run per PR number
- **Early Feedback**: Quick checks run first
- **Detailed Output**: Links to full logs

#### Example PR Comment:

```markdown
## PR Analysis 📊

**Changed Files Summary:**
- JavaScript/TypeScript files: 15
- Test files: 8
- Documentation files: 2
- Configuration files: 1

**CI Status:** Running automated checks...
```

---

## Pre-commit Hooks

Pre-commit hooks run automatically when you attempt to commit code. They ensure basic quality checks pass before code enters the repository.

### Setup

Hooks are automatically installed when you run `npm install` (via Husky).

To manually install:

```bash
npx husky install
```

### Hook: `.husky/pre-commit`

Performs the following checks:

1. **Block Test Artifacts**
   - Prevents committing JUnit XML files
   - Ensures test results don't pollute the repo

2. **Documentation Validation**
   - Validates changed markdown files
   - Auto-updates README if needed
   - Runs doc stats (non-blocking)

3. **Security Scanning**
   - Scans for API keys (OpenAI, Anthropic, GitHub, AWS, Datadog)
   - Blocks commit if secrets are detected
   - Pattern-based detection

4. **Lint & Type Check (on JS/TS changes)**
   - Runs ESLint with auto-fix on staged files
   - Performs TypeScript type checking
   - Fast feedback on syntax/type errors

5. **Quick Tests (on src/ changes)**
   - Runs `npm run quick-test` (unit tests only, 2 workers)
   - Skips Docker and K8s tests for speed
   - Only runs if source files changed

### Hook: `.husky/pre-commit-deps`

Runs when `package.json` or `package-lock.json` changes:

- Validates dependency compatibility
- Checks for known conflicts
- Uses CI mode (skips phantom checks)

### Bypassing Hooks (Emergency Only)

```bash
# Skip all hooks (use with caution!)
git commit --no-verify -m "Emergency fix"

# Better: Fix the issues instead
npm run lint --fix
npm run type-check
npm test
```

---

## Test Reporting

### Coverage Reports

Coverage is collected and reported in multiple formats:

- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info` (for Codecov)
- **JSON Summary**: `coverage/coverage-summary.json`
- **Text Summary**: Printed to console
- **Cobertura**: `coverage/cobertura-coverage.xml` (CI only)

### Viewing Coverage Locally

```bash
# Run tests with coverage
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
start coverage/lcov-report/index.html  # Windows
```

### JUnit XML Reports (CI Only)

In CI environments, tests generate JUnit XML reports for integration with CI tools:

- **Output**: `test-results/junit.xml`
- **Format**: Standard JUnit XML
- **Use Cases**: CI dashboards, test trend analysis

### Codecov Integration

Coverage reports are automatically uploaded to Codecov on CI runs (Node 20 only):

- **Service**: [Codecov](https://codecov.io/)
- **Reports**: Lines, branches, functions, statements
- **Flags**: `unittests`
- **Token**: Set `CODECOV_TOKEN` in GitHub Secrets

---

## Coverage Requirements

### Current Thresholds

Coverage thresholds are enforced by Jest:

| Metric     | Threshold |
|------------|-----------|
| Branches   | 60%       |
| Functions  | 65%       |
| Lines      | 65%       |
| Statements | 65%       |

### Increasing Thresholds

As code coverage improves, update thresholds in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,    // Increase from 60%
    functions: 75,   // Increase from 65%
    lines: 75,       // Increase from 65%
    statements: 75,  // Increase from 65%
  },
},
```

### Best Practices

1. Write tests for new code before merging
2. Aim for 80%+ coverage on critical paths
3. Focus on quality over quantity (meaningful tests)
4. Use coverage reports to find untested code
5. Don't lower thresholds to pass CI

---

## Running CI Checks Locally

Before pushing code, run the same checks that CI will run:

### Full CI Suite (Recommended)

```bash
# Run all checks
npm run check          # Lint + Type check
npm test               # All tests
npm run build          # Build check

# Run with coverage
npm run test:coverage
```

### Individual Checks

```bash
# Lint
npm run lint
npm run lint -- --fix  # Auto-fix issues

# Type check
npm run type-check

# Tests
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:integration  # Integration tests only
npm run quick-test      # Fast unit tests (pre-commit)

# Security
npm run security:test
npm run security:audit

# Dependencies
npm run deps:check
npm run deps:audit

# Build
npm run build
```

### Test Workflow Validation

To validate the workflow YAML files without running them:

```bash
# Install actionlint
brew install actionlint  # macOS
# or download from https://github.com/rhysd/actionlint

# Validate workflows
actionlint .github/workflows/ci.yml
actionlint .github/workflows/pr-checks.yml
```

---

## Troubleshooting

### Common Issues

#### 1. Pre-commit Hook Fails

**Problem**: `npm run quick-test` fails in pre-commit hook

**Solutions**:
```bash
# Check which tests are failing
npm run quick-test

# Run full test suite
npm test

# If tests pass locally but fail in hook, check environment
SKIP_DOCKER_TESTS=1 SKIP_K8S_TESTS=1 npm run quick-test
```

#### 2. ESLint Errors

**Problem**: ESLint errors block commit

**Solutions**:
```bash
# Auto-fix lint issues
npm run lint -- --fix

# Check specific file
npx eslint src/path/to/file.ts --fix

# If rule is problematic, consider disabling in .eslintrc
```

#### 3. TypeScript Errors

**Problem**: Type check fails

**Solutions**:
```bash
# Run type check to see errors
npm run type-check

# Check specific file
npx tsc --noEmit src/path/to/file.ts

# Common fixes:
# - Add missing type imports
# - Fix type annotations
# - Update tsconfig.json
```

#### 4. Coverage Threshold Not Met

**Problem**: Tests pass but coverage is below threshold

**Solutions**:
```bash
# View coverage report
npm run test:coverage
open coverage/lcov-report/index.html

# Focus on uncovered files (red in report)
# Add tests for critical paths first

# Temporarily bypass (not recommended):
# - Lower threshold in jest.config.js
# - Add paths to coveragePathIgnorePatterns
```

#### 5. CI Fails but Local Tests Pass

**Problem**: Tests pass locally but fail in CI

**Possible Causes**:
- Missing environment variables
- Different Node.js version
- Race conditions (tests depend on timing)
- Network-dependent tests
- File system differences

**Solutions**:
```bash
# Test with CI environment variables
CI=true npm test

# Use same Node version as CI
nvm use 20  # or nvm use 18
npm test

# Check for timing issues
npm test -- --runInBand

# Review CI logs for specific errors
gh run view --log
```

#### 6. Hooks Not Running

**Problem**: Pre-commit hooks don't execute

**Solutions**:
```bash
# Reinstall Husky
npx husky install

# Check hook permissions
chmod +x .husky/pre-commit
chmod +x .husky/pre-commit-deps

# Verify Git hooks directory
git config core.hooksPath
# Should output: .husky

# Test hook manually
.husky/pre-commit
```

#### 7. Slow Pre-commit Checks

**Problem**: Pre-commit takes too long

**Solutions**:
```bash
# Skip tests for docs-only changes
# (hook automatically skips if no src/ files changed)

# Use --no-verify for emergency commits (not recommended)
git commit --no-verify -m "Emergency fix"

# Optimize test suite:
# - Use test.concurrent for parallel tests
# - Mock external services
# - Skip slow integration tests in quick-test
```

---

## Badge Status

Add these badges to your README.md to display CI status:

### GitHub Actions CI Badge

```markdown
![CI](https://github.com/YOUR_USERNAME/vibecode-webgui/workflows/CI/badge.svg)
```

### GitHub Actions PR Checks Badge

```markdown
![PR Checks](https://github.com/YOUR_USERNAME/vibecode-webgui/workflows/PR%20Checks/badge.svg)
```

### Codecov Badge

```markdown
[![codecov](https://codecov.io/gh/YOUR_USERNAME/vibecode-webgui/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/vibecode-webgui)
```

### Test Status Badge

```markdown
![Tests](https://img.shields.io/badge/tests-3570%20passing-brightgreen)
```

### Combined Badge Section

```markdown
## Status

![CI](https://github.com/YOUR_USERNAME/vibecode-webgui/workflows/CI/badge.svg)
![PR Checks](https://github.com/YOUR_USERNAME/vibecode-webgui/workflows/PR%20Checks/badge.svg)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/vibecode-webgui/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/vibecode-webgui)
![Tests](https://img.shields.io/badge/tests-3570%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-65%25-yellow)
```

---

## Configuration Files

### Key Files

- `.github/workflows/ci.yml` - Main CI workflow
- `.github/workflows/pr-checks.yml` - PR checks workflow
- `.husky/pre-commit` - Pre-commit hook
- `.husky/pre-commit-deps` - Dependency check hook
- `jest.config.js` - Test and coverage configuration
- `package.json` - Scripts and dependencies

### Environment Variables

#### Required for Full CI

Set these in GitHub Settings > Secrets and variables > Actions:

- `DD_API_KEY` - Datadog API key (for Datadog tests)
- `DD_APP_KEY` - Datadog Application key
- `DATADOG_API_KEY` - Alternate Datadog API key
- `DATADOG_APP_KEY` - Alternate Datadog Application key
- `CODECOV_TOKEN` - Codecov upload token
- `SNYK_TOKEN` - Snyk security scanning token (optional)

#### Local Development

Create `.env.local` for local testing:

```bash
# Datadog (for tests)
DD_API_KEY=your_key_here
DD_APP_KEY=your_key_here
DATADOG_API_KEY=your_key_here
DATADOG_APP_KEY=your_key_here

# Redis (for integration tests)
REDIS_URL=redis://localhost:6379

# Skip expensive tests locally
SKIP_DOCKER_TESTS=1
SKIP_K8S_TESTS=1
```

---

## Next Steps

1. **Enable Branch Protection**
   - Go to GitHub Settings > Branches
   - Add rule for `main` branch
   - Require status checks: `Lint & Type Check`, `Test`, `Build`
   - Require pull request reviews
   - Enable "Require branches to be up to date"

2. **Configure Codecov**
   - Sign up at https://codecov.io/
   - Add repository
   - Copy token to GitHub Secrets as `CODECOV_TOKEN`

3. **Set Up Snyk (Optional)**
   - Sign up at https://snyk.io/
   - Add repository
   - Copy token to GitHub Secrets as `SNYK_TOKEN`

4. **Add Status Badges**
   - Update README.md with badge markdown
   - Replace `YOUR_USERNAME` with actual GitHub username

5. **Monitor CI Performance**
   - Review GitHub Actions usage
   - Optimize slow jobs
   - Cache more dependencies if needed

6. **Increase Coverage**
   - Add tests for uncovered code
   - Gradually increase thresholds
   - Aim for 80%+ coverage

---

## Support

- **CI Issues**: Check GitHub Actions logs
- **Test Issues**: Run `npm test -- --verbose`
- **Hook Issues**: Run `.husky/pre-commit` directly
- **Documentation**: See `docs/` directory

---

**Last Updated**: January 2026
**Maintained By**: VibeCode Team
**CI Status**: Achieving 100% test pass rate (3,570/3,570)
