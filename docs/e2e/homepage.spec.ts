/**
 * E2E tests for the homepage
 */
import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the main heading', async ({ page }) => {
    await expect(page).toHaveTitle(/VibeCode WebGUI/)

    // Check for main heading or welcome message
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Check that the page content is visible and properly laid out
    const content = page.locator('main')
    await expect(content).toBeVisible()

    // Check that content doesn't overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(375)
  })

  test('should have no accessibility violations', async ({ page }) => {
    // Basic accessibility checks
    await expect(page.locator('html')).toHaveAttribute('lang')

    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBeGreaterThanOrEqual(1)

    // Check for alt text on images
    const images = page.locator('img')
    const imageCount = await images.count()

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      await expect(img).toHaveAttribute('alt')
    }
  })

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/', { waitUntil: 'networkidle' })

    const loadTime = Date.now() - startTime

    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should handle network failures gracefully', async ({ page, context }) => {
    // Simulate offline condition
    await context.setOffline(true)

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Should handle the failure gracefully
    expect(response).toBeNull()

    // Go back online
    await context.setOffline(false)

    // Should be able to reload
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })
})
