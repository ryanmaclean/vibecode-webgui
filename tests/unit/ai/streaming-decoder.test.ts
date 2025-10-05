import { describe, expect, it, jest } from '@jest/globals'
import { createSSEDecoder } from '@/lib/ai/utils/sse-decoder'

describe('createSSEDecoder', () => {
  it('emits completed content chunks across multiple pushes', () => {
    const contentChunks: string[] = []
    const metadataChunks: Array<Record<string, unknown>> = []
    const malformed = jest.fn()

    const decoder = createSSEDecoder({
      onContentChunk: chunk => contentChunks.push(chunk.content),
      onMetadataChunk: chunk => metadataChunks.push(chunk.metadata),
      onMalformedChunk: malformed
    })

    decoder.push('data: {"type":"content","content":"Hel')
    decoder.push('lo"}\n')
    decoder.push('\n')
    decoder.finish()

    expect(contentChunks).toEqual(['Hello'])
    expect(metadataChunks).toHaveLength(0)
    expect(malformed).not.toHaveBeenCalled()
  })

  it('differentiates metadata chunks from content chunks', () => {
    const contentChunks: string[] = []
    const metadataChunks: Array<Record<string, unknown>> = []

    const decoder = createSSEDecoder({
      onContentChunk: chunk => contentChunks.push(chunk.content),
      onMetadataChunk: chunk => metadataChunks.push(chunk.metadata),
      onMalformedChunk: jest.fn()
    })

    decoder.push('data: {"type":"content","content":"First"}\n\n')
    decoder.push('data: {"type":"metadata","metadata":{"tokens":12}}\n\n')
    decoder.finish()

    expect(contentChunks).toEqual(['First'])
    expect(metadataChunks).toEqual([{ tokens: 12 }])
  })

  it('surfaces malformed chunks to the provided handler', () => {
    const malformed = jest.fn()

    const decoder = createSSEDecoder({
      onContentChunk: () => {},
      onMetadataChunk: () => {},
      onMalformedChunk: malformed
    })

    decoder.push('data: {invalid json}\n\n')
    decoder.finish()

    expect(malformed).toHaveBeenCalledTimes(1)
    const [error, rawPayload] = malformed.mock.calls[0]
    expect(rawPayload).toBe('{invalid json}')
    expect(error).toBeInstanceOf(Error)
  })
})
