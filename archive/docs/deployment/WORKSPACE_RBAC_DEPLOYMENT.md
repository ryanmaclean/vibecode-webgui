# Workspace RBAC Deployment Guide

**Issue**: #283 - Implement real workspace access control in API routes
**Status**: Ready for deployment
**Risk Level**: HIGH - Security-critical change affecting all workspace endpoints
**Created**: 2025-10-02
**Author**: Casey (Access Control Specialist)

## Executive Summary

This deployment fixes a critical security vulnerability where workspace authorization is completely bypassed, allowing any authenticated user to access any workspace. The fix implements proper role-based access control (RBAC) using the `workspace_members` table with granular permissions.

### Changes Overview
- **Database**: New `workspace_members` table with role-based permissions
- **Authorization**: Real Prisma-backed access checks replacing placeholder logic
- **API Routes**: 4 files require updates to enforce access control
- **Testing**: Comprehensive integration tests covering all scenarios

---

## Pre-Deployment Checklist

### 1. Environment Verification

- [ ] **Database Access**: Verify Postgres connection via `DATABASE_URL`
  ```bash
  npm run prisma -- db execute --stdin <<< "SELECT 1"
  ```

- [ ] **Prisma Client**: Ensure Prisma client is up to date
  ```bash
  npm run prisma generate
  ```

- [ ] **Backup Database**: Create snapshot before migration
  ```bash
  # For managed Postgres (example):
  # pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Test Environment**: Run migration on staging/dev first
  ```bash
  DATABASE_URL=<staging_url> npm run prisma migrate deploy
  ```

### 2. Code Verification

- [ ] **Migration File**: Confirm exists at `prisma/migrations/20251002_add_workspace_members/migration.sql`
- [ ] **Authorization Library**: Verify `src/lib/auth/workspace-access.ts` exists and compiles
- [ ] **Integration Tests**: Confirm test file at `tests/integration/api/workspace-access.test.ts`

### 3. Dependency Check

- [ ] **Prisma Version**: Ensure compatible version
  ```bash
  npm list @prisma/client prisma
  ```

- [ ] **TypeScript**: Verify workspace-access.ts compiles
  ```bash
  npm run build
  ```

---

## Deployment Steps

### Phase 1: Database Migration (5-10 minutes)

#### Step 1.1: Review Migration
```bash
cat prisma/migrations/20251002_add_workspace_members/migration.sql
```

**Expected Content**:
- Creates `workspace_members` table with roles: owner, admin, member, viewer
- Adds indexes for performance: `workspace_members_workspace_role_idx`, `workspace_members_active_idx`, `workspace_members_user_idx`
- Includes trigger for `updated_at` timestamp
- Migrates existing workspace owners to new table

#### Step 1.2: Run Migration
```bash
# Production deployment
npm run prisma migrate deploy

# Or with direct connection:
# npx prisma migrate deploy --schema=./prisma/schema.prisma
```

#### Step 1.3: Verify Migration
```sql
-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'workspace_members';

-- Check existing workspaces migrated
SELECT COUNT(*) FROM workspace_members WHERE role = 'owner';

-- Should match workspace count:
SELECT COUNT(*) FROM workspaces;

-- Verify indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'workspace_members';
```

**Expected Results**:
- `workspace_members` table exists
- Owner count matches workspace count
- 3 indexes created: `workspace_members_workspace_role_idx`, `workspace_members_active_idx`, `workspace_members_user_idx`

---

### Phase 2: API Route Updates (10-15 minutes)

The following 4 API route files need updates to use the new authorization library:

#### File 1: `/src/app/api/files/route.ts`

**Current Issue** (Lines 429-451):
```typescript
async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  // TODO: Implement proper workspace access validation
  // Basic validation only
  if (!userId || !workspaceId) {
    return false
  }
  // Validates format but always returns true after regex check
  return true
}
```

**Required Changes**:
1. **Remove** the local `hasWorkspaceAccess` function (lines ~429-451)
2. **Add import** at top of file:
   ```typescript
   import { requireWorkspaceAccess, WorkspaceRole } from '@/lib/auth/workspace-access';
   ```
3. **Update authorization checks** in route handlers (GET, POST, PUT, DELETE):
   ```typescript
   // Example for GET handler
   export async function GET(request: NextRequest) {
     try {
       const workspaceId = request.nextUrl.searchParams.get('workspaceId');

       // Replace old hasWorkspaceAccess call with:
       const { allowed, userId, error } = await requireWorkspaceAccess(
         request,
         workspaceId,
         WorkspaceRole.VIEWER  // Read operations need VIEWER or higher
       );

       if (!allowed) {
         return NextResponse.json(error, { status: 403 });
       }

       // Continue with authorized logic...
     } catch (error) {
       // Error handling...
     }
   }
   ```

**Role Requirements**:
- `GET` operations: `WorkspaceRole.VIEWER` (read-only access)
- `POST`/`PUT` operations: `WorkspaceRole.MEMBER` (write access)
- `DELETE` operations: `WorkspaceRole.ADMIN` (administrative access)

#### File 2: `/src/app/api/files/sync/route.ts`

**Current Issue** (WebSocket connection around line 326):
- No authorization check when WebSocket connects
- Allows any authenticated user to sync files from any workspace

**Required Changes**:
1. **Add import** at top:
   ```typescript
   import { hasWorkspaceAccess, WorkspaceRole } from '@/lib/auth/workspace-access';
   import { getServerSession } from 'next-auth';
   import { authOptions } from '@/lib/auth';
   ```

2. **Add authorization check** before WebSocket upgrade (find WebSocket handling section):
   ```typescript
   // Before accepting WebSocket connection
   const session = await getServerSession(authOptions);
   const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

   if (!userId) {
     ws.close(1008, JSON.stringify({
       error: 'Unauthorized',
       message: 'Authentication required'
     }));
     return;
   }

   const hasAccess = await hasWorkspaceAccess(
     userId,
     workspaceId,
     WorkspaceRole.MEMBER  // Sync needs write access
   );

   if (!hasAccess) {
     ws.close(1008, JSON.stringify({
       error: 'Forbidden',
       message: 'Access denied to this workspace'
     }));
     return;
   }

   // Continue with WebSocket connection setup...
   ```

**WebSocket Error Codes**:
- `1008`: Policy Violation (unauthorized access)
- Include descriptive error JSON in close message

#### File 3: `/src/app/api/claude/chat/secure-route.ts`

**Current Issue** (Lines 238-260):
```typescript
async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  // TODO: Implement proper workspace access validation with database
  // Basic format validation only
  return true  // Always returns true!
}
```

**Required Changes**:
1. **Remove** the local `hasWorkspaceAccess` function
2. **Add import**:
   ```typescript
   import { requireWorkspaceAccess, WorkspaceRole } from '@/lib/auth/workspace-access';
   ```
3. **Update route handler** (likely POST for chat):
   ```typescript
   export async function POST(request: NextRequest) {
     const { workspaceId, message } = await request.json();

     const { allowed, userId, error } = await requireWorkspaceAccess(
       request,
       workspaceId,
       WorkspaceRole.MEMBER  // Chat needs write access to interact
     );

     if (!allowed) {
       return NextResponse.json(error, { status: 403 });
     }

     // Continue with Claude chat logic...
   }
   ```

#### File 4: `/src/app/api/ai/search/route.ts` & `/src/app/api/ai/chat/unified/route.ts`

**Note**: These files were identified by grep but need verification for workspace access patterns.

**Investigation Required**:
1. Search for workspace access patterns:
   ```bash
   grep -n "workspaceId\|workspace_id" src/app/api/ai/search/route.ts
   grep -n "workspaceId\|workspace_id" src/app/api/ai/chat/unified/route.ts
   ```

2. If workspace operations exist, apply same pattern as above files

**Standard Pattern**:
```typescript
// For read operations (search)
const { allowed, error } = await requireWorkspaceAccess(
  request,
  workspaceId,
  WorkspaceRole.VIEWER
);

// For write operations (chat)
const { allowed, error } = await requireWorkspaceAccess(
  request,
  workspaceId,
  WorkspaceRole.MEMBER
);
```

---

### Phase 3: Build & Test (15-20 minutes)

#### Step 3.1: TypeScript Compilation
```bash
npm run build
```

**Expected**: No TypeScript errors, successful build

#### Step 3.2: Integration Tests
```bash
# Run workspace access tests specifically
npm run test:integration -- --testPathPattern=workspace-access

# Or run all API integration tests
npm run test:integration -- --testPathPattern=api
```

**Expected Results**:
- All role-based access tests pass
- Authorized users granted access
- Unauthorized users denied with 403
- Fail-closed behavior on errors

#### Step 3.3: Manual Smoke Tests

1. **Authorized Access** (should succeed):
   ```bash
   # GET workspace files as owner
   curl -H "Authorization: Bearer <owner_token>" \
     http://localhost:3002/api/files?workspaceId=<workspace_id>

   # Expected: 200 OK with file list
   ```

2. **Unauthorized Access** (should fail):
   ```bash
   # GET workspace files as non-member
   curl -H "Authorization: Bearer <unauthorized_token>" \
     http://localhost:3002/api/files?workspaceId=<workspace_id>

   # Expected: 403 Forbidden
   # {"error": "Forbidden", "message": "Access denied to this workspace"}
   ```

3. **Insufficient Role** (should fail):
   ```bash
   # DELETE file as viewer (needs admin)
   curl -X DELETE -H "Authorization: Bearer <viewer_token>" \
     http://localhost:3002/api/files/<file_id>?workspaceId=<workspace_id>

   # Expected: 403 Forbidden
   # {"error": "Forbidden", "message": "Insufficient permissions. Required role: admin"}
   ```

4. **WebSocket Access**:
   ```javascript
   // Test WebSocket sync connection
   const ws = new WebSocket('ws://localhost:3002/api/files/sync?workspaceId=<id>');

   // Unauthorized: should close with code 1008
   // Authorized: should receive {"type": "connected", ...}
   ```

---

### Phase 4: Deployment Verification (5 minutes)

#### Step 4.1: Database State Check
```sql
-- Verify all workspaces have owners
SELECT
  w.id,
  w.name,
  COUNT(wm.user_id) as member_count,
  COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) as owner_count
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.revoked_at IS NULL
GROUP BY w.id, w.name
HAVING COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) = 0;

-- Expected: Empty result (all workspaces should have an owner)
```

#### Step 4.2: Access Log Review
```bash
# Check Datadog for access metrics (if enabled)
# Look for these metrics:
# - workspace.access.granted (should increase)
# - workspace.access.denied (should increase for unauthorized attempts)
# - workspace.access.check.duration (should be < 50ms p95)
```

#### Step 4.3: Error Rate Monitoring
```bash
# Monitor application logs for 403 errors
# Expect increase in 403s as unauthorized access is now blocked
grep "403" /var/log/app/*.log | tail -20

# Should see: "Access denied to this workspace" messages
```

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

If critical issues arise, rollback can be performed in two ways:

#### Option A: Code-Only Rollback (Fastest)

Revert API route changes to use placeholder logic:

```bash
# Revert the 4 API files
git checkout HEAD~1 -- \
  src/app/api/files/route.ts \
  src/app/api/files/sync/route.ts \
  src/app/api/claude/chat/secure-route.ts

# Restart application
npm run build && npm run start
```

**WARNING**: This re-exposes the security vulnerability. Use only for critical production issues.

#### Option B: Full Rollback (Database + Code)

```bash
# 1. Revert code changes
git revert <deployment_commit_sha>

# 2. Drop workspace_members table (DESTRUCTIVE)
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS workspace_members CASCADE;
EOF

# 3. Rebuild and restart
npm run build && npm run start
```

**WARNING**: This destroys all workspace membership data. Only use if migration caused database corruption.

### Rollback Decision Matrix

| Issue | Severity | Recommended Action |
|-------|----------|-------------------|
| 5xx errors spike > 10% | CRITICAL | Option A: Code-only rollback |
| Legitimate users denied access | HIGH | Option A + hotfix member records |
| Slow query performance (> 500ms) | MEDIUM | Add database indexes, no rollback |
| Test failures only | LOW | Fix tests, no rollback |
| Database corruption | CRITICAL | Option B: Full rollback |

---

## Monitoring & Validation

### Success Metrics

Track these metrics for 24-48 hours post-deployment:

1. **Authorization Metrics** (Datadog):
   - `workspace.access.granted` - Should be stable
   - `workspace.access.denied` - Should increase (blocking unauthorized attempts)
   - `workspace.access.check.duration` - P95 should be < 50ms

2. **Error Rates**:
   - 403 errors: **Expected increase** (now blocking unauthorized access)
   - 5xx errors: **Should remain stable** (no increase)
   - WebSocket 1008 closes: **Expected increase** (unauthorized connections)

3. **User Impact**:
   - Zero reports of legitimate users denied access
   - No increase in authentication-related support tickets

### Validation Queries

Run these queries periodically to ensure system health:

```sql
-- Check for orphaned workspaces (no owner)
SELECT COUNT(*) FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.role = 'owner'
    AND wm.revoked_at IS NULL
);
-- Expected: 0

-- Check access control query performance
EXPLAIN ANALYZE
SELECT role, permissions, revoked_at
FROM workspace_members
WHERE user_id = 123 AND workspace_id = 456 AND revoked_at IS NULL
LIMIT 1;
-- Expected: < 5ms execution time, uses index

-- Monitor role distribution
SELECT role, COUNT(*) as count
FROM workspace_members
WHERE revoked_at IS NULL
GROUP BY role
ORDER BY count DESC;
-- Expected: Majority are 'owner', some 'member', fewer 'admin'/'viewer'
```

---

## Post-Deployment Tasks

### Immediate (Day 1)

- [ ] Monitor error rates and access metrics for anomalies
- [ ] Review application logs for unexpected 403 errors
- [ ] Verify legitimate users can access their workspaces
- [ ] Check database query performance (should be < 50ms)
- [ ] Update monitoring dashboards with new access metrics

### Short-term (Week 1)

- [ ] Add database index monitoring for `workspace_members` table
- [ ] Create alerts for:
  - Orphaned workspaces (no owner)
  - High authorization denial rate (> 50% of requests)
  - Slow access checks (> 100ms p95)
- [ ] Document any edge cases discovered
- [ ] Update runbooks with common access issues

### Long-term (Month 1)

- [ ] Analyze access patterns for optimization opportunities
- [ ] Consider caching layer for frequently accessed workspaces
- [ ] Implement workspace invitation workflow (uses `invited_at` field)
- [ ] Add audit logging for role changes and access denials
- [ ] Create admin UI for workspace member management

---

## Troubleshooting Guide

### Common Issues

#### Issue 1: "Access denied to this workspace" for legitimate users

**Symptoms**: User reports 403 error when accessing their own workspace

**Diagnosis**:
```sql
-- Check user's membership
SELECT wm.*, w.name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = <user_id> AND wm.workspace_id = <workspace_id>;

-- If no rows: user not added to workspace
-- If revoked_at IS NOT NULL: membership was revoked
```

**Fix**:
```sql
-- Add user to workspace
INSERT INTO workspace_members (user_id, workspace_id, role, invited_by, accepted_at)
VALUES (<user_id>, <workspace_id>, 'member', <admin_id>, CURRENT_TIMESTAMP)
ON CONFLICT (user_id, workspace_id)
DO UPDATE SET revoked_at = NULL;
```

#### Issue 2: Slow authorization checks (> 100ms)

**Symptoms**: High latency on workspace endpoints

**Diagnosis**:
```sql
-- Check if indexes are being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT role FROM workspace_members
WHERE user_id = 123 AND workspace_id = 456 AND revoked_at IS NULL;

-- Should show "Index Scan" using workspace_members_active_idx
```

**Fix**:
```sql
-- If not using index, rebuild:
REINDEX INDEX workspace_members_active_idx;

-- Or add missing index:
CREATE INDEX IF NOT EXISTS workspace_members_active_idx
ON workspace_members(user_id, workspace_id, revoked_at);
```

#### Issue 3: WebSocket connections closing immediately

**Symptoms**: File sync not working, WebSocket closes with code 1008

**Diagnosis**:
```javascript
// Check WebSocket close reason
ws.onclose = (event) => {
  console.log('Close code:', event.code);
  console.log('Close reason:', event.reason);
};

// Code 1008 = policy violation (authorization failed)
```

**Fix**:
- Verify user has `WorkspaceRole.MEMBER` or higher
- Check WebSocket request includes valid authentication token
- Ensure workspace_id parameter is correct

#### Issue 4: Orphaned workspaces (no owner)

**Symptoms**: Workspace exists but no one can access it

**Diagnosis**:
```sql
SELECT w.id, w.name, w.user_id, w.created_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = w.id AND wm.role = 'owner' AND wm.revoked_at IS NULL
);
```

**Fix**:
```sql
-- Assign original creator as owner
INSERT INTO workspace_members (user_id, workspace_id, role, accepted_at)
SELECT user_id, id, 'owner', created_at
FROM workspaces
WHERE id = <orphaned_workspace_id>
ON CONFLICT (user_id, workspace_id) DO NOTHING;
```

---

## Security Considerations

### Authentication Requirements

- All API routes now require valid NextAuth session
- Session validation happens before authorization check
- Failed authentication returns 401 Unauthorized
- Failed authorization returns 403 Forbidden

### Authorization Model

**Role Hierarchy** (high to low privilege):
1. `OWNER` - Full control, can delete workspace, manage all members
2. `ADMIN` - Can manage members and settings, cannot delete workspace
3. `MEMBER` - Can read and write content, cannot manage members
4. `VIEWER` - Read-only access, cannot modify content

**Permission Matrix**:

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Read files | ✅ | ✅ | ✅ | ✅ |
| Write files | ✅ | ✅ | ✅ | ❌ |
| Delete files | ✅ | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Manage roles | ✅ | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |

### Fail-Closed Design

All authorization checks fail closed:
- Database errors → deny access
- Missing session → deny access
- Invalid workspace ID → deny access
- Revoked membership → deny access

This prevents security bypass via error conditions.

### Audit Trail

The `workspace_members` table maintains audit trail:
- `invited_at`: When user was invited
- `invited_by`: Who invited the user
- `accepted_at`: When user accepted invitation
- `revoked_at`: When access was revoked (soft delete)

Future enhancement: Add `audit_log` table for all access events.

---

## References

### Related Files
- **Migration**: `prisma/migrations/20251002_add_workspace_members/migration.sql`
- **Authorization Library**: `src/lib/auth/workspace-access.ts`
- **Integration Tests**: `tests/integration/api/workspace-access.test.ts`
- **Database Schema**: `docs/database/QUICK_WINS.md`

### API Routes to Update
1. `src/app/api/files/route.ts` (Lines 429-451)
2. `src/app/api/files/sync/route.ts` (WebSocket authorization)
3. `src/app/api/claude/chat/secure-route.ts` (Lines 238-260)
4. `src/app/api/ai/search/route.ts` (verification needed)
5. `src/app/api/ai/chat/unified/route.ts` (verification needed)

### Issue Tracking
- **Primary Issue**: #283 - Implement real workspace access control in API routes
- **Related**: Database Quick Wins implementation
- **Testing**: Integration test suite for workspace access

---

## Deployment Sign-off

Before proceeding with production deployment, ensure:

- [ ] All pre-deployment checks completed
- [ ] Staging deployment successful
- [ ] Integration tests passing
- [ ] Rollback plan reviewed and understood
- [ ] Monitoring dashboards prepared
- [ ] On-call engineer notified
- [ ] Deployment window scheduled (recommend low-traffic period)

**Deployment Approval Required From**:
- [ ] Tech Lead / Engineering Manager
- [ ] Security Team (due to security-critical nature)
- [ ] DBA / Database Team (for migration review)

**Estimated Deployment Time**: 30-40 minutes (including verification)
**Recommended Window**: Low-traffic period (e.g., 2-4 AM in primary timezone)
**Risk Mitigation**: Staged rollout with immediate rollback capability

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Next Review**: After successful deployment

For questions or issues during deployment, contact: Security/Backend team via #engineering-security channel.
