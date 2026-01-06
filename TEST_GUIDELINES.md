# Test Guidelines for Contributors

Guidelines for writing and maintaining tests in the VibeCode WebGUI project.

## Table of Contents

- [Test Requirements for PRs](#test-requirements-for-prs)
- [When to Write Tests](#when-to-write-tests)
- [Writing Good Tests](#writing-good-tests)
- [Test Types](#test-types)
- [Test Naming Conventions](#test-naming-conventions)
- [Mock Usage Guidelines](#mock-usage-guidelines)
- [Skipping Infrastructure Tests](#skipping-infrastructure-tests)
- [Code Review Checklist](#code-review-checklist)

## Test Requirements for PRs

All pull requests must include tests. Here's what's required:

### New Features

**Required:**
- Unit tests for new functions/utilities
- Integration tests for new API routes
- Component tests for new UI components
- Documentation updates

**Recommended:**
- E2E tests for critical user flows
- Performance tests if applicable
- Accessibility tests for UI changes

### Bug Fixes

**Required:**
- Test that reproduces the bug
- Test that verifies the fix
- Update existing tests if behavior changed

**Recommended:**
- Add tests for related edge cases
- Update documentation if needed

### Refactoring

**Required:**
- Existing tests must still pass
- Coverage should not decrease
- Update tests if interfaces changed

**Recommended:**
- Add tests for previously untested code
- Improve test quality if applicable

## When to Write Tests

### Always Write Tests For

1. **New Functions/Utilities**
   ```typescript
   // src/lib/utils/format-date.ts
   export function formatDate(date: Date): string {
     return date.toISOString().split('T')[0];
   }

   // tests/unit/utils/format-date.test.ts
   import { formatDate } from '@/lib/utils/format-date';

   describe('formatDate', () => {
     it('should format date as YYYY-MM-DD', () => {
       const date = new Date('2025-11-05T12:00:00Z');
       expect(formatDate(date)).toBe('2025-11-05');
     });
   });
   ```

2. **New API Routes**
   ```typescript
   // tests/integration/api/users.test.ts
   import { GET } from '@/app/api/users/route';

   describe('GET /api/users', () => {
     it('should return list of users', async () => {
       const response = await GET(new Request('http://localhost/api/users'));
       const data = await response.json();

       expect(response.status).toBe(200);
       expect(Array.isArray(data.users)).toBe(true);
     });
   });
   ```

3. **New React Components**
   ```typescript
   // tests/unit/components/Button.test.tsx
   import { render, screen, fireEvent } from '@testing-library/react';
   import { Button } from '@/components/ui/Button';

   describe('Button', () => {
     it('should call onClick when clicked', () => {
       const onClick = jest.fn();
       render(<Button onClick={onClick}>Click me</Button>);

       fireEvent.click(screen.getByRole('button'));
       expect(onClick).toHaveBeenCalledTimes(1);
     });
   });
   ```

4. **Business Logic**
   - Validation functions
   - Calculation functions
   - Data transformations
   - Authentication/authorization logic

5. **Bug Fixes**
   - Always write a failing test first
   - Then fix the bug
   - Verify test passes

### Consider Writing Tests For

- Complex UI interactions
- Edge cases and error conditions
- Performance-critical code
- Security-sensitive operations

### Can Skip Tests For

- Type definitions only
- Configuration files (unless complex logic)
- Simple re-exports
- Third-party wrapper components (test integration instead)

## Writing Good Tests

### Test Structure

Always follow the **AAA Pattern**:

```typescript
describe('Feature', () => {
  it('should do something specific', () => {
    // ARRANGE: Set up test data and conditions
    const input = 'test input';
    const expectedOutput = 'expected output';

    // ACT: Execute the code being tested
    const result = myFunction(input);

    // ASSERT: Verify the results
    expect(result).toBe(expectedOutput);
  });
});
```

### Test Naming

Use descriptive names that explain what is being tested:

**Good Names:**
```typescript
✅ it('should return 400 when email is missing')
✅ it('should hash password before storing')
✅ it('should redirect to login page when unauthenticated')
✅ it('should handle network errors gracefully')
```

**Bad Names:**
```typescript
❌ it('works')
❌ it('test1')
❌ it('should work correctly')
❌ it('does something')
```

### Test Independence

Each test should be independent and not rely on other tests:

**Good:**
```typescript
describe('User service', () => {
  beforeEach(() => {
    // Fresh setup for each test
    jest.clearAllMocks();
  });

  it('should create user', async () => {
    const user = await createUser({ email: 'test@example.com' });
    expect(user.email).toBe('test@example.com');
  });

  it('should delete user', async () => {
    const user = await createUser({ email: 'test@example.com' });
    const result = await deleteUser(user.id);
    expect(result.success).toBe(true);
  });
});
```

**Bad:**
```typescript
describe('User service', () => {
  let createdUser;

  it('should create user', async () => {
    createdUser = await createUser({ email: 'test@example.com' });
    expect(createdUser.email).toBe('test@example.com');
  });

  it('should delete user', async () => {
    // ❌ Relies on previous test
    const result = await deleteUser(createdUser.id);
    expect(result.success).toBe(true);
  });
});
```

### Keep Tests Simple

Tests should be easy to understand:

**Good:**
```typescript
it('should validate email format', () => {
  expect(isValidEmail('test@example.com')).toBe(true);
  expect(isValidEmail('invalid')).toBe(false);
});
```

**Bad:**
```typescript
it('should validate email format', () => {
  const emails = [
    { value: 'test@example.com', valid: true },
    { value: 'invalid', valid: false },
    // ... 50 more cases
  ];

  emails.forEach(({ value, valid }) => {
    expect(isValidEmail(value)).toBe(valid);
  });
});
```

### Test Error Cases

Don't just test the happy path:

```typescript
describe('divide', () => {
  it('should divide two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });
});
```

## Test Types

### Unit Tests vs Integration Tests

**Unit Tests** - Test one thing in isolation:
```typescript
// tests/unit/lib/format-currency.test.ts
import { formatCurrency } from '@/lib/utils/format-currency';

describe('formatCurrency', () => {
  it('should format USD currency', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });
});
```

**Integration Tests** - Test how things work together:
```typescript
// tests/integration/api/checkout.test.ts
import { POST } from '@/app/api/checkout/route';

describe('POST /api/checkout', () => {
  it('should process payment and create order', async () => {
    // Tests multiple systems: payment processing, order creation, inventory
    const response = await POST(createCheckoutRequest());
    const data = await response.json();

    expect(data.paymentStatus).toBe('completed');
    expect(data.orderId).toBeDefined();
  });
});
```

### When to Use Each

| Scenario | Test Type | Reason |
|----------|-----------|--------|
| Pure function | Unit | Fast, simple, isolated |
| React component (UI only) | Unit | Fast, no external deps |
| API route | Integration | Tests multiple layers |
| Database query | Integration | Tests real DB interaction |
| Complete user flow | E2E | Tests entire application |
| Authentication flow | Integration/E2E | Tests security-critical path |

## Test Naming Conventions

### File Naming

```
Component/Feature: Button.tsx
Test File: Button.test.tsx (same directory or tests/)

API Route: app/api/users/route.ts
Test File: tests/integration/api/users.test.ts

Utility: lib/utils/format-date.ts
Test File: tests/unit/utils/format-date.test.ts
```

### Test Suite Naming

```typescript
// Match the file/feature being tested
describe('Button', () => {});
describe('POST /api/users', () => {});
describe('formatDate', () => {});

// Group related tests
describe('Button', () => {
  describe('when disabled', () => {
    it('should not call onClick', () => {});
  });

  describe('when loading', () => {
    it('should show spinner', () => {});
  });
});
```

### Test Case Naming

Use "should" statements:

```typescript
it('should validate email format')
it('should return 404 when user not found')
it('should disable submit button when form is invalid')
it('should redirect to login when token expires')
```

## Mock Usage Guidelines

### What to Mock

**Always Mock:**
- External API calls
- Database connections
- File system operations
- Network requests
- Date/time (when testing time-dependent code)
- Random number generators

**Consider Mocking:**
- Complex dependencies
- Slow operations
- Third-party services

**Don't Mock:**
- The code you're testing
- Simple utilities
- Internal functions (in unit tests)

### How to Mock

#### Mock Modules

```typescript
// Mock entire module
jest.mock('@/lib/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

// Mock with implementation
jest.mock('@/lib/api', () => ({
  fetchUser: jest.fn(() => Promise.resolve({ id: '123', name: 'Test' })),
}));
```

#### Mock Functions

```typescript
// Create mock function
const mockFn = jest.fn();

// Set return value
mockFn.mockReturnValue('test');

// Set async return value
mockFn.mockResolvedValue({ data: 'test' });

// Set implementation
mockFn.mockImplementation((x) => x * 2);

// Verify calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(1);
```

#### Mock Timers

```typescript
// Use fake timers
jest.useFakeTimers();

// Fast-forward time
jest.advanceTimersByTime(1000);

// Run all timers
jest.runAllTimers();

// Restore real timers
jest.useRealTimers();
```

### Mock Best Practices

**Good:**
```typescript
// Mock at the top of the file
jest.mock('@/lib/api');

describe('Feature', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should fetch data', async () => {
    const { fetchUser } = require('@/lib/api');
    fetchUser.mockResolvedValue({ id: '123' });

    const result = await myFunction();
    expect(result).toBeDefined();
  });
});
```

**Bad:**
```typescript
describe('Feature', () => {
  it('should fetch data', async () => {
    // ❌ Mocking inside test
    jest.mock('@/lib/api');

    // ❌ Not cleaning up mocks
    const result = await myFunction();
    expect(result).toBeDefined();
  });
});
```

## Skipping Infrastructure Tests

### When to Skip

Skip infrastructure tests when:
- Running tests locally without Docker
- Running tests locally without Kubernetes
- Running in CI without infrastructure setup
- Focusing on unit tests only

### How to Skip

#### Environment Variables

```bash
# Skip Docker tests
SKIP_DOCKER_TESTS=1 npm test

# Skip Kubernetes tests
SKIP_K8S_TESTS=1 npm test

# Skip both
SKIP_DOCKER_TESTS=1 SKIP_K8S_TESTS=1 npm run test:unit
```

#### In Test Files

```typescript
const skipDockerTests = process.env.SKIP_DOCKER_TESTS === '1';

describe('Vector DB Integration', () => {
  beforeAll(() => {
    if (skipDockerTests) {
      console.log('⚠ Skipping Docker tests (SKIP_DOCKER_TESTS=1)');
      return;
    }
  });

  (skipDockerTests ? it.skip : it)('should connect to ChromaDB', async () => {
    // Test code that requires Docker
  });
});
```

### Auto-Detection

Infrastructure is auto-detected in `tests/jest.globalSetup.js`:

```javascript
// Automatically sets SKIP_DOCKER_TESTS if Docker unavailable
// Automatically sets SKIP_K8S_TESTS if kubectl unavailable
```

## Code Review Checklist

When reviewing tests in PRs, check:

### Test Quality
- [ ] Tests follow AAA pattern
- [ ] Test names are descriptive
- [ ] Tests are independent
- [ ] Tests test behavior, not implementation
- [ ] Edge cases are covered
- [ ] Error cases are tested

### Test Coverage
- [ ] New code has tests
- [ ] Coverage doesn't decrease
- [ ] Critical paths have high coverage
- [ ] Tests actually test the new code

### Test Performance
- [ ] Tests run quickly (< 5s for unit tests)
- [ ] No unnecessary async operations
- [ ] Proper use of mocks
- [ ] No actual network calls in unit tests

### Test Maintainability
- [ ] Tests are easy to understand
- [ ] Tests use shared utilities/factories
- [ ] Mocks are properly cleaned up
- [ ] Tests don't rely on execution order

### Documentation
- [ ] Complex test logic is commented
- [ ] Test purpose is clear from name
- [ ] README updated if needed

## Common Pitfalls to Avoid

### 1. Testing Implementation Details

**Bad:**
```typescript
it('should call handleClick', () => {
  const wrapper = shallow(<Button />);
  wrapper.find('button').simulate('click');
  expect(wrapper.instance().handleClick).toHaveBeenCalled();
});
```

**Good:**
```typescript
it('should increment counter when clicked', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### 2. Not Cleaning Up

**Bad:**
```typescript
describe('Feature', () => {
  it('test 1', () => {
    jest.spyOn(console, 'log');
    // ❌ Doesn't restore console.log
  });
});
```

**Good:**
```typescript
describe('Feature', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('test 1', () => {
    jest.spyOn(console, 'log');
    // ✅ Cleaned up after test
  });
});
```

### 3. Over-Mocking

**Bad:**
```typescript
jest.mock('@/lib/utils/add');
jest.mock('@/lib/utils/subtract');
jest.mock('@/lib/utils/multiply');
jest.mock('@/lib/utils/divide');
```

**Good:**
```typescript
// Only mock what you need to
jest.mock('@/lib/api'); // External dependency
// Don't mock internal utilities
```

### 4. Flaky Tests

**Bad:**
```typescript
it('should update after delay', () => {
  setTimeout(() => {
    expect(value).toBe('updated');
  }, 100); // ❌ Timing-dependent, flaky
});
```

**Good:**
```typescript
it('should update after delay', async () => {
  await waitFor(() => {
    expect(value).toBe('updated');
  }); // ✅ Waits reliably
});
```

## Examples by Category

### Authentication Test Example

```typescript
// tests/integration/api/auth/login.test.ts
import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  it('should return JWT token for valid credentials', async () => {
    const response = await POST(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'ValidPassword123',
      }),
    }));

    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(response.status).toBe(200);
  });

  it('should return 401 for invalid credentials', async () => {
    const response = await POST(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'WrongPassword',
      }),
    }));

    expect(response.status).toBe(401);
  });
});
```

### Component Test Example

```typescript
// tests/unit/components/LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
  it('should submit form with valid data', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'ValidPassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPassword123',
      });
    });
  });

  it('should show validation errors for invalid email', async () => {
    render(<LoginForm onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'invalid-email' },
    });
    fireEvent.blur(screen.getByLabelText(/email/i));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });
});
```

## Resources

- [TESTING.md](./TESTING.md) - Complete testing guide
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Remember:** Good tests make confident developers. Write tests you'd want to maintain.

**Last Updated:** 2025-11-05
**Maintained by:** Agent 16 - CI/CD and Documentation Specialist
