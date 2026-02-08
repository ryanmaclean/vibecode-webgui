/**
 * Unit Tests for Workspace Access Control
 * Tests role hierarchy, permissions, and access control logic
 */

import { jest } from '@jest/globals'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    workspace: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { prisma } from '@/lib/prisma'
import {
  WorkspaceRole,
  hasWorkspaceAccess,
  getWorkspaceRole,
  getWorkspacePermissions,
  hasWorkspacePermission,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceRole,
  listWorkspaceMembers,
  requireWorkspaceAccess,
} from '@/lib/auth/workspace-access'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('Workspace Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('WorkspaceRole enum', () => {
    it('should have correct role values', () => {
      expect(WorkspaceRole.OWNER).toBe('owner')
      expect(WorkspaceRole.ADMIN).toBe('admin')
      expect(WorkspaceRole.MEMBER).toBe('member')
      expect(WorkspaceRole.VIEWER).toBe('viewer')
    })
  })

  describe('hasWorkspaceAccess', () => {
    it('should return true when user has active membership', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: null, revoked_at: null }
      ])

      const result = await hasWorkspaceAccess(1, 100)
      expect(result).toBe(true)
    })

    it('should return false when no membership found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const result = await hasWorkspaceAccess(1, 100)
      expect(result).toBe(false)
    })

    it('should return false when workspace ID is invalid string', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const result = await hasWorkspaceAccess(1, 'non-existent-workspace')
      expect(result).toBe(false)
    })

    it('should check role hierarchy when requiredRole is provided', async () => {
      // User is MEMBER, required is ADMIN
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: null, revoked_at: null }
      ])

      const result = await hasWorkspaceAccess(1, 100, WorkspaceRole.ADMIN)
      expect(result).toBe(false)
    })

    it('should allow owner when admin is required', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'owner', permissions: null, revoked_at: null }
      ])

      const result = await hasWorkspaceAccess(1, 100, WorkspaceRole.ADMIN)
      expect(result).toBe(true)
    })

    it('should allow admin when member is required', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'admin', permissions: null, revoked_at: null }
      ])

      const result = await hasWorkspaceAccess(1, 100, WorkspaceRole.MEMBER)
      expect(result).toBe(true)
    })

    it('should resolve string workspace ID to numeric', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: 100 })
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: null, revoked_at: null }
      ])

      const result = await hasWorkspaceAccess(1, 'ws-abc')
      expect(result).toBe(true)
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { workspace_id: 'ws-abc' },
        select: { id: true },
      })
    })

    it('should fail closed on database errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'))

      const result = await hasWorkspaceAccess(1, 100)
      expect(result).toBe(false)
    })
  })

  describe('getWorkspaceRole', () => {
    it('should return user role when membership exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ role: 'admin' }])

      const role = await getWorkspaceRole(1, 100)
      expect(role).toBe('admin')
    })

    it('should return null when no membership found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const role = await getWorkspaceRole(1, 100)
      expect(role).toBeNull()
    })

    it('should return null on error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB error'))

      const role = await getWorkspaceRole(1, 100)
      expect(role).toBeNull()
    })

    it('should handle string workspace ID', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: 100 })
      mockPrisma.$queryRaw.mockResolvedValue([{ role: 'owner' }])

      const role = await getWorkspaceRole(1, 'ws-abc')
      expect(role).toBe('owner')
    })

    it('should return null for non-existent string workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const role = await getWorkspaceRole(1, 'non-existent')
      expect(role).toBeNull()
    })
  })

  describe('getWorkspacePermissions', () => {
    it('should return role-based permissions for member', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: null }
      ])

      const perms = await getWorkspacePermissions(1, 100)
      expect(perms).toEqual({
        read: true,
        write: true,
        delete: false,
        invite: false,
        admin: false,
      })
    })

    it('should return full permissions for owner', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'owner', permissions: null }
      ])

      const perms = await getWorkspacePermissions(1, 100)
      expect(perms).toEqual({
        read: true,
        write: true,
        delete: true,
        invite: true,
        admin: true,
      })
    })

    it('should return read-only permissions for viewer', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'viewer', permissions: null }
      ])

      const perms = await getWorkspacePermissions(1, 100)
      expect(perms).toEqual({
        read: true,
        write: false,
        delete: false,
        invite: false,
        admin: false,
      })
    })

    it('should merge custom permissions with role defaults', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: { delete: true } }
      ])

      const perms = await getWorkspacePermissions(1, 100)
      expect(perms).toEqual({
        read: true,
        write: true,
        delete: true, // Overridden by custom permission
        invite: false,
        admin: false,
      })
    })

    it('should return null when no membership', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const perms = await getWorkspacePermissions(1, 100)
      expect(perms).toBeNull()
    })

    it('should return null on error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB error'))

      const perms = await getWorkspacePermissions(1, 100)
      expect(perms).toBeNull()
    })
  })

  describe('hasWorkspacePermission', () => {
    it('should return true for allowed permission', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: null }
      ])

      const result = await hasWorkspacePermission(1, 100, 'write')
      expect(result).toBe(true)
    })

    it('should return false for denied permission', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'viewer', permissions: null }
      ])

      const result = await hasWorkspacePermission(1, 100, 'write')
      expect(result).toBe(false)
    })

    it('should return false when no membership', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const result = await hasWorkspacePermission(1, 100, 'read')
      expect(result).toBe(false)
    })
  })

  describe('addWorkspaceMember', () => {
    it('should return true on success', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1)

      const result = await addWorkspaceMember(100, 2, WorkspaceRole.MEMBER, 1)
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB error'))

      const result = await addWorkspaceMember(100, 2, WorkspaceRole.MEMBER, 1)
      expect(result).toBe(false)
    })
  })

  describe('removeWorkspaceMember', () => {
    it('should return true on success', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1)

      const result = await removeWorkspaceMember(100, 2)
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB error'))

      const result = await removeWorkspaceMember(100, 2)
      expect(result).toBe(false)
    })
  })

  describe('updateWorkspaceRole', () => {
    it('should return true on success', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1)

      const result = await updateWorkspaceRole(100, 2, WorkspaceRole.ADMIN)
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB error'))

      const result = await updateWorkspaceRole(100, 2, WorkspaceRole.ADMIN)
      expect(result).toBe(false)
    })
  })

  describe('listWorkspaceMembers', () => {
    it('should return members list', async () => {
      const mockMembers = [
        { user_id: 1, email: 'owner@test.com', name: 'Owner', role: 'owner', invited_at: new Date(), accepted_at: new Date() },
        { user_id: 2, email: 'member@test.com', name: 'Member', role: 'member', invited_at: new Date(), accepted_at: new Date() },
      ]
      mockPrisma.$queryRaw.mockResolvedValue(mockMembers)

      const result = await listWorkspaceMembers(100)
      expect(result).toEqual(mockMembers)
      expect(result).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB error'))

      const result = await listWorkspaceMembers(100)
      expect(result).toEqual([])
    })
  })

  describe('requireWorkspaceAccess', () => {
    it('should return unauthorized when no session', async () => {
      const { getServerSession } = require('next-auth')
      getServerSession.mockResolvedValue(null)

      const result = await requireWorkspaceAccess(new Request('http://localhost/api/test'), 100)
      expect(result.allowed).toBe(false)
      expect(result.error?.error).toBe('Unauthorized')
    })

    it('should return forbidden when user lacks access', async () => {
      const { getServerSession } = require('next-auth')
      getServerSession.mockResolvedValue({ user: { id: '1' } })
      mockPrisma.$queryRaw.mockResolvedValue([]) // No membership

      const result = await requireWorkspaceAccess(new Request('http://localhost/api/test'), 100)
      expect(result.allowed).toBe(false)
      expect(result.error?.error).toBe('Forbidden')
    })

    it('should return allowed when user has access', async () => {
      const { getServerSession } = require('next-auth')
      getServerSession.mockResolvedValue({ user: { id: '1' } })
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'member', permissions: null, revoked_at: null }
      ])

      const result = await requireWorkspaceAccess(new Request('http://localhost/api/test'), 100)
      expect(result.allowed).toBe(true)
      expect(result.userId).toBe(1)
    })

    it('should include required role in error message', async () => {
      const { getServerSession } = require('next-auth')
      getServerSession.mockResolvedValue({ user: { id: '1' } })
      mockPrisma.$queryRaw.mockResolvedValue([
        { role: 'viewer', permissions: null, revoked_at: null }
      ])

      const result = await requireWorkspaceAccess(
        new Request('http://localhost/api/test'),
        100,
        WorkspaceRole.ADMIN
      )
      expect(result.allowed).toBe(false)
      expect(result.error?.message).toContain('admin')
    })
  })
})
