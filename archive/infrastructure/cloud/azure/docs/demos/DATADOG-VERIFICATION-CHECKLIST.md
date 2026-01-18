# Datadog Integration Verification Checklist

**Purpose**: Comprehensive testing checklist for Datadog integration across all VibeCode VMs
**Target**: Production-ready validation
**Duration**: 15-30 minutes depending on thoroughness

---

## Phase 1: Pre-Launch Verification (5 minutes)

### Environment Setup
- [ ] DD_API_KEY environment variable is set
  - Command: `echo $DD_API_KEY | wc -c` (should be 33 for 32 hex + newline)
  - Verify: `echo $DD_API_KEY | grep -E '^[a-f0-9]{32}$'`

- [ ] DD_SITE environment variable configured
  - Command: `echo $DD_SITE`
  - Expected: `datadoghq.com` or `datadoghq.eu`

- [ ] Datadog account access verified
  - Navigate to: https://app.datadoghq.com/
  - Expected: Successfully logged in, dashboard loads

- [ ] API key has necessary permissions
  - Go to: API Keys in Datadog
  - Verify: Marked as "Active"
  - Verify: Created for this integration

### Application Readiness
- [ ] VibeCode apps downloaded and present
  - Command: `ls -la /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/*.app`
  - Expected: BasicVibeCode.app and LiquidGlassVibeCode.app listed

- [ ] Apps have execute permissions
  - Command: `test -x /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/MacOS/* && echo "OK"`

- [ ] Simulator/Virtualization framework available
  - Command: `system_profiler SPSoftwareDataType | grep -i simulator`
  - Expected: Version info displayed

- [ ] No VMs currently running
  - Command: `ps aux | grep -i simulator | grep -v grep`
  - Expected: No output (empty)

### Build Artifacts
- [ ] Initramfs contains Datadog agent
  - This is built into the VM images
  - Verification: Will check after VM boots

- [ ] Datadog APK/package repository configured
  - Verification: Will check after VM boots

---

## Phase 2: VM Launch (3 minutes)

### Launch Process
- [ ] BasicVibeCode.app launched successfully
  - Command: `open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app`
  - Expected: Simulator window opens

- [ ] No launch errors in console
  - Check: Xcode console output
  - Expected: Standard boot sequence, no fatal errors

- [ ] VM window appears within 5 seconds
  - Visual: Simulator window is visible

- [ ] Boot messages visible in console
  - Expected: Linux boot sequence displayed

- [ ] VM reaches login prompt
  - Timeline: Within 90 seconds
  - Visual: Login prompt visible in simulator window

### Network Initialization
- [ ] Network interface comes up
  - Command (in VM): `ip link show`
  - Expected: At least one interface (eth0, eth1, or tap)

- [ ] DHCP assigns IP address
  - Command (in VM): `ip addr show`
  - Expected: IP address in 192.168.x.x range (or configured network)

- [ ] Connectivity verified with ping
  - Command (in VM): `ping -c 4 8.8.8.8`
  - Expected: 4 packets sent, replies received

---

## Phase 3: Datadog Agent Verification (5 minutes)

### Agent Process
- [ ] Datadog agent process running
  - Command (in VM): `ps aux | grep [d]atadog-agent`
  - Expected: Agent process visible with PID

- [ ] Agent started without errors
  - Command (in VM): `sudo systemctl status datadog-agent`
  - Expected: Status shows "active (running)"

- [ ] Agent initialization logged
  - Command (in VM): `sudo tail -20 /var/log/datadog-agent/agent.log`
  - Expected: Contains "Agent started", "Configuration loaded", no ERROR lines

### API Key Verification
- [ ] API key present in kernel cmdline
  - Command (in VM): `cat /proc/cmdline | grep dd_api_key`
  - Expected: Output contains `dd_api_key=<32_char_hex>`

- [ ] API key correct length
  - Command (in VM): `cat /proc/cmdline | grep -oP 'dd_api_key=\K[^ ]+' | wc -c`
  - Expected: 33 (32 hex characters + newline)

- [ ] Agent read API key from cmdline
  - Command (in VM): `sudo grep "DD_API_KEY" /var/log/datadog-agent/agent.log`
  - Expected: Line showing key was loaded (or partial key obfuscated)

### Network Connectivity
- [ ] DNS resolution working
  - Command (in VM): `nslookup api.datadoghq.com`
  - Expected: Returns valid IP address

- [ ] HTTPS connectivity to Datadog
  - Command (in VM): `curl -I https://api.datadoghq.com/`
  - Expected: HTTP 200 OK (or 403 if key invalid, but connection works)

- [ ] No firewall blocking outbound
  - Command (in VM): `curl -m 5 https://api.datadoghq.com/validate 2>&1`
  - Expected: Response received (not timeout)

### Agent Configuration
- [ ] Datadog agent config file exists
  - Command (in VM): `sudo cat /etc/datadog-agent/datadog.yaml | head -20`
  - Expected: YAML configuration visible

- [ ] API key configured in agent
  - Command (in VM): `sudo cat /etc/datadog-agent/datadog.yaml | grep -i api_key`
  - Expected: Either shows API key or references environment variable

- [ ] Collection interval configured
  - Command (in VM): `sudo cat /etc/datadog-agent/datadog.yaml | grep -i interval`
  - Expected: Shows metric collection interval (e.g., 10s)

---

## Phase 4: Initial Data Flow (5 minutes)

### Host Appearance
- [ ] VM appears in Infrastructure view
  - URL: https://app.datadoghq.com/infrastructure
  - Timeline: 2-3 minutes after agent starts
  - Expected: New host visible in list

- [ ] Hostname correctly set
  - Navigate to: Infrastructure → Click new host
  - Expected: Hostname shown (e.g., "basicvibecode", "vibecode-vm")

- [ ] Host status shows "OK"
  - Expected: Green status indicator

### Basic Metrics Appearing
- [ ] CPU metric visible
  - URL: https://app.datadoghq.com/metric/explorer
  - Search: `system.cpu.user`
  - Filter: `host:vibecode*`
  - Expected: Graph with data points

- [ ] Memory metric visible
  - Search: `system.mem.used`
  - Expected: Memory usage graph

- [ ] Network metric visible
  - Search: `system.net.bytes_rcvd`
  - Expected: Network traffic graph

- [ ] Metrics have data points
  - Expected: At least 3-5 data points in last 5 minutes

### Logs Appearing
- [ ] Logs visible in Log Explorer
  - URL: https://app.datadoghq.com/logs
  - Filter: `host:vibecode*`
  - Expected: Multiple log entries

- [ ] Recent logs shown
  - Expected: Timestamps within last 5 minutes

- [ ] Log sources identified
  - Expected: Various sources (kernel, app, syslog)

---

## Phase 5: Comprehensive Metrics (10 minutes)

### System Metrics Complete
- [ ] CPU user time: `avg:system.cpu.user{host:vibecode*}`
  - Range: 0-100%
  - Pattern: Should vary based on workload

- [ ] CPU system time: `avg:system.cpu.system{host:vibecode*}`
  - Range: 0-100%
  - Expected: Lower than user time

- [ ] Memory used: `avg:system.mem.used{host:vibecode*}`
  - Range: > 0
  - Unit: Bytes

- [ ] Memory free: `avg:system.mem.free{host:vibecode*}`
  - Range: > 0
  - Unit: Bytes

- [ ] Load average: `avg:system.load.1{host:vibecode*}`
  - Range: 0-4 (depends on core count)
  - Indicator: System busyness

### Network Metrics Complete
- [ ] Bytes received: `sum:system.net.bytes_rcvd{host:vibecode*}`
  - Expected: Increasing over time

- [ ] Bytes sent: `sum:system.net.bytes_sent{host:vibecode*}`
  - Expected: Increasing over time

- [ ] Packets received: `sum:system.net.packets_in{host:vibecode*}`
  - Expected: Increasing

- [ ] Packets sent: `sum:system.net.packets_out{host:vibecode*}`
  - Expected: Increasing

### Disk Metrics Complete
- [ ] Disk reads: `sum:system.disk.reads{host:vibecode*}`
  - Expected: Present and readable

- [ ] Disk writes: `sum:system.disk.writes{host:vibecode*}`
  - Expected: Present and readable

- [ ] Disk utilization: `avg:system.disk.in_use{host:vibecode*}`
  - Range: 0-100%
  - Expected: < 70% for healthy system

### Process Metrics
- [ ] Process count: `system.processes{host:vibecode*}`
  - Expected: Between 20-100 processes

- [ ] Key processes identified
  - Expected: datadog-agent, kernel, init, bash

---

## Phase 6: Log Analysis (5 minutes)

### Log Collection Verification
- [ ] Kernel logs present
  - Filter: `host:vibecode* source:kernel`
  - Expected: At least one kernel log

- [ ] Application logs present
  - Filter: `host:vibecode* service:*`
  - Expected: Application-specific logs

- [ ] Syslog entries present
  - Filter: `host:vibecode* source:syslog`
  - Expected: Syslog messages

- [ ] Agent logs present
  - Filter: `host:vibecode* service:datadog-agent`
  - Expected: Agent activity logs

### Log Quality
- [ ] Log timestamps are recent
  - Expected: Within last 5-10 minutes

- [ ] Log levels properly categorized
  - Expected: Mix of info, debug, error levels

- [ ] No error flood
  - Expected: < 5 ERROR messages per minute

- [ ] Message content readable
  - Expected: Clear, parseable log messages

### Log Search Functionality
- [ ] Search by hostname works
  - Filter: `host:basicvibecode*`
  - Expected: Returns logs for that host

- [ ] Search by service works
  - Filter: `service:vibecode-vm`
  - Expected: Returns service-specific logs

- [ ] Search by level works
  - Filter: `status:error`
  - Expected: Returns only error logs

- [ ] Complex query works
  - Filter: `host:vibecode* status:error`
  - Expected: Filtered results

---

## Phase 7: Advanced Features (Optional, 5 minutes)

### Custom Metrics (if configured)
- [ ] Custom metric appearing
  - Search: `vibecode.*`
  - Expected: Custom metrics visible

- [ ] Metric values reasonable
  - Expected: Metrics have realistic values

### Service Tags
- [ ] Service tag present
  - Expected: `service:vibecode-vm` tag on all metrics

- [ ] Environment tag present
  - Expected: `env:demo` or `env:production`

- [ ] Custom tags working
  - Expected: Any configured tags appear

### Dashboard Creation
- [ ] Can create new widget
  - Action: Click "+" in dashboard
  - Expected: Widget options appear

- [ ] Can create metric widget
  - Action: Select "Timeseries"
  - Expected: Query editor opens

- [ ] Can save custom dashboard
  - Action: Enter name and save
  - Expected: Dashboard saved and accessible

### Alert Configuration
- [ ] Can create metric alert
  - URL: https://app.datadoghq.com/monitors/create
  - Expected: Monitor form loads

- [ ] Alert conditions understood
  - Expected: Can set thresholds

- [ ] Alert notification working
  - Action: Create test alert
  - Expected: Alert triggers appropriately

---

## Phase 8: Multi-VM Verification (Optional, 5 minutes)

### Launch Second VM
- [ ] LiquidGlass.app launches successfully
  - Command: `open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app`

- [ ] Second VM appears in Infrastructure
  - Expected: Both VMs visible in list

### Multiple VM Metrics
- [ ] Both VMs report CPU
  - Query: `avg:system.cpu.user{host:vibecode*} by {host}`
  - Expected: Two separate lines in graph

- [ ] Both VMs report memory
  - Query: `avg:system.mem.used{host:vibecode*} by {host}`
  - Expected: Two separate lines

- [ ] Both VMs report network
  - Query: `sum:system.net.bytes_rcvd{host:vibecode*} by {host}`
  - Expected: Two separate values

### Fleet-Wide Queries
- [ ] Aggregate CPU across fleet
  - Query: `sum:system.cpu.user{host:vibecode*}`
  - Expected: Combined value from all VMs

- [ ] Fleet health dashboard
  - Expected: Can create dashboard with fleet-level metrics

---

## Phase 9: Performance Validation (5 minutes)

### Metric Accuracy
- [ ] Metrics within expected ranges
  - CPU: 0-100%
  - Memory: Reported total ≈ system total
  - Network: Non-decreasing counters

- [ ] Metric granularity sufficient
  - Expected: At least one data point per 30 seconds

- [ ] Metric consistency
  - Expected: Same metric from multiple queries yields same value

### Data Latency
- [ ] Data appears quickly
  - Expected: < 2 minutes from VM start to Datadog

- [ ] Ongoing data latency acceptable
  - Expected: < 1 minute delay for new metrics

- [ ] Log latency acceptable
  - Expected: < 30 seconds for logs to appear

### Storage Efficiency
- [ ] Data retention appropriate
  - Expected: Can query at least 7 days of data

- [ ] No duplicate metrics
  - Expected: Each metric appears once per host

---

## Phase 10: Cleanup and Reporting (5 minutes)

### Shutdown Verification
- [ ] Can cleanly shutdown VMs
  - Action: Kill simulator windows
  - Expected: No hung processes

- [ ] Agent sends final data
  - Check: Last logs appear in Datadog
  - Expected: Recent shutdown messages

- [ ] Historical data preserved
  - Action: Wait 30 seconds, query Datadog
  - Expected: VM data still visible in history

### Documentation
- [ ] Verification results recorded
  - File: docs/demos/VERIFICATION-RESULTS.md
  - Include: Date, time, results, any issues

- [ ] Issues documented
  - Expected: Clear description of any failures

- [ ] Success metrics met
  - Expected: 90%+ checklist items passing

---

## Quick Pass/Fail Summary

### PASS Criteria (All must pass)
- [x] VM launches without errors
- [x] Host appears in Infrastructure within 5 minutes
- [x] At least 5 system metrics visible
- [x] Logs appearing in Log Explorer
- [x] No authentication errors
- [x] Network connectivity verified
- [x] Agent running and healthy

### FAIL Criteria (If any occurs)
- [ ] VM cannot launch
- [ ] No host appears after 10 minutes
- [ ] Zero metrics after 10 minutes
- [ ] API key authentication fails
- [ ] Persistent network errors
- [ ] Agent crashes on startup

### CONDITIONAL (Depends on configuration)
- [ ] Custom metrics appearing (if configured)
- [ ] APM traces visible (if enabled)
- [ ] Multiple VMs working (if testing fleet)

---

## Result Documentation

**Date Tested**: ___________________
**Tester**: ___________________
**Test Environment**: macOS, Apple Silicon
**Datadog Site**: datadoghq.com / datadoghq.eu

**Overall Result**: PASS / FAIL

**Passing Checks**: _____ / 60+ (estimate)

**Failed Checks**:
- [ ] (List any failures here)

**Issues Encountered**:
1. ___________________
2. ___________________

**Resolutions Applied**:
1. ___________________
2. ___________________

**Notes**:
___________________
___________________

**Recommended Actions**:
1. ___________________
2. ___________________

---

## Related Documentation

- docs/demos/DATADOG-INTEGRATION-DEMO.md - Overview
- docs/demos/DATADOG-TUTORIAL.md - Step-by-step guide
- docs/guides/DATADOG-TROUBLESHOOTING.md - Issue resolution
- docs/demos/DATADOG-QUERIES.md - Useful queries

---

**Checklist Version**: 1.0
**Last Updated**: 2025-11-25
**Approval**: Demo Team
