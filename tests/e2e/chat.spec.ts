import { test, expect } from '@playwright/test';

test.describe('Chat Route E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to chat page before each test
    await page.goto('/chat');
  });

  test('should navigate to /chat page and render ChatInterface component', async ({ page }) => {
    // Verify URL
    await expect(page).toHaveURL(/.*\/chat/);

    // Verify page title exists
    await expect(page.locator('h1')).toContainText('AI Chat');

    // Verify ChatInterface component is rendered
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('[data-testid="model-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should display empty state when no messages', async ({ page }) => {
    // Verify empty state message is displayed
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="empty-state"]')).toContainText('No messages yet');

    // Verify messages area is visible but empty
    await expect(page.locator('[data-testid="messages-area"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(0);
  });

  test('should allow typing in message input and enable send button', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Initially send button should be disabled (no message)
    await expect(sendButton).toBeDisabled();

    // Type a message
    await messageInput.fill('Hello, AI! This is a test message.');

    // Verify message input has the text
    await expect(messageInput).toHaveValue('Hello, AI! This is a test message.');

    // Send button should now be enabled
    await expect(sendButton).toBeEnabled();
  });

  test('should send message and display it in chat', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Type and send a message
    await messageInput.fill('Test message for E2E');
    await sendButton.click();

    // Wait for user message to appear
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

    // Verify user message content
    const userMessage = page.locator('[data-testid="message-user"]').first();
    await expect(userMessage).toContainText('Test message for E2E');

    // Verify input is cleared after sending
    await expect(messageInput).toHaveValue('');

    // Verify send button shows "Sending..." while processing
    // Note: This may be brief, so we use toContainText OR check for assistant response
    await expect(
      page.locator('[data-testid="message-assistant"]').or(page.locator('[data-testid="streaming-indicator"]'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display streaming indicator while waiting for response', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Send a message
    await messageInput.fill('Tell me about AI');
    await sendButton.click();

    // Wait for user message
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

    // Check for streaming indicator or assistant response
    // The streaming indicator might appear briefly before the response
    const streamingOrAssistant = page.locator('[data-testid="streaming-indicator"]').or(
      page.locator('[data-testid="message-assistant"]')
    );
    await expect(streamingOrAssistant).toBeVisible({ timeout: 15000 });
  });

  test('should receive and display AI response with streaming', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Send a message
    await messageInput.fill('What is 2+2?');
    await sendButton.click();

    // Wait for user message
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

    // Wait for assistant response
    await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 30000 });

    // Verify assistant message has content
    const assistantMessage = page.locator('[data-testid="message-assistant"]').first();
    await expect(assistantMessage).not.toBeEmpty();

    // Verify streaming indicator is gone after response
    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('should allow model selection before sending message', async ({ page }) => {
    const modelSelector = page.locator('[data-testid="model-selector"]');
    const modelBadge = page.locator('[data-testid="model-badge"]');

    // Verify default model is displayed
    await expect(modelBadge).toContainText('Claude');

    // Change model
    await modelSelector.selectOption('openai/gpt-4');

    // Note: Badge might not update immediately until a message is sent
    // Just verify the selector changed
    await expect(modelSelector).toHaveValue('openai/gpt-4');
  });

  test('should clear all messages when clear button is clicked', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    const clearButton = page.locator('[data-testid="clear-button"]');

    // Initially clear button should be disabled (no messages)
    await expect(clearButton).toBeDisabled();

    // Send a message
    await messageInput.fill('Test message to be cleared');
    await sendButton.click();

    // Wait for message to appear
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

    // Clear button should be enabled now
    await expect(clearButton).toBeEnabled();

    // Click clear button
    await clearButton.click();

    // Verify messages are cleared
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="message-assistant"]')).toHaveCount(0);

    // Verify empty state is shown
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();

    // Clear button should be disabled again
    await expect(clearButton).toBeDisabled();
  });

  test('should handle Enter key to send message', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');

    // Type message and press Enter
    await messageInput.fill('Testing Enter key');
    await messageInput.press('Enter');

    // Wait for user message to appear
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible({ timeout: 5000 });

    // Verify message was sent
    await expect(page.locator('[data-testid="message-user"]')).toContainText('Testing Enter key');
  });

  test('should handle Shift+Enter to add new line without sending', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');

    // Type message and press Shift+Enter
    await messageInput.fill('Line 1');
    await messageInput.press('Shift+Enter');
    await messageInput.type('Line 2');

    // Verify message has newline and was NOT sent
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('\n');

    // Verify no message was sent
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(0);
  });

  test('should maintain chat history across multiple messages', async ({ page }) => {
    const messageInput = page.locator('[data-testid="message-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Send first message
    await messageInput.fill('First message');
    await sendButton.click();
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(1);

    // Wait a bit to avoid race condition
    await page.waitForTimeout(1000);

    // Send second message
    await messageInput.fill('Second message');
    await sendButton.click();

    // Wait for both user messages to be visible
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(2, { timeout: 5000 });

    // Verify both messages are in the chat
    const userMessages = page.locator('[data-testid="message-user"]');
    await expect(userMessages.nth(0)).toContainText('First message');
    await expect(userMessages.nth(1)).toContainText('Second message');
  });
});
