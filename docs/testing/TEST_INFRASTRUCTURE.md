# Test Infrastructure Documentation

This document outlines the testing strategy, configuration, and best practices for the VibeCode WebGUI project.

## Overview

The testing infrastructure uses Jest as the primary test runner with additional tooling for different types of tests:

- **Unit Tests**: Jest with jsdom environment
- **Integration Tests**: Jest with API route testing
- **End-to-End Tests**: Playwright for browser automation
- **Security Tests**: Custom security endpoint testing

## Test Configuration

### Jest Configuration

Primary Jest configuration is in `jest.config.mjs`:

```javascript
import createNextJestConfig from 'next/jest.js'

const createJestConfig = createNextJestConfig({ dir: './' })

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/tests/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/extensions/', '<rootDir>/.next/'],
  transformIgnorePatterns: ['node_modules/(?!(ky))/'],
}
```

### Environment Setup

#### Polyfills (`tests/jest.polyfills.js`)

Provides browser API polyfills for Node.js test environment:

- **TextEncoder/TextDecoder**: For encoding operations
- **Headers**: HTTP headers implementation
- **Request/Response**: WHATWG fetch API implementations
- **ReadableStream**: Streaming data support
- **AbortSignal**: For timeout operations

#### Test Setup (`tests/jest.setup.js`)

Global test configuration and utilities:

- **Testing Library**: DOM testing utilities
- **Global Mocks**: Default fetch mock with sensible defaults
- **Secret Redaction**: Automatic redaction of sensitive data in logs
- **Logging**: Structured logging with privacy protection

## Test Categories

### Unit Tests (`tests/unit/`)

Test individual functions and components in isolation.

**Location**: `tests/unit/**/*.test.{ts,tsx}`

**Example**: Password validation testing
```typescript
// tests/unit/auth-password-validation.test.ts
describe('Password Validation', () => {
  it('should validate strong passwords', () => {
    const result = validatePasswordStrength('StrongP@ssw0rd123');
    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests (`tests/integration/`)

Test API routes and component interactions.

**Location**: `tests/integration/**/*.test.{ts,tsx}`

**Example**: API route testing
```typescript
// tests/integration/api/auth-endpoint.test.ts
describe('Auth API', () => {
  beforeEach(async () => {
    const routeModule = await import('@/app/api/auth/route');
    POST = routeModule.POST;
  });
});
```

### API Tests (`tests/api/`)

Security-focused API endpoint testing.

**Location**: `tests/api/**/*.test.ts`

**Example**: CSRF endpoint testing
```typescript
// tests/api/auth-csrf.test.ts
describe('CSRF Token API', () => {
  it('should return a CSRF token', async () => {
    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
  });
});
```

### End-to-End Tests (`tests/e2e/`)

Browser-based testing with Playwright.

**Location**: `tests/e2e/**/*.spec.ts`

**Configuration**: `playwright.config.ts`

## Mocking Strategies

### 1. Module Mocking

Mock external dependencies at the module level:

```typescript
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: '1', email: 'test@example.com' }
  })
}));
```

### 2. Dynamic Imports

Use dynamic imports to ensure mocks are applied:

```typescript
let POST: any;

beforeEach(async () => {
  jest.clearAllMocks();
  const routeModule = await import('@/app/api/route');
  POST = routeModule.POST;
});
```

### 3. Function Mocking

Mock specific functions with custom implementations:

```typescript
jest.mock('@/lib/security/csrf', () => ({
  getCSRFToken: jest.fn().mockImplementation(() => {
    return new Response(JSON.stringify({ 
      csrfToken: 'test-token' 
    }));
  })
}));
```

## Testing Best Practices

### 1. Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

```typescript
it('should validate input correctly', () => {
  // Arrange
  const input = 'test-input';
  
  // Act
  const result = validateInput(input);
  
  // Assert
  expect(result.valid).toBe(true);
});
```

### 2. Mock Cleanup

Always clean up mocks between tests:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### 3. Error Testing

Test both success and failure cases:

```typescript
it('should handle invalid input gracefully', () => {
  expect(() => processInput(null)).toThrow('Invalid input');
});
```

### 4. Async Testing

Properly handle async operations:

```typescript
it('should process async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## Security Testing

### CSRF Protection

Test CSRF token generation and validation:

```typescript
describe('CSRF Protection', () => {
  it('should generate valid CSRF tokens', async () => {
    const response = await GET(mockRequest);
    const data = await response.json();
    
    expect(data.csrfToken).toBeDefined();
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  });
});
```

### Rate Limiting

Test rate limiting functionality:

```typescript
describe('Rate Limiting', () => {
  it('should apply rate limits to sensitive endpoints', () => {
    const { withRateLimit } = require('@/lib/security/rate-limit');
    expect(withRateLimit).toHaveBeenCalled();
  });
});
```

### Password Security

Test password validation and hashing:

```typescript
describe('Password Security', () => {
  it('should enforce strong password requirements', () => {
    const weakPassword = 'weak';
    const result = validatePasswordStrength(weakPassword);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });
});
```

## Common Issues and Solutions

### 1. Module Not Found Errors

**Problem**: Jest can't resolve module paths
**Solution**: Ensure `moduleNameMapping` is configured correctly in `jest.config.mjs`

### 2. Async Timeout Issues

**Problem**: Tests timing out on async operations
**Solution**: Use proper async/await patterns and increase timeout if needed:

```typescript
it('should handle long operations', async () => {
  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

### 3. Mock Not Applied

**Problem**: Mocks not being applied to imports
**Solution**: Use dynamic imports and ensure mocks are defined before imports:

```typescript
// Mock BEFORE import
jest.mock('@/lib/module');

// Then import
const { function } = await import('@/lib/module');
```

### 4. Environment Variables

**Problem**: Tests failing due to missing environment variables
**Solution**: Set test environment variables in `jest.setup.js`:

```typescript
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'test://localhost';
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test Files
```bash
npm test -- tests/unit/specific-test.test.ts
```

## Debugging Tests

### 1. Console Logging

Use console.log for debugging (automatically redacted for sensitive data):

```typescript
console.log('Debug value:', testValue);
```

### 2. Jest Debug Mode

Run tests with Node.js debugging:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 3. Test Isolation

Run tests in isolation to identify issues:

```bash
npm test -- --testNamePattern="specific test name"
```

## Performance Considerations

### 1. Test Parallelization

Jest runs tests in parallel by default. For database tests, use:

```bash
npm test -- --runInBand
```

### 2. Mock Heavy Dependencies

Mock expensive operations like file system access, network calls, and crypto operations:

```typescript
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('mock-hash'),
  compare: jest.fn().mockResolvedValue(true)
}));
```

### 3. Test Data Management

Use factories for test data creation:

```typescript
const createTestUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides
});
```

## Contributing to Tests

### 1. Adding New Tests

1. Choose appropriate test category (unit/integration/api/e2e)
2. Follow naming conventions: `component-name.test.ts`
3. Include both positive and negative test cases
4. Add appropriate mocks for external dependencies
5. Document complex test scenarios

### 2. Updating Existing Tests

1. Maintain backward compatibility where possible
2. Update related documentation
3. Verify all affected test suites still pass
4. Consider impact on CI/CD pipeline

### 3. Test Review Guidelines

- Tests should be readable and self-documenting
- Mock strategies should be consistent across similar tests
- Security-sensitive tests should be thoroughly reviewed
- Performance implications should be considered

## CI/CD Integration

Tests are automatically run in the CI/CD pipeline:

- **Pull Requests**: All tests must pass before merge
- **Main Branch**: Full test suite runs on every commit
- **Releases**: Comprehensive test validation including E2E tests

### Test Coverage Requirements

- **Unit Tests**: > 80% coverage for new code
- **Integration Tests**: All API routes must have tests
- **Security Tests**: All security-related functionality must be tested

This infrastructure ensures reliable, maintainable, and secure code through comprehensive testing strategies.