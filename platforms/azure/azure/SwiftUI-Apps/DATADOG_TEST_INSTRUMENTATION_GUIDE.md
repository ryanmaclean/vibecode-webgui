# Datadog Test Instrumentation Guide

## Overview

This guide describes how to run automated tests with full Datadog telemetry, including traces, metrics, and logs. All tests send data to your local Datadog agent which forwards to Datadog cloud.

**Configuration:**
- **Datadog Agent:** Running on localhost
- **APM Trace Port:** 8136 (custom, not default 8126)
- **StatsD Port:** 8135 (custom, not default 8125)
- **Service Name:** vibecode-tests
- **Version:** 3.3.0
- **Environment:** development (configurable via DD_ENV)

---

## Quick Start

### Run All Tests with Datadog

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
node run-tests-with-datadog.js
```

This will:
1. Initialize Datadog tracer and StatsD client
2. Run all configured tests sequentially
3. Send traces and metrics for each test
4. Display a summary with pass/fail counts
5. Exit with code 0 (success) or 1 (failure)

### Run Individual Test with Datadog

```javascript
const { runTestWithTracing } = require('./test-with-datadog');

async function runMyTest() {
  const result = await runTestWithTracing(
    'test-terminal-functionality-post-build.js',
    'terminal-functionality'
  );
  
  if (result.success) {
    console.log(`Test passed in ${result.duration}ms`);
  } else {
    console.error(`Test failed: ${result.error}`);
  }
}

runMyTest();
```

---

## Installation

### Dependencies Already Installed

All required packages are already installed:

- **dd-trace** (5.75.0) - Node.js APM and tracing
- **hot-shots** (12.1.0) - StatsD client for metrics
- **ddtrace** (4.0.0) - Python APM and tracing

### Verify Installation

```bash
# Check Node.js dependencies
cd /Users/ryan.maclean/vibecode-webgui
npm list dd-trace hot-shots

# Check Python dependencies
pip list | grep ddtrace

# Check Datadog agent status
ps aux | grep datadog-agent | grep -v grep
lsof -i :8135  # StatsD
lsof -i :8136  # APM
```

---

## File Structure

```
azure/SwiftUI-Apps/
├── test-with-datadog.js              # Node.js instrumentation wrapper
├── test_with_datadog.py              # Python instrumentation wrapper
├── run-tests-with-datadog.js         # Master test runner
├── test-terminal-functionality-post-build.js
├── test-datadog-extension-post-build.js
└── DATADOG_TEST_INSTRUMENTATION_GUIDE.md
```

---

## Node.js Usage

### Basic Usage

```javascript
const { runTestWithTracing, tracer, dogstatsd } = require('./test-with-datadog');

// Run a test with full instrumentation
const result = await runTestWithTracing('my-test.js', 'my-test-name');
```

### Send Custom Metrics

```javascript
const { sendMetric, incrementCounter, sendTiming } = require('./test-with-datadog');

// Gauge metric
sendMetric('vm.memory_usage', 512, ['vm:test-vm']);

// Counter
incrementCounter('api.requests', ['endpoint:/health']);

// Timing
sendTiming('operation.duration', 1234, ['operation:startup']);
```

### Custom Spans

```javascript
const { tracer } = require('./test-with-datadog');

async function myOperation() {
  const span = tracer.startSpan('custom.operation');
  span.setTag('operation.type', 'validation');
  
  try {
    // Your code here
    span.setTag('operation.status', 'success');
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    throw error;
  } finally {
    span.finish();
  }
}
```

---

## Python Usage

### Basic Usage

```python
from test_with_datadog import run_test_with_tracing

# Run a test with full instrumentation
result = run_test_with_tracing(['pytest', 'test_example.py'], 'example-test')

if result['success']:
    print(f"Test passed in {result['duration']}ms")
else:
    print(f"Test failed: {result['error']}")
```

### Send Custom Metrics

```python
from test_with_datadog import send_metric, increment_counter, send_timing

# Gauge metric
send_metric('vm.memory_usage', 512, tags=['vm:test-vm'])

# Counter
increment_counter('api.requests', tags=['endpoint:/health'])

# Timing
send_timing('operation.duration', 1234, tags=['operation:startup'])
```

### Custom Spans

```python
from ddtrace import tracer

@tracer.wrap('custom.operation')
def my_operation():
    span = tracer.current_span()
    span.set_tag('operation.type', 'validation')
    
    try:
        # Your code here
        span.set_tag('operation.status', 'success')
    except Exception as error:
        span.set_tag('error', True)
        span.set_tag('error.message', str(error))
        raise
```

---

## Metrics and Tags

### Automatic Metrics

The test runner automatically sends:

**Per-Test Metrics:**
- `vibecode.tests.test.started` - Counter when test starts
- `vibecode.tests.test.passed` - Counter when test passes
- `vibecode.tests.test.failed` - Counter when test fails
- `vibecode.tests.test.duration` - Timing in milliseconds
- `vibecode.tests.test.last_run_duration` - Gauge of last run duration

**Per-Suite Metrics:**
- `vibecode.tests.test.suite.started` - Counter when suite starts
- `vibecode.tests.test.suite.completed` - Counter when suite completes
- `vibecode.tests.test.suite.passed` - Gauge of passed tests
- `vibecode.tests.test.suite.failed` - Gauge of failed tests
- `vibecode.tests.test.suite.total` - Gauge of total tests
- `vibecode.tests.test.suite.success_rate` - Gauge of success percentage
- `vibecode.tests.test.suite.duration` - Timing in milliseconds

### Standard Tags

All metrics include:
- `env:development` (or DD_ENV value)
- `version:3.3.0`
- `project:vibecode-webgui`
- `test:<test-name>` (for test-specific metrics)

### Trace Tags

All traces include:
- `test.file` - Test file path
- `test.framework` - Test framework (playwright, pytest)
- `test.type` - Test type (e2e, integration)
- `test.status` - Test result (passed, failed)
- `test.duration_ms` - Duration in milliseconds
- `error` - True if test failed
- `error.type` - Error type if failed
- `error.message` - Error message if failed

---

## View Results in Datadog

### APM Traces

1. Go to [Datadog APM](https://app.datadoghq.com/apm/traces)
2. Filter by `service:vibecode-tests`
3. View individual test traces with timing breakdown
4. Click on a trace to see spans, tags, and logs

**Useful Queries:**
```
service:vibecode-tests env:development
service:vibecode-tests test.status:failed
service:vibecode-tests @test.duration_ms:>5000
```

### Metrics Dashboard

1. Go to [Datadog Metrics Explorer](https://app.datadoghq.com/metric/explorer)
2. Search for `vibecode.tests.*`
3. Visualize test success rates, durations, and trends

**Key Metrics to Monitor:**
- `vibecode.tests.test.suite.success_rate` - Overall test health
- `vibecode.tests.test.duration` - Performance trends
- `vibecode.tests.test.failed` - Failure counts by test

### Create Custom Dashboard

```json
{
  "title": "VibeCode Test Suite",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:vibecode.tests.test.suite.success_rate{*}",
            "display_type": "line"
          }
        ],
        "title": "Test Success Rate"
      }
    },
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "sum:vibecode.tests.test.failed{*}.as_count()",
            "aggregator": "sum"
          }
        ],
        "title": "Failed Tests (Last 24h)"
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:vibecode.tests.test.duration{*} by {test}",
            "display_type": "line"
          }
        ],
        "title": "Test Duration by Test"
      }
    }
  ]
}
```

---

## Create Monitors

### Alert on Test Failures

1. Go to [Monitors > New Monitor](https://app.datadoghq.com/monitors/create)
2. Select "Metric Monitor"
3. Configure:
   - **Metric:** `vibecode.tests.test.failed`
   - **Alert:** When sum of failures > 0 over 5 minutes
   - **Message:** "Test failures detected in vibecode-tests"

### Alert on Low Success Rate

1. Create "Metric Monitor"
2. Configure:
   - **Metric:** `vibecode.tests.test.suite.success_rate`
   - **Alert:** When average < 90% over 15 minutes
   - **Message:** "Test success rate dropped below 90%"

### Alert on Slow Tests

1. Create "Metric Monitor"
2. Configure:
   - **Metric:** `vibecode.tests.test.duration`
   - **Alert:** When average > 60000ms (1 minute) over 10 minutes
   - **Message:** "Tests running slower than expected"

---

## Configuration Options

### Environment Variables

```bash
# Set environment (development, staging, production)
export DD_ENV=development

# Enable debug logging
export DD_TRACE_DEBUG=true

# Set custom service name
export DD_SERVICE=my-custom-service

# Set version
export DD_VERSION=1.0.0

# Disable tracing (metrics still work)
export DD_TRACE_ENABLED=false
```

### Custom Test Configuration

Edit `run-tests-with-datadog.js` to add/remove tests:

```javascript
const tests = [
  { 
    file: 'test-terminal-functionality-post-build.js', 
    name: 'terminal-functionality',
    description: 'Terminal functionality and command execution'
  },
  { 
    file: 'test-datadog-extension-post-build.js', 
    name: 'datadog-extension',
    description: 'Datadog extension SSH connectivity'
  },
  // Add your tests here
  {
    file: 'test-my-feature.js',
    name: 'my-feature',
    description: 'My new feature test'
  }
];
```

---

## Troubleshooting

### No Traces in Datadog

**Check agent is running:**
```bash
ps aux | grep datadog-agent | grep -v grep
lsof -i :8136  # APM port should show trace-agent
```

**Check agent logs:**
```bash
tail -f /opt/datadog-agent/logs/agent.log
tail -f /opt/datadog-agent/logs/trace-agent.log
```

**Verify configuration:**
```bash
cat /opt/datadog-agent/etc/datadog.yaml | grep -A 5 apm_config
```

### No Metrics in Datadog

**Check StatsD port:**
```bash
lsof -i :8135  # Should show agent process
```

**Test StatsD manually:**
```bash
echo "custom.metric:1|g" | nc -u -w1 localhost 8135
```

**Check DogStatsD logs:**
```bash
tail -f /opt/datadog-agent/logs/agent.log | grep dogstatsd
```

### Tests Not Running

**Check file paths:**
```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
ls -la test-*.js
```

**Check Node.js version:**
```bash
node --version  # Should be 14+ for dd-trace
```

**Run with debug:**
```bash
DD_TRACE_DEBUG=true node run-tests-with-datadog.js
```

---

## Best Practices

### 1. Tag Everything

Add meaningful tags to help filter and analyze:

```javascript
dogstatsd.increment('test.custom_event', 1, [
  'test:my-test',
  'component:vm',
  'feature:networking',
  'severity:high'
]);
```

### 2. Use Consistent Naming

Follow naming conventions:
- Metrics: `vibecode.tests.<category>.<name>`
- Tests: `kebab-case-names`
- Tags: `key:value` format

### 3. Set Meaningful Resource Names

```javascript
const span = tracer.startSpan('operation', {
  resource: 'VM.startup.with.networking',  // Clear, specific
  tags: { 'vm.type': 'ubuntu', 'network.mode': 'NAT' }
});
```

### 4. Include Context in Errors

```javascript
span.setTag('error.context', JSON.stringify({
  vmId: 'test-vm-123',
  step: 'network-initialization',
  retries: 3
}));
```

### 5. Monitor Trends

Set up dashboards to track:
- Success rate over time
- Test duration trends (detect performance regressions)
- Failure patterns (which tests fail most?)
- Resource usage during tests

---

## Integration with CI/CD

### GitHub Actions

```yaml
name: Run Tests with Datadog

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests with Datadog
        env:
          DD_API_KEY: ${{ secrets.DD_API_KEY }}
          DD_ENV: ci
          DD_SERVICE: vibecode-tests-ci
        run: |
          cd azure/SwiftUI-Apps
          node run-tests-with-datadog.js
```

### Jenkins

```groovy
pipeline {
  agent any
  environment {
    DD_ENV = 'ci'
    DD_SERVICE = 'vibecode-tests-ci'
  }
  stages {
    stage('Test') {
      steps {
        sh '''
          cd azure/SwiftUI-Apps
          node run-tests-with-datadog.js
        '''
      }
    }
  }
}
```

---

## Advanced Features

### Distributed Tracing

Link test traces to application traces:

```javascript
const { tracer } = require('./test-with-datadog');

async function testWithContext() {
  const span = tracer.startSpan('test.run');
  const traceId = span.context().toTraceId();
  
  // Pass trace context to application under test
  await fetch('http://localhost:8080/api/test', {
    headers: {
      'x-datadog-trace-id': traceId,
      'x-datadog-parent-id': span.context().toSpanId(),
    }
  });
  
  span.finish();
}
```

### Profiling

Enable continuous profiling for performance analysis:

```javascript
const tracer = require('dd-trace').init({
  profiling: true,
  runtimeMetrics: true
});
```

### Custom Instrumentation

Instrument specific operations:

```javascript
const { tracer } = require('./test-with-datadog');

tracer.use('http', {
  service: 'vibecode-tests-http',
  hooks: {
    request: (span, req) => {
      span.setTag('http.url', req.url);
    }
  }
});
```

---

## Support and Resources

### Documentation
- [Datadog APM Docs](https://docs.datadoghq.com/tracing/)
- [dd-trace Node.js](https://docs.datadoghq.com/tracing/setup_overview/setup/nodejs/)
- [ddtrace Python](https://docs.datadoghq.com/tracing/setup_overview/setup/python/)
- [DogStatsD](https://docs.datadoghq.com/developers/dogstatsd/)

### Example Queries

**APM Traces:**
```
service:vibecode-tests @test.status:failed
service:vibecode-tests @test.duration_ms:>5000
service:vibecode-tests env:development @test.file:*terminal*
```

**Metrics:**
```
avg:vibecode.tests.test.duration{test:terminal-functionality}
sum:vibecode.tests.test.failed{*}.as_count()
avg:vibecode.tests.test.suite.success_rate{env:development}
```

### Quick Reference

| Metric | Type | Description |
|--------|------|-------------|
| test.started | counter | Test execution started |
| test.passed | counter | Test passed |
| test.failed | counter | Test failed |
| test.duration | timing | Test duration in ms |
| test.suite.success_rate | gauge | Success percentage |

| Tag | Example | Description |
|-----|---------|-------------|
| test | terminal-functionality | Test identifier |
| env | development | Environment |
| version | 3.3.0 | Software version |
| status | passed/failed | Test result |

---

## Appendix: Port Configuration

**Standard Ports:**
- DogStatsD: 8125
- APM Trace: 8126

**VibeCode Custom Ports:**
- DogStatsD: **8135** (configured in /opt/datadog-agent/etc/datadog.yaml)
- APM Trace: **8136** (configured in /opt/datadog-agent/etc/datadog.yaml)

**Why Custom Ports?**
Enterprise IT configuration to avoid conflicts with other services.

**Verify Configuration:**
```bash
cat /opt/datadog-agent/etc/datadog.yaml | grep -E "(dogstatsd_port|receiver_port)"
```

---

## Summary

You now have full Datadog instrumentation for your test suite:

1. **Run tests:** `node run-tests-with-datadog.js`
2. **View traces:** https://app.datadoghq.com/apm/traces?query=service:vibecode-tests
3. **View metrics:** https://app.datadoghq.com/metric/explorer?query=vibecode.tests
4. **Create dashboards:** Use the JSON template above
5. **Set alerts:** Follow the monitor configuration examples

All tests now automatically send:
- Detailed APM traces with timing breakdown
- Metrics for success/failure rates
- Custom tags for filtering and analysis
- Error details for debugging failures

**Next Steps:**
1. Run a test to verify instrumentation works
2. Create a custom dashboard in Datadog
3. Set up monitors for test failures
4. Add custom metrics to your tests
