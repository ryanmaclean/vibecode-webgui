/**
 * E2E User Journey Test Example
 * 
 * This example demonstrates:
 * - Complete user workflows testing
 * - Playwright best practices
 * - Page Object Model pattern
 * - Test data management
 * - Error handling and cleanup
 * - Accessibility testing integration
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

// Page Object Models
class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/auth/signin');
    await this.page.waitForLoadState('networkidle');
  }

  async fillCredentials(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
  }

  async submit() {
    await this.page.click('[data-testid="signin-button"]');
    await this.page.waitForURL('/dashboard');
  }

  async signIn(email: string, password: string) {
    await this.navigate();
    await this.fillCredentials(email, password);
    await this.submit();
  }

  async expectError(message: string) {
    await expect(this.page.locator('[data-testid="error-message"]')).toContainText(message);
  }
}

class DashboardPage {
  constructor(private page: Page) {}

  async expectToBeVisible() {
    await expect(this.page.locator('h1')).toContainText('Dashboard');
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  async getWorkspaceCount(): Promise<number> {
    const workspaces = await this.page.locator('[data-testid="workspace-card"]').count();
    return workspaces;
  }

  async clickCreateWorkspace() {
    await this.page.click('[data-testid="create-workspace-button"]');
  }

  async openWorkspace(name: string) {
    await this.page.click(`[data-testid="workspace-${name}"]`);
  }

  async signOut() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="signout-button"]');
    await this.page.waitForURL('/');
  }
}

class WorkspaceCreateModal {
  constructor(private page: Page) {}

  async expectToBeVisible() {
    await expect(this.page.locator('[data-testid="workspace-create-modal"]')).toBeVisible();
  }

  async fillForm(data: {
    name: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
  }) {
    await this.page.fill('[data-testid="workspace-name"]', data.name);
    
    if (data.description) {
      await this.page.fill('[data-testid="workspace-description"]', data.description);
    }
    
    if (data.isPublic) {
      await this.page.check('[data-testid="workspace-public"]');
    }
    
    if (data.tags) {
      for (const tag of data.tags) {
        await this.page.fill('[data-testid="workspace-tags-input"]', tag);
        await this.page.press('[data-testid="workspace-tags-input"]', 'Enter');
      }
    }
  }

  async submit() {
    await this.page.click('[data-testid="create-workspace-submit"]');
    await this.expectToBeHidden();
  }

  async cancel() {
    await this.page.click('[data-testid="create-workspace-cancel"]');
    await this.expectToBeHidden();
  }

  async expectToBeHidden() {
    await expect(this.page.locator('[data-testid="workspace-create-modal"]')).toBeHidden();
  }
}

class WorkspacePage {
  constructor(private page: Page) {}

  async expectToBeVisible(workspaceName: string) {
    await expect(this.page.locator('h1')).toContainText(workspaceName);
    await expect(this.page.locator('[data-testid="workspace-navigation"]')).toBeVisible();
  }

  async openAIChat() {
    await this.page.click('[data-testid="ai-chat-tab"]');
    await expect(this.page.locator('[data-testid="ai-chat-container"]')).toBeVisible();
  }

  async sendChatMessage(message: string) {
    await this.page.fill('[data-testid="chat-input"]', message);
    await this.page.click('[data-testid="send-message-button"]');
  }

  async expectChatResponse() {
    await expect(this.page.locator('[data-testid="chat-messages"] .assistant-message').last()).toBeVisible({
      timeout: 30000 // AI responses can take time
    });
  }

  async getChatMessages() {
    return await this.page.locator('[data-testid="chat-message"]').all();
  }

  async createProject(name: string) {
    await this.page.click('[data-testid="create-project-button"]');
    await this.page.fill('[data-testid="project-name"]', name);
    await this.page.click('[data-testid="project-create-submit"]');
    
    // Wait for project to be created and visible
    await expect(this.page.locator(`[data-testid="project-${name}"]`)).toBeVisible();
  }

  async expectProjectExists(name: string) {
    await expect(this.page.locator(`[data-testid="project-${name}"]`)).toBeVisible();
  }
}

// Test data and utilities
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User'
};

const testWorkspace = {
  name: 'My Test Workspace',
  description: 'A workspace for testing purposes',
  isPublic: false,
  tags: ['testing', 'automation']
};

// Custom test fixtures
test.beforeEach(async ({ page }) => {
  // Set up test data, mocks, etc.
  await page.route('**/api/auth/**', async (route) => {
    // Mock authentication for consistent testing
    if (route.request().method() === 'POST' && route.request().url().includes('signin')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: testUser
        })
      });
    } else {
      await route.continue();
    }
  });

  // Inject axe for accessibility testing
  await injectAxe(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // Cleanup test data
  if (testInfo.status === 'failed') {
    // Take screenshot on failure
    const screenshot = await page.screenshot();
    await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
    
    // Save page content for debugging
    const html = await page.content();
    await testInfo.attach('page-content', { body: html, contentType: 'text/html' });
  }
});

// Main user journey tests
test.describe('Complete User Journey', () => {
  test('new user can sign up, create workspace, and use AI features', async ({ page }) => {
    // Initialize page objects
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const workspaceModal = new WorkspaceCreateModal(page);
    const workspacePage = new WorkspacePage(page);

    // Step 1: User authentication
    await test.step('User signs in successfully', async () => {
      await loginPage.signIn(testUser.email, testUser.password);
      await dashboardPage.expectToBeVisible();
      
      // Check accessibility
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true }
      });
    });

    // Step 2: Dashboard interaction
    await test.step('User views dashboard and existing workspaces', async () => {
      const initialWorkspaceCount = await dashboardPage.getWorkspaceCount();
      expect(initialWorkspaceCount).toBeGreaterThanOrEqual(0);
      
      // Take screenshot for visual regression testing
      await page.screenshot({ path: 'test-results/dashboard-view.png' });
    });

    // Step 3: Workspace creation
    await test.step('User creates a new workspace', async () => {
      await dashboardPage.clickCreateWorkspace();
      await workspaceModal.expectToBeVisible();
      
      await workspaceModal.fillForm(testWorkspace);
      await workspaceModal.submit();
      
      // Verify workspace appears in dashboard
      await expect(page.locator(`text=${testWorkspace.name}`)).toBeVisible();
      
      const newWorkspaceCount = await dashboardPage.getWorkspaceCount();
      expect(newWorkspaceCount).toBeGreaterThan(0);
    });

    // Step 4: Workspace interaction
    await test.step('User opens workspace and explores features', async () => {
      await dashboardPage.openWorkspace(testWorkspace.name);
      await workspacePage.expectToBeVisible(testWorkspace.name);
      
      // Test project creation
      await workspacePage.createProject('Test Project');
      await workspacePage.expectProjectExists('Test Project');
    });

    // Step 5: AI features testing
    await test.step('User interacts with AI chat', async () => {
      await workspacePage.openAIChat();
      
      // Send a simple message
      await workspacePage.sendChatMessage('Hello, can you help me with React?');
      await workspacePage.expectChatResponse();
      
      // Verify message history
      const messages = await workspacePage.getChatMessages();
      expect(messages).toHaveLength(2); // User message + AI response
      
      // Send a follow-up message
      await workspacePage.sendChatMessage('Can you show me a useState example?');
      await workspacePage.expectChatResponse();
      
      // Verify updated message history
      const updatedMessages = await workspacePage.getChatMessages();
      expect(updatedMessages).toHaveLength(4); // 2 previous + 2 new
    });

    // Step 6: Data persistence verification
    await test.step('User data persists across page refresh', async () => {
      await page.reload();
      await workspacePage.expectToBeVisible(testWorkspace.name);
      await workspacePage.expectProjectExists('Test Project');
      
      // Verify chat history persists
      await workspacePage.openAIChat();
      const messages = await workspacePage.getChatMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    // Step 7: User signs out
    await test.step('User signs out successfully', async () => {
      await dashboardPage.signOut();
      await expect(page).toHaveURL('/');
      
      // Verify user cannot access protected pages
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/auth/signin');
    });
  });

  test('workspace collaboration features work correctly', async ({ 
    page, 
    context 
  }) => {
    // This test would involve multiple browser contexts to simulate collaboration
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const workspacePage = new WorkspacePage(page);

    // Create second browser context for collaborator
    const collaboratorContext = await context.newPage();
    const collaboratorLogin = new LoginPage(collaboratorContext);
    const collaboratorDashboard = new DashboardPage(collaboratorContext);

    await test.step('Owner creates shared workspace', async () => {
      await loginPage.signIn('owner@example.com', 'password123');
      await dashboardPage.clickCreateWorkspace();
      
      const workspaceModal = new WorkspaceCreateModal(page);
      await workspaceModal.fillForm({
        name: 'Shared Workspace',
        description: 'For collaboration testing',
        isPublic: true
      });
      await workspaceModal.submit();
    });

    await test.step('Collaborator can access shared workspace', async () => {
      await collaboratorLogin.signIn('collaborator@example.com', 'password123');
      
      // Find and open shared workspace
      await expect(collaboratorContext.locator('text=Shared Workspace')).toBeVisible();
      await collaboratorDashboard.openWorkspace('Shared Workspace');
    });

    await test.step('Real-time collaboration works', async () => {
      // Owner creates a project
      await workspacePage.createProject('Collaborative Project');
      
      // Collaborator should see the project (in real implementation, this would use WebSockets)
      await collaboratorContext.waitForTimeout(1000); // Simulate sync delay
      await collaboratorContext.reload();
      
      const collaboratorWorkspace = new WorkspacePage(collaboratorContext);
      await collaboratorWorkspace.expectProjectExists('Collaborative Project');
    });
  });

  test('error handling and recovery work correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Handles authentication errors gracefully', async () => {
      await loginPage.navigate();
      await loginPage.fillCredentials('invalid@example.com', 'wrongpassword');
      
      // Mock failed authentication
      await page.route('**/api/auth/signin', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid credentials'
          })
        });
      });
      
      await page.click('[data-testid="signin-button"]');
      await loginPage.expectError('Invalid credentials');
      
      // Verify user stays on login page
      await expect(page).toHaveURL('/auth/signin');
    });

    await test.step('Handles network errors and provides retry options', async () => {
      // Successfully sign in first
      await loginPage.signIn(testUser.email, testUser.password);
      
      // Mock network failure for workspace creation
      await page.route('**/api/workspaces', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error'
          })
        });
      });
      
      await dashboardPage.clickCreateWorkspace();
      const workspaceModal = new WorkspaceCreateModal(page);
      await workspaceModal.fillForm({
        name: 'Failed Workspace'
      });
      
      await workspaceModal.submit();
      
      // Should show error message and allow retry
      await expect(page.locator('[data-testid="error-toast"]')).toContainText('server error');
    });
  });

  test('accessibility standards are met throughout user journey', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Login page is accessible', async () => {
      await loginPage.navigate();
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true }
        }
      });
    });

    await test.step('Dashboard is accessible', async () => {
      await loginPage.signIn(testUser.email, testUser.password);
      await checkA11y(page);
    });

    await test.step('Interactive elements are keyboard accessible', async () => {
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Verify modal opens
      await expect(page.locator('[data-testid="workspace-create-modal"]')).toBeVisible();
      
      // Test form accessibility
      await checkA11y(page, '[data-testid="workspace-create-modal"]');
    });
  });

  test('performance meets acceptable thresholds', async ({ page }) => {
    await test.step('Page load times are acceptable', async () => {
      const startTime = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // 3 second threshold
    });

    await test.step('AI responses are delivered within acceptable time', async () => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);
      const workspacePage = new WorkspacePage(page);
      
      await loginPage.signIn(testUser.email, testUser.password);
      await dashboardPage.openWorkspace(testWorkspace.name);
      await workspacePage.openAIChat();
      
      const startTime = Date.now();
      await workspacePage.sendChatMessage('Quick test question');
      await workspacePage.expectChatResponse();
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(10000); // 10 second threshold for AI responses
    });
  });
});

/**
 * Key Testing Patterns Demonstrated:
 * 
 * 1. Page Object Model - Encapsulated page interactions
 * 2. Test Data Management - Consistent test data setup
 * 3. Error Scenarios - Testing failure cases and recovery
 * 4. Accessibility Testing - Automated a11y checks
 * 5. Performance Testing - Load time and response time validation
 * 6. Visual Regression - Screenshot comparison capabilities
 * 7. Multi-user Testing - Collaboration scenarios
 * 8. Network Mocking - Controlled API response testing
 * 9. Cleanup and Teardown - Proper test isolation
 * 10. Detailed Reporting - Screenshots and debug info on failure
 * 
 * Best Practices:
 * - Use data-testid attributes for stable selectors
 * - Test complete user workflows, not just individual features
 * - Include both happy path and error scenarios
 * - Verify accessibility throughout the journey
 * - Test performance characteristics
 * - Provide clear test names and step descriptions
 * - Use proper waiting strategies (not arbitrary timeouts)
 * - Clean up test data and state between tests
 */