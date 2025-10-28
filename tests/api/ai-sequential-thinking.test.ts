import { describe, it, expect, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth/middleware', () => ({
  withAIAuth: (handler: any) => handler
}))

const { POST } = require('@/app/api/ai/sequential-thinking/route')

describe('POST /api/ai/sequential-thinking', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns fallback content when MCP server is unavailable', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connection refused'))

    const headers = new Headers({ 'content-type': 'application/json' })
    const request = {
      json: async () => ({ prompt: 'test prompt', numSteps: 3 }),
      headers,
      user: { id: 'test-user', role: 'tester' }
    } as unknown as NextRequest

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Fallback')).toBe('true')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
