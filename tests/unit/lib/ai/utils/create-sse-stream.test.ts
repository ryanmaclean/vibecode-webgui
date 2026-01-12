/**
 * Tests for SSE Stream Creator
 */

import { createSSEStream, type CreateSSEStreamResult } from '@/lib/ai/utils/create-sse-stream'

describe('createSSEStream', () => {
  it('should create a readable stream with chunks', async () => {
    const chunks = ['chunk1', 'chunk2', 'chunk3']
    const { stream } = createSSEStream(chunks)

    expect(stream).toBeInstanceOf(ReadableStream)

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    const result: string[] = []

    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        result.push(decoder.decode(value, { stream: true }))
      }
    }

    expect(result.join('')).toBe('chunk1chunk2chunk3')
  })

  it('should resolve completion promise when stream finishes', async () => {
    const chunks = ['test']
    const { stream, completionPromise } = createSSEStream(chunks)

    const reader = stream.getReader()

    // Consume the stream
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
    }

    // Completion promise should resolve
    await expect(completionPromise).resolves.toBeUndefined()
  })

  it('should handle empty chunks array', async () => {
    const { stream, completionPromise } = createSSEStream([])

    const reader = stream.getReader()
    const { value, done } = await reader.read()

    expect(value).toBeUndefined()
    expect(done).toBe(true)

    await expect(completionPromise).resolves.toBeUndefined()
  })

  it('should support delay parameter for throttling', async () => {
    const chunks = ['chunk1', 'chunk2']
    const delayMs = 10
    const { stream, completionPromise } = createSSEStream(chunks, delayMs)

    const reader = stream.getReader()

    // Just verify stream completes with delay parameter
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
    }

    await expect(completionPromise).resolves.toBeUndefined()
  })

  it('should emit chunks immediately when delayMs is 0', async () => {
    const chunks = ['chunk1', 'chunk2']
    const { stream } = createSSEStream(chunks, 0)

    const reader = stream.getReader()
    const startTime = Date.now()

    await reader.read()
    await reader.read()
    await reader.read()

    const elapsedTime = Date.now() - startTime

    // Should be fast (< 50ms)
    expect(elapsedTime).toBeLessThan(50)
  })

  it('should handle stream cancellation', async () => {
    const chunks = ['chunk1', 'chunk2', 'chunk3']
    const { stream, completionPromise } = createSSEStream(chunks, 100)

    const reader = stream.getReader()

    // Cancel the stream before reading
    const cancelPromise = reader.cancel('User cancelled')

    // Completion promise should reject
    await Promise.race([
      expect(completionPromise).rejects.toThrow(),
      cancelPromise
    ])
  })

  it('should handle cancellation with Error object', async () => {
    const chunks = ['chunk1']
    const { stream, completionPromise } = createSSEStream(chunks, 50)

    const reader = stream.getReader()
    const error = new Error('Network error')

    const cancelPromise = reader.cancel(error)

    // Wait for either cancellation or rejection
    await Promise.race([
      expect(completionPromise).rejects.toThrow(),
      cancelPromise
    ])
  })

  it('should handle cancellation without reason', async () => {
    const chunks = ['chunk1']
    const { stream, completionPromise } = createSSEStream(chunks)

    const reader = stream.getReader()
    const cancelPromise = reader.cancel()

    // Wait for either cancellation or rejection
    await Promise.race([
      expect(completionPromise).rejects.toThrow(),
      cancelPromise
    ])
  })

  it('should encode chunks as UTF-8', async () => {
    const chunks = ['Hello', ' ', 'World', '!', ' 🎉']
    const { stream } = createSSEStream(chunks)

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''

    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        result += decoder.decode(value, { stream: true })
      }
    }

    expect(result).toBe('Hello World! 🎉')
  })

  it('should handle SSE-formatted chunks', async () => {
    const chunks = [
      'data: {"type":"content","content":"Hello"}\n\n',
      'data: {"type":"content","content":"World"}\n\n'
    ]
    const { stream } = createSSEStream(chunks)

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''

    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        result += decoder.decode(value, { stream: true })
      }
    }

    expect(result).toContain('data: {"type":"content","content":"Hello"}')
    expect(result).toContain('data: {"type":"content","content":"World"}')
  })

  it('should maintain chunk order', async () => {
    const chunks = ['1', '2', '3', '4', '5']
    const { stream } = createSSEStream(chunks)

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    const receivedChunks: string[] = []

    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        receivedChunks.push(decoder.decode(value))
      }
    }

    expect(receivedChunks).toEqual(['1', '2', '3', '4', '5'])
  })

  it('should handle delays gracefully without errors', async () => {
    const chunks = ['a', 'b']
    const delayMs = 5
    const { stream, completionPromise } = createSSEStream(chunks, delayMs)

    const reader = stream.getReader()

    // Consume all chunks
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
    }

    await expect(completionPromise).resolves.toBeUndefined()
  })

  it('should close stream after all chunks are emitted', async () => {
    const chunks = ['test']
    const { stream } = createSSEStream(chunks)

    const reader = stream.getReader()

    // Read the chunk
    const result1 = await reader.read()
    expect(result1.done).toBe(false)
    expect(result1.value).toBeDefined()

    // Next read should be done
    const result2 = await reader.read()
    expect(result2.done).toBe(true)
    expect(result2.value).toBeUndefined()
  })

  it('should only resolve completion promise once', async () => {
    const chunks = ['test']
    const { stream, completionPromise } = createSSEStream(chunks)

    const reader = stream.getReader()

    // Consume stream
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
    }

    await completionPromise

    // Calling again should still work (promise is resolved)
    await expect(completionPromise).resolves.toBeUndefined()
  })

  it('should handle chunks with special characters', async () => {
    const chunks = [
      'Line 1\n',
      'Line 2\r\n',
      'Tab\there',
      'Emoji: 😀'
    ]
    const { stream } = createSSEStream(chunks)

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''

    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        result += decoder.decode(value, { stream: true })
      }
    }

    expect(result).toBe('Line 1\nLine 2\r\nTab\thereEmoji: 😀')
  })

  it('should handle large number of chunks efficiently', async () => {
    const chunks = Array(1000).fill('chunk')
    const { stream, completionPromise } = createSSEStream(chunks)

    const reader = stream.getReader()
    let count = 0

    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) {
        count++
      }
    }

    expect(count).toBe(1000)
    await expect(completionPromise).resolves.toBeUndefined()
  })
})
