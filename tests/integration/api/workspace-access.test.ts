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

    // Create test workspace
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
    // Clean up test data
    await prisma.$executeRaw`DELETE FROM workspace_members WHERE workspace_id = ${testWorkspaceId}`;
    await prisma.workspace.delete({ where: { id: testWorkspaceId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'owner@test.com',
            'admin@test.com',
            'member@test.com',
            'viewer@test.com',
            'unauthorized@test.com'
          ]
        }
      }
    });
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
