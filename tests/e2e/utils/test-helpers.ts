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
    const { injectAxe, checkA11y } = await import('@axe-core/playwright');
    
    await injectAxe(this.page);
    await checkA11y(this.page, undefined, {
      tags: options.tags || ['wcag2a', 'wcag2aa'],
      reporter: 'v2'
    });
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
        totalTime: navigation.loadEventEnd - navigation.navigationStart
      };
    });

    // Assert reasonable performance thresholds
    expect(performanceMetrics.totalTime).toBeLessThan(5000); // 5 seconds max
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // 2 seconds max

    return performanceMetrics;
  }
}

/**
 * Create test helpers instance for a page
 */
export function createTestHelpers(page: Page): TestHelpers {
  return new TestHelpers(page);
}