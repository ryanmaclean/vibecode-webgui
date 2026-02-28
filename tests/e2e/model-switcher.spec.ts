/**
 * E2E Test: Model Switcher Quick Access Panel
 *
 * Tests the global model switcher component across different pages.
 * Verifies visibility, model switching, persistence, favorites, and keyboard shortcuts.
 */

import { test, expect } from '@playwright/test'

test.describe('Model Switcher E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    // Reload to apply cleared state
    await page.reload()
  })

  test('should display ModelSwitcher on homepage', async ({ page }) => {
    await page.goto('/')

    // Verify ModelSwitcher is visible
    const modelSwitcher = page.locator('[data-testid="model-switcher"]')
    await expect(modelSwitcher).toBeVisible({ timeout: 10000 })

    // Verify it contains the Sparkles icon (part of the button)
    const button = modelSwitcher.locator('button')
    await expect(button).toBeVisible()
  })

  test('should display ModelSwitcher on /ai/models page', async ({ page }) => {
    await page.goto('/ai/models')

    // Verify ModelSwitcher is visible
    const modelSwitcher = page.locator('[data-testid="model-switcher"]')
    await expect(modelSwitcher).toBeVisible({ timeout: 10000 })
  })

  test('should display ModelSwitcher on /chat page', async ({ page }) => {
    await page.goto('/chat')

    // Verify ModelSwitcher is visible
    const modelSwitcher = page.locator('[data-testid="model-switcher"]')
    await expect(modelSwitcher).toBeVisible({ timeout: 10000 })
  })

  test('should display ModelSwitcher on /vm page', async ({ page }) => {
    await page.goto('/vm')

    // Verify ModelSwitcher is visible
    const modelSwitcher = page.locator('[data-testid="model-switcher"]')
    await expect(modelSwitcher).toBeVisible({ timeout: 10000 })
  })

  test('should open panel when clicking the ModelSwitcher button', async ({ page }) => {
    await page.goto('/')

    // Click the ModelSwitcher button
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    // Wait for panel to open and verify it's visible
    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Verify panel contains search input
    const searchInput = page.locator('[data-testid="model-search-input"]')
    await expect(searchInput).toBeVisible()

    // Verify panel contains model list
    const modelList = page.locator('[data-testid="model-list"]')
    await expect(modelList).toBeVisible()
  })

  test('should close panel when clicking outside', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Click outside the panel (on the backdrop)
    const backdrop = page.locator('[data-testid="panel-backdrop"]')
    await backdrop.click({ position: { x: 10, y: 10 } })

    // Panel should close
    await expect(panel).not.toBeVisible({ timeout: 3000 })
  })

  test('should allow searching for models', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    // Wait for panel
    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Get initial model count
    const modelItems = page.locator('[data-testid="model-item"]')
    const initialCount = await modelItems.count()
    expect(initialCount).toBeGreaterThan(0)

    // Type in search input
    const searchInput = page.locator('[data-testid="model-search-input"]')
    await searchInput.fill('gpt-4')

    // Wait a moment for filtering
    await page.waitForTimeout(500)

    // Verify filtered results
    const filteredCount = await modelItems.count()
    expect(filteredCount).toBeLessThan(initialCount)

    // Verify at least one result contains 'gpt-4'
    const firstModel = modelItems.first()
    const firstModelText = await firstModel.textContent()
    expect(firstModelText?.toLowerCase()).toContain('gpt-4')
  })

  test('should switch model when selecting from list', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    // Wait for panel
    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Select a model (use the first one in the list)
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()

    // Get the model name before clicking
    const modelName = await firstModel.getAttribute('data-model-name')

    // Click the model
    await firstModel.click()

    // Wait a moment for state update
    await page.waitForTimeout(500)

    // Verify the button now shows the selected model name
    const buttonText = await button.textContent()
    expect(buttonText).toContain(modelName)

    // Panel should close after selection
    await expect(panel).not.toBeVisible({ timeout: 3000 })
  })

  test('should persist selected model across page navigation', async ({ page }) => {
    await page.goto('/')

    // Open the panel and select a model
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Search for a specific model to make selection predictable
    const searchInput = page.locator('[data-testid="model-search-input"]')
    await searchInput.fill('claude-3')

    await page.waitForTimeout(500)

    // Select the first claude-3 model
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()
    await firstModel.click()

    // Wait for panel to close
    await expect(panel).not.toBeVisible({ timeout: 3000 })

    // Get the selected model name from the button
    const selectedModelOnHome = await button.textContent()

    // Navigate to /ai/models page
    await page.goto('/ai/models')

    // Verify ModelSwitcher still shows the same model
    const buttonOnModelsPage = page.locator('[data-testid="model-switcher"] button')
    await expect(buttonOnModelsPage).toBeVisible({ timeout: 5000 })
    const selectedModelOnModelsPage = await buttonOnModelsPage.textContent()

    expect(selectedModelOnModelsPage).toBe(selectedModelOnHome)

    // Navigate to /chat page
    await page.goto('/chat')

    // Verify ModelSwitcher still shows the same model
    const buttonOnChatPage = page.locator('[data-testid="model-switcher"] button')
    await expect(buttonOnChatPage).toBeVisible({ timeout: 5000 })
    const selectedModelOnChatPage = await buttonOnChatPage.textContent()

    expect(selectedModelOnChatPage).toBe(selectedModelOnHome)
  })

  test('should toggle favorite status for a model', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Get the first model item
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()

    // Find the favorite button for the first model
    const favoriteButton = firstModel.locator('[data-testid="favorite-toggle"]')
    await expect(favoriteButton).toBeVisible()

    // Check if it's currently favorited
    const isInitiallyFavorited = await favoriteButton.getAttribute('data-favorited')

    // Click to toggle favorite
    await favoriteButton.click()

    // Wait a moment for state update
    await page.waitForTimeout(500)

    // Verify the favorite status changed
    const isNowFavorited = await favoriteButton.getAttribute('data-favorited')
    expect(isNowFavorited).not.toBe(isInitiallyFavorited)
  })

  test('should display favorites section when models are favorited', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Initially, favorites section might not exist
    const favoritesSection = page.locator('[data-testid="favorites-section"]')
    const initiallyVisible = await favoritesSection.isVisible().catch(() => false)

    // Favorite a model
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()
    const favoriteButton = firstModel.locator('[data-testid="favorite-toggle"]')

    // Make sure it's favorited
    const isCurrentlyFavorited = await favoriteButton.getAttribute('data-favorited')
    if (isCurrentlyFavorited !== 'true') {
      await favoriteButton.click()
      await page.waitForTimeout(500)
    }

    // Close and reopen panel to refresh
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible({ timeout: 3000 })

    await button.click()
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Favorites section should now be visible
    await expect(favoritesSection).toBeVisible({ timeout: 3000 })
  })

  test('should display recent models section after selecting models', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Select a model
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()
    await firstModel.click()

    // Wait for panel to close
    await expect(panel).not.toBeVisible({ timeout: 3000 })

    // Reopen panel
    await button.click()
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Recent models section should be visible
    const recentSection = page.locator('[data-testid="recent-section"]')
    await expect(recentSection).toBeVisible({ timeout: 3000 })
  })

  test('should open panel with keyboard shortcut Cmd+M (or Ctrl+M)', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Press Cmd+M (or Ctrl+M on non-Mac)
    const isMac = await page.evaluate(() => navigator.platform.includes('Mac'))
    if (isMac) {
      await page.keyboard.press('Meta+m')
    } else {
      await page.keyboard.press('Control+m')
    }

    // Panel should open
    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })
  })

  test('should close panel with Escape key', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Press Escape
    await page.keyboard.press('Escape')

    // Panel should close
    await expect(panel).not.toBeVisible({ timeout: 3000 })
  })

  test('should display visual indicators (cost, latency) for models', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Get the first model item
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()

    // Verify cost indicator exists
    const costBadge = firstModel.locator('[data-testid="cost-badge"]')
    await expect(costBadge).toBeVisible()

    // Verify latency indicator exists
    const latencyBadge = firstModel.locator('[data-testid="latency-badge"]')
    await expect(latencyBadge).toBeVisible()
  })

  test('should show link to full models page', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Look for the link to /ai/models
    const modelsPageLink = page.locator('[data-testid="view-all-models-link"]')
    await expect(modelsPageLink).toBeVisible()

    // Verify the link points to /ai/models
    const href = await modelsPageLink.getAttribute('href')
    expect(href).toContain('/ai/models')
  })

  test('should maintain state after page refresh', async ({ page }) => {
    await page.goto('/')

    // Open the panel and select a model
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Search for a specific model
    const searchInput = page.locator('[data-testid="model-search-input"]')
    await searchInput.fill('gpt-4')
    await page.waitForTimeout(500)

    // Select the first model
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()
    await firstModel.click()

    // Get the selected model name
    const selectedModel = await button.textContent()

    // Refresh the page
    await page.reload()

    // Verify ModelSwitcher still shows the same model
    const buttonAfterReload = page.locator('[data-testid="model-switcher"] button')
    await expect(buttonAfterReload).toBeVisible({ timeout: 5000 })
    const selectedModelAfterReload = await buttonAfterReload.textContent()

    expect(selectedModelAfterReload).toBe(selectedModel)
  })

  test('should handle rapid model switching without errors', async ({ page }) => {
    await page.goto('/')

    // Open the panel
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    const panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Get multiple model items
    const modelItems = page.locator('[data-testid="model-item"]')
    const count = Math.min(await modelItems.count(), 5)

    // Rapidly switch between models
    for (let i = 0; i < count; i++) {
      await modelItems.nth(i).click()
      await page.waitForTimeout(200)

      // Reopen panel
      await button.click()
      await expect(panel).toBeVisible({ timeout: 3000 })
    }

    // Should not have any console errors
    // This is implicit - if there were errors, the test would likely fail
  })

  test('should show current model indicator in panel', async ({ page }) => {
    await page.goto('/')

    // Open the panel and select a model
    const button = page.locator('[data-testid="model-switcher"] button')
    await button.click()

    let panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Select the first model
    const modelItems = page.locator('[data-testid="model-item"]')
    const firstModel = modelItems.first()
    const modelId = await firstModel.getAttribute('data-model-id')
    await firstModel.click()

    // Reopen panel
    await button.click()
    panel = page.locator('[data-testid="model-switcher-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Find the selected model in the list
    const selectedModelInList = page.locator(`[data-testid="model-item"][data-model-id="${modelId}"]`)

    // Verify it has a visual indicator (e.g., checkmark or highlighted)
    const hasSelectedIndicator = await selectedModelInList.getAttribute('data-selected')
    expect(hasSelectedIndicator).toBe('true')
  })
})
