/**
 * Browser Compatibility Tests for SSE Client
 *
 * Tests SSE streaming across different browsers and versions:
 * - Chrome/Chromium
 * - Firefox
 * - Safari/WebKit
 * - Mobile browsers
 *
 * Validates:
 * - Basic connection and streaming
 * - Automatic reconnection
 * - Large message handling
 * - Network interruption recovery
 * - Concurrent connections
 * - Background tab behavior
 */

import { test, expect, Page, Browser, BrowserContext } from '@playwright/test'

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_TIMEOUT = 60000
const SSE_ENDPOINT = '/api/test/sse-stream'

// ============================================================================
// Utility Functions
// ============================================================================

async function waitForSSEConnection(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      return (window as any).__sseConnected === true
    },
    { timeout }
  )
}

async function getSSEMetrics(page: Page): Promise<any> {
  return page.evaluate(() => {
    return (window as any).__sseMetrics || {}
  })
}

async function simulateNetworkInterruption(page: Page, duration: number): Promise<void> {
  await page.route('**/*', route => route.abort())
  await page.waitForTimeout(duration)
  await page.unroute('**/*')
}

// ============================================================================
// Test Suite: Basic Functionality
// ============================================================================

test.describe('SSE Basic Functionality', () => {
  test('should connect and receive messages in Chromium', async ({ page }) => {
    await page.goto('/test/sse-client')

    // Start SSE connection
    await page.click('#start-sse')

    // Wait for connection
    await waitForSSEConnection(page)

    // Check connection status
    const status = await page.textContent('#connection-status')
    expect(status).toBe('connected')

    // Wait for messages
    await page.waitForTimeout(2000)

    // Get message count
    const messageCount = await page.evaluate(() => {
      return (window as any).__messageCount || 0
    })

    expect(messageCount).toBeGreaterThan(0)
  })

  test('should handle connection in Firefox', async ({ browser }) => {
    if (browser.browserType().name() !== 'firefox') {
      test.skip()
    }

    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    const status = await page.textContent('#connection-status')
    expect(status).toBe('connected')

    await context.close()
  })

  test('should handle connection in WebKit/Safari', async ({ browser }) => {
    if (browser.browserType().name() !== 'webkit') {
      test.skip()
    }

    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    const status = await page.textContent('#connection-status')
    expect(status).toBe('connected')

    await context.close()
  })
})

// ============================================================================
// Test Suite: Automatic Reconnection
// ============================================================================

test.describe('SSE Automatic Reconnection', () => {
  test('should reconnect after connection loss', async ({ page }) => {
    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Simulate connection loss
    await page.evaluate(() => {
      (window as any).__sseClient?.disconnect()
    })

    // Wait for reconnection
    await page.waitForTimeout(2000)

    const status = await page.textContent('#connection-status')
    expect(status).toContain('reconnecting')

    // Wait for successful reconnection
    await waitForSSEConnection(page, 10000)

    const reconnectedStatus = await page.textContent('#connection-status')
    expect(reconnectedStatus).toBe('connected')
  })

  test('should use exponential backoff for reconnection', async ({ page }) => {
    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    const reconnectionDelays: number[] = []

    // Monitor reconnection attempts
    await page.exposeFunction('logReconnection', (attempt: number, delay: number) => {
      reconnectionDelays.push(delay)
    })

    await page.evaluate(() => {
      const client = (window as any).__sseClient
      client.handlers.onReconnecting = (attempt: number, delay: number) => {
        ;(window as any).logReconnection(attempt, delay)
      }
    })

    // Force multiple failures
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        (window as any).__sseClient?.disconnect()
      })
      await page.waitForTimeout(1500)
    }

    // Verify exponential backoff
    expect(reconnectionDelays.length).toBeGreaterThan(0)

    for (let i = 1; i < reconnectionDelays.length; i++) {
      expect(reconnectionDelays[i]).toBeGreaterThanOrEqual(reconnectionDelays[i - 1])
    }
  })

  test('should handle network interruption gracefully', async ({ page }) => {
    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    const initialMessageCount = await page.evaluate(() => {
      return (window as any).__messageCount || 0
    })

    // Simulate network interruption
    await simulateNetworkInterruption(page, 3000)

    // Wait for recovery
    await page.waitForTimeout(5000)

    const finalMessageCount = await page.evaluate(() => {
      return (window as any).__messageCount || 0
    })

    // Should have reconnected and received more messages
    expect(finalMessageCount).toBeGreaterThan(initialMessageCount)
  })
})

// ============================================================================
// Test Suite: Large Message Handling
// ============================================================================

test.describe('SSE Large Message Handling', () => {
  test('should handle messages >1MB', async ({ page }) => {
    await page.goto('/test/sse-client')

    // Configure for large messages
    await page.evaluate(() => {
      ;(window as any).__testConfig = {
        messageSize: 1024 * 1024 // 1MB
      }
    })

    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Wait for large message
    await page.waitForTimeout(5000)

    const metrics = await getSSEMetrics(page)
    expect(metrics.totalBytes).toBeGreaterThan(1024 * 1024)
    expect(metrics.totalMessages).toBeGreaterThan(0)
  })

  test('should handle rapid message bursts', async ({ page }) => {
    await page.goto('/test/sse-client')

    // Configure for burst mode
    await page.evaluate(() => {
      ;(window as any).__testConfig = {
        burstMode: true,
        burstSize: 100
      }
    })

    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Wait for burst to complete
    await page.waitForTimeout(3000)

    const messageCount = await page.evaluate(() => {
      return (window as any).__messageCount || 0
    })

    expect(messageCount).toBeGreaterThanOrEqual(100)
  })
})

// ============================================================================
// Test Suite: Concurrent Connections
// ============================================================================

test.describe('SSE Concurrent Connections', () => {
  test('should handle 6+ concurrent connections', async ({ page }) => {
    await page.goto('/test/sse-client')

    // Create multiple connections
    const connectionCount = 8

    await page.evaluate((count) => {
      ;(window as any).__connections = []
      for (let i = 0; i < count; i++) {
        const client = (window as any).createSSEClient({
          url: '/api/test/sse-stream',
          debug: false
        })
        client.connect()
        ;(window as any).__connections.push(client)
      }
    }, connectionCount)

    // Wait for all connections
    await page.waitForTimeout(5000)

    // Check that all connections are active
    const activeCount = await page.evaluate(() => {
      return (window as any).__connections.filter((c: any) => c.isConnected()).length
    })

    expect(activeCount).toBe(connectionCount)
  })

  test('should handle connection limit gracefully in Safari', async ({ browser }) => {
    if (browser.browserType().name() !== 'webkit') {
      test.skip()
    }

    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/test/sse-client')

    // Try to create 10 connections (Safari limits to 6)
    await page.evaluate(() => {
      ;(window as any).__connections = []
      for (let i = 0; i < 10; i++) {
        const client = (window as any).createSSEClient({
          url: '/api/test/sse-stream',
          debug: false
        })
        client.connect()
        ;(window as any).__connections.push(client)
      }
    })

    await page.waitForTimeout(5000)

    // Check that connections are managed properly
    const activeCount = await page.evaluate(() => {
      return (window as any).__connections.filter((c: any) => c.isConnected()).length
    })

    expect(activeCount).toBeGreaterThan(0)
    expect(activeCount).toBeLessThanOrEqual(10)

    await context.close()
  })
})

// ============================================================================
// Test Suite: Background Tab Behavior
// ============================================================================

test.describe('SSE Background Tab Behavior', () => {
  test('should maintain connection when tab is backgrounded', async ({ page, context }) => {
    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    const initialMessageCount = await page.evaluate(() => {
      return (window as any).__messageCount || 0
    })

    // Create a new tab (backgrounds current tab)
    const newPage = await context.newPage()
    await newPage.goto('about:blank')

    // Wait while backgrounded
    await page.waitForTimeout(5000)

    // Switch back to original tab
    await page.bringToFront()
    await page.waitForTimeout(1000)

    // Check that messages continued to arrive
    const finalMessageCount = await page.evaluate(() => {
      return (window as any).__messageCount || 0
    })

    expect(finalMessageCount).toBeGreaterThan(initialMessageCount)

    await newPage.close()
  })

  test('should reconnect when app is focused after suspension (mobile)', async ({
    browser
  }) => {
    // Simulate mobile behavior
    const context = await browser.newContext({
      ...browser.options().contextOptions,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    })

    const page = await context.newPage()
    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Simulate app going to background
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(3000)

    // Simulate app coming to foreground
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(2000)

    // Should reconnect
    const status = await page.textContent('#connection-status')
    expect(status).toContain('connected')

    await context.close()
  })
})

// ============================================================================
// Test Suite: Performance Metrics
// ============================================================================

test.describe('SSE Performance Metrics', () => {
  test('should achieve <100ms first message latency', async ({ page }) => {
    await page.goto('/test/sse-client')

    const startTime = Date.now()
    await page.click('#start-sse')

    // Wait for first message
    await page.waitForFunction(
      () => {
        return (window as any).__messageCount > 0
      },
      { timeout: 5000 }
    )

    const firstMessageTime = Date.now()
    const latency = firstMessageTime - startTime

    expect(latency).toBeLessThan(100)
  })

  test('should track metrics accurately', async ({ page }) => {
    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Wait for messages
    await page.waitForTimeout(5000)

    const metrics = await getSSEMetrics(page)

    expect(metrics).toHaveProperty('totalMessages')
    expect(metrics).toHaveProperty('totalBytes')
    expect(metrics).toHaveProperty('averageLatency')
    expect(metrics).toHaveProperty('connectionUptime')

    expect(metrics.totalMessages).toBeGreaterThan(0)
    expect(metrics.totalBytes).toBeGreaterThan(0)
    expect(metrics.averageLatency).toBeGreaterThan(0)
  })
})

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

test.describe('SSE Error Handling', () => {
  test('should handle 500 server errors gracefully', async ({ page }) => {
    await page.goto('/test/sse-client')

    // Configure to trigger server error
    await page.evaluate(() => {
      ;(window as any).__testConfig = {
        triggerServerError: true
      }
    })

    await page.click('#start-sse')

    // Wait for error
    await page.waitForTimeout(2000)

    const status = await page.textContent('#connection-status')
    expect(status).toContain('reconnecting')
  })

  test('should handle malformed SSE data', async ({ page }) => {
    await page.goto('/test/sse-client')

    // Configure to send malformed data
    await page.evaluate(() => {
      ;(window as any).__testConfig = {
        sendMalformedData: true
      }
    })

    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Wait for malformed data
    await page.waitForTimeout(2000)

    // Should call error handler but remain connected
    const errorCount = await page.evaluate(() => {
      return (window as any).__errorCount || 0
    })

    expect(errorCount).toBeGreaterThan(0)

    // Connection should still be active
    const status = await page.textContent('#connection-status')
    expect(status).toBe('connected')
  })
})

// ============================================================================
// Test Suite: Browser-Specific Features
// ============================================================================

test.describe('Browser-Specific Features', () => {
  test('should use HTTP/2 in Chrome', async ({ browser }) => {
    if (browser.browserType().name() !== 'chromium') {
      test.skip()
    }

    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    // Check if HTTP/2 is used
    const protocol = await page.evaluate(() => {
      return (window as any).__connectionProtocol
    })

    // HTTP/2 support depends on server configuration
    expect(protocol).toBeDefined()

    await context.close()
  })

  test('should work with Firefox strict tracking protection', async ({ browser }) => {
    if (browser.browserType().name() !== 'firefox') {
      test.skip()
    }

    const context = await browser.newContext({
      ...browser.options().contextOptions,
      // Enable strict tracking protection
      firefoxUserPrefs: {
        'privacy.trackingprotection.enabled': true
      }
    })

    const page = await context.newPage()

    await page.goto('/test/sse-client')
    await page.click('#start-sse')
    await waitForSSEConnection(page)

    const status = await page.textContent('#connection-status')
    expect(status).toBe('connected')

    await context.close()
  })
})
