import { test, expect } from '@playwright/test';

test.describe('Settings Update Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai/costs');
    await page.click('[data-testid="settings-tab"]');
  });

  test('should update monthly budget and save', async ({ page }) => {
    const input = page.locator('[data-testid="monthly-budget-input"]');

    // Update value
    await input.fill('150.00');

    // Save settings
    await page.click('text=Save Settings');

    // Verify success message
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    // Refresh page
    await page.reload();
    await page.click('[data-testid="settings-tab"]');

    // Verify value persisted
    await expect(input).toHaveValue('150.00');
  });

  test('should update daily budget and save', async ({ page }) => {
    const input = page.locator('[data-testid="daily-budget-input"]');

    await input.fill('10.00');
    await page.click('text=Save Settings');

    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    await page.reload();
    await page.click('[data-testid="settings-tab"]');
    await expect(input).toHaveValue('10.00');
  });

  test('should update session budget and save', async ({ page }) => {
    const input = page.locator('[data-testid="session-budget-input"]');

    await input.fill('2.00');
    await page.click('text=Save Settings');

    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    await page.reload();
    await page.click('[data-testid="settings-tab"]');
    await expect(input).toHaveValue('2.00');
  });

  test('should update alert thresholds', async ({ page }) => {
    const warningInput = page.locator('[data-testid="warning-threshold-input"]');
    const criticalInput = page.locator('[data-testid="critical-threshold-input"]');

    await warningInput.fill('0.7');
    await criticalInput.fill('0.9');
    await page.click('text=Save Settings');

    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    await page.reload();
    await page.click('[data-testid="settings-tab"]');
    await expect(warningInput).toHaveValue('0.7');
    await expect(criticalInput).toHaveValue('0.9');
  });

  test('should toggle feature flags', async ({ page }) => {
    const showEstimatesToggle = page.locator('[data-testid="show-estimates-toggle"]');

    // Get initial state
    const wasChecked = await showEstimatesToggle.isChecked();

    // Toggle it
    await showEstimatesToggle.click();
    await page.click('text=Save Settings');

    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    // Verify state changed
    expect(await showEstimatesToggle.isChecked()).toBe(!wasChecked);

    // Refresh and verify persistence
    await page.reload();
    await page.click('[data-testid="settings-tab"]');
    expect(await showEstimatesToggle.isChecked()).toBe(!wasChecked);
  });

  test('should validate negative budget values', async ({ page }) => {
    const input = page.locator('[data-testid="monthly-budget-input"]');

    await input.fill('-50.00');
    await page.click('text=Save Settings');

    // Verify validation error appears
    await expect(page.locator('text=must be positive')).toBeVisible();

    // Verify settings not saved
    await expect(page.locator('text=Settings saved successfully')).not.toBeVisible();
  });

  test('should validate zero budget values', async ({ page }) => {
    const input = page.locator('[data-testid="monthly-budget-input"]');

    await input.fill('0');
    await page.click('text=Save Settings');

    // Verify validation error appears
    await expect(page.locator('text=must be greater than zero')).toBeVisible();
  });

  test('should reset settings to defaults', async ({ page }) => {
    // Change a value
    const input = page.locator('[data-testid="monthly-budget-input"]');
    await input.fill('999.00');
    await page.click('text=Save Settings');
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    // Click reset button
    await page.click('text=Reset to Defaults');

    // Verify confirmation dialog appears
    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.click('text=Confirm');

    // Verify value reset (assuming default is 100)
    await expect(input).toHaveValue('100.00');
  });

  test('should display loading state while saving', async ({ page }) => {
    const input = page.locator('[data-testid="monthly-budget-input"]');
    await input.fill('200.00');

    const saveButton = page.locator('text=Save Settings');
    await saveButton.click();

    // Verify button shows loading state (disabled or spinner)
    await expect(saveButton).toBeDisabled();
    // OR: await expect(page.locator('[data-testid="save-spinner"]')).toBeVisible();

    // Wait for save to complete
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();
    await expect(saveButton).not.toBeDisabled();
  });

  test('should call API with correct settings data', async ({ page }) => {
    // Intercept API call
    await page.route('**/api/ai/costs', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      // Verify request has correct structure
      expect(postData.action).toBe('update_settings');
      expect(postData.settings).toBeDefined();
      expect(postData.settings.budgets).toBeDefined();
      expect(postData.settings.displayPreferences).toBeDefined();

      // Respond with success
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Update settings
    await page.fill('[data-testid="monthly-budget-input"]', '125.00');
    await page.click('text=Save Settings');

    // Verify success message (API was called)
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();
  });
});
