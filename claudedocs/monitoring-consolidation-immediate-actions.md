# Monitoring Consolidation - Immediate Action Plan

**Priority**: HIGH (TODO.md Agent 2 Task)
**Estimated Time**: 2-3 hours
**Risk Level**: LOW (non-breaking changes, comprehensive rollback plan)

---

## Executive Summary

**Current State**: 4 tracer initialization points detected (2 duplicates to remove)
**Target State**: 2 initialization points (instrumentation.ts for Next.js, instrument.ts for standalone)
**Impact**: Eliminates configuration drift, ensures consistent service naming, improves observability

---

## Immediate Actions Required

### Phase 1: Remove Duplicate Initializations (30 minutes)

#### Action 1.1: Fix health-monitoring.ts

**File**: `/src/lib/monitoring/health-monitoring.ts`

**Current Code** (lines 7-23):
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
} else {
  console.warn('⚠️ Datadog APM not configured (DD_API_KEY missing)')
}
```

**Updated Code**:
```typescript
import tracer from '@/instrument';

// Tracer already initialized via instrumentation.ts or instrument.ts
// This import provides access to the pre-configured tracer instance
console.log('✅ Using pre-initialized Datadog tracer from instrumentation')
```

**Lines to Delete**: 9-23 (15 lines)
**Lines to Keep**: 7 (import statement)

---

#### Action 1.2: Fix enhanced-datadog-integration.ts

**File**: `/src/lib/monitoring/enhanced-datadog-integration.ts`

**Current Code** (lines 8-19):
```typescript
import tracer from 'dd-trace'

// Initialize Datadog tracer with minimal configuration
tracer.init({
  service: 'vibecode-enhanced-platform',
  version: process.env.DD_VERSION || '2.0.0',
  env: process.env.NODE_ENV || 'development',
  profiling: true,
  runtimeMetrics: true,
  // Enable all plugins
  plugins: true
});
```

**Updated Code**:
```typescript
import tracer from '@/instrument'

// Tracer already initialized via instrumentation.ts
// Configuration is managed centrally for consistency
```

**Lines to Change**: 8 (change import)
**Lines to Delete**: 10-19 (10 lines)

---

### Phase 2: Standardize Version Tagging (15 minutes)

#### Action 2.1: Update health-monitoring.ts version reference

**Current**: Uses `APP_VERSION` (inconsistent)
**Target**: Use `DD_VERSION` or `getServiceEnvVersion()`

If any version references remain after Action 1.1, update them:

```typescript
// Add import at top of file
import { getServiceEnvVersion } from '@/lib/monitoring/datadog-env'

// Use in logger configuration
const { service, env, version } = getServiceEnvVersion()

logger.defaultMeta = {
  service,
  environment: env,
  version
}
```

---

#### Action 2.2: Remove hardcoded versions from enhanced-datadog-integration.ts

Already handled in Action 1.2 (removed entire init block with hardcoded `2.0.0`)

---

### Phase 3: Validation Testing (45 minutes)

#### Test 3.1: Static Code Validation

```bash
# Navigate to project root
cd /Users/ryan.maclean/vibecode-webgui

# Run validation script
./scripts/validate-monitoring.sh
```

Expected: All 8 tests pass

---

#### Test 3.2: Development Server Test

```bash
# Start dev server and check for single initialization
npm run dev 2>&1 | tee /tmp/monitoring-test.log &

# Wait for startup
sleep 15

# Check initialization count
grep -i "tracer initialized" /tmp/monitoring-test.log | wc -l
# Expected: 1

# Check for errors
grep -i "error" /tmp/monitoring-test.log | grep -i tracer
# Expected: (empty)

# Stop server
pkill -f "next dev"
```

---

#### Test 3.3: Feature Functionality Test

```bash
# Run monitoring feature test
npx tsx scripts/test-monitoring.ts
```

Expected output:
```
🧪 Testing Monitoring Consolidation...
✅ Basic tracing works
✅ LLM tracing works
✅ Enhanced monitoring works
✅ Configuration validation complete
🎉 All monitoring tests passed!
```

---

#### Test 3.4: TypeScript Compilation

```bash
npm run type-check
# or
npx tsc --noEmit
```

Expected: No errors related to monitoring files

---

### Phase 4: Documentation (30 minutes)

#### Doc 4.1: Update README.md

Add monitoring section:

```markdown
## Monitoring & Observability

VibeCode WebGUI uses Datadog APM for distributed tracing and observability.

### Initialization

Tracer initialization is handled automatically via Next.js instrumentation:
- **Next.js contexts**: `src/instrumentation.ts` (automatic)
- **Standalone scripts**: `src/instrument.ts` (explicit import)

**DO NOT** manually call `tracer.init()` in your code.

### Environment Variables

```bash
# Required for Datadog APM
DD_API_KEY=your_api_key
DD_SITE=datadoghq.com

# Service identification
DD_ENV=development
DD_VERSION=1.0.0
DD_SERVICE=vibecode-webgui

# Git integration
DD_GIT_COMMIT_SHA=abc123

# Feature flags
DD_ENABLED=true
OTEL_ENABLED=false
DD_LLMOBS_ENABLED=false
```

### Usage

```typescript
// Import pre-initialized tracer
import tracer from '@/instrument'

// Create custom spans
tracer.trace('my.operation', async (span) => {
  span?.setTag('custom.tag', 'value')
  // Your operation here
})

// For LLM operations
import { LLMTracer } from '@/lib/monitoring/llm-tracer'

await LLMTracer.traceLLMCall('completion', {
  model: 'gpt-4',
  provider: 'openai'
}, async () => {
  // LLM call here
})
```

### Troubleshooting

See [claudedocs/monitoring-consolidation-status.md](./claudedocs/monitoring-consolidation-status.md) for detailed architecture and troubleshooting guide.
```

---

#### Doc 4.2: Create .env.example entries

Add to `.env.example`:

```bash
# Datadog APM Configuration
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key
DD_SITE=datadoghq.com

# Service Identification (Unified Service Tagging)
DD_ENV=development
DD_VERSION=1.0.0
DD_SERVICE=vibecode-webgui

# Git Integration
DD_GIT_COMMIT_SHA=
VERCEL_GIT_COMMIT_SHA=

# Feature Flags
DD_ENABLED=true
OTEL_ENABLED=false
DD_LLMOBS_ENABLED=false
DD_LLMOBS_AGENTLESS_ENABLED=false
DD_DBM_ENABLED=false

# OpenTelemetry Configuration (if OTEL_ENABLED=true)
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_PROMETHEUS_PORT=9090
```

---

#### Doc 4.3: Update TROUBLESHOOTING.md

Add monitoring section to `/docs/TROUBLESHOOTING.md`:

```markdown
## Monitoring & Tracing Issues

### Multiple "tracer initialized" messages

**Symptom**: Dev server logs show multiple initialization messages

**Diagnosis**:
```bash
npm run dev 2>&1 | grep -i "tracer initialized" | wc -l
```

**Cause**: Duplicate tracer.init() calls in monitoring files

**Fix**: Run validation script to detect duplicates:
```bash
./scripts/validate-monitoring.sh
```

---

### Service name mismatch in Datadog

**Symptom**: Multiple service names appear in Datadog APM (e.g., vibecode-webgui, vibecode-enhanced-platform)

**Diagnosis**: Check Datadog service catalog

**Fix**: Ensure all files import tracer from `@/instrument`, not directly from `dd-trace`

---

### Traces not appearing in Datadog

**Checklist**:
- [ ] DD_API_KEY is set correctly
- [ ] DD_ENABLED is not set to 'false'
- [ ] DD_SITE matches your Datadog region
- [ ] Tracer initialized (check logs for "Datadog tracer initialized")
- [ ] Network connectivity to Datadog agent or API

**Debug**:
```bash
# Check tracer status
npm run dev 2>&1 | grep -i datadog

# Verify environment variables
node -e "console.log('DD_API_KEY:', process.env.DD_API_KEY ? 'SET' : 'NOT SET')"
node -e "console.log('DD_ENABLED:', process.env.DD_ENABLED)"
```

---

### OpenTelemetry conflicts with Datadog

**Symptom**: Initialization errors when OTEL_ENABLED=true

**Diagnosis**: Check initialization sequence in logs

**Fix**: OpenTelemetry should initialize BEFORE Datadog tracer. This is handled automatically in `src/instrument.ts` (line 101-103).

If issues persist, try:
```bash
# Disable OpenTelemetry temporarily
OTEL_ENABLED=false npm run dev
```
```

---

## Validation Checklist

Before marking this task complete, verify:

### Code Changes
- [ ] Lines 9-23 deleted from `/src/lib/monitoring/health-monitoring.ts`
- [ ] Line 8 updated in `/src/lib/monitoring/enhanced-datadog-integration.ts` (import from `@/instrument`)
- [ ] Lines 10-19 deleted from `/src/lib/monitoring/enhanced-datadog-integration.ts`
- [ ] No other `tracer.init()` calls in `/src/lib/monitoring/` directory
- [ ] All version references use `DD_VERSION` or `getServiceEnvVersion()`

### Testing
- [ ] `./scripts/validate-monitoring.sh` passes all 8 tests
- [ ] Dev server shows single "Datadog tracer initialized" message
- [ ] `npx tsx scripts/test-monitoring.ts` passes all feature tests
- [ ] TypeScript compilation clean (`npm run type-check`)
- [ ] No runtime errors in monitoring subsystem

### Documentation
- [ ] README.md monitoring section added
- [ ] .env.example updated with Datadog variables
- [ ] TROUBLESHOOTING.md monitoring section added
- [ ] claudedocs/monitoring-consolidation-status.md reviewed and accurate

### Datadog Validation (if credentials available)
- [ ] Only 'vibecode-webgui' service name in Datadog APM
- [ ] Traces appearing with correct tags (env, version, git.commit.sha)
- [ ] No duplicate service names (e.g., vibecode-enhanced-platform)
- [ ] LLM observability traces working (if enabled)

---

## Quick Start Commands

```bash
# 1. Navigate to project
cd /Users/ryan.maclean/vibecode-webgui

# 2. Create feature branch
git checkout -b feat/datadog-tracer-consolidation

# 3. Make code changes (Actions 1.1 and 1.2)
# Edit files as specified above

# 4. Run validation
./scripts/validate-monitoring.sh

# 5. Test functionality
npx tsx scripts/test-monitoring.ts

# 6. Type check
npm run type-check

# 7. Test dev server
npm run dev

# 8. Commit changes
git add src/lib/monitoring/health-monitoring.ts
git add src/lib/monitoring/enhanced-datadog-integration.ts
git commit -m "fix(monitoring): consolidate Datadog tracer initialization

- Remove duplicate tracer.init() from health-monitoring.ts
- Remove duplicate tracer.init() from enhanced-datadog-integration.ts
- Standardize imports to use @/instrument
- Eliminate service name inconsistency (vibecode-enhanced-platform)
- Use unified service tagging from datadog-env helpers

Fixes: TODO.md Agent 2 task
Impact: Consistent monitoring configuration, single source of truth
Breaking: None (non-breaking cleanup)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 9. Push and create PR (if applicable)
git push origin feat/datadog-tracer-consolidation
```

---

## Time Breakdown

| Phase | Task | Estimated Time | Actual Time |
|-------|------|----------------|-------------|
| 1 | Remove duplicates (health-monitoring.ts) | 10 min | |
| 1 | Remove duplicates (enhanced-datadog-integration.ts) | 10 min | |
| 1 | Update imports | 10 min | |
| 2 | Standardize version tagging | 15 min | |
| 3 | Static validation | 10 min | |
| 3 | Dev server test | 15 min | |
| 3 | Feature functionality test | 10 min | |
| 3 | TypeScript compilation | 10 min | |
| 4 | Update README.md | 10 min | |
| 4 | Update .env.example | 5 min | |
| 4 | Update TROUBLESHOOTING.md | 15 min | |
| **Total** | | **2 hours** | |

---

## Success Metrics

### Before Consolidation
- Tracer initialization count: 4
- Service names in Datadog: 2 (vibecode-webgui, vibecode-enhanced-platform)
- Hardcoded versions: 2 (1.0.0, 2.0.0)
- Configuration drift: HIGH

### After Consolidation
- Tracer initialization count: 2 (instrumentation.ts + instrument.ts)
- Service names in Datadog: 1 (vibecode-webgui)
- Hardcoded versions: 0
- Configuration drift: NONE

### Quality Gates
- All validation tests pass ✅
- TypeScript compilation clean ✅
- No runtime errors ✅
- Documentation updated ✅
- Datadog APM functional ✅

---

## Support Resources

1. **Status Document**: `/claudedocs/monitoring-consolidation-status.md`
   - Comprehensive analysis
   - Architecture diagrams
   - Detailed recommendations

2. **Verification Script**: `/claudedocs/monitoring-verification-script.md`
   - Automated testing procedures
   - Performance benchmarks
   - Integration tests

3. **Validation Script**: `/scripts/validate-monitoring.sh`
   - Pre-commit checks
   - CI/CD integration
   - Quick validation

4. **Feature Test**: `/scripts/test-monitoring.ts`
   - Runtime functionality verification
   - Tracer feature testing
   - Configuration validation

---

## Risk Mitigation

### Risk 1: Breaking monitoring in production
**Likelihood**: LOW
**Impact**: HIGH
**Mitigation**:
- Changes only remove redundant code
- Primary initialization in instrumentation.ts unchanged
- Comprehensive test suite validates functionality

### Risk 2: Configuration not applied
**Likelihood**: LOW
**Impact**: MEDIUM
**Mitigation**:
- Import from @/instrument ensures pre-initialized tracer
- Validation tests verify configuration applied
- Dev server startup logs confirm initialization

### Risk 3: OpenTelemetry compatibility issues
**Likelihood**: VERY LOW
**Impact**: LOW
**Mitigation**:
- OpenTelemetry code untouched by changes
- Initialization sequence preserved
- Compatibility tests included in validation

---

## Contact

**Task Owner**: Monitoring & Observability Expert (Agent 2)
**Priority**: HIGH (TODO.md tracked)
**Status**: READY FOR IMPLEMENTATION
**Estimated Completion**: 2025-10-01 (within 2-3 hours)

---

## Next Steps After Completion

1. Mark TODO.md Agent 2 task complete
2. Update CHANGELOG.md with consolidation notes
3. Consider adding monitoring metrics to CI/CD dashboard
4. Schedule review of instrument.ts complexity (future optimization)
5. Evaluate OpenTelemetry adoption strategy (separate task)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Status**: APPROVED FOR EXECUTION
