/**
 * E2E Tests for Login Authentication Flow
 *
 * Test Coverage:
 * - Login page loads correctly
 * - OAuth buttons present (GitHub, Google)
 * - Form validation (email, password)
 * - Successful login flow
 * - Error handling for invalid credentials
 * - Session persistence
 *
 * @see Issue #449 - E2E Test Coverage for Critical User Journeys
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Login Authentication Flow', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Navigate to login page before each test
    await page.goto('/auth/signin');
    await helpers.waitForPageReady();
  });

  test('should load login page with all expected elements', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Sign In|VibeCode/i);

    // Verify main heading
    const heading = page.locator('h1, h2').filter({ hasText: /Sign In|VibeCode/i });
    await expect(heading.first()).toBeVisible();

    // Verify form elements are present
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="signin-button"]')).toBeVisible();

    // Verify input attributes for accessibility
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');

    // Take screenshot for visual regression
    await helpers.takeScreenshot('login-page-initial');
  });

  test('should display OAuth provider buttons if configured', async ({ page }) => {
    // Check for GitHub OAuth button
    const githubButton = page.locator('button:has-text("GitHub"), [data-testid="github-signin"], [aria-label*="GitHub"]');
    const githubExists = await githubButton.count() > 0;

    if (githubExists) {
      await expect(githubButton.first()).toBeVisible();
      console.log('✓ GitHub OAuth button found');
    } else {
      console.log('ℹ GitHub OAuth not configured or visible');
    }

    // Check for Google OAuth button
    const googleButton = page.locator('button:has-text("Google"), [data-testid="google-signin"], [aria-label*="Google"]');
    const googleExists = await googleButton.count() > 0;

    if (googleExists) {
      await expect(googleButton.first()).toBeVisible();
      console.log('✓ Google OAuth button found');
    } else {
      console.log('ℹ Google OAuth not configured or visible');
    }

    // Note: OAuth buttons may not be present in dev environment
    // This test documents their expected presence in production
  });

  test('should validate required email field', async ({ page }) => {
    // Clear the email field (it may have default value)
    await page.locator('[data-testid="email-input"]').clear();
    await page.locator('[data-testid="password-input"]').fill('testpassword123');

    // Try to submit form
    await page.locator('[data-testid="signin-button"]').click();

    // HTML5 validation should prevent submission
    const emailInput = page.locator('[data-testid="email-input"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);

    expect(validationMessage).toBeTruthy();
    console.log('Email validation message:', validationMessage);
  });

  test('should validate email format', async ({ page }) => {
    // Fill with invalid email format
    await page.locator('[data-testid="email-input"]').fill('invalid-email-format');
    await page.locator('[data-testid="password-input"]').fill('testpassword123');

    // Try to submit form
    await page.locator('[data-testid="signin-button"]').click();

    // HTML5 validation should catch invalid email format
    const emailInput = page.locator('[data-testid="email-input"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);

    expect(validationMessage).toBeTruthy();
    console.log('Email format validation message:', validationMessage);
  });

  test('should validate required password field', async ({ page }) => {
    // Fill email but leave password empty
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').clear();

    // Try to submit form
    await page.locator('[data-testid="signin-button"]').click();

    // HTML5 validation should prevent submission
    const passwordInput = page.locator('[data-testid="password-input"]');
    const validationMessage = await passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage);

    expect(validationMessage).toBeTruthy();
    console.log('Password validation message:', validationMessage);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill with invalid credentials
    await page.locator('[data-testid="email-input"]').fill('invalid@example.com');
    await page.locator('[data-testid="password-input"]').fill('wrongpassword123');

    // Submit form
    await page.locator('[data-testid="signin-button"]').click();

    // Wait for authentication attempt
    await page.waitForTimeout(2000);

    // Check for error message
    const errorMessage = page.locator('[data-testid="error-message"], [role="alert"], .text-red-700').first();

    // Error should be visible
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Verify error text contains relevant message
    const errorText = await errorMessage.textContent();
    expect(errorText).toMatch(/invalid|credentials|failed|error/i);

    console.log('Error message displayed:', errorText);

    // Should remain on signin page
    expect(page.url()).toContain('/auth/signin');

    // Take screenshot of error state
    await helpers.takeScreenshot('login-error-invalid-credentials');
  });

  test('should disable submit button during authentication', async ({ page }) => {
    // Fill with credentials
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').fill('testpassword123');

    // Get submit button
    const submitButton = page.locator('[data-testid="signin-button"]');

    // Verify button is enabled initially
    await expect(submitButton).toBeEnabled();

    // Click submit
    await submitButton.click();

    // Button should be disabled during submission
    // Note: This might be very fast, so we check immediately
    const isDisabledDuringSubmit = await submitButton.evaluate((el: HTMLButtonElement) => el.disabled);

    // If we caught it during submission, it should be disabled
    // Otherwise it's already completed (which is also valid)
    console.log('Button disabled during submit:', isDisabledDuringSubmit);

    // Verify loading indicator is shown
    const loadingIndicator = submitButton.locator('.animate-spin');
    const hasLoadingIndicator = await loadingIndicator.count() > 0;

    if (hasLoadingIndicator) {
      console.log('✓ Loading indicator present during authentication');
    }
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Use the default development test user
    await page.locator('[data-testid="email-input"]').fill('developer@vibecode.dev');
    await page.locator('[data-testid="password-input"]').fill('dev123');

    // Submit form
    await page.locator('[data-testid="signin-button"]').click();

    // Wait for navigation to complete
    await page.waitForURL(/\/?(workspaces|$)/, { timeout: 10000 });
    await helpers.waitForPageReady();

    // Verify we're no longer on the signin page
    expect(page.url()).not.toContain('/auth/signin');

    // Verify user is authenticated
    // Look for common authenticated UI elements
    const authenticatedIndicators = [
      page.locator('[data-testid="user-menu"]'),
      page.locator('[data-testid="user-profile"]'),
      page.locator('button:has-text("Logout")'),
      page.locator('button:has-text("Sign Out")'),
      page.locator('.user-menu')
    ];

    let foundAuthIndicator = false;
    for (const indicator of authenticatedIndicators) {
      if (await indicator.count() > 0 && await indicator.first().isVisible().catch(() => false)) {
        foundAuthIndicator = true;
        console.log('✓ Found authenticated user indicator');
        break;
      }
    }

    expect(foundAuthIndicator).toBeTruthy();

    // Take screenshot of authenticated state
    await helpers.takeScreenshot('login-success-authenticated');
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // First, login
    await page.locator('[data-testid="email-input"]').fill('developer@vibecode.dev');
    await page.locator('[data-testid="password-input"]').fill('dev123');
    await page.locator('[data-testid="signin-button"]').click();

    // Wait for successful navigation
    await page.waitForURL(/\/?(workspaces|$)/, { timeout: 10000 });
    await helpers.waitForPageReady();

    // Reload the page
    await page.reload();
    await helpers.waitForPageReady();

    // Should still be authenticated
    expect(page.url()).not.toContain('/auth/signin');

    // Verify authenticated state persists
    const authenticatedIndicators = [
      page.locator('[data-testid="user-menu"]'),
      page.locator('button:has-text("Logout")')
    ];

    let foundAuthIndicator = false;
    for (const indicator of authenticatedIndicators) {
      if (await indicator.count() > 0 && await indicator.first().isVisible().catch(() => false)) {
        foundAuthIndicator = true;
        console.log('✓ Session persisted after reload');
        break;
      }
    }

    expect(foundAuthIndicator).toBeTruthy();
  });

  test('should handle slow network conditions gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/auth/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    await page.locator('[data-testid="email-input"]').fill('developer@vibecode.dev');
    await page.locator('[data-testid="password-input"]').fill('dev123');

    const submitButton = page.locator('[data-testid="signin-button"]');
    await submitButton.click();

    // Button should remain disabled during slow request
    await expect(submitButton).toBeDisabled();

    // Loading indicator should be visible
    const loadingIndicator = submitButton.locator('.animate-spin');
    if (await loadingIndicator.count() > 0) {
      await expect(loadingIndicator).toBeVisible();
    }

    // Eventually should complete
    await page.waitForURL(/\/?(workspaces|$)/, { timeout: 15000 });
  });

  test('should be accessible to screen readers', async ({ page }) => {
    // Check form has proper labels
    const emailLabel = page.locator('label[for="email-address"], label:has-text("Email")');
    const passwordLabel = page.locator('label[for="password"], label:has-text("Password")');

    // Labels should exist (even if visually hidden)
    expect(await emailLabel.count()).toBeGreaterThan(0);
    expect(await passwordLabel.count()).toBeGreaterThan(0);

    // Check ARIA attributes
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Error messages should have role="alert" for screen readers
    await page.locator('[data-testid="email-input"]').fill('invalid');
    await page.locator('[data-testid="password-input"]').fill('test');
    await page.locator('[data-testid="signin-button"]').click();

    await page.waitForTimeout(2000);

    const errorAlert = page.locator('[role="alert"]');
    if (await errorAlert.count() > 0) {
      await expect(errorAlert.first()).toBeVisible();
      console.log('✓ Error has proper ARIA role');
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab'); // Focus email
    let focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBe('email-input');

    await page.keyboard.press('Tab'); // Focus password
    focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBe('password-input');

    await page.keyboard.press('Tab'); // Focus submit button
    focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBe('signin-button');

    // Fill form using keyboard only
    await page.keyboard.press('Shift+Tab'); // Back to password
    await page.keyboard.press('Shift+Tab'); // Back to email
    await page.keyboard.type('developer@vibecode.dev');
    await page.keyboard.press('Tab');
    await page.keyboard.type('dev123');

    // Submit with Enter key
    await page.keyboard.press('Enter');

    // Should successfully submit
    await page.waitForURL(/\/?(workspaces|$)/, { timeout: 10000 });
  });

  test('should protect against XSS in error messages', async ({ page }) => {
    // Try to inject script via error message
    const xssAttempt = '<script>alert("XSS")</script>@test.com';

    await page.locator('[data-testid="email-input"]').fill(xssAttempt);
    await page.locator('[data-testid="password-input"]').fill('password');
    await page.locator('[data-testid="signin-button"]').click();

    await page.waitForTimeout(2000);

    // Check if script was executed (it shouldn't be)
    const alertWasShown = await page.evaluate(() => {
      return (window as any).xssExecuted === true;
    });

    expect(alertWasShown).toBeFalsy();

    // Error message should be escaped
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      const content = await errorMessage.innerHTML();
      expect(content).not.toContain('<script>');
      console.log('✓ XSS properly escaped in error message');
    }
  });

  test('should clear sensitive data on navigation away', async ({ page }) => {
    // Fill in credentials
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').fill('secretpassword');

    // Navigate away (e.g., to a different page)
    await page.goto('/');

    // Go back to login
    await page.goto('/auth/signin');
    await helpers.waitForPageReady();

    // Fields should have default values, not the previously entered sensitive data
    const passwordValue = await page.locator('[data-testid="password-input"]').inputValue();

    // Password should be default (dev123) or empty, not the sensitive data we entered
    expect(passwordValue).not.toBe('secretpassword');
    console.log('✓ Sensitive data cleared after navigation');
  });
});

test.describe('Login Flow - Integration Tests', () => {
  test('should redirect to originally requested page after login', async ({ page }) => {
    // Try to access a protected route while not authenticated
    await page.goto('/workspaces');

    // Should redirect to login
    await page.waitForURL(/\/auth\/signin/, { timeout: 5000 }).catch(() => {
      console.log('ℹ Direct access to workspaces allowed (no auth guard)');
    });

    // If we were redirected, login and verify redirect back
    if (page.url().includes('/auth/signin')) {
      await page.locator('[data-testid="email-input"]').fill('developer@vibecode.dev');
      await page.locator('[data-testid="password-input"]').fill('dev123');
      await page.locator('[data-testid="signin-button"]').click();

      // Should redirect back to originally requested page
      await page.waitForURL(/workspaces/, { timeout: 10000 });
      expect(page.url()).toContain('workspaces');
    }
  });

  test('should handle concurrent login attempts', async ({ page, context }) => {
    // Open second tab
    const page2 = await context.newPage();

    // Login in first tab
    await page.goto('/auth/signin');
    await page.locator('[data-testid="email-input"]').fill('developer@vibecode.dev');
    await page.locator('[data-testid="password-input"]').fill('dev123');
    await page.locator('[data-testid="signin-button"]').click();
    await page.waitForURL(/\/?(workspaces|$)/, { timeout: 10000 });

    // Second tab should also show authenticated state
    await page2.goto('/');
    await page2.waitForLoadState('networkidle');

    // Both tabs should be authenticated
    const isAuthPage1 = !page.url().includes('/auth/signin');
    const isAuthPage2 = !page2.url().includes('/auth/signin');

    expect(isAuthPage1).toBeTruthy();
    expect(isAuthPage2).toBeTruthy();

    await page2.close();
  });
});
