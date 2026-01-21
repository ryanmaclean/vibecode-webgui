# Datadog Best Practices Implementation Guide

**Issue Reference**: [#464 - Fix Datadog implementation to follow best practices](https://github.com/ryanmaclean/vibecode-webgui/issues/464)
**Status**: Implementation Required
**Priority**: High
**Created**: 2025-10-01

## Executive Summary

Current Datadog implementation violates multiple official best practices, causing configuration conflicts, inconsistent service naming, and missed trace data. This guide provides a comprehensive migration plan to align with Datadog's 2024-2025 recommendations.

## Current State Analysis

### Critical Problems Identified

#### 1. Multiple tracer.init() Calls (Configuration Conflicts)

**Problem**: Tracer initialized in 3 different locations with different configurations.

**Evidence**:
```typescript
// Location 1: src/instrumentation.ts (Lines 17-28) - CORRECT LOCATION ✅
tracer.default.init({
  service: 'vibecode-webgui',
  env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
  version: process.env.DD_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  runtimeMetrics: true,
  profiling: process.env.NODE_ENV === 'production',
  logInjection: true
})

// Location 2: src/lib/monitoring/health-monitoring.ts (Lines 11-19) - DUPLICATE ❌
tracer.init({
  service: 'vibecode-webgui',
  env: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  appsec: true
})

// Location 3: src/lib/monitoring/enhanced-datadog-integration.ts (Lines 11-19) - DUPLICATE ❌
tracer.init({
  service: 'vibecode-enhanced-platform',  // DIFFERENT SERVICE NAME!
  version: process.env.DD_VERSION || '2.0.0',
  env: process.env.NODE_ENV || 'development',
  profiling: true,
  runtimeMetrics: true,
  plugins: true
})
```

**Impact**:
- Last `init()` call wins, causing unpredictable configuration
- Earlier middleware traces may be lost or misconfigured
- Configuration fragmentation across files

#### 2. Inconsistent Service Names

**Problem**: Two different service names used across the application.

**Evidence**:
```bash
$ grep -r "service:" src/lib/monitoring/ --include="*.ts"

src/lib/monitoring/health-monitoring.ts:    service: 'vibecode-webgui'
src/lib/monitoring/enhanced-datadog-integration.ts:    service: 'vibecode-enhanced-platform'
```

**Impact**:
- Breaks Datadog service mapping and APM views
- Splits traces across two services in Datadog UI
- Complicates service dependency analysis

#### 3. Missing Unified Service Tagging

**Problem**: Required Datadog unified service tagging (DD_ENV, DD_VERSION, DD_GIT_COMMIT_SHA) not consistently applied.

**Current Environment Variables** (from .env.example):
```bash
DD_ENV=development          # ✅ Present
DD_SERVICE=vibecode-webgui  # ✅ Present
DD_VERSION=1.0.0            # ✅ Present
# DD_GIT_COMMIT_SHA          # ❌ Missing
# DD_GIT_REPOSITORY_URL      # ❌ Missing
```

**Impact**:
- Cannot correlate traces with deployments
- Lacks deployment version tracking
- Missing CI/CD integration metadata

#### 4. Wrong Initialization Location

**Problem**: Tracer initialized in middleware instead of Next.js instrumentation entry point.

**Evidence**:
- `src/instrumentation.ts` has correct structure (Lines 10-32)
- But additional inits in `health-monitoring.ts` and `enhanced-datadog-integration.ts` run when these modules are imported
- These modules are imported in API routes and middleware, causing late initialization

**Impact**:
- Misses early server startup traces
- Cannot instrument Next.js internals properly
- Delayed trace collection

### Files Requiring Changes

#### Phase 1: Critical Fixes (Remove Duplicate Inits)
1. **src/lib/monitoring/health-monitoring.ts** (Lines 10-23)
   - Remove `tracer.init()` call
   - Import pre-initialized tracer from `@/instrument`

2. **src/lib/monitoring/enhanced-datadog-integration.ts** (Lines 11-19)
   - Remove `tracer.init()` call
   - Import pre-initialized tracer from `dd-trace`
   - Fix service name to `vibecode-webgui`

3. **src/instrumentation.ts** (Already correct, minor enhancements needed)
   - Add missing git metadata tags
   - Enable profiling unconditionally
   - Add unified service tagging

#### Phase 2: Configuration Consolidation
4. **.env.example** (Lines 64-104)
   - Add missing environment variables
   - Document required vs optional vars

5. **src/instrument.ts** (Lines 100-227)
   - Review for redundant initialization logic
   - Ensure consistent with `instrumentation.ts`

#### Phase 3: Documentation & Validation
6. Create environment variable validation
7. Add startup logging for configuration verification
8. Update deployment documentation

## Migration Plan

### Phase 1: Remove Duplicate Initializations (High Priority)

**Timeline**: Immediate (1 day)
**Risk Level**: Medium (requires careful testing)

#### Step 1.1: Fix health-monitoring.ts

**Current Code** (Lines 9-23):
```typescript
import tracer from '@/instrument';

// Initialize Datadog tracer (should be done before importing other modules)
if (process.env.DD_API_KEY) {
  tracer.init({
    service: 'vibecode-webgui',
    env: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    logInjection: true,
    runtimeMetrics: true,
    profiling: true,
    appsec: true,
  })
  console.log('🔍 Datadog APM tracer initialized')
}
```

**Corrected Code**:
```typescript
// Import pre-initialized tracer from instrumentation.ts
// NO tracer.init() - already initialized at app startup
import tracer from 'dd-trace';

// Verify tracer is initialized (optional startup check)
if (process.env.DD_API_KEY) {
  console.log('🔍 Using pre-initialized Datadog APM tracer from instrumentation.ts')
  console.log(`   Service: ${process.env.DD_SERVICE || 'vibecode-webgui'}`)
  console.log(`   Environment: ${process.env.DD_ENV || 'development'}`)
  console.log(`   Version: ${process.env.DD_VERSION || 'unknown'}`)
} else {
  console.warn('⚠️ Datadog APM not configured (DD_API_KEY missing)')
}
```

**Verification**:
```bash
# Before: Multiple "Datadog tracer initialized" messages
# After: Single "Datadog tracer initialized in instrumentation.ts" message

grep -r "tracer initialized" logs/
```

#### Step 1.2: Fix enhanced-datadog-integration.ts

**Current Code** (Lines 8-19):
```typescript
import tracer from 'dd-trace'

// Initialize Datadog tracer with minimal configuration
tracer.init({
  service: 'vibecode-enhanced-platform',
  version: process.env.DD_VERSION || '2.0.0',
  env: process.env.NODE_ENV || 'development',
  profiling: true,
  runtimeMetrics: true,
  plugins: true
});
```

**Corrected Code**:
```typescript
// Import pre-initialized tracer - NO init() call
import tracer from 'dd-trace'

// Tracer already initialized in instrumentation.ts
// This module only uses the tracer for creating custom spans
console.log('🐕 Enhanced Datadog monitoring using pre-initialized tracer')
```

**Additional Change** (Lines 22-32):
```typescript
// REMOVE - Plugin configuration should be in instrumentation.ts
// Configure Express plugin after initialization
tracer.use('express', {
  enabled: true,
  hooks: {
    request: (span: any, req: any) => {
      if (req && req.headers) {
        span.setTag('user.workspace', req.headers['x-workspace-id']);
        span.setTag('user.session', req.headers['x-session-id']);
      }
    }
  }
});
```

**Verification**:
```bash
# Test that service name is consistent
curl http://localhost:3000/api/monitoring/health | jq '.service'
# Should return: "vibecode-webgui" (not "vibecode-enhanced-platform")
```

#### Step 1.3: Enhance instrumentation.ts

**Current Code** (Lines 17-28):
```typescript
tracer.default.init({
  service: 'vibecode-webgui',
  env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
  version: process.env.DD_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  runtimeMetrics: true,
  profiling: process.env.NODE_ENV === 'production',
  logInjection: true,
  tags: {
    'git.commit.sha': process.env.DD_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
    'git.repository_url': 'https://github.com/ryanmaclean/vibecode-webgui',
  }
})
```

**Enhanced Code**:
```typescript
tracer.default.init({
  // Unified Service Tagging (Required by Datadog 2024+ best practices)
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
  version: process.env.DD_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',

  // Observability features
  runtimeMetrics: true,
  profiling: true,  // Enable in all environments for better debugging
  logInjection: true,

  // Application Security Management (optional but recommended)
  appsec: process.env.DD_APPSEC_ENABLED === 'true',

  // Database monitoring integration
  dbmPropagationMode: process.env.DD_DBM_PROPAGATION_MODE || 'service',

  // Unified service tagging
  tags: {
    'git.commit.sha': process.env.DD_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
    'git.repository_url': process.env.DD_GIT_REPOSITORY_URL || 'https://github.com/ryanmaclean/vibecode-webgui',
    'deployment.environment': process.env.DD_ENV || process.env.NODE_ENV || 'development',
    'service.version': process.env.DD_VERSION || 'dev',
  }
})

// Configure plugin-specific settings after initialization
if (process.env.DD_API_KEY) {
  // Express middleware instrumentation
  tracer.default.use('express', {
    enabled: true,
    hooks: {
      request: (span: any, req: any) => {
        if (req?.headers) {
          span.setTag('user.workspace', req.headers['x-workspace-id'])
          span.setTag('user.session', req.headers['x-session-id'])
        }
      }
    }
  })

  console.log('✅ Datadog tracer initialized in instrumentation.ts')
  console.log(`   Service: ${process.env.DD_SERVICE || 'vibecode-webgui'}`)
  console.log(`   Environment: ${process.env.DD_ENV || 'development'}`)
  console.log(`   Version: ${process.env.DD_VERSION || 'dev'}`)
}
```

### Phase 2: Update Environment Variables (Medium Priority)

**Timeline**: 2 days
**Risk Level**: Low (configuration only)

#### Step 2.1: Update .env.example

**Add to Observability section** (after Line 74):
```bash
# Unified Service Tagging (Datadog Best Practice 2024+)
DD_ENV=development
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
DD_GIT_COMMIT_SHA=${VERCEL_GIT_COMMIT_SHA:-dev}
DD_GIT_REPOSITORY_URL=https://github.com/ryanmaclean/vibecode-webgui

# Datadog Features
DD_APPSEC_ENABLED=false
DD_DBM_PROPAGATION_MODE=service
DD_TRACE_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true
DD_PROFILING_ENABLED=true
DD_LOG_INJECTION=true
```

#### Step 2.2: Create Environment Validation Script

**Create**: `scripts/validate-datadog-config.ts`
```typescript
#!/usr/bin/env tsx
/**
 * Validates Datadog environment variable configuration
 * Run: npm run validate:datadog
 */

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateDatadogConfig(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }

  // Required variables
  const required = {
    DD_SERVICE: process.env.DD_SERVICE,
    DD_ENV: process.env.DD_ENV,
    DD_VERSION: process.env.DD_VERSION
  }

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      result.errors.push(`Missing required variable: ${key}`)
      result.valid = false
    }
  }

  // Optional but recommended
  if (!process.env.DD_GIT_COMMIT_SHA && !process.env.VERCEL_GIT_COMMIT_SHA) {
    result.warnings.push('Missing DD_GIT_COMMIT_SHA - deployment tracking will be limited')
  }

  if (!process.env.DD_GIT_REPOSITORY_URL) {
    result.warnings.push('Missing DD_GIT_REPOSITORY_URL - source code linking disabled')
  }

  if (!process.env.DD_API_KEY && !process.env.DATADOG_API_KEY) {
    result.warnings.push('Missing DD_API_KEY - Datadog will run in mock mode')
  }

  return result
}

// Run validation
const result = validateDatadogConfig()

console.log('\n🔍 Datadog Configuration Validation\n')

if (result.errors.length > 0) {
  console.error('❌ Errors:')
  result.errors.forEach(err => console.error(`   - ${err}`))
}

if (result.warnings.length > 0) {
  console.warn('\n⚠️  Warnings:')
  result.warnings.forEach(warn => console.warn(`   - ${warn}`))
}

if (result.valid && result.warnings.length === 0) {
  console.log('✅ Configuration is valid and complete\n')
} else if (result.valid) {
  console.log('\n✅ Configuration is valid (with warnings)\n')
} else {
  console.error('\n❌ Configuration is invalid\n')
  process.exit(1)
}
```

**Add to package.json**:
```json
{
  "scripts": {
    "validate:datadog": "tsx scripts/validate-datadog-config.ts"
  }
}
```

### Phase 3: Testing & Verification (Low Priority)

**Timeline**: 2 days
**Risk Level**: Low (testing only)

#### Step 3.1: Verify Single Initialization

**Test Script**: `tests/integration/datadog-initialization.test.ts`
```typescript
import { describe, it, expect, beforeAll } from '@jest/globals'

describe('Datadog Initialization', () => {
  it('should initialize tracer only once', async () => {
    // Capture console output
    const consoleLogs: string[] = []
    const originalLog = console.log
    console.log = (...args: any[]) => {
      consoleLogs.push(args.join(' '))
      originalLog(...args)
    }

    // Import modules that previously had duplicate inits
    await import('@/lib/monitoring/health-monitoring')
    await import('@/lib/monitoring/enhanced-datadog-integration')

    console.log = originalLog

    // Count initialization messages
    const initMessages = consoleLogs.filter(log =>
      log.includes('Datadog tracer initialized') ||
      log.includes('Datadog APM tracer initialized')
    )

    expect(initMessages.length).toBeLessThanOrEqual(1)
  })

  it('should use consistent service name', () => {
    expect(process.env.DD_SERVICE).toBe('vibecode-webgui')
  })

  it('should have unified service tagging', () => {
    expect(process.env.DD_ENV).toBeDefined()
    expect(process.env.DD_VERSION).toBeDefined()
  })
})
```

#### Step 3.2: Verify Trace Collection

**Manual Verification Steps**:
```bash
# 1. Start application with Datadog enabled
DD_API_KEY=your-key npm run dev

# 2. Generate test traffic
curl http://localhost:3000/api/monitoring/health

# 3. Check Datadog UI (after 2-3 minutes)
# Navigate to: APM > Services > vibecode-webgui
# Verify:
# - Service name is "vibecode-webgui" (not "vibecode-enhanced-platform")
# - Environment tag matches DD_ENV
# - Version tag matches DD_VERSION
# - Git commit SHA is present in trace metadata
```

#### Step 3.3: Verify Plugin Configuration

**Test that Express hooks work correctly**:
```bash
# Send request with custom headers
curl -H "x-workspace-id: test-workspace" \
     -H "x-session-id: test-session" \
     http://localhost:3000/api/monitoring/health

# Check Datadog trace explorer
# Filter: @user.workspace:test-workspace
# Should see traces tagged with workspace and session IDs
```

## Environment Variable Reference

### Required Variables

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `DD_SERVICE` | Service name (must be consistent) | `vibecode-webgui` | - |
| `DD_ENV` | Environment (dev/staging/production) | `production` | - |
| `DD_VERSION` | Application version | `1.2.3` or git SHA | - |

### Recommended Variables

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `DD_API_KEY` | Datadog API key for agent communication | `abc123...` | - |
| `DD_GIT_COMMIT_SHA` | Git commit SHA for deployment tracking | `a1b2c3d4` | - |
| `DD_GIT_REPOSITORY_URL` | Repository URL for source code linking | `https://github.com/...` | - |

### Optional Feature Flags

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `DD_APPSEC_ENABLED` | Enable Application Security Management | `true` | `false` |
| `DD_PROFILING_ENABLED` | Enable continuous profiling | `true` | `true` |
| `DD_LLMOBS_ENABLED` | Enable LLM Observability | `true` | `false` |
| `DD_DBM_PROPAGATION_MODE` | Database monitoring correlation | `service` | `disabled` |

## Rollback Plan

If issues occur during migration:

### Quick Rollback
```bash
# Revert instrumentation.ts changes
git checkout main -- src/instrumentation.ts

# Restart application
npm run dev
```

### Gradual Rollback
1. Keep `instrumentation.ts` changes (correct location)
2. Re-enable one duplicate init temporarily for compatibility
3. Debug and fix integration issues
4. Remove duplicate init again

## Success Criteria

**Migration is complete when**:

1. ✅ Only one `tracer.init()` call exists (in `instrumentation.ts`)
2. ✅ Consistent service name `vibecode-webgui` across all traces
3. ✅ All traces include unified service tags (env, version, git SHA)
4. ✅ Express middleware traces appear in Datadog
5. ✅ No duplicate initialization messages in logs
6. ✅ Environment validation script passes

**Datadog UI verification**:
- Service map shows single service node: `vibecode-webgui`
- All traces have tags: `env`, `version`, `git.commit.sha`
- No split between `vibecode-webgui` and `vibecode-enhanced-platform`

## References

### Datadog Official Documentation
- [Node.js Tracer Configuration](https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/dd_libraries/nodejs/)
- [Unified Service Tagging](https://docs.datadoghq.com/getting_started/tagging/unified_service_tagging/)
- [Next.js Integration Guide](https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/dd_libraries/nodejs/?tab=nextjs)
- [Database Monitoring APM Integration](https://docs.datadoghq.com/database_monitoring/connect_dbm_and_apm/)

### Internal Documentation
- [Monitoring Setup Guide](./MONITORING_SETUP.md)
- [Environment Variables Reference](../CONFIGURATION_QUICK_REFERENCE.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)

## Timeline & Effort Estimate

| Phase | Tasks | Effort | Risk |
|-------|-------|--------|------|
| Phase 1 | Remove duplicate inits | 1 day | Medium |
| Phase 2 | Update environment config | 2 days | Low |
| Phase 3 | Testing & validation | 2 days | Low |
| **Total** | **Complete migration** | **5 days** | **Low** |

## Next Steps

1. Review this implementation guide with team
2. Schedule migration work (recommend non-peak hours)
3. Execute Phase 1 (critical fixes)
4. Test thoroughly in development
5. Deploy to staging environment
6. Verify Datadog traces in staging
7. Deploy to production with monitoring

## Questions & Support

**For questions or issues**:
- GitHub Issue: #464
- Datadog Support: https://help.datadoghq.com/
- Internal Slack: #vibecode-monitoring

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Author**: Claude Code (via ryan.maclean)
**Status**: Ready for Implementation
