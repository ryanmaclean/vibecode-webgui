# VibeCode Testing Strategy

This document outlines the testing strategy for the VibeCode WebGUI project, detailing the different types of tests, their purpose, and how they fit into the development workflow.

## Table of Contents

1. [Testing Approach](#testing-approach)
2. [Types of Tests](#types-of-tests)
3. [Accessibility Testing](#accessibility-testing)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Security Testing](#security-testing)
8. [Testing in CI/CD](#testing-in-cicd)
9. [Best Practices](#best-practices)

## Testing Approach

VibeCode follows a comprehensive testing approach that combines several testing methodologies to ensure high-quality, maintainable code. Our testing pyramid consists of:

- **Unit tests**: Fast, focused tests for individual functions and components
- **Integration tests**: Testing interactions between modules and services
- **End-to-End tests**: Testing complete user flows and journeys
- **Accessibility tests**: Ensuring the application is accessible to all users
- **Security tests**: Validating security controls, configurations, and detecting vulnerabilities

Each type of test serves a specific purpose in our quality assurance process, and together they provide confidence in the reliability and correctness of our application.

## Types of Tests

### Unit Tests

Unit tests focus on testing individual functions, components, or classes in isolation. They are designed to be fast, reliable, and to provide immediate feedback during development.

- **Location**: `tests/unit/` and within `__tests__` folders adjacent to the implementation
- **Technology**: Jest, React Testing Library
- **Run Command**: `npm run test:unit`

Example unit test:

```typescript
import { sum } from '../math-utils';

describe('sum function', () => {
  it('should add two numbers correctly', () => {
    expect(sum(1, 2)).toBe(3);
  });
});
```

### Integration Tests

Integration tests verify that different parts of the application work correctly together. These tests focus on the interactions between different modules, services, or components.

- **Location**: `tests/integration/`
- **Technology**: Jest, Supertest
- **Run Command**: `npm run test:integration`

Example integration test:

```typescript
import { MongoDBChatService } from '../../src/lib/services/chat-mongodb';
import { createMockDatabase } from '../utils/mock-db';

describe('MongoDBChatService', () => {
  let service: MongoDBChatService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    service = new MongoDBChatService(mockDb);
  });

  it('should create a new chat session', async () => {
    const result = await service.createSession('user123');
    expect(result.userId).toBe('user123');
  });
});
```

### End-to-End Tests

End-to-End (E2E) tests simulate real user behavior and test the application as a whole, from the UI to the database.

- **Location**: `tests/e2e/`
- **Technology**: Playwright
- **Run Command**: `npm run test:e2e`

Example E2E test:

```typescript
import { test, expect } from '@playwright/test';

test('user can log in and access dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', 'user@example.com');
  await page.fill('[data-testid="password-input"]', 'password');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
});
```

## Accessibility Testing

Accessibility testing is a critical part of our testing strategy, ensuring that our application is usable by people with disabilities.

### Automated Accessibility Tests

We use automated tools to catch common accessibility issues:

- **axe-core**: Integrated with our testing framework to check for accessibility violations
- **jest-axe**: Used in unit and integration tests to verify component accessibility
- **@axe-core/playwright**: Used in E2E tests to verify page-level accessibility

Location: `tests/accessibility/`

#### Example accessibility test:

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Button from '../components/Button';

expect.extend(toHaveNoViolations);

describe('Button component', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Manual Accessibility Testing

In addition to automated tests, we conduct periodic manual accessibility reviews using:

- Keyboard navigation
- Screen readers (e.g., NVDA, VoiceOver)
- High contrast mode
- Various zoom levels

### Accessibility Audit Workflow

1. Run automated tests as part of the CI/CD pipeline
2. Conduct periodic manual reviews
3. Address issues in order of severity
4. Document patterns and solutions in the accessibility guide

## Testing in CI/CD

Our CI/CD pipeline includes automated testing to ensure code quality before deployment:

1. **Linting and Type Checking**: Run ESLint and TypeScript type checking
2. **Unit and Integration Tests**: Run all unit and integration tests
3. **Accessibility Tests**: Run automated accessibility tests
4. **End-to-End Tests**: Run critical E2E tests
5. **Performance Tests**: Run performance tests for critical paths

Test are configured in our GitHub Actions workflows in `.github/workflows/`.

## Best Practices

### Writing Tests

- **Test Isolation**: Each test should be independent and not rely on the state from other tests
- **Arrange-Act-Assert**: Structure tests with clear setup, action, and assertion phases
- **Meaningful Assertions**: Test for behavior, not implementation details
- **Test Coverage**: Aim for high test coverage, especially for critical paths
- **Maintainability**: Keep tests simple and focused on a single behavior
- **Mock External Dependencies**: Use mocks for external services and APIs

### Mocking

For effective testing, we use mocking to isolate the code being tested:

- **Jest Mock Functions**: For simple function mocking
- **MSW (Mock Service Worker)**: For mocking API requests
- **Mock Implementations**: For complex dependencies

Example mocking:

```typescript
// Mock a module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Mock a function
const mockFunction = jest.fn().mockReturnValue('mocked value');

// Mock a fetch request with MSW
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/data', (req, res, ctx) => {
    return res(ctx.json({ data: 'mocked data' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Test Documentation

- Include comments explaining complex test scenarios
- Use descriptive test and describe blocks to document behavior
- Keep test documentation up-to-date when implementation changes

## Security Testing

Security is a critical aspect of VibeCode's quality assurance process. Our security testing framework includes multiple layers of validation:

### Infrastructure Security Tests

**Location**: `tests/tofu/test_security_validation.py`

Validates cloud infrastructure security configurations:
- AWS security (IAM, encryption, security groups, VPC)
- GCP security (service accounts, disk encryption, networking)
- Hardcoded secret detection in Terraform files
- Network security validation
- IAM least privilege principles
- Logging and monitoring configuration

**Run Command**:
```bash
python3 tests/tofu/test_security_validation.py
```

### Application Security Tests

**Location**: `tests/unit/security-input-validator.test.ts`

Validates application-level security controls:
- Input validation and sanitization
- SQL injection prevention
- XSS attack prevention
- Path traversal blocking
- File upload security
- Prompt sanitization for AI queries

**Run Command**:
```bash
npm test -- security-input-validator
```

### Security Monitoring Tests

**Location**: `tests/security/monitoring-security.test.ts`

Validates security event logging and monitoring:
- Security event logging
- Alert configuration
- Audit trail completeness
- Security metrics collection

### Secret Scanning

Automated secret detection runs in multiple layers:

1. **Pre-commit Hooks**: TruffleHog prevents commits with secrets
2. **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/secret-scanning.yml`)
3. **Manual Scripts**: `scripts/security-test.sh`, `scripts/security-audit.sh`

**Patterns Detected**:
- OpenAI/OpenRouter keys (sk-*)
- Anthropic keys (sk-ant-*)
- GitHub tokens (ghp_*, gho_*, etc.)
- AWS access keys (AKIA*)
- Datadog API keys
- Google OAuth tokens (ya29.*)

### Dependency Security

**Vulnerability Scanning**:
```bash
npm audit
```

**Fix Vulnerabilities**:
```bash
npm audit fix
```

### Security Testing Best Practices

1. **Run Security Tests Regularly**:
   - Daily: `npm audit` and quick security checks
   - Weekly: Full security audit with `./scripts/security-audit.sh`
   - Monthly: Comprehensive security assessment

2. **Never Commit Secrets**:
   - Use environment variables
   - Enable pre-commit hooks
   - Review changes before committing

3. **Validate All Input**:
   - Test with malicious input patterns
   - Verify size limits
   - Check sanitization logic

4. **Test Security Controls**:
   - Authentication flows
   - Authorization checks
   - Rate limiting
   - Session management

5. **Monitor Security Metrics**:
   - Track vulnerability count
   - Monitor secret exposure
   - Measure test coverage
   - Review incident response times

For detailed security testing information, see:
- **[Security Testing Guide](./SECURITY_TESTING.md)** - Comprehensive security testing documentation
- **[Security Checkout](./SECURITY_CHECKOUT.md)** - Daily security achievements and status
- **[Security Policy](./SECURITY.md)** - Security policy and vulnerability reporting

## Conclusion

This testing strategy is designed to ensure the quality, reliability, accessibility, and security of the VibeCode WebGUI application. By following these guidelines, we can maintain a high standard of code quality and user experience.