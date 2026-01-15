# Datadog Test Instrumentation - Quick Reference

## Configuration
- **APM Port:** 8136 (custom)
- **StatsD Port:** 8135 (custom)
- **Service:** vibecode-tests
- **Version:** 3.3.0

## Run Tests

```bash
# All tests with Datadog
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
node run-tests-with-datadog.js

# Verify setup
./verify-datadog-setup.sh

# With custom environment
DD_ENV=staging node run-tests-with-datadog.js

# With debug logging
DD_TRACE_DEBUG=true node run-tests-with-datadog.js
```

## View in Datadog

**Traces:**
- URL: https://app.datadoghq.com/apm/traces?query=service:vibecode-tests
- Query: `service:vibecode-tests env:development`
- Failed only: `service:vibecode-tests @test.status:failed`

**Metrics:**
- URL: https://app.datadoghq.com/metric/explorer?query=vibecode.tests
- Success rate: `vibecode.tests.test.suite.success_rate`
- Failed tests: `sum:vibecode.tests.test.failed{*}.as_count()`

## Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `vibecode.tests.test.started` | counter | Test started |
| `vibecode.tests.test.passed` | counter | Test passed |
| `vibecode.tests.test.failed` | counter | Test failed |
| `vibecode.tests.test.duration` | timing | Test duration (ms) |
| `vibecode.tests.test.suite.success_rate` | gauge | Success % |

## Common Tags

```
env:development
version:3.3.0
project:vibecode-webgui
test:<test-name>
```

## Troubleshooting

```bash
# Check agent
ps aux | grep datadog-agent | grep -v grep

# Check ports
lsof -i :8135  # StatsD
lsof -i :8136  # APM

# Check logs
tail -f /opt/datadog-agent/logs/agent.log
tail -f /opt/datadog-agent/logs/trace-agent.log

# Test StatsD
echo "test.metric:1|g" | nc -u -w1 localhost 8135
```

## Custom Instrumentation

**Node.js:**
```javascript
const { runTestWithTracing, sendMetric, incrementCounter } = require('./test-with-datadog');

// Run test
await runTestWithTracing('test.js', 'test-name');

// Send metric
sendMetric('custom.metric', 123, ['tag:value']);

// Increment counter
incrementCounter('custom.counter', ['tag:value']);
```

**Python:**
```python
from test_with_datadog import run_test_with_tracing, send_metric

# Run test
result = run_test_with_tracing(['pytest', 'test.py'], 'test-name')

# Send metric
send_metric('custom.metric', 123, tags=['tag:value'])
```

## Files

```
azure/SwiftUI-Apps/
├── test-with-datadog.js                      # Node.js wrapper
├── test_with_datadog.py                      # Python wrapper
├── run-tests-with-datadog.js                 # Test runner
├── verify-datadog-setup.sh                   # Verification
├── DATADOG_TEST_INSTRUMENTATION_GUIDE.md     # Full guide
└── DATADOG_QUICK_REFERENCE.md                # This file
```
