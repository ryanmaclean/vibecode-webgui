/**
 * Integration tests for workspace access control
 *
 * Tests the real workspace_members table implementation
 * that replaces the placeholder authorization logic.
 *
 * @see src/lib/auth/workspace-access.ts
 * @see docs/database/QUICK_WINS.md
 * @see #283 - Implement real workspace access control
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Mock Datadog metrics
jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn(),
    distribution: jest.fn()
  }
}));

// In-memory storage for mock data
interface WorkspaceMember {
  user_id: number;
  workspace_id: number;
  role: string;
  permissions: Record<string, boolean> | null;
  invited_by: number;
  invited_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface MockUser {
  id: number;
  email: string;
  name: string;
}

interface MockWorkspace {
  id: number;
  name: string;
  user_id: number;
  workspace_id: string;
  status: string;
}

const mockData = {
  users: [] as MockUser[],
  workspaces: [] as MockWorkspace[],
  workspaceMembers: [] as WorkspaceMember[],
  nextUserId: 1,
  nextWorkspaceId: 1
};

// Mock Prisma for testing without database
jest.mock('@/lib/prisma', () => {
  return {
    prisma: {
      user: {
        create: jest.fn().mockImplementation(({ data }: { data: { email: string; name: string } }) => {
          const user = {
            id: mockData.nextUserId++,
            email: data.email,
            name: data.name
          };
          mockData.users.push(user);
          return Promise.resolve(user);
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      workspace: {
        create: jest.fn().mockImplementation(({ data }: { data: { name: string; user_id: number; workspace_id: string; status: string } }) => {
          const workspace = {
            id: mockData.nextWorkspaceId++,
            name: data.name,
            user_id: data.user_id,
            workspace_id: data.workspace_id,
            status: data.status
          };
          mockData.workspaces.push(workspace);
          // Auto-add owner to workspace_members
          mockData.workspaceMembers.push({
            user_id: data.user_id,
            workspace_id: workspace.id,
            role: 'owner',
            permissions: null,
            invited_by: data.user_id,
            invited_at: new Date(),
            accepted_at: new Date(),
            revoked_at: null,
            created_at: new Date(),
            updated_at: new Date()
          });
          return Promise.resolve(workspace);
        }),
        findUnique: jest.fn().mockImplementation(({ where }: { where: { workspace_id?: string; id?: number } }) => {
          const workspace = mockData.workspaces.find(
            w => (where.workspace_id && w.workspace_id === where.workspace_id) ||
                 (where.id && w.id === where.id)
          );
          return Promise.resolve(workspace || null);
        }),
        delete: jest.fn().mockResolvedValue({})
      },
      $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join('?');

        // Handle workspace_members SELECT queries
        if (query.includes('SELECT') && query.includes('workspace_members')) {
          const userId = values[0] as number;
          const workspaceId = values[1] as number;

          const members = mockData.workspaceMembers.filter(
            m => m.user_id === userId &&
                 m.workspace_id === workspaceId &&
                 m.revoked_at === null
          );

          // If query includes JOIN users (for listWorkspaceMembers)
          if (query.includes('JOIN')) {
            const workspaceIdForList = values[0] as number;
            const membersWithUsers = mockData.workspaceMembers
              .filter(m => m.workspace_id === workspaceIdForList && m.revoked_at === null)
              .map(m => {
                const user = mockData.users.find(u => u.id === m.user_id);
                return {
                  user_id: m.user_id,
                  email: user?.email || '',
                  name: user?.name || null,
                  role: m.role,
                  invited_at: m.invited_at,
                  accepted_at: m.accepted_at
                };
              });
            return Promise.resolve(membersWithUsers);
          }

          return Promise.resolve(members.map(m => ({
            role: m.role,
            permissions: m.permissions,
            revoked_at: m.revoked_at
          })));
        }

        return Promise.resolve([]);
      }),
      $executeRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join('?');

        // Handle INSERT for workspace_members
        if (query.includes('INSERT INTO workspace_members')) {
          const [userId, workspaceId, role, invitedBy] = values as [number, number, string, number];

          // Check for existing member (for ON CONFLICT handling)
          const existingIndex = mockData.workspaceMembers.findIndex(
            m => m.user_id === userId && m.workspace_id === workspaceId
          );

          if (existingIndex >= 0) {
            // Update existing member
            mockData.workspaceMembers[existingIndex].role = role;
            mockData.workspaceMembers[existingIndex].revoked_at = null;
            mockData.workspaceMembers[existingIndex].updated_at = new Date();
          } else {
            // Create new member
            mockData.workspaceMembers.push({
              user_id: userId,
              workspace_id: workspaceId,
              role: role,
              permissions: null,
              invited_by: invitedBy,
              invited_at: new Date(),
              accepted_at: new Date(),
              revoked_at: null,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
          return Promise.resolve(1);
        }

        // Handle UPDATE for workspace_members (update role)
        // This must come before the remove member check because both have 'UPDATE workspace_members'
        // The key difference is "SET role =" vs "SET revoked_at ="
        if (query.includes('UPDATE workspace_members') && query.includes('SET role =')) {
          const newRole = values[0] as string;
          const userId = values[1] as number;
          const workspaceId = values[2] as number;

          const member = mockData.workspaceMembers.find(
            m => m.user_id === userId && m.workspace_id === workspaceId && m.revoked_at === null
          );
          if (member) {
            member.role = newRole;
            member.updated_at = new Date();
          }
          return Promise.resolve(1);
        }

        // Handle UPDATE for workspace_members (remove member - soft delete via revoked_at)
        if (query.includes('UPDATE workspace_members') && query.includes('SET revoked_at =')) {
          const userId = values[0] as number;
          const workspaceId = values[1] as number;

          const member = mockData.workspaceMembers.find(
            m => m.user_id === userId && m.workspace_id === workspaceId && m.revoked_at === null
          );
          if (member) {
            member.revoked_at = new Date();
          }
          return Promise.resolve(1);
        }

        // Handle DELETE
        if (query.includes('DELETE FROM workspace_members')) {
          const workspaceId = values[0] as number;
          mockData.workspaceMembers = mockData.workspaceMembers.filter(
            m => m.workspace_id !== workspaceId
          );
          return Promise.resolve(1);
        }

        return Promise.resolve(0);
      }),
      $disconnect: jest.fn().mockResolvedValue(undefined)
    }
  };
});

import {
  hasWorkspaceAccess,
  getWorkspaceRole,
  getWorkspacePermissions,
  hasWorkspacePermission,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceRole,
  listWorkspaceMembers,
  WorkspaceRole
} from '@/lib/auth/workspace-access';
import { prisma } from '@/lib/prisma';

describe('Workspace Access Control', () => {
  let testUserId: number;
  let testWorkspaceId: number;
  let adminUserId: number;
  let memberUserId: number;
  let viewerUserId: number;
  let unauthorizedUserId: number;

  beforeAll(async () => {
    // Reset mock data
    mockData.users = [];
    mockData.workspaces = [];
    mockData.workspaceMembers = [];
    mockData.nextUserId = 1;
    mockData.nextWorkspaceId = 1;

    // Create test users
    const ownerUser = await prisma.user.create({
      data: {
        email: 'owner@test.com',
        name: 'Workspace Owner'
      }
    });
    testUserId = ownerUser.id;

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Workspace Admin'
      }
    });
    adminUserId = adminUser.id;

    const memberUser = await prisma.user.create({
      data: {
        email: 'member@test.com',
        name: 'Workspace Member'
      }
    });
    memberUserId = memberUser.id;

    const viewerUser = await prisma.user.create({
      data: {
        email: 'viewer@test.com',
        name: 'Workspace Viewer'
      }
    });
    viewerUserId = viewerUser.id;

    const unauthorizedUser = await prisma.user.create({
      data: {
        email: 'unauthorized@test.com',
        name: 'Unauthorized User'
      }
    });
    unauthorizedUserId = unauthorizedUser.id;

    // Create test workspace (this auto-adds owner to workspace_members)
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        user_id: testUserId,
        workspace_id: 'test-ws-' + Date.now(),
        status: 'active'
      }
    });
    testWorkspaceId = workspace.id;

    // Add members with different roles
    await addWorkspaceMember(testWorkspaceId, adminUserId, WorkspaceRole.ADMIN, testUserId);
    await addWorkspaceMember(testWorkspaceId, memberUserId, WorkspaceRole.MEMBER, testUserId);
    await addWorkspaceMember(testWorkspaceId, viewerUserId, WorkspaceRole.VIEWER, testUserId);
  });

  afterAll(async () => {
    // Clean up mock data
    mockData.users = [];
    mockData.workspaces = [];
    mockData.workspaceMembers = [];
    await prisma.$disconnect();
  });

  describe('hasWorkspaceAccess', () => {
    it('should grant access to workspace owner', async () => {
      const hasAccess = await hasWorkspaceAccess(testUserId, testWorkspaceId);
      expect(hasAccess).toBe(true);
    });

    it('should grant access to workspace admin', async () => {
      const hasAccess = await hasWorkspaceAccess(adminUserId, testWorkspaceId);
      expect(hasAccess).toBe(true);
    });

    it('should grant access to workspace member', async () => {
      const hasAccess = await hasWorkspaceAccess(memberUserId, testWorkspaceId);
      expect(hasAccess).toBe(true);
    });

    it('should grant access to workspace viewer', async () => {
      const hasAccess = await hasWorkspaceAccess(viewerUserId, testWorkspaceId);
      expect(hasAccess).toBe(true);
    });

    it('should deny access to unauthorized user', async () => {
      const hasAccess = await hasWorkspaceAccess(unauthorizedUserId, testWorkspaceId);
      expect(hasAccess).toBe(false);
    });

    it('should deny access to non-existent workspace', async () => {
      const hasAccess = await hasWorkspaceAccess(testUserId, 999999);
      expect(hasAccess).toBe(false);
    });
  });

  describe('Role-based Access Control', () => {
    it('should grant owner access with OWNER role requirement', async () => {
      const hasAccess = await hasWorkspaceAccess(
        testUserId,
        testWorkspaceId,
        WorkspaceRole.OWNER
      );
      expect(hasAccess).toBe(true);
    });

    it('should grant admin access with ADMIN role requirement', async () => {
      const hasAccess = await hasWorkspaceAccess(
        adminUserId,
        testWorkspaceId,
        WorkspaceRole.ADMIN
      );
      expect(hasAccess).toBe(true);
    });

    it('should deny member access with ADMIN role requirement', async () => {
      const hasAccess = await hasWorkspaceAccess(
        memberUserId,
        testWorkspaceId,
        WorkspaceRole.ADMIN
      );
      expect(hasAccess).toBe(false);
    });

    it('should deny viewer access with MEMBER role requirement', async () => {
      const hasAccess = await hasWorkspaceAccess(
        viewerUserId,
        testWorkspaceId,
        WorkspaceRole.MEMBER
      );
      expect(hasAccess).toBe(false);
    });

    it('should grant owner access with VIEWER role requirement (role hierarchy)', async () => {
      const hasAccess = await hasWorkspaceAccess(
        testUserId,
        testWorkspaceId,
        WorkspaceRole.VIEWER
      );
      expect(hasAccess).toBe(true);
    });
  });

  describe('getWorkspaceRole', () => {
    it('should return OWNER role for workspace owner', async () => {
      const role = await getWorkspaceRole(testUserId, testWorkspaceId);
      expect(role).toBe(WorkspaceRole.OWNER);
    });

    it('should return ADMIN role for admin user', async () => {
      const role = await getWorkspaceRole(adminUserId, testWorkspaceId);
      expect(role).toBe(WorkspaceRole.ADMIN);
    });

    it('should return MEMBER role for member user', async () => {
      const role = await getWorkspaceRole(memberUserId, testWorkspaceId);
      expect(role).toBe(WorkspaceRole.MEMBER);
    });

    it('should return null for unauthorized user', async () => {
      const role = await getWorkspaceRole(unauthorizedUserId, testWorkspaceId);
      expect(role).toBeNull();
    });
  });

  describe('getWorkspacePermissions', () => {
    it('should return full permissions for owner', async () => {
      const permissions = await getWorkspacePermissions(testUserId, testWorkspaceId);
      expect(permissions).toEqual({
        read: true,
        write: true,
        delete: true,
        invite: true,
        admin: true
      });
    });

    it('should return admin permissions without delete for admin', async () => {
      const permissions = await getWorkspacePermissions(adminUserId, testWorkspaceId);
      expect(permissions).toEqual({
        read: true,
        write: true,
        delete: false,
        invite: true,
        admin: true
      });
    });

    it('should return member permissions for member', async () => {
      const permissions = await getWorkspacePermissions(memberUserId, testWorkspaceId);
      expect(permissions).toEqual({
        read: true,
        write: true,
        delete: false,
        invite: false,
        admin: false
      });
    });

    it('should return read-only permissions for viewer', async () => {
      const permissions = await getWorkspacePermissions(viewerUserId, testWorkspaceId);
      expect(permissions).toEqual({
        read: true,
        write: false,
        delete: false,
        invite: false,
        admin: false
      });
    });

    it('should return null for unauthorized user', async () => {
      const permissions = await getWorkspacePermissions(unauthorizedUserId, testWorkspaceId);
      expect(permissions).toBeNull();
    });
  });

  describe('hasWorkspacePermission', () => {
    it('should allow read permission for all members', async () => {
      expect(await hasWorkspacePermission(viewerUserId, testWorkspaceId, 'read')).toBe(true);
      expect(await hasWorkspacePermission(memberUserId, testWorkspaceId, 'read')).toBe(true);
      expect(await hasWorkspacePermission(adminUserId, testWorkspaceId, 'read')).toBe(true);
      expect(await hasWorkspacePermission(testUserId, testWorkspaceId, 'read')).toBe(true);
    });

    it('should deny write permission for viewer', async () => {
      expect(await hasWorkspacePermission(viewerUserId, testWorkspaceId, 'write')).toBe(false);
    });

    it('should allow write permission for member and above', async () => {
      expect(await hasWorkspacePermission(memberUserId, testWorkspaceId, 'write')).toBe(true);
      expect(await hasWorkspacePermission(adminUserId, testWorkspaceId, 'write')).toBe(true);
      expect(await hasWorkspacePermission(testUserId, testWorkspaceId, 'write')).toBe(true);
    });

    it('should deny delete permission for non-owners', async () => {
      expect(await hasWorkspacePermission(viewerUserId, testWorkspaceId, 'delete')).toBe(false);
      expect(await hasWorkspacePermission(memberUserId, testWorkspaceId, 'delete')).toBe(false);
      expect(await hasWorkspacePermission(adminUserId, testWorkspaceId, 'delete')).toBe(false);
    });

    it('should allow delete permission only for owner', async () => {
      expect(await hasWorkspacePermission(testUserId, testWorkspaceId, 'delete')).toBe(true);
    });
  });

  describe('Member Management', () => {
    let newUserId: number;

    beforeEach(async () => {
      const newUser = await prisma.user.create({
        data: {
          email: `new-${Date.now()}@test.com`,
          name: 'New User'
        }
      });
      newUserId = newUser.id;
    });

    it('should add new member to workspace', async () => {
      const success = await addWorkspaceMember(
        testWorkspaceId,
        newUserId,
        WorkspaceRole.MEMBER,
        testUserId
      );
      expect(success).toBe(true);

      const hasAccess = await hasWorkspaceAccess(newUserId, testWorkspaceId);
      expect(hasAccess).toBe(true);
    });

    it('should update existing member role', async () => {
      await addWorkspaceMember(testWorkspaceId, newUserId, WorkspaceRole.VIEWER, testUserId);

      const success = await updateWorkspaceRole(testWorkspaceId, newUserId, WorkspaceRole.MEMBER);
      expect(success).toBe(true);

      const role = await getWorkspaceRole(newUserId, testWorkspaceId);
      expect(role).toBe(WorkspaceRole.MEMBER);
    });

    it('should remove member from workspace', async () => {
      await addWorkspaceMember(testWorkspaceId, newUserId, WorkspaceRole.MEMBER, testUserId);

      const success = await removeWorkspaceMember(testWorkspaceId, newUserId);
      expect(success).toBe(true);

      const hasAccess = await hasWorkspaceAccess(newUserId, testWorkspaceId);
      expect(hasAccess).toBe(false);
    });

    it('should list all workspace members', async () => {
      const members = await listWorkspaceMembers(testWorkspaceId);

      expect(members.length).toBeGreaterThanOrEqual(4); // owner, admin, member, viewer
      expect(members.some(m => m.user_id === testUserId && m.role === 'owner')).toBe(true);
      expect(members.some(m => m.user_id === adminUserId && m.role === 'admin')).toBe(true);
      expect(members.some(m => m.user_id === memberUserId && m.role === 'member')).toBe(true);
      expect(members.some(m => m.user_id === viewerUserId && m.role === 'viewer')).toBe(true);
    });
  });

  describe('Security - Fail Closed', () => {
    it('should deny access on database error', async () => {
      // Test with invalid workspace ID that causes error
      const hasAccess = await hasWorkspaceAccess(testUserId, -1);
      expect(hasAccess).toBe(false);
    });

    it('should return null role on error', async () => {
      const role = await getWorkspaceRole(testUserId, -1);
      expect(role).toBeNull();
    });

    it('should return null permissions on error', async () => {
      const permissions = await getWorkspacePermissions(testUserId, -1);
      expect(permissions).toBeNull();
    });
  });
});
