# CI/CD Quick Reference Card

**TL;DR** for common CI/CD tasks

## Before Committing

```bash
npm run lint              # Fix ESLint issues
npm run type-check       # Check TypeScript
npm run test:coverage    # Run tests
npx prettier --write "src/**/*.{ts,tsx}"  # Format code
```

**Checklist**:
- [ ] All tests pass locally
- [ ] No console.log in production code
- [ ] No hardcoded secrets
- [ ] TypeScript types check
- [ ] ESLint passes
- [ ] Prettier formatted

## Pull Requests

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes following guidelines
3. Push: `git push origin feature/my-feature`
4. Create PR with description
5. Wait for CI to pass ✅
6. Get review approval
7. Merge when ready

**PR Template**:
```markdown
## What changed?
Brief description

## Related issues
Fixes #123

## How to test
Steps to verify

## Screenshots (if applicable)
Images or videos
```

## Common CI Issues & Fixes

### ESLint Fails
```bash
npx eslint . --fix
npm run lint  # Verify
```

### TypeScript Fails
```bash
npm run type-check
# Fix reported errors in code
```

### Tests Fail
```bash
npm test -- --testPathPattern=<failing-test>
npm run test:watch  # Debug in watch mode
```

### Build Fails
```bash
rm -rf .next node_modules
npm ci --legacy-peer-deps
npm run build
```

## Creating a Release

```bash
# Method 1: Tag-based (recommended)
git tag v1.5.0
git push origin v1.5.0
# Workflow runs automatically

# Method 2: Manual trigger
# Go to Actions → Release → Run workflow
# Enter version: v1.5.0
```

Version format: `v1.5.0` (semantic versioning)
- `1` = major version (breaking changes)
- `5` = minor version (new features)
- `0` = patch version (bug fixes)

## View CI Results

1. Go to **Actions** tab in GitHub
2. Click on workflow name
3. Click on most recent run
4. Expand failed jobs for details
5. Review step output and logs

## Important Links

| Resource | Link |
|----------|------|
| CI Setup Guide | [CI_CD_SETUP.md](../../CI_CD_SETUP.md) |
| Workflows Status | [WORKFLOW_STATUS.md](WORKFLOW_STATUS.md) |
| Best Practices | [CI_CD_BEST_PRACTICES.md](CI_CD_BEST_PRACTICES.md) |
| Troubleshooting | [CI_CD_TROUBLESHOOTING.md](CI_CD_TROUBLESHOOTING.md) |
| Workflow Dev | [WORKFLOW_DEVELOPMENT_GUIDE.md](WORKFLOW_DEVELOPMENT_GUIDE.md) |
| GitHub Actions | [docs.github.com/en/actions](https://docs.github.com/en/actions) |

## Commit Message Format

```
feat(scope): Add new feature
fix(scope): Fix bug
docs(scope): Update docs
test(scope): Add tests
chore(scope): Update dependencies
```

**Examples**:
```
feat(auth): Add two-factor authentication
fix(api): Handle null response in service
docs(readme): Update installation
test(utils): Add helper tests
chore(deps): Update Next.js
```

## Test Commands

```bash
npm run test              # Run all tests
npm run test:coverage     # With coverage report
npm run test:watch       # Watch mode
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # E2E tests
npm run test:e2e:headed  # E2E with browser UI
npm run test:security    # Security tests
npm run test:performance # Performance tests
```

## Useful Scripts

```bash
# Code quality
npm run lint
npm run type-check

# Building
npm run build            # Next.js app
npm run tauri:build     # macOS app
npm run tauri:build:debug  # Debug build

# Formatting
npx prettier --check "src/**/*.{ts,tsx}"
npx prettier --write "src/**/*.{ts,tsx}"

# Dependencies
npm run security:audit
npm run security:fix
npm audit

# Performance
npm run test:performance
```

## Workflow Triggers

| Workflow | Triggers |
|----------|----------|
| CI | Push to main/develop/release/*, PRs |
| E2E | Push to main, PRs |
| macOS Build | Push to main/release/*, tags |
| Release | Version tags (v*.*.*) |
| Security Scan | Push to main/develop, PRs |

## Secrets Configuration

Required in **Settings → Secrets and variables → Actions**:

1. `TAURI_PRIVATE_KEY` - For macOS app signing
2. `TAURI_KEY_PASSWORD` - Key password

Optional:
- `CODECOV_TOKEN` - Coverage tracking
- `SNYK_TOKEN` - Vulnerability scanning
- `DD_API_KEY` - Datadog integration

## GitHub CLI Quick Commands

```bash
# View workflow status
gh run view

# List recent runs
gh run list

# Watch specific workflow
gh run watch <run-id>

# View run logs
gh run view --log <run-id>

# Download artifacts
gh run download <run-id>

# Trigger workflow manually
gh workflow run ci.yml
```

## Performance Tips

- Enable npm caching (automatic in CI)
- Run tests in watch mode during development
- Use `npm ci` instead of `npm install` in CI
- Commit `package-lock.json` to version control
- Keep dependencies up to date

## Workflow Status

Check **Actions** tab to see:
- ✅ Passing - All checks passed
- ❌ Failed - Review logs for errors
- ⏳ In Progress - Workflow is running
- ⏭️ Skipped - Conditional step not run

## When Things Break

1. **Check the logs** - Most errors visible in job logs
2. **Run locally** - `npm run test`, `npm run build`
3. **Clear cache** - GitHub Actions → Manage caches
4. **Read error message** - Often has solution
5. **Ask for help** - File issue with logs attached

## Status Badges

Add to README:
```markdown
[![CI](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
[![E2E](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml)
```

## Quick Stats

- **CI Duration**: ~15 minutes
- **E2E Duration**: ~10-30 minutes
- **Build Duration**: ~20 minutes
- **Test Coverage**: Target > 80%
- **Pass Rate**: Target > 95%

## Did You Know?

- Workflows auto-cancel previous runs on new push
- Dependencies are cached for faster builds
- E2E tests capture videos on failure
- Coverage reports uploaded to Codecov
- macOS apps are signed automatically
- Release notes auto-generated from commits

## More Help

- Full guide: [CI_CD_SETUP.md](../../CI_CD_SETUP.md)
- Troubleshooting: [CI_CD_TROUBLESHOOTING.md](CI_CD_TROUBLESHOOTING.md)
- Best practices: [CI_CD_BEST_PRACTICES.md](CI_CD_BEST_PRACTICES.md)

---

**Last Updated**: 2026-01-14 | Print this for your desk! 📋
