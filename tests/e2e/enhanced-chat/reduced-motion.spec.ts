import { test, expect } from '@playwright/test'
import { createSSEStream } from '../helpers/createSSEStream'

const STREAM_ROUTE = '**/api/chat/stream'

const scriptedChunks = [
  'data: {"type":"content","content":"Accessibility"}\n\n',
  'data: {"type":"metadata","metadata":{"responseTime":42}}\n\n'
]

test.describe('EnhancedChatInterface – reduced motion path', () => {
  test('shows jump control and focuses anchor when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    let streamCalls = 0
    let streamCompletionPromise: Promise<void> | undefined

    await page.route(STREAM_ROUTE, async route => {
      streamCalls += 1
      const { stream, completionPromise } = createSSEStream(scriptedChunks, 150)
      streamCompletionPromise = completionPromise

      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache'
        },
        body: stream
      })
    })

    try {
      await page.goto('/playwright/enhanced-chat')

      const scrollViewport = page.locator('[data-radix-scroll-area-viewport]')
      await expect(scrollViewport).toHaveAttribute('data-prefers-reduced-motion', 'true')
      const scrollBehavior = await scrollViewport.evaluate((element) =>
        getComputedStyle(element).scrollBehavior
      )
      expect(scrollBehavior).toBe('auto')

      await page.getByTestId('chat-input').fill('Reduced motion request')
      await page.getByTestId('chat-send-button').click()

      if (!streamCompletionPromise) {
        throw new Error('Expected chat stream to start')
      }

      const streamingIndicator = page.getByTestId('chat-streaming-indicator')
      await expect(streamingIndicator).toContainText('Assistant is preparing a response...')
      await expect(streamingIndicator.locator('svg')).toHaveCount(0)

      await streamCompletionPromise

      const liveRegion = page.getByTestId('chat-live-region')
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      await expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
      await expect(liveRegion).toHaveAttribute('aria-relevant', 'additions text')
      await expect(liveRegion).toContainText('New assistant message')

      const messageList = page.getByTestId('chat-message-list')
      await expect(messageList).toContainText('Accessibility')
      await expect(messageList).toContainText('42ms')
      await expect(messageList).toHaveAttribute('aria-busy', 'false')

      const jumpButton = page.getByTestId('chat-jump-button')
      await expect(jumpButton).toBeVisible()
      await expect(jumpButton).toHaveAttribute('class', /motion-reduce:transition-none/)
      await expect(jumpButton).toHaveAttribute('aria-label', 'Jump to latest message')
      await expect(jumpButton).toHaveAttribute('aria-controls', 'chat-scroll-anchor')
      await jumpButton.click()

      await expect(page.getByTestId('chat-scroll-anchor')).toBeFocused()
      await expect(jumpButton).toBeHidden()
      expect(streamCalls).toBe(1)
    } finally {
      await page.unroute(STREAM_ROUTE)
    }
  })
})
