# Workflow Status Dashboard

This document provides quick access to CI/CD workflow information and status checks.

## Active Workflows

### 1. CI Pipeline (`ci.yml`)
**Status**: Active
**Frequency**: On push to main/develop/release/*, on PRs
**Duration**: ~15 minutes average

**Jobs**:
- Lint & Type Check
- Test (Node 20)
- Security Audit
- Dependency Check
- Build (Next.js)
- Status Check

**View**: [CI Workflow](../../actions/workflows/ci.yml)

### 2. E2E Tests (`e2e.yml`)
**Status**: Active
**Frequency**: On push to main/phase2/*, on PRs
**Duration**: ~30 minutes (PR: Chromium only)

**Jobs**:
- E2E Tests (Chromium)
- E2E Tests Full (All browsers)
- Status Check

**View**: [E2E Workflow](../../actions/workflows/e2e.yml)

### 3. macOS Build (`build-macos.yml`)
**Status**: Active
**Frequency**: On push to main/release/*, on version tags, manual trigger
**Duration**: ~20 minutes

**Jobs**:
- Build macOS App (ARM64)
- Build Universal Binary
- Test Build

**View**: [macOS Build Workflow](../../actions/workflows/build-macos.yml)

### 4. Release (`release.yml`)
**Status**: Active
**Frequency**: On version tags (v*.*.*), manual trigger
**Duration**: ~30 minutes

**Jobs**:
- Create Release
- Build macOS
- Build Linux (placeholder)
- Build Windows (placeholder)
- Publish Release

**View**: [Release Workflow](../../actions/workflows/release.yml)

### 5. Security Audit (`security-audit.yml`)
**Status**: Active
**Frequency**: On push to main, all PRs
**Duration**: ~5 minutes

**Jobs**:
- Security Audit

**View**: [Security Audit Workflow](../../actions/workflows/security-audit.yml)

### 6. Security Scan (`security-scan.yml`)
**Status**: Active
**Frequency**: On push to main/develop, PRs, weekly schedule
**Duration**: ~15 minutes

**Jobs**:
- Dependency Scan
- Secret Scan
- SAST (CodeQL)
- License Check
- Snyk Scan (if token available)
- TypeScript Check
- ESLint Check
- SBOM Generation
- Security Summary

**View**: [Security Scan Workflow](../../actions/workflows/security-scan.yml)

### 7. PR Checks (`pr-checks.yml`)
**Status**: Active
**Frequency**: On PRs to main
**Duration**: ~20 minutes

**View**: [PR Checks Workflow](../../actions/workflows/pr-checks.yml)

### 8. Main Branch CI (`main-branch-ci.yml`)
**Status**: Active
**Frequency**: On push to main
**Duration**: ~15 minutes

**View**: [Main Branch CI Workflow](../../actions/workflows/main-branch-ci.yml)

## Quick Links

### View Live Workflows
- [All Workflows](../../actions)
- [Recent Runs](../../actions)
- [Workflow Runs by Event](../../actions?query=branch%3Amain)

### Badges
Add to README.md:
```markdown
[![CI](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml)
[![macOS Build](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml)
[![Release](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/release.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/release.yml)
[![Security Scan](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/security-scan.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/security-scan.yml)
```

## Secrets Configuration

Required secrets (set in **Settings → Secrets and variables → Actions**):

### Build/Release Secrets
- `TAURI_PRIVATE_KEY`: Tauri app signing key
- `TAURI_KEY_PASSWORD`: Password for Tauri key

### Optional Secrets (Enhanced Features)
- `CODECOV_TOKEN`: Code coverage integration
- `DD_API_KEY`: Datadog API integration
- `DD_APP_KEY`: Datadog app key
- `SNYK_TOKEN`: Snyk security scanning

### GitHub-provided Secrets
- `GITHUB_TOKEN`: Automatically available (no configuration needed)

## Workflow Triggers

### Branch-based Triggers
| Workflow | main | develop | release/* | PRs |
|----------|------|---------|-----------|-----|
| CI | ✅ | ✅ | ✅ | ✅ |
| E2E | ✅ | ✅ | ❌ | ✅ |
| macOS Build | ✅ | ❌ | ✅ | ❌ |
| Release | - | - | - | - |
| Security Audit | ✅ | ❌ | ❌ | ✅ |
| Security Scan | ✅ | ✅ | ❌ | ✅ |

### Tag-based Triggers
| Workflow | v*.*.* |
|----------|--------|
| macOS Build | ✅ |
| Release | ✅ |

## Performance Metrics

### Target Durations
- **CI**: < 15 minutes
- **E2E (PR)**: < 10 minutes (Chromium only)
- **E2E (Full)**: < 30 minutes (all browsers)
- **macOS Build**: < 20 minutes
- **Release**: < 30 minutes
- **Security Scan**: < 15 minutes

### Optimization Tips
- Dependencies are cached for faster installs
- Build artifacts are retained 7-30 days
- Use `needs:` only when job dependencies are required
- Concurrency groups prevent duplicate runs

## Test Coverage

### Unit Tests
- Location: `tests/unit/**/*.test.ts`
- Framework: Jest
- Coverage: Target > 80%
- Command: `npm run test:unit`

### Integration Tests
- Location: `tests/integration/**/*.test.ts`
- Framework: Jest
- Services: Redis, PostgreSQL
- Command: `npm run test:integration`

### E2E Tests
- Location: `tests/e2e/**/*.test.ts`
- Framework: Playwright
- Browsers: Chromium (PR), All (main)
- Command: `npm run test:e2e`

### Security Tests
- Location: `tests/security/**/*.test.ts`
- Framework: Jest
- Command: `npm run test:security`

## Troubleshooting

### Workflow Not Running
1. Check branch name matches trigger condition
2. Verify workflow file syntax: `github workflow validate .github/workflows/*.yml`
3. Check if workflow is disabled in repo settings
4. Verify file changes match any path filters

### Job Timeout
1. Jobs have 360-minute default timeout
2. Check individual job timeout settings in workflow
3. Long-running tests may need timeout increase
4. Consider splitting into smaller jobs

### Out of Disk Space
1. Runners have ~14GB available
2. Clean up artifact retention policies
3. Remove large unnecessary files
4. Check build artifact sizes

### Cache Issues
1. Cache is keyed by `package-lock.json`
2. Changing dependencies invalidates cache
3. Use `cache-hit` outputs to debug
4. Manual cache clearing available in Actions tab

## Improving Workflow Performance

### Caching Best Practices
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Automatically caches node_modules
```

### Parallel Execution
```yaml
jobs:
  job1:  # Runs in parallel
    runs-on: ubuntu-latest
  job2:  # Runs in parallel
    runs-on: ubuntu-latest
  job3:  # Waits for job1 and job2
    needs: [job1, job2]
```

### Conditional Steps
```yaml
- name: Step name
  if: github.ref == 'refs/heads/main'
  run: npm run build
```

## Monitoring

### View Workflow Runs
1. Go to **Actions** tab in repository
2. Select workflow from left sidebar
3. Click on run to see details
4. Expand jobs to see step logs

### Check Artifact Downloads
1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download ZIP file with test results/coverage
4. Extract and review

### Review Logs
1. Click on job name in workflow run
2. Expand any step to see full log output
3. Search logs with browser find (Cmd/Ctrl + F)

## Future Enhancements

- [ ] Scheduled performance benchmarking
- [ ] Automated dependency update summaries
- [ ] Custom metrics dashboard
- [ ] Advanced test result analysis
- [ ] Release candidate builds
- [ ] A/B testing pipeline

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CI_CD_SETUP.md](../../CI_CD_SETUP.md) - Comprehensive CI/CD guide
- [GitHub Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Actions Best Practices](https://docs.github.com/en/actions/guides)

---

**Last Updated**: 2026-01-14
**Maintained By**: Development Team
