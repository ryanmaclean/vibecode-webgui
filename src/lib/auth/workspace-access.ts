/**
 * Workspace Access Control - Real Implementation
 *
 * Replaces placeholder authorization logic with Prisma-backed
 * role-based access control using the workspace_members table.
 *
 * @see docs/database/QUICK_WINS.md for schema details
 * @see #283 for security issue details
 */

import { prisma } from '@/lib/prisma';
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics';
import { logger } from '@/lib/logger';

/**
 * Workspace roles with hierarchical permissions
 */
export enum WorkspaceRole {
  OWNER = 'owner',     // Full control, can delete workspace
  ADMIN = 'admin',     // Can manage members and settings
  MEMBER = 'member',   // Can read and write content
  VIEWER = 'viewer'    // Read-only access
}

/**
 * Granular permissions for workspace members
 */
export interface WorkspacePermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  invite: boolean;
  admin: boolean;
}

/**
 * Default permissions by role
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermissions> = {
  [WorkspaceRole.OWNER]: {
    read: true,
    write: true,
    delete: true,
    invite: true,
    admin: true
  },
  [WorkspaceRole.ADMIN]: {
    read: true,
    write: true,
    delete: false,
    invite: true,
    admin: true
  },
  [WorkspaceRole.MEMBER]: {
    read: true,
    write: true,
    delete: false,
    invite: false,
    admin: false
  },
  [WorkspaceRole.VIEWER]: {
    read: true,
    write: false,
    delete: false,
    invite: false,
    admin: false
  }
};

/**
 * Check if user has access to workspace with optional role requirement
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to check access for
 * @param requiredRole - Optional minimum role required (defaults to any active membership)
 * @returns true if user has access, false otherwise
 *
 * @example
 * ```typescript
 * // Check basic access
 * const hasAccess = await hasWorkspaceAccess(userId, workspaceId);
 *
 * // Check admin access
 * const isAdmin = await hasWorkspaceAccess(userId, workspaceId, WorkspaceRole.ADMIN);
 * ```
 */
export async function hasWorkspaceAccess(
  userId: number,
  workspaceId: number | string,
  requiredRole?: WorkspaceRole
): Promise<boolean> {
  const startTime = Date.now();

  try {
    // Convert string workspace_id to numeric id if needed
    const workspaceIdNum = typeof workspaceId === 'string'
      ? await getWorkspaceIdFromIdentifier(workspaceId)
      : workspaceId;

    if (!workspaceIdNum) {
      datadogMetrics.increment('workspace.access.workspace_not_found', 1);
      return false;
    }

    // Query workspace membership
    const membership = await prisma.$queryRaw<Array<{
      role: string;
      permissions: any;
      revoked_at: Date | null;
    }>>`
      SELECT role, permissions, revoked_at
      FROM workspace_members
      WHERE user_id = ${userId}
        AND workspace_id = ${workspaceIdNum}
        AND revoked_at IS NULL
      LIMIT 1
    `;

    const duration = Date.now() - startTime;
    datadogMetrics.histogram('workspace.access.check.duration', duration);

    // No active membership found
    if (!membership || membership.length === 0) {
      datadogMetrics.increment('workspace.access.denied', 1, {
        reason: 'no_membership'
      });
      return false;
    }

    const member = membership[0];

    // Check if role meets requirement
    if (requiredRole) {
      const hasRequiredRole = isRoleSufficient(member.role as WorkspaceRole, requiredRole);

      if (!hasRequiredRole) {
        datadogMetrics.increment('workspace.access.denied', 1, {
          reason: 'insufficient_role',
          user_role: member.role,
          required_role: requiredRole
        });
        return false;
      }
    }

    datadogMetrics.increment('workspace.access.granted', 1, {
      role: member.role
    });

    return true;

  } catch (error) {
    logger.error('Workspace access check failed:', error);
    datadogMetrics.increment('workspace.access.error', 1);

    // Fail closed: deny access on error
    return false;
  }
}

/**
 * Get workspace ID from workspace identifier string
 */
async function getWorkspaceIdFromIdentifier(workspaceId: string): Promise<number | null> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { workspace_id: workspaceId },
      select: { id: true }
    });
    return workspace?.id || null;
  } catch {
    return null;
  }
}

/**
 * Check if a role is sufficient for the required role
 * Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
 */
function isRoleSufficient(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  const roleHierarchy = [
    WorkspaceRole.VIEWER,
    WorkspaceRole.MEMBER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.OWNER
  ];

  const userRoleLevel = roleHierarchy.indexOf(userRole);
  const requiredRoleLevel = roleHierarchy.indexOf(requiredRole);

  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Get user's role in workspace
 */
export async function getWorkspaceRole(
  userId: number,
  workspaceId: number | string
): Promise<WorkspaceRole | null> {
  try {
    const workspaceIdNum = typeof workspaceId === 'string'
      ? await getWorkspaceIdFromIdentifier(workspaceId)
      : workspaceId;

    if (!workspaceIdNum) return null;

    const membership = await prisma.$queryRaw<Array<{ role: string }>>`
      SELECT role
      FROM workspace_members
      WHERE user_id = ${userId}
        AND workspace_id = ${workspaceIdNum}
        AND revoked_at IS NULL
      LIMIT 1
    `;

    return membership?.[0]?.role as WorkspaceRole || null;
  } catch {
    return null;
  }
}

/**
 * Get user's permissions in workspace
 */
export async function getWorkspacePermissions(
  userId: number,
  workspaceId: number | string
): Promise<WorkspacePermissions | null> {
  try {
    const workspaceIdNum = typeof workspaceId === 'string'
      ? await getWorkspaceIdFromIdentifier(workspaceId)
      : workspaceId;

    if (!workspaceIdNum) return null;

    const membership = await prisma.$queryRaw<Array<{
      role: string;
      permissions: any;
    }>>`
      SELECT role, permissions
      FROM workspace_members
      WHERE user_id = ${userId}
        AND workspace_id = ${workspaceIdNum}
        AND revoked_at IS NULL
      LIMIT 1
    `;

    if (!membership || membership.length === 0) {
      return null;
    }

    const { role, permissions } = membership[0];

    // Merge role-based permissions with custom permissions
    const rolePerms = ROLE_PERMISSIONS[role as WorkspaceRole];
    const customPerms = permissions || {};

    return {
      read: customPerms.read ?? rolePerms.read,
      write: customPerms.write ?? rolePerms.write,
      delete: customPerms.delete ?? rolePerms.delete,
      invite: customPerms.invite ?? rolePerms.invite,
      admin: customPerms.admin ?? rolePerms.admin
    };
  } catch {
    return null;
  }
}

/**
 * Check if user has specific permission in workspace
 */
export async function hasWorkspacePermission(
  userId: number,
  workspaceId: number | string,
  permission: keyof WorkspacePermissions
): Promise<boolean> {
  const permissions = await getWorkspacePermissions(userId, workspaceId);
  return permissions?.[permission] || false;
}

/**
 * Add user to workspace with role
 */
export async function addWorkspaceMember(
  workspaceId: number,
  userId: number,
  role: WorkspaceRole,
  invitedBy: number
): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      INSERT INTO workspace_members (user_id, workspace_id, role, invited_by, accepted_at)
      VALUES (${userId}, ${workspaceId}, ${role}, ${invitedBy}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, workspace_id)
      DO UPDATE SET
        role = EXCLUDED.role,
        revoked_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `;

    datadogMetrics.increment('workspace.member.added', 1, { role });
    return true;
  } catch (error) {
    logger.error('Failed to add workspace member:', error);
    datadogMetrics.increment('workspace.member.add_failed', 1);
    return false;
  }
}

/**
 * Remove user from workspace (soft delete via revoked_at)
 */
export async function removeWorkspaceMember(
  workspaceId: number,
  userId: number
): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      UPDATE workspace_members
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND workspace_id = ${workspaceId}
        AND revoked_at IS NULL
    `;

    datadogMetrics.increment('workspace.member.removed', 1);
    return true;
  } catch (error) {
    logger.error('Failed to remove workspace member:', error);
    datadogMetrics.increment('workspace.member.remove_failed', 1);
    return false;
  }
}

/**
 * Update user's role in workspace
 */
export async function updateWorkspaceRole(
  workspaceId: number,
  userId: number,
  newRole: WorkspaceRole
): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      UPDATE workspace_members
      SET role = ${newRole}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND workspace_id = ${workspaceId}
        AND revoked_at IS NULL
    `;

    datadogMetrics.increment('workspace.member.role_updated', 1, {
      new_role: newRole
    });
    return true;
  } catch (error) {
    logger.error('Failed to update workspace role:', error);
    datadogMetrics.increment('workspace.member.role_update_failed', 1);
    return false;
  }
}

/**
 * List all members of a workspace
 */
export async function listWorkspaceMembers(workspaceId: number) {
  try {
    const members = await prisma.$queryRaw<Array<{
      user_id: number;
      email: string;
      name: string | null;
      role: string;
      invited_at: Date;
      accepted_at: Date | null;
    }>>`
      SELECT
        wm.user_id,
        u.email,
        u.name,
        wm.role,
        wm.invited_at,
        wm.accepted_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ${workspaceId}
        AND wm.revoked_at IS NULL
      ORDER BY
        CASE wm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          WHEN 'viewer' THEN 4
        END,
        wm.created_at ASC
    `;

    return members;
  } catch (error) {
    logger.error('Failed to list workspace members:', error);
    return [];
  }
}

/**
 * Ensure access control middleware for API routes
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const { allowed, error } = await requireWorkspaceAccess(
 *     request,
 *     'ws-123',
 *     WorkspaceRole.MEMBER
 *   );
 *
 *   if (!allowed) {
 *     return NextResponse.json(error, { status: 403 });
 *   }
 *
 *   // Continue with authorized request...
 * }
 * ```
 */
export async function requireWorkspaceAccess(
  request: Request,
  workspaceId: number | string,
  requiredRole?: WorkspaceRole
): Promise<{
  allowed: boolean;
  userId?: number;
  error?: { error: string; message: string };
}> {
  try {
    // Get user session (implementation depends on your auth setup)
    const session = await getServerSession();

    if (!session?.user?.id) {
      return {
        allowed: false,
        error: {
          error: 'Unauthorized',
          message: 'Authentication required'
        }
      };
    }

    const userId = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id;

    const hasAccess = await hasWorkspaceAccess(userId, workspaceId, requiredRole);

    if (!hasAccess) {
      return {
        allowed: false,
        userId,
        error: {
          error: 'Forbidden',
          message: requiredRole
            ? `Insufficient permissions. Required role: ${requiredRole}`
            : 'Access denied to this workspace'
        }
      };
    }

    return {
      allowed: true,
      userId
    };

  } catch (error) {
    logger.error('Workspace access check failed:', error);
    return {
      allowed: false,
      error: {
        error: 'Internal Server Error',
        message: 'Failed to verify workspace access'
      }
    };
  }
}

// Helper to get server session (adjust based on your auth setup)
async function getServerSession() {
  try {
    const { getServerSession: getSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    return await getSession(authOptions);
  } catch {
    return null;
  }
}
