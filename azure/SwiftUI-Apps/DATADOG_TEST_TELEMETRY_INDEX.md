# Datadog Test Telemetry - Documentation Index

**Quick Navigation Guide**

---

## Getting Started

**New to Datadog test instrumentation?** Start here:

1. **[DATADOG_QUICK_REFERENCE.md](./DATADOG_QUICK_REFERENCE.md)** (2.7 KB)
   - Essential commands and configuration
   - Quick troubleshooting
   - 5-minute overview

2. **[Verify Setup](#verify-setup)**
   ```bash
   cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
   ./verify-datadog-setup.sh
   ```

3. **[Run Your First Test](#run-first-test)**
   ```bash
   node run-tests-with-datadog.js
   ```

---

## Documentation Files

### Core Documentation

**[DATADOG_TEST_INSTRUMENTATION_GUIDE.md](./DATADOG_TEST_INSTRUMENTATION_GUIDE.md)** (15 KB)
- Complete setup guide
- Configuration details
- Metrics and tags reference
- Datadog UI navigation
- Monitor creation examples
- Troubleshooting
- Best practices
- CI/CD integration

**READ THIS** for comprehensive understanding of the system.

---

### Quick References

**[DATADOG_QUICK_REFERENCE.md](./DATADOG_QUICK_REFERENCE.md)** (2.7 KB)
- Quick commands
- Key metrics list
- Common queries
- Essential troubleshooting
- One-page cheat sheet

**BOOKMARK THIS** for daily use.

---

### Usage Examples

**[DATADOG_USAGE_EXAMPLES.md](./DATADOG_USAGE_EXAMPLES.md)** (13 KB)
- Node.js examples
- Python examples
- Advanced patterns
- Integration examples (Playwright, Jest)
- CI/CD examples
- Query examples
- Best practices

**REFERENCE THIS** when writing instrumented tests.

---

### Completion Report

**[DATADOG_TEST_TELEMETRY_COMPLETE.md](./DATADOG_TEST_TELEMETRY_COMPLETE.md)** (11 KB)
- Project completion summary
- Configuration details
- Verification results
- Files created
- Next steps

**READ THIS** to understand what was implemented.

---

## Code Files

### Instrumentation Wrappers

**test-with-datadog.js** (3.5 KB)
- Node.js instrumentation wrapper
- dd-trace integration
- hot-shots StatsD client
- Automatic test lifecycle tracking

```javascript
const { runTestWithTracing, sendMetric } = require('./test-with-datadog');
await runTestWithTracing('test.js', 'test-name');
```

**test_with_datadog.py** (4.6 KB)
- Python instrumentation wrapper
- ddtrace integration
- DogStatsD metrics

```python
from test_with_datadog import run_test_with_tracing
result = run_test_with_tracing(['pytest', 'test.py'], 'test-name')
```

---

### Test Runner

**run-tests-with-datadog.js** (2.9 KB)
- Master test runner
- Sequential test execution
- Suite-level statistics
- Formatted output

```bash
node run-tests-with-datadog.js
```

---

### Verification Tool

**verify-datadog-setup.sh** (3.9 KB)
- Agent status check
- Port verification
- Dependency validation
- Connectivity test

```bash
./verify-datadog-setup.sh
```

---

## Quick Start Guide

### 1. Verify Setup

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
./verify-datadog-setup.sh
```

**Expected output:**
- ✓ Datadog agent is running
- ✓ APM trace port 8136 is listening
- ✓ StatsD port 8135 is listening
- ✓ All dependencies installed
- ✓ All files exist

---

### 2. Run Tests

```bash
node run-tests-with-datadog.js
```

**What it does:**
- Runs all configured tests
- Sends traces to Datadog APM
- Sends metrics to Datadog
- Displays summary statistics

---

### 3. View Results

**APM Traces:**
https://app.datadoghq.com/apm/traces?query=service:vibecode-tests

**Metrics:**
https://app.datadoghq.com/metric/explorer?query=vibecode.tests

---

## Configuration

### Datadog Agent
- **Status:** Running
- **APM Port:** 8136 (custom)
- **StatsD Port:** 8135 (custom)
- **Config:** /opt/datadog-agent/etc/datadog.yaml

### Service
- **Name:** vibecode-tests
- **Version:** 3.3.0
- **Environment:** development (DD_ENV)

### Tests Configured
- terminal-functionality
- datadog-extension

---

## Common Tasks

### Add a New Test

Edit `run-tests-with-datadog.js`:
```javascript
const tests = [
  // Existing tests...
  { 
    file: 'new-test.js', 
    name: 'new-test',
    description: 'New feature test'
  }
];
```

### Send Custom Metric

```javascript
const { sendMetric } = require('./test-with-datadog');
sendMetric('custom.metric', 123, ['tag:value']);
```

### Create Custom Span

```javascript
const { tracer } = require('./test-with-datadog');
const span = tracer.startSpan('operation.name');
// ... do work ...
span.finish();
```

### Change Environment

```bash
DD_ENV=staging node run-tests-with-datadog.js
```

---

## Metrics Collected

### Per-Test
- `vibecode.tests.test.started` - Counter
- `vibecode.tests.test.passed` - Counter
- `vibecode.tests.test.failed` - Counter
- `vibecode.tests.test.duration` - Timing
- `vibecode.tests.test.last_run_duration` - Gauge

### Suite-Level
- `vibecode.tests.test.suite.success_rate` - Gauge
- `vibecode.tests.test.suite.passed` - Gauge
- `vibecode.tests.test.suite.failed` - Gauge
- `vibecode.tests.test.suite.total` - Gauge
- `vibecode.tests.test.suite.duration` - Timing

---

## Troubleshooting

### Agent Not Running
```bash
ps aux | grep datadog-agent | grep -v grep
# Should show 3 processes: agent, trace-agent, process-agent
```

### Ports Not Listening
```bash
lsof -i :8135  # StatsD
lsof -i :8136  # APM
```

### No Traces in Datadog
```bash
# Check agent logs
tail -f /opt/datadog-agent/logs/trace-agent.log

# Run with debug
DD_TRACE_DEBUG=true node run-tests-with-datadog.js
```

### Test Failures
```bash
# Check test files exist
ls -la test-*.js

# Run tests individually
node test-terminal-functionality-post-build.js
```

---

## Learning Path

### Beginner
1. Read: **DATADOG_QUICK_REFERENCE.md**
2. Run: `./verify-datadog-setup.sh`
3. Run: `node run-tests-with-datadog.js`
4. View results in Datadog APM

### Intermediate
1. Read: **DATADOG_TEST_INSTRUMENTATION_GUIDE.md**
2. Read: **DATADOG_USAGE_EXAMPLES.md**
3. Add custom metrics to tests
4. Create a custom span
5. Build a Datadog dashboard

### Advanced
1. Implement distributed tracing
2. Set up custom monitors
3. Create CI/CD integration
4. Enable profiling
5. Build custom instrumentation patterns

---

## File Locations

All files are in:
```
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/
```

**Documentation:**
- DATADOG_TEST_INSTRUMENTATION_GUIDE.md
- DATADOG_QUICK_REFERENCE.md
- DATADOG_USAGE_EXAMPLES.md
- DATADOG_TEST_TELEMETRY_COMPLETE.md
- DATADOG_TEST_TELEMETRY_INDEX.md (this file)

**Code:**
- test-with-datadog.js
- test_with_datadog.py
- run-tests-with-datadog.js

**Tools:**
- verify-datadog-setup.sh

---

## External Resources

**Datadog:**
- [APM Documentation](https://docs.datadoghq.com/tracing/)
- [dd-trace Node.js](https://docs.datadoghq.com/tracing/setup_overview/setup/nodejs/)
- [ddtrace Python](https://docs.datadoghq.com/tracing/setup_overview/setup/python/)
- [DogStatsD](https://docs.datadoghq.com/developers/dogstatsd/)

**Your Datadog:**
- [APM Traces](https://app.datadoghq.com/apm/traces?query=service:vibecode-tests)
- [Metrics](https://app.datadoghq.com/metric/explorer?query=vibecode.tests)
- [Dashboards](https://app.datadoghq.com/dashboard/lists)
- [Monitors](https://app.datadoghq.com/monitors/manage)

---

## Support

**Questions?**
1. Check **DATADOG_QUICK_REFERENCE.md** for quick answers
2. Search **DATADOG_TEST_INSTRUMENTATION_GUIDE.md** for details
3. Look at **DATADOG_USAGE_EXAMPLES.md** for code examples
4. Review **DATADOG_TEST_TELEMETRY_COMPLETE.md** for configuration

**Still stuck?**
- Run `./verify-datadog-setup.sh` to check configuration
- Check Datadog agent logs: `tail -f /opt/datadog-agent/logs/agent.log`
- Enable debug mode: `DD_TRACE_DEBUG=true node run-tests-with-datadog.js`

---

## Next Steps

**Immediate (5 minutes):**
1. Run `./verify-datadog-setup.sh`
2. Run `node run-tests-with-datadog.js`
3. View traces in Datadog APM

**Short Term (1 hour):**
1. Create a custom Datadog dashboard
2. Set up a monitor for test failures
3. Add custom metrics to a test

**Long Term (ongoing):**
1. Integrate with CI/CD
2. Build comprehensive dashboards
3. Set up SLOs for test reliability
4. Implement distributed tracing

---

**Start here: [DATADOG_QUICK_REFERENCE.md](./DATADOG_QUICK_REFERENCE.md)**

**Agent AN - Complete Datadog Test Telemetry System**
