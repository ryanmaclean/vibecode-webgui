# Testing Guide

Comprehensive guide for running, writing, and maintaining tests in the VibeCode WebGUI project.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Test Infrastructure](#test-infrastructure)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Quick Start

### Running All Tests

```bash
# Run all unit tests
npm run test:unit

# Run all integration tests
npm run test:integration

# Run all tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

### Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- --testPathPatterns=authentication

# Run a specific test file
npm test -- tests/unit/auth/password-validation.test.ts

# Run tests with specific name
npm test -- --testNamePattern="should validate password"
```

### Quick Test Before Commit

```bash
# Run fast unit tests only
npm run quick-test
```

## Test Types

We use a multi-layered testing strategy:

### 1. Unit Tests (`tests/unit/`)

**Purpose:** Test individual functions, components, and utilities in isolation.

**Characteristics:**
- Fast execution (< 5 seconds for entire suite)
- No external dependencies (mocked)
- High isolation
- High coverage

**When to use:**
- Testing pure functions
- Testing React components in isolation
- Testing utility functions
- Testing business logic

**Example:**
```typescript
// tests/unit/auth/password-validation.test.ts
import { validatePassword } from '@/lib/auth/password';

describe('validatePassword', () => {
  it('should accept valid passwords', () => {
    expect(validatePassword('SecureP@ss123')).toBe(true);
  });

  it('should reject short passwords', () => {
    expect(validatePassword('short')).toBe(false);
  });
});
```

### 2. Integration Tests (`tests/integration/`)

**Purpose:** Test interactions between multiple components or services.

**Characteristics:**
- Moderate execution speed
- May use real services (with test data)
- Tests data flows between components
- May require setup/teardown

**When to use:**
- Testing API routes
- Testing database operations
- Testing service interactions
- Testing authentication flows

**Example:**
```typescript
// tests/integration/api/auth.test.ts
import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  it('should return JWT token for valid credentials', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'ValidPassword123',
        }),
      })
    );

    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(response.status).toBe(200);
  });
});
```

### 3. End-to-End Tests (`tests/e2e/`)

**Purpose:** Test complete user workflows in a real browser.

**Characteristics:**
- Slow execution (minutes)
- Tests real user interactions
- Uses Playwright
- Tests entire application stack

**When to use:**
- Testing critical user journeys
- Testing cross-browser compatibility
- Testing accessibility (WCAG compliance)
- Testing visual regressions

**Example:**
```typescript
// tests/e2e/auth/login-flow.test.ts
import { test, expect } from '@playwright/test';

test('user can log in successfully', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'ValidPassword123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

### 4. Specialized Tests

#### Performance Tests (`tests/performance/`)
```bash
npm run test:performance
```

#### Security Tests (`tests/security/`)
```bash
npm run test:security
```

#### Accessibility Tests (`tests/e2e/accessibility.test.ts`)
```bash
npm run test:e2e -- accessibility
```

#### Kubernetes Tests (`tests/k8s/`)
```bash
npm run test:k8s
```

## Running Tests

### Development Workflow

```bash
# Start with watch mode during development
npm run test:watch

# Run specific test file you're working on
npm test -- path/to/your.test.ts

# Run tests with coverage to see what you're missing
npm run test:coverage
```

### Pre-Commit Testing

```bash
# Run fast tests before committing
npm run test:pre-commit

# Or use the pre-commit hook (automatic)
git commit -m "Your message"  # Runs tests automatically
```

### Full Test Suite

```bash
# Run all tests (unit + integration)
npm test

# Run with coverage report
npm run test:coverage

# Generate HTML coverage report
npm run test:coverage && open coverage/lcov-report/index.html
```

### Infrastructure-Specific Tests

#### Skip Docker Tests (if Docker not available)
```bash
SKIP_DOCKER_TESTS=1 npm test
```

#### Skip Kubernetes Tests (if kubectl not available)
```bash
SKIP_K8S_TESTS=1 npm test
```

#### Skip All Infrastructure Tests
```bash
SKIP_DOCKER_TESTS=1 SKIP_K8S_TESTS=1 npm run test:unit
```

### CI/CD Testing

Tests run automatically in GitHub Actions on:
- Pull requests to `main` or `develop`
- Pushes to `main`, `develop`, or `release/*` branches

## Test Infrastructure

### Test Configuration

- **Jest Config:** `config/jest/jest.config.js`
- **Jest Setup:** `tests/jest.setup.js`
- **Jest Polyfills:** `tests/jest.polyfills.js`
- **Global Setup:** `tests/jest.globalSetup.js`
- **Playwright Config:** `playwright.config.ts`

### Environment Detection

The test suite automatically detects available infrastructure:

```javascript
// tests/jest.globalSetup.js
// Automatically sets SKIP_DOCKER_TESTS if Docker is unavailable
// Automatically sets SKIP_K8S_TESTS if kubectl is unavailable
```

### Test Utilities

Located in `tests/utils/`:
- `test-helpers.ts` - Common test utilities
- `mock-factory.ts` - Mock data generators
- `setup-tests.ts` - Test setup helpers

### Mocks

Global mocks in `__mocks__/`:
- `lucide-react.js` - UI icon mocks
- `cssModule.js` - CSS module mocks
- `fileMock.js` - Static file mocks

## Writing Tests

### Test Structure (AAA Pattern)

Always follow the Arrange-Act-Assert pattern:

```typescript
describe('Feature', () => {
  it('should do something', () => {
    // Arrange: Set up test data and conditions
    const input = { value: 'test' };
    const expected = 'TEST';

    // Act: Execute the code being tested
    const result = myFunction(input);

    // Assert: Verify the results
    expect(result).toBe(expected);
  });
});
```

### Component Testing

Use React Testing Library for component tests:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
  it('should submit form with valid data', async () => {
    // Arrange
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    // Act
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'ValidPassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'ValidPassword123',
    });
  });
});
```

### API Route Testing

Test Next.js API routes with proper request/response mocking:

```typescript
import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  it('should validate request body', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
```

### Async Testing

Handle promises and async code properly:

```typescript
// Using async/await
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// Using .resolves matcher
it('should fetch data', () => {
  return expect(fetchData()).resolves.toBeDefined();
});

// Using done callback (legacy)
it('should fetch data', (done) => {
  fetchData().then((data) => {
    expect(data).toBeDefined();
    done();
  });
});
```

### Mocking

#### Mock Functions
```typescript
const mockFn = jest.fn();
mockFn.mockReturnValue('test');
mockFn.mockResolvedValue({ data: 'test' });

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
```

#### Mock Modules
```typescript
jest.mock('@/lib/database', () => ({
  query: jest.fn().mockResolvedValue([]),
}));
```

#### Mock Environment Variables
```typescript
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, API_KEY: 'test-key' };
});

afterEach(() => {
  process.env = originalEnv;
});
```

## Test Utilities

### Custom Matchers

```typescript
// Available matchers
expect(value).toBeDefined();
expect(value).toBeNull();
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(number).toBeGreaterThan(3);
expect(string).toMatch(/pattern/);
expect(array).toContain(item);
expect(object).toHaveProperty('key');
```

### Testing Library Queries

```typescript
import { screen } from '@testing-library/react';

// Recommended queries (in order of preference)
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email/i);
screen.getByPlaceholderText(/enter email/i);
screen.getByText(/welcome/i);
screen.getByDisplayValue('test@example.com');
screen.getByAltText('logo');
screen.getByTitle('close');
screen.getByTestId('custom-element');
```

### Setup and Teardown

```typescript
describe('Feature', () => {
  beforeAll(() => {
    // Runs once before all tests in this block
  });

  beforeEach(() => {
    // Runs before each test in this block
  });

  afterEach(() => {
    // Runs after each test in this block
  });

  afterAll(() => {
    // Runs once after all tests in this block
  });
});
```

## Common Patterns

### Test Data Factories

Create reusable test data:

```typescript
// tests/utils/factories.ts
export const createUser = (overrides = {}) => ({
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

// Usage in tests
const user = createUser({ email: 'custom@example.com' });
```

### Test Fixtures

Store complex test data in fixtures:

```typescript
// tests/fixtures/users.json
{
  "validUser": {
    "email": "valid@example.com",
    "password": "ValidPassword123"
  }
}

// Usage
import users from '@/tests/fixtures/users.json';
```

### Skipping Tests

```typescript
// Skip a single test
it.skip('should do something', () => {
  // This test will be skipped
});

// Skip a test suite
describe.skip('Feature', () => {
  // All tests in this suite will be skipped
});

// Run only specific tests (useful during development)
it.only('should do something', () => {
  // Only this test will run
});
```

### Conditional Tests

```typescript
// Skip tests based on environment
const runInCI = process.env.CI === 'true';

(runInCI ? it : it.skip)('should run in CI only', () => {
  // Test code
});
```

## Troubleshooting

### Common Issues

#### 1. Module Resolution Errors

**Error:** `Cannot find module '@/lib/...'`

**Solution:**
```bash
# Ensure Jest config is being used
npm test -- --showConfig | grep moduleNameMapper

# If missing, check package.json test script
# Should be: "test": "jest --config=config/jest/jest.config.js"
```

#### 2. Fetch/Network Errors

**Error:** `TypeError: fetch is not a function`

**Solution:**
Already configured in `tests/jest.setup.js`. If still seeing errors:
```typescript
// Add to your test file
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
  })
);
```

#### 3. Docker/Infrastructure Errors

**Error:** `Cannot connect to Docker daemon`

**Solution:**
```bash
# Skip Docker tests
SKIP_DOCKER_TESTS=1 npm test

# Or start Docker
colima start  # macOS with Colima
# or
docker-machine start  # Docker Machine
```

#### 4. Timeout Errors

**Error:** `Timeout - Async callback was not invoked within the 5000 ms timeout`

**Solution:**
```typescript
// Increase timeout for specific test
it('should handle slow operation', async () => {
  // Test code
}, 30000); // 30 second timeout

// Or in jest.config.js
testTimeout: 30000
```

#### 5. Memory Issues

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm test

# Or run tests with fewer workers
npm test -- --maxWorkers=2
```

### Debugging Tests

#### Debug in VS Code

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

#### Debug with Chrome DevTools

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
# Then open chrome://inspect in Chrome
```

#### Verbose Output

```bash
# Show all console.log statements
npm test -- --verbose

# Show test execution details
npm test -- --verbose --no-coverage
```

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Pull requests to `main` or `develop`
- Pushes to `main`, `develop`, or `release/*` branches

**Matrix Strategy:**
- Tests run on Node.js 18, 20, and 22
- Coverage only collected on Node.js 22

**Test Jobs:**
1. **Lint & Type Check** - ESLint, TypeScript, Prettier
2. **Unit Tests** - Fast unit tests with coverage
3. **Integration Tests** - API and service tests
4. **Security** - npm audit and Snyk scanning
5. **Build** - Next.js production build

### Coverage Reports

Coverage is uploaded to Codecov automatically. View at:
```
https://codecov.io/gh/ryanmaclean/vibecode-webgui
```

### Running Tests Locally Like CI

```bash
# Simulate CI environment
CI=true SKIP_DOCKER_TESTS=1 SKIP_K8S_TESTS=1 npm run test:coverage

# Run specific CI job
npm run lint
npm run type-check
npm run test:unit
npm run build
```

## Best Practices

### Do's

1. Write tests before fixing bugs (TDD)
2. Keep tests simple and focused
3. Use descriptive test names (should statements)
4. Follow AAA pattern (Arrange-Act-Assert)
5. Mock external dependencies
6. Test edge cases and errors
7. Keep tests independent
8. Use factories for test data
9. Clean up after tests (teardown)
10. Run tests before committing

### Don'ts

1. Don't test implementation details
2. Don't test third-party libraries
3. Don't use production data
4. Don't over-mock (mock only what's necessary)
5. Don't skip flaky tests (fix them)
6. Don't write huge test files
7. Don't commit commented-out tests
8. Don't rely on test execution order
9. Don't use random data (use fixed seeds)
10. Don't ignore coverage drops

## Test Coverage

### Current Coverage Targets

- **Branches:** 60%
- **Functions:** 65%
- **Lines:** 65%
- **Statements:** 65%

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# View text summary
npm run test:coverage | grep "Coverage"
```

### High-Priority Coverage Areas

These areas require 90%+ coverage:
- Authentication and authorization
- Payment processing
- Data validation
- Security functions
- Core business logic

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

### Internal Docs
- [Test Guidelines for Contributors](./TEST_GUIDELINES.md)
- [Test Summary](./TEST_SUMMARY.md)
- [Contributing Guide](./CONTRIBUTING.md)

### Support
- Review existing tests for examples
- Check [Troubleshooting](#troubleshooting) section
- Open an issue for help

---

**Last Updated:** 2025-11-05
**Maintained by:** Agent 16 - CI/CD and Documentation Specialist
