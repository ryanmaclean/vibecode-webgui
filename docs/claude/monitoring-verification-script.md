# Monitoring Consolidation Verification Script

**Purpose**: Validate tracer initialization consolidation and detect configuration issues

---

## Pre-Flight Checks

### 1. Count Tracer Initialization Calls

```bash
# Should find ONLY 2 valid init points after consolidation
grep -r "tracer\.init(" src/ --include="*.ts" --include="*.js" | grep -v "node_modules" | grep -v "test" | grep -v "spec"

# Expected output (AFTER consolidation):
# src/instrumentation.ts:  tracer.init({
# src/instrument.ts:  tracer.init(tracerConfig);
```

**Current State** (before consolidation):
```
src/instrumentation.ts:38:    tracer.init({
src/instrument.ts:200:    tracer.init(tracerConfig);
src/lib/monitoring/health-monitoring.ts:11:  tracer.init({
src/lib/monitoring/enhanced-datadog-integration.ts:11:tracer.init({
```

**Target State** (after consolidation):
```
src/instrumentation.ts:38:    tracer.init({
src/instrument.ts:200:    tracer.init(tracerConfig);
```

---

### 2. Verify Import Patterns

```bash
# All files should import from @/instrument, NOT directly from dd-trace
grep -r "import.*from.*'dd-trace'" src/lib/monitoring/ --include="*.ts"

# Expected output (AFTER consolidation):
# (empty - no direct dd-trace imports in monitoring files)

# Correct pattern check:
grep -r "import.*from '@/instrument'" src/lib/monitoring/ --include="*.ts"

# Expected files using correct pattern:
# src/lib/monitoring/health-monitoring.ts
# src/lib/monitoring/enhanced-datadog-integration.ts
```

---

### 3. Check for Hardcoded Versions

```bash
# Find any hardcoded version strings (should use environment variables)
grep -r "version: '.*'" src/lib/monitoring/ --include="*.ts" | grep -v "service.version"

# Bad patterns to find:
# version: '1.0.0'
# version: '2.0.0'

# Good patterns (should appear instead):
# version: process.env.DD_VERSION
# const { version } = getServiceEnvVersion()
```

---

### 4. Service Name Consistency Check

```bash
# All service names should be consistent
grep -r "service:" src/ --include="*.ts" | grep -i vibecode | grep -v node_modules

# Expected: All should use 'vibecode-webgui' (or env var)
# NOT: 'vibecode-enhanced-platform' (inconsistent)
```

---

## Runtime Verification

### 1. Development Server Startup Test

```bash
# Start dev server and capture initialization logs
npm run dev 2>&1 | tee /tmp/monitoring-init.log &
sleep 10
pkill -f "next dev"

# Analyze logs
echo "=== Tracer Initialization Count ==="
grep -i "tracer initialized" /tmp/monitoring-init.log | wc -l
# Expected: 1 (only from instrumentation.ts)

echo "=== Datadog Service Names ==="
grep -i "service:" /tmp/monitoring-init.log | grep -i datadog
# Expected: Only 'vibecode-webgui'

echo "=== OpenTelemetry Status ==="
grep -i "opentelemetry" /tmp/monitoring-init.log
# Expected: Either disabled message or single initialization
```

---

### 2. Tracer Feature Test

Create temporary test file: `scripts/test-monitoring.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Monitoring Feature Test Suite
 * Validates tracer consolidation doesn't break features
 */

import tracer from '@/instrument'
import { LLMTracer } from '@/lib/monitoring/llm-tracer'
import { EnhancedDatadogMonitoring } from '@/lib/monitoring/enhanced-datadog-integration'

console.log('🧪 Testing Monitoring Consolidation...\n')

// Test 1: Basic Tracing
console.log('Test 1: Basic Tracing')
try {
  tracer.trace('test.consolidation', async (span) => {
    if (span) {
      span.setTag('test.type', 'consolidation-verification')
      span.setTag('test.timestamp', Date.now())
    }
    console.log('✅ Basic tracing works')
  })
} catch (error) {
  console.error('❌ Basic tracing failed:', error)
  process.exit(1)
}

// Test 2: LLM Tracing
console.log('\nTest 2: LLM Tracing')
try {
  await LLMTracer.traceLLMCall(
    'test-operation',
    {
      model: 'gpt-4',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 100,
      userId: 'test-user',
      sessionId: 'test-session'
    },
    async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return { response: 'test response', model: 'gpt-4' }
    }
  )
  console.log('✅ LLM tracing works')
} catch (error) {
  console.error('❌ LLM tracing failed:', error)
  process.exit(1)
}

// Test 3: Enhanced Monitoring
console.log('\nTest 3: Enhanced Monitoring')
try {
  const monitor = EnhancedDatadogMonitoring.getInstance()

  // Test session tracking
  monitor.trackTerminalSessionCreated('test-session-123', 'test-workspace', 'test-user')
  console.log('  ✓ Session creation tracked')

  // Test command tracking
  monitor.trackTerminalCommand('test-session-123', 'ls -la', 150)
  console.log('  ✓ Command execution tracked')

  // Test AI usage tracking
  monitor.trackAIUsage('test-session-123', 'chat', 'openai', 'gpt-4', 250, 100)
  console.log('  ✓ AI usage tracked')

  // Test session end
  monitor.trackTerminalSessionEnded('test-session-123', 'user_close')
  console.log('  ✓ Session end tracked')

  console.log('✅ Enhanced monitoring works')
} catch (error) {
  console.error('❌ Enhanced monitoring failed:', error)
  process.exit(1)
}

// Test 4: Configuration Validation
console.log('\nTest 4: Configuration Validation')
try {
  const tracerConfig = (tracer as any)._tracer?._config

  if (!tracerConfig) {
    console.warn('⚠️ Tracer config not accessible (may be expected)')
  } else {
    console.log('  Service:', tracerConfig.service)
    console.log('  Environment:', tracerConfig.env)
    console.log('  Version:', tracerConfig.version)
    console.log('  Runtime Metrics:', tracerConfig.runtimeMetrics)
    console.log('  Log Injection:', tracerConfig.logInjection)
    console.log('✅ Configuration validation complete')
  }
} catch (error) {
  console.warn('⚠️ Configuration validation skipped:', error)
}

console.log('\n🎉 All monitoring tests passed!')
process.exit(0)
```

Run the test:
```bash
chmod +x scripts/test-monitoring.ts
npx tsx scripts/test-monitoring.ts
```

Expected output:
```
🧪 Testing Monitoring Consolidation...

Test 1: Basic Tracing
✅ Basic tracing works

Test 2: LLM Tracing
✅ LLM tracing works

Test 3: Enhanced Monitoring
  ✓ Session creation tracked
  ✓ Command execution tracked
  ✓ AI usage tracked
  ✓ Session end tracked
✅ Enhanced monitoring works

Test 4: Configuration Validation
  Service: vibecode-webgui
  Environment: development
  Version: 1.0.0
  Runtime Metrics: true
  Log Injection: true
✅ Configuration validation complete

🎉 All monitoring tests passed!
```

---

## Datadog Integration Verification

### 1. Check Active Traces in Datadog

```bash
# Query Datadog API for recent traces
curl -X GET "https://api.datadoghq.com/api/v2/traces" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d "start=$(date -u -d '5 minutes ago' +%s)000000000" \
  -d "end=$(date -u +%s)000000000" \
  | jq '.data[] | {service: .attributes.service, env: .attributes.env, version: .attributes.version}'
```

Expected output (after consolidation):
```json
{
  "service": "vibecode-webgui",
  "env": "development",
  "version": "1.0.0"
}
```

Should NOT see:
```json
{
  "service": "vibecode-enhanced-platform",  // ❌ Old duplicate service name
  ...
}
```

---

### 2. Verify Service Catalog

```bash
# List all services in Datadog
curl -X GET "https://api.datadoghq.com/api/v2/services/definitions" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  | jq '.data[].attributes.schema."dd-service"' \
  | grep vibecode
```

Expected output (after consolidation):
```
"vibecode-webgui"
"vibecode-webgui-openai"
```

Should NOT see:
```
"vibecode-enhanced-platform"  // ❌ From duplicate init
```

---

### 3. Check for Trace Errors

```bash
# Query for initialization errors
curl -X POST "https://api.datadoghq.com/api/v1/logs-queries/list" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "query": "service:vibecode-webgui status:error tracer",
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "limit": 10
  }' \
  | jq '.logs[] | {message: .content.message, timestamp: .content.timestamp}'
```

Expected: No initialization-related errors

---

## OpenTelemetry Compatibility Check

### 1. Enable OpenTelemetry and Test Coexistence

```bash
# Test with OpenTelemetry enabled
OTEL_ENABLED=true npm run dev 2>&1 | tee /tmp/otel-test.log &
sleep 10
pkill -f "next dev"

# Check for conflicts
echo "=== Initialization Sequence ==="
grep -E "Datadog|OpenTelemetry" /tmp/otel-test.log | grep -i "initialized"

# Expected sequence:
# 1. OpenTelemetry initialized (if OTEL_ENABLED=true)
# 2. Datadog tracer initialized
# No errors about duplicate initialization
```

---

### 2. Verify OTLP Exporter Configuration

```typescript
// Test script: scripts/test-otel-config.ts
import { getOpenTelemetryConfig } from '@/lib/monitoring/opentelemetry'

const config = getOpenTelemetryConfig()

console.log('OpenTelemetry Configuration:')
console.log('  Initialized:', config.initialized)
console.log('  Service:', config.service_name)
console.log('  Version:', config.service_version)
console.log('  Environment:', config.environment)
console.log('  OTLP Endpoint:', config.otlp_endpoint)
console.log('  Datadog Integration:', config.datadog_integration)

// Verify expected values
if (config.service_name !== 'vibecode-webgui') {
  console.error('❌ Service name mismatch!')
  process.exit(1)
}

console.log('✅ OpenTelemetry configuration valid')
```

---

## Performance Validation

### 1. Measure Initialization Overhead

```bash
# Create benchmark script: scripts/benchmark-init.ts
cat > scripts/benchmark-init.ts << 'EOF'
#!/usr/bin/env tsx
import { performance } from 'perf_hooks'

console.log('🔬 Benchmarking Tracer Initialization...\n')

// Measure total startup time
const startTotal = performance.now()

// Import tracer (triggers initialization)
const startImport = performance.now()
import('@/instrument').then(() => {
  const importTime = performance.now() - startImport
  const totalTime = performance.now() - startTotal

  console.log('Import Time:', importTime.toFixed(2), 'ms')
  console.log('Total Startup:', totalTime.toFixed(2), 'ms')

  if (importTime > 500) {
    console.warn('⚠️ Slow initialization detected (>500ms)')
  } else {
    console.log('✅ Initialization performance acceptable')
  }
})
EOF

chmod +x scripts/benchmark-init.ts
npx tsx scripts/benchmark-init.ts
```

Expected output:
```
🔬 Benchmarking Tracer Initialization...

Import Time: 120.45 ms
Total Startup: 125.67 ms
✅ Initialization performance acceptable
```

---

### 2. Memory Usage Check

```bash
# Monitor memory during initialization
node --expose-gc scripts/memory-profile.ts
```

Create `scripts/memory-profile.ts`:
```typescript
#!/usr/bin/env tsx
import { performance } from 'perf_hooks'

// Force garbage collection
if (global.gc) {
  global.gc()
}

const memBefore = process.memoryUsage()
console.log('Memory Before Import:')
console.log('  Heap Used:', (memBefore.heapUsed / 1024 / 1024).toFixed(2), 'MB')

// Import tracer
import('@/instrument').then(() => {
  const memAfter = process.memoryUsage()
  const heapDiff = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024

  console.log('\nMemory After Import:')
  console.log('  Heap Used:', (memAfter.heapUsed / 1024 / 1024).toFixed(2), 'MB')
  console.log('  Heap Increase:', heapDiff.toFixed(2), 'MB')

  if (heapDiff > 50) {
    console.warn('⚠️ High memory overhead (>50MB)')
  } else {
    console.log('✅ Memory usage acceptable')
  }
})
```

Expected output:
```
Memory Before Import:
  Heap Used: 15.32 MB

Memory After Import:
  Heap Used: 28.45 MB
  Heap Increase: 13.13 MB
✅ Memory usage acceptable
```

---

## Integration Test Suite

### 1. API Route Instrumentation Test

```bash
# Test that API routes are properly instrumented
curl -X POST http://localhost:3002/api/test-tracing \
  -H "Content-Type: application/json" \
  -d '{"test": "consolidation"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

# Check Datadog for the trace
# Should see trace with service: vibecode-webgui
```

---

### 2. WebSocket Instrumentation Test

```typescript
// Test WebSocket span creation
import { EnhancedDatadogMonitoring } from '@/lib/monitoring/enhanced-datadog-integration'

const monitor = EnhancedDatadogMonitoring.getInstance()

// Simulate WebSocket events
monitor.trackWorkspaceActivity('test-workspace', 'file_created', {
  filename: 'test.ts',
  size: 1024
})

console.log('✅ WebSocket instrumentation test passed')
```

---

## Automated Validation Script

Create comprehensive validation script: `scripts/validate-monitoring.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Monitoring Consolidation Validation Suite"
echo "============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
  local test_name="$1"
  local test_command="$2"

  echo -n "Testing: $test_name... "

  if eval "$test_command" > /tmp/test-output.log 2>&1; then
    echo -e "${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    cat /tmp/test-output.log
  fi
}

# Test 1: Initialization count
run_test "Single tracer.init() in instrumentation.ts" \
  "test $(grep -c 'tracer.init(' src/instrumentation.ts) -eq 1"

# Test 2: No duplicates in health-monitoring
run_test "No tracer.init() in health-monitoring.ts" \
  "! grep -q 'tracer.init(' src/lib/monitoring/health-monitoring.ts"

# Test 3: No duplicates in enhanced-datadog-integration
run_test "No tracer.init() in enhanced-datadog-integration.ts" \
  "! grep -q 'tracer.init(' src/lib/monitoring/enhanced-datadog-integration.ts"

# Test 4: Correct import pattern
run_test "health-monitoring imports from @/instrument" \
  "grep -q \"import.*from '@/instrument'\" src/lib/monitoring/health-monitoring.ts"

# Test 5: No hardcoded versions
run_test "No hardcoded version '2.0.0'" \
  "! grep -q \"version: '2.0.0'\" src/lib/monitoring/enhanced-datadog-integration.ts"

# Test 6: Service name consistency
run_test "No 'vibecode-enhanced-platform' service name" \
  "! grep -q 'vibecode-enhanced-platform' src/lib/monitoring/enhanced-datadog-integration.ts"

# Test 7: Environment variable usage
run_test "Using getServiceEnvVersion() helper" \
  "grep -q 'getServiceEnvVersion' src/lib/monitoring/health-monitoring.ts || grep -q 'DD_VERSION' src/lib/monitoring/health-monitoring.ts"

# Test 8: TypeScript compilation
run_test "TypeScript compilation clean" \
  "npx tsc --noEmit --project tsconfig.json"

# Summary
echo ""
echo "============================================="
echo "Test Results:"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
  exit 1
else
  echo -e "  ${GREEN}All tests passed!${NC}"
fi
```

Make executable and run:
```bash
chmod +x scripts/validate-monitoring.sh
./scripts/validate-monitoring.sh
```

Expected output:
```
🔍 Monitoring Consolidation Validation Suite
=============================================

Testing: Single tracer.init() in instrumentation.ts... ✓
Testing: No tracer.init() in health-monitoring.ts... ✓
Testing: No tracer.init() in enhanced-datadog-integration.ts... ✓
Testing: health-monitoring imports from @/instrument... ✓
Testing: No hardcoded version '2.0.0'... ✓
Testing: No 'vibecode-enhanced-platform' service name... ✓
Testing: Using getServiceEnvVersion() helper... ✓
Testing: TypeScript compilation clean... ✓

=============================================
Test Results:
  Passed: 8
  All tests passed!
```

---

## Continuous Monitoring Setup

### 1. Add Pre-Commit Hook

Create `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate monitoring configuration
echo "Validating monitoring configuration..."
./scripts/validate-monitoring.sh
```

---

### 2. Add CI Validation

Add to `.github/workflows/main-branch-ci.yml`:
```yaml
- name: Validate Monitoring Consolidation
  run: |
    npm run validate:monitoring
```

Add to `package.json`:
```json
{
  "scripts": {
    "validate:monitoring": "./scripts/validate-monitoring.sh"
  }
}
```

---

## Troubleshooting

### Issue: Multiple "tracer initialized" messages

**Diagnosis**:
```bash
npm run dev 2>&1 | grep -i "tracer initialized" | wc -l
# If count > 1, duplicates remain
```

**Fix**: Re-check for `tracer.init()` calls:
```bash
grep -r "tracer\.init(" src/ --include="*.ts" | grep -v node_modules
```

---

### Issue: Service name mismatch in Datadog

**Diagnosis**:
```bash
curl -X GET "https://api.datadoghq.com/api/v2/services/definitions" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  | jq '.data[].attributes.schema."dd-service"'
```

**Fix**: Search for hardcoded service names:
```bash
grep -r "service:.*vibecode" src/lib/monitoring/ --include="*.ts"
```

---

### Issue: Configuration not applied

**Diagnosis**:
```bash
# Check tracer config at runtime
node -e "
  import('@/instrument').then(({ default: tracer }) => {
    console.log(tracer._tracer?._config)
  })
"
```

**Fix**: Verify initialization order in `instrumentation.ts`

---

## Summary Checklist

Before marking consolidation complete, verify:

- [ ] Only 2 `tracer.init()` calls exist (instrumentation.ts + instrument.ts)
- [ ] No duplicates in health-monitoring.ts
- [ ] No duplicates in enhanced-datadog-integration.ts
- [ ] All monitoring files import from `@/instrument`
- [ ] No hardcoded versions (use `getServiceEnvVersion()`)
- [ ] Service name is consistent (`vibecode-webgui`)
- [ ] Dev server shows single initialization message
- [ ] Datadog APM shows single service name
- [ ] All monitoring features still functional
- [ ] OpenTelemetry integration unaffected
- [ ] TypeScript compilation clean
- [ ] Tests passing
- [ ] Documentation updated

**Status**: [ ] Ready for Production

---

## Document Metadata

- **Created**: 2025-10-01
- **Purpose**: Validation toolkit for monitoring consolidation
- **Maintenance**: Update after each consolidation phase
- **Owner**: Monitoring & Observability Team
