/**
 * E2E Test Helper Utilities
 * Common functions for authentication, database, and test setup
 */

import { Page, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

export class TestHelpers {
  private static prisma = new PrismaClient()
  
  /**
   * Authentication helpers
   */
  static async loginAsTestUser(page: Page, userType: 'admin' | 'user' = 'user') {
    const testUser = userType === 'admin' 
      ? { email: 'admin@test.com', password: 'testpassword123' }
      : { email: 'user@test.com', password: 'testpassword123' }
    
    await page.goto('/auth/signin')
    await page.fill('[data-testid="email-input"]', testUser.email)
    await page.fill('[data-testid="password-input"]', testUser.password)
    await page.click('[data-testid="signin-button"]')
    
    // Wait for successful login redirect
    await page.waitForURL('/', { timeout: 10000 })
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  }
  
  static async logout(page: Page) {
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')
    await page.waitForURL('/auth/signin', { timeout: 5000 })
  }
  
  /**
   * Database helpers
   */
  static async createTestUser(overrides: Partial<any> = {}) {
    return await this.prisma.user.create({
      data: {
        email: 'test-user@example.com',
        name: 'Test User',
        role: 'user',
        avatar: 'https://example.com/avatar.jpg',
        ...overrides
      }
    })
  }
  
  static async createTestWorkspace(userId: number, overrides: Partial<any> = {}) {
    return await this.prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        description: 'A workspace for testing',
        owner_id: userId,
        status: 'active',
        ...overrides
      }
    })
  }
  
  static async createTestProject(workspaceId: number, overrides: Partial<any> = {}) {
    return await this.prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'A project for testing',
        workspace_id: workspaceId,
        status: 'active',
        ...overrides
      }
    })
  }
  
  static async cleanupTestData() {
    // Clean up in proper order to respect foreign keys
    await this.prisma.aIRequest.deleteMany({
      where: { user_id: { in: await this.getTestUserIds() } }
    })
    await this.prisma.rAGChunk.deleteMany()
    await this.prisma.file.deleteMany({
      where: { workspace_id: { in: await this.getTestWorkspaceIds() } }
    })
    await this.prisma.project.deleteMany({
      where: { workspace_id: { in: await this.getTestWorkspaceIds() } }
    })
    await this.prisma.workspace.deleteMany({
      where: { name: { contains: 'Test' } }
    })
    await this.prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    })
  }
  
  private static async getTestUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: { email: { contains: 'test' } },
      select: { id: true }
    })
    return users.map(u => u.id)
  }
  
  private static async getTestWorkspaceIds(): Promise<number[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: { name: { contains: 'Test' } },
      select: { id: true }
    })
    return workspaces.map(w => w.id)
  }
  
  /**
   * UI interaction helpers
   */
  static async waitForPageLoad(page: Page) {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500) // Additional buffer for dynamic content
  }
  
  static async fillAndSubmitForm(page: Page, formData: Record<string, string>, submitSelector: string) {
    for (const [field, value] of Object.entries(formData)) {
      await page.fill(`[data-testid="${field}"]`, value)
    }
    await page.click(submitSelector)
  }
  
  static async assertNotification(page: Page, message: string, type: 'success' | 'error' | 'info' = 'success') {
    const notification = page.locator(`[data-testid="notification-${type}"]`)
    await expect(notification).toBeVisible()
    await expect(notification).toContainText(message)
  }
  
  static async assertErrorMessage(page: Page, message: string) {
    const errorElement = page.locator('[data-testid="error-message"]')
    await expect(errorElement).toBeVisible()
    await expect(errorElement).toContainText(message)
  }
  
  /**
   * File upload helpers
   */
  static async uploadFile(page: Page, filePath: string, inputSelector: string = '[data-testid="file-input"]') {
    const fileInput = page.locator(inputSelector)
    await fileInput.setInputFiles(filePath)
  }
  
  /**
   * API helpers
   */
  static async makeAPIRequest(page: Page, endpoint: string, options: any = {}) {
    return await page.request.get(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
  }
  
  /**
   * Monitoring helpers
   */
  static async checkHealthEndpoint(page: Page) {
    const response = await this.makeAPIRequest(page, '/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('healthy')
    return body
  }
  
  static async waitForMetrics(page: Page, metric: string, timeout: number = 5000) {
    await page.waitForFunction((metricName) => {
      return window.performance && window.performance.getEntriesByName(metricName).length > 0
    }, metric, { timeout })
  }
  
  /**
   * Workspace specific helpers
   */
  static async createWorkspaceViaUI(page: Page, workspaceName: string, description: string = '') {
    await page.goto('/workspaces')
    await page.click('[data-testid="create-workspace-button"]')
    await page.fill('[data-testid="workspace-name"]', workspaceName)
    if (description) {
      await page.fill('[data-testid="workspace-description"]', description)
    }
    await page.click('[data-testid="submit-workspace"]')
    
    // Wait for creation to complete
    await this.assertNotification(page, 'Workspace created successfully')
    await this.waitForPageLoad(page)
  }
  
  /**
   * AI interaction helpers
   */
  static async sendChatMessage(page: Page, message: string) {
    await page.fill('[data-testid="chat-input"]', message)
    await page.click('[data-testid="send-message"]')
    
    // Wait for response
    await page.waitForSelector('[data-testid="chat-response"]', { timeout: 10000 })
  }
  
  static async waitForAIResponse(page: Page, timeout: number = 15000) {
    await page.waitForSelector('[data-testid="chat-response"]:not([data-loading="true"])', { timeout })
  }
  
  /**
   * Cleanup helper
   */
  static async cleanup() {
    await this.cleanupTestData()
    await this.prisma.$disconnect()
  }
}

export default TestHelpers