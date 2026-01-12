/**
 * Tests for Code Server Client
 */

import { CodeServerClient } from '@/lib/code-server-client'
import { getSession } from 'next-auth/react'

// Mock next-auth
jest.mock('next-auth/react', () => ({
  getSession: jest.fn()
}))

// Mock fetch
global.fetch = jest.fn()

describe('CodeServerClient', () => {
  let client: CodeServerClient

  beforeEach(() => {
    jest.clearAllMocks()
    client = new CodeServerClient('http://localhost:3000')
    ;(getSession as jest.Mock).mockResolvedValue({
      user: { email: 'test@example.com' }
    })
  })

  describe('constructor', () => {
    it('should create client with base URL', () => {
      const customClient = new CodeServerClient('http://api.example.com')

      expect(customClient).toBeInstanceOf(CodeServerClient)
    })

    it('should create client with empty base URL', () => {
      const customClient = new CodeServerClient()

      expect(customClient).toBeInstanceOf(CodeServerClient)
    })

    it('should create client with default base URL', () => {
      const customClient = new CodeServerClient('')

      expect(customClient).toBeInstanceOf(CodeServerClient)
    })
  })

  describe('createSession', () => {
    it('should create session with workspace ID', async () => {
      const mockSession = {
        id: 'session-123',
        url: 'http://code-server:8080',
        status: 'ready' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession
      })

      const result = await client.createSession('workspace-1')

      expect(result).toEqual(mockSession)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/code-server/session',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ workspaceId: 'workspace-1', userId: undefined })
        })
      )
    })

    it('should create session with workspace and user ID', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'session-123',
          workspaceId: 'workspace-1',
          userId: 'user-123',
          status: 'starting'
        })
      })

      await client.createSession('workspace-1', 'user-123')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('user-123')
        })
      )
    })

    it('should include authorization header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

      await client.createSession('workspace-1')

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
      const headers = new Headers(callArgs.headers)

      expect(headers.get('Authorization')).toBe('Bearer test@example.com')
    })

    it('should include content-type header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

      await client.createSession('workspace-1')

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
      const headers = new Headers(callArgs.headers)

      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('should throw error on failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Failed to create session' })
      })

      await expect(
        client.createSession('workspace-1')
      ).rejects.toThrow('Failed to create session')
    })

    it('should throw generic error if no message', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({})
      })

      await expect(
        client.createSession('workspace-1')
      ).rejects.toThrow('Failed to fetch')
    })
  })

  describe('getSession', () => {
    it('should get session by ID', async () => {
      const mockSession = {
        id: 'session-123',
        url: 'http://code-server:8080',
        status: 'ready' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession
      })

      const result = await client.getSession('session-123')

      expect(result).toEqual(mockSession)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/code-server/session/session-123',
        expect.any(Object)
      )
    })

    it('should include auth headers', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

      await client.getSession('session-123')

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
      const headers = new Headers(callArgs.headers)

      expect(headers.get('Authorization')).toBeDefined()
    })

    it('should throw error if session not found', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Session not found' })
      })

      await expect(
        client.getSession('invalid-id')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('deleteSession', () => {
    it('should delete session by ID', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

      await client.deleteSession('session-123')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/code-server/session/session-123',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })

    it('should not throw on successful deletion', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

      await expect(
        client.deleteSession('session-123')
      ).resolves.toBeUndefined()
    })

    it('should throw error on failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Cannot delete session' })
      })

      await expect(
        client.deleteSession('session-123')
      ).rejects.toThrow('Cannot delete session')
    })
  })

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      const mockSessions = {
        sessions: [
          {
            id: 'session-1',
            workspaceId: 'workspace-1',
            status: 'ready' as const,
            userId: 'user-1',
            url: 'http://localhost:8080',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSessions
      })

      const result = await client.listSessions()

      expect(result).toEqual(mockSessions)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/code-server/session',
        expect.any(Object)
      )
    })

    it('should filter by workspace ID', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] })
      })

      await client.listSessions('workspace-123')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/code-server/session?workspaceId=workspace-123',
        expect.any(Object)
      )
    })

    it('should encode workspace ID in query', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] })
      })

      await client.listSessions('workspace with spaces')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('workspace%20with%20spaces'),
        expect.any(Object)
      )
    })

    it('should return empty sessions array', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] })
      })

      const result = await client.listSessions()

      expect(result.sessions).toEqual([])
    })
  })

  describe('getOrCreateSession', () => {
    it('should return existing ready session', async () => {
      const existingSession = {
        id: 'session-123',
        status: 'ready' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        url: 'http://localhost:8080',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [existingSession] })
      })

      const result = await client.getOrCreateSession('workspace-1')

      expect(result).toEqual(existingSession)
    })

    it('should return existing starting session', async () => {
      const startingSession = {
        id: 'session-123',
        status: 'starting' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        url: 'http://localhost:8080',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [startingSession] })
      })

      const result = await client.getOrCreateSession('workspace-1')

      expect(result).toEqual(startingSession)
    })

    it('should create new session if none exist', async () => {
      const newSession = {
        id: 'session-new',
        status: 'starting' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        url: 'http://localhost:8080',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessions: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newSession
        })

      const result = await client.getOrCreateSession('workspace-1')

      expect(result).toEqual(newSession)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should skip error and stopped sessions', async () => {
      const stoppedSession = {
        id: 'session-stopped',
        status: 'stopped' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        url: 'http://localhost:8080',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      const errorSession = {
        id: 'session-error',
        status: 'error' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        url: 'http://localhost:8080',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      const newSession = {
        id: 'session-new',
        status: 'starting' as const,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        url: 'http://localhost:8080',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessions: [stoppedSession, errorSession] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newSession
        })

      const result = await client.getOrCreateSession('workspace-1')

      expect(result).toEqual(newSession)
    })

    it('should pass user ID when creating', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessions: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        })

      await client.getOrCreateSession('workspace-1', 'user-123')

      const createCall = (global.fetch as jest.Mock).mock.calls[1]
      expect(createCall[1].body).toContain('user-123')
    })

    it('should throw and log error on failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      )

      await expect(
        client.getOrCreateSession('workspace-1')
      ).rejects.toThrow('Network error')

      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('authentication', () => {
    it('should work without session', async () => {
      ;(getSession as jest.Mock).mockResolvedValue(null)
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] })
      })

      await client.listSessions()

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
      const headers = new Headers(callArgs.headers)

      expect(headers.get('Authorization')).toBeNull()
    })

    it('should include credentials', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] })
      })

      await client.listSessions()

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]

      expect(callArgs.credentials).toBe('include')
    })
  })
})
