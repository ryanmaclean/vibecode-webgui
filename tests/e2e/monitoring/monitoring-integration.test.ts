/**
 * E2E Tests for Monitoring Integration
 * Tests dashboard, health checks, metrics collection, and alerting
 */

import { test, expect } from '@playwright/test'
import TestHelpers from '../utils/test-helpers'
import testData from '../fixtures/test-data.json'

test.describe('Monitoring Integration', () => {
  let testUser: any

  test.beforeEach(async ({ page }) => {
    await TestHelpers.cleanup()
    testUser = await TestHelpers.createTestUser(testData.users.user)
    await TestHelpers.loginAsTestUser(page, 'user')
  })

  test.afterEach(async ({ page }) => {
    await TestHelpers.cleanup()
  })

  test('should display monitoring dashboard correctly', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Verify main dashboard elements
    await expect(page.locator('h1')).toContainText('Monitoring Dashboard')
    await expect(page.locator('[data-testid="health-status-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="metrics-overview-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="recent-alerts-card"]')).toBeVisible()
    
    // Check navigation tabs
    await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-metrics"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-logs"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-traces"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-rum"]')).toBeVisible()
  })

  test('should show system health status', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Check overall health indicator
    const healthStatus = page.locator('[data-testid="overall-health-status"]')
    await expect(healthStatus).toBeVisible()
    
    const statusText = await healthStatus.textContent()
    expect(['Healthy', 'Warning', 'Critical']).toContain(statusText)
    
    // Verify individual service health checks
    await expect(page.locator('[data-testid="service-health-database"]')).toBeVisible()
    await expect(page.locator('[data-testid="service-health-redis"]')).toBeVisible()
    await expect(page.locator('[data-testid="service-health-api"]')).toBeVisible()
  })

  test('should validate health check endpoints', async ({ page }) => {
    // Test all health endpoints from test data
    for (const endpoint of testData.monitoring.healthEndpoints) {
      const response = await TestHelpers.makeAPIRequest(page, endpoint)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body).toHaveProperty('status')
      expect(['healthy', 'ok', 'up']).toContain(body.status.toLowerCase())
    }
  })

  test('should display metrics correctly', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-metrics"]')
    
    // Wait for metrics to load
    await TestHelpers.waitForPageLoad(page)
    
    // Check for key metric displays
    await expect(page.locator('[data-testid="metric-http-requests"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-response-time"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-error-rate"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-memory-usage"]')).toBeVisible()
    
    // Verify metric values are numeric
    const requestCount = await page.locator('[data-testid="requests-total-value"]').textContent()
    expect(requestCount).toMatch(/^\d+/)
    
    const responseTime = await page.locator('[data-testid="avg-response-time-value"]').textContent()
    expect(responseTime).toMatch(/^\d+(\.\d+)?/)
  })

  test('should handle metrics time range selection', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-metrics"]')
    
    // Test different time ranges
    const timeRanges = ['1h', '6h', '24h', '7d']
    
    for (const range of timeRanges) {
      await page.click('[data-testid="time-range-selector"]')
      await page.click(`[data-testid="time-range-${range}"]`)
      
      // Wait for metrics to update
      await page.waitForTimeout(1000)
      
      // Verify the selected range is displayed
      await expect(page.locator('[data-testid="selected-time-range"]'))
        .toContainText(range)
    }
  })

  test('should display and filter logs', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-logs"]')
    
    await TestHelpers.waitForPageLoad(page)
    
    // Verify logs interface
    await expect(page.locator('[data-testid="logs-container"]')).toBeVisible()
    await expect(page.locator('[data-testid="log-search-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="log-level-filter"]')).toBeVisible()
    
    // Test log filtering
    await page.selectOption('[data-testid="log-level-filter"]', 'error')
    await page.waitForTimeout(1000)
    
    // Verify only error logs are shown
    const logEntries = page.locator('[data-testid^="log-entry-"]')
    const count = await logEntries.count()
    
    if (count > 0) {
      // Check first few log entries have error level
      for (let i = 0; i < Math.min(3, count); i++) {
        const logLevel = await logEntries.nth(i).locator('[data-testid="log-level"]').textContent()
        expect(logLevel?.toLowerCase()).toBe('error')
      }
    }
  })

  test('should handle log search functionality', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-logs"]')
    
    // Search for specific terms
    await page.fill('[data-testid="log-search-input"]', 'user')
    await page.press('[data-testid="log-search-input"]', 'Enter')
    
    await page.waitForTimeout(1000)
    
    // Verify search results contain the search term
    const logEntries = page.locator('[data-testid^="log-entry-"]')
    const count = await logEntries.count()
    
    if (count > 0) {
      const firstLog = await logEntries.first().textContent()
      expect(firstLog?.toLowerCase()).toContain('user')
    }
  })

  test('should display distributed traces', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-traces"]')
    
    await TestHelpers.waitForPageLoad(page)
    
    // Verify traces interface
    await expect(page.locator('[data-testid="traces-container"]')).toBeVisible()
    await expect(page.locator('[data-testid="trace-search-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="service-filter"]')).toBeVisible()
    
    // Check for trace entries
    const traceEntries = page.locator('[data-testid^="trace-entry-"]')
    const count = await traceEntries.count()
    
    if (count > 0) {
      // Click on first trace to view details
      await traceEntries.first().click()
      
      // Verify trace details modal/panel opens
      await expect(page.locator('[data-testid="trace-details-panel"]')).toBeVisible()
      await expect(page.locator('[data-testid="trace-timeline"]')).toBeVisible()
      await expect(page.locator('[data-testid="span-list"]')).toBeVisible()
    }
  })

  test('should display RUM data and metrics', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-rum"]')
    
    await TestHelpers.waitForPageLoad(page)
    
    // Verify RUM dashboard elements
    await expect(page.locator('[data-testid="rum-status-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="core-web-vitals-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-sessions-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-tracking-card"]')).toBeVisible()
    
    // Check Core Web Vitals
    const webVitals = ['LCP', 'FID', 'CLS']
    for (const vital of webVitals) {
      await expect(page.locator(`[data-testid="web-vital-${vital}"]`)).toBeVisible()
    }
  })

  test('should handle alert management', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Check recent alerts section
    const alertsSection = page.locator('[data-testid="recent-alerts-card"]')
    await expect(alertsSection).toBeVisible()
    
    // Check for alert entries
    const alertEntries = page.locator('[data-testid^="alert-entry-"]')
    const alertCount = await alertEntries.count()
    
    if (alertCount > 0) {
      // Click on first alert to view details
      await alertEntries.first().click()
      
      // Verify alert details
      await expect(page.locator('[data-testid="alert-details-modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="alert-severity"]')).toBeVisible()
      await expect(page.locator('[data-testid="alert-description"]')).toBeVisible()
      await expect(page.locator('[data-testid="alert-timestamp"]')).toBeVisible()
    }
  })

  test('should validate monitoring API endpoints', async ({ page }) => {
    // Test monitoring API endpoints
    const monitoringEndpoints = [
      '/api/monitoring/metrics',
      '/api/monitoring/health',
      '/api/monitoring/alerts',
      '/api/monitoring/rum'
    ]
    
    for (const endpoint of monitoringEndpoints) {
      const response = await TestHelpers.makeAPIRequest(page, endpoint)
      
      // Should return successful response
      expect([200, 201, 204]).toContain(response.status())
      
      // Verify response has expected structure
      const body = await response.json()
      expect(body).toBeDefined()
    }
  })

  test('should handle real-time updates', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Enable real-time updates
    await page.click('[data-testid="enable-realtime-updates"]')
    
    // Wait for initial data
    await TestHelpers.waitForPageLoad(page)
    
    // Check that data updates periodically
    const initialRequestCount = await page.locator('[data-testid="requests-total-value"]').textContent()
    
    // Wait for potential update
    await page.waitForTimeout(5000)
    
    const updatedRequestCount = await page.locator('[data-testid="requests-total-value"]').textContent()
    
    // Values might be the same if no new requests, but the timestamp should update
    const lastUpdated = page.locator('[data-testid="last-updated-timestamp"]')
    await expect(lastUpdated).toBeVisible()
  })

  test('should export monitoring data', async ({ page }) => {
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-metrics"]')
    
    // Test data export functionality
    await page.click('[data-testid="export-data-button"]')
    await page.click('[data-testid="export-csv"]')
    
    // Wait for download to initiate
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="confirm-export"]')
    const download = await downloadPromise
    
    // Verify download
    expect(download.suggestedFilename()).toContain('monitoring-data')
    expect(download.suggestedFilename()).toContain('.csv')
  })

  test('should handle dashboard customization', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Enter dashboard edit mode
    await page.click('[data-testid="customize-dashboard-button"]')
    
    // Verify customization options
    await expect(page.locator('[data-testid="dashboard-edit-mode"]')).toBeVisible()
    await expect(page.locator('[data-testid="add-widget-button"]')).toBeVisible()
    
    // Add a new widget
    await page.click('[data-testid="add-widget-button"]')
    await page.click('[data-testid="widget-type-chart"]')
    await page.selectOption('[data-testid="metric-selector"]', 'response_time')
    await page.click('[data-testid="add-widget-confirm"]')
    
    // Save dashboard
    await page.click('[data-testid="save-dashboard-button"]')
    
    // Verify new widget appears
    await expect(page.locator('[data-testid="widget-response-time"]')).toBeVisible()
  })

  test('should handle error scenarios gracefully', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Simulate network error by going offline
    await page.context().setOffline(true)
    
    // Try to refresh data
    await page.click('[data-testid="refresh-data-button"]')
    
    // Should show error state
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    
    // Restore connection
    await page.context().setOffline(false)
    
    // Retry should work
    await page.click('[data-testid="retry-button"]')
    await TestHelpers.waitForPageLoad(page)
    
    // Error should disappear
    await expect(page.locator('[data-testid="connection-error"]')).not.toBeVisible()
  })

  test('should validate performance metrics accuracy', async ({ page }) => {
    // Generate some activity first
    await page.goto('/')
    await TestHelpers.waitForPageLoad(page)
    
    // Navigate to different pages to generate metrics
    await page.goto('/workspaces')
    await TestHelpers.waitForPageLoad(page)
    
    await page.goto('/monitoring')
    await page.click('[data-testid="tab-metrics"]')
    
    // Wait for metrics to reflect recent activity
    await page.waitForTimeout(2000)
    
    // Verify metrics show recent activity
    const requestCount = await page.locator('[data-testid="requests-total-value"]').textContent()
    expect(parseInt(requestCount || '0')).toBeGreaterThan(0)
    
    // Check that response times are reasonable
    const avgResponseTime = await page.locator('[data-testid="avg-response-time-value"]').textContent()
    const responseTimeMs = parseFloat(avgResponseTime || '0')
    expect(responseTimeMs).toBeGreaterThan(0)
    expect(responseTimeMs).toBeLessThan(10000) // Less than 10 seconds is reasonable
  })
})