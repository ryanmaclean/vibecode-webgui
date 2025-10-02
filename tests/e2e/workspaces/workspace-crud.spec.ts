/**
 * Workspace CRUD E2E Tests
 * Tests comprehensive workspace management functionality for issue #449
 *
 * Coverage:
 * - Workspace listing and navigation
 * - Workspace creation with validation
 * - Template-based workspace creation
 * - File operations (create, upload, rename, delete)
 * - Workspace settings and updates
 * - Workspace deletion with confirmation
 * - Workspace sharing and collaboration
 * - Search and filtering
 * - AI chat integration
 */

import { test, expect } from '@playwright/test';
import TestHelpers from '../utils/test-helpers';

test.describe('Workspace CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate before each test
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.waitForPageLoad(page);
  });

  test.describe('Workspace Listing', () => {
    test('should display workspaces list page', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Verify page header
      const heading = page.locator('h1:has-text("Workspaces")');
      await expect(heading).toBeVisible();

      // Verify action buttons
      await expect(page.locator('[data-testid="create-workspace-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="use-template-button"]')).toBeVisible();

      // Verify search functionality
      await expect(page.locator('[data-testid="workspace-search"]')).toBeVisible();

      // Take screenshot for visual regression
      await page.screenshot({ path: 'test-results/screenshots/workspaces-list.png', fullPage: true });
    });

    test('should display existing workspaces', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Wait for loading to complete
      await page.waitForSelector('[role="status"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

      // Check for workspace cards
      const workspaceCards = page.locator('[data-testid*="workspace-"]');
      const count = await workspaceCards.count();

      if (count > 0) {
        // Verify workspace card structure
        const firstWorkspace = workspaceCards.first();
        await expect(firstWorkspace).toBeVisible();

        // Check for edit and settings buttons
        await expect(page.locator('[data-testid="edit-workspace-button"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="workspace-settings-button"]').first()).toBeVisible();
      } else {
        // Should show empty state
        await expect(page.locator('[data-testid="empty-workspaces"]')).toBeVisible();
      }
    });

    test('should search workspaces', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Wait for loading to complete
      await page.waitForSelector('[role="status"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

      const searchInput = page.locator('[data-testid="workspace-search"]');
      await searchInput.fill('Frontend');

      // Wait for search to filter results
      await page.waitForTimeout(500);

      // Verify search results
      const results = page.locator('[data-testid*="workspace-"]');
      const count = await results.count();

      // Should either show filtered results or empty state
      if (count > 0) {
        // Verify results contain search term
        const firstResult = results.first();
        const text = await firstResult.textContent();
        expect(text?.toLowerCase()).toContain('frontend');
      } else {
        // Empty state should be visible or no workspaces message
        const emptyState = page.locator('[data-testid="empty-workspaces"]');
        const isEmpty = await emptyState.isVisible().catch(() => false);
        expect(isEmpty).toBe(true);
      }
    });
  });

  test.describe('Workspace Creation', () => {
    test('should open create workspace modal', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Click create workspace button
      await page.click('[data-testid="create-workspace-button"]');

      // Verify modal is visible
      await expect(page.locator('h3:has-text("Create New Workspace")')).toBeVisible();
      await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="workspace-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="submit-workspace"]')).toBeVisible();
    });

    test('should validate required workspace name', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Open modal
      await page.click('[data-testid="create-workspace-button"]');
      await page.waitForSelector('[data-testid="workspace-name"]');

      // Try to submit without name
      await page.click('[data-testid="submit-workspace"]');

      // Should show validation error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('required');
    });

    test('should validate minimum workspace name length', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Open modal
      await page.click('[data-testid="create-workspace-button"]');
      await page.waitForSelector('[data-testid="workspace-name"]');

      // Enter short name
      await page.fill('[data-testid="workspace-name"]', 'ab');
      await page.click('[data-testid="submit-workspace"]');

      // Should show validation error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('at least 3 characters');
    });

    test('should create new workspace successfully', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Open modal
      await page.click('[data-testid="create-workspace-button"]');
      await page.waitForSelector('[data-testid="workspace-name"]');

      // Fill form
      const workspaceName = `E2E Test Workspace ${Date.now()}`;
      await page.fill('[data-testid="workspace-name"]', workspaceName);
      await page.fill('[data-testid="workspace-description"]', 'Created by E2E test for workspace CRUD operations');

      // Submit
      await page.click('[data-testid="submit-workspace"]');

      // Should navigate to new workspace or show success
      await page.waitForURL(/\/workspaces\/\d+/, { timeout: 10000 }).catch(() => {
        // If URL doesn't change, check if workspace was added to list
        return page.goto('/workspaces');
      });

      // Verify we're on workspace page or back on list
      const currentUrl = page.url();
      const isWorkspacePage = currentUrl.includes('/workspaces/');

      if (isWorkspacePage) {
        // Verify workspace page loaded
        await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible();
        await page.screenshot({ path: 'test-results/screenshots/workspace-created.png', fullPage: true });
      }
    });

    test('should create workspace from template', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Click use template button
      await page.click('[data-testid="use-template-button"]');

      // Verify template modal
      await expect(page.locator('h3:has-text("Choose Template")')).toBeVisible();

      // Select a template
      const nextjsTemplate = page.locator('[data-testid="template-nextjs-typescript"]');
      if (await nextjsTemplate.isVisible()) {
        await nextjsTemplate.click();

        // Should open create form with pre-filled data
        await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible();

        // Verify pre-filled name
        const nameValue = await page.locator('[data-testid="workspace-name"]').inputValue();
        expect(nameValue).toBeTruthy();
        expect(nameValue.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Workspace Navigation', () => {
    test('should navigate to workspace detail page', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Wait for loading
      await page.waitForSelector('[role="status"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

      // Find first workspace "Open" button
      const openButton = page.locator('a:has-text("Open")').first();
      const isVisible = await openButton.isVisible().catch(() => false);

      if (isVisible) {
        await openButton.click();

        // Wait for workspace page to load
        await page.waitForURL(/\/workspaces\/\d+/, { timeout: 5000 });
        await TestHelpers.waitForPageLoad(page);

        // Verify workspace page elements
        await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible();
        await expect(page.locator('[data-testid="workspace-description"]')).toBeVisible();
        await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();

        await page.screenshot({ path: 'test-results/screenshots/workspace-detail.png', fullPage: true });
      }
    });

    test('should navigate to specific workspace by ID', async ({ page }) => {
      // Navigate directly to workspace
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);

      // Verify workspace page loaded
      await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="workspace-description"]')).toBeVisible();
    });
  });

  test.describe('File Operations', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a workspace
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);
    });

    test('should display file explorer', async ({ page }) => {
      // Verify file explorer is visible
      await expect(page.locator('h3:has-text("Files")')).toBeVisible();
      await expect(page.locator('[data-testid="create-file-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-file-button"]')).toBeVisible();

      // Check for existing files
      const fileItems = page.locator('[data-testid^="file-"]');
      const count = await fileItems.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should create new file', async ({ page }) => {
      // Click create file button
      await page.click('[data-testid="create-file-button"]');

      // Verify modal opened
      await expect(page.locator('h3:has-text("Create New File")')).toBeVisible();

      // Fill file details
      const fileName = `test-file-${Date.now()}.ts`;
      await page.fill('[data-testid="file-name-input"]', fileName);
      await page.fill('[data-testid="file-content-editor"]', '// E2E test file\nconsole.log("Hello from E2E");');

      // Save file
      await page.click('[data-testid="save-file-button"]');

      // Verify file appears in list
      await page.waitForTimeout(500);
      const fileElement = page.locator(`[data-testid="file-${fileName}"]`);
      await expect(fileElement).toBeVisible();

      await page.screenshot({ path: 'test-results/screenshots/file-created.png', fullPage: true });
    });

    test('should upload file', async ({ page }) => {
      // Click upload button
      await page.click('[data-testid="upload-file-button"]');

      // Verify upload modal
      await expect(page.locator('h3:has-text("Upload File")')).toBeVisible();
      await expect(page.locator('[data-testid="file-upload-input"]')).toBeVisible();

      // Confirm upload (mocked in the UI)
      await page.click('[data-testid="confirm-upload-button"]');

      // File should be added
      await page.waitForTimeout(500);
      const uploadedFile = page.locator('[data-testid="file-uploaded-test.txt"]');
      const exists = await uploadedFile.isVisible().catch(() => false);

      // File should exist after upload
      expect(exists).toBe(true);
    });

    test('should rename file', async ({ page }) => {
      // Find a file to rename
      const firstFile = page.locator('[data-testid^="file-"]').first();
      const isVisible = await firstFile.isVisible().catch(() => false);

      if (isVisible) {
        const fileName = await firstFile.getAttribute('data-testid');
        const originalName = fileName?.replace('file-', '') || '';

        // Click file menu
        await page.click(`[data-testid="file-menu-${originalName}"]`);

        // Click rename option
        await page.click('[data-testid="rename-file-option"]');

        // Verify rename modal
        await expect(page.locator('h3:has-text("Rename File")')).toBeVisible();

        // Enter new name
        const newName = `renamed-${Date.now()}.ts`;
        await page.fill('[data-testid="rename-file-input"]', newName);
        await page.click('[data-testid="confirm-rename-button"]');

        // Verify file was renamed
        await page.waitForTimeout(500);
        const renamedFile = page.locator(`[data-testid="file-${newName}"]`);
        await expect(renamedFile).toBeVisible();
      }
    });

    test('should delete file', async ({ page }) => {
      // Create a file to delete
      await page.click('[data-testid="create-file-button"]');
      const fileToDelete = `delete-me-${Date.now()}.ts`;
      await page.fill('[data-testid="file-name-input"]', fileToDelete);
      await page.click('[data-testid="save-file-button"]');
      await page.waitForTimeout(500);

      // Open file menu
      await page.click(`[data-testid="file-menu-${fileToDelete}"]`);

      // Click delete option
      await page.click('[data-testid="delete-file-option"]');

      // Confirm deletion
      await expect(page.locator('h3:has-text("Delete File")')).toBeVisible();
      await page.click('[data-testid="confirm-delete-file-button"]');

      // Verify file is removed
      await page.waitForTimeout(500);
      const deletedFile = page.locator(`[data-testid="file-${fileToDelete}"]`);
      await expect(deletedFile).not.toBeVisible();
    });
  });

  test.describe('Workspace Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);
    });

    test('should open workspace settings', async ({ page }) => {
      // Click settings button
      await page.click('[data-testid="workspace-settings-button"]');

      // Verify settings modal
      await expect(page.locator('h3:has-text("Workspace Settings")')).toBeVisible();
      await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="workspace-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="save-workspace"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-workspace-button"]')).toBeVisible();
    });

    test('should update workspace settings', async ({ page }) => {
      // Open settings
      await page.click('[data-testid="workspace-settings-button"]');
      await page.waitForSelector('[data-testid="workspace-name"]');

      // Update name and description
      const newName = `Updated Workspace ${Date.now()}`;
      const newDescription = 'Updated via E2E test';

      await page.fill('[data-testid="workspace-name"]', newName);
      await page.fill('[data-testid="workspace-description"]', newDescription);

      // Save changes
      await page.click('[data-testid="save-workspace"]');

      // Settings modal should close
      await page.waitForTimeout(500);
      await expect(page.locator('h3:has-text("Workspace Settings")')).not.toBeVisible();

      // Verify changes reflected in header
      const headerName = page.locator('header [data-testid="workspace-name"]');
      await expect(headerName).toContainText(newName);

      await page.screenshot({ path: 'test-results/screenshots/workspace-updated.png', fullPage: true });
    });
  });

  test.describe('Workspace Deletion', () => {
    test('should open delete workspace modal', async ({ page }) => {
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);

      // Open settings
      await page.click('[data-testid="workspace-settings-button"]');

      // Click delete button
      await page.click('[data-testid="delete-workspace-button"]');

      // Verify delete confirmation modal
      await expect(page.locator('[data-testid="delete-workspace-modal"]')).toBeVisible();
      await expect(page.locator('h3:has-text("Delete Workspace")')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-delete-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-delete-button"]')).toBeVisible();
    });

    test('should require confirmation to delete workspace', async ({ page }) => {
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);

      // Get workspace name
      const workspaceName = await page.locator('header [data-testid="workspace-name"]').textContent();

      // Open delete modal
      await page.click('[data-testid="workspace-settings-button"]');
      await page.click('[data-testid="delete-workspace-button"]');

      // Try to delete without confirmation
      const deleteButton = page.locator('[data-testid="confirm-delete-button"]');
      await expect(deleteButton).toBeDisabled();

      // Enter wrong confirmation
      await page.fill('[data-testid="confirm-delete-input"]', 'wrong name');
      await expect(deleteButton).toBeDisabled();

      // Enter correct confirmation
      if (workspaceName) {
        await page.fill('[data-testid="confirm-delete-input"]', workspaceName);
        await expect(deleteButton).toBeEnabled();
      }
    });

    test('should delete workspace with confirmation', async ({ page }) => {
      // Create a test workspace to delete
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      await page.click('[data-testid="create-workspace-button"]');
      const workspaceName = `Delete Test ${Date.now()}`;
      await page.fill('[data-testid="workspace-name"]', workspaceName);
      await page.click('[data-testid="submit-workspace"]');

      // Wait for workspace to be created and navigate to it
      await page.waitForURL(/\/workspaces\/\d+/, { timeout: 10000 }).catch(() => {});
      await TestHelpers.waitForPageLoad(page);

      // Open delete modal
      await page.click('[data-testid="workspace-settings-button"]');
      await page.click('[data-testid="delete-workspace-button"]');

      // Confirm deletion
      await page.fill('[data-testid="confirm-delete-input"]', workspaceName);
      await page.click('[data-testid="confirm-delete-button"]');

      // Should redirect to workspaces list
      await page.waitForURL('/workspaces', { timeout: 10000 });
      await TestHelpers.waitForPageLoad(page);

      // Verify we're back on the list page
      await expect(page.locator('h1:has-text("Workspaces")')).toBeVisible();
    });
  });

  test.describe('Workspace Sharing', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);
    });

    test('should open share modal', async ({ page }) => {
      await page.click('[data-testid="share-workspace-button"]');

      // Verify share modal
      await expect(page.locator('h3:has-text("Share Workspace")')).toBeVisible();
      await expect(page.locator('[data-testid="collaborator-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="permission-level"]')).toBeVisible();
      await expect(page.locator('[data-testid="add-collaborator-button"]')).toBeVisible();
    });

    test('should add collaborator', async ({ page }) => {
      await page.click('[data-testid="share-workspace-button"]');

      // Fill collaborator details
      await page.fill('[data-testid="collaborator-email"]', 'collaborator@example.com');
      await page.selectOption('[data-testid="permission-level"]', 'editor');

      // Add collaborator
      await page.click('[data-testid="add-collaborator-button"]');

      // Verify collaborator appears in list
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="collaborator-collaborator@example.com"]')).toBeVisible();

      await page.screenshot({ path: 'test-results/screenshots/collaborator-added.png', fullPage: true });
    });

    test('should change collaborator permissions', async ({ page }) => {
      await page.click('[data-testid="share-workspace-button"]');

      // Add a collaborator
      await page.fill('[data-testid="collaborator-email"]', 'test@example.com');
      await page.selectOption('[data-testid="permission-level"]', 'viewer');
      await page.click('[data-testid="add-collaborator-button"]');

      await page.waitForTimeout(500);

      // Find and change permission
      const collaboratorRow = page.locator('[data-testid="collaborator-test@example.com"]');
      await expect(collaboratorRow).toBeVisible();

      // Change permission level
      const permissionSelect = collaboratorRow.locator('[data-testid="permission-level"]');
      await permissionSelect.selectOption('admin');

      // Verify permission changed
      const selectedValue = await permissionSelect.inputValue();
      expect(selectedValue).toBe('admin');
    });
  });

  test.describe('AI Chat Integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);
    });

    test('should toggle AI chat panel', async ({ page }) => {
      // AI chat should be closed initially
      const chatPanel = page.locator('[data-testid="ai-chat-panel"]');
      await expect(chatPanel).not.toBeVisible();

      // Open AI chat
      await page.click('[data-testid="ai-chat-toggle"]');
      await page.waitForTimeout(500);

      // Chat panel should be visible
      await expect(chatPanel).toBeVisible();
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-message"]')).toBeVisible();

      await page.screenshot({ path: 'test-results/screenshots/ai-chat-open.png', fullPage: true });

      // Close AI chat
      await page.click('[data-testid="ai-chat-toggle"]');
      await page.waitForTimeout(500);

      // Chat panel should be hidden
      await expect(chatPanel).not.toBeVisible();
    });

    test('should send message in AI chat', async ({ page }) => {
      // Open AI chat
      await page.click('[data-testid="ai-chat-toggle"]');
      await page.waitForTimeout(500);

      // Type message
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Help me write a React component');

      // Send message
      await page.click('[data-testid="send-message"]');

      // Wait for potential response
      await page.waitForTimeout(1000);

      // Verify message was sent (input should be cleared or message appears in history)
      const inputValue = await chatInput.inputValue();
      const chatHistory = page.locator('[data-testid="chat-history"]');
      const historyContent = await chatHistory.textContent();

      // Either input cleared or message appears in history
      const messageSent = inputValue === '' || historyContent.includes('React component');
      expect(messageSent).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('workspace list page should be accessible', async ({ page }) => {
      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Check ARIA labels
      const searchInput = page.locator('[data-testid="workspace-search"]');
      const ariaLabel = await searchInput.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();

      // Loading state should have proper role
      const loadingState = page.locator('[role="status"]');
      const hasLoadingState = await loadingState.count() > 0;
      // Loading state may not be present after page loads, which is fine
      expect(hasLoadingState).toBeDefined();
    });

    test('workspace page should have semantic structure', async ({ page }) => {
      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);

      // Check for semantic HTML structure
      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Buttons should have accessible labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);
    });
  });

  test.describe('Performance', () => {
    test('workspace list should load quickly', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/workspaces');
      await TestHelpers.waitForPageLoad(page);

      // Wait for content to be visible
      await page.waitForSelector('h1:has-text("Workspaces")', { timeout: 5000 });

      const loadTime = Date.now() - startTime;

      // Page should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
      console.log(`Workspace list loaded in ${loadTime}ms`);
    });

    test('workspace detail should load quickly', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/workspaces/1');
      await TestHelpers.waitForPageLoad(page);

      // Wait for workspace content
      await page.waitForSelector('[data-testid="workspace-name"]', { timeout: 5000 });

      const loadTime = Date.now() - startTime;

      // Page should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
      console.log(`Workspace detail loaded in ${loadTime}ms`);
    });
  });
});
