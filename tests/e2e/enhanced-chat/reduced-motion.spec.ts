import { test, expect } from '@playwright/test'

const STREAM_ROUTE = '**/api/chat/stream'

const scriptedStream = [
  'data: {"type":"content","content":"Accessibility"}',
  '',
  'data: {"type":"metadata","metadata":{"responseTime":42}}',
  '',
  '',
].join('\n')

test.describe('EnhancedChatInterface – reduced motion path', () => {
  test('shows jump control and focuses anchor when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    let streamCalls = 0

    await page.route(STREAM_ROUTE, async route => {
      streamCalls += 1
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream'
        },
        body: scriptedStream
      })
    })

    try {
      await page.goto('/playwright/enhanced-chat')

      await page.getByTestId('chat-input').fill('Reduced motion request')
      await page.getByTestId('chat-send-button').click()

      const liveRegion = page.getByTestId('chat-live-region')
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      await expect(liveRegion).toContainText('New assistant message')

      const jumpButton = page.getByTestId('chat-jump-button')
      await expect(jumpButton).toBeVisible()
      await jumpButton.click()

      await expect(page.getByTestId('chat-scroll-anchor')).toBeFocused()
      await expect(jumpButton).toBeHidden()
      expect(streamCalls).toBe(1)
    } finally {
      await page.unroute(STREAM_ROUTE)
    }
  })
})
