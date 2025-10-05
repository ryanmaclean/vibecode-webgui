# Unit Testing Guide

Guide for writing effective unit tests using Jest and React Testing Library.

## Overview

Unit tests focus on testing individual functions, components, or modules in isolation. They are fast, focused, and should make up the majority of your test suite.

## When to Write Unit Tests

Use unit tests for:

- Pure functions and utility methods
- React components with logic
- Data transformation functions
- Validation and sanitization logic
- State management logic
- Custom hooks
- Business logic calculations

## Test Framework: Jest

### Basic Test Structure

```typescript
describe('ComponentName or FunctionName', () => {
  // Setup runs before each test
  beforeEach(() => {
    // Initialize test state
  });

  // Cleanup runs after each test
  afterEach(() => {
    // Clean up resources
  });

  it('should describe what the test does', () => {
    // Arrange: Set up test data
    const input = 'test data';

    // Act: Execute the function/method
    const result = functionUnderTest(input);

    // Assert: Verify the outcome
    expect(result).toBe('expected output');
  });
});
```

### Real Example: Password Utility

```typescript
import { hashPassword, verifyPassword, isValidBcryptHash } from '@/lib/auth/password'

describe('auth/password utilities', () => {
  describe('hashPassword', () => {
    it('produces a bcrypt hash that verifies with the original password', async () => {
      const password = 'Str0ng-P@ssword!'
      const hash = await hashPassword(password)

      expect(hash).toMatch(/^\$2[aby]\$12\$/)
      await expect(verifyPassword(password, hash)).resolves.toBe(true)
    })

    it('rejects empty password input', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string')
    })
  })

  describe('verifyPassword', () => {
    it('returns false when the password does not match', async () => {
      const hash = await hashPassword('OriginalP@ssw0rd')
      await expect(verifyPassword('DifferentP@ssw0rd', hash)).resolves.toBe(false)
    })

    it('returns false for an invalid hash input without throwing', async () => {
      await expect(verifyPassword('some-password', 'not-a-bcrypt-hash')).resolves.toBe(false)
    })
  })
})
```

## Component Testing with React Testing Library

### Basic Component Test

```typescript
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  it('renders with provided text', () => {
    render(<MyComponent text="Hello World" />)

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('calls onClick handler when button is clicked', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()

    render(<MyComponent onClick={handleClick} />)

    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Testing User Interactions

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from '@/components/auth/LoginForm'

describe('LoginForm', () => {
  it('submits form with user credentials', async () => {
    const onSubmit = jest.fn()
    const user = userEvent.setup()

    render(<LoginForm onSubmit={onSubmit} />)

    // Fill in form fields
    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/password/i), 'SecureP@ss123')

    // Submit form
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Verify submission
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'SecureP@ss123'
    })
  })

  it('displays validation errors for invalid input', async () => {
    const user = userEvent.setup()

    render(<LoginForm onSubmit={jest.fn()} />)

    // Try to submit without filling fields
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Check for error messages
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
  })
})
```

## Mocking Dependencies

### Mocking Modules

```typescript
import { jest } from '@jest/globals'

// Mock entire module
jest.mock('@/lib/database', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  query: jest.fn()
}))

// Mock specific functions
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  fetchData: jest.fn() // Only mock this function
}))
```

### Mocking Next.js Modules

```typescript
import { jest } from '@jest/globals'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns data for authenticated user', async () => {
    // Mock authenticated session
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user123', role: 'user' }
    })

    const request = new Request('http://localhost:3000/api/data') as NextRequest
    const response = await GET(request)

    expect(response.status).toBe(200)
  })
})
```

### Mocking External Services

```typescript
import axios from 'axios'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('API Service', () => {
  it('fetches data from external API', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { id: 1, name: 'Test' }
    })

    const result = await fetchUserData(1)

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/users/1')
    expect(result).toEqual({ id: 1, name: 'Test' })
  })

  it('handles API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'))

    await expect(fetchUserData(1)).rejects.toThrow('Network error')
  })
})
```

## Testing Async Code

### Promises

```typescript
it('resolves with correct data', async () => {
  const result = await asyncFunction()
  expect(result).toBe('expected value')
})

it('rejects with error', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message')
})

// Alternative syntax
it('resolves with correct data', () => {
  return expect(asyncFunction()).resolves.toBe('expected value')
})
```

### Callbacks

```typescript
it('calls callback with result', (done) => {
  functionWithCallback((error, result) => {
    expect(error).toBeNull()
    expect(result).toBe('expected value')
    done()
  })
})
```

### Timers

```typescript
describe('Timer functions', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('executes after timeout', () => {
    const callback = jest.fn()

    setTimeout(callback, 1000)

    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
```

## Testing Custom Hooks

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '@/hooks/useCounter'

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter())

    expect(result.current.count).toBe(0)
  })

  it('increments counter', () => {
    const { result } = renderHook(() => useCounter())

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })

  it('accepts initial value', () => {
    const { result } = renderHook(() => useCounter(10))

    expect(result.current.count).toBe(10)
  })
})
```

## Common Assertions

### Basic Matchers

```typescript
// Equality
expect(value).toBe(4)                    // Exact equality (===)
expect(value).toEqual({ a: 1, b: 2 })   // Deep equality
expect(value).not.toBe(null)            // Negation

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeDefined()
expect(value).toBeNull()
expect(value).toBeUndefined()

// Numbers
expect(value).toBeGreaterThan(3)
expect(value).toBeGreaterThanOrEqual(3)
expect(value).toBeLessThan(5)
expect(value).toBeCloseTo(0.3)  // Floating point

// Strings
expect(string).toMatch(/pattern/)
expect(string).toContain('substring')

// Arrays
expect(array).toContain(item)
expect(array).toHaveLength(3)
expect(array).toEqual(expect.arrayContaining([1, 2]))

// Objects
expect(obj).toHaveProperty('key')
expect(obj).toHaveProperty('key', 'value')
expect(obj).toMatchObject({ a: 1 })

// Exceptions
expect(() => fn()).toThrow()
expect(() => fn()).toThrow('error message')
expect(() => fn()).toThrow(ErrorClass)
```

### React Testing Library Queries

```typescript
// Preferred queries (by accessibility)
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText('Enter name')
screen.getByText(/welcome/i)

// Alternative queries
screen.getByDisplayValue('current value')
screen.getByAltText('image description')
screen.getByTitle('tooltip text')

// Query variants
screen.getBy...()      // Throws if not found (use for assertions)
screen.queryBy...()    // Returns null if not found (use for checking absence)
screen.findBy...()     // Returns promise, waits (use for async elements)

// Multiple elements
screen.getAllBy...()
screen.queryAllBy...()
screen.findAllBy...()
```

## Running Tests

### Basic Commands

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test -- tests/unit/auth/password.test.ts

# Run tests matching pattern
npm run test -- --testNamePattern="password"

# Watch mode
npm run test:watch

# With coverage
npm run test:unit -- --coverage

# Verbose output
npm run test -- --verbose
```

### Debug Mode

```bash
# Debug in VS Code
# 1. Add breakpoint in test file
# 2. Run: "Jest: Debug" from command palette

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Single test with console output
npm run test -- --verbose --no-coverage path/to/test.test.ts
```

## Best Practices

### Test Organization

1. **Group related tests** with `describe` blocks
2. **Use descriptive test names** that explain expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests focused** - one concept per test
5. **Make tests independent** - no shared state

### Naming Conventions

```typescript
// Good test names
it('should validate email format')
it('should throw error for invalid input')
it('should render user profile when authenticated')

// Poor test names
it('works')
it('test 1')
it('handles error')
```

### Do's

- Test behavior, not implementation
- Mock external dependencies
- Use descriptive variable names
- Test edge cases and error conditions
- Keep tests simple and readable
- Use setup and teardown appropriately

### Don'ts

- Don't test third-party libraries
- Don't test implementation details (private methods)
- Don't use real database or external APIs
- Don't rely on test execution order
- Don't share mutable state between tests
- Don't over-mock - test real code when possible

## Common Patterns

### Testing Error Handling

```typescript
it('handles missing required field', () => {
  const invalidData = { email: 'test@example.com' } // missing password

  expect(() => validateLoginData(invalidData))
    .toThrow('Password is required')
})
```

### Testing State Changes

```typescript
it('updates state on user input', async () => {
  const user = userEvent.setup()
  render(<Counter />)

  const button = screen.getByRole('button', { name: /increment/i })
  const count = screen.getByText(/count:/i)

  expect(count).toHaveTextContent('Count: 0')

  await user.click(button)

  expect(count).toHaveTextContent('Count: 1')
})
```

### Testing Conditional Rendering

```typescript
it('shows loading spinner while fetching', () => {
  render(<UserProfile isLoading={true} />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('shows user data after loading', () => {
  const user = { name: 'John', email: 'john@example.com' }
  render(<UserProfile isLoading={false} user={user} />)

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('John')).toBeInTheDocument()
})
```

## Example Test Files

Refer to these examples in the codebase:

- `tests/unit/auth/password.test.ts` - Testing utility functions
- `tests/unit/ai-chat-interface.test.tsx` - Component testing
- `tests/unit/auth/credentials-provider.test.ts` - Testing providers

## Troubleshooting

### Common Issues

**Tests fail with module not found**
```bash
# Check moduleNameMapper in jest.config.mjs
# Ensure path aliases match tsconfig.json
```

**Tests timeout**
```typescript
// Increase timeout for slow tests
it('slow operation', async () => {
  // test code
}, 10000) // 10 second timeout
```

**Async tests don't wait**
```typescript
// Use await or return promise
it('async test', async () => {
  await asyncOperation()
  // assertions
})
```

**React hooks error**
```typescript
// Wrap in act() when updating state
act(() => {
  result.current.updateState()
})
```

## Next Steps

- [Integration Testing Guide](./INTEGRATION_TESTING.md)
- [Test Patterns](./TEST_PATTERNS.md)
- [CI Testing](./CI_TESTING.md)
