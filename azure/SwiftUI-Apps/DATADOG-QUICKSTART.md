# Datadog Integration - Quick Start Guide

**5-Minute Setup Guide for VibeCode VM Applications**

## TL;DR

```bash
# 1. Get your Datadog API key from: https://app.datadoghq.com/organization-settings/api-keys

# 2. Save it locally
mkdir -p ~/.datadog
echo "YOUR_API_KEY_HERE" > ~/.datadog/api_key
chmod 600 ~/.datadog/api_key

# 3. Launch any VibeCode app
open ValkeyVibeCode.app

# 4. Verify (inside VM via SSH)
cat /proc/cmdline | grep DD_API_KEY

# 5. Check Datadog dashboard after 30-60 seconds
# Visit: https://app.datadoghq.com/infrastructure
```

## Prerequisites

- Datadog account (free trial available)
- VibeCode VM application (ValkeyVibeCode, BasicVibeCode, etc.)
- macOS with Apple Virtualization Framework support

## Step-by-Step Setup

### 1. Obtain Datadog API Key

1. Visit https://app.datadoghq.com
2. Sign up or log in
3. Go to **Organization Settings** → **API Keys**
4. Click **New Key**
5. Name it: `vibecode-vm-dev`
6. Set permissions:
   - ✅ Submit metrics
   - ✅ Submit logs
   - ❌ Admin access
7. Copy the generated API key (32 hex characters)

### 2. Configure macOS Host

**Option A: File-based storage (Recommended)**

```bash
# Create Datadog config directory
mkdir -p ~/.datadog

# Save API key to file
echo "0abc123def456789abcdef0123456789" > ~/.datadog/api_key

# Set restrictive permissions
chmod 600 ~/.datadog/api_key

# Verify
cat ~/.datadog/api_key
ls -la ~/.datadog/api_key
# Should show: -rw------- (read/write owner only)
```

**Option B: Environment variable**

```bash
# For current terminal session
export DD_API_KEY="0abc123def456789abcdef0123456789"
export DD_SITE="datadoghq.com"

# Or add to ~/.zshrc for persistence
echo 'export DD_API_KEY="0abc123def456789abcdef0123456789"' >> ~/.zshrc
echo 'export DD_SITE="datadoghq.com"' >> ~/.zshrc
source ~/.zshrc
```

**Datadog Site Regions:**
- `datadoghq.com` - US1 (default)
- `datadoghq.eu` - EU
- `us3.datadoghq.com` - US3
- `us5.datadoghq.com` - US5
- `ddog-gov.com` - US FedRAMP

### 3. Launch VibeCode VM

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Launch any VibeCode app
open ValkeyVibeCode.app
# or
open BasicVibeCode.app
# or
open LiquidGlassVibeCode.app
```

The VM will automatically:
1. Read API key from `~/.datadog/api_key` or `DD_API_KEY` environment
2. Include it in kernel boot parameters
3. Pass it to the VM guest via `/proc/cmdline`
4. Start Datadog agent (if present in VM image)

### 4. Verify Inside VM

**Option A: Check kernel command line**

```bash
# SSH into the VM (if SSH is enabled)
ssh root@192.168.64.X

# Check if DD_API_KEY is present
cat /proc/cmdline | grep DD_API_KEY
# Expected output: ...DD_API_KEY=0abc123def... DD_SITE=datadoghq.com...

# Extract just the key
cat /proc/cmdline | grep -o 'DD_API_KEY=[^ ]*' | cut -d= -f2
```

**Option B: Check Datadog agent**

```bash
# Check if agent is running
ps aux | grep datadog

# View agent status (if full agent installed)
datadog-agent status

# Check agent logs
tail -f /var/log/datadog/agent.log

# View StatsD bridge logs (if lightweight integration)
tail -f /tmp/datadog-bridge.log
```

### 5. Verify in Datadog Dashboard

**Wait 30-60 seconds** for metrics to appear, then:

1. **Infrastructure View**
   - Visit: https://app.datadoghq.com/infrastructure
   - Search for hostname: `vibecode-vm` or your VM's hostname
   - Should see: CPU, memory, network metrics

2. **Metrics Explorer**
   - Visit: https://app.datadoghq.com/metric/explorer
   - Search for: `vibecode.vm.*` or `system.*`
   - Should see: Custom metrics from your VM

3. **Log Explorer**
   - Visit: https://app.datadoghq.com/logs
   - Filter by: `service:vibecode-vm`
   - Should see: VM startup logs, application logs

4. **Host Map**
   - Visit: https://app.datadoghq.com/infrastructure/map
   - Find your VM in the visualization

## Troubleshooting

### Problem: API key not found

**Check 1: Does the file exist?**
```bash
ls -la ~/.datadog/api_key
cat ~/.datadog/api_key
```

**Check 2: Is environment variable set?**
```bash
echo $DD_API_KEY
```

**Solution:** Create the file or set the environment variable

### Problem: VM boots but no metrics in Datadog

**Check 1: Is DD_API_KEY in kernel command line?**
```bash
# Inside VM
cat /proc/cmdline | grep DD_API_KEY
```

**Check 2: Is Datadog agent running?**
```bash
# Inside VM
ps aux | grep datadog
```

**Check 3: Can VM reach Datadog API?**
```bash
# Inside VM
curl -I https://api.datadoghq.com/api/v2/series
# Should get: HTTP/2 401 (unauthorized - expected without key)

# Test with API key
curl -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $(cat /proc/cmdline | grep -o 'DD_API_KEY=[^ ]*' | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"series":[{"metric":"test.metric","points":[{"timestamp":1,"value":1}]}]}'
# Should get: HTTP/2 202 (accepted)
```

**Check 4: Check agent logs**
```bash
# Inside VM
tail -100 /var/log/datadog/agent.log
# or
tail -100 /tmp/datadog-bridge.log
```

### Problem: Metrics delayed

**Expected latency:** 30-60 seconds after VM boot

**Factors:**
- StatsD bridge flush interval (default: 30s)
- Network latency
- Datadog API processing time

**Solution:** Wait up to 2 minutes before troubleshooting

### Problem: Wrong Datadog site

**Symptom:** Metrics not appearing, logs show connection errors

**Check current site:**
```bash
cat /proc/cmdline | grep DD_SITE
```

**Solution:** Set correct site for your region
```bash
# On host
export DD_SITE="datadoghq.eu"  # or appropriate region
```

## Testing with Fake API Key

For infrastructure testing without a real Datadog account:

```bash
# Create test API key (32 hex characters)
echo "0123456789abcdef0123456789abcdef" > ~/.datadog/api_key
chmod 600 ~/.datadog/api_key

# Launch VM
open ValkeyVibeCode.app

# Verify key appears in kernel command line
# (check debug logs or VM console)
```

The infrastructure will work, but metrics won't appear in Datadog (no valid API key).

## Security Best Practices

### DO ✅

- Use restricted API keys (not admin keys)
- Set file permissions to 600 (`chmod 600 ~/.datadog/api_key`)
- Rotate keys regularly (every 90 days)
- Use different keys per environment (dev/staging/prod)
- Keep keys out of version control (add to .gitignore)
- Monitor API key usage in Datadog audit logs

### DON'T ❌

- Don't commit API keys to git repositories
- Don't use admin/master API keys for VMs
- Don't share API keys between environments
- Don't set world-readable permissions on key file
- Don't hardcode keys in application code
- Don't expose keys in public logs or screenshots

## Advanced Configuration

### Custom Hostname

```bash
# Add to kernel command line in VM manager
DD_HOSTNAME=my-custom-vm-name
```

### Custom Tags

```bash
# Add to kernel command line
DD_TAGS=env:production,team:backend,app:valkey
```

### Different Datadog Account

```bash
# Use different API key file
echo "OTHER_ACCOUNT_KEY" > ~/.datadog/api_key_prod

# Reference in environment
export DD_API_KEY=$(cat ~/.datadog/api_key_prod)
```

### Multiple VMs

Each VM automatically gets its own unique identifier. To distinguish them:

1. Use different hostnames (DD_HOSTNAME)
2. Apply different tags (DD_TAGS)
3. Use separate service names in agent config

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Configure Datadog
  env:
    DD_API_KEY: ${{ secrets.DATADOG_API_KEY }}
  run: |
    mkdir -p ~/.datadog
    echo "$DD_API_KEY" > ~/.datadog/api_key
    chmod 600 ~/.datadog/api_key

- name: Launch VM
  run: |
    open ValkeyVibeCode.app
    sleep 60  # Wait for metrics
```

### Docker/Container Integration

```dockerfile
# Pass API key as build arg or secret
ARG DD_API_KEY
RUN mkdir -p ~/.datadog && \
    echo "$DD_API_KEY" > ~/.datadog/api_key && \
    chmod 600 ~/.datadog/api_key
```

## Supported VibeCode Applications

All VibeCode VM applications support Datadog integration via `BaseVMManager`:

- ✅ **ValkeyVibeCode** - Valkey (Redis-compatible) server
- ✅ **BasicVibeCode** - Basic VM with OpenVSCode
- ✅ **LiquidGlassVibeCode** - VM with enhanced observability
- ✅ **VsockVibeCode** - VM with vsock networking
- ✅ **PostgreSQLVibeCode** - PostgreSQL database server
- ✅ **NetworkTestVibeCode** - Network testing utilities

All apps inherit Datadog support from `BaseVMManager` automatically.

## Related Documentation

- **DATADOG-INTEGRATION-TEST-REPORT.md** - Detailed test report
- **DD_API_KEY_PASSING.md** - Implementation details
- **DATADOG-VM-QUICK-REFERENCE.md** - Advanced reference
- **Shared/Core/BaseVMManager.swift** - Source code

## Getting Help

### Datadog Resources
- Docs: https://docs.datadoghq.com
- Support: https://help.datadoghq.com
- Community: https://chat.datadoghq.com

### VibeCode Resources
- Repository: Check CONTRIBUTING.md
- Issues: Report via issue tracker
- Documentation: See docs/ directory

## FAQ

**Q: Do I need a paid Datadog account?**

A: No, Datadog offers a free trial with full features. Perfect for testing.

**Q: Can I use multiple API keys?**

A: Yes, use different keys per environment or application. Set them via environment variables or separate key files.

**Q: Is the API key secure in kernel command line?**

A: It's visible in `/proc/cmdline` inside the VM. Suitable for dev/test and trusted VMs. For production, consider vsock-based method (future).

**Q: Can I disable Datadog integration?**

A: Yes, simply don't create `~/.datadog/api_key` and don't set `DD_API_KEY` environment variable. VMs will boot normally without Datadog.

**Q: Does this work with OpenTelemetry?**

A: Datadog supports OpenTelemetry metrics and traces. You can use both together.

**Q: How much does Datadog cost?**

A: Pricing varies by usage. Check https://www.datadoghq.com/pricing/

---

**Last Updated:** 2025-12-02
**Status:** Production Ready
**Tested:** ✅ ValkeyVibeCode
