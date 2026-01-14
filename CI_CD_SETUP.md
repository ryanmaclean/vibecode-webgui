# CI/CD Pipeline Setup - VibeCode

This document provides a comprehensive guide to the automated CI/CD pipeline for the VibeCode project, including testing, building, and deployment automation.

## Overview

VibeCode uses GitHub Actions to provide a robust, automated CI/CD pipeline that:

- **Validates Code Quality**: Linting, TypeScript type checking, and formatting
- **Runs Comprehensive Tests**: Unit tests, integration tests, end-to-end tests
- **Builds Artifacts**: Node.js/Next.js web app and macOS native applications
- **Security Scanning**: Dependency audits, secret detection, vulnerability scanning
- **Automates Releases**: Version management and distribution of builds
- **Monitors Dependencies**: Automated dependency updates via Dependabot

## Workflow Architecture

### Core Workflows

#### 1. **CI Workflow** (`ci.yml`)
Runs on every push to main/develop/release branches and all pull requests.

**Jobs**:
- `lint`: ESLint, TypeScript type checking, Prettier formatting
- `test`: Jest unit tests with coverage (Node 20)
- `security`: npm audit, security tests, Snyk scanning
- `dependency-check`: Dependency compatibility validation
- `build`: Next.js application build
- `status-check`: Overall CI pipeline status

**Triggers**:
```yaml
- Push to: main, develop, release/*
- Pull requests to: main, develop
- Manual trigger (workflow_dispatch)
```

**Key Features**:
- Dependency caching for faster builds
- Redis service container for tests
- Coverage reports uploaded to Codecov
- Artifacts retained for 7 days
- Concurrent job execution for speed

#### 2. **E2E Test Workflow** (`e2e.yml`)
Runs end-to-end tests using Playwright.

**Jobs**:
- `e2e`: Playwright tests on Chromium (all PRs and pushes)
- `e2e-full`: Full multi-browser testing on main branch pushes
- `status-check`: E2E pipeline status

**Triggers**:
```yaml
- Pull requests to: main, develop, phase2/**
- Push to: main, phase2/**
- Manual trigger (workflow_dispatch)
```

**Key Features**:
- Multi-browser testing (Chromium, Firefox, WebKit)
- Test videos and screenshots captured on failure
- Reports retained for 7 days
- Faster feedback on PRs (Chromium only)

#### 3. **macOS Build Workflow** (`build-macos.yml`)
Builds macOS applications and creates DMG installers.

**Jobs**:
- `build`: Builds the Tauri app for ARM64 (Apple Silicon)
- `build-universal`: Creates universal binaries (Intel + Apple Silicon)
- `test-build`: Validates the build artifacts

**Triggers**:
```yaml
- Push to: main, release/*, new version tags (v*)
- Manual trigger with build type selection
```

**Key Features**:
- Apple Silicon optimization (macos-14 runner)
- Universal binary support (x86_64 + ARM64)
- Automatic checksum generation (SHA256)
- DMG creation with versioning
- Build artifact retention (30 days)

#### 4. **Release Workflow** (`release.yml`)
Automates the complete release process.

**Jobs**:
- `create-release`: Creates a GitHub release draft
- `build-macos`: Builds macOS artifacts for the release
- `build-linux`: Placeholder for future Linux builds
- `build-windows`: Placeholder for future Windows builds
- `publish-release`: Publishes the release and updates status

**Triggers**:
```yaml
- Tag push: v*.*.* (semantic versioning)
- Manual trigger with version and prerelease flag
```

**Key Features**:
- Automatic release notes generation
- DMG upload with checksums
- Semantic versioning support
- Multi-platform build matrix
- Release notes from commit history

#### 5. **Security Audit Workflow** (`security-audit.yml`)
Comprehensive security scanning on every commit.

**Checks**:
- Secret detection (TruffleHog)
- Dependency vulnerabilities (npm audit)
- Code vulnerabilities (Snyk, GitHub CodeQL)
- License compliance
- SBOM generation

**Triggers**:
```yaml
- Push to: main
- All pull requests
```

#### 6. **PR Checks Workflow** (`pr-checks.yml`)
Comprehensive validation for pull requests.

**Jobs**:
- Code quality checks
- Test coverage validation
- Build validation
- Size impact analysis

#### 7. **Main Branch CI Workflow** (`main-branch-ci.yml`)
Focused CI for main branch stability.

**Jobs**:
- Runs all critical tests
- Builds production-ready artifacts
- Generates comprehensive reports

## Testing Framework

### Test Types

#### Unit Tests
- **Framework**: Jest
- **Location**: `tests/unit/**/*.test.ts`
- **Command**: `npm run test:unit`
- **Coverage**: Monitored via Codecov

#### Integration Tests
- **Framework**: Jest
- **Location**: `tests/integration/**/*.test.ts`
- **Command**: `npm run test:integration`
- **Services**: Redis, PostgreSQL (via Docker in CI)

#### End-to-End Tests
- **Framework**: Playwright
- **Location**: `tests/e2e/**/*.test.ts`
- **Command**: `npm run test:e2e`
- **Browsers**: Chromium (default), Firefox, WebKit (on main)

#### Monitoring Tests
- **Command**: `npm run test:monitoring`
- **Includes**: Unit and integration monitoring tests

#### Security Tests
- **Command**: `npm run test:security`
- **Validates**: Authorization, input validation, cryptography

### Running Tests Locally

```bash
# All tests with coverage
npm run test:coverage

# Specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode for development
npm run test:watch

# E2E tests with browser UI
npm run test:e2e:headed

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# Monitoring tests
npm run test:monitoring
```

## Building

### Web Application Build

```bash
# Development
npm run dev

# Production build
npm run build

# Production start
npm start
```

### macOS Application Build

```bash
# Debug build
npm run tauri:build:debug

# Release build
npm run tauri:build

# For specific architecture
npm run tauri:build -- --target aarch64-apple-darwin
npm run tauri:build -- --target x86_64-apple-darwin
```

## Release Process

### Automatic Release (Tag-based)

1. **Create a tag** following semantic versioning:
   ```bash
   git tag v1.5.1
   git push origin v1.5.1
   ```

2. **GitHub Actions automatically**:
   - Creates a release draft
   - Builds macOS artifacts
   - Generates checksums
   - Publishes the release

### Manual Release (Workflow Dispatch)

1. Go to **Actions** → **Release**
2. Click **Run workflow**
3. Enter:
   - Release version (e.g., `v1.5.1`)
   - Prerelease flag (optional)
4. Monitor the workflow execution

### Release Artifacts

Each release includes:
- `VibeCode-{version}-macOS-arm64.dmg` - Apple Silicon installer
- `VibeCode-{version}-macOS-x64.dmg` - Intel installer (when available)
- `SHA256SUMS.txt` - Checksum file for verification

### Verify Downloaded Artifacts

```bash
# Verify DMG checksum
shasum -a 256 -c SHA256SUMS.txt

# Mount and test DMG
hdiutil mount VibeCode-v1.5.1-macOS-arm64.dmg
```

## Dependency Management

### Automated Updates (Dependabot)

Dependabot automatically creates PRs for dependency updates:

**Configuration** (`.github/dependabot.yml`):

- **npm packages**: Weekly updates
  - Development dependencies: minor + patch updates
  - Production dependencies: patch updates only
- **GitHub Actions**: Monthly updates
- **Cargo/Rust**: Weekly updates (for Tauri)

**Auto-merge Policy**:
- Minor/patch updates for dev dependencies (with passing tests)
- Patch-only updates for production dependencies
- Always requires passing CI before merge

### Manual Dependency Updates

```bash
# Check for updates
npm run deps:update:check

# Update patch versions
npm run deps:update:patch

# Update minor versions
npm run deps:update:minor

# Audit dependencies
npm run security:audit

# Fix vulnerabilities
npm run security:fix
```

## GitHub Secrets

Configure these secrets in **Settings** → **Secrets and variables** → **Actions**:

### Required for Releases
- `TAURI_PRIVATE_KEY`: Tauri signing key for macOS app signing
- `TAURI_KEY_PASSWORD`: Password for Tauri private key

### Recommended for Enhanced Features
- `CODECOV_TOKEN`: Codecov integration for coverage tracking
- `DD_API_KEY`: Datadog API key for monitoring CI runs
- `DD_APP_KEY`: Datadog app key
- `SNYK_TOKEN`: Snyk for vulnerability scanning

### GitHub Automatic Secrets
- `GITHUB_TOKEN`: Automatically available for all workflows

## Troubleshooting

### CI Failures

#### Lint Failures
```bash
# Fix formatting issues
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"

# Check ESLint issues
npm run lint
```

#### Test Failures
```bash
# Run tests locally
npm run test:watch

# Run specific test
npm test -- path/to/test.ts

# Run with debug info
DEBUG=* npm test
```

#### Build Failures
```bash
# Clean and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### macOS Build Issues
```bash
# Check Xcode setup
xcode-select --install

# Verify Tauri prerequisites
npm run tauri info

# Debug build
npm run tauri:build:debug
```

### Workflow Issues

#### Workflow Not Triggering
- Check branch name matches trigger conditions
- Verify file changes match path filters (if configured)
- Check if workflow is disabled in repo settings

#### Out of Disk Space
- GitHub Actions runners have ~14GB available
- Some builds may fail if disk space is low
- Check artifact cleanup policies (retention-days)

#### Timeout Issues
- Default timeout: 360 minutes (6 hours)
- Job-specific timeouts set in workflow files
- Long-running tests may need timeout adjustment

### Performance Optimization

#### Caching Strategies
- **npm dependencies**: Cached automatically via `cache: 'npm'`
- **Build artifacts**: Uploaded and retained for specified duration
- **Test results**: Cached for 7 days
- **Coverage data**: Uploaded to Codecov for historical tracking

#### Parallel Execution
- Jobs run in parallel by default
- Use `needs:` to create dependencies when required
- Reduces overall pipeline execution time

## CI/CD Status Badges

Add these badges to your README:

```markdown
[![CI](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml)
[![macOS Build](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml)
[![Release](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/release.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/release.yml)
```

## Best Practices

### Commit Messages
Follow conventional commits for better release notes:
```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
test: Test changes
chore: Build/dependency changes
```

### Pull Requests
- Keep PRs focused on single features/fixes
- Ensure all CI checks pass before merging
- Request reviews from team members
- Use PR templates for consistency

### Branch Strategy
- **main**: Production-ready code, always stable
- **develop**: Integration branch for features
- **release/***: Release branches for hot fixes
- **feature/**,**fix/**: Feature and fix branches

### Artifact Management
- Keep artifact retention reasonable (7-30 days)
- Download artifacts promptly for archiving
- Use GitHub Releases for permanent storage
- Clean up old artifacts regularly

## Monitoring CI Health

### Key Metrics
- **CI Pass Rate**: Target > 95%
- **Average CI Duration**: Target < 15 minutes
- **Test Coverage**: Target > 80%
- **Dependency Status**: All critical vulnerabilities resolved

### Accessing Reports
- **Build Results**: GitHub Actions tab
- **Coverage**: Codecov dashboard
- **Test Reports**: Artifact downloads
- **Release Info**: GitHub Releases page

## Advanced Topics

### Custom Workflows

To add custom workflows, create `.github/workflows/your-workflow.yml`:

```yaml
name: Custom Workflow

on:
  push:
    branches: [main]
  pull_request:

jobs:
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Your custom step
        run: echo "Hello, CI/CD!"
```

### Matrix Builds

Test across multiple configurations:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
```

### Conditional Steps

Execute steps conditionally:

```yaml
- name: Step name
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: npm run build
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Tauri Build Guide](https://tauri.app/v1/guides/building/)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates)

## Support

For CI/CD issues:
1. Check the GitHub Actions logs for detailed error messages
2. Review this documentation for common issues
3. Check recent commits that may have broken CI
4. Contact the team or file an issue with CI logs attached

---

**Last Updated**: 2026-01-14
**Maintained By**: Development Team
