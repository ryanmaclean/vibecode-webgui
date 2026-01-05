import React from 'react'
import { render, screen, waitFor, act } from '../../test-utils'
import userEvent from '@testing-library/user-event'
import { describe, beforeEach, afterEach, it, expect, beforeAll, afterAll } from '@jest/globals'
import { TextDecoder as NodeTextDecoder } from 'util'
import EnhancedChatInterface from '@/components/chat/EnhancedChatInterface'

const createMatchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  return jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_: 'change', listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_: 'change', listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
    dispatch: (event: MediaQueryListEvent) => {
      listeners.forEach(listener => listener(event))
    }
  }))
}

type MockChunk = { type: 'chunk'; value: string } | { type: 'done' }

const createReader = (chunks: MockChunk[]) => {
  const encoder = new TextEncoder()
  const queue = [...chunks]
  const read = jest.fn().mockImplementation(() => {
    const next = queue.shift() ?? { type: 'done' }
    if (next.type === 'done') {
      return Promise.resolve({ done: true, value: undefined })
    }
    return Promise.resolve({ done: false, value: encoder.encode(next.value) })
  })

  const cancel = jest.fn().mockResolvedValue(undefined)
  const releaseLock = jest.fn()

  return { read, cancel, releaseLock }
}

const clickSendButton = async (user: ReturnType<typeof userEvent.setup>) => {
  const sendIcon = await screen.findByTestId('lucide-icon-Send')
  const button = sendIcon.closest('button')
  if (!button) {
    throw new Error('Send button not found')
  }
  await user.click(button)
}

describe('EnhancedChatInterface streaming', () => {
  const originalMatchMedia = window.matchMedia
  const originalTextDecoder = global.TextDecoder
  let fetchSpy: jest.SpyInstance

  beforeAll(() => {
    class PatchedTextDecoder extends NodeTextDecoder {
      decode(input?: ArrayBufferView | ArrayBuffer | null, options?: TextDecodeOptions) {
        if (typeof input === 'undefined' || input === null) {
          return super.decode(new Uint8Array(), options as any)
        }
        return super.decode(input as ArrayBufferView, options as any)
      }
    }

    global.TextDecoder = PatchedTextDecoder as unknown as typeof TextDecoder
  })

  beforeEach(() => {
    window.matchMedia = createMatchMedia(false)
    fetchSpy = jest.spyOn(global, 'fetch')
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null
      } as any)
    )
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    fetchSpy.mockRestore()
  })

  afterAll(() => {
    global.TextDecoder = originalTextDecoder
  })

  it('merges chunked SSE payloads without dropping content', async () => {
    const reader = createReader([
      { type: 'chunk', value: 'data: {"type":"content","content":"Hello "}' + '\n\n' },
      { type: 'chunk', value: 'data: {"type":"content","content":"world!"}' + '\n\n' },
      { type: 'done' }
    ])

    fetchSpy.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: { getReader: () => reader }
    }))

    render(
      <EnhancedChatInterface
        workspaceId="unit-test-workspace"
        initialContext={[]}
      />
    )

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Ask me anything or attach files...'), 'Chunked request')
    await clickSendButton(user)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/chat/stream',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      expect(reader.read).toHaveBeenCalled()
      expect(screen.getByText('Hello world!')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(reader.cancel).toHaveBeenCalled()
    })
  })

  it('shows jump control and announces updates when reduced motion is preferred', async () => {
    window.matchMedia = createMatchMedia(true)

    const reader = createReader([
      { type: 'chunk', value: 'data: {"type":"content","content":"Accessibility"}' + '\n\n' },
      { type: 'chunk', value: 'data: {"type":"metadata","metadata":{"responseTime":42}}' + '\n\n' },
      { type: 'done' }
    ])

    fetchSpy.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: { getReader: () => reader }
    }))

    render(
      <EnhancedChatInterface
        workspaceId="unit-test-workspace"
        initialContext={[]}
      />
    )

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Ask me anything or attach files...'), 'Reduced motion request')
    await clickSendButton(user)

    await screen.findByText('Accessibility')
    await screen.findByText('42ms')

    const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
    expect(viewport).toBeTruthy()
    Object.defineProperty(viewport, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true })
    Object.defineProperty(viewport, 'scrollTop', { value: 200, configurable: true, writable: true })
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'))
    })

    const jumpButton = await screen.findByTestId('chat-jump-button')
    expect(jumpButton).toBeVisible()

    const liveRegion = screen.getByTestId('chat-live-region')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    await waitFor(() => {
      expect(liveRegion.textContent).toContain('New assistant message available.')
    })

    await user.click(jumpButton)

    const anchor = screen.getByTestId('chat-scroll-anchor')
    await waitFor(() => {
      expect(document.activeElement).toBe(anchor)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('chat-jump-button')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(reader.cancel).toHaveBeenCalled()
      expect(reader.releaseLock).toHaveBeenCalled()
    })
  })
})
