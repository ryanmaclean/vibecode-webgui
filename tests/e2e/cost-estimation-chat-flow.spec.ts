import { test, expect } from '@playwright/test';

test.describe('Cost Estimation Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai/chat');
    // Add any necessary auth/setup
  });

  test('should display inline cost estimate when typing message', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Test message to estimate cost');

    // Verify cost estimator appears
    const estimator = page.locator('[data-testid="cost-estimator"]');
    await expect(estimator).toBeVisible();

    // Verify it shows a cost value
    await expect(estimator).toContainText('$');
  });

  test('should show confirmation dialog for expensive requests over 500 tokens', async ({ page }) => {
    // Create a message with >500 tokens (approximately 200 words)
    const longMessage = 'word '.repeat(200);

    const input = page.locator('[data-testid="chat-input"]');
    await input.fill(longMessage);

    const sendButton = page.locator('[data-testid="send-button"]');
    await sendButton.click();

    // Verify confirmation dialog appears
    await expect(page.locator('text=Confirm Expensive Request')).toBeVisible();
    await expect(page.locator('text=more than 500 tokens')).toBeVisible();

    // Verify dialog has model info and cost estimate
    await expect(page.locator('[data-testid="model-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="cost-estimator"]')).toBeVisible();

    // Verify Cancel button works
    await page.click('text=Cancel');
    await expect(page.locator('text=Confirm Expensive Request')).not.toBeVisible();
  });

  test('should send message when confirmed in expensive request dialog', async ({ page }) => {
    const longMessage = 'word '.repeat(200);

    await page.fill('[data-testid="chat-input"]', longMessage);
    await page.click('[data-testid="send-button"]');

    // Confirm the expensive request
    await page.click('text=Send Anyway');

    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText(longMessage.substring(0, 50));
  });

  test('should record usage after AI response received', async ({ page }) => {
    // Send a simple message
    await page.fill('[data-testid="chat-input"]', 'Hello AI, how are you?');
    await page.click('[data-testid="send-button"]');

    // Wait for AI response
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Navigate to cost dashboard
    await page.goto('/ai/costs');

    // Verify session cost is greater than 0
    const sessionCost = page.locator('[data-testid="session-cost"]');
    await expect(sessionCost).toBeVisible();

    const costText = await sessionCost.textContent();
    const cost = parseFloat(costText.replace('$', '').replace(',', ''));
    expect(cost).toBeGreaterThan(0);
  });

  test('should show correct model in cost breakdown', async ({ page }) => {
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible({ timeout: 30000 });

    // Navigate to cost dashboard Models tab
    await page.goto('/ai/costs');
    await page.click('[data-testid="models-tab"]');

    // Verify model appears in breakdown
    await expect(page.locator('[data-testid="model-breakdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="model-breakdown"]')).toContainText('gpt'); // or whatever default model
  });
});
