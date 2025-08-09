/**
 * E2E Tests for Workspace Management
 * Tests workspace creation, deletion, editing, and file operations
 */

import { test, expect } from '@playwright/test'
import TestHelpers from '../utils/test-helpers'
import testData from '../fixtures/test-data.json'

test.describe('Workspace Management', () => {
  let testUser: any

  test.beforeEach(async ({ page }) => {
    await TestHelpers.cleanup()
    testUser = await TestHelpers.createTestUser(testData.users.user)
    await TestHelpers.loginAsTestUser(page, 'user')
  })

  test.afterEach(async ({ page }) => {
    await TestHelpers.cleanup()
  })

  test('should display workspaces page correctly', async ({ page }) => {
    await page.goto('/workspaces')
    
    // Verify page structure
    await expect(page.locator('h1')).toContainText('Workspaces')
    await expect(page.locator('[data-testid="create-workspace-button"]')).toBeVisible()
    
    // Should show empty state initially
    const emptyState = page.locator('[data-testid="empty-workspaces"]')
    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText('No workspaces found')
    }
  })

  test('should create a new workspace', async ({ page }) => {
    const workspaceName = 'E2E Test Workspace'
    const workspaceDescription = 'Created during E2E testing'
    
    await TestHelpers.createWorkspaceViaUI(page, workspaceName, workspaceDescription)
    
    // Should be redirected to the new workspace
    await expect(page).toHaveURL(/\/workspaces\/\d+/)
    
    // Verify workspace details
    await expect(page.locator('[data-testid="workspace-name"]')).toContainText(workspaceName)
    await expect(page.locator('[data-testid="workspace-description"]')).toContainText(workspaceDescription)
  })

  test('should validate workspace creation form', async ({ page }) => {
    await page.goto('/workspaces')
    await page.click('[data-testid="create-workspace-button"]')
    
    // Try to submit empty form
    await page.click('[data-testid="submit-workspace"]')
    await TestHelpers.assertErrorMessage(page, 'Workspace name is required')
    
    // Test name too short
    await page.fill('[data-testid="workspace-name"]', 'ab')
    await page.click('[data-testid="submit-workspace"]')
    await TestHelpers.assertErrorMessage(page, 'Workspace name must be at least 3 characters')
    
    // Test name too long
    const longName = 'a'.repeat(101)
    await page.fill('[data-testid="workspace-name"]', longName)
    await page.click('[data-testid="submit-workspace"]')
    await TestHelpers.assertErrorMessage(page, 'Workspace name must be less than 100 characters')
  })

  test('should edit workspace details', async ({ page }) => {
    // Create workspace first
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    // Edit workspace
    await page.click('[data-testid="edit-workspace-button"]')
    
    const newName = 'Updated Workspace Name'
    const newDescription = 'Updated description'
    
    await page.fill('[data-testid="workspace-name"]', newName)
    await page.fill('[data-testid="workspace-description"]', newDescription)
    await page.click('[data-testid="save-workspace"]')
    
    // Verify changes
    await TestHelpers.assertNotification(page, 'Workspace updated successfully')
    await expect(page.locator('[data-testid="workspace-name"]')).toContainText(newName)
    await expect(page.locator('[data-testid="workspace-description"]')).toContainText(newDescription)
  })

  test('should delete workspace', async ({ page }) => {
    // Create workspace first
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    // Delete workspace
    await page.click('[data-testid="workspace-settings-button"]')
    await page.click('[data-testid="delete-workspace-button"]')
    
    // Confirm deletion in modal
    await page.fill('[data-testid="confirm-delete-input"]', workspace.name)
    await page.click('[data-testid="confirm-delete-button"]')
    
    // Should redirect to workspaces list
    await page.waitForURL('/workspaces', { timeout: 5000 })
    await TestHelpers.assertNotification(page, 'Workspace deleted successfully')
  })

  test('should prevent workspace deletion without confirmation', async ({ page }) => {
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    await page.click('[data-testid="workspace-settings-button"]')
    await page.click('[data-testid="delete-workspace-button"]')
    
    // Try to delete without typing workspace name
    await page.click('[data-testid="confirm-delete-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Please type the workspace name to confirm deletion')
    
    // Dialog should still be open
    await expect(page.locator('[data-testid="delete-workspace-modal"]')).toBeVisible()
  })

  test('should create and manage files in workspace', async ({ page }) => {
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    // Create a new file
    await page.click('[data-testid="create-file-button"]')
    
    const fileName = 'test-file.js'
    const fileContent = testData.files.javascript.content
    
    await page.fill('[data-testid="file-name-input"]', fileName)
    await page.fill('[data-testid="file-content-editor"]', fileContent)
    await page.click('[data-testid="save-file-button"]')
    
    // Verify file was created
    await TestHelpers.assertNotification(page, 'File created successfully')
    await expect(page.locator(`[data-testid="file-${fileName}"]`)).toBeVisible()
  })

  test('should upload files to workspace', async ({ page }) => {
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    // Create a temporary test file
    const testFile = 'test-upload.txt'
    const testContent = 'This is a test file for upload'
    
    // Upload file
    await page.click('[data-testid="upload-file-button"]')
    
    // Mock file upload (in real test, you'd create actual file)
    await page.evaluate(([fileName, content]) => {
      const dataTransfer = new DataTransfer()
      const file = new File([content], fileName, { type: 'text/plain' })
      dataTransfer.items.add(file)
      
      const fileInput = document.querySelector('[data-testid="file-upload-input"]')
      if (fileInput) {
        fileInput.files = dataTransfer.files
        fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, [testFile, testContent])
    
    await page.click('[data-testid="confirm-upload-button"]')
    
    // Verify file was uploaded
    await TestHelpers.assertNotification(page, 'File uploaded successfully')
    await expect(page.locator(`[data-testid="file-${testFile}"]`)).toBeVisible()
  })

  test('should handle file operations (rename, delete)', async ({ page }) => {
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    // Create a file first
    await page.click('[data-testid="create-file-button"]')
    const originalFileName = 'original-file.js'
    await page.fill('[data-testid="file-name-input"]', originalFileName)
    await page.fill('[data-testid="file-content-editor"]', 'console.log("test")')
    await page.click('[data-testid="save-file-button"]')
    
    // Rename file
    await page.click(`[data-testid="file-menu-${originalFileName}"]`)
    await page.click('[data-testid="rename-file-option"]')
    
    const newFileName = 'renamed-file.js'
    await page.fill('[data-testid="rename-file-input"]', newFileName)
    await page.click('[data-testid="confirm-rename-button"]')
    
    await TestHelpers.assertNotification(page, 'File renamed successfully')
    await expect(page.locator(`[data-testid="file-${newFileName}"]`)).toBeVisible()
    
    // Delete file
    await page.click(`[data-testid="file-menu-${newFileName}"]`)
    await page.click('[data-testid="delete-file-option"]')
    await page.click('[data-testid="confirm-delete-file-button"]')
    
    await TestHelpers.assertNotification(page, 'File deleted successfully')
    await expect(page.locator(`[data-testid="file-${newFileName}"]`)).not.toBeVisible()
  })

  test('should handle workspace search and filtering', async ({ page }) => {
    // Create multiple workspaces
    const workspaces = await Promise.all([
      TestHelpers.createTestWorkspace(testUser.id, { 
        name: 'Frontend Project',
        description: 'React and Next.js development'
      }),
      TestHelpers.createTestWorkspace(testUser.id, { 
        name: 'Backend API',
        description: 'Node.js API development'
      }),
      TestHelpers.createTestWorkspace(testUser.id, { 
        name: 'Mobile App',
        description: 'React Native mobile development'
      })
    ])
    
    await page.goto('/workspaces')
    
    // Search for specific workspace
    await page.fill('[data-testid="workspace-search"]', 'Frontend')
    await page.waitForTimeout(500) // Wait for debounced search
    
    await expect(page.locator('[data-testid="workspace-Frontend Project"]')).toBeVisible()
    await expect(page.locator('[data-testid="workspace-Backend API"]')).not.toBeVisible()
    
    // Clear search
    await page.fill('[data-testid="workspace-search"]', '')
    await page.waitForTimeout(500)
    
    // All workspaces should be visible again
    await expect(page.locator('[data-testid="workspace-Frontend Project"]')).toBeVisible()
    await expect(page.locator('[data-testid="workspace-Backend API"]')).toBeVisible()
    await expect(page.locator('[data-testid="workspace-Mobile App"]')).toBeVisible()
  })

  test('should handle workspace permissions and sharing', async ({ page }) => {
    const workspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.team)
    
    await page.goto(`/workspaces/${workspace.id}`)
    
    // Open sharing dialog
    await page.click('[data-testid="share-workspace-button"]')
    
    // Add collaborator
    const collaboratorEmail = 'collaborator@test.com'
    await page.fill('[data-testid="collaborator-email"]', collaboratorEmail)
    await page.selectOption('[data-testid="permission-level"]', 'editor')
    await page.click('[data-testid="add-collaborator-button"]')
    
    // Verify collaborator was added
    await TestHelpers.assertNotification(page, 'Collaborator added successfully')
    await expect(page.locator(`[data-testid="collaborator-${collaboratorEmail}"]`)).toBeVisible()
    
    // Change permission level
    await page.click(`[data-testid="edit-collaborator-${collaboratorEmail}"]`)
    await page.selectOption('[data-testid="permission-level"]', 'viewer')
    await page.click('[data-testid="save-permission-button"]')
    
    await TestHelpers.assertNotification(page, 'Permission updated successfully')
  })

  test('should handle workspace templates', async ({ page }) => {
    await page.goto('/workspaces')
    await page.click('[data-testid="create-workspace-button"]')
    
    // Select template
    await page.click('[data-testid="use-template-button"]')
    await page.click('[data-testid="template-nextjs-typescript"]')
    
    const workspaceName = 'Template-based Workspace'
    await page.fill('[data-testid="workspace-name"]', workspaceName)
    await page.click('[data-testid="create-from-template-button"]')
    
    // Should create workspace with template files
    await TestHelpers.assertNotification(page, 'Workspace created from template')
    
    // Verify template files are present
    await expect(page.locator('[data-testid="file-package.json"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-tsconfig.json"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-next.config.js"]')).toBeVisible()
  })
})