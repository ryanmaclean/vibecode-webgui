---
title: MCP Playwright
description: Structured approach to UI testing automation for reliable cross-browser and cross-device testing
---

# MCP Playwright

## Overview and Purpose

MCP Playwright is a comprehensive framework for UI testing automation that ensures consistent and reliable tests across different browsers and devices. It provides a structured approach to testing web applications, with a particular focus on complex AI-driven interfaces like those in the VibeCode platform.

The Playwright MCP (Master Control Program) component enables developers to:

- Create reliable, cross-browser end-to-end tests
- Automate UI testing across desktop and mobile viewports
- Ensure accessibility compliance with WCAG standards
- Integrate testing into CI/CD pipelines
- Maintain context awareness throughout test execution
- Structure complex test scenarios in a logical, step-by-step manner

By providing a structured framework for UI testing, MCP Playwright helps ensure that the VibeCode platform delivers a high-quality, consistent user experience across all supported environments.

## Core Components and Configuration

MCP Playwright is built on top of the Playwright testing framework and extends its capabilities with additional structure and integration with other MCP components. The core configuration is defined in `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
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
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: process.env.USE_BUILD
      ? 'bash -c "BUILDING=true NODE_ENV=production PLAYWRIGHT_TEST=true PORT=3000 npm run build && PORT=3000 PLAYWRIGHT_TEST=true node .next/standalone/server.js"'
      : 'PLAYWRIGHT_TEST=true npm run dev:simple',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000,
  },
});
```

### Key Components

1. **Multi-Browser Testing**: Tests run on Chrome, Firefox, Safari, and mobile browsers
2. **Parallel Execution**: Tests run in parallel for faster execution
3. **Automatic Retries**: Failed tests are retried on CI environments
4. **Failure Diagnostics**: Screenshots, videos, and traces are captured on failure
5. **Reporting**: Multiple report formats for different use cases
6. **Integrated Web Server**: Automatically starts the application for testing

## Test Organization Strategy

MCP Playwright organizes tests in a structured hierarchy that promotes maintainability and clarity:

```
tests/
  ├── e2e/                  # End-to-end tests
  │   ├── smoke.test.ts     # Basic smoke tests
  │   ├── auth/             # Authentication flows
  │   ├── workspace/        # Workspace management
  │   ├── ai/               # AI features
  │   └── monitoring/       # Monitoring dashboard
  ├── accessibility/        # Accessibility tests
  │   ├── automated-a11y.test.ts
  │   └── contrast.test.ts
  ├── performance/          # Performance tests
  └── integration/          # Integration tests
```

### Test Categories

1. **Smoke Tests**: Basic tests to verify core functionality works
2. **Feature Tests**: Detailed tests for specific features
3. **User Journey Tests**: End-to-end flows that simulate real user behavior
4. **Accessibility Tests**: Ensure WCAG compliance
5. **Performance Tests**: Measure and verify performance metrics

## Writing Effective Tests

MCP Playwright tests follow a structured approach that makes them readable, maintainable, and reliable. Here's an example of a basic smoke test:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/')
    
    // Verify page loads without errors
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Check for main navigation elements
    const navigation = page.locator('nav')
    if (await navigation.isVisible()) {
      await expect(navigation).toBeVisible()
    }
    
    // Should not show any obvious error messages
    const errorElements = page.locator('[data-testid*="error"]')
    const errorCount = await errorElements.count()
    expect(errorCount).toBe(0)
  })

  test('should handle responsive design', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/')
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Page should still be functional on all viewport sizes
    const errorElements = page.locator('[data-testid*="error"]')
    const errorCount = await errorElements.count()
    expect(errorCount).toBe(0)
  })
})
```

### Best Practices for Writing Tests

1. **Use Descriptive Test Names**: Names should clearly describe what is being tested
2. **Structure with describe() and test()**: Group related tests together
3. **Use Page Object Model**: Encapsulate page elements and actions in reusable classes
4. **Prefer Stable Selectors**: Use data-testid attributes for stable element selection
5. **Handle Async Operations Properly**: Use await for all async operations
6. **Clean Test Data**: Set up and tear down test data properly
7. **Isolate Tests**: Tests should not depend on each other

### Example: Page Object Model

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/signin');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="signin-button"]');
  }

  async getErrorMessage() {
    const errorMessage = this.page.locator('[data-testid="error-message"]');
    return errorMessage.isVisible() ? errorMessage.textContent() : null;
  }
}

// tests/e2e/auth/authentication.test.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should show error with invalid credentials', async () => {
    await loginPage.login('invalid@example.com', 'wrongpassword');
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid email or password');
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await loginPage.login('test@example.com', 'correctpassword');
    await expect(page).toHaveURL(/dashboard/);
  });
});
```

## Accessibility Testing Integration

MCP Playwright includes robust accessibility testing using axe-core to ensure WCAG 2.1 AA compliance. This is integrated directly into the testing workflow:

```typescript
// Example of integrating axe-core with Playwright
import { test, expect } from '@playwright/test';
import { createPlaywrightAxeTest } from 'axe-playwright';

const axeTest = createPlaywrightAxeTest({ playwright: { test, expect } });

test.describe('Accessibility Testing', () => {
  test('homepage should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await axeTest.run(page, {
      // Specify which WCAG standards to test against
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa']
      }
    });
  });

  test('dashboard should not have accessibility violations', async ({ page }) => {
    // Login first
    // ...

    await page.goto('/dashboard');
    await axeTest.run(page, {
      // Use WCAG 2.1 AA rules
      runOnly: {
        type: 'tag',
        values: ['wcag21aa']
      }
    });
  });
});
```

### Accessibility Test Coverage

The accessibility testing framework covers:

1. **WCAG 2.1 AA Compliance**: All core pages and components
2. **Keyboard Navigation**: Ensure all functionality is accessible via keyboard
3. **Screen Reader Compatibility**: Test with ARIA attributes and semantic HTML
4. **Color Contrast**: Verify sufficient contrast for text and UI elements
5. **Form Accessibility**: Ensure forms have proper labels and error states

## Integration with Context7 and Sequential Thinking

MCP Playwright integrates with other MCP components to create a more powerful and comprehensive testing framework.

### Integration with Context7

Context7 enhances Playwright tests by providing rich contextual information during test execution. This allows tests to be more aware of the system state, user context, and environment.

```typescript
import { test, expect } from '@playwright/test';
import { Context7Manager } from '../../lib/context7';

test.describe('Context-Aware Testing', () => {
  let context: Context7Manager;

  test.beforeEach(async () => {
    context = new Context7Manager();
  });

  test('should personalize dashboard based on user context', async ({ page }) => {
    // Set up user context
    context.updateUserContext({
      userId: 'test@example.com',
      profile: {
        expertise: 'advanced',
        theme: 'dark',
        language: 'en',
        timezone: 'America/New_York'
      },
      permissions: ['admin', 'developer']
    });

    // Log in and navigate to dashboard
    await page.goto('/auth/signin');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Update spatial context
    context.updateSpatialContext({
      currentLocation: '/dashboard',
      navigationPath: ['/auth/signin', '/dashboard']
    });

    // Verify dashboard is personalized according to user context
    await expect(page.locator('.theme-dark')).toBeVisible();
    await expect(page.locator('.admin-panel')).toBeVisible();
    await expect(page.locator('.advanced-tools')).toBeVisible();

    // Update context with user actions
    context.recordUserAction('viewed_dashboard');
    
    // Use context for conditional testing
    if (context.getUserContext().permissions.includes('admin')) {
      // Verify admin-specific elements
      await expect(page.locator('.user-management')).toBeVisible();
    }
  });
});
```

### Integration with Sequential Thinking

Sequential Thinking helps structure complex test scenarios in a logical, step-by-step manner, making tests more maintainable and easier to understand.

```typescript
import { test, expect } from '@playwright/test';
import { SequentialThinkingProcess } from '../../lib/sequential-thinking';

test.describe('AI Project Generation', () => {
  test('should generate a complete project from description', async ({ page }) => {
    const thinking = new SequentialThinkingProcess();
    
    // Step 1: Navigate to project generator
    thinking.addThought(
      'Navigate to the project generator page',
      1,
      5
    );
    await page.goto('/project-generator');
    await expect(page).toHaveTitle(/Project Generator/);
    
    // Step 2: Enter project description
    thinking.addThought(
      'Enter a detailed project description for a React web application',
      2,
      5
    );
    await page.fill('#project-description', 'Create a React web application with a dashboard that displays real-time data from an API, includes user authentication, and has a dark/light theme toggle.');
    
    // Step 3: Select project type and technologies
    thinking.addThought(
      'Select appropriate project type and technologies',
      3,
      5
    );
    await page.selectOption('#project-type', 'web');
    await page.check('#tech-react');
    await page.check('#tech-node');
    
    // Step 4: Generate project
    thinking.addThought(
      'Submit the form to generate the project',
      4,
      5
    );
    await page.click('button.primary');
    
    // Step 5: Verify project generation
    thinking.addThought(
      'Verify that the project is generated successfully with all requested features',
      5,
      5
    );
    
    // Wait for generation to complete
    await page.waitForSelector('#generation-complete', { timeout: 60000 });
    
    // Verify project structure
    await expect(page.locator('#project-files')).toContainText('package.json');
    await expect(page.locator('#project-files')).toContainText('src/App.js');
    await expect(page.locator('#project-files')).toContainText('src/components/Dashboard.js');
    await expect(page.locator('#project-files')).toContainText('src/components/Auth.js');
    await expect(page.locator('#project-files')).toContainText('src/components/ThemeToggle.js');
    
    // Verify AI explanation
    await expect(page.locator('#ai-explanation')).toContainText('React');
    await expect(page.locator('#ai-explanation')).toContainText('authentication');
    await expect(page.locator('#ai-explanation')).toContainText('theme');
  });
});
```

### Combined Integration Example

The true power of MCP Playwright comes when combining Context7 and Sequential Thinking:

```typescript
import { test, expect } from '@playwright/test';
import { Context7Manager } from '../../lib/context7';
import { SequentialThinkingProcess } from '../../lib/sequential-thinking';

test.describe('Collaborative Workspace Testing', () => {
  let context: Context7Manager;
  let thinking: SequentialThinkingProcess;
  
  test.beforeEach(async () => {
    context = new Context7Manager();
    thinking = new SequentialThinkingProcess();
  });
  
  test('should create and share collaborative workspace', async ({ page, browser }) => {
    // Set up user context
    context.updateUserContext({
      userId: 'test@example.com',
      authStatus: 'authenticated',
      permissions: ['create_workspace', 'invite_users']
    });
    
    // Step 1: Navigate to workspaces
    thinking.addThought(
      'Navigate to the workspaces page',
      1,
      7
    );
    await page.goto('/workspaces');
    context.updateSpatialContext({
      currentLocation: '/workspaces',
      navigationPath: ['/workspaces']
    });
    
    // Step 2: Create new workspace
    thinking.addThought(
      'Create a new collaborative workspace',
      2,
      7
    );
    await page.click('#create-workspace');
    await page.fill('#workspace-name', 'Test Collaboration');
    await page.click('#create-button');
    context.recordUserAction('created_workspace');
    
    // Step 3: Verify workspace creation
    thinking.addThought(
      'Verify that the workspace was created successfully',
      3,
      7
    );
    await page.waitForSelector('#workspace-created');
    const workspaceId = await page.getAttribute('#workspace-created', 'data-workspace-id');
    expect(workspaceId).toBeTruthy();
    
    context.updateTaskContext({
      currentTask: {
        id: 'test-collaboration',
        type: 'workspace-creation',
        description: 'Testing collaborative workspace',
        startTime: Date.now()
      },
      taskParameters: {
        workspaceId
      }
    });
    
    // Step 4: Invite another user
    thinking.addThought(
      'Invite another user to the workspace',
      4,
      7
    );
    await page.click('#invite-users');
    await page.fill('#invite-email', 'collaborator@example.com');
    await page.click('#send-invite');
    context.recordUserAction('invited_user');
    
    // Step 5: Create a second browser context for the collaborator
    thinking.addThought(
      'Simulate the collaborator joining the workspace',
      5,
      7
    );
    const collaboratorContext = await browser.newContext();
    const collaboratorPage = await collaboratorContext.newPage();
    
    // Log in as collaborator
    await collaboratorPage.goto('/auth/signin');
    await collaboratorPage.fill('#email', 'collaborator@example.com');
    await collaboratorPage.fill('#password', 'password123');
    await collaboratorPage.click('button[type="submit"]');
    
    // Accept invitation
    await collaboratorPage.click('#accept-invitation');
    
    // Step 6: Test real-time collaboration
    thinking.addThought(
      'Test real-time collaboration between the two users',
      6,
      7
    );
    
    // First user creates a document
    await page.click('#create-document');
    await page.fill('#document-title', 'Collaborative Doc');
    await page.fill('#document-content', 'Initial content');
    await page.click('#save-document');
    context.recordUserAction('created_document');
    
    // Wait for document to appear for collaborator
    await collaboratorPage.waitForSelector('#document-list');
    await collaboratorPage.click('text=Collaborative Doc');
    
    // Collaborator edits the document
    await collaboratorPage.fill('#document-content', 'Updated content by collaborator');
    await collaboratorPage.click('#save-document');
    
    // Verify first user sees the changes
    await expect(page.locator('#document-content')).toHaveValue('Updated content by collaborator');
    
    // Step 7: Verify collaboration history
    thinking.addThought(
      'Verify collaboration history is recorded correctly',
      7,
      7
    );
    await page.click('#view-history');
    await expect(page.locator('#history-list')).toContainText('Test Collaboration created');
    await expect(page.locator('#history-list')).toContainText('invited collaborator@example.com');
    await expect(page.locator('#history-list')).toContainText('Collaborative Doc created');
    await expect(page.locator('#history-list')).toContainText('Collaborative Doc edited');
    
    // Update context with completion
    context.updateTaskContext({
      completedTasks: [...context.getTaskContext().completedTasks, 'test-collaboration']
    });
  });
});
```

## CI/CD Integration and Reporting

MCP Playwright is designed to integrate seamlessly with CI/CD pipelines, providing automated testing as part of the development workflow.

### GitHub Actions Integration

```yaml
name: E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        
      - name: Run Playwright tests
        run: npm run test:e2e
        env:
          CI: true
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: |
            test-results/
            playwright-report/
```

### Test Reporting

MCP Playwright generates comprehensive test reports in multiple formats:

- **HTML Reports**: Interactive reports with screenshots, videos, and traces
- **JSON Reports**: Machine-readable data for custom dashboards
- **JUnit Reports**: XML format for CI/CD integration

These reports can be aggregated and analyzed to track test coverage, failure trends, and overall quality metrics.

## Best Practices and Advanced Techniques

### Visual Regression Testing

MCP Playwright supports visual regression testing to catch unexpected UI changes:

```typescript
import { test, expect } from '@playwright/test';

test('visual comparison of homepage', async ({ page }) => {
  await page.goto('/');
  
  // Compare current page with baseline
  await expect(page).toHaveScreenshot('homepage.png', {
    // Options for screenshot comparison
    threshold: 0.2, // Allow small differences
    maxDiffPixelRatio: 0.01 // Max percentage of pixels that can differ
  });
});
```

### API Testing with UI Context

Combine API and UI testing for more efficient tests:

```typescript
import { test, expect } from '@playwright/test';

test('API-driven UI testing', async ({ page, request }) => {
  // Set up data via API
  const response = await request.post('/api/data', {
    data: {
      name: 'Test Item',
      value: 42
    }
  });
  expect(response.ok()).toBeTruthy();
  const { id } = await response.json();
  
  // Verify UI shows the created data
  await page.goto(`/items/${id}`);
  await expect(page.locator('#item-name')).toHaveText('Test Item');
  await expect(page.locator('#item-value')).toHaveText('42');
});
```

### Test Data Management

Use a structured approach to test data:

```typescript
import { test as base, expect } from '@playwright/test';
import { TestDataManager } from '../../utils/test-data-manager';

// Extend the base test with test data
const test = base.extend({
  testData: async ({ request }, use) => {
    const dataManager = new TestDataManager(request);
    await dataManager.setup();
    await use(dataManager);
    await dataManager.cleanup();
  }
});

test('use managed test data', async ({ page, testData }) => {
  // Create test data
  const user = await testData.createUser({ role: 'admin' });
  const project = await testData.createProject({ owner: user.id });
  
  // Test with the created data
  await page.goto(`/projects/${project.id}`);
  await expect(page.locator('#project-title')).toHaveText(project.name);
});
```

### Performance Testing

Measure and verify performance metrics:

```typescript
import { test, expect } from '@playwright/test';

test('page load performance', async ({ page }) => {
  // Enable performance metrics
  await page.evaluate(() => performance.mark('test-start'));
  
  // Navigate to the page
  await page.goto('/dashboard');
  
  // Mark the end and measure
  const metrics = await page.evaluate(() => {
    performance.mark('test-end');
    performance.measure('page-load', 'test-start', 'test-end');
    return performance.getEntriesByType('measure')[0].duration;
  });
  
  // Assert on performance
  expect(metrics).toBeLessThan(2000); // Page should load in less than 2 seconds
});
```

## Conclusion

MCP Playwright provides a comprehensive framework for UI testing automation, ensuring that the VibeCode platform delivers a high-quality, consistent user experience across all supported environments. By integrating with other MCP components like Sequential Thinking, it creates a testing solution that is greater than the sum of its parts.

The combination of structured test organization, accessibility testing integration, and CI/CD automation creates a powerful testing framework that can catch issues early and maintain high quality throughout the development process. By following the best practices and techniques outlined in this document, you can create reliable, maintainable tests that ensure the VibeCode platform meets its quality goals.
