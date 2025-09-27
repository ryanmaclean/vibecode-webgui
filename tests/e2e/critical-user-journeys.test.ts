/**
 * Critical User Journeys E2E Tests
 * Tests complete end-to-end user workflows and scenarios
 */

import { test, expect } from '@playwright/test';
import { createTestHelpers } from './utils/test-helpers';

test.describe('Critical User Journeys', () => {
  
  test.describe('Complete Development Workflow', () => {
    test('should complete full development workflow: login → create project → generate code → iterate', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // Step 1: Authentication
      console.log('🔐 Step 1: User Authentication');
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Login if not already authenticated
      const loginButton = page.locator('[href="/auth/login"]').first();
      if (await loginButton.isVisible()) {
        await helpers.login();
      }
      
      await helpers.takeScreenshot('journey-1-authenticated');
      
      // Step 2: Project Creation
      console.log('📁 Step 2: Project Creation');
      const createProjectButton = page.locator(
        'button:has-text("New Project"), button:has-text("Create Project"), [data-testid="create-project"]'
      ).first();
      
      if (await createProjectButton.isVisible()) {
        await createProjectButton.click();
        await helpers.waitForPageReady();
        
        // Fill project details
        const projectNameInput = page.locator('[name="projectName"], [placeholder*="project name"]').first();
        if (await projectNameInput.isVisible()) {
          await projectNameInput.fill('e2e-test-todo-app');
          
          const descriptionInput = page.locator('[name="description"], textarea').first();
          if (await descriptionInput.isVisible()) {
            await descriptionInput.fill('A simple todo application with CRUD operations');
          }
          
          const submitButton = page.locator('button[type="submit"], button:has-text("Create")').first();
          await submitButton.click();
          
          await helpers.waitForAIResponse();
          await helpers.takeScreenshot('journey-2-project-created');
        }
      }
      
      // Step 3: Code Generation
      console.log('🤖 Step 3: AI Code Generation');
      await helpers.submitAIPrompt('Create a React component for a todo list with add, delete, and toggle functionality');
      
      // Verify code was generated
      const codeContent = page.locator('code, pre, .code-block, [data-testid="generated-code"]').first();
      await expect(codeContent).toBeVisible({ timeout: 40000 });
      
      const generatedCode = await codeContent.textContent();
      expect(generatedCode).toContain('todo');
      expect(generatedCode).toMatch(/React|function|const|component/i);
      
      await helpers.takeScreenshot('journey-3-code-generated');
      
      // Step 4: Code Iteration
      console.log('🔄 Step 4: Code Iteration');
      await helpers.submitAIPrompt('Add TypeScript types and error handling to the previous component');
      
      await helpers.waitForAIResponse();
      
      const updatedCode = page.locator('code, pre, .code-block').last();
      const updatedContent = await updatedCode.textContent();
      expect(updatedContent).toMatch(/interface|type|try|catch|error/i);
      
      await helpers.takeScreenshot('journey-4-code-iterated');
      
      // Step 5: Verify Complete Workflow
      console.log('✅ Step 5: Workflow Verification');
      
      // Check for no errors
      await helpers.checkForErrors();
      
      // Verify user can navigate freely
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // User should still be authenticated
      const userProfile = page.locator('[data-testid="user-profile"], .user-menu, button:has-text("Logout")').first();
      await expect(userProfile).toBeVisible();
      
      await helpers.takeScreenshot('journey-5-workflow-complete');
      
      console.log('🎉 Complete development workflow test passed!');
    });
  });

  test.describe('New User Onboarding', () => {
    test('should guide new user through first-time experience', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // Start as unauthenticated user
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Should see welcoming interface
      const welcomeElements = page.locator('h1, h2').filter({ hasText: /welcome|vibecode|ai|development/i });
      await expect(welcomeElements.first()).toBeVisible();
      
      // Check for onboarding elements
      const onboardingElements = [
        'button:has-text("Get Started")',
        'button:has-text("Sign Up")',
        '[data-testid="onboarding"]',
        '.onboarding-step',
        '.tour-step'
      ];
      
      let onboardingFound = false;
      for (const selector of onboardingElements) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          onboardingFound = true;
          await element.click();
          await helpers.waitForPageReady();
          break;
        }
      }
      
      await helpers.takeScreenshot('onboarding-experience');
      
      // Navigate to login
      const loginButton = page.locator('[href="/auth/login"], button:has-text("Login")').first();
      await loginButton.click();
      
      await page.waitForURL(/login/);
      await helpers.waitForPageReady();
      
      // Login interface should be user-friendly
      await helpers.checkAccessibility();
      
      // Complete login
      await helpers.login();
      
      // Should reach main interface
      await expect(page).toHaveURL('/');
      
      await helpers.takeScreenshot('onboarding-complete');
      
      console.log('✅ New user onboarding test passed!');
    });
  });

  test.describe('Error Recovery Scenarios', () => {
    test('should handle and recover from network failures gracefully', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Start normal operation
      await helpers.submitAIPrompt('Create a simple React button component');
      await helpers.waitForAIResponse();
      
      await helpers.takeScreenshot('before-network-failure');
      
      // Simulate network failure
      await page.route('**/*', route => {
        // Allow some requests to pass, block others to simulate intermittent issues
        if (Math.random() > 0.7) {
          route.abort('internetdisconnected');
        } else {
          route.continue();
        }
      });
      
      // Try another request during network issues
      const promptInput = page.locator('textarea[placeholder*="prompt"], [data-testid="prompt-input"]').first();
      await promptInput.fill('This request should handle network issues gracefully');
      
      const submitButton = page.locator('button[type="submit"], button:has-text("Generate")').first();
      await submitButton.click();
      
      // Should show error handling
      const errorMessage = page.locator('.error-message, [role="alert"], .network-error').first();
      await expect(errorMessage).toBeVisible({ timeout: 15000 });
      
      await helpers.takeScreenshot('network-failure-handling');
      
      // Restore network
      await page.unroute('**/*');
      
      // Retry should work
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();
      
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await helpers.waitForAIResponse();
      } else {
        // Manual retry
        await submitButton.click();
        await helpers.waitForAIResponse();
      }
      
      await helpers.takeScreenshot('network-recovery');
      
      console.log('✅ Network failure recovery test passed!');
    });

    test('should handle invalid or malformed AI responses', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Intercept AI API calls and return malformed responses
      await page.route('**/api/ai/**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ invalid: 'malformed response structure' })
        });
      });
      
      await page.route('**/api/chat/**', route => {
        route.fulfill({
          status: 500,
          body: 'Internal Server Error'
        });
      });
      
      await helpers.submitAIPrompt('This should handle malformed API responses');
      
      // Should handle error gracefully
      const errorHandling = page.locator('.error-message, [role="alert"], .api-error').first();
      await expect(errorHandling).toBeVisible({ timeout: 10000 });
      
      // Application should remain functional
      await helpers.checkForErrors();
      
      await helpers.takeScreenshot('malformed-response-handling');
      
      console.log('✅ Malformed response handling test passed!');
    });
  });

  test.describe('Performance Under Load', () => {
    test('should maintain responsiveness with multiple concurrent operations', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Monitor performance
      const performanceBefore = await helpers.checkPagePerformance();
      
      // Simulate multiple quick operations
      const operations = [
        'Create a React component',
        'Add TypeScript types',
        'Add error handling',
        'Create unit tests',
        'Add documentation'
      ];
      
      for (let i = 0; i < operations.length; i++) {
        console.log(`🔄 Performing operation ${i + 1}: ${operations[i]}`);
        
        // Submit without waiting for previous to complete (if possible)
        const promptInput = page.locator('textarea[placeholder*="prompt"], [data-testid="prompt-input"]').first();
        await promptInput.fill(operations[i]);
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Generate")').first();
        await submitButton.click();
        
        // Short wait between operations
        await page.waitForTimeout(2000);
      }
      
      // Wait for all operations to complete
      await helpers.waitForAIResponse();
      
      // Check performance after load
      const performanceAfter = await helpers.checkPagePerformance();
      
      // Performance shouldn't degrade significantly
      const performanceDelta = performanceAfter.totalTime - performanceBefore.totalTime;
      expect(performanceDelta).toBeLessThan(5000); // No more than 5s degradation
      
      await helpers.takeScreenshot('performance-after-load');
      
      console.log('✅ Performance under load test passed!');
    });
  });

  test.describe('Extended User Session', () => {
    test('should maintain functionality during extended session', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Simulate extended session with periodic activity
      const sessionDuration = 60000; // 1 minute for testing
      const intervalTime = 10000; // 10 seconds
      const intervals = Math.floor(sessionDuration / intervalTime);
      
      for (let i = 0; i < intervals; i++) {
        console.log(`⏱️ Session activity ${i + 1}/${intervals}`);
        
        // Perform typical user activity
        await helpers.submitAIPrompt(`Session test ${i + 1}: Create a simple function`);
        await helpers.waitForAIResponse();
        
        // Navigate around
        await page.goto('/');
        await helpers.waitForPageReady();
        
        // Wait for interval
        await page.waitForTimeout(intervalTime);
        
        // Check session is still valid
        const userProfile = page.locator('[data-testid="user-profile"], .user-menu, button:has-text("Logout")').first();
        await expect(userProfile).toBeVisible();
      }
      
      await helpers.takeScreenshot('extended-session-complete');
      
      console.log('✅ Extended user session test passed!');
    });
  });
});