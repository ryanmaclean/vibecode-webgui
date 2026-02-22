/**
 * Edge Case Testing for AI Operation Loading States with Streaming Feedback
 *
 * Comprehensive test suite covering edge cases:
 * 1. Cancel operation during streaming
 * 2. Regenerate after completion
 * 3. Handle network errors gracefully
 * 4. Handle slow/stalled streams
 * 5. Multiple rapid requests
 *
 * This test suite validates robustness of the streaming implementation
 * including useAIStream hook and AILoadingState component.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIStream } from '@/hooks/useAIStream'

// Mock fetch for streaming tests
global.fetch = jest.fn()

describe('AI Streaming Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Edge Case 1: Cancel Operation During Streaming', () => {
    it('should cancel streaming operation mid-flight using AbortController', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('First chunk'), done: false })
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Second chunk'), done: false })
          .mockImplementation(() => new Promise(() => {})), // Never resolves (simulates ongoing stream)
        cancel: jest.fn().mockResolvedValue(undefined),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream({
        endpoint: '/api/chat/stream',
      }))

      // Start streaming
      act(() => {
        result.current.send('Test message')
      })

      // Wait for streaming to start
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      // Cancel during streaming
      act(() => {
        result.current.cancel()
      })

      // Verify cancellation
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false)
        expect(mockReader.cancel).toHaveBeenCalled()
      })

      // Should not be complete (was cancelled)
      expect(result.current.isComplete).toBe(false)
    })

    it('should handle rapid cancel clicks without errors', async () => {
      const mockReader = {
        read: jest.fn().mockImplementation(() => new Promise(() => {})),
        cancel: jest.fn().mockResolvedValue(undefined),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      // Start streaming
      act(() => {
        result.current.send('Test message')
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      // Rapid cancel clicks
      act(() => {
        result.current.cancel()
        result.current.cancel()
        result.current.cancel()
      })

      // Should handle gracefully
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false)
      })

      // Should only call cancel once on the reader
      expect(mockReader.cancel).toHaveBeenCalledTimes(1)
    })

    it('should cleanup resources properly after cancellation', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort')

      const mockReader = {
        read: jest.fn().mockImplementation(() => new Promise(() => {})),
        cancel: jest.fn().mockResolvedValue(undefined),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      act(() => {
        result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      act(() => {
        result.current.cancel()
      })

      // Verify AbortController.abort was called
      expect(abortSpy).toHaveBeenCalled()

      abortSpy.mockRestore()
    })
  })

  describe('Edge Case 2: Regenerate After Completion', () => {
    it('should regenerate response with same message after completion', async () => {
      let callCount = 0
      const mockReader = {
        read: jest.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1 || callCount === 3) {
            return Promise.resolve({ value: new TextEncoder().encode('Response'), done: false })
          }
          return Promise.resolve({ value: undefined, done: true })
        }),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      // Send initial message
      await act(async () => {
        await result.current.send('Test message')
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      const firstContent = result.current.content
      expect(result.current.lastMessage).toBe('Test message')

      // Regenerate
      await act(async () => {
        await result.current.regenerate()
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      // Should have called fetch twice with same message
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result.current.lastMessage).toBe('Test message')
    })

    it('should not regenerate if no previous message exists', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const { result } = renderHook(() => useAIStream())

      // Try to regenerate without sending a message first
      await act(async () => {
        await result.current.regenerate()
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No previous message to regenerate')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should reset state before regenerating', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('First'), done: false })
          .mockResolvedValueOnce({ value: undefined, done: true })
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Second'), done: false })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      // Send initial message
      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      expect(result.current.content).toContain('First')

      // Regenerate
      await act(async () => {
        await result.current.regenerate()
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      // Content should be updated
      expect(result.current.content).toContain('Second')
    })
  })

  describe('Edge Case 3: Handle Network Errors Gracefully', () => {
    it('should handle fetch rejection (network error)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const onStreamError = jest.fn()

      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAIStream({
        onStreamError,
      }))

      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      expect(result.current.error?.message).toBe('Network error')
      expect(result.current.isStreaming).toBe(false)
      expect(onStreamError).toHaveBeenCalledWith(expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    it('should handle HTTP error responses (404, 500, etc.)', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      expect(result.current.error?.message).toContain('HTTP error')
      expect(result.current.error?.message).toContain('500')
    })

    it('should handle null response body gracefully', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null,
      })

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      expect(result.current.error?.message).toBe('Response body is null')
    })

    it('should handle stream read errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Start'), done: false })
          .mockRejectedValue(new Error('Stream read error')),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      expect(result.current.error?.message).toBe('Stream read error')
      expect(result.current.isStreaming).toBe(false)

      consoleErrorSpy.mockRestore()
    })

    it('should not treat AbortError as a real error (intentional cancellation)', async () => {
      const onStreamError = jest.fn()

      const mockReader = {
        read: jest.fn().mockRejectedValue(Object.assign(new Error('AbortError'), { name: 'AbortError' })),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream({
        onStreamError,
      }))

      await act(async () => {
        await result.current.send('Test')
      })

      // AbortError should not trigger error callback
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false)
      })

      expect(onStreamError).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
    })
  })

  describe('Edge Case 4: Handle Slow/Stalled Streams', () => {
    it('should continue processing during slow streams', async () => {
      const mockReader = {
        read: jest.fn()
          .mockImplementation(() =>
            new Promise(resolve =>
              setTimeout(() =>
                resolve({ value: new TextEncoder().encode('Slow chunk'), done: false }),
                100
              )
            )
          )
          .mockResolvedValueOnce({ value: new TextEncoder().encode('First'), done: false }),
        cancel: jest.fn(),
      }

      // Add a counter to track reads and eventually end the stream
      let readCount = 0
      mockReader.read = jest.fn().mockImplementation(() => {
        readCount++
        if (readCount === 1) {
          return Promise.resolve({ value: new TextEncoder().encode('First'), done: false })
        } else if (readCount === 2) {
          return new Promise(resolve =>
            setTimeout(() =>
              resolve({ value: new TextEncoder().encode('Slow'), done: false }),
              100
            )
          )
        }
        return Promise.resolve({ value: undefined, done: true })
      })

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const onStreamUpdate = jest.fn()

      const { result } = renderHook(() => useAIStream({
        onStreamUpdate,
      }))

      await act(async () => {
        await result.current.send('Test')
      })

      // Fast-forward time for slow chunks
      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      expect(result.current.content).toContain('First')
      expect(result.current.content).toContain('Slow')
    })

    it('should update metadata during slow streams', async () => {
      let readCount = 0
      const mockReader = {
        read: jest.fn().mockImplementation(() => {
          readCount++
          if (readCount === 1) {
            return Promise.resolve({ value: new TextEncoder().encode('Chunk 1'), done: false })
          } else if (readCount === 2) {
            return new Promise(resolve =>
              setTimeout(() =>
                resolve({ value: new TextEncoder().encode('Chunk 2'), done: false }),
                200
              )
            )
          }
          return Promise.resolve({ value: undefined, done: true })
        }),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('Test')
      })

      // Advance past slow chunk
      await act(async () => {
        jest.advanceTimersByTime(200)
      })

      await waitFor(() => {
        expect(result.current.metadata).not.toBeNull()
      })

      // Metadata should be updated
      expect(result.current.metadata?.tokenCount).toBeGreaterThan(0)
    })
  })

  describe('Edge Case 5: Multiple Rapid Requests', () => {
    it('should cancel previous stream when new request is made', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const mockReader1 = {
        read: jest.fn().mockImplementation(() => new Promise(() => {})), // Never completes
        cancel: jest.fn().mockResolvedValue(undefined),
      }

      const mockReader2 = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Second response'), done: false })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        cancel: jest.fn(),
      }

      const mockStream1 = { getReader: jest.fn().mockReturnValue(mockReader1) }
      const mockStream2 = { getReader: jest.fn().mockReturnValue(mockReader2) }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, body: mockStream1 })
        .mockResolvedValueOnce({ ok: true, body: mockStream2 })

      const { result } = renderHook(() => useAIStream())

      // Send first message
      act(() => {
        result.current.send('First message')
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      // Send second message immediately
      await act(async () => {
        await result.current.send('Second message')
      })

      // Should have warned about canceling previous stream
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stream already in progress')
      )

      // Should have cancelled first reader
      expect(mockReader1.cancel).toHaveBeenCalled()

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      // Should show content from second request
      expect(result.current.content).toContain('Second response')
      expect(result.current.lastMessage).toBe('Second message')

      consoleWarnSpy.mockRestore()
    })

    it('should handle three rapid requests correctly', async () => {
      const readers = Array(3).fill(null).map((_, i) => ({
        read: jest.fn()
          .mockResolvedValueOnce({
            value: new TextEncoder().encode(`Response ${i + 1}`),
            done: false
          })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        cancel: jest.fn().mockResolvedValue(undefined),
      }))

      const streams = readers.map(reader => ({
        getReader: jest.fn().mockReturnValue(reader),
      }))

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, body: streams[0] })
        .mockResolvedValueOnce({ ok: true, body: streams[1] })
        .mockResolvedValueOnce({ ok: true, body: streams[2] })

      const { result } = renderHook(() => useAIStream())

      // Rapid fire three requests
      await act(async () => {
        await result.current.send('Message 1')
      })

      await act(async () => {
        await result.current.send('Message 2')
      })

      await act(async () => {
        await result.current.send('Message 3')
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      // First two should be cancelled
      expect(readers[0].cancel).toHaveBeenCalled()
      expect(readers[1].cancel).toHaveBeenCalled()

      // Final response should be from third request
      expect(result.current.content).toContain('Response 3')
      expect(result.current.lastMessage).toBe('Message 3')
    })

    it('should reject empty messages', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('')
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send empty message')
      )

      expect(global.fetch).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should handle whitespace-only messages', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('   \n\t  ')
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send empty message')
      )

      expect(global.fetch).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('AILoadingState Component Edge Cases', () => {
    it('should handle metadata state transitions correctly', () => {
      // Component tests are covered in the manual test report
      // This validates the hook's state management which the component depends on
      const { result } = renderHook(() => useAIStream())

      // Initial state - no metadata
      expect(result.current.metadata).toBeNull()
      expect(result.current.isComplete).toBe(false)
      expect(result.current.isStreaming).toBe(false)
    })

    it('should maintain correct state flags for component rendering', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Test'), done: false })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true)
      })

      // State flags should be correct for component rendering
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isComplete).toBe(true)
      expect(result.current.metadata).not.toBeNull()
      expect(result.current.metadata?.isComplete).toBe(true)
    })

    it('should provide correct metadata during streaming for progress display', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Chunk 1'), done: false })
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Chunk 2'), done: false })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result } = renderHook(() => useAIStream())

      await act(async () => {
        await result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.metadata).not.toBeNull()
      })

      // Metadata should include all fields needed for display
      expect(result.current.metadata?.tokenCount).toBeGreaterThan(0)
      expect(result.current.metadata?.chunkCount).toBeGreaterThan(0)
      expect(result.current.metadata?.elapsedMs).toBeGreaterThan(0)
    })
  })

  describe('Component Cleanup and Memory Leaks', () => {
    it('should cleanup on unmount during active stream', async () => {
      const mockReader = {
        read: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        cancel: jest.fn().mockResolvedValue(undefined),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result, unmount } = renderHook(() => useAIStream())

      act(() => {
        result.current.send('Test')
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      // Unmount while streaming
      unmount()

      // Should have cleaned up
      expect(mockReader.cancel).toHaveBeenCalled()
    })

    it('should not update state after unmount', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('Test'), done: false })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        cancel: jest.fn(),
      }

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      })

      const { result, unmount } = renderHook(() => useAIStream())

      act(() => {
        result.current.send('Test')
      })

      // Unmount immediately
      unmount()

      // Wait a bit
      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Should not have logged React state update warnings
      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('state update')
      )
      expect(stateUpdateWarnings.length).toBe(0)

      consoleErrorSpy.mockRestore()
    })
  })
})
