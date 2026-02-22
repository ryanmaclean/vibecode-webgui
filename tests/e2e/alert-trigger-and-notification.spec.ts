import { test, expect } from '@playwright/test';

test.describe('Alert Triggering and Notification Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai/costs');
    // Clear any existing alerts
    // You may need to add a reset endpoint or use localStorage.clear()
  });

  test('should create session alert via UI', async ({ page }) => {
    // Navigate to Alerts tab
    await page.click('[data-testid="alerts-tab"]');

    // Click Create Alert button
    await page.click('text=Create Alert');

    // Verify dialog opened
    await expect(page.locator('text=Create Cost Alert')).toBeVisible();

    // Fill alert form
    await page.selectOption('[data-testid="alert-type"]', 'session');
    await page.fill('[data-testid="alert-threshold"]', '0.50');
    await page.selectOption('[data-testid="alert-severity"]', 'warning');

    // Create alert
    await page.click('text=Create Alert');

    // Verify alert appears in list
    await expect(page.locator('[data-testid="alert-list"]')).toContainText('Session');
    await expect(page.locator('[data-testid="alert-list"]')).toContainText('$0.50');
  });

  test('should trigger alert when session budget exceeded', async ({ page }) => {
    // Create low threshold alert (easy to trigger)
    await page.click('[data-testid="alerts-tab"]');
    await page.click('text=Create Alert');
    await page.selectOption('[data-testid="alert-type"]', 'session');
    await page.fill('[data-testid="alert-threshold"]', '0.001'); // Very low threshold
    await page.selectOption('[data-testid="alert-severity"]', 'critical');
    await page.click('text=Create Alert');

    // Send message to trigger alert
    await page.goto('/ai/chat');
    await page.fill('[data-testid="chat-input"]', 'Trigger the cost alert');
    await page.click('[data-testid="send-button"]');

    // Wait for AI response (which triggers usage recording)
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Verify toast notification appears
    const toast = page.locator('[data-testid="cost-alert-toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('Session'); // Alert type
  });

  test('should display toast with severity styling', async ({ page }) => {
    // Assuming alert triggered from previous test
    // Create critical alert
    await page.goto('/ai/costs');
    await page.click('[data-testid="alerts-tab"]');
    await page.click('text=Create Alert');
    await page.selectOption('[data-testid="alert-type"]', 'session');
    await page.fill('[data-testid="alert-threshold"]', '0.001');
    await page.selectOption('[data-testid="alert-severity"]', 'critical');
    await page.click('text=Create Alert');

    // Trigger alert
    await page.goto('/ai/chat');
    await page.fill('[data-testid="chat-input"]', 'Test');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Verify critical toast has red styling
    const toast = page.locator('[data-testid="cost-alert-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/border-red/);
  });

  test('should auto-dismiss toast after 10 seconds', async ({ page }) => {
    // Create and trigger alert
    await page.goto('/ai/costs');
    await page.click('[data-testid="alerts-tab"]');
    await page.click('text=Create Alert');
    await page.selectOption('[data-testid="alert-type"]', 'session');
    await page.fill('[data-testid="alert-threshold"]', '0.001');
    await page.click('text=Create Alert');

    await page.goto('/ai/chat');
    await page.fill('[data-testid="chat-input"]', 'Test');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Verify toast appears
    const toast = page.locator('[data-testid="cost-alert-toast"]');
    await expect(toast).toBeVisible();

    // Wait 10 seconds
    await page.waitForTimeout(10000);

    // Verify toast is gone
    await expect(toast).not.toBeVisible();
  });

  test('should acknowledge alert and dismiss toast', async ({ page }) => {
    // Create and trigger alert
    await page.goto('/ai/costs');
    await page.click('[data-testid="alerts-tab"]');
    await page.click('text=Create Alert');
    await page.selectOption('[data-testid="alert-type"]', 'session');
    await page.fill('[data-testid="alert-threshold"]', '0.001');
    await page.click('text=Create Alert');

    await page.goto('/ai/chat');
    await page.fill('[data-testid="chat-input"]', 'Test');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Click acknowledge button
    await page.click('[data-testid="acknowledge-alert-button"]');

    // Verify toast dismisses
    await expect(page.locator('[data-testid="cost-alert-toast"]')).not.toBeVisible();

    // Verify alert status updated in dashboard
    await page.goto('/ai/costs');
    await page.click('[data-testid="alerts-tab"]');
    await expect(page.locator('[data-testid="alert-list"]')).not.toContainText('Triggered');
  });

  test('should show alert as triggered in dashboard', async ({ page }) => {
    // Create and trigger alert
    await page.goto('/ai/costs');
    await page.click('[data-testid="alerts-tab"]');
    await page.click('text=Create Alert');
    await page.selectOption('[data-testid="alert-type"]', 'session');
    await page.fill('[data-testid="alert-threshold"]', '0.001');
    await page.click('text=Create Alert');

    await page.goto('/ai/chat');
    await page.fill('[data-testid="chat-input"]', 'Test');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Navigate to dashboard
    await page.goto('/ai/costs');
    await page.click('[data-testid="alerts-tab"]');

    // Verify alert shows as triggered with red styling
    const alertItem = page.locator('[data-testid="alert-list"] > div').first();
    await expect(alertItem).toHaveClass(/border-red/);
    await expect(alertItem).toHaveClass(/bg-red/);
  });
});
