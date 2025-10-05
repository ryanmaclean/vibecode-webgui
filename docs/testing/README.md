# Testing Documentation

Comprehensive testing guide for the VibeCode WebGUI project.

## Overview

This project uses a multi-layered testing strategy combining unit tests, integration tests, and end-to-end (E2E) tests to ensure code quality, reliability, and maintainability.

### Testing Stack

- **Unit Tests**: Jest with @testing-library/react
- **Integration Tests**: Jest with mocked services
- **E2E Tests**: Playwright for browser automation
- **Accessibility Tests**: axe-core via @axe-core/playwright
- **Coverage**: Jest coverage reporting

## Quick Start

### Running Tests Locally

```bash
# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests (requires dev server)
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Running Specific Test Suites

```bash
# Authentication tests
npm run test:unit -- auth

# Monitoring tests
npm run test:monitoring

# Accessibility tests
npm run test:e2e -- accessibility

# Security tests
npm run test:security
```

## Testing Strategy

### Test Pyramid

```
                  /\
                 /  \
                / E2E \        <- Few, slow, high-level
               /--------\
              /          \
             / Integration \   <- Moderate, medium speed
            /--------------\
           /                \
          /    Unit Tests     \  <- Many, fast, focused
         /--------------------\
```

### When to Use Each Test Type

| Test Type | Use For | Characteristics |
|-----------|---------|-----------------|
| **Unit** | Individual functions, components, utilities | Fast, isolated, focused |
| **Integration** | API routes, service interactions, data flows | Medium speed, some mocking |
| **E2E** | User journeys, critical workflows, UI validation | Slow, real browser, no mocking |

## Test Organization

```
tests/
├── unit/                      # Unit tests
│   ├── auth/                  # Authentication utilities
│   ├── ai/                    # AI service tests
│   ├── app/                   # Application logic
│   └── ...
├── integration/               # Integration tests
│   ├── api/                   # API endpoint tests
│   ├── monitoring/            # Monitoring integration
│   └── ...
├── e2e/                       # End-to-end tests
│   ├── auth/                  # Authentication flows
│   ├── accessibility.test.ts  # WCAG compliance
│   └── ...
├── mocks/                     # Shared mock data
├── fixtures/                  # Test fixtures
└── utils/                     # Test utilities
```

## Coverage Requirements

### Minimum Coverage Targets

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### High-Priority Areas (90%+ coverage required)

- Authentication and authorization logic
- Payment processing
- Data validation and sanitization
- Security-critical functions
- Core business logic

### Acceptable Lower Coverage

- UI components without business logic
- Configuration files
- Type definitions
- Third-party integrations (mocked)

## Test Configuration Files

- `jest.config.mjs` - Jest configuration
- `playwright.config.ts` - Playwright E2E configuration
- `tests/jest.setup.js` - Jest global setup
- `tests/jest.polyfills.js` - Browser API polyfills

## Detailed Guides

### Core Testing Topics

1. [Unit Testing Guide](./UNIT_TESTING.md)
   - Writing Jest tests
   - Component testing with React Testing Library
   - Mocking dependencies
   - Testing utilities and helpers

2. [Integration Testing Guide](./INTEGRATION_TESTING.md)
   - API route testing
   - Service integration tests
   - Database interactions
   - External service mocking

3. [E2E Testing Guide](./E2E_TESTING.md)
   - Playwright setup and configuration
   - Writing browser tests
   - Page object patterns
   - Visual regression testing

4. [Test Patterns and Best Practices](./TEST_PATTERNS.md)
   - AAA pattern (Arrange-Act-Assert)
   - Common anti-patterns to avoid
   - Mocking strategies
   - Test fixtures and factories
   - Debugging tests

5. [CI/CD Testing](./CI_TESTING.md)
   - Running tests in GitHub Actions
   - Test parallelization
   - Coverage reporting
   - Performance testing

## Common Commands Reference

```bash
# Development workflow
npm run test:watch                    # Watch mode for active development
npm run test:unit -- --coverage      # Unit tests with coverage
npm run test:e2e:headed              # E2E tests with visible browser

# Specific test categories
npm run test:monitoring              # All monitoring tests
npm run test:security                # Security tests
npm run test:k8s                     # Kubernetes integration tests

# Production testing
npm run test:production:smoke        # Quick smoke tests on production
npm run test:production:all          # Full production test suite

# Performance testing
npm run test:performance             # Performance benchmarks
npm run test:ab-compare              # A/B comparison tests
```

## Debugging Tests

### Jest Tests

```bash
# Run specific test file
npm run test -- path/to/test.test.ts

# Run tests matching pattern
npm run test -- --testNamePattern="should validate password"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Tests

```bash
# Run with headed browser
npm run test:e2e:headed

# Debug specific test
npx playwright test --debug auth-flow.test.ts

# Show test report
npx playwright show-report
```

## Best Practices Summary

### Do's

- Write tests before fixing bugs (TDD approach)
- Keep tests simple and focused
- Use descriptive test names
- Follow AAA pattern (Arrange-Act-Assert)
- Mock external dependencies
- Test edge cases and error conditions
- Maintain test independence

### Don'ts

- Don't test implementation details
- Avoid testing third-party code
- Don't use production data in tests
- Avoid excessive mocking
- Don't skip flaky tests - fix them
- Avoid large, monolithic test files
- Don't commit commented-out tests

## Resources

### Internal Documentation

- [TESTING_STRATEGY.md](../TESTING_STRATEGY.md) - Overall testing strategy
- [TEST_COVERAGE_AUDIT.md](../TEST_COVERAGE_AUDIT.md) - Coverage audit results
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development workflow

### External Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

## Getting Help

### Common Issues

1. **Tests failing in CI but passing locally**
   - Check environment variables
   - Verify Node.js version compatibility
   - Review CI-specific configuration

2. **Flaky E2E tests**
   - Add explicit waits
   - Use Playwright's auto-waiting features
   - Check for race conditions

3. **Low coverage warnings**
   - Identify uncovered lines with `npm run test:coverage`
   - Add tests for critical paths first
   - Consider if the code needs refactoring

### Support

- Review existing test files for examples
- Check the troubleshooting sections in specific guides
- Consult [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- Reach out to the development team

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure tests pass locally
3. Verify coverage meets requirements
4. Run linting: `npm run lint`
5. Run type checking: `npm run type-check`
6. Update documentation if needed

## Next Steps

Choose a topic to dive deeper:

- [Unit Testing Guide](./UNIT_TESTING.md) - Start here for component and function testing
- [Integration Testing Guide](./INTEGRATION_TESTING.md) - API and service testing
- [E2E Testing Guide](./E2E_TESTING.md) - Browser automation and user flows
- [Test Patterns](./TEST_PATTERNS.md) - Best practices and common patterns
- [CI Testing](./CI_TESTING.md) - Automated testing in CI/CD pipelines
