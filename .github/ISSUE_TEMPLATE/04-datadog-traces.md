---
name: Fix Datadog trace submission
about: ddtrace test runs but traces don't reach Datadog Agent
title: 'Datadog: Traces not appearing despite ddtrace running successfully'
labels: monitoring, bug
assignees: ''
---

## Problem

The `ddtrace` test executes successfully and reports "active", but the Datadog Agent shows "No traces received in the previous minute."

## Current Behavior

```bash
# Test runs fine
ddtrace-run python demos/simple-datadog-test.py
✓ ddtrace is active
✓ Function executes
✓ Reports success

# But agent shows
datadog-agent status
  Receiver (previous minute): No traces received
```

## Configuration

**Datadog Agent**:
- Status: Running
- APM Port: 8136 (non-standard, usually 8126)
- PID: 18045
- Uptime: 5+ days

**ddtrace**:
- Version: 3.18.1
- Installed: demos/venv
- Configuration: DD_TRACE_AGENT_PORT=8136

## What We've Tried

1. Default port 8126 - No traces
2. Actual port 8136 - No traces
3. Verified agent is running - Yes
4. Verified ddtrace is active - Yes

## Possible Causes

1. **Agent APM not enabled for receiving**
   - Agent may need `apm_config.enabled: true`
   - Check `/opt/datadog-agent/etc/datadog.yaml`

2. **Network/firewall blocking localhost**
   - Traces sent to 127.0.0.1:8136
   - May need to allow in firewall

3. **ddtrace configuration**
   - May need explicit DD_AGENT_HOST=localhost
   - May need DD_TRACE_ENABLED=true

4. **Agent endpoint mismatch**
   - Test sending to HTTP endpoint
   - Agent expecting different protocol

## Debug Steps

### Check Agent Config

```bash
grep -A 10 "apm_config" /opt/datadog-agent/etc/datadog.yaml
```

Should show:
```yaml
apm_config:
  enabled: true
  apm_non_local_traffic: false
```

### Check Port is Actually Open

```bash
lsof -i :8136
# Should show datadog-agent listening
```

### Enable ddtrace Debug Logging

```bash
DD_TRACE_DEBUG=true ddtrace-run python demos/simple-datadog-test.py
```

This will show exactly what ddtrace is trying to send and where.

## Expected Behavior

After running test:
```bash
datadog-agent status
```

Should show:
```
Receiver (previous minute)
==========================
  From python (5.X):
    Traces received: 1
    Spans received: 2
```

## Acceptance Criteria

- [ ] Run `ddtrace-run python demos/simple-datadog-test.py`
- [ ] Agent shows "Traces received: X" (X > 0)
- [ ] Traces appear in Datadog UI at https://app.datadoghq.com/apm/traces
- [ ] Configuration documented in demos/DATADOG_SETUP.md

## Resources

- [Datadog CrewAI Integration](https://docs.datadoghq.com/integrations/crewai/)
- [ddtrace Configuration](https://ddtrace.readthedocs.io/)
- Local agent config: `/opt/datadog-agent/etc/datadog.yaml`

## Priority

Medium - Demo code is correct, but can't verify it works end-to-end.

