# CI/CD Troubleshooting Guide

Comprehensive guide for diagnosing and fixing CI/CD pipeline issues.

## Quick Diagnostics

### Check Workflow Status
1. Go to **Actions** tab in repository
2. View **All workflows** or specific workflow
3. Look for failing jobs (red X)
4. Click on failed job to see error details

### Most Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Lint failures | `npm run lint && npx prettier --write src/**/*.{ts,tsx}` |
| Type errors | `npm run type-check` and fix reported errors |
| Test failures | `npm test -- --testPathPattern=<failing-test>` |
| Build fails | `rm -rf .next node_modules && npm ci && npm run build` |
| macOS build | `npm run tauri info` to check prerequisites |

## Build & Setup Issues

### npm install/ci Failures

**Symptom**: `npm ci` fails during workflow
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions**:
```bash
# 1. Use legacy peer deps (configured in CI)
npm ci --legacy-peer-deps

# 2. Clear cache locally
npm cache clean --force
npm ci --legacy-peer-deps

# 3. Update lock file
rm package-lock.json
npm install --legacy-peer-deps
git commit -am "chore: update package-lock"
```

**In Workflow**: Already uses `--legacy-peer-deps` flag

### Node Version Issues

**Symptom**: Cryptic build errors
```
Module requires Node >= 18
```

**Solutions**:
```bash
# Check current Node version
node --version

# Check what workflow uses
cat .github/workflows/ci.yml | grep node-version

# Match local to workflow version
nvm install 20
nvm use 20
```

### Missing Dependencies

**Symptom**: `Cannot find module 'xyz'`
```
Module not found: Can't resolve '@/components/Button'
```

**Solutions**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Check tsconfig paths
cat tsconfig.json | grep -A 5 '"paths"'

# Verify the path exists
ls -la src/components/Button
```

## Linting & Type Checking

### ESLint Failures

**Symptom**: ESLint check fails
```
28 errors and 5 warnings potentially fixable with the --fix option
```

**Steps to Fix**:
```bash
# 1. See all errors
npm run lint

# 2. Auto-fix what can be fixed
npx eslint . --fix

# 3. Manual fixes needed for remaining issues
# Edit files listed in output

# 4. Verify fixed
npm run lint
```

**Common Rules**:
- Remove unused imports
- Fix indentation
- Remove console.log statements
- Use const instead of let/var
- Use arrow functions

### TypeScript Type Errors

**Symptom**: Type checking fails
```
error TS2339: Property 'xyz' does not exist on type 'ABC'
```

**Steps to Fix**:
```bash
# 1. Run type check with details
npm run type-check

# 2. Review each error
# - Line number and error code shown

# 3. Fix by:
#    - Adding type annotations
#    - Checking property existence
#    - Importing correct types
#    - Using type guards

# 4. Verify fixed
npm run type-check
```

**Common Fixes**:
```typescript
// Add type annotation
const user: User = data;

// Add null check
if (user?.name) {
  console.log(user.name);
}

// Import type
import type { User } from './types';

// Use type assertion (when needed)
const value = data as string;
```

### Prettier Formatting Errors

**Symptom**: Formatting check fails
```
Check formatting (Prettier)... FAILED
```

**Steps to Fix**:
```bash
# 1. Auto-fix all formatting
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"

# 2. Verify fixed
npx prettier --check "src/**/*.{ts,tsx,js,jsx}"

# 3. Commit changes
git add .
git commit -m "style: format code with prettier"
```

## Testing Issues

### Test Failures

**Symptom**: Jest tests fail
```
FAIL src/__tests__/Component.test.tsx
● Error: ENOENT: no such file or directory
```

**Diagnosis Steps**:
```bash
# 1. Run test locally
npm test -- src/__tests__/Component.test.tsx

# 2. Get detailed output
npm test -- --verbose src/__tests__/Component.test.tsx

# 3. Run with debug info
DEBUG=* npm test -- src/__tests__/Component.test.tsx

# 4. Run in watch mode for development
npm run test:watch
```

**Common Fixes**:
```bash
# Fix path issues
# Update test import paths to match actual file locations

# Clear Jest cache
npm test -- --clearCache

# Use correct matcher
# expect(value).toBe() for primitives
# expect(object).toEqual() for objects

# Mock required dependencies
jest.mock('@/api/service', () => ({
  fetchUser: jest.fn()
}));
```

### Test Timeout Issues

**Symptom**: Test timeout
```
Jest did not exit one second after the test run has completed
```

**Solutions**:
```bash
# 1. Increase timeout in test
jest.setTimeout(10000); // 10 seconds

# 2. Increase timeout in CI workflow
# Edit .github/workflows/ci.yml
timeout-minutes: 30  # For long tests

# 3. Close resources in tests
afterEach(async () => {
  await database.close();
  await redis.quit();
});

# 4. Run tests without watch mode
npm test -- --forceExit
```

### Missing Test Files

**Symptom**: Test file not found
```
Cannot find module './User.test.ts'
```

**Solutions**:
```bash
# 1. Check file exists
find . -name "User.test.ts"

# 2. Create test file if missing
touch src/__tests__/User.test.ts

# 3. Verify test config finds files
cat jest.config.js | grep testMatch

# 4. Check file naming convention
# Should match: **/*.test.ts or **/*.spec.ts
```

### Redis/Service Connection Failures

**Symptom**: Integration test fails with connection error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions**:
```bash
# 1. Check service is running in CI
# Look at workflow file - should include service definition:
services:
  redis:
    image: redis:7-alpine

# 2. Use correct host in tests
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379
});

# 3. Add health checks
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let connected = false;
for (let i = 0; i < 30; i++) {
  try {
    await redis.ping();
    connected = true;
    break;
  } catch (e) {
    await wait(100);
  }
}
```

## Build Issues

### Next.js Build Failures

**Symptom**: Next.js build fails
```
error - TypeError: Cannot read property 'name' of undefined
```

**Diagnosis**:
```bash
# 1. Clean build
rm -rf .next
npm run build

# 2. Check for circular imports
# Look for files that import each other

# 3. Verify environment variables
cat .env.local
# Check if required vars are set

# 4. Check API routes
ls -la src/app/api/
# Verify all API files are valid
```

**Common Fixes**:
```bash
# Fix environment variables
export NEXT_PUBLIC_API_URL=http://localhost:3000

# Fix API routes
# Ensure all route files are valid:
// src/app/api/route.ts
export async function GET(req: Request) {
  return new Response('OK');
}

# Enable debug output
DEBUG=next:* npm run build
```

### Build Memory Issues

**Symptom**: Build killed or out of memory
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed
```

**Solutions**:
```bash
# 1. Increase Node memory locally
NODE_OPTIONS=--max-old-space-size=4096 npm run build

# 2. Increase in workflow
# Edit .github/workflows/ci.yml
env:
  NODE_OPTIONS: --max-old-space-size=4096

# 3. Reduce build parallelism
# Edit next.config.js
experimental: {
  parallelServerBuildTraces: false,
}

# 4. Check for large dependencies
npm ls --depth=0
# Remove unnecessary large packages
```

## Security Issues

### Dependency Vulnerabilities

**Symptom**: Security audit finds vulnerabilities
```
npm audit severity moderate found
```

**Steps to Fix**:
```bash
# 1. Review vulnerabilities
npm audit

# 2. Attempt auto-fix
npm audit fix

# 3. Manual fix if needed
npm install package-name@^new-version

# 4. Verify fix
npm audit

# 5. Test updated dependency
npm run test:coverage
npm run build
```

### Secret Detection Failures

**Symptom**: TruffleHog finds exposed secrets
```
High-Confidence Secret: Generic API Key
```

**Steps to Fix**:
```bash
# 1. DO NOT commit sensitive data

# 2. Remove from git history if already committed
git filter-branch --tree-filter 'rm -f .env.local'

# 3. If in commit message, rewrite history
git rebase -i HEAD~N  # N = number of commits back

# 4. Use GitHub Secrets instead
# Settings → Secrets and variables → Actions

# 5. Update code to use secrets
const apiKey = process.env.API_KEY;
```

### Type Safety Warnings

**Symptom**: TypeScript warns about unsafe types
```
Parameter 'data' implicitly has an 'any' type
```

**Steps to Fix**:
```typescript
// ❌ Bad
function processData(data) {
  return data.name;
}

// ✅ Good
function processData(data: User): string {
  return data.name;
}

// Or use strict mode in tsconfig.json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## macOS Build Issues

### Tauri Build Failures

**Symptom**: Tauri build fails
```
error: cannot find -lSystem
```

**Diagnosis**:
```bash
# 1. Check Tauri prerequisites
npm run tauri info

# 2. Verify Xcode installation
xcode-select --print-path

# 3. Accept Xcode license
sudo xcode-select --reset
sudo xcode-select --install
```

**Common Fixes**:
```bash
# 1. Update Xcode command line tools
sudo xcode-select --reset
sudo xcode-select --install

# 2. Reinstall Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update

# 3. Clear Tauri cache
rm -rf src-tauri/target
npm run tauri:build

# 4. For Apple Silicon
rustup target add aarch64-apple-darwin
```

### DMG Creation Issues

**Symptom**: DMG file not created
```
No DMG files found
```

**Solutions**:
```bash
# 1. Check build artifacts exist
find src-tauri/target -name "*.app"

# 2. Build in debug mode first
npm run tauri:build:debug

# 3. Create DMG manually if needed
hdiutil create -srcfolder "src-tauri/target/release/bundle/macos/VibeCode.app" \
  -volname "VibeCode" \
  -format UDZO \
  VibeCode.dmg

# 4. Check build type in CI
# Verify build_type input in workflow
```

### App Signing Issues

**Symptom**: Code signing fails
```
error: Failed to sign "src-tauri/target/release/bundle/macos/VibeCode.app"
```

**Solutions**:
```bash
# 1. Check signing certificate
security find-identity -v -p codesigning

# 2. Verify secrets are set
# Settings → Secrets → Check TAURI_PRIVATE_KEY and TAURI_KEY_PASSWORD

# 3. For local builds (development)
npm run tauri:build:debug  # Uses development certificate

# 4. Verify certificate validity
security find-identity -p codesigning -v
```

## Workflow Issues

### Workflow Not Triggering

**Symptom**: Changes pushed but workflow doesn't run
```
No workflows visible in Actions tab
```

**Diagnosis Steps**:
```bash
# 1. Check workflow file syntax
# Use VS Code extension: GitHub Actions Validator

# 2. Verify branch name
git branch  # Should match workflow trigger branch

# 3. Check file changes match path filters
# If workflow has paths filter, ensure files changed

# 4. Verify workflow not disabled
# Settings → Actions → General
# Check workflow not disabled

# 5. View workflow errors
# Settings → Actions → General → Logs
```

**Common Causes**:
- Branch name doesn't match (e.g., `main` vs `master`)
- Workflow has path filter and files outside path changed
- Workflow is disabled in repository settings
- Syntax error in workflow YAML

### Workflow Timeout

**Symptom**: Job gets cancelled after timeout
```
The operation exceeded the maximum execution time of 360 minutes
```

**Solutions**:
```yaml
# 1. Increase job timeout
jobs:
  long-job:
    timeout-minutes: 600  # 10 hours instead of 6

# 2. Split into smaller jobs
jobs:
  test-unit:
    timeout-minutes: 15
  test-integration:
    timeout-minutes: 30

# 3. Optimize operations
- name: Run tests
  run: npm test -- --maxWorkers=2  # Reduce parallelism
```

### Concurrent Runs Cancelled

**Symptom**: Previous runs get cancelled unexpectedly
```
This run was cancelled, this is expected behavior
```

**This is normal**: Concurrency groups prevent duplicate work
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**To prevent cancellation**:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false  # Don't cancel in-progress runs
```

## Artifact & Cache Issues

### Artifacts Not Uploading

**Symptom**: Artifacts not available after workflow completes
```
No artifacts found
```

**Solutions**:
```bash
# 1. Check if-no-files-found setting
# In workflow: if-no-files-found: warn  # or error

# 2. Verify path exists
# Run: ls -la path/to/artifact

# 3. Check artifact retention
# Default: 90 days
# Can be set: retention-days: 7

# 4. View artifact upload logs
# Look at "Upload artifact" step
```

### Cache Not Working

**Symptom**: Dependencies reinstalled every run
```
Cache size: 0 B
```

**Solutions**:
```bash
# 1. Verify cache key
# package-lock.json must not change

# 2. Check syntax
- uses: actions/setup-node@v4
  with:
    cache: 'npm'  # Correct

# 3. Manually clear cache
# Settings → Actions → General
# "Manage GitHub Actions caches for this repository"

# 4. Create new cache if lock file changed
git commit -am "chore: update dependencies"
```

## Performance Issues

### Slow Workflows

**Symptom**: CI takes > 20 minutes
```
Workflow completed in 25 minutes
```

**Optimization Strategies**:
```yaml
# 1. Enable caching
- uses: actions/setup-node@v4
  with:
    cache: 'npm'

# 2. Run jobs in parallel
jobs:
  lint:
    runs-on: ubuntu-latest
  test:
    runs-on: ubuntu-latest
  build:
    runs-on: ubuntu-latest
  # All run simultaneously

# 3. Reduce test matrix
strategy:
  matrix:
    node-version: [20]  # Test one version on PR

# 4. Skip non-critical jobs
if: github.event_name == 'push'  # Only on push, not PR
```

### Large Artifact Downloads

**Symptom**: Artifact download takes long time
```
Downloaded 2GB artifact
```

**Solutions**:
```yaml
# 1. Reduce retention
retention-days: 7  # Default is 90

# 2. Upload only what's needed
with:
  path: |
    coverage/
    # Don't include node_modules

# 3. Compress before upload
- name: Compress artifacts
  run: tar -czf artifacts.tar.gz coverage/
- uses: actions/upload-artifact@v4
  with:
    path: artifacts.tar.gz
```

## Getting Help

### Debug Information to Collect

When reporting CI issues, include:
1. Workflow name and run number
2. Full error message from logs
3. Steps to reproduce locally
4. Recent commits that might have caused it
5. Any recent configuration changes

### Debug Commands

```bash
# Run workflow syntax check
# Install: npm install -g @actions/runner

# Validate YAML
yamllint .github/workflows/

# Check for common issues
npm run lint
npm run type-check
npm test -- --watch=false

# Test locally with Act (optional)
npm install -g act
act -j lint
```

### Resources

- [CI_CD_SETUP.md](../../CI_CD_SETUP.md) - Comprehensive guide
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Troubleshooting GitHub Actions](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)
- [Common Workflow Issues](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/about-self-hosted-runner-groups)

---

**Last Updated**: 2026-01-14
**Questions?** Contact the development team or file an issue
