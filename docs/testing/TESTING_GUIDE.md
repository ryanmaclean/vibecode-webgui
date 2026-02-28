# Testing Guide

This guide provides comprehensive patterns and best practices for testing in the project, covering unit tests, integration tests, and end-to-end (E2E) tests.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Unit Testing](#unit-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Test Utilities](#test-utilities)
- [Best Practices](#best-practices)
- [Running Tests](#running-tests)
- [Coverage](#coverage)
- [Common Patterns](#common-patterns)

## Overview

Our testing strategy follows a layered approach:

1. **Unit Tests**: Test individual components, functions, and modules in isolation
2. **Integration Tests**: Test interactions between components and services
3. **E2E Tests**: Test complete user flows in a real browser environment

### Testing Philosophy

- Write tests that verify behavior, not implementation details
- Focus on user interactions and outcomes
- Keep tests maintainable and readable
- Use appropriate test types for different scenarios
- Maintain good test coverage without sacrificing quality

## Testing Stack

### Unit & Integration Testing

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/user-event**: User interaction simulation
- **@testing-library/jest-dom**: Extended DOM matchers

### E2E Testing

- **Playwright**: Browser automation and E2E testing
- **@playwright/test**: Playwright test runner and fixtures

### Test Utilities

- Custom `test-utils.tsx`: Provides common wrappers and helpers
- Mock utilities for API calls, browser APIs, and dependencies
- Prisma test utilities for database mocking

## Unit Testing

### Basic Component Test Structure

```tsx
import React from 'react'
import { screen, fireEvent, waitFor, renderWithProviders } from '@/../tests/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import YourComponent from '@/components/YourComponent'

describe('YourComponent', () => {
  const defaultProps = {
    // Define default props
    workspaceId: 'test-workspace',
    onAction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up global mocks
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }) as any;
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders with default state', async () => {
      renderWithProviders(<YourComponent {...defaultProps} />)

      expect(screen.getByText('Expected Text')).toBeInTheDocument()
    })
  })
})
```

### Using React Testing Library

#### Querying Elements

Prefer queries in this order (most to least preferred):

1. **Accessible queries** (visible to assistive technologies)
   ```tsx
   screen.getByRole('button', { name: /submit/i })
   screen.getByLabelText('Email')
   screen.getByPlaceholderText('Enter your email')
   screen.getByText('Welcome')
   ```

2. **Semantic queries**
   ```tsx
   screen.getByAltText('Profile picture')
   screen.getByTitle('Close')
   ```

3. **Test IDs** (last resort)
   ```tsx
   screen.getByTestId('custom-element')
   ```

#### User Interactions

Use `@testing-library/user-event` for realistic user interactions:

```tsx
const user = userEvent.setup()

// Typing
await user.type(textarea, 'Hello world')

// Clicking
await user.click(button)

// Keyboard shortcuts
await user.type(textarea, 'Test message{Enter}')
await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

// File upload
await user.upload(fileInput, file)
```

#### Async Operations and Waiting

```tsx
// Wait for an element to appear
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument()
})

// Wait for an element to disappear
await waitFor(() => {
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
})

// Check element visibility with timeout
await expect(page.locator('[data-testid="message"]')).toBeVisible({ timeout: 5000 })
```

### Mocking

#### Global API Mocks

```tsx
// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: [] }),
  text: () => Promise.resolve(''),
  blob: () => Promise.resolve(new Blob()),
}) as any;

// Mock URL APIs
global.URL.createObjectURL = jest.fn((file: Blob) => `blob:${(file as File).name}`);
```

#### Streaming Response Mocks

```tsx
const mockResponse = new Response(
  'data: {"content": "Hello there!"}\n\ndata: {"done": true}\n\n',
  {
    headers: { 'Content-Type': 'text/event-stream' },
    status: 200
  }
)

const mockReader = {
  read: jest.fn()
    .mockResolvedValueOnce({
      done: false,
      value: new TextEncoder().encode('data: {"content": "Hello there!"}\n\n')
    })
    .mockResolvedValueOnce({ done: true, value: undefined })
}
mockResponse.body = { getReader: () => mockReader } as any;
(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)
```

#### Component Prop Mocks

```tsx
const mockOnFileUpload = jest.fn()
const mockOnChange = jest.fn()

// Verify mock was called
expect(mockOnFileUpload).toHaveBeenCalledWith(expectedFiles)
expect(mockOnChange).toHaveBeenCalledTimes(1)
```

### Test Organization

Group related tests using nested `describe` blocks:

```tsx
describe('ComponentName', () => {
  describe('Rendering', () => {
    it('renders with default state', () => {})
    it('applies custom className', () => {})
  })

  describe('User Interactions', () => {
    it('handles button click', () => {})
    it('handles keyboard input', () => {})
  })

  describe('Error Handling', () => {
    it('displays error message on failure', () => {})
    it('recovers from error state', () => {})
  })
})
```

## End-to-End Testing

### Basic E2E Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feature-path');
  });

  test('should perform user action', async ({ page }) => {
    // Verify URL
    await expect(page).toHaveURL(/.*\/feature-path/);

    // Interact with elements
    const input = page.locator('[data-testid="input"]');
    await input.fill('Test data');

    const button = page.locator('[data-testid="submit-button"]');
    await button.click();

    // Verify results
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### Playwright Patterns

#### Element Selection

Use data-testid attributes for reliable element selection:

```tsx
// In component
<button data-testid="send-button">Send</button>

// In test
const sendButton = page.locator('[data-testid="send-button"]');
await sendButton.click();
```

#### Waiting for Elements

```typescript
// Wait for element to be visible
await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

// Wait for multiple possible outcomes
const streamingOrAssistant = page.locator('[data-testid="streaming-indicator"]').or(
  page.locator('[data-testid="message-assistant"]')
);
await expect(streamingOrAssistant).toBeVisible({ timeout: 15000 });

// Wait for element count
await expect(page.locator('[data-testid="message-user"]')).toHaveCount(2);
```

#### Form Interactions

```typescript
// Fill input
await messageInput.fill('Hello, AI!');

// Select option
await modelSelector.selectOption('openai/gpt-4');

// Press keyboard keys
await messageInput.press('Enter');
await messageInput.press('Shift+Enter');

// Verify input value
await expect(messageInput).toHaveValue('Expected value');
```

#### Testing State Changes

```typescript
// Initially disabled
await expect(sendButton).toBeDisabled();

// After action
await messageInput.fill('Message');
await expect(sendButton).toBeEnabled();
```

## Test Utilities

### renderWithProviders

Custom render function that wraps components with necessary providers:

```tsx
import { renderWithProviders } from '@/../tests/test-utils'

renderWithProviders(<Component />, {
  theme: 'dark',
  router: { push: mockPush },
  pathname: '/test-path',
  searchParams: { id: '123' }
})
```

### Mock Utilities

```tsx
import {
  mockLocalStorage,
  mockSessionStorage,
  setupBrowserMocks,
  createMockFile,
  mockIntersectionObserver,
} from '@/../tests/test-utils'

// Setup browser mocks
setupBrowserMocks()

// Create mock file
const file = createMockFile('test.js', 1024, 'application/javascript', 'console.log("test")')
```

### Custom Helpers

```tsx
// Wait for async operations
import { waitForAsync } from '@/../tests/test-utils'
await waitForAsync(100)

// Mock router
import { createMockRouter } from '@/../tests/test-utils'
const mockRouter = createMockRouter({
  push: jest.fn(),
  pathname: '/chat'
})
```

## Best Practices

### General Testing Principles

1. **Test behavior, not implementation**
   - Focus on what users see and do
   - Avoid testing internal state or implementation details
   - Use accessible queries (getByRole, getByLabelText)

2. **Write maintainable tests**
   - Use descriptive test names that explain the scenario
   - Keep tests simple and focused on one thing
   - Use helper functions to reduce duplication

3. **Avoid common pitfalls**
   - Don't use implementation-specific selectors (class names, element types)
   - Don't test third-party libraries
   - Don't rely on test execution order
   - Always clean up mocks in afterEach

### Component Testing

```tsx
// ✅ Good: Tests user-visible behavior
it('displays error message when form submission fails', async () => {
  const user = userEvent.setup()
  renderWithProviders(<LoginForm />)

  await user.type(screen.getByLabelText('Email'), 'invalid@email')
  await user.click(screen.getByRole('button', { name: /login/i }))

  expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
})

// ❌ Bad: Tests implementation details
it('sets isLoading state to true', () => {
  const wrapper = shallow(<LoginForm />)
  wrapper.instance().setState({ isLoading: true })
  expect(wrapper.state('isLoading')).toBe(true)
})
```

### Async Testing

```tsx
// ✅ Good: Uses waitFor for async operations
it('loads conversation history on mount', async () => {
  renderWithProviders(<ChatInterface />)

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations/workspace-id')
  })
})

// ❌ Bad: No waiting for async operations
it('loads conversation history on mount', () => {
  renderWithProviders(<ChatInterface />)
  expect(global.fetch).toHaveBeenCalled() // May fail intermittently
})
```

### Mocking Best Practices

```tsx
// ✅ Good: Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] })
  }) as any
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ❌ Bad: Mocks persist across tests
beforeAll(() => {
  global.fetch = jest.fn() // This will affect all tests
})
```

### Accessibility Testing

```tsx
it('has proper ARIA labels and roles', async () => {
  renderWithProviders(<Component />)

  // Use accessible queries
  const textarea = screen.getByRole('textbox')
  expect(textarea).toHaveAttribute('aria-label', 'Message input')

  const button = screen.getByRole('button', { name: /send/i })
  expect(button).toBeInTheDocument()
})

it('supports keyboard navigation', async () => {
  const user = userEvent.setup()
  renderWithProviders(<Component />)

  const textarea = screen.getByRole('textbox')
  await user.tab()
  expect(textarea).toHaveFocus()
})
```

### Error Handling

```tsx
it('handles streaming errors gracefully', async () => {
  const user = userEvent.setup()

  // Mock error response
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

  renderWithProviders(<Component />)

  await user.type(screen.getByRole('textbox'), 'Test message')
  await user.click(screen.getByRole('button', { name: /send/i }))

  // Verify error is displayed to user
  await waitFor(() => {
    expect(screen.getByText(/encountered an error/i)).toBeInTheDocument()
  })
})
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="handles user input"
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/chat.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
```

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run WebSocket integration tests
npm run test:ws
```

## Coverage

### Coverage Configuration

Coverage thresholds are configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70
  }
}
```

### Generating Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Best Practices

- Aim for meaningful coverage, not 100% coverage
- Focus on critical paths and edge cases
- Don't write tests just to increase coverage percentage
- Review uncovered code to identify missing test cases

## Common Patterns

### Testing File Upload

```tsx
it('handles file upload through hidden input', async () => {
  const user = userEvent.setup()
  const mockFiles = [
    new File(['test content'], 'test.js', { type: 'application/javascript' })
  ]

  renderWithProviders(<Component onFileUpload={mockOnFileUpload} />)

  const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
  await user.upload(fileInput, mockFiles)

  await waitFor(() => {
    expect(screen.getByText('test.js')).toBeInTheDocument()
  })
  expect(mockOnFileUpload).toHaveBeenCalledWith(mockFiles)
})
```

### Testing Keyboard Shortcuts

```tsx
it('sends message when Enter is pressed', async () => {
  const user = userEvent.setup()
  renderWithProviders(<ChatInterface />)

  const textarea = screen.getByPlaceholderText('Ask anything...')
  await user.type(textarea, 'Test message{Enter}')

  expect(textarea).toHaveValue('') // Input cleared after send
})

it('adds new line when Shift+Enter is pressed', async () => {
  const user = userEvent.setup()
  renderWithProviders(<ChatInterface />)

  const textarea = screen.getByPlaceholderText('Ask anything...')
  await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

  const value = (textarea as HTMLTextAreaElement).value
  expect(value).toContain('\n')
})
```

### Testing Loading States

```tsx
it('displays loading indicator while fetching data', async () => {
  renderWithProviders(<Component />)

  // Loading should be visible initially
  expect(screen.getByText(/loading/i)).toBeInTheDocument()

  // Wait for data to load
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

  // Verify data is displayed
  expect(screen.getByText('Expected content')).toBeInTheDocument()
})
```

### Testing Conditional Rendering

```tsx
it('shows "more" indicator when there are many items', async () => {
  const manyFiles = ['file1.js', 'file2.js', 'file3.js', 'file4.js', 'file5.js']

  renderWithProviders(<Component files={manyFiles} />)

  expect(screen.getByText('+2 more')).toBeInTheDocument()
})
```

### Testing Multiple Messages

```tsx
it('maintains chat history across multiple messages', async () => {
  const user = userEvent.setup()
  renderWithProviders(<ChatInterface />)

  const input = screen.getByTestId('message-input')
  const sendButton = screen.getByTestId('send-button')

  // Send first message
  await input.fill('First message')
  await sendButton.click()
  await expect(page.locator('[data-testid="message-user"]')).toHaveCount(1)

  // Send second message
  await input.fill('Second message')
  await sendButton.click()
  await expect(page.locator('[data-testid="message-user"]')).toHaveCount(2)

  // Verify both messages are visible
  const messages = page.locator('[data-testid="message-user"]')
  await expect(messages.nth(0)).toContainText('First message')
  await expect(messages.nth(1)).toContainText('Second message')
})
```

### Testing Empty States

```tsx
it('displays empty state when no items', async () => {
  renderWithProviders(<Component items={[]} />)

  expect(screen.getByText('No items yet')).toBeInTheDocument()
  expect(screen.queryByTestId('item')).not.toBeInTheDocument()
})
```

## Troubleshooting

### Common Issues

#### "Not wrapped in act(...)" warnings

```tsx
// ✅ Solution: Use waitFor for async state updates
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument()
})
```

#### "Unable to find element" errors

```tsx
// ✅ Solution: Use findBy queries for async elements
const element = await screen.findByText('Async content')

// Or use waitFor
await waitFor(() => {
  expect(screen.getByText('Async content')).toBeInTheDocument()
})
```

#### Flaky E2E tests

```tsx
// ✅ Solution: Add appropriate timeouts and wait conditions
await expect(element).toBeVisible({ timeout: 5000 })
await page.waitForLoadState('networkidle')
```

## Additional Resources

- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Accessibility Testing Guide](https://testing-library.com/docs/queries/about/#priority)

## Contributing

When adding new tests:

1. Follow the established patterns in existing test files
2. Use descriptive test names that explain the scenario
3. Include both positive and negative test cases
4. Test accessibility and keyboard navigation
5. Add appropriate comments for complex test logic
6. Ensure tests are deterministic and not flaky
7. Keep tests focused and maintainable
