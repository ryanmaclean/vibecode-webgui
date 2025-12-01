# VibeCode Datadog Integration - Quick Reference Card

**Print this or bookmark for easy access during demos**

---

## One-Minute Setup

```bash
export DD_API_KEY="your_32_char_key"
export DD_SITE="datadoghq.com"
open BasicVibeCode.app
```

Then visit: https://app.datadoghq.com/infrastructure

---

## Essential Dashboard Links

| Purpose | Link |
|---------|------|
| Infrastructure | https://app.datadoghq.com/infrastructure |
| Metrics | https://app.datadoghq.com/metric/explorer |
| Logs | https://app.datadoghq.com/logs |
| APM Traces | https://app.datadoghq.com/apm/traces |
| Monitors | https://app.datadoghq.com/monitors |
| API Keys | https://app.datadoghq.com/organization/settings/api-keys |

---

## Key Metrics at a Glance

| Metric | Query | Expected |
|--------|-------|----------|
| CPU Usage | `avg:system.cpu.user{host:vibecode*}` | 5-20% |
| Memory | `avg:system.mem.used{host:vibecode*}` | 100-500MB |
| Network In | `system.net.bytes_rcvd{host:vibecode*}` | Increasing |
| Network Out | `system.net.bytes_sent{host:vibecode*}` | Increasing |
| Processes | `system.processes{host:vibecode*}` | 30-80 |
| Disk Usage | `avg:system.disk.in_use{host:vibecode*}` | < 70% |

---

## VM Identification

**BasicVibeCode**
- Hostname: `basicvibecode` or `vibecode-vm-1`
- Query filter: `host:basicvibecode*`

**LiquidGlass**
- Hostname: `liquidglass` or `vibecode-vm-2`
- Query filter: `host:liquidglass*`

**All VMs**
- Query filter: `host:vibecode*`

---

## Critical Commands

### Launch VMs
```bash
open BasicVibeCode.app
open LiquidGlassVibeCode.app
```

### Check Environment
```bash
echo $DD_API_KEY
echo $DD_SITE
```

### Verify Connectivity (in VM via SSH)
```bash
cat /proc/cmdline | grep dd_api_key
ps aux | grep datadog-agent
sudo systemctl status datadog-agent
sudo tail -20 /var/log/datadog-agent/agent.log
```

### Network Test (in VM)
```bash
curl -I https://api.datadoghq.com/
nslookup api.datadoghq.com
```

---

## Log Queries (Copy & Paste)

### Find All VibeCode Logs
```
host:vibecode* OR host:basicvibecode* OR host:liquidglass*
```

### Errors Only
```
host:vibecode* status:error
```

### By Service
```
service:vibecode-vm
```

### By Source
```
source:kernel host:vibecode*
```

### Recent Activity (last 5 min)
```
host:vibecode* @timestamp:[NOW-5m TO NOW]
```

---

## Tag Conventions

**Service Tags**:
- `service:vibecode-vm` - All VibeCode VMs
- `service:datadog-agent` - Agent itself
- `service:bun` - Bun runtime
- `service:openvscode` - VS Code server

**Environment Tags**:
- `env:demo` - Demo environment
- `env:production` - Production
- `env:test` - Testing

**Region Tags**:
- `region:us` - US Datadog site
- `region:eu` - EU Datadog site

---

## Success Indicators

| Milestone | Timeline | Check |
|-----------|----------|-------|
| VM Boots | 90 seconds | Window appears |
| Network Up | 2 minutes | IP assigned |
| Agent Running | 2.5 minutes | Process visible |
| Data Flows | 3 minutes | Infrastructure view |
| Metrics Stable | 5 minutes | Multiple data points |
| Complete Picture | 10 minutes | All systems reporting |

---

## Common Issues & Fixes

| Issue | Fix | Verify |
|-------|-----|--------|
| No hosts | Wait 5min or restart | Infrastructure view |
| No metrics | Restart agent | `systemctl restart datadog-agent` |
| API error | Check key | `echo $DD_API_KEY \| wc -c` = 33 |
| Network error | Check DNS | `curl -I https://api.datadoghq.com/` |
| Logs missing | Check permissions | `sudo tail /var/log/datadog-agent/agent.log` |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Simulator | Cmd+O |
| Kill Simulator | Cmd+Q |
| Refresh Dashboard | Cmd+R or F5 |
| Datadog Help | `/help` in query |
| New Tab | Cmd+T |
| Full Screen | Control+Cmd+F |

---

## Documentation Index

| Document | Purpose | Time |
|----------|---------|------|
| DATADOG-INTEGRATION-DEMO.md | Full overview | 5 min read |
| DATADOG-TUTORIAL.md | Step-by-step | 15 min walkthrough |
| DATADOG-VERIFICATION-CHECKLIST.md | Comprehensive testing | 30 min |
| DATADOG-QUERIES.md | Query examples | Reference |
| DATADOG-TROUBLESHOOTING.md | Problem solving | As needed |
| datadog-vibecode-dashboard.json | Custom dashboard | Import & use |

---

## API Key Troubleshooting

**Key Format**:
- Length: 32 hexadecimal characters
- Example: `abc123def456abc123def456abc12345`
- Check: `echo $DD_API_KEY | grep -E '^[a-f0-9]{32}$'`

**Where to Find**:
- URL: https://app.datadoghq.com/organization/settings/api-keys
- Generate: Click "New API Key"
- Copy: Full 32-character string

**Security Note**:
- Never commit to git
- Never share publicly
- Rotate regularly
- Use separate keys for different environments

---

## Metric Ranges (Normal Operating)

| Metric | Min | Normal | Max | Warning |
|--------|-----|--------|-----|---------|
| CPU % | 0 | 10-30 | 100 | > 80% |
| Memory MB | 100 | 200-500 | 1000 | > 80% |
| Network Mbps | 0 | 1-10 | 100 | > 80% |
| Disk % | 0 | 20-50 | 100 | > 90% |
| Load Avg | 0 | 1-2 | 4+ | > 3 |

---

## Datadog UI Navigation

1. **Infrastructure**
   - Click host → drill into metrics
   - Shows all connected systems

2. **Metrics Explorer**
   - Search metric name
   - Filter by host/tag
   - View trends

3. **Log Explorer**
   - Search by keyword
   - Filter by host/service/level
   - Export for analysis

4. **Dashboards**
   - Click gear icon
   - Import from JSON
   - Add custom widgets

---

## Data Collection Intervals

| Component | Interval | Buffer |
|-----------|----------|--------|
| Metrics | 10 seconds | 30 seconds |
| Logs | Real-time | 10 seconds |
| Traces | Continuous | None |
| Processes | 30 seconds | None |

**Latency**: 2-5 seconds typical end-to-end

---

## Before Demo Checklist

- [ ] DD_API_KEY set and 32 chars
- [ ] Apps downloaded and ready
- [ ] Datadog account accessible
- [ ] Internet connection stable
- [ ] No VMs running yet
- [ ] Simulator in good state
- [ ] Terminal ready
- [ ] Documentation at hand

---

## During Demo Checklist

- [ ] VMs launched at appropriate time
- [ ] Mention 2-3 min wait for data
- [ ] Point to Infrastructure view
- [ ] Show 2-3 key metrics
- [ ] Highlight log entries
- [ ] Explain tag filtering
- [ ] Mention custom dashboards
- [ ] Show verification checklist

---

## After Demo Checklist

- [ ] Shut down VMs cleanly
- [ ] Collect feedback
- [ ] Note any issues
- [ ] Update this reference
- [ ] Review metrics trends
- [ ] Archive screenshots
- [ ] Document lessons learned

---

## Quick Query Builder

### Template: System Health
```
avg:system.cpu.user{host:vibecode*}
avg:system.mem.used{host:vibecode*}
sum:system.net.bytes_rcvd{host:vibecode*}.as_rate()
```

### Template: Error Monitoring
```
status:error service:vibecode-vm
@http.status_code:>=400 service:openvscode
error AND host:vibecode*
```

### Template: Performance
```
@duration:>1000000000 service:vibecode-vm
@db.duration:>500000 service:*
@error.count:>0
```

### Template: Capacity Planning
```
max:system.mem.used{host:vibecode*}
max:system.disk.in_use{host:vibecode*}
avg:system.processes{host:vibecode*}
```

---

## Support Resources

| Resource | URL |
|----------|-----|
| Datadog Docs | https://docs.datadoghq.com/ |
| Agent Setup | https://docs.datadoghq.com/agent/ |
| APM Guide | https://docs.datadoghq.com/tracing/ |
| Log Collection | https://docs.datadoghq.com/logs/ |
| Status Page | https://status.datadoghq.com/ |

---

## Emergency Contacts

**For Datadog Issues**:
- Support: https://www.datadoghq.com/support/
- Status: https://status.datadoghq.com/
- Chat: In-app chat in Datadog UI

**For VibeCode Issues**:
- Repo: /Users/ryan.maclean/vibecode-webgui/azure
- Troubleshooting: docs/guides/DATADOG-TROUBLESHOOTING.md

---

**Keep this card for:**
- Quick reference during live demos
- Onboarding new team members
- Troubleshooting in production
- Training new operators

**Laminate or Print for:**
- Office wall
- Developer workspace
- Demo kit
- Emergency reference

---

**Quick Ref Version**: 1.0
**Last Updated**: 2025-11-25
**Print Size**: Fits on 2 pages
