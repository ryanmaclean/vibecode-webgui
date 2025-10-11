# Test Coverage Guide

## Overview

This guide explains how to view, interpret, and improve test coverage for the VibeCode WebGUI project.

## Current Coverage Baseline

As of 2025-10-01, the project has the following test coverage:

| Metric | Coverage | Threshold |
|--------|----------|-----------|
| **Statements** | 58.89% | 55% |
| **Branches** | 38.06% | 35% |
| **Functions** | 62.17% | 60% |
| **Lines** | 59.68% | 55% |

### Critical Module Thresholds

Higher coverage requirements are enforced for security-critical modules:

- **Auth modules** (`src/lib/auth/**/*.ts`): 85% coverage across all metrics
- **Security modules** (`src/lib/security/**/*.ts`): 90% statements/functions, 80% branches

## Running Coverage Reports

### Generate Coverage Reports

```bash
# Run unit tests with coverage
npm run test:unit -- --coverage

# Run all tests with coverage
npm run test:coverage

# Run specific test suite with coverage
npm run test:unit -- --coverage --testPathPattern="auth"
```

### View HTML Coverage Report

1. Generate coverage by running tests with `--coverage` flag
2. Open the HTML report in your browser:

```bash
# macOS
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html

# Windows
start coverage/lcov-report/index.html
```

3. Navigate through the interactive report to see:
   - Overall coverage summary
   - File-by-file breakdown
   - Line-by-line coverage visualization
   - Uncovered code paths highlighted in red

### Coverage Report Types

The project generates multiple coverage report formats:

- **HTML** (`coverage/lcov-report/`): Interactive browser-based report
- **LCOV** (`coverage/lcov.info`): Standard format for CI/CD tools
- **JSON Summary** (`coverage/coverage-summary.json`): Machine-readable summary
- **Clover** (`coverage/clover.xml`): XML format for some CI tools
- **Text**: Console output after test run

## Understanding Coverage Metrics

### Statement Coverage
Percentage of executable statements that have been executed during tests.

**Example:**
```typescript
function greet(name: string) {
  const greeting = `Hello, ${name}!`  // Covered
  console.log(greeting)                // Covered
  return greeting                      // Covered
}
// Statement coverage: 100% (3/3)
```

### Branch Coverage
Percentage of conditional branches (if/else, switch, ternary) that have been tested.

**Example:**
```typescript
function isValid(value: number) {
  if (value > 0) {      // Branch 1: tested
    return true
  } else {              // Branch 2: NOT tested
    return false
  }
}
// Branch coverage: 50% (1/2)
```

### Function Coverage
Percentage of declared functions that have been called during tests.

**Example:**
```typescript
function add(a: number, b: number) {    // Called in tests
  return a + b
}

function subtract(a: number, b: number) { // NOT called in tests
  return a - b
}
// Function coverage: 50% (1/2)
```

### Line Coverage
Percentage of executable lines that have been executed during tests.

## Coverage Thresholds

Coverage thresholds are enforced in `jest.config.mjs`. Tests will fail if coverage drops below:

### Global Thresholds
- Statements: 55%
- Branches: 35%
- Functions: 60%
- Lines: 55%

### Module-Specific Thresholds
- Auth modules: 85% across all metrics
- Security modules: 90% statements/functions, 80% branches

## Improving Coverage

### Identify Low Coverage Areas

1. Run coverage report:
   ```bash
   npm run test:unit -- --coverage
   ```

2. Check console output for files below threshold

3. Open HTML report to identify specific uncovered lines:
   ```bash
   open coverage/lcov-report/index.html
   ```

### Priority Coverage Areas

Focus on improving coverage for:

1. **Critical Business Logic** (authentication, authorization, data validation)
2. **Low Coverage Files** (currently below global thresholds)
3. **High Risk Areas** (error handling, edge cases, boundary conditions)

### Coverage Anti-Patterns to Avoid

**Don't:**
- Write tests solely to increase coverage percentage
- Test trivial code (getters, setters, simple utilities)
- Ignore quality for coverage metrics
- Test implementation details instead of behavior

**Do:**
- Write meaningful tests that validate behavior
- Focus on critical paths and edge cases
- Test error conditions and failure scenarios
- Use coverage as a guide, not a goal

## CI/CD Integration

### Current Integration

Coverage reports are generated during test runs but not yet enforced in CI/CD.

### Recommended CI/CD Configuration

1. **Generate coverage on every PR**
   ```yaml
   - name: Run tests with coverage
     run: npm run test:coverage
   ```

2. **Upload coverage to reporting service**
   - Codecov
   - Coveralls
   - SonarQube

3. **Enforce threshold checks**
   ```yaml
   - name: Check coverage thresholds
     run: npm run test:coverage -- --ci
   ```

4. **Fail PR if coverage decreases**
   - Configure coverage diff checks
   - Require approval for coverage decreases

### Coverage Reporting Tools

Recommended integrations:

- **Codecov**: Automated coverage tracking with PR comments
- **Coveralls**: Simple coverage tracking and badges
- **SonarQube**: Comprehensive code quality including coverage

## Best Practices

### Test Organization

- Place unit tests in `tests/unit/`
- Place integration tests in `tests/integration/`
- Place E2E tests in `tests/e2e/`
- Mirror source structure in test directories

### Writing Testable Code

1. **Keep functions small and focused**
2. **Avoid deep nesting** (max 3 levels)
3. **Extract complex conditions** to named functions
4. **Use dependency injection** for easier mocking
5. **Separate business logic** from framework code

### Coverage Goals

**Short Term** (Next 3 months):
- Increase global coverage to 65%
- Increase branch coverage to 45%
- Add tests for all auth/security modules

**Medium Term** (6 months):
- Reach 75% global coverage
- Reach 60% branch coverage
- Add integration tests for critical workflows

**Long Term** (1 year):
- Maintain 80%+ global coverage
- Maintain 70%+ branch coverage
- Comprehensive E2E test suite

## Troubleshooting

### Coverage Not Generated

1. Ensure Jest is configured correctly in `jest.config.mjs`
2. Check that `coverage/` directory has write permissions
3. Verify `--coverage` flag is passed to Jest

### Coverage Reports Empty

1. Check `collectCoverageFrom` patterns in Jest config
2. Verify test files are being executed
3. Check `coveragePathIgnorePatterns` isn't excluding too much

### Thresholds Failing

1. Review specific files below threshold in HTML report
2. Add tests for uncovered code paths
3. Consider adjusting thresholds if unrealistic for codebase

## Resources

- [Jest Coverage Documentation](https://jestjs.io/docs/configuration#collectcoverage-boolean)
- [Istanbul Coverage Reports](https://istanbul.js.org/)
- [Testing Best Practices](https://testingjavascript.com/)

## Questions?

For questions about test coverage:
- Review existing tests in `tests/` directory
- Check CI/CD workflows in `.github/workflows/`
- Open an issue with label `testing` or `quality`
