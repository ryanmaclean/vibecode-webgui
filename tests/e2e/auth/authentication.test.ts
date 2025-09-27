/**
 * E2E Tests for Authentication Flow
 * Tests user login, logout, registration, and session management
 */

import { test, expect } from '@playwright/test'
import TestHelpers from '../utils/test-helpers'
import testData from '../fixtures/test-data.json'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure clean state
    await TestHelpers.cleanup()
  })

  test.afterEach(async ({ page }) => {
    await TestHelpers.logout(page).catch(() => {}) // Ignore errors if already logged out
  })

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Verify page elements
    await expect(page.locator('h1')).toContainText('Sign In')
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="signin-button"]')).toBeVisible()
    
    // Check for OAuth providers if configured
    const githubButton = page.locator('[data-testid="github-signin"]')
    const googleButton = page.locator('[data-testid="google-signin"]')
    
    if (await githubButton.isVisible()) {
      await expect(githubButton).toContainText('GitHub')
    }
    
    if (await googleButton.isVisible()) {
      await expect(googleButton).toContainText('Google')
    }
  })

  test('should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Test empty form submission
    await page.click('[data-testid="signin-button"]')
    await TestHelpers.assertErrorMessage(page, 'Email is required')
    
    // Test invalid email format
    await page.fill('[data-testid="email-input"]', 'invalid-email')
    await page.click('[data-testid="signin-button"]')
    await TestHelpers.assertErrorMessage(page, 'Invalid email format')
    
    // Test valid email but empty password
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', '')
    await page.click('[data-testid="signin-button"]')
    await TestHelpers.assertErrorMessage(page, 'Password is required')
  })

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin')
    
    await page.fill('[data-testid="email-input"]', 'nonexistent@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="signin-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Invalid credentials')
    
    // Should remain on login page
    await expect(page).toHaveURL('/auth/signin')
  })

  test('should successfully login with valid credentials', async ({ page }) => {
    // Create a test user first
    const testUser = await TestHelpers.createTestUser(testData.users.user)
    
    await page.goto('/auth/signin')
    await page.fill('[data-testid="email-input"]', testUser.email)
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="signin-button"]')
    
    // Should redirect to dashboard after successful login
    await page.waitForURL('/', { timeout: 10000 })
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-name"]')).toContainText(testUser.name)
  })

  test('should persist login session across page reloads', async ({ page }) => {
    // Login first
    await TestHelpers.loginAsTestUser(page, 'user')
    
    // Reload page
    await page.reload()
    await TestHelpers.waitForPageLoad(page)
    
    // Should still be logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    await expect(page).toHaveURL('/')
  })

  test('should successfully logout', async ({ page }) => {
    await TestHelpers.loginAsTestUser(page, 'user')
    
    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')
    
    // Should redirect to login page
    await page.waitForURL('/auth/signin', { timeout: 5000 })
    
    // Verify user is logged out
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
  })

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/workspaces')
    
    // Should redirect to login
    await page.waitForURL('/auth/signin', { timeout: 5000 })
    
    // Login and try again
    await TestHelpers.loginAsTestUser(page, 'user')
    await page.goto('/workspaces')
    
    // Should now be able to access the route
    await expect(page).toHaveURL('/workspaces')
    await expect(page.locator('h1')).toContainText('Workspaces')
  })

  test('should handle registration flow', async ({ page }) => {
    await page.goto('/auth/signup')
    
    // Fill registration form
    const newUser = {
      name: 'New Test User',
      email: 'newuser@test.com',
      password: 'testpassword123',
      confirmPassword: 'testpassword123'
    }
    
    await page.fill('[data-testid="name-input"]', newUser.name)
    await page.fill('[data-testid="email-input"]', newUser.email)
    await page.fill('[data-testid="password-input"]', newUser.password)
    await page.fill('[data-testid="confirm-password-input"]', newUser.confirmPassword)
    
    await page.click('[data-testid="signup-button"]')
    
    // Should redirect to dashboard after successful registration
    await page.waitForURL('/', { timeout: 10000 })
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-name"]')).toContainText(newUser.name)
  })

  test('should handle password confirmation validation', async ({ page }) => {
    await page.goto('/auth/signup')
    
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'differentpassword')
    
    await page.click('[data-testid="signup-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Passwords do not match')
  })

  test('should handle weak password validation', async ({ page }) => {
    await page.goto('/auth/signup')
    
    await page.fill('[data-testid="name-input"]', 'Test User')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', '123') // Too short
    await page.fill('[data-testid="confirm-password-input"]', '123')
    
    await page.click('[data-testid="signup-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Password must be at least 8 characters')
  })

  test('should prevent duplicate email registration', async ({ page }) => {
    // Create existing user
    const existingUser = await TestHelpers.createTestUser({
      email: 'existing@test.com',
      name: 'Existing User'
    })
    
    await page.goto('/auth/signup')
    
    // Try to register with same email
    await page.fill('[data-testid="name-input"]', 'Another User')
    await page.fill('[data-testid="email-input"]', existingUser.email)
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.fill('[data-testid="confirm-password-input"]', 'testpassword123')
    
    await page.click('[data-testid="signup-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Email already registered')
  })

  test('should handle session timeout', async ({ page }) => {
    await TestHelpers.loginAsTestUser(page, 'user')
    
    // Simulate session timeout by clearing session storage
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
      // Clear cookies
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=")
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      })
    })
    
    // Try to access a protected route
    await page.goto('/workspaces')
    
    // Should redirect to login due to expired session
    await page.waitForURL('/auth/signin', { timeout: 5000 })
  })
})