# CI/CD Testing Guide

Guide for running tests in continuous integration and deployment pipelines.

## Overview

CI/CD testing ensures code quality through automated test execution on every commit, pull request, and deployment. This guide covers configuration, optimization, and best practices for testing in CI environments.

## GitHub Actions Configuration

### Basic Test Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
```

### E2E Test Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
          BASE_URL: http://localhost:3000

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
          retention-days: 30
```

### Multi-Browser E2E Tests

```yaml
name: Cross-Browser Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  e2e-cross-browser:
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run E2E tests on ${{ matrix.browser }}
        run: npx playwright test --project=${{ matrix.browser }}

      - name: Upload ${{ matrix.browser }} results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.browser }}-results
          path: test-results/
```

## Running Tests Locally for CI

### Simulate CI Environment

```bash
# Set CI environment variable
export CI=true

# Run all checks as CI would
npm run lint && \
npm run type-check && \
npm run test:unit -- --coverage && \
npm run test:integration && \
npm run build

# Clean environment variables
unset CI
```

### Pre-commit Checks

```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "Running pre-commit checks..."

# Lint
npm run lint || exit 1

# Type check
npm run type-check || exit 1

# Unit tests (fast)
npm run test:unit || exit 1

echo "Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit
```

## Test Parallelization

### Jest Parallelization

```javascript
// jest.config.mjs
export default {
  // Use all available CPU cores
  maxWorkers: '100%',

  // Or specify number of workers
  // maxWorkers: 4,

  // Run tests in parallel (default)
  testRunner: 'jest-circus/runner',

  // Bail after N failures
  bail: 1,
}
```

### Playwright Parallelization

```typescript
// playwright.config.ts
export default defineConfig({
  // Number of parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Run tests in parallel
  fullyParallel: true,

  // Shard tests across machines
  shard: process.env.CI
    ? { current: 1, total: 4 }
    : undefined,
})
```

### Matrix Strategy for Parallel Jobs

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Run tests (shard ${{ matrix.shard }}/4)
        run: npx playwright test --shard=${{ matrix.shard }}/4
```

## Coverage Reporting

### Generate Coverage Reports

```bash
# Jest coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Coverage for specific files
npm run test -- --coverage --collectCoverageFrom='src/lib/**/*.ts'
```

### Coverage Configuration

```javascript
// jest.config.mjs
export default {
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/lib/auth/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/.next/',
    '/dist/'
  ],

  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx'
  ]
}
```

### Upload to Codecov

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: true
```

## Performance Optimization

### Cache Dependencies

```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Cache Playwright browsers
  uses: actions/cache@v3
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
```

### Skip Unnecessary Tests

```yaml
jobs:
  test:
    steps:
      - name: Check if tests should run
        id: check
        run: |
          if git diff --name-only ${{ github.event.before }} ${{ github.sha }} | grep -qE '\.(ts|tsx|js|jsx)$'; then
            echo "run_tests=true" >> $GITHUB_OUTPUT
          else
            echo "run_tests=false" >> $GITHUB_OUTPUT
          fi

      - name: Run tests
        if: steps.check.outputs.run_tests == 'true'
        run: npm run test
```

### Conditional Test Execution

```yaml
jobs:
  unit-tests:
    if: |
      github.event_name == 'push' ||
      contains(github.event.pull_request.labels.*.name, 'run-tests')
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  e2e-tests:
    if: |
      github.event_name == 'push' && github.ref == 'refs/heads/main' ||
      contains(github.event.pull_request.labels.*.name, 'run-e2e')
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:e2e
```

## Test Result Reporting

### JUnit Reports

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ]
})
```

### Publish Test Results

```yaml
- name: Publish test results
  uses: EnricoMi/publish-unit-test-result-action@v2
  if: always()
  with:
    files: |
      test-results/**/*.xml
      playwright-report/**/*.xml
```

### Comment PR with Results

```yaml
- name: Comment PR with test results
  uses: actions/github-script@v6
  if: always()
  with:
    script: |
      const fs = require('fs');
      const results = JSON.parse(fs.readFileSync('test-results/results.json'));

      const body = `## Test Results
      - **Total Tests**: ${results.stats.tests}
      - **Passed**: ${results.stats.passes}
      - **Failed**: ${results.stats.failures}
      - **Duration**: ${results.stats.duration}ms
      `;

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: body
      });
```

## Environment Variables

### Managing Secrets

```yaml
jobs:
  test:
    steps:
      - name: Run integration tests
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          API_KEY: ${{ secrets.TEST_API_KEY }}
          NODE_ENV: test
        run: npm run test:integration
```

### Environment-Specific Configs

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://user:pass@localhost:5432/test_db
REDIS_URL=redis://localhost:6379/1
API_BASE_URL=http://localhost:3000
```

### Loading Environment Variables

```yaml
- name: Create .env.test
  run: |
    cat > .env.test << EOF
    NODE_ENV=test
    DATABASE_URL=${{ secrets.TEST_DATABASE_URL }}
    API_KEY=${{ secrets.TEST_API_KEY }}
    EOF
```

## Database Testing

### Using Test Containers

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test_db
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        # ... (service config from above)

    steps:
      - name: Run tests with database
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: npm run test:integration
```

## Flaky Test Handling

### Retry Failed Tests

```typescript
// playwright.config.ts
export default defineConfig({
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Timeout for each test
  timeout: 30000,
})
```

```yaml
- name: Run tests with retry
  run: npm run test:e2e
  continue-on-error: true

- name: Retry failed tests
  if: failure()
  run: npm run test:e2e -- --only-failures
```

### Quarantine Flaky Tests

```typescript
// Mark flaky tests
test.skip('flaky test that needs fixing', async ({ page }) => {
  // Test code
})

// Or use conditional skip
test('potentially flaky test', async ({ page }) => {
  test.skip(process.env.CI === 'true', 'Flaky in CI')
  // Test code
})
```

## Monitoring Test Performance

### Track Test Duration

```yaml
- name: Run tests and track duration
  run: |
    START_TIME=$(date +%s)
    npm run test
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo "Test duration: ${DURATION}s"
    echo "test_duration=${DURATION}" >> $GITHUB_OUTPUT
  id: test

- name: Comment with duration
  if: always()
  run: |
    echo "Tests completed in ${{ steps.test.outputs.test_duration }} seconds"
```

### Performance Regression Detection

```yaml
- name: Run performance tests
  run: npm run test:performance

- name: Compare with baseline
  run: |
    node scripts/compare-performance.js \
      --baseline performance-baseline.json \
      --current performance-results.json \
      --threshold 10
```

## Security Testing

### Dependency Auditing

```yaml
- name: Run npm audit
  run: npm audit --audit-level=moderate

- name: Check for vulnerabilities
  run: |
    npm audit --json > audit-results.json
    node scripts/check-audit-results.js
```

### SAST (Static Application Security Testing)

```yaml
- name: Run CodeQL analysis
  uses: github/codeql-action/analyze@v2
  with:
    category: security

- name: Run Snyk security scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

## Best Practices

### Test Isolation

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests  # Run after unit tests pass
    steps:
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests  # Run after integration tests pass
    steps:
      - run: npm run test:e2e
```

### Fail Fast Strategy

```yaml
strategy:
  fail-fast: true  # Stop all jobs if one fails
  matrix:
    node-version: [18.x, 20.x]
```

### Required Checks

```yaml
# Define required status checks in branch protection
# GitHub Settings > Branches > Branch protection rules
# Require status checks to pass before merging:
# - lint
# - type-check
# - test-unit
# - test-integration
```

## Debugging CI Failures

### Enable Debug Logging

```yaml
- name: Run tests with debug output
  run: npm run test -- --verbose
  env:
    DEBUG: '*'
    CI_DEBUG: true
```

### SSH into Runner (for debugging)

```yaml
- name: Setup tmate session
  if: failure()
  uses: mxschmitt/action-tmate@v3
  timeout-minutes: 30
```

### Preserve Artifacts

```yaml
- name: Upload logs on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: debug-logs
    path: |
      logs/
      test-results/
      screenshots/
```

## Example Commands

### Local CI Simulation

```bash
# Full CI check locally
npm run lint && \
npm run type-check && \
npm run test:coverage && \
npm run build

# Run tests as CI would
CI=true npm run test

# Check test coverage thresholds
npm run test:coverage -- --coverageThreshold='{"global":{"lines":80}}'
```

### Pre-deployment Testing

```bash
# Test production build
npm run build
NODE_ENV=production npm start &
SERVER_PID=$!
npm run test:e2e
kill $SERVER_PID
```

## Troubleshooting

### Common CI Issues

**Tests pass locally but fail in CI**
- Check Node.js version compatibility
- Verify environment variables are set
- Review CI-specific configuration
- Check for timing/race conditions

**Tests timeout in CI**
- Increase timeout values
- Check resource constraints
- Review test parallelization settings

**Flaky tests**
- Add explicit waits
- Improve test isolation
- Use Playwright's auto-waiting
- Consider quarantining problematic tests

## Resources

### GitHub Actions

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Marketplace Actions](https://github.com/marketplace?type=actions)

### Test Frameworks

- [Jest CI Configuration](https://jestjs.io/docs/configuration#ci-boolean)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [Codecov Documentation](https://docs.codecov.io/)

## Next Steps

- [Unit Testing Guide](./UNIT_TESTING.md)
- [Integration Testing Guide](./INTEGRATION_TESTING.md)
- [E2E Testing Guide](./E2E_TESTING.md)
- [Test Patterns](./TEST_PATTERNS.md)
