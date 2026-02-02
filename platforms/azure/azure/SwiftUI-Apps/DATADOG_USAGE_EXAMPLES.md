# Datadog Test Telemetry - Usage Examples

Quick examples for common use cases.

## Basic Usage

### Run All Tests with Datadog

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
node run-tests-with-datadog.js
```

**Expected Output:**
```
============================================
VibeCode Test Suite with Datadog Telemetry
============================================
Service: vibecode-tests
Version: 3.3.0
APM Port: 8136
StatsD Port: 8135
============================================

=== Test: terminal-functionality ===
Description: Terminal functionality and command execution
File: test-terminal-functionality-post-build.js

[Datadog] Starting test: terminal-functionality
[Datadog] Trace ID: 1234567890123456789
[Datadog] Span ID: 9876543210987654321

[Test output...]

[Datadog] Test passed in 5234ms
✓ PASSED (5234ms)

============================================
Test Suite Summary
============================================
Total Tests: 2
Passed: 2
Failed: 0
Success Rate: 100.0%
Total Duration: 12567ms
============================================
```

---

## Node.js Examples

### Run Single Test

```javascript
const { runTestWithTracing } = require('./test-with-datadog');

async function runSingleTest() {
  const result = await runTestWithTracing(
    'test-terminal-functionality-post-build.js',
    'terminal-functionality'
  );
  
  if (result.success) {
    console.log(`✓ Test passed in ${result.duration}ms`);
  } else {
    console.error(`✗ Test failed: ${result.error}`);
    process.exit(1);
  }
}

runSingleTest();
```

### Send Custom Metrics

```javascript
const { sendMetric, incrementCounter, sendTiming } = require('./test-with-datadog');

// Gauge - Current value
sendMetric('vm.memory_usage_mb', 512, ['vm:test-vm', 'type:ubuntu']);

// Counter - Increment by 1
incrementCounter('api.requests', ['endpoint:/health', 'method:GET']);

// Timing - Duration in milliseconds
sendTiming('operation.startup', 1234, ['vm:test-vm', 'operation:boot']);

// Multiple metrics at once
sendMetric('vm.cpu_usage_percent', 45.2, ['vm:test-vm']);
sendMetric('vm.disk_usage_mb', 2048, ['vm:test-vm']);
sendMetric('vm.network_throughput_mbps', 100, ['vm:test-vm']);
```

### Custom Span

```javascript
const { tracer } = require('./test-with-datadog');

async function customOperation() {
  const span = tracer.startSpan('vm.operation', {
    resource: 'VM.startup.with.networking',
    tags: {
      'vm.id': 'test-vm-123',
      'vm.type': 'ubuntu',
      'network.mode': 'NAT'
    }
  });
  
  try {
    // Your operation here
    await startVM();
    
    span.setTag('vm.status', 'running');
    span.setTag('vm.ip', '192.168.64.10');
    span.setTag('operation.status', 'success');
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.type', error.constructor.name);
    span.setTag('error.message', error.message);
    throw error;
  } finally {
    span.finish();
  }
}
```

### Nested Spans

```javascript
const { tracer } = require('./test-with-datadog');

async function complexTest() {
  const testSpan = tracer.startSpan('test.complex');
  
  try {
    // Step 1
    const span1 = tracer.startSpan('test.step.1', { childOf: testSpan });
    await setupEnvironment();
    span1.finish();
    
    // Step 2
    const span2 = tracer.startSpan('test.step.2', { childOf: testSpan });
    await runTest();
    span2.finish();
    
    // Step 3
    const span3 = tracer.startSpan('test.step.3', { childOf: testSpan });
    await cleanup();
    span3.finish();
    
    testSpan.setTag('test.status', 'passed');
  } catch (error) {
    testSpan.setTag('error', true);
    testSpan.setTag('error.message', error.message);
    throw error;
  } finally {
    testSpan.finish();
  }
}
```

---

## Python Examples

### Run Single Test

```python
#!/usr/bin/env python3
from test_with_datadog import run_test_with_tracing

result = run_test_with_tracing(
    ['pytest', 'tests/test_vm.py'],
    'vm-functionality'
)

if result['success']:
    print(f"✓ Test passed in {result['duration']:.0f}ms")
else:
    print(f"✗ Test failed: {result['error']}")
    exit(1)
```

### Send Custom Metrics

```python
from test_with_datadog import send_metric, increment_counter, send_timing

# Gauge - Current value
send_metric('vm.memory_usage_mb', 512, tags=['vm:test-vm', 'type:ubuntu'])

# Counter - Increment by 1
increment_counter('api.requests', tags=['endpoint:/health', 'method:GET'])

# Timing - Duration in milliseconds
send_timing('operation.startup', 1234, tags=['vm:test-vm', 'operation:boot'])
```

### Custom Span

```python
from ddtrace import tracer

@tracer.wrap('vm.operation', service='vibecode-tests')
def start_vm(vm_id, vm_type):
    span = tracer.current_span()
    span.set_tag('vm.id', vm_id)
    span.set_tag('vm.type', vm_type)
    span.set_tag('network.mode', 'NAT')
    
    try:
        # Your operation here
        result = perform_vm_startup()
        
        span.set_tag('vm.status', 'running')
        span.set_tag('vm.ip', result['ip'])
        span.set_tag('operation.status', 'success')
        return result
    except Exception as error:
        span.set_tag('error', True)
        span.set_tag('error.type', type(error).__name__)
        span.set_tag('error.message', str(error))
        raise
```

---

## Advanced Examples

### Distributed Tracing

Link test traces to application traces:

```javascript
const { tracer } = require('./test-with-datadog');
const fetch = require('node-fetch');

async function testWithDistributedTracing() {
  const span = tracer.startSpan('test.with.distributed.tracing');
  const traceId = span.context().toTraceId();
  const spanId = span.context().toSpanId();
  
  try {
    // Call application with trace context
    const response = await fetch('http://localhost:8080/api/test', {
      headers: {
        'x-datadog-trace-id': traceId,
        'x-datadog-parent-id': spanId,
        'x-datadog-sampling-priority': '1'
      }
    });
    
    const data = await response.json();
    span.setTag('api.response.status', response.status);
    span.setTag('api.response.data', JSON.stringify(data));
    
    span.finish();
    return data;
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    span.finish();
    throw error;
  }
}
```

### Performance Monitoring

```javascript
const { tracer, sendMetric, sendTiming } = require('./test-with-datadog');

async function monitorPerformance(operation, fn) {
  const span = tracer.startSpan(`performance.${operation}`);
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  try {
    const result = await fn();
    
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    // Send metrics
    sendTiming(`operation.${operation}.duration`, duration, ['status:success']);
    sendMetric(`operation.${operation}.memory_delta_mb`, memoryDelta / 1024 / 1024);
    
    // Tag span
    span.setTag('duration_ms', duration);
    span.setTag('memory_delta_mb', memoryDelta / 1024 / 1024);
    span.setTag('status', 'success');
    
    span.finish();
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    sendTiming(`operation.${operation}.duration`, duration, ['status:failed']);
    
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    span.finish();
    throw error;
  }
}

// Usage
await monitorPerformance('vm-startup', async () => {
  return await startVM();
});
```

### Conditional Instrumentation

```javascript
const { tracer } = require('./test-with-datadog');

function conditionalTrace(name, fn, condition = true) {
  if (!condition) {
    return fn();
  }
  
  const span = tracer.startSpan(name);
  try {
    const result = fn();
    span.finish();
    return result;
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    span.finish();
    throw error;
  }
}

// Only trace in CI/CD
await conditionalTrace(
  'test.run',
  () => runTest(),
  process.env.CI === 'true'
);
```

### Batch Metrics

```javascript
const { dogstatsd } = require('./test-with-datadog');

function sendBatchMetrics(metrics) {
  // Send multiple metrics efficiently
  for (const [name, value, tags] of metrics) {
    dogstatsd.gauge(name, value, tags);
  }
}

// Usage
const vmMetrics = [
  ['vm.memory_usage_mb', 512, ['vm:test-1']],
  ['vm.cpu_usage_percent', 45.2, ['vm:test-1']],
  ['vm.disk_usage_mb', 2048, ['vm:test-1']],
  ['vm.network_throughput_mbps', 100, ['vm:test-1']]
];

sendBatchMetrics(vmMetrics);
```

---

## Integration Examples

### With Playwright

```javascript
const { test, expect } = require('@playwright/test');
const { tracer, sendMetric } = require('./test-with-datadog');

test('VM terminal functionality', async ({ page }) => {
  const span = tracer.startSpan('playwright.test.terminal');
  
  try {
    span.setTag('test.type', 'e2e');
    span.setTag('test.framework', 'playwright');
    
    await page.goto('http://localhost:3000');
    sendMetric('page.loaded', 1, ['page:home']);
    
    await page.click('#terminal-button');
    await page.waitForSelector('.terminal', { timeout: 5000 });
    sendMetric('terminal.opened', 1);
    
    span.setTag('test.status', 'passed');
    span.finish();
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    span.finish();
    throw error;
  }
});
```

### With Jest

```javascript
const { tracer, incrementCounter } = require('./test-with-datadog');

describe('VM Management', () => {
  beforeEach(() => {
    incrementCounter('test.started', ['suite:vm-management']);
  });
  
  afterEach(() => {
    incrementCounter('test.completed', ['suite:vm-management']);
  });
  
  test('should start VM successfully', async () => {
    const span = tracer.startSpan('test.vm.start');
    
    try {
      const vm = await startVM('test-vm-1');
      expect(vm.status).toBe('running');
      
      span.setTag('test.status', 'passed');
      span.setTag('vm.id', 'test-vm-1');
      incrementCounter('test.passed', ['test:vm-start']);
    } catch (error) {
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      incrementCounter('test.failed', ['test:vm-start']);
      throw error;
    } finally {
      span.finish();
    }
  });
});
```

### With CI/CD

**GitHub Actions:**
```yaml
- name: Run tests with Datadog
  env:
    DD_ENV: ci
    DD_SERVICE: vibecode-tests-ci
    DD_VERSION: ${{ github.sha }}
  run: |
    cd azure/SwiftUI-Apps
    node run-tests-with-datadog.js
```

**Jenkins:**
```groovy
stage('Test with Datadog') {
  environment {
    DD_ENV = 'ci'
    DD_SERVICE = 'vibecode-tests-ci'
    DD_VERSION = "${env.GIT_COMMIT}"
  }
  steps {
    sh 'cd azure/SwiftUI-Apps && node run-tests-with-datadog.js'
  }
}
```

---

## Query Examples

### APM Queries

**All tests:**
```
service:vibecode-tests env:development
```

**Failed tests only:**
```
service:vibecode-tests @test.status:failed
```

**Slow tests (>5 seconds):**
```
service:vibecode-tests @test.duration_ms:>5000
```

**Specific test:**
```
service:vibecode-tests @test.file:*terminal*
```

**Tests by error type:**
```
service:vibecode-tests @error.type:TimeoutError
```

### Metric Queries

**Success rate:**
```
avg:vibecode.tests.test.suite.success_rate{env:development}
```

**Test duration by test:**
```
avg:vibecode.tests.test.duration{*} by {test}
```

**Failed test count:**
```
sum:vibecode.tests.test.failed{*}.as_count()
```

**P95 test duration:**
```
p95:vibecode.tests.test.duration{test:terminal-functionality}
```

---

## Best Practices

### 1. Always Use Meaningful Tags

```javascript
// Good
sendMetric('vm.status', 1, [
  'vm:test-vm-123',
  'type:ubuntu',
  'network:NAT',
  'region:us-west'
]);

// Bad
sendMetric('vm.status', 1);
```

### 2. Structure Span Names Hierarchically

```javascript
// Good
tracer.startSpan('vm.operation.startup');
tracer.startSpan('vm.operation.networking.configure');
tracer.startSpan('vm.operation.networking.verify');

// Bad
tracer.startSpan('startup');
tracer.startSpan('networking');
```

### 3. Add Context to Errors

```javascript
// Good
span.setTag('error.context', JSON.stringify({
  vmId: 'test-vm-123',
  step: 'network-init',
  attemptNumber: 3,
  timeout: 30000
}));

// Bad
span.setTag('error', true);
```

### 4. Use Consistent Naming

```javascript
// Metrics: namespace.category.metric
vibecode.tests.test.duration
vibecode.tests.vm.memory_usage
vibecode.tests.api.response_time

// Spans: category.operation
test.run
vm.startup
api.request

// Tags: key:value
env:development
test:terminal-functionality
status:passed
```

---

**See DATADOG_TEST_INSTRUMENTATION_GUIDE.md for complete documentation.**
