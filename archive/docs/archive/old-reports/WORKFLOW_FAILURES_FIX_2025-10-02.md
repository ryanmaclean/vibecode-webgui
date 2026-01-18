# GitHub Actions Workflow Failures - Fix Guide
**Date**: 2025-10-02 20:11 PDT  
**Status**: Multiple workflows failing due to missing npm scripts

---

## Root Cause

Workflows are calling npm scripts that don't exist in `package.json`:

### Missing Scripts Being Called
- `test:root:infrastructure` - **DOES NOT EXIST**
- Other potentially missing test scripts

### Actual Available Scripts
```json
"test:unit": "jest --testPathPatterns=tests/unit"
"test:integration": "jest --testPathPatterns=tests/integration"
"test:e2e": "playwright test"
"test:k8s": "jest --testPathPatterns=tests/k8s"
"test:monitoring": "jest --testPathPatterns=tests/unit/.*monitoring.*"
```

---

## Failed Workflows

From the screenshot and logs:

1. **Simple Test** - 100% failure
2. **Simplified CI Test** - 100% failure  
3. **Performance Testing & Monitoring** - 100% failure
4. **VibeCode CI/CD Pipeline - Simplified** - 100% failure
5. **Main Branch CI (Lightweight)** - 100% failure
6. **Infrastructure Tests** - failure
7. **Docs Automation** - failure
8. **AI Tooling Parity** - failure
9. **Code Server Release Monitor** - failure
10. **Datadog Trace Verify** - failure

### Error Pattern
```
npm error Missing script: "test:root:infrastructure"
npm error
npm error To see a list of scripts, run:
npm error   npm run
```

---

## Immediate Fix Options

### Option 1: Add Missing Script to package.json (RECOMMENDED)

Add to `package.json` scripts section:
```json
"test:root:infrastructure": "jest --testPathPatterns=tests/infrastructure",
```

Or if infrastructure tests should run differently:
```json
"test:root:infrastructure": "jest --testPathPatterns=tests/unit/infrastructure --testPathPatterns=tests/integration/infrastructure",
```

### Option 2: Update Workflows to Use Existing Scripts

Replace `test:root:infrastructure` with existing scripts in workflows:
- `.github/workflows/test-simple.yml`
- `.github/workflows/test-coverage.yml`
- `.github/workflows/ci-simplified.yml`
- `.github/workflows/performance-testing.yml`
- `.github/workflows/main-branch-ci.yml`

Change from:
```yaml
run: npm run test:root:infrastructure
```

To:
```yaml
run: npm run test:unit
```

### Option 3: Apply Stashed Workflow Fixes

The stashed changes (stash@{0}) may contain fixes for these issues:
```bash
git stash show -p stash@{0} | grep "test:root"
git stash pop stash@{0}  # If fixes are present
```

---

## Recommended Solution

**Immediate**: Add the missing script to package.json

**File**: `package.json`

**Add after existing test scripts**:
```json
{
  "scripts": {
    // ... existing scripts ...
    "test:monitoring:e2e": "playwright test tests/e2e/monitoring-dashboard.test.ts",
    "test:root:infrastructure": "jest --testPathPatterns=tests/infrastructure --maxWorkers=1",
    // ... rest of scripts ...
  }
}
```

**Then commit and push**:
```bash
git add package.json
git commit -m "fix: add missing test:root:infrastructure script for CI workflows"
git push origin main
```

---

## Verification Steps

After fix:

1. **Check Workflow Runs**:
   ```bash
   gh run list --limit 5
   ```

2. **Watch Latest Run**:
   ```bash
   gh run watch
   ```

3. **Verify Script Works Locally**:
   ```bash
   npm run test:root:infrastructure
   ```

---

## Additional Issues to Check

### Other Potentially Missing Scripts

Check workflows for other missing scripts:
```bash
grep -r "npm run test:" .github/workflows/ | grep -v "test:unit\|test:integration\|test:e2e" | sort -u
```

### Stashed Workflow Fixes

The stash contains workflow updates from other agents:
```bash
git stash list
# stash@{0}: On main: WIP: Workflow and agent documentation updates
```

**Review stash contents**:
```bash
git stash show -p stash@{0} -- package.json
```

This may contain the missing script definitions.

---

## Long-term Solution

### 1. Standardize Test Scripts

Create a consistent naming convention:
- `test:unit` - Unit tests
- `test:integration` - Integration tests
- `test:e2e` - End-to-end tests
- `test:infrastructure` - Infrastructure tests (rename from test:root:infrastructure)
- `test:monitoring` - Monitoring tests
- `test:k8s` - Kubernetes tests

### 2. Document Test Scripts

Add to README.md or TESTING.md:
```markdown
## Available Test Scripts

- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:infrastructure` - Run infrastructure tests
- `npm run test:monitoring` - Run monitoring tests
- `npm run test:k8s` - Run Kubernetes tests
```

### 3. Validate Workflows

Create a script to validate all workflow npm commands exist:
```bash
#!/bin/bash
# scripts/validate-workflow-scripts.sh

echo "Checking for missing npm scripts in workflows..."

for workflow in .github/workflows/*.yml; do
  scripts=$(grep -o "npm run [a-z:]*" "$workflow" | cut -d' ' -f3 | sort -u)
  for script in $scripts; do
    if ! npm run | grep -q "^  $script$"; then
      echo "❌ Missing script '$script' referenced in $workflow"
    fi
  done
done
```

---

## Impact Assessment

### Current State
- **10+ workflows failing** (100% failure rate)
- **CI/CD pipeline blocked**
- **No automated testing running**
- **Deployments potentially blocked**

### After Fix
- ✅ All workflows should pass
- ✅ CI/CD pipeline restored
- ✅ Automated testing functional
- ✅ Deployments unblocked

---

## Next Steps

1. **Immediate** (Now):
   - Add missing `test:root:infrastructure` script to package.json
   - Commit and push
   - Monitor workflow runs

2. **Short-term** (Today):
   - Review stashed workflow fixes
   - Apply relevant fixes
   - Verify all workflows pass

3. **Medium-term** (This Week):
   - Standardize test script naming
   - Document all test scripts
   - Create workflow validation script
   - Clean up obsolete workflows

---

## Files to Modify

### Primary Fix
- `package.json` - Add missing script

### Optional (if stash doesn't have fixes)
- `.github/workflows/test-simple.yml`
- `.github/workflows/test-coverage.yml`
- `.github/workflows/ci-simplified.yml`
- `.github/workflows/performance-testing.yml`
- `.github/workflows/main-branch-ci.yml`

---

**Priority**: 🔴 **CRITICAL** - Blocking CI/CD  
**Effort**: 5 minutes (add script) or 30 minutes (update workflows)  
**Recommendation**: Add the missing script immediately, then review stashed fixes

---

**Created**: 2025-10-02 20:11 PDT  
**Status**: Ready for implementation
