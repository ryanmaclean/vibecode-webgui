# Phase 1 Deployment Readiness Assessment

**Assessment Date**: 2025-10-01
**Assessed By**: Deployment Readiness Engineer
**Phase**: Phase 1 Production Deployment Review
**Overall Deployment Status**: **CONDITIONAL_GO**

---

## Executive Summary

Phase 1 contains critical security fixes (Workspace RBAC), infrastructure improvements (Docker optimization), and monitoring consolidation. However, **3 critical blockers** prevent immediate production deployment.

**Key Findings**:
- Workspace RBAC library exists but **API routes not updated** (4 files still use placeholder auth)
- Database migration ready but **not deployed** (migration file exists but schema not updated)
- Build system **currently broken** (webpack error prevents production builds)
- Monitoring consolidation **partially complete** (instrumentation.ts updated)
- Tauri desktop app **not distribution-ready** (no packaging artifacts)

**Deployment Recommendation**: **CONDITIONAL_GO** - Deploy after resolving 3 critical blockers (estimated 4-6 hours work)

---

## Deployment Risk Matrix

| Component | Risk Level | Deployment Ready | Blockers | Rollback Feasible |
|-----------|-----------|------------------|----------|-------------------|
| **Workspace RBAC** | CRITICAL | NO | API routes not updated | YES (code-only) |
| **Database Migration** | HIGH | YES | Migration not run | YES (drop table) |
| **Docker Infrastructure** | LOW | YES | None | YES (revert compose) |
| **Tauri Desktop App** | LOW | NO | No packaging | N/A (not released) |
| **Monitoring Consolidation** | LOW | YES | None | YES (revert instrumentation) |
| **React Fixes** | LOW | UNKNOWN | No details provided | Unknown |
| **Build System** | CRITICAL | NO | Webpack error | YES (revert changes) |

### Risk Severity Legend
- **CRITICAL**: Production-breaking, immediate user impact, security vulnerability
- **HIGH**: Potential data loss, significant feature degradation
- **MEDIUM**: Performance degradation, minor feature issues
- **LOW**: Cosmetic issues, limited scope impact

---

## Critical Blockers (Must Fix Before Deployment)

### Blocker 1: API Routes Still Use Placeholder Authorization

**Severity**: CRITICAL (Security Vulnerability)
**Status**: NOT FIXED
**Impact**: All workspace endpoints allow unauthorized access

**Evidence**:
```bash
# src/app/api/files/route.ts still has placeholder function
grep -n "async function hasWorkspaceAccess" src/app/api/files/route.ts
429:async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
```

**Current State**:
- `/src/lib/auth/workspace-access.ts` - Complete implementation (494 lines, production-ready)
- `/src/app/api/files/route.ts` - Still uses placeholder that always returns `true`
- `/src/app/api/files/sync/route.ts` - No authorization on WebSocket connections
- `/src/app/api/claude/chat/secure-route.ts` - Placeholder auth function
- `/src/app/api/ai/search/route.ts` - Verification needed

**Required Actions**:
1. Update 4 API route files to import `requireWorkspaceAccess` from `/src/lib/auth/workspace-access.ts`
2. Remove local placeholder `hasWorkspaceAccess` functions
3. Add proper role checks (VIEWER for reads, MEMBER for writes, ADMIN for deletes)
4. Add WebSocket authorization in `/src/app/api/files/sync/route.ts`

**Estimated Effort**: 2-3 hours
**Rollback Plan**: Code-only rollback (revert API route changes)

---

### Blocker 2: Database Migration Not Deployed

**Severity**: HIGH (Blocks Security Fix)
**Status**: MIGRATION READY, NOT DEPLOYED
**Impact**: Workspace RBAC depends on `workspace_members` table

**Evidence**:
```bash
# Migration file exists
prisma/migrations/20251002_add_workspace_members/migration.sql

# But table not in production schema (assumption - needs verification)
```

**Migration Details**:
- **File**: `prisma/migrations/20251002_add_workspace_members/migration.sql`
- **Changes**: Creates `workspace_members` table with roles, permissions, indexes
- **Data Migration**: Migrates existing workspace owners to new table
- **Indexes**: 3 indexes for performance (workspace_role, active, user)
- **Triggers**: Auto-update `updated_at` timestamp

**Pre-Deployment Requirements**:
1. Backup production database
2. Run migration on staging first
3. Verify existing workspaces have owners
4. Test access check query performance (<50ms p95)

**Rollback Plan**:
- **Immediate**: Drop `workspace_members` table (DESTRUCTIVE)
- **Safe**: Keep table, revert API code only (re-exposes vulnerability)

**Estimated Effort**: 30 minutes (migration) + 15 minutes (verification)

---

### Blocker 3: Build System Currently Broken

**Severity**: CRITICAL (Cannot Deploy)
**Status**: BUILD FAILING
**Impact**: Cannot create production deployment artifacts

**Evidence**:
```bash
npm run build
Failed to compile.

HookWebpackError: _webpack.WebpackError is not a constructor
    at makeWebpackError (/Users/ryan.maclean/vibecode-webgui/node_modules/next/dist/compiled/webpack/bundle5.js:29:315765)
```

**Root Cause**: Webpack configuration issue with Next.js 15.5.4

**Possible Causes**:
1. Incompatible webpack plugin version
2. Next.js 15.5.4 breaking change
3. Corrupted webpack cache
4. Missing peer dependencies

**Required Actions**:
1. Clear webpack cache: `rm -rf .next/cache/webpack`
2. Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`
3. Check Next.js 15.5.4 compatibility with plugins
4. Test build: `npm run build`
5. If persists, downgrade Next.js to stable version (15.4.x)

**Estimated Effort**: 1-2 hours
**Rollback Plan**: Revert to last working Next.js version

---

## Component-by-Component Assessment

### 1. Workspace RBAC (Casey's Work)

**Risk Level**: CRITICAL
**Deployment Ready**: NO
**Confidence**: HIGH (comprehensive implementation exists, integration incomplete)

#### What's Done
- Database migration file created (`20251002_add_workspace_members/migration.sql`)
- Authorization library implemented (`/src/lib/auth/workspace-access.ts`, 494 lines)
- Comprehensive integration tests (`/tests/integration/api/workspace-access.test.ts`, 369 lines)
- Deployment guide (`/docs/deployment/WORKSPACE_RBAC_DEPLOYMENT.md`, 724 lines)
- Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
- Fail-closed security design (deny on error)
- Datadog metrics integration
- Permission granularity (read, write, delete, invite, admin)

#### What's Missing
- API routes still use placeholder authorization (4 files)
- Database migration not deployed to production
- WebSocket connections lack authorization
- No staging environment validation

#### Security Impact
**CRITICAL VULNERABILITY REMAINS**: All workspace endpoints currently allow any authenticated user to access any workspace. This is the security issue #283 that was intended to be fixed.

#### Deployment Blockers
1. Update API routes to use real authorization library
2. Deploy database migration (create `workspace_members` table)
3. Migrate existing workspace owners to new table
4. Verify access checks work in staging
5. Monitor access metrics post-deployment

#### Testing Status
- Unit tests: COMPREHENSIVE (integration test suite exists)
- Integration tests: READY (tests cover all role scenarios)
- Staging validation: NOT PERFORMED
- Load testing: NOT PERFORMED

#### Rollback Plan

**Option A: Code-Only Rollback (< 5 minutes)**
```bash
# Revert API route changes
git checkout HEAD~1 -- \
  src/app/api/files/route.ts \
  src/app/api/files/sync/route.ts \
  src/app/api/claude/chat/secure-route.ts

# Restart application
npm run build && npm run start
```
**WARNING**: Re-exposes security vulnerability. Use only for critical production issues.

**Option B: Full Rollback (< 10 minutes)**
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
**WARNING**: Destroys all workspace membership data.

#### Monitoring Requirements

**Success Metrics (track for 24-48 hours post-deployment)**:
1. `workspace.access.granted` - Should remain stable
2. `workspace.access.denied` - Should increase (blocking unauthorized attempts)
3. `workspace.access.check.duration` - P95 < 50ms
4. 403 errors - Expected increase (now blocking unauthorized access)
5. 5xx errors - Should remain stable (no increase)

**Alert Thresholds**:
- Access check duration P95 > 100ms (slow queries)
- 5xx error rate increase > 10% (critical issues)
- Orphaned workspaces (no owner) > 0 (data integrity)
- Authorization denial rate > 50% (misconfiguration)

#### Deployment Sequence
1. **Pre-deployment** (30 min):
   - Backup production database
   - Run migration on staging
   - Verify staging access checks work
   - Update API routes (4 files)
   - Run integration tests
   - Build and test application

2. **Deployment** (15 min):
   - Run database migration in production
   - Verify all workspaces have owners
   - Deploy updated application code
   - Monitor error rates and metrics

3. **Post-deployment** (24 hours):
   - Monitor access metrics
   - Review 403 errors (expected increase)
   - Verify legitimate users not blocked
   - Check query performance (<50ms)

#### Approval Requirements
- [ ] Tech Lead / Engineering Manager
- [ ] Security Team (security-critical change)
- [ ] DBA / Database Team (migration review)
- [ ] QA sign-off on staging validation

---

### 2. Docker Infrastructure

**Risk Level**: LOW
**Deployment Ready**: YES
**Confidence**: HIGH (optimizations, no breaking changes)

#### Changes Made
- Dockerfile.optimized: Reduced from 57 to 12 layers (78% reduction)
- Consolidated COPY operations and merged RUN commands
- Maintained all tool installations (no functionality removed)
- Added healthcheck: `curl -f http://localhost:8765/healthz`
- Optimized build caching strategy

#### Production Impact
- Faster image builds (fewer layers = better caching)
- Smaller image size (consolidated layers)
- No functionality changes (all tools still installed)
- Healthcheck enables container orchestration (Kubernetes liveness probes)

#### Testing Requirements
- [ ] Build docker image: `docker build -f docker/code-server/Dockerfile.optimized -t vibecode:latest .`
- [ ] Run container: `docker run -d -p 8765:8765 vibecode:latest`
- [ ] Verify healthcheck: `curl http://localhost:8765/healthz`
- [ ] Verify all tools available: `docker exec <container> bash -c "aider --version && goose -version && kubectl version --client"`

#### Rollback Plan
```bash
# Revert Dockerfile changes
git checkout HEAD~1 -- docker/code-server/Dockerfile.optimized

# Rebuild image
docker build -f docker/code-server/Dockerfile.optimized -t vibecode:rollback .
```

#### Deployment Recommendation
**SAFE TO DEPLOY** - Optimizations only, no breaking changes. Test in staging first.

---

### 3. Tauri Desktop App

**Risk Level**: LOW
**Deployment Ready**: NO
**Confidence**: MEDIUM (infrastructure exists, packaging incomplete)

#### Current State
- Rust backend compiled (`src-tauri/Cargo.toml`, `src-tauri/src/`)
- Dependencies: tauri, tokio, bollard (Docker client), mdns-sd
- Build artifacts: `src-tauri/target/` (development builds only)
- CI/CD pipeline: `.github/workflows/` (Tauri DMG packaging exists)

#### What's Missing
- **Distribution Packaging**: No DMG/installer artifacts for user release
- **Code Signing**: CI pipeline has signing setup, but not tested
- **Notarization**: Apple notarization process not verified
- **Version Management**: Version 0.1.0 (not release-ready)
- **Update Mechanism**: No auto-updater configured
- **Error Handling**: Production error reporting not integrated

#### Deployment Blockers
1. Generate signed DMG installer
2. Test installation on clean macOS system
3. Verify Docker integration works (bollard client)
4. Configure auto-update mechanism
5. Set up crash reporting (Sentry/Datadog)
6. Version bump to 1.0.0 for initial release

#### Deployment Recommendation
**DO NOT RELEASE TO USERS** - Infrastructure exists but distribution not ready. Focus on web deployment first, desktop app as Phase 2.

#### Future Work (Post-Phase 1)
- Complete DMG packaging and signing
- Test installation on macOS 12+, 13+, 14+
- Set up beta testing program
- Configure Sparkle/Tauri updater
- Add crash reporting integration
- Create user documentation

---

### 4. Monitoring Consolidation (Drew's Work)

**Risk Level**: LOW
**Deployment Ready**: YES
**Confidence**: HIGH (duplicate initialization removed)

#### Changes Made
- **src/instrumentation.ts**: Single-point Datadog tracer initialization
- **Removed duplicate tracer inits**: From backup monitoring files (cleaned up)
- **Singleton pattern**: `initializationPromise` ensures one-time init
- **Runtime detection**: Only initializes in Node.js runtime (not Edge)
- **Graceful degradation**: Skips if `dd-trace` not installed

#### Code Quality
```typescript
// Before (multiple files initializing tracer)
// src/lib/monitoring/datadog-metrics.ts - tracer.init()
// src/app/api/monitoring/performance/route.ts - tracer.init()
// src/instrumentation.ts - tracer.init()

// After (single initialization point)
export async function register() {
  if (!initializationPromise) {
    initializationPromise = initializeDatadogTracer()
  }

  try {
    await initializationPromise
  } finally {
    initializationPromise = null
  }
}
```

#### Testing Requirements
- [ ] Verify single tracer initialization on server start
- [ ] Check Datadog traces appear correctly
- [ ] Confirm no duplicate span IDs
- [ ] Monitor trace context propagation

#### Production Impact
- **Positive**: Eliminates duplicate tracer warnings in logs
- **Positive**: Consistent trace context across requests
- **Neutral**: No functionality changes (only initialization cleanup)
- **Risk**: Low (instrumentation isolated, easy rollback)

#### Rollback Plan
```bash
# Revert instrumentation.ts
git checkout HEAD~1 -- src/instrumentation.ts

# Restart application
npm run build && npm run start
```

#### Deployment Recommendation
**SAFE TO DEPLOY** - Cleanup only, no breaking changes.

---

### 5. React Fixes

**Risk Level**: LOW
**Deployment Ready**: UNKNOWN
**Confidence**: LOW (no details provided in assessment request)

#### Information Needed
- Which React components were fixed?
- What memory leaks were patched?
- Are there tests validating the fixes?
- Any breaking changes to component APIs?

#### Testing Requirements
- [ ] Run React component tests: `npm test -- --testPathPattern=components`
- [ ] Check for memory leaks: `npm run test:memory` (if available)
- [ ] Verify no regressions in UI functionality
- [ ] Browser compatibility testing (Chrome, Firefox, Safari)

#### Deployment Recommendation
**CONDITIONAL_GO** - Need more details about changes before deploying.

---

### 6. Build System

**Risk Level**: CRITICAL
**Deployment Ready**: NO
**Confidence**: HIGH (build currently failing)

#### Current Issue
```bash
npm run build
Failed to compile.

HookWebpackError: _webpack.WebpackError is not a constructor
    at makeWebpackError (/Users/ryan.maclean/vibecode-webgui/node_modules/next/dist/compiled/webpack/bundle5.js:29:315765)
```

#### Root Cause Analysis
- **Next.js Version**: 15.5.4 (latest, may have breaking changes)
- **Webpack Cache**: Possible corruption (cache error in logs)
- **Dependencies**: Potential peer dependency mismatch

#### Resolution Steps
1. **Clear Caches**:
   ```bash
   rm -rf .next/cache
   rm -rf node_modules/.cache
   ```

2. **Reinstall Dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Test Build**:
   ```bash
   npm run build
   ```

4. **If Still Failing, Downgrade Next.js**:
   ```bash
   npm install next@15.4.3
   npm run build
   ```

#### Deployment Blocker
**CRITICAL**: Cannot deploy without successful production build.

#### Estimated Resolution Time
1-2 hours (cache clear + dependency reinstall)

---

## Environment Configuration Changes

### Required Environment Variables

No new environment variables required for Phase 1 deployment.

**Existing Variables** (verify configured):
```bash
# Database (required for RBAC migration)
DATABASE_URL=postgresql://user:pass@host:5432/vibecode

# Datadog (required for monitoring)
DD_API_KEY=<your-datadog-api-key>
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0

# Authentication (required for RBAC)
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=<your-nextauth-secret>
```

### Configuration Verification
```bash
# Check all required variables set
grep -E "DATABASE_URL|DD_API_KEY|NEXTAUTH_SECRET" .env.production.local

# Verify database connection
npm run prisma -- db execute --stdin <<< "SELECT 1"

# Verify Datadog connection
curl -H "DD-API-KEY: $DD_API_KEY" https://api.datadoghq.com/api/v1/validate
```

---

## Staging Environment Requirements

### Pre-Production Validation

**Required Staging Tests**:
1. **Database Migration**:
   - Run migration on staging database
   - Verify no errors, all indexes created
   - Check existing workspace owners migrated correctly
   - Test rollback procedure (drop table + revert code)

2. **Workspace RBAC**:
   - Test authorized access (owner, admin, member, viewer)
   - Test unauthorized access (expect 403 errors)
   - Test role hierarchy (owner can do member actions)
   - Test WebSocket authorization
   - Verify access check performance (<50ms p95)

3. **Docker Infrastructure**:
   - Build optimized image
   - Run container with healthcheck
   - Verify all tools available
   - Test container restart behavior

4. **Monitoring**:
   - Verify single Datadog tracer initialization
   - Check traces appear in Datadog UI
   - Confirm no duplicate span warnings
   - Test custom metrics (workspace.access.*)

5. **Build System**:
   - Clean build succeeds
   - No webpack errors
   - Bundle size analysis (check for bloat)
   - Source maps generated correctly

### Staging Deployment Checklist
- [ ] Database backup created
- [ ] Migration run successfully
- [ ] All integration tests passing
- [ ] RBAC manual smoke tests complete
- [ ] Docker image built and tested
- [ ] Monitoring dashboard configured
- [ ] Rollback procedure tested
- [ ] Performance benchmarks recorded

---

## Rollback Procedures

### Rollback Decision Matrix

| Issue | Severity | Recommended Action | Timeframe |
|-------|----------|-------------------|-----------|
| 5xx errors spike > 10% | CRITICAL | Code-only rollback | < 5 min |
| Legitimate users denied access | HIGH | Code rollback + hotfix members | < 15 min |
| Slow query performance (> 500ms) | MEDIUM | Add indexes, no rollback | < 30 min |
| Test failures only | LOW | Fix tests, no rollback | N/A |
| Database corruption | CRITICAL | Full rollback (drop table) | < 10 min |
| Build failures | CRITICAL | Revert build config | < 10 min |

### Rollback Procedures

#### 1. Workspace RBAC Rollback

**Code-Only Rollback** (< 5 minutes):
```bash
# Revert API route changes
git checkout HEAD~1 -- \
  src/app/api/files/route.ts \
  src/app/api/files/sync/route.ts \
  src/app/api/claude/chat/secure-route.ts

# Restart application
npm run build && npm run start
```

**Full Rollback** (< 10 minutes):
```bash
# 1. Revert code
git revert <deployment_commit_sha>

# 2. Drop workspace_members table
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS workspace_members CASCADE;
EOF

# 3. Rebuild
npm run build && npm run start
```

#### 2. Docker Infrastructure Rollback

```bash
# Revert Dockerfile
git checkout HEAD~1 -- docker/code-server/Dockerfile.optimized

# Rebuild image
docker build -t vibecode:rollback .
```

#### 3. Monitoring Rollback

```bash
# Revert instrumentation.ts
git checkout HEAD~1 -- src/instrumentation.ts

# Restart application
npm run build && npm run start
```

#### 4. Full System Rollback

```bash
# Revert all Phase 1 changes
git revert <phase1_merge_commit_sha>

# Drop new database tables
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS workspace_members CASCADE;
EOF

# Rebuild and restart
npm run build && npm run start
```

---

## Monitoring & Alerting Setup

### Critical Metrics to Monitor

**Workspace RBAC Metrics**:
```
workspace.access.granted           (counter) - Successful access checks
workspace.access.denied            (counter) - Failed access checks
workspace.access.check.duration    (histogram) - Access check latency (target P95 < 50ms)
workspace.access.error             (counter) - Access check errors
workspace.member.added             (counter) - New workspace members
workspace.member.removed           (counter) - Removed workspace members
```

**Application Health**:
```
http.server.requests               (counter) - Total requests
http.server.errors.5xx             (counter) - Server errors (target < 1% of requests)
http.server.errors.403             (counter) - Forbidden errors (expect increase post-deploy)
http.server.response_time          (histogram) - Response latency (target P95 < 500ms)
```

**Database Metrics**:
```
db.connection.pool.active          (gauge) - Active connections
db.connection.pool.idle            (gauge) - Idle connections
db.query.duration                  (histogram) - Query execution time (target P95 < 100ms)
db.query.errors                    (counter) - Failed queries
```

### Alert Configuration

**Critical Alerts** (immediate page):
```yaml
- alert: WorkspaceRBACAccessCheckSlow
  expr: histogram_quantile(0.95, workspace_access_check_duration) > 100
  for: 5m
  severity: critical
  message: "Workspace access checks P95 > 100ms"

- alert: HTTPErrors5xxSpike
  expr: rate(http_server_errors_5xx[5m]) > 0.01
  for: 2m
  severity: critical
  message: "5xx error rate > 1% of requests"

- alert: DatabaseConnectionPoolExhausted
  expr: db_connection_pool_active >= db_connection_pool_max * 0.9
  for: 3m
  severity: critical
  message: "Connection pool 90%+ utilized"
```

**Warning Alerts** (notify team):
```yaml
- alert: WorkspaceRBACDenialRateHigh
  expr: rate(workspace_access_denied[10m]) / rate(workspace_access_granted[10m]) > 0.5
  for: 10m
  severity: warning
  message: "Access denial rate > 50% (possible misconfiguration)"

- alert: OrphanedWorkspaces
  expr: count(workspaces without owner) > 0
  for: 5m
  severity: warning
  message: "Workspaces exist without owner role"
```

### Monitoring Dashboard

**Create Datadog Dashboard** with:
1. **RBAC Overview**:
   - Access granted/denied rate
   - Access check latency (P50, P95, P99)
   - Recent authorization errors

2. **HTTP Traffic**:
   - Request rate
   - Error rate (4xx, 5xx)
   - Response time percentiles

3. **Database Health**:
   - Connection pool utilization
   - Query performance
   - Transaction rate

4. **System Resources**:
   - CPU usage
   - Memory usage
   - Network I/O

---

## Deployment Timeline

### Pre-Deployment Phase (4-6 hours)

**Day 0 - Resolve Blockers**:
1. **Fix Build System** (1-2 hours):
   - Clear webpack cache
   - Reinstall dependencies
   - Test production build
   - Verify no errors

2. **Update API Routes** (2-3 hours):
   - Modify 4 API route files to use real authorization
   - Remove placeholder functions
   - Add WebSocket authorization
   - Run integration tests
   - Test in local development

3. **Staging Validation** (1 hour):
   - Deploy to staging environment
   - Run database migration
   - Test RBAC scenarios manually
   - Verify monitoring metrics
   - Document any issues

### Deployment Day (2-3 hours)

**Recommended Window**: Low-traffic period (2-4 AM in primary timezone)

**Timeline**:
```
00:00 - Pre-deployment checks complete
00:15 - Database backup created
00:20 - Run database migration in production
00:25 - Verify migration success (all workspaces have owners)
00:30 - Deploy application code (docker push + kubernetes apply)
00:35 - Verify application health (healthcheck passing)
00:40 - Smoke tests (authorized/unauthorized access)
00:50 - Monitor metrics for anomalies
01:00 - Deployment complete, continue monitoring
```

**Post-Deployment Monitoring** (24-48 hours):
- Hour 1: Active monitoring (every 15 min)
- Hours 2-8: Regular monitoring (every hour)
- Hours 8-24: Periodic monitoring (every 4 hours)
- Days 2-7: Daily review of metrics

---

## Testing Requirements

### Pre-Deployment Testing

**Unit Tests**:
```bash
# All unit tests must pass
npm run test:unit

# Focus on workspace access tests
npm run test:unit -- --testPathPattern=workspace-access
```

**Integration Tests**:
```bash
# All integration tests must pass
npm run test:integration

# Focus on API route authorization
npm run test:integration -- --testPathPattern=api/workspace-access
```

**Build Verification**:
```bash
# Production build must succeed
npm run build

# Verify bundle size (should be < 5MB)
du -sh .next/static/chunks

# Check for console warnings
grep -i "warn\|error" build.log
```

**Manual Smoke Tests**:
1. **Authorized Access** (should succeed):
   ```bash
   curl -H "Authorization: Bearer <owner_token>" \
     http://localhost:3000/api/files?workspaceId=<workspace_id>
   # Expected: 200 OK with file list
   ```

2. **Unauthorized Access** (should fail):
   ```bash
   curl -H "Authorization: Bearer <unauthorized_token>" \
     http://localhost:3000/api/files?workspaceId=<workspace_id>
   # Expected: 403 Forbidden
   ```

3. **Insufficient Role** (should fail):
   ```bash
   curl -X DELETE -H "Authorization: Bearer <viewer_token>" \
     http://localhost:3000/api/files/<file_id>?workspaceId=<workspace_id>
   # Expected: 403 Forbidden (viewer cannot delete)
   ```

### Post-Deployment Validation

**Automated Checks**:
```bash
# Health check
curl -f https://production-domain.com/api/health

# Verify Datadog metrics
curl -H "DD-API-KEY: $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/query?query=workspace.access.granted"

# Database query performance
psql $DATABASE_URL <<EOF
EXPLAIN ANALYZE
SELECT role FROM workspace_members
WHERE user_id = 1 AND workspace_id = 1 AND revoked_at IS NULL;
EOF
# Expected: < 5ms execution time
```

**Manual Validation**:
1. Log in as different users (owner, admin, member, viewer)
2. Verify correct access levels (read, write, delete)
3. Check WebSocket connections work
4. Verify file operations respect roles
5. Confirm Datadog traces appear correctly

---

## Risk Mitigation Strategies

### 1. Phased Rollout

**Strategy**: Deploy to subset of users first, gradually increase traffic

**Implementation**:
```yaml
# Kubernetes deployment with canary
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui-canary
spec:
  replicas: 1  # Start with 1 pod (5% traffic)
  selector:
    matchLabels:
      app: vibecode-webgui
      version: phase1
```

**Rollout Schedule**:
- Hour 1: 5% traffic (1 pod)
- Hour 2: 25% traffic (5 pods)
- Hour 4: 50% traffic (10 pods)
- Hour 8: 100% traffic (20 pods)

### 2. Feature Flags

**Strategy**: Enable RBAC enforcement gradually

**Implementation**:
```typescript
// Feature flag check in authorization library
const ENABLE_RBAC = process.env.ENABLE_WORKSPACE_RBAC === 'true';

export async function hasWorkspaceAccess(userId: number, workspaceId: number): Promise<boolean> {
  if (!ENABLE_RBAC) {
    // Fallback to old behavior (allow all)
    return true;
  }

  // Real RBAC check
  const membership = await prisma.workspace_members.findFirst(...);
  return membership !== null;
}
```

**Rollout**:
1. Deploy code with `ENABLE_WORKSPACE_RBAC=false` (disabled)
2. Monitor for issues (should be no change in behavior)
3. Enable for 10% users: `ENABLE_WORKSPACE_RBAC=true` (A/B test)
4. Monitor access metrics, error rates
5. Enable for 100% users if metrics look good

### 3. Database Migration Safety

**Strategy**: Run migration with safety checks

**Implementation**:
```bash
# Pre-migration checks
psql $DATABASE_URL <<EOF
-- Check if table already exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'workspace_members';
-- Expected: Empty (table doesn't exist yet)

-- Check workspace count (verify migration will succeed)
SELECT COUNT(*) as workspace_count FROM workspaces;
-- Expected: > 0 (workspaces exist to migrate)

-- Check user IDs are valid
SELECT COUNT(*) FROM workspaces WHERE user_id NOT IN (SELECT id FROM users);
-- Expected: 0 (all workspace user_ids are valid)
EOF

# Run migration with transaction
psql $DATABASE_URL <<EOF
BEGIN;
-- Run migration SQL
\i prisma/migrations/20251002_add_workspace_members/migration.sql
-- Verify migration
SELECT COUNT(*) FROM workspace_members WHERE role = 'owner';
-- Expected: Should match workspace count
COMMIT;
EOF
```

### 4. Monitoring-Driven Rollback

**Strategy**: Automated rollback triggers

**Implementation**:
```yaml
# Alert with auto-rollback
- alert: AutoRollbackTrigger
  expr: |
    rate(http_server_errors_5xx[5m]) > 0.05 OR
    histogram_quantile(0.95, workspace_access_check_duration) > 200
  for: 3m
  severity: critical
  actions:
    - notify: oncall-team
    - execute: /scripts/rollback-phase1.sh
```

---

## Success Criteria

### Deployment Success Defined As

**Technical Criteria**:
- [ ] All 3 critical blockers resolved
- [ ] Production build succeeds without errors
- [ ] Database migration completes successfully
- [ ] All integration tests passing
- [ ] Staging validation complete
- [ ] Rollback procedure tested and documented

**Operational Criteria**:
- [ ] 5xx error rate < 1% of requests (same as pre-deployment)
- [ ] Workspace access checks P95 < 50ms
- [ ] No orphaned workspaces (all have owners)
- [ ] 403 errors increase (expected - blocking unauthorized access)
- [ ] Authorized users can access their workspaces
- [ ] Zero reports of legitimate users denied access

**Business Criteria**:
- [ ] Security vulnerability (#283) fixed
- [ ] No user-facing service disruption
- [ ] Monitoring dashboard shows healthy metrics
- [ ] Documentation updated (deployment guide, runbooks)

---

## Deployment Approval

### Sign-off Required From

**Technical Approvals**:
- [ ] **Tech Lead / Engineering Manager**: Overall deployment strategy
- [ ] **Security Team**: Security-critical RBAC changes
- [ ] **DBA / Database Team**: Migration review and approval
- [ ] **DevOps / Platform Team**: Infrastructure changes approval

**Business Approvals**:
- [ ] **Product Manager**: Feature readiness and user impact
- [ ] **QA Lead**: Test coverage and validation sign-off

### Pre-Deployment Meeting

**Agenda**:
1. Review deployment plan and timeline
2. Discuss rollback procedures
3. Confirm monitoring and alerting setup
4. Assign on-call responsibilities
5. Review success criteria
6. Go/No-Go decision

**Participants**:
- Tech Lead / Engineering Manager
- Security Team Representative
- DBA / Database Team
- DevOps / Platform Team
- QA Lead
- On-call Engineer(s)

---

## Final Deployment Decision

### Deployment Status: CONDITIONAL_GO

**Conditions for GO**:
1. ✅ Resolve Blocker 1: Update API routes to use real authorization (2-3 hours)
2. ✅ Resolve Blocker 2: Run database migration in staging (30 minutes)
3. ✅ Resolve Blocker 3: Fix build system (1-2 hours)
4. ✅ Complete staging validation (1 hour)
5. ✅ Obtain required approvals (Security, DBA, Tech Lead)

**Estimated Time to GO**: 4-6 hours of engineering work + staging validation

**Recommended Next Steps**:
1. **Immediate** (Today):
   - Assign engineer to fix build system
   - Assign engineer to update API routes
   - Schedule staging deployment

2. **Short-term** (This Week):
   - Complete staging validation
   - Obtain deployment approvals
   - Schedule production deployment window

3. **Deployment Window**:
   - Schedule: Low-traffic period (2-4 AM local time)
   - Duration: 2-3 hours (including monitoring)
   - On-call: 2 engineers available for rollback

**Risk Assessment**: MEDIUM
- High impact security fix (critical importance)
- Well-documented rollback procedures (low rollback risk)
- Comprehensive testing available (integration tests ready)
- 3 blockers remain (deployment not ready today)

**Recommendation**: **Fix blockers → Deploy within 48 hours**

---

## Appendix

### A. Database Migration SQL

**File**: `prisma/migrations/20251002_add_workspace_members/migration.sql`

**Summary**:
- Creates `workspace_members` table
- Adds 3 indexes for performance
- Migrates existing workspace owners
- Adds trigger for `updated_at` timestamp

**Execution Time**: ~5 seconds for typical database (<1000 workspaces)

### B. API Routes to Update

1. `/src/app/api/files/route.ts` (Lines 429-451)
2. `/src/app/api/files/sync/route.ts` (WebSocket authorization)
3. `/src/app/api/claude/chat/secure-route.ts` (Lines 238-260)
4. `/src/app/api/ai/search/route.ts` (verification needed)

### C. Integration Test Suite

**File**: `/tests/integration/api/workspace-access.test.ts` (369 lines)

**Coverage**:
- Basic access checks (owner, admin, member, viewer, unauthorized)
- Role-based access control (role hierarchy enforcement)
- Permission checks (read, write, delete, invite, admin)
- Member management (add, update, remove, list)
- Fail-closed security (error handling)

### D. Deployment Guide

**File**: `/docs/deployment/WORKSPACE_RBAC_DEPLOYMENT.md` (724 lines)

**Sections**:
- Pre-deployment checklist
- Deployment steps (database migration, API updates, testing)
- Rollback plan (code-only, full rollback)
- Monitoring & validation
- Troubleshooting guide

### E. Related Documentation

- `/docs/database/QUICK_WINS.md` - Database schema quick wins
- Issue #283 - Implement real workspace access control
- `/.env.example` - Environment variable configuration

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Next Review**: After blocker resolution (estimated 48 hours)

**For questions or deployment coordination, contact**: DevOps/Platform team via #engineering-deploy channel
