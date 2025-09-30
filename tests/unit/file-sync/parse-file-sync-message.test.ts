import { parseFileSyncMessage } from '@/lib/file-sync/websocket'

describe('parseFileSyncMessage', () => {
  it('parses a valid file-update payload', () => {
    const result = parseFileSyncMessage(
      JSON.stringify({
        type: 'file-update',
        payload: {
          path: 'src/index.ts',
          content: 'console.log("hi")',
          version: 3,
          checksum: 'abc123',
          metadata: { language: 'ts' },
        },
      }),
    )

    expect(result).toEqual({
      type: 'file-update',
      payload: {
        path: 'src/index.ts',
        content: 'console.log("hi")',
        version: 3,
        checksum: 'abc123',
        metadata: { language: 'ts' },
      },
    })
  })

  it('parses a ping payload', () => {
    const result = parseFileSyncMessage(JSON.stringify({ type: 'ping' }))
    expect(result).toEqual({ type: 'ping' })
  })

  it('parses a subscribe-file payload', () => {
    const result = parseFileSyncMessage(
      JSON.stringify({ type: 'subscribe-file', payload: { path: 'src/app.tsx' } }),
    )

    expect(result).toEqual({
      type: 'subscribe-file',
      payload: { path: 'src/app.tsx' },
    })
  })

  it('returns undefined for malformed JSON', () => {
    expect(parseFileSyncMessage('{invalid json')).toBeUndefined()
  })

  it('returns undefined for file-update without path', () => {
    const result = parseFileSyncMessage(
      JSON.stringify({ type: 'file-update', payload: { content: 'oops' } }),
    )
    expect(result).toBeUndefined()
  })

  it('returns undefined for subscribe-file without path', () => {
    const result = parseFileSyncMessage(JSON.stringify({ type: 'subscribe-file', payload: {} }))
    expect(result).toBeUndefined()
  })

  it('returns undefined for unknown message types', () => {
    const result = parseFileSyncMessage(JSON.stringify({ type: 'unknown', payload: {} }))
    expect(result).toBeUndefined()
  })
})
