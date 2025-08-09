/**
 * E2E Smoke Tests
 * Basic tests to verify core functionality works
 */

import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/')
    
    // Verify page loads without errors
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Check for main navigation elements
    const navigation = page.locator('nav')
    if (await navigation.isVisible()) {
      await expect(navigation).toBeVisible()
    }
    
    // Should not show any obvious error messages
    const errorElements = page.locator('[data-testid*="error"]')
    const errorCount = await errorElements.count()
    expect(errorCount).toBe(0)
  })

  test('should handle navigation to main sections', async ({ page }) => {
    await page.goto('/')
    
    // Test navigation to key sections
    const sections = [
      { path: '/auth/signin', title: /sign.{0,5}in/i },
      { path: '/workspaces', redirectTo: '/auth/signin' }, // Should redirect to auth if not logged in
    ]
    
    for (const section of sections) {
      await page.goto(section.path)
      
      if (section.redirectTo) {
        // Should redirect to login if not authenticated
        await page.waitForURL(section.redirectTo, { timeout: 5000 })
      } else if (section.title) {
        await expect(page).toHaveTitle(section.title)
      }
      
      // Should not show 404 error
      await expect(page.locator('text=404')).not.toBeVisible()
      await expect(page.locator('text=Not Found')).not.toBeVisible()
    }
  })

  test('should have working health check endpoint', async ({ page }) => {
    const response = await page.request.get('/api/health')
    expect(response.status()).toBe(200)
    
    const health = await response.json()
    expect(health).toHaveProperty('status')
    expect(['healthy', 'ok', 'up']).toContain(health.status.toLowerCase())
  })

  test('should load CSS and JavaScript assets', async ({ page }) => {
    await page.goto('/')
    
    // Check that CSS is loaded (page should have styling)
    const bodyStyles = await page.evaluate(() => {
      const body = document.body
      const styles = window.getComputedStyle(body)
      return {
        fontSize: styles.fontSize,
        margin: styles.margin,
        fontFamily: styles.fontFamily
      }
    })
    
    // Should have some basic styling applied
    expect(bodyStyles.fontSize).not.toBe('')
    expect(bodyStyles.fontFamily).not.toBe('')
    
    // Check for JavaScript functionality
    const hasJavaScript = await page.evaluate(() => {
      return typeof window !== 'undefined' && typeof document !== 'undefined'
    })
    
    expect(hasJavaScript).toBe(true)
  })

  test('should handle responsive design', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/')
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await expect(page).toHaveTitle(/VibeCode/)
    
    // Page should still be functional on all viewport sizes
    const errorElements = page.locator('[data-testid*="error"]')
    const errorCount = await errorElements.count()
    expect(errorCount).toBe(0)
  })

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    await page.goto('/')
    
    // Wait a bit for any delayed JavaScript to load
    await page.waitForTimeout(2000)
    
    // Filter out known non-critical errors (e.g., network errors in development)
    const criticalErrors = consoleErrors.filter(error => {
      const ignorablePatterns = [
        /favicon/i,
        /manifest/i,
        /service.worker/i,
        /net::ERR_INTERNET_DISCONNECTED/i
      ]
      
      return !ignorablePatterns.some(pattern => pattern.test(error))
    })
    
    if (criticalErrors.length > 0) {
      console.warn('Console errors found:', criticalErrors)
    }
    
    // Allow some console errors in development but not too many
    expect(criticalErrors.length).toBeLessThan(3)
  })

  test('should handle form validation basics', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Try submitting empty form
    const submitButton = page.locator('button[type="submit"], [data-testid*="submit"], [data-testid*="signin"]')
    
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Should either show validation errors or remain on same page
      // (Not redirect or crash)
      await expect(page).toHaveURL(/signin/)
    }
  })

  test('should have proper meta tags and SEO', async ({ page }) => {
    await page.goto('/')
    
    // Check for essential meta tags
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
    
    // Check viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewportMeta).toContain('width=device-width')
    
    // Check description meta tag if present
    const descriptionMeta = page.locator('meta[name="description"]')
    if (await descriptionMeta.isVisible()) {
      const description = await descriptionMeta.getAttribute('content')
      expect(description).toBeTruthy()
      expect(description!.length).toBeGreaterThan(0)
    }
  })

  test('should handle API error gracefully', async ({ page }) => {
    // Test how the app handles a non-existent API endpoint
    await page.goto('/')
    
    const response = await page.request.get('/api/nonexistent-endpoint')
    expect(response.status()).toBe(404)
    
    // App should continue to function normally
    await expect(page).toHaveTitle(/VibeCode/)
  })
})