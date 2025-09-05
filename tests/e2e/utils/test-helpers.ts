/**
 * E2E Test Helper utilities
 * Common functions for E2E tests
 */

import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for page to be ready with loading indicators cleared
   */
  async waitForPageReady() {
    // Wait for any loading spinners to disappear
    await this.page.waitForLoadState('networkidle');
    
    // Check for common loading indicators
    const loadingSpinners = this.page.locator('[class*="animate-spin"], [class*="loading"], .spinner');
    await loadingSpinners.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {
      // Loading spinner might not exist, which is fine
    });
  }

  /**
   * Take a screenshot with timestamp
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Check accessibility with axe-core
   */
  async checkAccessibility(options: { tags?: string[] } = {}) {
    // Import AxeBuilder for accessibility testing
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    
    // Run accessibility tests with the page from this class
    const accessibilityScanResults = await new AxeBuilder({ page: this.page as any })
      .withTags(options.tags || ['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Check for violations
    expect(accessibilityScanResults.violations).toEqual([]);
  }

  /**
   * Login with test credentials
   */
  async login(email: string = 'test@vibecode.com', password: string = 'testpass123') {
    // Navigate to login if not already there
    await this.page.goto('/auth/login');
    
    // Fill login form
    await this.page.fill('[name="email"], [type="email"]', email);
    await this.page.fill('[name="password"], [type="password"]', password);
    
    // Submit form
    await this.page.click('[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('/', { timeout: 10000 });
    await this.waitForPageReady();
  }

  /**
   * Logout user
   */
  async logout() {
    // Look for logout button or user menu
    const logoutButton = this.page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]').first();
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await this.page.waitForURL('/auth/login', { timeout: 5000 });
    }
  }

  /**
   * Fill AI prompt and submit
   */
  async submitAIPrompt(prompt: string) {
    const promptInput = this.page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    
    await promptInput.fill(prompt);
    
    // Find and click submit button
    const submitButton = this.page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Submit")').first();
    await submitButton.click();
    
    // Wait for response
    await this.waitForAIResponse();
  }

  /**
   * Wait for AI response to complete
   */
  async waitForAIResponse(timeout: number = 30000) {
    // Wait for loading indicators to disappear
    await this.page.waitForSelector('[class*="generating"], [class*="loading"]', { 
      state: 'hidden', 
      timeout 
    }).catch(() => {
      // Loading indicator might not exist
    });

    // Wait for response content to appear
    await this.page.waitForSelector('[data-testid="ai-response"], .ai-response, .response-content', {
      state: 'visible',
      timeout
    }).catch(() => {
      console.log('AI response content selector not found, continuing...');
    });
  }

  /**
   * Check for error messages
   */
  async checkForErrors() {
    const errorSelectors = [
      '.error-message',
      '[role="alert"]',
      '.alert-error',
      '.text-red-500',
      '.text-destructive'
    ];

    for (const selector of errorSelectors) {
      const errorElements = this.page.locator(selector);
      const count = await errorElements.count();
      
      if (count > 0) {
        const errorText = await errorElements.first().textContent();
        throw new Error(`Error found on page: ${errorText}`);
      }
    }
  }

  /**
   * Monitor network requests for API calls
   */
  async monitorNetworkRequests() {
    const apiRequests: any[] = [];
    
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    this.page.on('response', response => {
      if (response.url().includes('/api/')) {
        const request = apiRequests.find(req => req.url === response.url());
        if (request) {
          request.status = response.status();
          request.responseTime = Date.now() - request.timestamp;
        }
      }
    });

    return apiRequests;
  }

  /**
   * Verify page performance
   */
  async checkPagePerformance() {
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd
      };
    });

    // Assert reasonable performance thresholds
    expect(performanceMetrics.totalTime).toBeLessThan(5000); // 5 seconds max
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // 2 seconds max

    return performanceMetrics;
  }

  // ===== Static compatibility wrappers used by tests =====
  static async waitForPageLoad(page: Page) {
    await page.waitForLoadState('networkidle');
    // Best-effort: wait for common loading indicators to disappear
    await page.locator('[class*="animate-spin"], [class*="loading"], .spinner').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  static async waitForAIResponse(page: Page, timeout: number = 30000) {
    await page.waitForSelector('[class*="generating"], [class*="loading"]', { state: 'hidden', timeout }).catch(() => {});
    await page.waitForSelector('[data-testid="ai-response"], .ai-response, .response-content, [data-testid="ai-message"]', { state: 'visible', timeout }).catch(() => {});
  }

  static async sendChatMessage(page: Page, message: string) {
    const input = page.locator('[data-testid="chat-input"], textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    await input.fill(message);
    const send = page.locator('[data-testid="send-message"], button[type="submit"], button:has-text("Send"), button:has-text("Generate")').first();
    await send.click();
  }

  static async loginAsTestUser(page: Page, _role: string = 'user') {
    // Best-effort UI login; assumes a test user may already exist
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"], [name="email"], [type="email"]', 'test@example.com');
    await page.fill('[data-testid="password-input"], [name="password"], [type="password"]', 'testpassword123');
    await page.click('[data-testid="signin-button"], [type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    await page.waitForURL(/\/?(workspaces|$)/, { timeout: 10000 }).catch(() => {});
    await this.waitForPageLoad(page);
  }

  static async logout(page: Page) {
    const userMenu = page.locator('[data-testid="user-menu"]').first();
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.click('[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign Out")').catch(() => {});
      await page.waitForURL('/auth/signin', { timeout: 5000 }).catch(() => {});
    }
  }

  static async assertNotification(page: Page, text: string) {
    await expect(page.locator('[data-testid="notification"], [role="status"], .toast, .sonner-toast').first()).toContainText(text);
  }

  static async assertErrorMessage(page: Page, text: string) {
    await expect(page.locator('[data-testid="error-message"], [role="alert"], .alert-error, .text-red-500, .text-destructive').first()).toContainText(text);
  }

  static async makeAPIRequest(page: Page, path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers || { 'Content-Type': 'application/json' };
    const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;
    const url = path.startsWith('http') ? path : path.startsWith('/') ? path : `/${path}`;
    switch (method) {
      case 'POST': return page.request.post(url, { headers, data: body });
      case 'PUT': return page.request.put(url, { headers, data: body });
      case 'PATCH': return page.request.patch(url, { headers, data: body });
      case 'DELETE': return page.request.delete(url, { headers });
      default: return page.request.get(url, { headers });
    }
  }

  // NOTE: The following provide minimal stubs to satisfy test compilation.
  // They should be replaced with proper API-backed implementations as needed.
  static async cleanup(): Promise<void> {
    // No-op placeholder; add server/database cleanup if available
  }

  static async createTestUser(user: { email?: string; name?: string }): Promise<{ id: number; email: string; name: string }> {
    // Placeholder: return a mock user
    return {
      id: 1,
      email: user.email || 'test@example.com',
      name: user.name || 'Test User'
    };
  }

  static async createTestWorkspace(_userId: number, workspace: { name?: string; description?: string }): Promise<{ id: number; name: string; description?: string }> {
    // Placeholder: return a mock workspace id
    return {
      id: Math.floor(Math.random() * 10000) + 1,
      name: workspace.name || 'E2E Workspace',
      description: workspace.description
    };
  }

  static async createWorkspaceViaUI(page: Page, name: string, description: string) {
    await page.goto('/workspaces');
    await page.click('[data-testid="create-workspace-button"]');
    await page.fill('[data-testid="workspace-name"]', name);
    await page.fill('[data-testid="workspace-description"]', description);
    await page.click('[data-testid="submit-workspace"]');
    await page.waitForURL(/\/workspaces\/(\d+)/, { timeout: 10000 });
    const match = (await page.url()).match(/\/workspaces\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : Math.floor(Math.random() * 10000) + 1;
    return { id, name, description };
  }
}

/**
 * Create test helpers instance for a page
 */
export function createTestHelpers(page: Page): TestHelpers {
  return new TestHelpers(page);
}

// Default export for compatibility with tests importing default
export default TestHelpers;
