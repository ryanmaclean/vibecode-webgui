# End-to-End Testing Guide

Guide for writing E2E tests using Playwright to validate complete user workflows in real browsers.

## Overview

End-to-end (E2E) tests verify that your application works correctly from the user's perspective. They test the entire application stack - from the UI through the backend to the database - in a real browser environment.

## When to Write E2E Tests

Use E2E tests for:

- Critical user journeys (login, checkout, data submission)
- Multi-page workflows
- User interactions (clicks, form fills, navigation)
- Visual validation and responsive design
- Cross-browser compatibility
- Accessibility compliance (WCAG)
- Integration of all system components

## Playwright Overview

Playwright is a modern E2E testing framework that:

- Supports multiple browsers (Chromium, Firefox, WebKit)
- Provides reliable auto-waiting
- Enables parallel test execution
- Captures screenshots and videos on failure
- Supports mobile emulation
- Includes accessibility testing tools

## Basic Test Structure

### Simple Page Test

```typescript
import { test, expect } from '@playwright/test'

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/VibeCode/)
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
})
```

### Test with User Interaction

```typescript
import { test, expect } from '@playwright/test'

test('user can submit a form', async ({ page }) => {
  await page.goto('/contact')

  // Fill out form
  await page.getByLabel(/name/i).fill('John Doe')
  await page.getByLabel(/email/i).fill('john@example.com')
  await page.getByLabel(/message/i).fill('Test message')

  // Submit
  await page.getByRole('button', { name: /submit/i }).click()

  // Verify success
  await expect(page.getByText(/thank you/i)).toBeVisible()
})
```

## Authentication Flow Testing

### Login Test

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can log in with valid credentials', async ({ page }) => {
    await page.goto('/auth/login')

    // Fill login form
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/password/i).fill('TestPassword123')

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard')

    // Verify user is logged in
    await expect(page.getByText(/welcome back/i)).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByLabel(/email/i).fill('wrong@example.com')
    await page.getByLabel(/password/i).fill('WrongPassword')

    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()

    // Should remain on login page
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
```

### Using Authentication State

```typescript
import { test as setup } from '@playwright/test'

// Create authenticated state once
setup('authenticate', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel(/password/i).fill('TestPassword123')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL('/dashboard')

  // Save authentication state
  await page.context().storageState({ path: 'auth-state.json' })
})

// Use in other tests
test.use({ storageState: 'auth-state.json' })

test('authenticated user can access protected page', async ({ page }) => {
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
})
```

## Locator Strategies

### Preferred Locators (Accessibility-Based)

```typescript
// By role (best for accessibility)
page.getByRole('button', { name: /submit/i })
page.getByRole('textbox', { name: /email/i })
page.getByRole('heading', { name: /welcome/i })

// By label (forms)
page.getByLabel(/email address/i)
page.getByLabel(/password/i)

// By placeholder
page.getByPlaceholder(/search/i)

// By text content
page.getByText(/welcome back/i)
page.getByText('Exact text match')
```

### Alternative Locators

```typescript
// By test ID (when semantic locators aren't available)
page.getByTestId('submit-button')

// By CSS selector (last resort)
page.locator('.submit-btn')
page.locator('#user-email')

// Combining locators
page.getByRole('button').filter({ hasText: /submit/i })
page.locator('form').getByRole('button')
```

## Waiting Strategies

### Auto-Waiting (Preferred)

```typescript
// Playwright automatically waits for elements
await page.getByRole('button').click() // Waits for button to be visible and enabled

await expect(page.getByText('Success')).toBeVisible() // Waits up to 5 seconds
```

### Explicit Waits

```typescript
// Wait for URL change
await page.waitForURL('/dashboard')

// Wait for network idle
await page.waitForLoadState('networkidle')

// Wait for specific selector
await page.waitForSelector('.data-loaded')

// Wait for function to return true
await page.waitForFunction(() => {
  return document.querySelectorAll('.item').length > 0
})

// Custom timeout
await expect(page.getByText('Loaded')).toBeVisible({ timeout: 10000 })
```

## Handling Dynamic Content

### Working with Loading States

```typescript
test('loads data from API', async ({ page }) => {
  await page.goto('/users')

  // Loading indicator should appear
  await expect(page.getByRole('status')).toBeVisible()

  // Wait for data to load
  await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10000 })

  // Verify data is displayed
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(10)
})
```

### Working with Modals

```typescript
test('opens and closes modal', async ({ page }) => {
  await page.goto('/dashboard')

  // Open modal
  await page.getByRole('button', { name: /create new/i }).click()

  // Modal should be visible
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  // Fill modal form
  await modal.getByLabel(/name/i).fill('Test Item')
  await modal.getByRole('button', { name: /save/i }).click()

  // Modal should close
  await expect(modal).not.toBeVisible()

  // Verify item was created
  await expect(page.getByText('Test Item')).toBeVisible()
})
```

## Testing User Interactions

### Complex Interactions

```typescript
test('drag and drop functionality', async ({ page }) => {
  await page.goto('/kanban')

  const sourceCard = page.getByTestId('card-1')
  const targetColumn = page.getByTestId('column-done')

  // Drag card to new column
  await sourceCard.dragTo(targetColumn)

  // Verify card moved
  await expect(targetColumn.getByTestId('card-1')).toBeVisible()
})

test('file upload', async ({ page }) => {
  await page.goto('/upload')

  // Select file
  const fileInput = page.getByLabel(/choose file/i)
  await fileInput.setInputFiles('path/to/test-file.pdf')

  // Submit upload
  await page.getByRole('button', { name: /upload/i }).click()

  // Verify success
  await expect(page.getByText(/upload successful/i)).toBeVisible()
})

test('keyboard navigation', async ({ page }) => {
  await page.goto('/form')

  // Navigate with keyboard
  await page.keyboard.press('Tab')
  await page.keyboard.type('user@example.com')

  await page.keyboard.press('Tab')
  await page.keyboard.type('Password123')

  await page.keyboard.press('Enter')

  // Verify form submitted
  await expect(page).toHaveURL('/dashboard')
})
```

## Accessibility Testing

### Using axe-core

```typescript
import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test('page meets WCAG 2.1 AA standards', async ({ page }) => {
  await page.goto('/')

  // Inject axe-core library
  await injectAxe(page)

  // Run accessibility checks
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true
    }
  })
})

test('form is accessible', async ({ page }) => {
  await page.goto('/contact')

  await injectAxe(page)

  // Check specific element
  await checkA11y(page, 'form', {
    rules: {
      'color-contrast': { enabled: true },
      'label': { enabled: true }
    }
  })
})
```

### Manual Accessibility Checks

```typescript
test('has proper heading hierarchy', async ({ page }) => {
  await page.goto('/')

  // Should have one h1
  const h1Count = await page.getByRole('heading', { level: 1 }).count()
  expect(h1Count).toBe(1)

  // Check heading text
  const mainHeading = page.getByRole('heading', { level: 1 })
  await expect(mainHeading).toHaveText(/welcome/i)
})

test('all images have alt text', async ({ page }) => {
  await page.goto('/')

  const images = page.locator('img')
  const count = await images.count()

  for (let i = 0; i < count; i++) {
    const img = images.nth(i)
    const alt = await img.getAttribute('alt')
    expect(alt).toBeTruthy()
  }
})

test('keyboard navigation works', async ({ page }) => {
  await page.goto('/')

  // Tab through focusable elements
  await page.keyboard.press('Tab')

  const focused = page.locator(':focus')
  await expect(focused).toBeVisible()

  // Verify focus indicator
  const outline = await focused.evaluate(el => {
    const styles = window.getComputedStyle(el)
    return styles.outline || styles.boxShadow
  })
  expect(outline).not.toBe('none')
})
```

## Visual Testing

### Screenshots

```typescript
test('homepage visual regression', async ({ page }) => {
  await page.goto('/')

  // Full page screenshot
  await expect(page).toHaveScreenshot('homepage.png')

  // Element screenshot
  await expect(page.getByRole('main')).toHaveScreenshot('main-content.png')
})

test('responsive design', async ({ page }) => {
  // Desktop
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await expect(page).toHaveScreenshot('desktop.png')

  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(page).toHaveScreenshot('tablet.png')

  // Mobile
  await page.setViewportSize({ width: 375, height: 667 })
  await expect(page).toHaveScreenshot('mobile.png')
})
```

### Video Recording

```typescript
// Configure in playwright.config.ts
export default defineConfig({
  use: {
    video: 'retain-on-failure', // or 'on', 'off'
  }
})

// Videos are automatically saved to test-results/
```

## Mobile Testing

### Device Emulation

```typescript
import { devices } from '@playwright/test'

test.use({ ...devices['iPhone 12'] })

test('mobile navigation works', async ({ page }) => {
  await page.goto('/')

  // Open mobile menu
  await page.getByRole('button', { name: /menu/i }).click()

  // Check navigation is visible
  await expect(page.getByRole('navigation')).toBeVisible()
})
```

### Touch Interactions

```typescript
test('swipe gesture on mobile', async ({ page }) => {
  await page.goto('/gallery')

  const gallery = page.getByTestId('image-gallery')

  // Swipe left
  await gallery.tap()
  await gallery.dispatchEvent('touchstart', { touches: [{ clientX: 300, clientY: 100 }] })
  await gallery.dispatchEvent('touchmove', { touches: [{ clientX: 100, clientY: 100 }] })
  await gallery.dispatchEvent('touchend')

  // Verify next image
  await expect(page.getByTestId('image-2')).toBeVisible()
})
```

## Network Interception

### Mocking API Responses

```typescript
test('handles API errors gracefully', async ({ page }) => {
  // Intercept API call and return error
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Server error' })
    })
  })

  await page.goto('/users')

  // Verify error message
  await expect(page.getByText(/failed to load users/i)).toBeVisible()
})

test('loads data from mocked API', async ({ page }) => {
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ])
    })
  })

  await page.goto('/users')

  await expect(page.getByText('User 1')).toBeVisible()
  await expect(page.getByText('User 2')).toBeVisible()
})
```

## Test Organization

### Using Test Helpers

```typescript
// tests/e2e/utils/test-helpers.ts
export class TestHelpers {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/auth/login')
    await this.page.getByLabel(/email/i).fill(email)
    await this.page.getByLabel(/password/i).fill(password)
    await this.page.getByRole('button', { name: /sign in/i }).click()
    await this.page.waitForURL('/dashboard')
  }

  async waitForPageReady() {
    await this.page.waitForLoadState('networkidle')
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` })
  }
}

// Usage in tests
import { TestHelpers } from './utils/test-helpers'

test('user dashboard', async ({ page }) => {
  const helpers = new TestHelpers(page)

  await helpers.login('test@example.com', 'password')
  await helpers.waitForPageReady()

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()

  await helpers.takeScreenshot('dashboard')
})
```

## Running E2E Tests

### Basic Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test auth-flow.test.ts

# Run tests for specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Show test report
npx playwright show-report
```

### Production Testing

```bash
# Test against production
npm run test:e2e:production

# Quick smoke tests
npm run test:production:smoke

# Specific production tests
BASE_URL=https://production.example.com npx playwright test
```

## Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  }
})
```

## Best Practices

### Do's

1. **Use semantic locators** (getByRole, getByLabel)
2. **Test user behavior**, not implementation
3. **Keep tests independent** - no shared state
4. **Use auto-waiting** - let Playwright wait automatically
5. **Test critical paths** - focus on key user journeys
6. **Run in multiple browsers** - ensure cross-browser compatibility
7. **Take screenshots on failure** - aid debugging
8. **Use meaningful test names** - describe user actions

### Don'ts

1. **Don't use arbitrary waits** (`page.waitForTimeout(5000)`)
2. **Don't rely on brittle selectors** (complex CSS)
3. **Don't test every edge case** in E2E (use unit tests)
4. **Don't make tests dependent** on execution order
5. **Don't ignore flaky tests** - fix the root cause
6. **Don't test third-party services** - mock them
7. **Don't skip accessibility** - include a11y checks

## Debugging Tests

### Debug Mode

```bash
# Run with Playwright Inspector
npx playwright test --debug

# Debug specific test
npx playwright test --debug auth-flow.test.ts

# Start from specific line
npx playwright test --debug --headed auth-flow.test.ts:10
```

### Using Console Logs

```typescript
test('debug test', async ({ page }) => {
  // Log page URL
  console.log('Current URL:', page.url())

  // Log element count
  const buttons = page.getByRole('button')
  console.log('Button count:', await buttons.count())

  // Pause execution
  await page.pause()
})
```

### Trace Viewer

```bash
# Generate trace on failure (configured in playwright.config.ts)
npm run test:e2e

# View trace
npx playwright show-trace test-results/path-to-trace.zip
```

## Common Issues

### Flaky Tests

```typescript
// Bad: Arbitrary timeout
await page.waitForTimeout(3000)

// Good: Wait for specific condition
await expect(page.getByText('Loaded')).toBeVisible()

// Bad: Race condition
await page.click('button')
expect(page.url()).toBe('/next-page')

// Good: Wait for navigation
await Promise.all([
  page.waitForURL('/next-page'),
  page.click('button')
])
```

### Element Not Found

```typescript
// Ensure element is in viewport
await element.scrollIntoViewIfNeeded()

// Wait for element
await element.waitFor({ state: 'visible' })

// Check if element exists
const count = await element.count()
if (count > 0) {
  await element.click()
}
```

## Example Test Files

Reference these E2E tests in the codebase:

- `tests/e2e/accessibility.test.ts` - WCAG compliance tests
- `tests/e2e/auth/login.test.ts` - Authentication flows
- `tests/e2e/critical-user-journeys.test.ts` - Key user paths

## Next Steps

- [Test Patterns](./TEST_PATTERNS.md)
- [CI Testing](./CI_TESTING.md)
- [Playwright Documentation](https://playwright.dev/)
