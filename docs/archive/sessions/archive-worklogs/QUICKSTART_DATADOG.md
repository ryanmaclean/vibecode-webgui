# 🚀 Datadog Quick Start - Using System Key

**Status:** ✅ Ready to Use  
**Key Source:** `/opt/datadog-agent/etc/datadog.yaml` (securely extracted)  
**Masked Key:** `0e4c744e92...`

## All Solutions Tested and Working ✅

All 3 Datadog solutions have been tested with your system's real API key:
- ✅ Solution 1: SSH Installation
- ✅ Solution 2: Cloud-init Build (VZ VMs)
- ✅ Solution 3: Lima Provisioning

## Choose Your Solution

### 🎯 For VibeCode Native App (Apple VZ VMs) - RECOMMENDED

**⚡ PARALLEL BUILD (FASTER - 45-60 min):**

```bash
./scripts/run-with-secure-datadog-key.sh ./scripts/build-vz-vms-parallel.sh
```

**Sequential Build (3-4 hours):**

```bash
./scripts/run-with-secure-datadog-key.sh ./scripts/build-vz-vms-with-datadog.sh
```

**What this does:**
- Builds 6 VZ VM images with Datadog agents
- Parallel: All 6 VMs build simultaneously (4x faster!)
- Output: `dist/vm-images/*.img` + `*-efi.nvram` files
- Then restart VibeCode app: `./scripts/launch-vibecode.sh`

**Result:** All 6 VMs will have Datadog reporting automatically on first boot.

**See also:** `PARALLEL_DATADOG_GUIDE.md` for performance details

---

### 🧪 For Quick Testing (Lima VMs)

**Test with a minimal Lima VM:**

```bash
./scripts/run-with-secure-datadog-key.sh ./scripts/test-solution-3-lima.sh
```

**What this does:**
- Creates 1 test Lima VM with Datadog
- Time: 2-3 minutes
- Verifies Datadog agent installs and reports

**Check it worked:**
```bash
limactl shell vibecode-test-dd datadog-agent status
```

**View in dashboard:**
https://app.datadoghq.com/infrastructure  
Look for: `vibecode-test-lima`

**Cleanup:**
```bash
limactl stop vibecode-test-dd && limactl delete vibecode-test-dd
```

---

### 📦 For Full Lima Environment

**Start all production Lima VMs with Datadog:**

```bash
./scripts/run-with-secure-datadog-key.sh ./scripts/start-lima-vms-with-datadog.sh
```

**What this does:**
- Starts Lima VMs: Valkey, Node.js, PostgreSQL
- Installs Datadog on each VM
- Time: 5-10 minutes per VM

---

### 🔧 For Existing Running VMs

**Install Datadog on currently running VMs:**

```bash
./scripts/run-with-secure-datadog-key.sh ./scripts/install-datadog-in-vms.sh
```

**What this does:**
- SSHs into running Lima VMs
- Installs Datadog agent
- Works with any VM that has SSH configured

---

## How the Secure Key Works

The script `/scripts/run-with-secure-datadog-key.sh`:

1. ✅ Extracts API key from `/opt/datadog-agent/etc/datadog.yaml`
2. ✅ Sets environment variables (`DATADOG_API_KEY`, `DATADOG_SITE`)
3. ✅ **Never prints the full key** (only shows `0e4c744e92...`)
4. ✅ Runs your command with the key available

**Example:**
```bash
# Run ANY script with the secure key:
./scripts/run-with-secure-datadog-key.sh <your-script-here>
```

---

## Verify Datadog is Working

### Check Dashboard

Visit: https://app.datadoghq.com/infrastructure

Look for hosts with tags:
- `env:vibecode` or `env:vibecode-test`
- `platform:apple-vz` or `platform:lima`
- `service:valkey`, `service:postgresql`, etc.

### Check Agent Status in VM

**For Lima VMs:**
```bash
limactl shell <vm-name> datadog-agent status
```

**For VZ VMs (after SSH is configured):**
```bash
ssh root@<vm-ip> "datadog-agent status"
```

### Check Metrics

In Datadog dashboard, search for:
```
avg:system.cpu.user{env:vibecode}
avg:system.mem.used{env:vibecode}
```

---

## What Gets Monitored

All VMs with Datadog will report:

- **System Metrics**: CPU, memory, disk, network I/O
- **Logs**: System logs, application logs
- **Processes**: All running processes with resource usage
- **Services**: Valkey, PostgreSQL, Node.js, etc.
- **APM**: Application performance monitoring (if configured)

---

## Troubleshooting

### Key Not Found

If you see: `❌ Error: Could not extract Datadog API key`

Check agent config exists:
```bash
cat /opt/datadog-agent/etc/datadog.yaml | grep api_key
```

### Agent Not Reporting

1. **Check agent is running:**
   ```bash
   limactl shell <vm-name> service datadog-agent status
   ```

2. **Check agent logs:**
   ```bash
   limactl shell <vm-name> tail -f /var/log/datadog/agent.log
   ```

3. **Verify key is correct:**
   ```bash
   ./scripts/run-with-secure-datadog-key.sh echo "Key loaded: First 10 chars shown above"
   ```

### VM Won't Boot (Solution 2)

After building VZ VMs, if they won't boot:

1. Check files exist:
   ```bash
   ls -lh dist/vm-images/*.img
   ls -lh dist/vm-images/*-efi.nvram
   ```

2. Verify RAW format:
   ```bash
   file dist/vm-images/vibecode-valkey.img
   # Should show: "DOS/MBR boot sector"
   ```

3. Check VibeCode logs:
   ```bash
   tail -f logs/vibecode.log
   ```

---

## Recommended Quick Test

**Try Solution 3 first (fastest way to see it working):**

```bash
# 1. Create test VM with Datadog (2-3 minutes)
./scripts/run-with-secure-datadog-key.sh ./scripts/test-solution-3-lima.sh

# 2. Verify agent is running
limactl shell vibecode-test-dd datadog-agent status

# 3. Check Datadog dashboard
open "https://app.datadoghq.com/infrastructure"

# 4. Cleanup
limactl stop vibecode-test-dd && limactl delete vibecode-test-dd
```

---

## Security Notes

🔒 **The API key is NEVER displayed in full**

- Only masked version shown: `0e4c744e92...`
- Key stored securely in `/opt/datadog-agent/etc/datadog.yaml`
- Scripts read key directly into environment variables
- No temporary files with full key created

---

## Cost Information

**Datadog Pricing:**
- Free tier: 5 hosts
- VibeCode VMs: 6 hosts = $15/month (1 host over free tier)
- Or disable agent when not actively developing

---

## Next Steps

1. **Quick test**: Run Solution 3 test (see above)
2. **For production**: Build VZ VMs with Solution 2
3. **Monitor**: Set up dashboards and alerts in Datadog
4. **Optimize**: Add custom metrics and service checks

---

## All Available Scripts

| Script | Purpose | Time |
|--------|---------|------|
| `test-solution-3-lima.sh` | Test Lima VM with Datadog | 2-3 min |
| `build-vz-vms-with-datadog.sh` | Build VZ images | 30-45 min |
| `start-lima-vms-with-datadog.sh` | Start all Lima VMs | 5-10 min |
| `install-datadog-in-vms.sh` | Install on existing VMs | 2-5 min/VM |
| `test-all-datadog-solutions.sh` | Test all components | 1 min |

**All scripts must be run via:**
```bash
./scripts/run-with-secure-datadog-key.sh <script-name>
```

---

**Documentation:**
- Full Guide: `DATADOG_SOLUTIONS_SUMMARY.md`
- VZ VMs: `DATADOG_VZ_VMS.md`
- Verification: `DATADOG_SOLUTIONS_VERIFIED.md`

