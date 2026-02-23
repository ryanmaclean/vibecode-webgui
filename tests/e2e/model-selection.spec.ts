import { test, expect } from '@playwright/test';

test.describe('Model Selection E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to chat page before each test
    await page.goto('/chat');
  });

  test('should display model selector with default model selected', async ({ page }) => {
    // Verify model selector is visible
    const modelSelector = page.locator('button:has-text("AI Model")').locator('..');
    await expect(modelSelector).toBeVisible();

    // Verify default model is displayed (Claude 3.5 Sonnet)
    await expect(page.locator('button').filter({ hasText: 'Claude' })).toBeVisible();
  });

  test('should open model dropdown when clicking model selector', async ({ page }) => {
    // Click the model selector button
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Verify dropdown is opened with search input
    await expect(page.locator('input[placeholder="Search models..."]')).toBeVisible();

    // Verify quick filters are visible
    await expect(page.locator('button:has-text("Best for Coding")')).toBeVisible();
    await expect(page.locator('button:has-text("Best Value")')).toBeVisible();
    await expect(page.locator('button:has-text("Fastest")')).toBeVisible();
  });

  test('should close model dropdown when clicking outside', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    await expect(page.locator('input[placeholder="Search models..."]')).toBeVisible();

    // Click outside (on page title)
    await page.locator('h2:has-text("AI Chat")').click();

    // Verify dropdown is closed
    await expect(page.locator('input[placeholder="Search models..."]')).not.toBeVisible();
  });

  test('should close model dropdown when pressing Escape', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    await expect(page.locator('input[placeholder="Search models..."]')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify dropdown is closed
    await expect(page.locator('input[placeholder="Search models..."]')).not.toBeVisible();
  });

  test('should search for models by name', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Search for GPT models
    const searchInput = page.locator('input[placeholder="Search models..."]');
    await searchInput.fill('GPT');

    // Wait for search results to update
    await page.waitForTimeout(300);

    // Verify GPT models are visible and Claude models are filtered out
    await expect(page.locator('text=GPT-4')).toBeVisible();

    // Verify model count updates
    await expect(page.locator('text=/\\d+ models/')).toBeVisible();
  });

  test('should clear search when clicking X button', async ({ page }) => {
    // Open dropdown and search
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    const searchInput = page.locator('input[placeholder="Search models..."]');
    await searchInput.fill('GPT');

    // Click clear button
    await page.locator('button').filter({ has: page.locator('svg') }).nth(1).click();

    // Verify search is cleared
    await expect(searchInput).toHaveValue('');
  });

  test('should apply quick filter for "Best for Coding"', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Click "Best for Coding" quick filter
    await page.locator('button:has-text("Best for Coding")').click();

    // Verify filter is active (button should be highlighted)
    const codingFilter = page.locator('button:has-text("Best for Coding")');
    await expect(codingFilter).toHaveClass(/bg-blue-500/);

    // Verify clear filter button appears
    await expect(page.locator('button:has-text("Clear")')).toBeVisible();
  });

  test('should apply quick filter for "Best Value"', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Click "Best Value" quick filter
    await page.locator('button:has-text("Best Value")').click();

    // Verify filter is active
    const valueFilter = page.locator('button:has-text("Best Value")');
    await expect(valueFilter).toHaveClass(/bg-blue-500/);

    // Verify filtered results show models with good value
    await expect(page.locator('text=/\\d+ models/')).toBeVisible();
  });

  test('should apply quick filter for "Fastest"', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Click "Fastest" quick filter
    await page.locator('button:has-text("Fastest")').click();

    // Verify filter is active
    const fastestFilter = page.locator('button:has-text("Fastest")');
    await expect(fastestFilter).toHaveClass(/bg-blue-500/);
  });

  test('should clear active quick filter', async ({ page }) => {
    // Open dropdown and apply filter
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    await page.locator('button:has-text("Best for Coding")').click();

    // Click clear button
    await page.locator('button:has-text("Clear")').click();

    // Verify filter is cleared
    const codingFilter = page.locator('button:has-text("Best for Coding")');
    await expect(codingFilter).not.toHaveClass(/bg-blue-500/);
    await expect(page.locator('button:has-text("Clear")')).not.toBeVisible();
  });

  test('should toggle advanced filters panel', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Click "More filters" button
    await page.locator('button:has-text("More filters")').click();

    // Verify advanced filters are visible
    await expect(page.locator('text=Min Quality')).toBeVisible();
    await expect(page.locator('text=Min Speed')).toBeVisible();
    await expect(page.locator('text=Vision')).toBeVisible();
    await expect(page.locator('text=Function Calling')).toBeVisible();

    // Hide filters again
    await page.locator('button:has-text("More filters")').click();

    // Verify filters are hidden
    await expect(page.locator('text=Min Quality')).not.toBeVisible();
  });

  test('should expand and collapse provider groups', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Find a provider group (e.g., OpenAI)
    const openaiGroup = page.locator('button:has-text("OpenAI")').first();

    // Expand the group
    await openaiGroup.click();

    // Verify chevron indicates expanded state and models are visible
    await expect(page.locator('text=GPT-4').first()).toBeVisible();

    // Collapse the group
    await openaiGroup.click();

    // Verify models are hidden
    await expect(page.locator('text=GPT-4').first()).not.toBeVisible({ timeout: 2000 });
  });

  test('should select a different model from dropdown', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Search for a specific model
    await page.locator('input[placeholder="Search models..."]').fill('GPT-4');
    await page.waitForTimeout(300);

    // Expand provider group if needed and click a model
    const gpt4Model = page.locator('text=GPT-4').first();
    await gpt4Model.click();

    // Verify dropdown closes
    await expect(page.locator('input[placeholder="Search models..."]')).not.toBeVisible();

    // Verify selected model is displayed
    await expect(page.locator('button').filter({ hasText: 'GPT-4' })).toBeVisible();
  });

  test('should toggle favorite on a model', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Search for a model
    await page.locator('input[placeholder="Search models..."]').fill('GPT-4');
    await page.waitForTimeout(300);

    // Find and click the star icon for favoriting
    const favoriteButton = page.locator('button[aria-label*="favorite"]').first();
    await favoriteButton.click();

    // Close and reopen dropdown
    await page.keyboard.press('Escape');
    await page.locator('button').filter({ hasText: 'GPT' }).click();

    // Verify "Favorites" group exists
    await expect(page.locator('text=Favorites')).toBeVisible();
  });

  test('should disable model selector when sending message', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    const modelSelectorButton = page.locator('button').filter({ hasText: 'Claude' });

    // Send a message
    await messageInput.fill('Test message');
    await sendButton.click();

    // Verify model selector is disabled during sending
    await expect(modelSelectorButton).toBeDisabled();

    // Wait for response to complete
    await expect(page.locator('[data-testid="message-assistant"]').or(
      page.locator('[data-testid="streaming-indicator"]')
    )).toBeVisible({ timeout: 10000 });

    // Verify model selector is re-enabled after response
    await expect(modelSelectorButton).not.toBeDisabled({ timeout: 30000 });
  });

  test('should show model name in message metadata', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Send a message
    await messageInput.fill('What is AI?');
    await sendButton.click();

    // Wait for assistant response
    await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 30000 });

    // Verify model name appears in the assistant message metadata
    const assistantMessage = page.locator('[data-testid="message-assistant"]').first();
    await expect(assistantMessage).toContainText(/Claude|GPT/);
  });

  test('should persist model selection across messages', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Change model
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    await page.locator('input[placeholder="Search models..."]').fill('GPT-4');
    await page.waitForTimeout(300);
    const gpt4Model = page.locator('text=GPT-4').first();
    await gpt4Model.click();

    // Verify selection
    await expect(page.locator('button').filter({ hasText: 'GPT-4' })).toBeVisible();

    // Send first message
    await messageInput.fill('First message');
    await sendButton.click();
    await expect(page.locator('[data-testid="message-user"]').first()).toBeVisible({ timeout: 5000 });

    // Wait a bit
    await page.waitForTimeout(1000);

    // Verify model is still GPT-4
    await expect(page.locator('button').filter({ hasText: 'GPT-4' })).toBeVisible();

    // Send second message
    await messageInput.fill('Second message');
    await sendButton.click();

    // Verify model persists
    await expect(page.locator('button').filter({ hasText: 'GPT-4' })).toBeVisible();
  });

  test('should add selected model to recent models', async ({ page }) => {
    // Select a model
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    await page.locator('input[placeholder="Search models..."]').fill('GPT-4');
    await page.waitForTimeout(300);
    const gpt4Model = page.locator('text=GPT-4').first();
    await gpt4Model.click();

    // Reopen dropdown
    await page.locator('button').filter({ hasText: 'GPT-4' }).click();

    // Verify "Recent" group exists with the model
    await expect(page.locator('text=Recent')).toBeVisible();
  });

  test('should show model details in dropdown when available', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Expand a provider group
    await page.locator('button:has-text("Anthropic")').first().click();

    // Verify model details are visible (badges for quality, speed, context, pricing)
    await expect(page.locator('text=/excellent|good|state of art/i').first()).toBeVisible();
  });

  test('should display model count in dropdown', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Verify model count is displayed
    await expect(page.locator('text=/\\d+ models/')).toBeVisible();

    // Apply a filter and verify count updates
    await page.locator('button:has-text("Best for Coding")').click();
    await expect(page.locator('text=/\\d+ models/')).toBeVisible();
  });

  test('should show "No models found" when search has no results', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Search for something that doesn\'t exist
    await page.locator('input[placeholder="Search models..."]').fill('nonexistentmodel12345');
    await page.waitForTimeout(300);

    // Verify empty state
    await expect(page.locator('text=No models found')).toBeVisible();
    await expect(page.locator('text=Try adjusting your search or filters')).toBeVisible();
  });

  test('should focus search input when opening dropdown', async ({ page }) => {
    // Open dropdown
    await page.locator('button').filter({ hasText: 'Claude' }).click();

    // Verify search input is focused
    const searchInput = page.locator('input[placeholder="Search models..."]');
    await expect(searchInput).toBeFocused();

    // Verify typing works immediately
    await page.keyboard.type('GPT');
    await expect(searchInput).toHaveValue('GPT');
  });

  test('should handle model selection after clearing messages', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    const clearButton = page.locator('[data-testid="clear-button"]');

    // Send a message
    await messageInput.fill('Test message');
    await sendButton.click();
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

    // Clear messages
    await clearButton.click();

    // Change model
    await page.locator('button').filter({ hasText: 'Claude' }).click();
    await page.locator('input[placeholder="Search models..."]').fill('GPT-4');
    await page.waitForTimeout(300);
    const gpt4Model = page.locator('text=GPT-4').first();
    await gpt4Model.click();

    // Verify new model is selected
    await expect(page.locator('button').filter({ hasText: 'GPT-4' })).toBeVisible();

    // Send a new message with the new model
    await messageInput.fill('New message with GPT');
    await sendButton.click();

    // Verify message is sent
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });
  });
});
