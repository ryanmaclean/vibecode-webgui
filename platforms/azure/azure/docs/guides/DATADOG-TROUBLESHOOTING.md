# VibeCode Datadog Integration - Troubleshooting Guide

**Purpose**: Resolve common issues with Datadog integration
**Scope**: macOS host, Linux VMs, Datadog platform
**Target Audience**: Developers, Demo Teams, Operators

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [No Data Appearing in Datadog](#no-data-appearing)
3. [Agent Connection Issues](#agent-connection-issues)
4. [Metrics Not Visible](#metrics-not-visible)
5. [Logs Not Appearing](#logs-not-appearing)
6. [High Latency or Delays](#high-latency)
7. [API Key Problems](#api-key-problems)
8. [Network Connectivity](#network-connectivity)
9. [Performance Issues](#performance-issues)
10. [Multi-VM Specific Issues](#multi-vm-issues)

---

## Quick Diagnostics

### Step 1: Check Environment Setup

```bash
# Verify API key is set
echo $DD_API_KEY
# Expected: 32-character hex string

# Verify site configuration
echo $DD_SITE
# Expected: datadoghq.com or datadoghq.eu

# Verify both are set (should show 2 variables)
env | grep DD_ | wc -l
# Expected: 2
```

### Step 2: Verify Datadog Platform Access

```bash
# Test connectivity to Datadog
curl -I https://api.datadoghq.com/

# Expected output:
# HTTP/1.1 200 OK
# Server: gunicorn
# Content-Type: application/json
```

### Step 3: Check VM Status

```bash
# List running processes (looking for simulator/VM)
ps aux | grep -i "simulator\|virtua" | grep -v grep

# Expected: Simulator process should be running
```

### Step 4: Verify Agent in VM

```bash
# If you can SSH to VM
ssh user@<vm_ip> "ps aux | grep [d]atadog-agent"

# Expected: Agent process visible
# If SSH fails, skip to Step 5
```

### Step 5: Check Datadog UI

```
https://app.datadoghq.com/infrastructure
```

**Expected After 3 minutes:**
- New host appears in list
- Host status shows "OK"
- Initial metrics visible (CPU, memory)

---

## No Data Appearing

**Symptom**: VM has been running for 5+ minutes, but nothing appears in Datadog

### Diagnostic Checklist

- [ ] API key is valid 32-hex character string
- [ ] `DD_API_KEY` environment variable is actually set
- [ ] Datadog account is accessible (login works)
- [ ] VM is actually booted and running
- [ ] VM has network connectivity (can reach internet)
- [ ] Datadog agent process is running in VM
- [ ] No error messages in agent logs
- [ ] Datadog service status is OK (not down for maintenance)

### Most Common Causes

#### Cause 1: API Key Not Set in Environment

**Symptoms:**
- Agent starts but shows "missing authentication"
- No host appears in Infrastructure view

**Fix:**

```bash
# Set the API key BEFORE launching VMs
export DD_API_KEY="your_32_char_key"

# Verify it's set
echo $DD_API_KEY

# Then launch the VM
open BasicVibeCode.app
```

**Why**: The app reads environment variables when it launches, not when VM boots

#### Cause 2: API Key Format Invalid

**Symptoms:**
- Host appears but shows "authentication error"
- Agent logs show "unauthorized"

**Verify:**

```bash
# Check exact format
echo $DD_API_KEY | grep -E '^[a-f0-9]{32}$'

# Should output the key if format is correct
# If no output, format is wrong

# Check length
echo $DD_API_KEY | wc -c
# Should be exactly 33 (32 chars + newline)
```

**Fix**: Get fresh API key from Datadog UI:

```
https://app.datadoghq.com/organization/settings/api-keys
```

#### Cause 3: Wrong Datadog Site

**Symptoms:**
- Agent connects but "location not found" errors
- EU data stored in US account or vice versa

**Fix:**

```bash
# Check site setting
echo $DD_SITE

# If using EU site
export DD_SITE="datadoghq.eu"

# Restart VM
```

#### Cause 4: VM Network Not Working

**Symptoms:**
- Agent runs but shows "connection timeout"
- Can't ping external hosts

**Debug:**

```bash
# SSH into VM
ssh user@<vm_ip>

# Check IP address
ip addr show
# Should show 192.168.x.x address

# Test connectivity
ping -c 4 8.8.8.8
# Should get responses

# Test DNS
nslookup api.datadoghq.com
# Should resolve to IP

# Test HTTPS connectivity
curl -I https://api.datadoghq.com/
# Should get HTTP 200
```

**Fix if network is broken:**

```bash
# Inside VM, restart networking
sudo ip link set eth0 up
sudo dhclient eth0

# Or restart entire VM
sudo reboot
```

#### Cause 5: Datadog Agent Not Running

**Symptoms:**
- VM is up but "no data" in Datadog after 10 minutes
- Agent process not visible in `ps aux`

**Check Agent Status:**

```bash
# SSH into VM
ssh user@<vm_ip>

# Check if agent is running
sudo systemctl status datadog-agent

# Check agent logs for errors
sudo tail -50 /var/log/datadog-agent/agent.log
```

**Common Agent Error Messages:**

```
ERROR: Unable to read /proc/cmdline
→ Fix: Verify API key is in /proc/cmdline

ERROR: Failed to authenticate
→ Fix: Check API key format and validity

ERROR: Connection timeout
→ Fix: Verify network connectivity

ERROR: Configuration parse failed
→ Fix: Check /etc/datadog-agent/datadog.yaml for syntax errors
```

**Restart Agent:**

```bash
# SSH into VM
ssh user@<vm_ip>

# Restart the agent
sudo systemctl restart datadog-agent

# Verify it's running
sudo systemctl status datadog-agent

# Watch logs in real-time
sudo tail -f /var/log/datadog-agent/agent.log
```

#### Cause 6: Datadog Service Down

**Check Status:**

```
https://status.datadoghq.com/
```

**If Datadog is down:**
- Wait for service restoration
- Check status page for ETA
- Retry after 30 minutes

---

## Agent Connection Issues

**Symptom**: Agent process runs but fails to connect to Datadog

### Symptom 1: "Connection Refused"

```
ERROR: Connection refused to api.datadoghq.com:443
```

**Causes and Fixes:**

| Cause | Check | Fix |
|-------|-------|-----|
| Firewall blocking HTTPS | `curl -I https://api.datadoghq.com/` | Check firewall rules, allow port 443 |
| Wrong site domain | `echo $DD_SITE` | Set correct site (datadoghq.com or datadoghq.eu) |
| Network down | `ping 8.8.8.8` | Check network setup, restart interfaces |
| DNS not working | `nslookup api.datadoghq.com` | Check /etc/resolv.conf, set DNS (8.8.8.8) |

### Symptom 2: "Connection Timeout"

```
ERROR: Timeout connecting to api.datadoghq.com
```

**Causes and Fixes:**

```bash
# Check if there's any connectivity
ping -c 4 8.8.8.8
# If this fails, network is broken

# Check if specifically datadoghq is unreachable
timeout 5 telnet api.datadoghq.com 443
# If timeout, either DNS or network path is blocked

# Test from different host to rule out VM-specific issue
# From macOS host:
curl -I https://api.datadoghq.com/
# Should work if your network is OK
```

**Solutions:**

```bash
# Inside VM, try alternate DNS
sudo bash -c 'echo "nameserver 8.8.8.8" > /etc/resolv.conf'

# Try pinging Datadog by IP (if DNS resolution fails)
ping -c 4 52.18.76.19  # Example Datadog IP
```

### Symptom 3: "Authentication Failed"

```
ERROR: Failed to authenticate API key
```

**Causes:**

- Invalid API key format
- Wrong API key (for different Datadog account)
- API key disabled in Datadog UI
- API key rotated (old key still in use)

**Fix:**

```bash
# Verify API key format
echo $DD_API_KEY | grep -E '^[a-f0-9]{32}$'

# If invalid, get new key from:
https://app.datadoghq.com/organization/settings/api-keys

# Update environment and restart VM
export DD_API_KEY="new_key_here"
# Kill and relaunch VM
```

---

## Metrics Not Visible

**Symptom**: Host appears in Infrastructure, but metrics don't show data

### Metric Appears Empty

**Steps to Debug:**

```bash
# SSH to VM
ssh user@<vm_ip>

# Check what metrics agent thinks it's collecting
sudo grep "metric" /var/log/datadog-agent/agent.log | head -20

# Manually trigger a metric collection
sudo systemctl restart datadog-agent

# Wait 30 seconds, then check logs for "metrics sent"
sudo tail -30 /var/log/datadog-agent/agent.log
```

**Common Issues:**

1. **Agent not collecting metrics**
   - Problem: Collection disabled in config
   - Fix: Check `/etc/datadog-agent/datadog.yaml`
   - Solution: Ensure `enable_metadata_collection: true`

2. **Metrics sent but Datadog not storing**
   - Problem: API key valid but metrics rejected
   - Fix: Check logs for "403 Forbidden"
   - Solution: May be rate limiting, contact Datadog support

3. **Only some metrics collected**
   - Problem: Partial metric collection
   - Fix: Check which checks are enabled/disabled
   - Solution: Review `/etc/datadog-agent/conf.d/` directory

### Specific Metric Missing

**Example: CPU metric not showing**

```bash
# SSH to VM
ssh user@<vm_ip>

# Check if metric is being collected
sudo grep -i "system.cpu" /var/log/datadog-agent/agent.log

# Manually check CPU availability
cat /proc/stat
# Should show cpu cores

# Try forcing metric collection
sudo datadog-agent check system_metrics
```

---

## Logs Not Appearing

**Symptom**: Agent running, metrics flowing, but no logs in Datadog

### Check Log Collection Config

```bash
# SSH to VM
ssh user@<vm_ip>

# Check if logs are being collected
ls -la /etc/datadog-agent/conf.d/*logs*

# Check main config
grep -i "logs_enabled\|log_config_path" /etc/datadog-agent/datadog.yaml
```

### Check Log Sources

```bash
# SSH to VM
ssh user@<vm_ip>

# Check syslog exists and is readable
sudo tail -20 /var/log/syslog
# Should show recent system events

# Check auth log
sudo tail -20 /var/log/auth.log

# Check if any logs are being written
ls -lart /var/log/*.log | tail -10
# Check timestamps - should be recent
```

### Enable Log Collection

```bash
# SSH to VM
ssh user@<vm_ip>

# Edit main config
sudo nano /etc/datadog-agent/datadog.yaml

# Find or add:
logs_enabled: true

# Find or add service name
service: vibecode-vm

# Save and restart
sudo systemctl restart datadog-agent
```

### Check Agent has Log Read Permissions

```bash
# SSH to VM
ssh user@<vm_ip>

# Check log file permissions
ls -l /var/log/syslog

# Datadog agent runs as dd-agent user
# Needs read access to log files
sudo usermod -a -G adm dd-agent
sudo usermod -a -G syslog dd-agent

# Restart agent
sudo systemctl restart datadog-agent
```

### Verify Logs Are Being Sent

```bash
# SSH to VM
ssh user@<vm_ip>

# Check agent logs for submission confirmation
sudo grep "logs sent\|log submission" /var/log/datadog-agent/agent.log

# If nothing, check for errors
sudo grep -i "error\|failed" /var/log/datadog-agent/agent.log | grep -i log
```

---

## High Latency or Delays

**Symptom**: Data appears in Datadog but with significant delay (> 5 minutes)

### Causes of High Latency

#### 1. Network Latency

**Check:**

```bash
# From host machine
mtr -c 100 api.datadoghq.com
# Look for > 100ms latency (red flag)

# Or simpler:
ping -c 10 api.datadoghq.com | tail -1
# Check average latency
```

**Fix:**
- Check network stability (ISP, WiFi signal)
- Switch to wired Ethernet if available
- Check for congestion (speedtest.net)

#### 2. VM CPU Contention

**Check:**

```bash
# Inside VM
top -bn1 | head -20
# Look for high %CPU

# Check load average
uptime
# If load > number of CPUs, system is overloaded
```

**Fix:**
- Reduce workload on VM
- Increase VM CPU cores
- Increase VM RAM for better cache performance

#### 3. Agent Collection Interval Too Long

**Check:**

```bash
# SSH to VM
ssh user@<vm_ip>
grep "min_collection_interval\|interval" /etc/datadog-agent/datadog.yaml
```

**Fix:**

```bash
# Reduce collection interval
sudo nano /etc/datadog-agent/datadog.yaml

# Change:
# min_collection_interval: 30
# To:
min_collection_interval: 10

# Restart
sudo systemctl restart datadog-agent
```

#### 4. Large Payload Size

**Check:**

```bash
# SSH to VM
ssh user@<vm_ip>

# Check agent metrics submission
sudo tail -100 /var/log/datadog-agent/agent.log | grep -i "submit\|bytes"
```

**Fix:**
- Reduce number of custom metrics
- Increase `interval` in agent config
- Reduce number of tags per metric

---

## API Key Problems

**Symptom**: API key-related errors or authentication failures

### API Key Issues Checklist

- [ ] Key is exactly 32 hexadecimal characters
- [ ] Key contains only lowercase a-f and 0-9
- [ ] Key has no spaces or special characters
- [ ] Key is active in Datadog UI (not revoked)
- [ ] Key has full API permissions
- [ ] Key matches the Datadog site (not mixing sites)
- [ ] Key hasn't been rotated/changed
- [ ] No typos in DD_API_KEY environment variable

### Verify API Key Validity

```bash
# Method 1: Test from host
curl -H "DD-API-KEY: $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/validate"

# Expected response:
# {"valid": true}
```

### Rotate API Key

**If you suspect key compromise:**

1. Go to: https://app.datadoghq.com/organization/settings/api-keys
2. Click "Revoke" next to suspicious key
3. Generate new API key
4. Update environment:
   ```bash
   export DD_API_KEY="new_key_here"
   ```
5. Restart VMs

### Regenerate Key

```bash
# Get from Datadog UI
# https://app.datadoghq.com/organization/settings/api-keys

# Update environment
export DD_API_KEY="new_32_char_hex_key"

# Verify before launching VM
echo $DD_API_KEY | grep -E '^[a-f0-9]{32}$'
# Should output the key

# Launch VM
open BasicVibeCode.app
```

---

## Network Connectivity

**Symptom**: Network-related issues preventing data transmission

### Network Diagnostic Steps

#### Step 1: Check VM Network Interface

```bash
# SSH to VM
ssh user@<vm_ip>

# Check interfaces
ip link show
# Should show at least one interface up

# Check IP address
ip addr show
# Should show 192.168.x.x address
```

#### Step 2: Check Routing

```bash
# SSH to VM
ssh user@<vm_ip>

# Check routing table
ip route show
# Should show default route

# Example good output:
# default via 192.168.x.1 dev eth0
```

#### Step 3: Check DNS Resolution

```bash
# SSH to VM
ssh user@<vm_ip>

# Test DNS
nslookup api.datadoghq.com
# Should resolve to IP

# Check /etc/resolv.conf
cat /etc/resolv.conf
# Should have nameserver entries
```

#### Step 4: Check Firewall/Ports

```bash
# SSH to VM
ssh user@<vm_ip>

# Test HTTPS connectivity
curl -I https://api.datadoghq.com/
# Should get HTTP 200

# Test specific port
telnet api.datadoghq.com 443
# Should connect
```

### Fix Common Network Issues

**No network connectivity at all:**

```bash
# Inside VM
# Restart network interface
sudo ip link set eth0 down
sudo ip link set eth0 up

# Request new DHCP lease
sudo dhclient -r
sudo dhclient

# Verify IP
ip addr show
```

**DNS not resolving:**

```bash
# Inside VM
# Temporarily set DNS
sudo bash -c 'echo "nameserver 8.8.8.8" > /etc/resolv.conf'

# Test
nslookup api.datadoghq.com
```

**Cannot reach specific host:**

```bash
# Test with different tools
ping api.datadoghq.com
curl -I https://api.datadoghq.com/
traceroute api.datadoghq.com

# If none work, check firewall:
sudo iptables -L -n | grep -i drop
sudo firewall-cmd --list-all
```

---

## Performance Issues

**Symptom**: VM or agent consuming excessive CPU or memory

### High CPU Usage

**Agent using too much CPU:**

```bash
# SSH to VM
ssh user@<vm_ip>

# Check agent CPU
ps aux | grep [d]atadog-agent

# Should show < 5% CPU
# If > 10%, issue detected
```

**Fix high CPU:**

```bash
# Inside VM
# Reduce collection frequency
sudo nano /etc/datadog-agent/datadog.yaml

# Increase interval:
# min_collection_interval: 10

# Disable unnecessary checks
sudo ls /etc/datadog-agent/conf.d/
# Comment out .d files for unused integrations

# Restart
sudo systemctl restart datadog-agent
```

### High Memory Usage

**Agent using too much memory:**

```bash
# SSH to VM
ssh user@<vm_ip>

# Check agent memory
ps aux | grep [d]atadog-agent
# Look at RSS column (should be 50-150 MB)

# If > 250 MB:
# 1. Check for memory leaks in logs
sudo grep -i "memory\|leak" /var/log/datadog-agent/agent.log

# 2. Check number of metrics being collected
sudo grep "metric" /var/log/datadog-agent/agent.log | wc -l
```

**Fix high memory:**

```bash
# Reduce metrics collected
# Reduce log collection size
# Increase collection interval

sudo nano /etc/datadog-agent/datadog.yaml

# Add memory limit:
# max_memory_percent: 5

# Restart
sudo systemctl restart datadog-agent
```

### High Disk I/O

**Reduce disk writes:**

```bash
# SSH to VM
# Check where writes are going
iotop -b -n 1 | head -20
# Or:
iostat -x 1 5

# Common issues:
# - Logs growing too fast
# - Agent writing too frequently

# Fix:
# Reduce log verbosity
# Increase collection interval
```

---

## Multi-VM Issues

**Symptom**: Problems when running 2+ VMs simultaneously

### Issue 1: VMs Interfering with Each Other

**Symptoms:**
- Second VM crashes when first launches
- VMs steal each other's network
- IP conflicts

**Solutions:**

```bash
# Check both VMs have unique IPs
# VM 1:
ssh user@192.168.x.100

# VM 2:
ssh user@192.168.x.101

# Should be different addresses

# If conflicts, ensure network uses separate subnets
# Or configure static IPs per VM
```

### Issue 2: Only One VM's Data Shows

**Symptoms:**
- First VM reports data, second VM doesn't
- Metrics mixed up between VMs

**Debug:**

```bash
# Check each VM's hostname uniqueness
# VM 1:
ssh user@<vm1_ip> "hostname"

# VM 2:
ssh user@<vm2_ip> "hostname"

# Should be different

# In Datadog, filter by host
host:basicvibecode*
host:liquidglass*
```

**Fix:**

```bash
# Inside second VM, set unique hostname
sudo hostnamectl set-hostname liquidglass-vm

# Restart agent
sudo systemctl restart datadog-agent
```

### Issue 3: Shared API Key Confusion

**Problem**: Both VMs using same API key (OK) but data gets mixed

**Solution:**

```bash
# Verify tags differentiate VMs in Datadog
# Go to Infrastructure
# Click each host
# Check tags section
# Should see VM-specific tags (hostname, env, service)
```

### Issue 4: One VM Hogs Resources

**Symptoms:**
- First VM runs well, second VM slow
- Both VMs on same host causing contention

**Check Resources:**

```bash
# Check overall host resources
top -s 3 -n 1 | head -10
free -h
df -h

# If resources limited:
# - Reduce VM count
# - Allocate more host resources
# - Disable unnecessary services in VMs
```

---

## Emergency Recovery

**If nothing works, try full reset:**

### Option 1: Reset Agent Configuration

```bash
# SSH to VM
ssh user@<vm_ip>

# Back up current config
sudo cp /etc/datadog-agent/datadog.yaml /etc/datadog-agent/datadog.yaml.bak

# Reset to defaults
sudo datadog-agent config

# Set essential config
sudo nano /etc/datadog-agent/datadog.yaml

# Ensure it has:
# api_key: ${DD_API_KEY}
# hostname: vibecode-vm
# dd_url: https://api.datadoghq.com
# logs_enabled: true

# Restart
sudo systemctl restart datadog-agent
```

### Option 2: Restart Agent from Scratch

```bash
# SSH to VM
ssh user@<vm_ip>

# Stop agent
sudo systemctl stop datadog-agent

# Check process is stopped
ps aux | grep [d]atadog

# Clear agent cache
sudo rm -rf /var/cache/datadog-agent/*

# Start agent
sudo systemctl start datadog-agent

# Watch logs
sudo tail -f /var/log/datadog-agent/agent.log
```

### Option 3: Full VM Reboot

```bash
# SSH to VM
ssh user@<vm_ip>

# Reboot (takes 1-2 minutes)
sudo reboot

# Wait for VM to come back up
# Then check Datadog again
```

### Option 4: Relaunch VM from Host

```bash
# Close simulator window (this shuts down VM)
# Wait 30 seconds

# Verify environment still set
echo $DD_API_KEY

# Relaunch
open BasicVibeCode.app

# Wait 3-5 minutes for data
```

---

## Support & Escalation

**If problem persists after troubleshooting:**

### Collect Diagnostic Info

```bash
# On host
echo "=== Host Info ==="
sw_vers
echo $DD_API_KEY | head -c 8
ps aux | grep simulator

# SSH to VM
ssh user@<vm_ip> << 'EOF'
echo "=== VM Info ==="
uname -a
echo "=== Network ==="
ip addr show
ip route show
echo "=== Agent Status ==="
sudo systemctl status datadog-agent
echo "=== Agent Logs (last 50 lines) ==="
sudo tail -50 /var/log/datadog-agent/agent.log
echo "=== Connectivity Test ==="
curl -I https://api.datadoghq.com/ 2>&1 | head -10
EOF
```

### Datadog Support

- URL: https://www.datadoghq.com/support/
- Email: support@datadoghq.com
- Chat: In-app support in Datadog UI

### Internal Support

- Project: /Users/ryan.maclean/vibecode-webgui/azure
- Docs: docs/demos/
- Issues: GitHub issues in project

---

## Prevention

**To avoid future issues:**

1. **Always set DD_API_KEY before launching VMs**
   ```bash
   export DD_API_KEY="..."
   open BasicVibeCode.app
   ```

2. **Use separate API keys for dev/prod**
   - Reduces impact if one key compromised

3. **Monitor agent health regularly**
   - Check logs weekly
   - Watch for error spikes

4. **Keep agent updated**
   - New releases fix issues
   - Check Datadog docs for upgrades

5. **Document your setup**
   - Keep notes on successful configs
   - Record any manual fixes applied

6. **Test regularly**
   - Launch VMs at least weekly
   - Verify data flows normally
   - Practice troubleshooting

---

**Troubleshooting Guide Version**: 1.0
**Last Updated**: 2025-11-25
**Scope**: macOS + Linux VMs + Datadog
**Contact**: Demo Team
