# VibeCode Datadog Integration - Step-by-Step Tutorial

**Duration**: 15-20 minutes
**Difficulty**: Beginner
**Prerequisites**: Datadog account, macOS with Apple Silicon

## Part 1: Setup (5 minutes)

### Step 1.1: Create/Find Your Datadog API Key

1. Go to https://app.datadoghq.com/organization/settings/api-keys
2. Click "New API Key" button
3. Name it: `VibeCode VM Integration`
4. Copy the full 32-character hex key
5. Store safely (never commit to git)

**Expected Output:**
```
API Key format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 hex characters)
Status: Active
Scope: Full access
```

### Step 1.2: Configure Environment Variables

Open Terminal and execute:

```bash
# Copy your actual API key in place of the placeholder
export DD_API_KEY="paste_your_32_char_key_here"

# Set the site (US is default, EU is alternative)
export DD_SITE="datadoghq.com"

# Verify it's set
echo "API Key set to: $DD_API_KEY"
echo "Site set to: $DD_SITE"
```

**Expected Output:**
```
API Key set to: abc123def456... (first 10 chars visible)
Site set to: datadoghq.com
```

### Step 1.3: Verify VibeCode Apps Exist

```bash
ls -la /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app
ls -la /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app
```

**Expected Output:**
```
total 0
drwxr-xr-x  3 user  staff  96 Nov 25 10:00 BasicVibeCode.app
Contents/
```

**Troubleshooting:** If apps not found, run build script first:
```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
./build.sh
```

## Part 2: Launch VMs (3 minutes)

### Step 2.1: Launch BasicVibeCode VM

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
open BasicVibeCode.app
```

**Expected Behavior:**
- Xcode Simulator window opens
- VM starts booting (takes 60-90 seconds)
- Console shows boot messages

### Step 2.2: Wait for Full Boot

Watch for these messages in console:
```
Starting network...
Configuring DHCP...
IP Address assigned: 192.168.x.x
Starting services...
Datadog Agent starting...
Agent initialized with API key
```

**Typical Timeline:**
- 0s: App launches
- 5s: VM window appears
- 30s: Kernel boot starts
- 60s: User space boots
- 90s: Services start
- 120s: Datadog Agent online

### Step 2.3: Verify VM is Running

Get the VM IP address:

```bash
# Method 1: Check Datadog UI (wait 2-3 minutes)
# Go to https://app.datadoghq.com/infrastructure

# Method 2: SSH into VM (if you have access)
# ssh user@<vm-ip>
# cat /proc/cmdline | grep dd_api_key
```

**Expected Output from /proc/cmdline:**
```
... dd_api_key=abc123def456... dd_site=datadoghq.com ...
```

### Step 2.4: (Optional) Launch Second VM

```bash
open LiquidGlassVibeCode.app
```

**Expected Behavior:**
- Second Simulator window opens
- Same boot sequence
- Eventually 2 hosts visible in Datadog

## Part 3: Verify Data Flow (5 minutes)

### Step 3.1: Check Datadog Infrastructure View

1. Navigate to: https://app.datadoghq.com/infrastructure
2. Refresh page every 30 seconds
3. Look for new hosts appearing

**What You Should See:**

After 2-3 minutes:
```
Hosts: 1 (or 2 if running both VMs)
Avg CPU: 5-15%
Avg Memory: 10-30%
```

Click on the host entry to see:
- OS: Linux
- Kernel: Alpine/Ubuntu
- Services: datadog-agent, bun, openvscode
- Tags: environment:demo, service:vibecode

### Step 3.2: Check System Metrics

1. Go to: https://app.datadoghq.com/metric/explorer
2. Search for: `system.cpu.user`
3. Filter by: `host:vibecode*` or `host:basicvibecode*`

**Expected Graph:**
```
Y-axis: 0-100 (percentage)
X-axis: Timeline (last 1 hour)
Line: Shows baseline around 5-10%, spikes to 20-30% during activity
```

### Step 3.3: Check Logs

1. Go to: https://app.datadoghq.com/logs
2. Enter filter: `host:vibecode* status:info`
3. Scroll through recent logs

**Expected Logs:**
```
- "Datadog agent started"
- "Configuration loaded"
- "Metrics collection started"
- Various application logs
- Kernel messages
```

### Step 3.4: Set Hostname Query (Optional)

Create a saved query for easy reference:

1. In Log Explorer, click "Save"
2. Name: `VibeCode VM Logs`
3. Filter: `host:vibecode* OR host:basicvibecode* OR host:liquidglass*`
4. Click "Save View"

**Result:** Quick access to all VibeCode logs

## Part 4: Explore Dashboard (3 minutes)

### Step 4.1: Import Custom Dashboard

1. Download: `docs/demos/datadog-vibecode-dashboard.json`
2. Go to: https://app.datadoghq.com/dashboard
3. Click: "+ New Dashboard"
4. Click: Gear icon → "Import dashboard JSON"
5. Paste JSON contents
6. Click: "Import"
7. Save: Name as `VibeCode VMs Overview`

**Result:**
- Custom dashboard with VibeCode-specific widgets
- Pre-configured graphs for CPU, memory, network
- Quick access to all key metrics

### Step 4.2: Create Custom Query Widget

1. In VibeCode Dashboard, click "+" to add widget
2. Choose: "Timeseries"
3. Enter query:
   ```
   avg:system.mem.used{host:vibecode*} by {host}
   ```
4. Title: `Memory Usage by VM`
5. Save

**Result:** New widget showing memory per VM over time

### Step 4.3: Check System Status Widget

Look for:
- **Host Count**: Should show "1" or "2"
- **CPU Average**: Should show 5-20%
- **Memory Usage**: Should show percentage
- **Network I/O**: Should show bytes flowing

## Part 5: Advanced Verification (5 minutes)

### Step 5.1: Verify API Connectivity

```bash
# SSH into the VM (or use sudo docker if running locally)
# Check that the API key is accessible

ssh -p 22 user@<vm-ip>

# Inside VM:
cat /proc/cmdline | grep dd_api_key
# Should output: ... dd_api_key=<your_key> ...

# Check agent logs
sudo tail -f /var/log/datadog-agent/agent.log
# Should show: "API authentication successful"
```

**Expected Output:**
```
API authentication successful
Connected to Datadog platform
Metrics submission rate: 100/sec
Logs ingestion rate: 50/sec
```

### Step 5.2: Check Network Connectivity

```bash
# From host Terminal:
curl -I https://api.datadoghq.com/
# Expected: HTTP 200

# Or if you need to test from VM:
ssh user@<vm-ip>
curl -I https://api.datadoghq.com/
```

**Expected Output:**
```
HTTP/1.1 200 OK
Content-Type: application/json
```

### Step 5.3: Verify Custom Metrics (if configured)

1. Go to: https://app.datadoghq.com/metric/explorer
2. Search for: `vibecode.*`
3. Should show metrics like:
   - vibecode.vm.boot_time
   - vibecode.bun.runtime
   - vibecode.vscode.requests

**Result:** All custom metrics appear in metric explorer

### Step 5.4: Create Test Alert

1. Go to: https://app.datadoghq.com/monitors/create?monitor_type=metric_alert
2. Name: `VibeCode High CPU`
3. Query: `avg:system.cpu.user{host:vibecode*}`
4. Alert when: Above 80%
5. Click "Create Monitor"

**Result:** Alert configured and active

## Part 6: Troubleshooting (Reference)

### Issue: No Hosts Appearing

**Diagnosis:**
```bash
# Check if VMs are actually running
ps aux | grep -i simulator
ps aux | grep -i virtualcz

# Check Datadog environment variable
echo $DD_API_KEY
```

**Solutions:**
1. Verify API key is set: `echo $DD_API_KEY`
2. Relaunch app: Kill and reopen
3. Check Datadog API status: https://status.datadoghq.com/
4. Wait longer: Can take 5+ minutes first time

### Issue: Hosts Visible but No Metrics

**Diagnosis:**
```bash
# SSH into VM and check agent
sudo systemctl status datadog-agent
sudo tail -50 /var/log/datadog-agent/agent.log
```

**Solutions:**
1. Restart agent: `sudo systemctl restart datadog-agent`
2. Check firewall: Ensure outbound 443 allowed
3. Verify logs have metrics: `sudo cat /var/log/datadog-agent/trace-agent.log`
4. Check network: `ping 8.8.8.8` from VM

### Issue: Metrics Sporadic or Delayed

**Diagnosis:**
```bash
# Check metric submission rate
curl "https://api.datadoghq.com/api/v1/validate?api_key=$DD_API_KEY"
```

**Solutions:**
1. Network latency: Normal during high load
2. API rate limiting: Wait a few minutes
3. Large payload: Reduce collection interval
4. DNS issues: Try different DNS server

### Issue: Logs Not Appearing

**Diagnosis:**
```bash
# SSH into VM
sudo tail -f /var/log/syslog
sudo journalctl -n 100
```

**Solutions:**
1. Start services: Ensure apps are running
2. Check permissions: Datadog agent needs read access
3. Log rotation: Check /etc/logrotate.d/
4. Collection config: Verify datadog.yaml is correct

## Success Checklist

- [ ] DD_API_KEY environment variable set
- [ ] BasicVibeCode.app launched
- [ ] VM shows in Infrastructure view
- [ ] System metrics appearing in Metric Explorer
- [ ] Logs visible in Log Explorer
- [ ] Custom dashboard imported (optional)
- [ ] Test alert created (optional)
- [ ] No error messages in agent logs

## Next Steps

1. **Automate**: Create shell script to launch both VMs with env setup
2. **Monitor**: Set up alerts for critical metrics
3. **Analyze**: Create custom dashboards for your workload
4. **Trace**: Enable APM for distributed tracing
5. **Optimize**: Use metrics to identify bottlenecks

## Quick Command Reference

```bash
# View environment
env | grep DD_

# Test API connectivity
curl -I https://api.datadoghq.com/

# Launch both VMs
open BasicVibeCode.app && open LiquidGlassVibeCode.app

# SSH to VM (replace IP)
ssh user@192.168.x.x

# Check agent status (in VM)
sudo systemctl status datadog-agent

# View agent logs (in VM)
sudo tail -f /var/log/datadog-agent/agent.log

# Test metric collection (in VM)
sudo datadog-agent check system_metrics
```

## Support

For issues, refer to:
- docs/guides/DATADOG-TROUBLESHOOTING.md
- docs/demos/DATADOG-VERIFICATION-CHECKLIST.md
- docs/demos/DATADOG-QUERIES.md

---

**Tutorial Version**: 1.0
**Last Updated**: 2025-11-25
**Estimated Time**: 15-20 minutes
