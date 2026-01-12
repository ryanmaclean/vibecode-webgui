/**
 * Tests for SSE (Server-Sent Events) Decoder
 */

import {
  createSSEDecoder,
  isContentChunk,
  isMetadataChunk,
  type SSEDecoderHandlers,
  type StreamContentChunk,
  type StreamMetadataChunk
} from '@/lib/ai/utils/sse-decoder'

describe('SSE Decoder', () => {
  describe('Type Guards', () => {
    describe('isContentChunk', () => {
      it('should return true for valid content chunks', () => {
        const chunk: StreamContentChunk = {
          type: 'content',
          content: 'Hello world'
        }
        expect(isContentChunk(chunk)).toBe(true)
      })

      it('should return false for non-object values', () => {
        expect(isContentChunk(null)).toBe(false)
        expect(isContentChunk(undefined)).toBe(false)
        expect(isContentChunk('string')).toBe(false)
        expect(isContentChunk(123)).toBe(false)
      })

      it('should return false for objects without type=content', () => {
        expect(isContentChunk({ type: 'metadata', content: 'test' })).toBe(false)
        expect(isContentChunk({ content: 'test' })).toBe(false)
      })

      it('should return false if content is not a string', () => {
        expect(isContentChunk({ type: 'content', content: 123 })).toBe(false)
        expect(isContentChunk({ type: 'content', content: null })).toBe(false)
      })
    })

    describe('isMetadataChunk', () => {
      it('should return true for valid metadata chunks', () => {
        const chunk: StreamMetadataChunk = {
          type: 'metadata',
          metadata: { key: 'value' }
        }
        expect(isMetadataChunk(chunk)).toBe(true)
      })

      it('should return false for non-object values', () => {
        expect(isMetadataChunk(null)).toBe(false)
        expect(isMetadataChunk(undefined)).toBe(false)
        expect(isMetadataChunk('string')).toBe(false)
      })

      it('should return false for objects without type=metadata', () => {
        expect(isMetadataChunk({ type: 'content', metadata: {} })).toBe(false)
        expect(isMetadataChunk({ metadata: {} })).toBe(false)
      })

      it('should return false if metadata is not an object', () => {
        expect(isMetadataChunk({ type: 'metadata', metadata: 'string' })).toBe(false)
        expect(isMetadataChunk({ type: 'metadata', metadata: null })).toBe(false)
      })
    })
  })

  describe('createSSEDecoder', () => {
    let handlers: SSEDecoderHandlers
    let contentChunks: StreamContentChunk[]
    let metadataChunks: StreamMetadataChunk[]
    let malformedErrors: Array<{ error: unknown; payload: string }>

    beforeEach(() => {
      contentChunks = []
      metadataChunks = []
      malformedErrors = []

      handlers = {
        onContentChunk: (chunk) => contentChunks.push(chunk),
        onMetadataChunk: (chunk) => metadataChunks.push(chunk),
        onMalformedChunk: (error, payload) => malformedErrors.push({ error, payload })
      }
    })

    it('should decode single content chunk', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content","content":"Hello"}\n')
      decoder.push('\n')

      expect(contentChunks).toHaveLength(1)
      expect(contentChunks[0]).toEqual({
        type: 'content',
        content: 'Hello'
      })
    })

    it('should decode multiple content chunks', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content","content":"Hello"}\n\n')
      decoder.push('data: {"type":"content","content":" World"}\n\n')

      expect(contentChunks).toHaveLength(2)
      expect(contentChunks[0].content).toBe('Hello')
      expect(contentChunks[1].content).toBe(' World')
    })

    it('should decode metadata chunks', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"metadata","metadata":{"model":"gpt-4","tokens":100}}\n\n')

      expect(metadataChunks).toHaveLength(1)
      expect(metadataChunks[0]).toEqual({
        type: 'metadata',
        metadata: { model: 'gpt-4', tokens: 100 }
      })
    })

    it('should handle data lines without space after colon', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data:{"type":"content","content":"Test"}\n\n')

      expect(contentChunks).toHaveLength(1)
      expect(contentChunks[0].content).toBe('Test')
    })

    it('should handle multiline data payloads', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content",\n')
      decoder.push('data: "content":"Multiline"}\n\n')

      expect(contentChunks).toHaveLength(1)
      expect(contentChunks[0].content).toBe('Multiline')
    })

    it('should buffer incomplete chunks', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content"')
      expect(contentChunks).toHaveLength(0)

      decoder.push(',"content":"Test"}\n\n')
      expect(contentChunks).toHaveLength(1)
    })

    it('should handle finish() to flush remaining buffer', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content","content":"Final"}\n')
      expect(contentChunks).toHaveLength(0)

      decoder.finish()
      expect(contentChunks).toHaveLength(1)
      expect(contentChunks[0].content).toBe('Final')
    })

    it('should handle malformed JSON', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {invalid json}\n\n')

      expect(contentChunks).toHaveLength(0)
      expect(malformedErrors).toHaveLength(1)
      expect(malformedErrors[0].payload).toBe('{invalid json}')
    })

    it('should handle unsupported chunk types', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"unknown","data":"test"}\n\n')

      expect(contentChunks).toHaveLength(0)
      expect(metadataChunks).toHaveLength(0)
      expect(malformedErrors).toHaveLength(1)
    })

    it('should ignore non-data lines', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('event: message\n')
      decoder.push('id: 123\n')
      decoder.push('data: {"type":"content","content":"Test"}\n\n')

      expect(contentChunks).toHaveLength(1)
    })

    it('should handle CRLF line endings', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content","content":"Test"}\r\n\r\n')

      expect(contentChunks).toHaveLength(1)
      expect(contentChunks[0].content).toBe('Test')
    })

    it('should handle empty data lines', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: \n\n')

      expect(contentChunks).toHaveLength(0)
      expect(malformedErrors).toHaveLength(0)
    })

    it('should reset state correctly', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content"')
      decoder.reset()

      const state = decoder.getState()
      expect(state.bufferedText).toBe('')
      expect(state.pendingDataLines).toHaveLength(0)
    })

    it('should provide accurate state', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content"')

      const state = decoder.getState()
      expect(state.bufferedText).toBe('data: {"type":"content"')
      expect(state.pendingDataLines).toHaveLength(0)
    })

    it('should handle streaming scenario with incremental pushes', () => {
      const decoder = createSSEDecoder(handlers)

      const stream = 'data: {"type":"content","content":"Hello"}\n\ndata: {"type":"content","content":"World"}\n\n'

      // Simulate chunked network data
      for (let i = 0; i < stream.length; i += 10) {
        decoder.push(stream.slice(i, i + 10))
      }

      expect(contentChunks).toHaveLength(2)
      expect(contentChunks[0].content).toBe('Hello')
      expect(contentChunks[1].content).toBe('World')
    })

    it('should handle empty text chunk', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('')

      const state = decoder.getState()
      expect(state.bufferedText).toBe('')
    })

    it('should work without onMalformedChunk handler', () => {
      const minimalHandlers: SSEDecoderHandlers = {
        onContentChunk: (chunk) => contentChunks.push(chunk),
        onMetadataChunk: (chunk) => metadataChunks.push(chunk)
      }

      const decoder = createSSEDecoder(minimalHandlers)

      // This should not throw even though malformed handler is missing
      decoder.push('data: {invalid}\n\n')

      expect(contentChunks).toHaveLength(0)
    })

    it('should handle finish() with only pending data (no buffer)', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"content","content":"Test"}\n')
      decoder.finish()

      expect(contentChunks).toHaveLength(1)
    })

    it('should handle complex metadata with nested objects', () => {
      const decoder = createSSEDecoder(handlers)

      decoder.push('data: {"type":"metadata","metadata":{"usage":{"prompt":10,"completion":20},"model":"gpt-4"}}\n\n')

      expect(metadataChunks).toHaveLength(1)
      expect(metadataChunks[0].metadata).toEqual({
        usage: { prompt: 10, completion: 20 },
        model: 'gpt-4'
      })
    })
  })
})
