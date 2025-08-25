/**
 * AI Features E2E Tests
 * Tests AI chat, code generation, and AI-powered features
 */

import { test, expect } from '@playwright/test';
import { createTestHelpers } from './utils/test-helpers';

test.describe('AI Features', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = createTestHelpers(page);
    await helpers.login();
  });

  test('should display AI chat interface', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for AI chat interface elements
    const chatInterface = page.locator('[data-testid="ai-chat"], .ai-chat-interface, .prompt-interface').first();
    await expect(chatInterface).toBeVisible();
    
    // Verify input elements
    const promptInput = page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    await expect(promptInput).toBeVisible();
    
    // Verify submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Submit")').first();
    await expect(submitButton).toBeVisible();
    
    // Check accessibility
    await helpers.checkAccessibility();
    
    await helpers.takeScreenshot('ai-chat-interface');
  });

  test('should handle basic AI prompt submission', async ({ page }) => {
    const helpers = createTestHelpers(page);
    const apiRequests = await helpers.monitorNetworkRequests();
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    const testPrompt = 'Create a simple React component for a button';
    
    // Submit AI prompt
    await helpers.submitAIPrompt(testPrompt);
    
    // Verify API call was made
    const aiApiCall = apiRequests.find(req => 
      req.url.includes('/api/ai') || 
      req.url.includes('/api/chat') ||
      req.url.includes('/api/generate')
    );
    
    if (aiApiCall) {
      expect([200, 201]).toContain(aiApiCall.status);
      expect(aiApiCall.responseTime).toBeLessThan(30000); // 30 second timeout
    }
    
    // Check for response content
    const responseArea = page.locator('[data-testid="ai-response"], .ai-response, .response-content, .generated-code').first();
    await expect(responseArea).toBeVisible({ timeout: 35000 });
    
    // Verify response contains content
    const responseText = await responseArea.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText.length).toBeGreaterThan(10);
    
    await helpers.takeScreenshot('ai-prompt-response');
  });

  test('should handle code generation requests', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    const codePrompt = 'Generate a TypeScript function that calculates fibonacci numbers';
    
    await helpers.submitAIPrompt(codePrompt);
    
    // Look for code blocks or syntax highlighting
    const codeBlock = page.locator('code, pre, .code-block, .syntax-highlight, [data-testid="generated-code"]').first();
    await expect(codeBlock).toBeVisible({ timeout: 35000 });
    
    // Verify code content looks reasonable
    const codeContent = await codeBlock.textContent();
    expect(codeContent).toContain('fibonacci');
    expect(codeContent).toMatch(/function|const|=>/); // Should contain function syntax
    
    await helpers.takeScreenshot('code-generation');
  });

  test('should handle empty or invalid prompts gracefully', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Try submitting empty prompt
    const promptInput = page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    await promptInput.fill('');
    
    const submitButton = page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Submit")').first();
    
    // Button should be disabled or show validation
    const isDisabled = await submitButton.isDisabled();
    
    if (!isDisabled) {
      await submitButton.click();
      
      // Should show validation message
      const validationMessage = page.locator('.validation-error, [role="alert"], .error-message').first();
      await expect(validationMessage).toBeVisible({ timeout: 5000 });
    }
    
    await helpers.takeScreenshot('empty-prompt-validation');
  });

  test('should support chat history and conversation context', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Send first message
    await helpers.submitAIPrompt('Hello, can you help me with React?');
    
    // Wait for response
    await helpers.waitForAIResponse();
    
    // Send follow-up message
    const promptInput = page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    await promptInput.fill('Can you show me an example?');
    
    const submitButton = page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Submit")').first();
    await submitButton.click();
    
    await helpers.waitForAIResponse();
    
    // Check for chat history
    const chatMessages = page.locator('.chat-message, .message, [data-testid="chat-message"]');
    const messageCount = await chatMessages.count();
    
    expect(messageCount).toBeGreaterThan(1); // Should have at least user + AI message
    
    await helpers.takeScreenshot('chat-conversation');
  });

  test('should handle AI feature accessibility', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Submit a prompt to generate content
    await helpers.submitAIPrompt('Create a simple HTML form');
    await helpers.waitForAIResponse();
    
    // Check overall accessibility
    await helpers.checkAccessibility();
    
    // Test keyboard navigation
    const promptInput = page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    await promptInput.focus();
    
    // Tab should move to submit button
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    
    const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
    expect(['button', 'input']).toContain(tagName);
  });

  test('should display appropriate loading states', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    const promptInput = page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]').first();
    await promptInput.fill('Generate a complex React application');
    
    const submitButton = page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Submit")').first();
    await submitButton.click();
    
    // Should show loading indicator quickly
    const loadingIndicator = page.locator('.loading, .spinner, [class*="animate-spin"], .generating').first();
    await expect(loadingIndicator).toBeVisible({ timeout: 2000 });
    
    // Loading should eventually disappear
    await expect(loadingIndicator).toBeHidden({ timeout: 35000 });
    
    await helpers.takeScreenshot('loading-state');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Intercept AI API calls and simulate error
    await page.route('**/api/ai/**', route => route.abort());
    await page.route('**/api/chat/**', route => route.abort());
    await page.route('**/api/generate/**', route => route.abort());
    
    await helpers.submitAIPrompt('This should fail due to network error');
    
    // Should show error message
    const errorMessage = page.locator('.error-message, [role="alert"], .alert-error, .network-error').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    
    // Should not crash the application
    await helpers.checkForErrors();
    
    await helpers.takeScreenshot('network-error-handling');
  });
});