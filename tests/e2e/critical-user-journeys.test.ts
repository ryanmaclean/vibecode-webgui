/**
 * Critical User Journeys E2E Tests
 * Tests complete end-to-end user workflows and scenarios
 */

import { test, expect } from '@playwright/test';
import { createTestHelpers, TestHelpers } from './utils/test-helpers';

// Define test credentials
const testCredentials = {
  email: 'test@vibecode.com',
  password: 'testpass123'
};

test.describe('Critical User Journeys', () => {
  // Define a setup function to create a fresh workspace
  async function setupWorkspace(page) {
    // Use systematic E2E authentication bypass (same as AI tests)
    await TestHelpers.loginAsTestUser(page, 'user');

    // Create a new workspace for testing
    await page.goto('/workspaces');
    await TestHelpers.waitForPageLoad(page);
    
    await page.click('[data-testid="create-workspace-button"]');
    
    const workspaceName = `Test Workspace ${Date.now()}`;
    await page.fill('[data-testid="workspace-name"]', workspaceName);
    await page.fill('[data-testid="workspace-description"]', 'Created for critical user journey testing');
    await page.click('[data-testid="submit-workspace"]');
    
    // Wait for redirect to new workspace
    await page.waitForURL(/\/workspaces\/\d+/);
    
    // Extract workspace ID from URL
    const url = page.url();
    const match = url.match(/\/workspaces\/(\d+)/);
    let workspaceId = '';
    if (match && match[1]) {
      workspaceId = match[1];
    }
    
    return { workspaceId, workspaceName };
  }
  
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
        await TestHelpers.loginAsTestUser(page, 'user');
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
      await TestHelpers.loginAsTestUser(page, 'user');
      
      // Should reach main interface
      await expect(page).toHaveURL('/');
      
      await helpers.takeScreenshot('onboarding-complete');
      
      console.log('✅ New user onboarding test passed!');
    });
  });

  test.describe('Workspace File Operations Journey', () => {
    test('should handle full workspace file operations workflow', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // 1. Login and create workspace
      const { workspaceId, workspaceName } = await setupWorkspace(page);
      
      // 2. Create multiple files
      const files = [
        { name: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Test Page</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>' },
        { name: 'styles.css', content: 'body {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n\nh1 {\n  color: blue;\n}' },
        { name: 'script.js', content: 'document.addEventListener("DOMContentLoaded", () => {\n  console.log("Page loaded");\n});' }
      ];
      
      for (const file of files) {
        await page.click('[data-testid="create-file-button"]');
        await page.fill('[data-testid="file-name-input"]', file.name);
        await page.fill('[data-testid="file-content-editor"]', file.content);
        await page.click('[data-testid="save-file-button"]');
        
        // Verify file was created
        await expect(page.locator(`[data-testid="file-${file.name}"]`)).toBeVisible();
      }
      
      // Take screenshot of files created
      await helpers.takeScreenshot('workspace-files-created');
      
      // 3. Edit a file
      await page.click('[data-testid="file-index.html"]');
      
      // Wait for editor to load
      await page.waitForSelector('[data-testid="code-editor"], .monaco-editor', { timeout: 5000 }).catch(() => {
        console.log('Code editor element not found with expected selector');
      });
      
      // Modify the file content with a simple fill operation
      await page.fill('[data-testid="file-content-editor"]', 
        '<!DOCTYPE html>\n<html>\n<head>\n  <title>Updated Page</title>\n</head>\n<body>\n  <h1>Updated Content</h1>\n</body>\n</html>');
      
      // 4. Save changes
      await page.click('[data-testid="save-file-button"], [data-testid="save-changes-button"]');
      
      // Take screenshot after edit
      await helpers.takeScreenshot('workspace-file-edited');
      
      // 5. Create a folder structure if folder functionality exists
      const folderButton = page.locator('[data-testid="create-folder-button"], button:has-text("New Folder")').first();
      if (await folderButton.isVisible()) {
        await folderButton.click();
        await page.fill('[data-testid="folder-name-input"]', 'src');
        await page.click('[data-testid="create-folder-button"]');
        
        // Verify folder was created
        await expect(page.locator('[data-testid="folder-src"]')).toBeVisible();
        
        // Take screenshot with folder
        await helpers.takeScreenshot('workspace-folder-created');
      }
      
      // 6. Delete a file
      await page.click('[data-testid="file-menu-styles.css"]');
      await page.click('[data-testid="delete-file-option"]');
      await page.click('[data-testid="confirm-delete-file-button"]');
      
      // Verify file was deleted
      await expect(page.locator('[data-testid="file-styles.css"]')).not.toBeVisible();
      
      // 7. Take screenshot of final file operations
      await helpers.takeScreenshot('workspace-file-operations-complete');
      
      console.log('✅ Workspace file operations journey test passed!');
    });
  });

  test.describe('AI-Assisted Development Journey', () => {
    test('should complete AI-assisted code improvement workflow', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // 1. Login and create workspace
      const { workspaceId } = await setupWorkspace(page);
      
      // 2. Create a file with code that needs improvement
      await page.click('[data-testid="create-file-button"]');
      await page.fill('[data-testid="file-name-input"]', 'buggy-function.js');
      
      // Code with bug
      const buggyCode = `// This function has a bug
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].price;
  }
  return total;
}

const products = [
  { name: 'Product 1', price: 10 },
  { name: 'Product 2', price: 20 },
  { name: 'Product 3', price: 30 }
];

console.log(calculateTotal(products));`;
      
      await page.fill('[data-testid="file-content-editor"]', buggyCode);
      await page.click('[data-testid="save-file-button"]');
      
      // Take screenshot of buggy code file
      await helpers.takeScreenshot('ai-assist-buggy-code');
      
      // 3. Open AI chat
      await page.click('[data-testid="ai-chat-toggle"]');
      
      // 4. Ask AI to fix the bug
      const promptInput = page.locator('[data-testid="chat-input"], textarea[placeholder*="prompt"]').first();
      await promptInput.fill('There\'s a bug in my calculateTotal function. Can you find and fix it?');
      await page.click('[data-testid="send-message"]');
      
      // 5. Wait for AI response
      await helpers.waitForAIResponse();
      
      // Take screenshot of AI response
      await helpers.takeScreenshot('ai-assist-bug-fix-suggestion');
      
      // 6. Thank the AI
      await promptInput.fill('Thanks for helping me fix the bug!');
      await page.click('[data-testid="send-message"]');
      
      // 7. Wait for AI response
      await helpers.waitForAIResponse();
      
      // 8. Take screenshot of completed journey
      await helpers.takeScreenshot('ai-assisted-code-improvement-complete');
      
      console.log('✅ AI-assisted code improvement journey test passed!');
    });
  });

  test.describe('Error Recovery Scenarios', () => {
    test('should handle and recover from network failures gracefully', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await TestHelpers.loginAsTestUser(page, 'user');
      
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
  });
});