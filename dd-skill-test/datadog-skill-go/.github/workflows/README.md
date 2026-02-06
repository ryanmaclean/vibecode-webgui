# GitHub Actions CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration, building, testing, and releasing the Datadog CLI.

## Workflows Overview

### 1. CI Workflow (`ci.yml`)

**Trigger:** Push to `main`/`develop` branches and pull requests

**Purpose:** Continuous integration testing and quality checks

**Jobs:**
- **test**: Runs tests on multiple OS and Go versions
  - Matrix: Ubuntu, macOS, Windows × Go 1.21, 1.22, 1.23
  - Verifies dependencies
  - Runs `go vet`
  - Checks code formatting with `gofmt`
  - Runs tests with race detector
  - Uploads coverage to Codecov (Ubuntu + Go 1.23 only)

- **lint**: Lints code using golangci-lint
  - Runs comprehensive linting checks
  - Uses configuration from `.golangci.yml`

- **build**: Builds binary and verifies it works
  - Builds on Ubuntu with Go 1.23
  - Verifies binary runs successfully

- **security**: Security scanning
  - Runs Gosec security scanner
  - Uploads results to GitHub Security tab (SARIF format)

**Status:** Required for PR merges

### 2. Build Workflow (`build.yml`)

**Trigger:** Push to `main`/`develop`, pull requests, manual dispatch

**Purpose:** Cross-platform binary builds

**Jobs:**
- **build-matrix**: Builds for 6 platforms
  - linux/amd64, linux/arm64
  - darwin/amd64, darwin/arm64 (macOS)
  - windows/amd64, windows/arm64

**Features:**
- CGO disabled for static binaries
- Build flags inject version, commit, build date
- Creates platform-specific archives (tar.gz for Unix, zip for Windows)
- Generates SHA256 checksums
- Uploads artifacts with 7-day retention

**Output:**
- `dd-{os}-{arch}.tar.gz` (or `.zip`)
- `dd-{os}-{arch}.tar.gz.sha256`

### 3. Release Workflow (`release.yml`)

**Trigger:** Version tags (`v*.*.*`, `v*.*.*-*`)

**Purpose:** Automated release creation

**Jobs:**
- **build**: Builds release binaries for all platforms
  - Same 6 platforms as build workflow
  - Includes version in archive name
  - Generates checksums

- **release**: Creates GitHub Release
  - Downloads all build artifacts
  - Generates changelog from git commits
  - Creates comprehensive release notes with installation instructions
  - Uploads all binaries and checksums
  - Marks pre-releases for version tags with `-` suffix

**Release Notes Include:**
- Version number
- Platform-specific installation commands
- Generated changelog
- SHA256 checksums for verification

**Example Tag:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 4. Coverage Workflow (`coverage.yml`)

**Trigger:** Push to `main`/`develop` and pull requests

**Purpose:** Code coverage reporting and enforcement

**Jobs:**
- **coverage**: Generates and analyzes coverage
  - Runs tests with race detector
  - Generates HTML coverage report
  - Calculates coverage percentage
  - Enforces 70% minimum threshold
  - Uploads to Codecov
  - Comments coverage on PRs
  - Creates coverage badge data
  - Adds summary to GitHub Actions summary

**Threshold:** 70% minimum coverage required

**Artifacts:**
- HTML coverage report (30-day retention)

### 5. Docker Workflow (`docker.yml`)

**Trigger:** Push to `main`/`develop`, version tags, pull requests, manual dispatch

**Purpose:** Build and publish Docker images

**Jobs:**
- **build-and-push**: Multi-architecture Docker builds
  - Platforms: linux/amd64, linux/arm64
  - Pushes to GitHub Container Registry (ghcr.io)
  - Runs Trivy vulnerability scanner
  - Uploads security results to GitHub Security tab

**Image Tags:**
- `latest` - Latest commit on default branch
- `main` - Latest commit on main branch
- `develop` - Latest commit on develop branch
- `v1.2.3` - Semantic version tag
- `v1.2` - Major.minor version
- `v1` - Major version only
- `main-abc123` - Branch name + commit SHA

**Registry:** `ghcr.io/{owner}/{repo}`

**Usage:**
```bash
docker pull ghcr.io/{owner}/{repo}:latest
docker run --rm ghcr.io/{owner}/{repo}:latest version
```

## Secrets and Configuration

### Required Secrets

None required for basic functionality. Optional:

- `CODECOV_TOKEN` - For Codecov integration (optional)
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Permissions

Each workflow declares its required permissions:
- `contents: read` - Read repository contents
- `contents: write` - Create releases (release workflow)
- `packages: write` - Push Docker images (docker workflow)
- `pull-requests: write` - Comment on PRs (coverage workflow)

## Security Practices

All workflows follow GitHub Actions security practices:

1. **No Command Injection**: Never use untrusted input directly in shell commands
2. **Environment Variables**: Use environment variables for GitHub context values
3. **Trusted Inputs Only**: Only use safe inputs like `github.ref_name`, `github.sha`
4. **Pinned Actions**: Actions use major version tags (@v4, @v5)
5. **Minimal Permissions**: Each workflow requests only necessary permissions
6. **Dependency Verification**: Go modules verified before builds
7. **Security Scanning**: Gosec and Trivy scan for vulnerabilities

### Safe vs Unsafe Inputs

**Safe (can use directly):**
- `github.ref_name` - Git ref name
- `github.sha` - Commit SHA
- `github.run_id` - Workflow run ID
- `github.repository` - Repository name

**Unsafe (must use environment variables):**
- `github.event.issue.title`
- `github.event.pull_request.body`
- `github.event.head_commit.message`
- User-provided content

## Workflow Dependencies

```
ci.yml (required for PR merge)
  ├── test (multi-platform, multi-version)
  ├── lint
  ├── build
  └── security

build.yml (artifact generation)
  └── build-matrix (6 platforms)

coverage.yml (quality gate)
  └── coverage (70% threshold)

docker.yml (container publishing)
  └── build-and-push (multi-arch)

release.yml (on version tag)
  ├── build (6 platforms)
  └── release (creates GitHub release)
```

## Local Development

Run CI checks locally before pushing:

```bash
# All checks
make ci

# Individual checks
make fmt-check    # Check formatting
make vet          # Run go vet
make lint         # Run golangci-lint
make test-race    # Test with race detector
make test-coverage # Generate coverage

# Build
make build        # Current platform
make build-all    # All platforms
```

## Troubleshooting

### Test Failures

Check test logs in GitHub Actions:
1. Navigate to Actions tab
2. Click failing workflow
3. Expand failing job
4. Review test output

### Build Failures

Common issues:
- Go version mismatch
- Dependency issues: run `go mod tidy`
- Platform-specific code: use build tags

### Coverage Below Threshold

Add tests to increase coverage:
```bash
make test-coverage
open coverage.html
```

### Docker Build Failures

Check Dockerfile syntax:
```bash
make docker
docker run --rm datadog-cli:latest version
```

### Release Not Created

Ensure tag format is correct:
- Valid: `v1.0.0`, `v1.2.3-alpha.1`
- Invalid: `1.0.0`, `release-1.0`

## Workflow Maintenance

### Updating Go Version

Update in all workflow files:
1. `ci.yml` - Matrix versions
2. `build.yml` - Go setup
3. `coverage.yml` - Go setup
4. `docker.yml` - Dockerfile Go version
5. `release.yml` - Go setup

### Adding New Platforms

Update `build.yml` and `release.yml` matrix:
```yaml
- goos: freebsd
  goarch: amd64
```

### Modifying Linter Rules

Edit `.golangci.yml` configuration file.

## Best Practices

1. **Always run `make ci` before pushing**
2. **Keep workflows DRY** - Use reusable workflows if patterns repeat
3. **Cache dependencies** - All workflows use Go module caching
4. **Fail fast** - Use `fail-fast: false` in test matrix
5. **Meaningful names** - Clear job and step names
6. **Timeout protection** - Set appropriate timeouts
7. **Artifact retention** - Balance storage vs utility

## Status Badges

Add to README.md:

```markdown
[![CI](https://github.com/{owner}/{repo}/workflows/CI/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/{owner}/{repo}/branch/main/graph/badge.svg)](https://codecov.io/gh/{owner}/{repo})
[![Go Report Card](https://goreportcard.com/badge/github.com/{owner}/{repo})](https://goreportcard.com/report/github.com/{owner}/{repo})
[![Docker](https://github.com/{owner}/{repo}/workflows/Docker/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/docker.yml)
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Go on GitHub Actions](https://github.com/actions/setup-go)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Codecov GitHub Action](https://github.com/codecov/codecov-action)
- [golangci-lint Action](https://github.com/golangci/golangci-lint-action)
