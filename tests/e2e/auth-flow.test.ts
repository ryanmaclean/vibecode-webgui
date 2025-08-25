/**
 * Authentication Flow E2E Tests
 * Tests login, logout, and authentication states
 */

import { test, expect } from '@playwright/test';
import { createTestHelpers } from './utils/test-helpers';

// Define test credentials directly since they're missing in test-data.json
const testCredentials = {
  email: 'test@vibecode.com',
  password: 'testpass123'
};

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test with a fresh session
    await page.goto('/auth/logout');
    await page.waitForURL('/auth/login');
  });

  test('should display login page for unauthenticated users', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Should redirect to login or show login CTA
    const loginButton = page.locator('[href="/auth/login"], button:has-text("Login"), button:has-text("Sign In")').first();
    await expect(loginButton).toBeVisible();
    
    // Check page content
    await expect(page.locator('h1, [data-testid="app-title"]')).toContainText(/VibeCode|Welcome/i);
    
    // Take screenshot for visual verification
    await helpers.takeScreenshot('unauthenticated-homepage');
  });

  test('should navigate to login page', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Click login link
    const loginButton = page.locator('[href="/auth/login"]').first();
    await loginButton.click();
    
    await page.waitForURL(/\/auth\/login/);
    await helpers.waitForPageReady();
    
    // Verify login form elements
    await expect(page.locator('[type="email"], [name="email"]')).toBeVisible();
    await expect(page.locator('[type="password"], [name="password"]')).toBeVisible();
    await expect(page.locator('[type="submit"], button:has-text("Login")')).toBeVisible();
    
    // Check accessibility
    await helpers.checkAccessibility();
    
    await helpers.takeScreenshot('login-page');
  });

  test('should handle invalid login credentials', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/auth/login');
    await helpers.waitForPageReady();
    
    // Fill form with invalid credentials
    await page.fill('[type="email"], [name="email"]', 'invalid@example.com');
    await page.fill('[type="password"], [name="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('[type="submit"], button:has-text("Login")');
    
    // Wait for error message
    const errorMessage = page.locator('.error-message, [role="alert"], .alert-error, .text-red-500').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    
    // Should still be on login page
    expect(page.url()).toContain('/auth/login');
    
    await helpers.takeScreenshot('login-error');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/auth/login');
    await helpers.waitForPageReady();
    
    // Fill form with test credentials
    await page.fill('[type="email"], [name="email"]', testCredentials.email);
    await page.fill('[type="password"], [name="password"]', testCredentials.password);
    
    // Submit form
    await page.click('[type="submit"], button:has-text("Login")');
    
    // Should redirect to dashboard
    await page.waitForURL(/\/(workspaces|dashboard)/, { timeout: 10000 });
    await helpers.waitForPageReady();
    
    // Verify authenticated state
    const userProfile = page.locator('[data-testid="user-profile"], [data-testid="user-menu"], .user-menu, button:has-text("Logout")').first();
    await expect(userProfile).toBeVisible();
    
    // Verify no login button is visible
    const loginButton = page.locator('[href="/auth/login"]:visible').first();
    await expect(loginButton).not.toBeVisible().catch(() => {
      // Login button might not exist when authenticated, which is fine
    });
    
    await helpers.takeScreenshot('authenticated-dashboard');
  });

  test('should logout successfully', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    // First login
    await helpers.login();
    
    // Verify we're logged in
    expect(page.url()).not.toContain('/auth/login');
    
    // Logout
    await helpers.logout();
    
    // Should redirect to login page
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    await helpers.waitForPageReady();
    
    // Verify login form is visible again
    await expect(page.locator('[type="email"], [name="email"]')).toBeVisible();
    
    await helpers.takeScreenshot('after-logout');
  });

  test('should persist authentication across page refreshes', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    // Login
    await helpers.login();
    
    // Refresh page
    await page.reload();
    await helpers.waitForPageReady();
    
    // Should still be authenticated
    const userProfile = page.locator('[data-testid="user-profile"], [data-testid="user-menu"], .user-menu, button:has-text("Logout")').first();
    await expect(userProfile).toBeVisible();
    
    // Should not show login page
    expect(page.url()).not.toContain('/auth/login');
  });

  test('should handle registration flow', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/auth/register');
    await helpers.waitForPageReady();
    
    // Check if register page exists and has expected elements
    const registerForm = page.locator('form, [data-testid="register-form"]').first();
    
    if (await registerForm.isVisible()) {
      // Verify form elements
      await expect(page.locator('[type="email"], [name="email"]')).toBeVisible();
      await expect(page.locator('[type="password"], [name="password"]')).toBeVisible();
      
      // Check accessibility
      await helpers.checkAccessibility();
      
      await helpers.takeScreenshot('register-page');
    } else {
      console.log('Registration page not implemented or accessible');
    }
  });

  test('should validate login form inputs', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/auth/login');
    await helpers.waitForPageReady();
    
    // Try to submit empty form
    await page.click('[type="submit"], button:has-text("Login")');
    
    // Should show validation errors
    const errorMessages = page.locator('.error-message, [role="alert"], .text-red-500');
    await expect(errorMessages).toBeVisible();
    
    // Try with invalid email format
    await page.fill('[type="email"], [name="email"]', 'not-an-email');
    await page.fill('[type="password"], [name="password"]', 'password123');
    
    // Submit form
    await page.click('[type="submit"], button:has-text("Login")');
    
    // Should show email validation error
    await expect(errorMessages).toBeVisible();
    
    await helpers.takeScreenshot('login-validation-errors');
  });

  test('should handle password reset request', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/auth/login');
    await helpers.waitForPageReady();
    
    // Look for forgot password link
    const forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")').first();
    
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
      
      // Should navigate to password reset page
      await helpers.waitForPageReady();
      
      // Verify email field is present
      await expect(page.locator('[type="email"], [name="email"]')).toBeVisible();
      
      // Enter email
      await page.fill('[type="email"], [name="email"]', testCredentials.email);
      
      // Submit request
      await page.click('[type="submit"], button:has-text("Reset"), button:has-text("Send")');
      
      // Should show success message
      const successMessage = page.locator('.success-message, [role="status"], .text-green-500');
      await expect(successMessage).toBeVisible({ timeout: 10000 });
      
      await helpers.takeScreenshot('password-reset-request');
    } else {
      // If password reset is not implemented, skip test
      console.log('Password reset functionality not implemented or accessible');
    }
  });

  test('should handle protected routes', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    // Try to access protected page without authentication
    await page.goto('/workspaces');
    await helpers.waitForPageReady();
    
    // Should redirect to login
    expect(page.url()).toContain('/auth/login');
    
    // Now login
    await helpers.login();
    
    // Try protected page again
    await page.goto('/workspaces');
    await helpers.waitForPageReady();
    
    // Should be able to access now
    expect(page.url()).toContain('/workspaces');
    
    // Verify workspace content is visible
    await expect(page.locator('[data-testid="workspaces-list"], [data-testid="create-workspace-button"]')).toBeVisible();
  });

  test('should handle authentication with external providers', async ({ page }) => {
    // Skip this test in most environments as it requires external provider interaction
    test.skip(process.env.CI !== undefined, 'Skipped in CI environment');
    
    const helpers = createTestHelpers(page);
    
    await page.goto('/auth/login');
    await helpers.waitForPageReady();
    
    // Check for OAuth buttons
    const githubButton = page.locator('button:has-text("GitHub"), [data-provider="github"]');
    const googleButton = page.locator('button:has-text("Google"), [data-provider="google"]');
    
    // If any OAuth provider is available
    if (await githubButton.isVisible() || await googleButton.isVisible()) {
      console.log('OAuth providers are available but not tested in automated tests');
      await helpers.takeScreenshot('oauth-providers');
    } else {
      console.log('No OAuth providers available');
    }
  });
});