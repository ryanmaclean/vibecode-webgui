# CI/CD Documentation

## Overview

This repository uses GitHub Actions for continuous integration and deployment. The CI/CD pipeline automates testing, building, and releasing of the VibeCode application.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `develop`, or `release/*` branches
- Pull requests to `main` or `develop`

**Jobs:**

#### Lint & Type Check
- Runs ESLint on TypeScript/JavaScript files
- Performs TypeScript type checking
- Checks code formatting with Prettier
- Validates Markdown files

#### Unit Tests
- Runs Jest unit tests with coverage
- Uploads coverage reports to Codecov
- Required to pass for PR merges

#### Integration Tests
- Runs integration test suite
- Uses Redis service container
- Tests API endpoints and websocket connections

#### Security Audit
- Runs `npm audit` for vulnerability scanning
- Executes security test suite
- Optional Snyk security scanning (requires token)

#### Dependency Check
- Validates dependency compatibility
- Checks for phantom dependencies

#### Build
- Builds Next.js application
- Uploads build artifacts for 7 days
- Verifies production build succeeds

### 2. Build macOS Workflow (`.github/workflows/build-macos.yml`)

**Triggers:**
- Push to tags matching `v*` pattern
- Push to `main` or `release/*` branches
- Manual workflow dispatch

**Jobs:**

#### Build macOS App
- Runs on macOS 14 (Apple Silicon)
- Builds for ARM64 (Apple Silicon)
- Creates DMG installer
- Generates SHA256 checksums
- Uploads artifacts (30-day retention)

#### Build Universal Binary (Tag releases only)
- Builds for both ARM64 and x86_64
- Creates universal binary (when implemented)
- Supports both Intel and Apple Silicon

#### Test Build
- Downloads and validates build artifacts
- Performs basic app verification

### 3. Release Workflow (`.github/workflows/release.yml`)

**Triggers:**
- Push to tags matching `v*` pattern
- Manual workflow dispatch with version input

**Jobs:**

#### Create Release
- Generates release notes from git history
- Creates draft GitHub release
- Outputs release ID for subsequent jobs

#### Build & Upload macOS
- Builds Tauri app for macOS ARM64
- Renames DMG with version and architecture
- Uploads to GitHub release

#### Publish Release
- Removes draft status from release
- Notifies completion

**Future Platforms:**
- Linux builds (disabled, placeholder ready)
- Windows builds (disabled, placeholder ready)

## Dependabot Configuration (`.github/dependabot.yml`)

**Update Schedule:**
- **NPM dependencies**: Weekly on Mondays at 9:00 AM
  - Groups dev dependencies (minor/patch)
  - Groups production dependencies (patch only)
  - Max 10 open PRs

- **Cargo dependencies**: Weekly on Mondays at 9:00 AM
  - Monitors `src-tauri/Cargo.toml`
  - Max 5 open PRs

- **GitHub Actions**: Monthly on 1st at 9:00 AM
  - Updates action versions
  - Max 5 open PRs

**Auto-assignment:**
- Reviewer: @ryanmaclean
- Assignee: @ryanmaclean

**Labels:**
- NPM: `dependencies`, `npm`, `automated`
- Cargo: `dependencies`, `rust`, `tauri`, `automated`
- Actions: `ci/cd`, `github-actions`, `automated`

## Environment Variables & Secrets

### Required Secrets

#### For Builds
- `TAURI_PRIVATE_KEY`: Private key for Tauri code signing
- `TAURI_KEY_PASSWORD`: Password for Tauri private key

#### For Code Coverage
- `CODECOV_TOKEN`: Token for uploading coverage to Codecov

#### For Security Scanning (Optional)
- `SNYK_TOKEN`: Token for Snyk security scanning

### Setting Secrets

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add required secrets

## Running Workflows Locally

### Prerequisites
```bash
npm install --legacy-peer-deps
```

### Run Linting
```bash
npm run lint
npm run type-check
npm run lint:markdown
```

### Run Tests
```bash
npm run test:unit
npm run test:integration
npm run test:coverage
```

### Run Security Checks
```bash
npm run security:audit
npm run test:security
```

### Build Next.js App
```bash
npm run build
```

### Build Tauri App
```bash
npm run tauri:build
```

## Status Badges

The README includes the following status badges:
- **CI**: Shows status of latest CI workflow run
- **Build macOS**: Shows status of latest macOS build
- **Release**: Shows latest release version
- **Codecov**: Shows code coverage percentage

## Troubleshooting

### CI Failures

#### Lint Errors
```bash
# Fix automatically where possible
npm run lint -- --fix

# Check specific files
npm run lint src/path/to/file.ts
```

#### Type Check Errors
```bash
# Run type check
npm run type-check

# Build to see all errors
npm run build
```

#### Test Failures
```bash
# Run tests with verbose output
npm run test -- --verbose

# Run specific test
npm run test -- --testPathPattern=path/to/test
```

### Build Failures

#### macOS Build Issues
- Ensure Rust toolchain is installed
- Check Tauri configuration in `src-tauri/tauri.conf.json`
- Verify Node dependencies are compatible

#### Missing Artifacts
- Check workflow logs for build errors
- Verify paths in workflow YAML match actual build output
- Ensure build completes successfully before artifact upload

## Performance

### CI Workflow
- **Average duration**: 5-8 minutes
- **Parallelization**: 6 jobs run concurrently
- **Caching**: NPM packages cached by Node.js version

### Build Workflow
- **macOS ARM64**: ~10-15 minutes
- **Universal binary**: ~20-30 minutes
- **Caching**: Rust build cache, NPM cache

### Release Workflow
- **Total duration**: ~15-20 minutes
- **Stages**: Create release → Build → Upload → Publish

## Best Practices

1. **Always run tests locally** before pushing
2. **Keep dependencies up to date** via Dependabot
3. **Monitor security alerts** from npm audit and Snyk
4. **Review CI logs** for warnings even if passing
5. **Test release process** on feature branches before tagging
6. **Use semantic versioning** for tags (v1.2.3)
7. **Write meaningful commit messages** for release notes

## Future Enhancements

- [ ] Add Linux build workflow (Ubuntu, Debian, Fedora)
- [ ] Add Windows build workflow (x64)
- [ ] Implement universal binary creation for macOS
- [ ] Add E2E tests to CI pipeline
- [ ] Add performance benchmarking
- [ ] Implement automatic changelog generation
- [ ] Add Docker image builds
- [ ] Set up continuous deployment to staging environment

## Support

For issues with CI/CD:
1. Check workflow logs in GitHub Actions tab
2. Review this documentation
3. Consult [GitHub Actions documentation](https://docs.github.com/en/actions)
4. Open an issue with `ci/cd` label
