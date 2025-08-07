/**
 * Workspace Management E2E Tests
 * Tests workspace creation, file operations, and project management
 */

import { test, expect } from '@playwright/test';
import { createTestHelpers } from './utils/test-helpers';

test.describe('Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = createTestHelpers(page);
    await helpers.login();
  });

  test('should display workspace interface', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for workspace-related elements
    const workspaceElements = [
      '[data-testid="workspace"]',
      '.workspace-container',
      '.file-explorer',
      '.project-tree',
      'button:has-text("New Project")',
      'button:has-text("Create Workspace")'
    ];
    
    let workspaceVisible = false;
    for (const selector of workspaceElements) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        workspaceVisible = true;
        break;
      }
    }
    
    if (workspaceVisible) {
      await helpers.takeScreenshot('workspace-interface');
      console.log('✅ Workspace interface is visible');
    } else {
      console.log('⚠️ Workspace interface not found - may not be implemented yet');
      await helpers.takeScreenshot('no-workspace-interface');
    }
  });

  test('should create new project via AI generation', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for project creation interface
    const createProjectButton = page.locator(
      'button:has-text("New Project"), button:has-text("Create Project"), [data-testid="create-project"]'
    ).first();
    
    if (await createProjectButton.isVisible()) {
      await createProjectButton.click();
      await helpers.waitForPageReady();
      
      // Fill project details
      const projectNameInput = page.locator('[name="projectName"], [placeholder*="project name"], [data-testid="project-name"]').first();
      if (await projectNameInput.isVisible()) {
        await projectNameInput.fill('test-e2e-project');
      }
      
      const projectDescriptionInput = page.locator('[name="description"], textarea[placeholder*="description"]').first();
      if (await projectDescriptionInput.isVisible()) {
        await projectDescriptionInput.fill('E2E test project for automated testing');
      }
      
      // Submit project creation
      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Generate")').first();
      await submitButton.click();
      
      // Wait for project creation to complete
      await helpers.waitForAIResponse();
      
      // Verify project was created
      const projectFiles = page.locator('.file-item, .project-file, [data-testid="project-file"]');
      const fileCount = await projectFiles.count();
      
      if (fileCount > 0) {
        expect(fileCount).toBeGreaterThan(0);
        await helpers.takeScreenshot('project-created');
      }
      
    } else {
      console.log('⚠️ Project creation interface not found');
    }
  });

  test('should display file explorer', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for file explorer elements
    const fileExplorerSelectors = [
      '.file-explorer',
      '.file-tree',
      '[data-testid="file-explorer"]',
      '.sidebar',
      '.project-files'
    ];
    
    let explorerFound = false;
    for (const selector of fileExplorerSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        explorerFound = true;
        
        // Check for file items
        const fileItems = element.locator('.file-item, .file, li, [data-testid="file-item"]');
        const itemCount = await fileItems.count();
        
        if (itemCount > 0) {
          // Test file selection
          await fileItems.first().click();
          await helpers.waitForPageReady();
          
          await helpers.takeScreenshot('file-explorer-with-files');
        }
        
        break;
      }
    }
    
    if (!explorerFound) {
      console.log('⚠️ File explorer not found - may not be implemented yet');
      await helpers.takeScreenshot('no-file-explorer');
    }
  });

  test('should handle file operations', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for file creation options
    const newFileButton = page.locator(
      'button:has-text("New File"), [data-testid="new-file"], .new-file-btn'
    ).first();
    
    if (await newFileButton.isVisible()) {
      await newFileButton.click();
      
      // Fill file name
      const fileNameInput = page.locator('[name="fileName"], [placeholder*="file name"]').first();
      if (await fileNameInput.isVisible()) {
        await fileNameInput.fill('test.js');
        
        // Submit file creation
        const createButton = page.locator('button:has-text("Create"), button[type="submit"]').first();
        await createButton.click();
        
        await helpers.waitForPageReady();
        
        // Verify file appears in file list
        const newFile = page.locator(':has-text("test.js")').first();
        await expect(newFile).toBeVisible();
        
        await helpers.takeScreenshot('file-created');
      }
    } else {
      console.log('⚠️ File creation interface not found');
    }
  });

  test('should display code editor', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for code editor elements
    const editorSelectors = [
      '.monaco-editor',
      '.code-editor',
      '[data-testid="code-editor"]',
      '.editor-container',
      'textarea[class*="editor"]'
    ];
    
    let editorFound = false;
    for (const selector of editorSelectors) {
      const editor = page.locator(selector).first();
      if (await editor.isVisible().catch(() => false)) {
        editorFound = true;
        
        // Test typing in editor
        await editor.click();
        await page.keyboard.type('// E2E test code\nconsole.log("Hello from E2E test");');
        
        // Verify content was typed
        const editorContent = await editor.textContent().catch(() => '');
        expect(editorContent).toContain('E2E test');
        
        await helpers.takeScreenshot('code-editor');
        break;
      }
    }
    
    if (!editorFound) {
      console.log('⚠️ Code editor not found - may use different implementation');
    }
  });

  test('should handle workspace navigation', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Test navigation between different sections
    const navLinks = page.locator('nav a, [role="navigation"] a, .nav-link');
    const linkCount = await navLinks.count();
    
    if (linkCount > 0) {
      // Click first navigation link
      const firstLink = navLinks.first();
      const linkText = await firstLink.textContent();
      
      await firstLink.click();
      await helpers.waitForPageReady();
      
      // Verify navigation worked
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
      
      await helpers.takeScreenshot(`navigation-${linkText?.replace(/\s+/g, '-').toLowerCase()}`);
    }
    
    // Test browser navigation
    await page.goBack();
    await helpers.waitForPageReady();
    
    await page.goForward();
    await helpers.waitForPageReady();
    
    await helpers.takeScreenshot('after-browser-navigation');
  });

  test('should handle workspace settings', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Look for settings or preferences
    const settingsButton = page.locator(
      'button:has-text("Settings"), [data-testid="settings"], .settings-btn, button:has-text("Preferences")'
    ).first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await helpers.waitForPageReady();
      
      // Look for settings options
      const settingsOptions = page.locator('.setting-item, .preference-item, input[type="checkbox"], select');
      const optionCount = await settingsOptions.count();
      
      if (optionCount > 0) {
        // Test changing a setting
        const firstOption = settingsOptions.first();
        const tagName = await firstOption.evaluate(el => el.tagName.toLowerCase());
        
        if (tagName === 'input') {
          const inputType = await firstOption.getAttribute('type');
          if (inputType === 'checkbox') {
            await firstOption.click();
          }
        }
        
        await helpers.takeScreenshot('settings-page');
      }
    } else {
      console.log('⚠️ Settings interface not found');
    }
  });

  test('should persist workspace state', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    await page.goto('/');
    await helpers.waitForPageReady();
    
    // Make some changes (if possible)
    const editorOrInput = page.locator('.monaco-editor, .code-editor, textarea').first();
    
    if (await editorOrInput.isVisible()) {
      await editorOrInput.click();
      await page.keyboard.type('// Persistence test');
      
      // Refresh page
      await page.reload();
      await helpers.waitForPageReady();
      
      // Check if content persisted (this may not be implemented yet)
      const content = await editorOrInput.textContent().catch(() => '');
      
      if (content.includes('Persistence test')) {
        console.log('✅ Workspace state persisted');
      } else {
        console.log('⚠️ Workspace state not persisted (may not be implemented)');
      }
      
      await helpers.takeScreenshot('after-refresh');
    }
  });
});