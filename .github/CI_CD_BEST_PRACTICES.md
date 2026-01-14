# CI/CD Best Practices

This guide outlines best practices for working with the VibeCode CI/CD pipeline.

## Code Quality Standards

### 1. Linting & Formatting

**Before Committing**:
```bash
# Check for lint issues
npm run lint

# Fix formatting automatically
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"

# Check type safety
npm run type-check
```

**Guidelines**:
- Follow ESLint rules without exceptions
- Use Prettier for consistent formatting
- Fix all TypeScript type errors
- No `any` types without explicit justification

### 2. Testing Requirements

#### Minimum Coverage
- **Overall**: 80% code coverage
- **Critical paths**: 100% coverage
- **New code**: Must meet coverage requirements
- **Tests**: Must pass locally before pushing

#### Running Tests Locally
```bash
# All tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Specific test file
npm test -- path/to/test.ts

# Coverage report
npm test -- --coverage --detectOpenHandles
```

#### Test Organization
```
tests/
├── unit/              # Fast, isolated tests
├── integration/       # Service integration tests
├── e2e/              # End-to-end tests
├── security/         # Security-focused tests
└── performance/      # Performance benchmarks
```

### 3. Commit Messages

Follow conventional commits for clear history:

```
feat(scope): Add new feature
fix(scope): Fix bug in feature
docs(scope): Update documentation
test(scope): Add tests for feature
chore(scope): Update dependencies
refactor(scope): Restructure code
perf(scope): Improve performance
```

**Examples**:
```
feat(auth): Add two-factor authentication
fix(api): Handle null response in service
docs(readme): Update installation instructions
test(utils): Add test coverage for helpers
chore(deps): Update Next.js to v16
```

## Pull Request Guidelines

### Pre-submission Checklist
- [ ] Code follows ESLint rules
- [ ] All tests pass locally: `npm run test:coverage`
- [ ] TypeScript type checking passes: `npm run type-check`
- [ ] No console.log statements in production code
- [ ] No hardcoded secrets or API keys
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional commits

### PR Description Template
```markdown
## Description
Brief description of changes

## Related Issues
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How to Test
Steps to verify the changes

## Screenshots (if applicable)
Relevant screenshots or GIFs

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Tests pass locally
```

### After CI Completes
1. Review all workflow results
2. Address any failed checks
3. Update code if security warnings found
4. Request review once all checks pass
5. Address review comments promptly

## Workflow Management

### Understanding Workflow Status

**Successful Run**:
```
✅ Lint: Passed
✅ Test: Passed
✅ Build: Passed
✅ Security: Passed
```

**Failed Run**:
```
❌ Lint: Failed
   └─ Fix ESLint issues before retrying
✅ Test: Passed
❌ Security: Failed
   └─ Review vulnerability report
```

### Handling Failures

#### ESLint Failures
```bash
# See all issues
npm run lint

# Auto-fix what can be fixed
npx eslint . --fix

# Manual fixes required
# Edit files listed in output
npm run lint  # Verify fixed
```

#### Test Failures
```bash
# Run failing test
npm test -- path/to/failing.test.ts

# Debug with detailed output
DEBUG=* npm test -- path/to/failing.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="test name"
```

#### Build Failures
```bash
# Clean build
rm -rf .next node_modules
npm install
npm run build

# Check for memory issues
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

#### macOS Build Failures
```bash
# Verify build prerequisites
npm run tauri info

# Check Xcode installation
xcode-select --install

# Build with debug output
npm run tauri:build:debug
```

## Performance Optimization

### Reducing Build Time

#### 1. Dependency Caching
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Caches based on package-lock.json
```

#### 2. Parallel Jobs
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
  test:
    runs-on: ubuntu-latest
  build:
    runs-on: ubuntu-latest
  # All run in parallel by default
```

#### 3. Matrix Optimization
```yaml
strategy:
  matrix:
    node-version: [20]  # Test fewer versions on PR
  fail-fast: true  # Stop if any fails
```

### Test Performance

```bash
# Run tests in parallel
npm test -- --maxWorkers=4

# Skip watch mode in CI
npm test -- --ci --coverage

# Focus on changed files
npm test -- --onlyChanged
```

## Security Best Practices

### 1. Secret Management
- Never commit `.env.local` or credentials
- Use GitHub Secrets for sensitive data
- Rotate secrets regularly
- Audit secret access logs

### 2. Dependency Security
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Report vulnerabilities to team
npm audit --json > audit-report.json
```

### 3. Secret Detection
- Pre-commit hooks detect secrets
- TruffleHog scans for exposed data
- Review security audit workflow results
- Address any findings before merging

### 4. Code Security
```bash
# Run security tests
npm run test:security

# TypeScript helps prevent many issues
npm run type-check
```

## Release Best Practices

### Version Management

Follow semantic versioning:
- **MAJOR**: Breaking changes (v1.0.0 → v2.0.0)
- **MINOR**: New features, backward compatible (v1.0.0 → v1.1.0)
- **PATCH**: Bug fixes (v1.0.0 → v1.0.1)

### Creating a Release

```bash
# 1. Update version in package.json (or use npm version)
npm version patch  # For bug fixes
npm version minor  # For new features
npm version major  # For breaking changes

# 2. Push to GitHub (triggers release workflow)
git push origin main
git push origin v1.5.0

# 3. Verify release created
# Check: https://github.com/ryanmaclean/vibecode-webgui/releases
```

### Release Checklist
- [ ] All tests passing on main
- [ ] Version bumped in package.json
- [ ] Changelog updated
- [ ] Tag pushed to GitHub
- [ ] Release workflow completed
- [ ] Assets uploaded successfully
- [ ] Release published (not draft)

## Monitoring and Alerts

### Key Metrics to Monitor
```
- CI Pass Rate: Target > 95%
- Average CI Duration: Target < 15 min
- Test Coverage: Target > 80%
- Security Issues: Target = 0 critical
```

### Setting Up Monitoring
1. GitHub Actions provides built-in metrics
2. View in Actions tab → All workflows
3. Check branch protection rules
4. Set required status checks

## Debugging Workflows

### Viewing Logs

1. Go to **Actions** → Choose workflow
2. Click on the failing run
3. Expand the failed job
4. Review step output
5. Search with Cmd/Ctrl + F

### Enabling Debug Logging
```bash
# Set environment variable
export ACTIONS_STEP_DEBUG=true
```

### Common Issues & Solutions

#### Issue: Cache not working
**Solution**: Check if `package-lock.json` changed
```bash
git status package-lock.json
npm ci --legacy-peer-deps  # Use ci instead of install
```

#### Issue: Timeout errors
**Solution**: Increase job timeout
```yaml
jobs:
  long-job:
    timeout-minutes: 30  # Default is 360
```

#### Issue: Out of disk space
**Solution**: Clean up artifacts
1. Go to Actions settings
2. Adjust retention policies
3. Delete old artifacts manually

#### Issue: Random test failures
**Solution**: Improve test stability
```bash
# Run tests multiple times
npm test -- --maxWorkers=1  # Reduce parallelism
npm test -- --testTimeout=10000  # Increase timeout
```

## Advanced Topics

### Custom Workflows

Create new workflow in `.github/workflows/`:

```yaml
name: Custom Workflow

on:
  push:
    branches: [main]

jobs:
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Custom step
        run: echo "Running custom workflow"
```

### Workflow Permissions

```yaml
permissions:
  contents: read           # Read repository content
  pull-requests: write     # Comment on PRs
  checks: write           # Create check runs
  security-events: write  # Write security findings
```

### Environment Variables

```yaml
env:
  CI: true
  NODE_ENV: test

jobs:
  test:
    steps:
      - name: Test with env
        env:
          CUSTOM_VAR: value
        run: npm test
```

### Conditional Execution

```yaml
# Run based on branch
if: github.ref == 'refs/heads/main'

# Run based on event
if: github.event_name == 'push'

# Run based on secrets
if: secrets.SNYK_TOKEN != ''
```

## Team Communication

### Notifying Team of Issues

1. Comment on PR with details
2. Use GitHub Issues for tracking
3. @ mention relevant team members
4. Provide actionable solutions

### Status Badges

Add to README:
```markdown
[![CI Status](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
```

## Documentation

### Keeping Docs Updated
- Update README when adding workflows
- Document new test types
- Keep CI_CD_SETUP.md current
- Comment complex workflow logic

### Example Documentation
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# This workflow validates code quality
# See docs at: CI_CD_SETUP.md
```

## Tools & Resources

### Local Development
- `npm run lint` - Check code style
- `npm run type-check` - Check types
- `npm run test` - Run tests
- `npm run build` - Build app

### CI/CD Tools
- [GitHub Actions](https://docs.github.com/en/actions)
- [Dependabot](https://dependabot.com/)
- [Codecov](https://codecov.io/)
- [Snyk](https://snyk.io/)

### Documentation
- [CI_CD_SETUP.md](../../CI_CD_SETUP.md)
- [WORKFLOW_STATUS.md](WORKFLOW_STATUS.md)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**Last Updated**: 2026-01-14
**Questions?** Contact the development team
