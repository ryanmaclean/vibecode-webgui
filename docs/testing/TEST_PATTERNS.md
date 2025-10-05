# Test Patterns and Best Practices

Comprehensive guide to testing patterns, best practices, and anti-patterns to avoid.

## Testing Patterns

### AAA Pattern (Arrange-Act-Assert)

The foundational pattern for writing clear, maintainable tests.

```typescript
describe('User Service', () => {
  it('should create a new user', async () => {
    // Arrange: Set up test data and dependencies
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'SecureP@ss123'
    }

    // Act: Execute the function under test
    const result = await createUser(userData)

    // Assert: Verify the outcome
    expect(result).toHaveProperty('id')
    expect(result.email).toBe(userData.email)
    expect(result.name).toBe(userData.name)
  })
})
```

### Given-When-Then Pattern (BDD Style)

Behavior-driven approach that focuses on user stories.

```typescript
describe('Shopping Cart', () => {
  it('should calculate total price with discount', () => {
    // Given: A cart with items and a discount code
    const cart = new ShoppingCart()
    cart.addItem({ id: 1, price: 100 })
    cart.addItem({ id: 2, price: 50 })
    const discountCode = 'SAVE20'

    // When: The discount is applied
    cart.applyDiscount(discountCode)

    // Then: The total should reflect the discount
    expect(cart.getTotal()).toBe(120) // 20% off 150
  })
})
```

### Test Data Builders Pattern

Create complex test data objects with fluent APIs.

```typescript
// User builder
class UserBuilder {
  private user = {
    id: 'test-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user' as const,
    createdAt: new Date()
  }

  withEmail(email: string) {
    this.user.email = email
    return this
  }

  withRole(role: 'user' | 'admin') {
    this.user.role = role
    return this
  }

  withName(name: string) {
    this.user.name = name
    return this
  }

  build() {
    return { ...this.user }
  }
}

// Usage
describe('User Authorization', () => {
  it('allows admin to access admin panel', () => {
    const adminUser = new UserBuilder()
      .withRole('admin')
      .withEmail('admin@example.com')
      .build()

    const hasAccess = canAccessAdminPanel(adminUser)

    expect(hasAccess).toBe(true)
  })

  it('denies regular user access to admin panel', () => {
    const regularUser = new UserBuilder()
      .withRole('user')
      .build()

    const hasAccess = canAccessAdminPanel(regularUser)

    expect(hasAccess).toBe(false)
  })
})
```

### Object Mother Pattern

Centralized factory for creating test objects.

```typescript
// tests/factories/user.factory.ts
export const UserFactory = {
  createUser: (overrides = {}) => ({
    id: crypto.randomUUID(),
    email: 'user@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    ...overrides
  }),

  createAdmin: (overrides = {}) => ({
    ...UserFactory.createUser(),
    role: 'admin',
    permissions: ['read', 'write', 'delete'],
    ...overrides
  }),

  createGuest: () => ({
    ...UserFactory.createUser(),
    role: 'guest',
    permissions: ['read']
  })
}

// Usage
describe('User Permissions', () => {
  it('admin can delete posts', () => {
    const admin = UserFactory.createAdmin()

    expect(canDeletePost(admin)).toBe(true)
  })

  it('regular user cannot delete posts', () => {
    const user = UserFactory.createUser()

    expect(canDeletePost(user)).toBe(false)
  })
})
```

## Mocking Strategies

### Strategy 1: Mock at Module Level

Best for isolating external dependencies.

```typescript
import { jest } from '@jest/globals'
import { sendEmail } from '@/lib/email'
import { createUser } from '@/lib/user-service'

// Mock entire module
jest.mock('@/lib/email')

const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>

describe('User Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends welcome email to new user', async () => {
    mockedSendEmail.mockResolvedValue({ success: true })

    const user = await createUser({
      email: 'new@example.com',
      name: 'New User',
      password: 'password'
    })

    expect(mockedSendEmail).toHaveBeenCalledWith({
      to: 'new@example.com',
      subject: 'Welcome!',
      template: 'welcome'
    })
  })
})
```

### Strategy 2: Dependency Injection

Pass dependencies as parameters for easier testing.

```typescript
// service.ts
export class UserService {
  constructor(
    private emailService: EmailService,
    private database: Database
  ) {}

  async createUser(data: UserData) {
    const user = await this.database.users.create(data)
    await this.emailService.sendWelcome(user.email)
    return user
  }
}

// service.test.ts
describe('UserService', () => {
  it('creates user and sends email', async () => {
    const mockEmailService = {
      sendWelcome: jest.fn().mockResolvedValue(true)
    }
    const mockDatabase = {
      users: {
        create: jest.fn().mockResolvedValue({
          id: '1',
          email: 'test@example.com'
        })
      }
    }

    const service = new UserService(mockEmailService, mockDatabase)

    await service.createUser({
      email: 'test@example.com',
      name: 'Test',
      password: 'password'
    })

    expect(mockEmailService.sendWelcome).toHaveBeenCalledWith('test@example.com')
  })
})
```

### Strategy 3: Partial Mocking

Mock only specific methods while keeping others real.

```typescript
import { jest } from '@jest/globals'
import * as apiClient from '@/lib/api-client'

// Mock only fetchUserData, keep other functions real
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  fetchUserData: jest.fn()
}))

const mockedFetchUserData = apiClient.fetchUserData as jest.MockedFunction<typeof apiClient.fetchUserData>

describe('User Dashboard', () => {
  it('displays user data', async () => {
    mockedFetchUserData.mockResolvedValue({
      id: '1',
      name: 'Test User'
    })

    const dashboard = await renderUserDashboard('1')

    expect(dashboard).toContain('Test User')
  })
})
```

### Strategy 4: Spy Pattern

Monitor real function calls without changing behavior.

```typescript
import { jest } from '@jest/globals'

describe('Analytics', () => {
  it('tracks page view', () => {
    const trackEvent = jest.spyOn(analytics, 'trackEvent')

    navigateToPage('/dashboard')

    expect(trackEvent).toHaveBeenCalledWith('page_view', {
      page: '/dashboard'
    })

    trackEvent.mockRestore()
  })
})
```

## Test Fixtures

### Fixture Files

```typescript
// tests/fixtures/users.json
[
  {
    "id": "1",
    "email": "user1@example.com",
    "name": "User One",
    "role": "user"
  },
  {
    "id": "2",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  }
]

// Usage
import { readFileSync } from 'fs'
import { join } from 'path'

describe('User List', () => {
  it('displays all users', () => {
    const fixturePath = join(__dirname, '../fixtures/users.json')
    const users = JSON.parse(readFileSync(fixturePath, 'utf-8'))

    const list = renderUserList(users)

    expect(list).toContain('User One')
    expect(list).toContain('Admin User')
  })
})
```

### Setup and Teardown

```typescript
describe('Database Operations', () => {
  let db: Database
  let testUserId: string

  beforeAll(async () => {
    // Run once before all tests
    db = await Database.connect()
  })

  afterAll(async () => {
    // Run once after all tests
    await db.disconnect()
  })

  beforeEach(async () => {
    // Run before each test
    const user = await db.users.create({
      email: 'test@example.com',
      name: 'Test User'
    })
    testUserId = user.id
  })

  afterEach(async () => {
    // Run after each test
    await db.users.delete(testUserId)
  })

  it('fetches user by id', async () => {
    const user = await db.users.findById(testUserId)

    expect(user.email).toBe('test@example.com')
  })

  it('updates user name', async () => {
    await db.users.update(testUserId, { name: 'Updated Name' })

    const user = await db.users.findById(testUserId)
    expect(user.name).toBe('Updated Name')
  })
})
```

## Testing Async Code

### Promises

```typescript
describe('Async Functions', () => {
  it('resolves with data', async () => {
    const result = await fetchData()

    expect(result).toEqual({ data: 'value' })
  })

  it('rejects with error', async () => {
    await expect(fetchData()).rejects.toThrow('Network error')
  })

  it('handles multiple promises', async () => {
    const [result1, result2] = await Promise.all([
      fetchData('endpoint1'),
      fetchData('endpoint2')
    ])

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })
})
```

### Callbacks

```typescript
describe('Callback Functions', () => {
  it('calls callback with result', (done) => {
    fetchDataWithCallback((error, result) => {
      expect(error).toBeNull()
      expect(result).toBe('data')
      done()
    })
  })

  it('calls callback with error', (done) => {
    fetchDataWithCallback((error, result) => {
      expect(error).toBeTruthy()
      expect(result).toBeUndefined()
      done()
    })
  })
})
```

### Observables/Streams

```typescript
describe('Observable Streams', () => {
  it('emits values over time', (done) => {
    const values: number[] = []

    const subscription = numberStream$.subscribe({
      next: (value) => values.push(value),
      complete: () => {
        expect(values).toEqual([1, 2, 3])
        done()
      }
    })
  })

  it('handles errors', (done) => {
    errorStream$.subscribe({
      error: (error) => {
        expect(error.message).toBe('Stream error')
        done()
      }
    })
  })
})
```

## Testing Edge Cases

### Boundary Value Testing

```typescript
describe('Age Validation', () => {
  it('accepts minimum valid age', () => {
    expect(isValidAge(18)).toBe(true)
  })

  it('accepts maximum valid age', () => {
    expect(isValidAge(120)).toBe(true)
  })

  it('rejects age below minimum', () => {
    expect(isValidAge(17)).toBe(false)
  })

  it('rejects age above maximum', () => {
    expect(isValidAge(121)).toBe(false)
  })

  it('rejects zero age', () => {
    expect(isValidAge(0)).toBe(false)
  })

  it('rejects negative age', () => {
    expect(isValidAge(-1)).toBe(false)
  })
})
```

### Null and Undefined Handling

```typescript
describe('Safe Data Access', () => {
  it('handles null input', () => {
    const result = getUserName(null)
    expect(result).toBe('Anonymous')
  })

  it('handles undefined input', () => {
    const result = getUserName(undefined)
    expect(result).toBe('Anonymous')
  })

  it('handles missing properties', () => {
    const user = { id: '1' } // no name property
    const result = getUserName(user)
    expect(result).toBe('Anonymous')
  })

  it('handles empty string', () => {
    const result = getUserName({ name: '' })
    expect(result).toBe('Anonymous')
  })
})
```

### Error Conditions

```typescript
describe('Error Handling', () => {
  it('throws for invalid input', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero')
  })

  it('returns error for malformed data', async () => {
    const result = await parseJSON('invalid json')

    expect(result.error).toBe('Invalid JSON')
    expect(result.data).toBeNull()
  })

  it('handles network timeout', async () => {
    jest.useFakeTimers()

    const promise = fetchWithTimeout('http://slow-api.com', 1000)

    jest.advanceTimersByTime(1001)

    await expect(promise).rejects.toThrow('Request timeout')

    jest.useRealTimers()
  })
})
```

## Anti-Patterns to Avoid

### Testing Implementation Details

```typescript
// Bad: Testing internal state
it('increments counter', () => {
  const component = new Counter()
  component.increment()
  expect(component._internalCounter).toBe(1) // Don't test private state
})

// Good: Testing observable behavior
it('displays incremented count', () => {
  const component = new Counter()
  component.increment()
  expect(component.getCount()).toBe(1)
})
```

### Excessive Mocking

```typescript
// Bad: Mocking everything
jest.mock('@/lib/utils')
jest.mock('@/lib/helpers')
jest.mock('@/lib/validators')
jest.mock('@/lib/formatters')

// Good: Mock only external dependencies
jest.mock('@/lib/api-client')
// Test real utils, helpers, validators
```

### Test Interdependence

```typescript
// Bad: Tests depend on each other
describe('User Flow', () => {
  let userId: string

  it('creates user', () => {
    userId = createUser() // Sets shared state
  })

  it('updates user', () => {
    updateUser(userId) // Depends on previous test
  })
})

// Good: Independent tests
describe('User Flow', () => {
  it('creates user', () => {
    const userId = createUser()
    expect(userId).toBeDefined()
  })

  it('updates user', () => {
    const userId = createUser() // Setup in each test
    const result = updateUser(userId)
    expect(result).toBe(true)
  })
})
```

### Testing Multiple Things

```typescript
// Bad: Testing multiple concerns
it('user operations', async () => {
  const user = await createUser()
  expect(user.id).toBeDefined()

  const updated = await updateUser(user.id, { name: 'New' })
  expect(updated.name).toBe('New')

  await deleteUser(user.id)
  const deleted = await getUser(user.id)
  expect(deleted).toBeNull()
})

// Good: One concept per test
it('creates user with id', async () => {
  const user = await createUser()
  expect(user.id).toBeDefined()
})

it('updates user name', async () => {
  const user = await createUser()
  const updated = await updateUser(user.id, { name: 'New' })
  expect(updated.name).toBe('New')
})

it('deletes user', async () => {
  const user = await createUser()
  await deleteUser(user.id)
  const deleted = await getUser(user.id)
  expect(deleted).toBeNull()
})
```

### Flaky Tests

```typescript
// Bad: Race conditions and arbitrary waits
it('loads data', async () => {
  loadData()
  await new Promise(resolve => setTimeout(resolve, 1000)) // Flaky!
  expect(getData()).toBeDefined()
})

// Good: Proper async handling
it('loads data', async () => {
  await loadData()
  expect(getData()).toBeDefined()
})

// Good: Explicit waiting
it('displays loaded data', async ({ page }) => {
  await page.goto('/data')
  await expect(page.getByText('Loaded')).toBeVisible({ timeout: 5000 })
})
```

## Best Practices Summary

### Test Naming

```typescript
// Good: Descriptive test names
it('should validate email format')
it('should throw error for duplicate email')
it('should render loading spinner while fetching data')

// Bad: Vague test names
it('works')
it('test1')
it('validation')
```

### Test Structure

```typescript
// Good: Clear AAA structure
it('should format currency', () => {
  // Arrange
  const amount = 1234.56
  const currency = 'USD'

  // Act
  const result = formatCurrency(amount, currency)

  // Assert
  expect(result).toBe('$1,234.56')
})

// Bad: Unclear structure
it('should format currency', () => {
  expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56')
  const x = 100
  expect(formatCurrency(x, 'EUR')).toBe('€100.00')
})
```

### Assertion Quality

```typescript
// Good: Specific assertions
expect(user.email).toBe('test@example.com')
expect(user.roles).toContain('admin')
expect(response.status).toBe(200)

// Bad: Vague assertions
expect(user).toBeTruthy()
expect(response).toBeDefined()
```

## Debugging Tests

### Using Console Logs Effectively

```typescript
it('processes data', () => {
  const input = { data: [1, 2, 3] }

  console.log('Input:', JSON.stringify(input, null, 2))

  const result = processData(input)

  console.log('Result:', JSON.stringify(result, null, 2))

  expect(result.total).toBe(6)
})
```

### Debugging Jest Tests

```bash
# Run single test
npm run test -- --testNamePattern="specific test"

# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm run test -- --verbose --no-coverage
```

### Debugging Playwright Tests

```bash
# Debug mode with inspector
npx playwright test --debug

# Headed mode
npx playwright test --headed

# Pause in test
await page.pause()
```

## Resources

### Example Test Files

- `tests/unit/auth/password.test.ts` - Unit testing patterns
- `tests/integration/monitoring-api.test.ts` - Integration testing patterns
- `tests/e2e/accessibility.test.ts` - E2E testing patterns

### External Resources

- [Jest Best Practices](https://jestjs.io/docs/getting-started)
- [React Testing Library Guides](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Next Steps

- [CI Testing Guide](./CI_TESTING.md)
- [Unit Testing Guide](./UNIT_TESTING.md)
- [Integration Testing Guide](./INTEGRATION_TESTING.md)
- [E2E Testing Guide](./E2E_TESTING.md)
