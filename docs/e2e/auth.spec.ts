import { test, expect } from '@playwright/test';

test.describe('Local Authentication Flow', () => {
  test('should allow a user to sign in on the local development server', async ({ page }) => {
    // Step 1: Navigate to the local sign-in page
    // The baseURL is 'http://localhost:3000' from playwright.config.ts
    await page.goto('/auth/signin');

    // Step 2: Verify the sign-in page has loaded
    await expect(page.locator('h1')).toContainText('Sign In');

    // Step 3: Enter development credentials
    await page.locator('input[name="email"]').fill('developer@vibecode.dev');
    await page.locator('input[name="password"]').fill('dev123');
    await page.locator('button[type="submit"]').click();

    // Step 4: Verify successful login and redirection to the dashboard
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
