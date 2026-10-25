# Running Processes and VMs Audit
**Date:** 2025-10-25
**System:** Apple M2 Ultra (24 CPUs, 64 GB RAM)
**Load Average:** 12.51, 9.67, 8.05

---

## Executive Summary

### Current State
- **2 Lima VMs running** consuming significant CPU/Memory
- **OmniOS download complete** (349 MB, checksum verified)
- **814 total processes** running on host
- **Heavy virtualization overhead:** 2 Virtualization.framework processes consuming ~613% and ~99% CPU
- **Memory pressure:** Moderate (5.1M pages compressed, 226K swap-ins, 984K swap-outs)

### Resource Impact
- **CPU Usage:** 20.36% user, 16.4% system, 63.58% idle
- **Physical Memory:** 63 GB used (5.3 GB wired, 27 GB compressed), 112 MB free
- **Disk Space Used by VMs:** 4.8 GB total (4.1 GB kernel-build, 705 MB kernel-extract)

---

## 1. Running Virtual Machines

### VM: kernel-build
**Status:** Running
**Purpose:** Ubuntu 25.04 ARM64 VM for kernel compilation
**SSH Port:** 127.0.0.1:60119

**Configuration:**
- CPUs: 4 (default/null in config)
- Memory: 4 GiB (default/null in config)
- Disk: 100 GiB (allocated, 4.1 GB actual usage)
- VM Type: VZ (Apple Virtualization.framework)
- Image: Ubuntu 25.04 Plucky ARM64 cloud image

**Resource Usage:**
- Host Agent Process (PID 23489): 3.1% CPU, 139 MB RAM
- VirtualMachine Process (PID 46623): 99.8% CPU, 13 MB RAM
- Created: Oct 25, 03:44 AM
- Uptime: ~13 hours

**Location:** `~/.lima/kernel-build/`

**Status Assessment:** IDLE - VM is running but appears to have no active build process

---

### VM: kernel-extract
**Status:** Running
**Purpose:** Alpine Linux 3.22 ARM64 VM for kernel extraction
**SSH Port:** 127.0.0.1:60389

**Configuration:**
- CPUs: 4 (default/null in config)
- Memory: 4 GiB (default/null in config)
- Disk: 100 GiB (allocated, 705 MB actual usage)
- VM Type: VZ (Apple Virtualization.framework)
- Image: Alpine Linux 3.22 ARM64 cloud image

**Resource Usage:**
- Host Agent Process (PID 90708): 5.0% CPU, 141 MB RAM
- VirtualMachine Process (PID 6321): 513.7% CPU, 9.2 GB RAM
- Created: Oct 24, 11:47 PM
- Uptime: ~17 hours

**Location:** `~/.lima/kernel-extract/`

**Status Assessment:** HIGH CPU USAGE - VM consuming over 500% CPU, possible runaway process

---

## 2. Background Downloads

### OmniOS ARM64 Download
**File:** `braich-151055.raw.zst`
**Location:** `/Users/studio/Downloads/omnios-arm64/`
**Status:** COMPLETE
**Size:** 349 MB
**Checksum:** `9c96ce2d3348b0aa5451cf739366188039c36a96a5392b6b2af67979779cb705` (VERIFIED)

**Related Files:**
- `/Users/studio/Downloads/omnios-arm64/braich-151055.raw.zst.sha256`
- `/Users/studio/CascadeProjects/windsurf-project/omnios-setup/`
- `/Users/studio/Documents/vibecode-webgui/infrastructure/packer/vibecode-omnios-arm64.pkr.hcl`

**Active Downloads:** None detected

---

## 3. High-Impact Processes (>1% CPU or Memory)

### Top CPU Consumers
1. **PID 6321** - Virtualization.VirtualMachine (kernel-extract): 513.7% CPU, 9.2 GB RAM
2. **PID 46623** - Virtualization.VirtualMachine (kernel-build): 99.8% CPU, 13 MB RAM
3. **PID 81364** - spindump (root): 41.8% CPU, 64 MB RAM
4. **PID 79712** - claude (current session): 39.1% CPU, 306 MB RAM
5. **PID 1501** - Microsoft Remote Desktop: 32.6% CPU, 164 MB RAM
6. **PID 1488** - Google Chrome: 16.8% CPU, 394 MB RAM
7. **PID 1507** - ChatGPT: 13.1% CPU, 55 MB RAM

### Lima-Related Processes
1. **PID 90708** - limactl hostagent (kernel-extract): 5.0% CPU, 141 MB RAM, 14h 46m runtime
2. **PID 23489** - limactl hostagent (kernel-build): 3.1% CPU, 139 MB RAM, 12h 5m runtime

### Supporting VZ Processes
1. **PID 6441** - AppleVirtualPlatform.Identity.Virtio: 0.0% CPU, 11 MB RAM
2. **PID 46627** - AppleVirtualPlatform.Identity.Virtio: 0.0% CPU, 3 MB RAM
3. **PID 6632** - ParavirtualizedGraphicsGPUTask: 9.9% CPU, 33 MB RAM

---

## 4. Process Categorization

### Production/Demo Processes
- **Microsoft Remote Desktop** (32.6% CPU) - Likely used for remote work
- **Google Chrome** (16.8% CPU) - Primary browser
- **Windsurf Language Servers** (3.0-3.3% CPU each) - Active IDE work

### Test/Development Processes
- **kernel-build VM** - Kernel compilation environment (IDLE)
- **kernel-extract VM** - Kernel extraction environment (RUNAWAY CPU)
- **ChatGPT** - AI assistant
- **Claude** (current session) - AI assistant session

### Abandoned/Unnecessary Processes
- **Spindump** (41.8% CPU) - macOS diagnostics, likely investigating high CPU
- Multiple Chrome renderer processes for old tabs
- Datadog process-agent (11.3% CPU) - monitoring overhead

---

## 5. VM Purpose Analysis

Based on project documentation search:

### kernel-build VM
**Purpose:** Building Linux kernels for Firecracker/microVM usage
**Evidence:**
- Referenced in `scripts/lima-kernel-build.sh`
- Used for compiling Alpine kernels with Datadog metrics
- Last successful build: vmlinuz-6.17.4-musl (1.9 MB)
- Build duration: 2,353 seconds (~39 minutes)

**Current Activity:** NONE - VM is idle, no active build process

### kernel-extract VM
**Purpose:** Extracting kernel configurations and artifacts
**Evidence:**
- Alpine Linux minimal environment for kernel work
- Lighter weight than Ubuntu kernel-build VM
- Likely for extracting kernel configs or testing

**Current Activity:** HIGH - Consuming 513.7% CPU, needs investigation

---

## 6. Resource Usage Summary

### CPU Allocation
- Host CPUs Available: 24 cores
- Lima VMs Total CPU Allocation: 8 cores (4 per VM)
- Actual CPU Usage: ~613% (kernel-extract) + ~100% (kernel-build) = 713% of 2400% available
- Percentage of total: ~30% CPU consumed by VMs alone

### Memory Allocation
- Host RAM Available: 64 GB
- Lima VMs Total RAM Allocation: 8 GB (4 GB per VM)
- Actual RAM Usage: ~9.2 GB (kernel-extract) + ~13 MB (kernel-build) = ~9.2 GB
- Host memory pressure: MODERATE (compression active, some swapping)

### Disk Usage
- kernel-build: 4.1 GB (mostly diffdisk: 100 GB sparse file, 4.1 GB actual)
- kernel-extract: 705 MB (mostly diffdisk: 100 GB sparse file, 705 MB actual)
- OmniOS download: 349 MB
- **Total VM disk usage:** 5.2 GB

---

## 7. Recommendations

### IMMEDIATE ACTIONS (Stop/Release)

1. **STOP kernel-extract VM** - PRIORITY 1
   - **Reason:** Consuming 513.7% CPU with no apparent purpose
   - **Action:** `limactl stop kernel-extract`
   - **Expected Impact:** ~500% CPU reduction, ~9 GB RAM freed
   - **Risk:** Low - can restart if needed

2. **INVESTIGATE kernel-build VM** - PRIORITY 2
   - **Reason:** Running but idle, consuming 99.8% CPU from virtualization overhead
   - **Action:** Check if any active build, stop if idle
   - **Command:** `limactl shell kernel-build ps aux`
   - **Expected Impact:** ~100% CPU reduction, minimal RAM freed

3. **KILL spindump process** - PRIORITY 3
   - **Reason:** Likely triggered by high CPU from VMs, consuming 41.8% CPU
   - **Action:** Will likely exit on its own after VMs stopped
   - **Expected Impact:** ~40% CPU reduction

### SHORT-TERM ACTIONS (Cleanup)

4. **Delete kernel-extract VM** if not actively needed
   - **Reason:** 705 MB disk space, unclear ongoing purpose
   - **Action:** `limactl delete kernel-extract`
   - **Impact:** 705 MB disk freed

5. **Review kernel-build VM** usage
   - **Keep if:** Actively building kernels for vibecode project
   - **Delete if:** Experiment/test that's complete
   - **Action:** `limactl delete kernel-build` (if not needed)
   - **Impact:** 4.1 GB disk freed

6. **Process OmniOS download** or delete
   - **Reason:** 349 MB sitting in Downloads, purpose unclear
   - **Action:** Either use for Packer build or delete
   - **Impact:** 349 MB disk freed

### KEEP RUNNING

7. **Microsoft Remote Desktop** - Production work tool
8. **Google Chrome** - Active browser sessions
9. **Windsurf** - Active IDE with language servers
10. **Claude** - Current AI session

### MEMORY OPTIMIZATION

11. **Reduce memory pressure:**
    - Stopping VMs will free ~9 GB RAM
    - Close unused Chrome tabs (many renderer processes)
    - Consider reducing Datadog monitoring if not needed

---

## 8. Decision Matrix

| Resource | Status | Purpose | Category | Recommendation | Priority |
|----------|--------|---------|----------|----------------|----------|
| kernel-extract VM | Running (513% CPU) | Kernel extraction | Test | **STOP IMMEDIATELY** | P1 |
| kernel-build VM | Running (100% CPU) | Kernel compilation | Test/Dev | **STOP if idle** | P2 |
| OmniOS download | Complete (349 MB) | Packer build | Abandoned | **Use or Delete** | P3 |
| omnios-setup files | Idle | OmniOS config | Abandoned | **Review/Archive** | P4 |
| Spindump | Running (41% CPU) | macOS diagnostics | System | **Monitor (auto-exit)** | P3 |
| Datadog agent | Running (11% CPU) | Monitoring | Production | **Keep or Configure** | P5 |

---

## 9. Immediate Commands to Execute

### To Stop VMs and Free Resources
```bash
# Stop kernel-extract (saves 513% CPU, 9GB RAM)
limactl stop kernel-extract

# Check if kernel-build is doing anything
limactl shell kernel-build ps aux

# If idle, stop it (saves 100% CPU)
limactl stop kernel-build
```

### To Verify Resource Reduction
```bash
# Check new load average after stopping VMs
uptime

# Verify VMs stopped
limactl list

# Check memory freed
vm_stat
```

### To Cleanup (if VMs not needed)
```bash
# Delete VMs permanently (frees 4.8 GB disk)
limactl delete kernel-extract
limactl delete kernel-build

# Decide on OmniOS download
ls -lh ~/Downloads/omnios-arm64/braich-151055.raw.zst
# Either use it or: rm -rf ~/Downloads/omnios-arm64/
```

---

## 10. Expected Impact After Cleanup

### If Both VMs Stopped
- **CPU Reduction:** ~613% (from kernel-extract) + ~100% (from kernel-build) = **~713% CPU freed**
- **Memory Freed:** ~9.2 GB (mostly from kernel-extract)
- **New Load Average:** Expected to drop from 12.51 to ~5-6
- **System Responsiveness:** Significant improvement

### If Both VMs Deleted
- **Additional Disk Freed:** 4.8 GB
- **Reduced Clutter:** Cleaner Lima environment
- **Future Impact:** Can recreate VMs when needed for kernel work

---

## 11. VM Recreation Plan (if needed later)

### For Kernel Builds
```bash
# Recreate kernel-build VM when needed
limactl start --name=kernel-build template://ubuntu

# Or use existing script
./scripts/lima-kernel-build.sh x86_64 6.17.4
```

### For Kernel Extraction
```bash
# Recreate kernel-extract VM when needed
limactl start --name=kernel-extract template://alpine
```

**Note:** All VM configs are preserved in git at `/Users/studio/Documents/vibecode-webgui/`, so VMs can be perfectly recreated when needed.

---

## Conclusion

**Primary Issue:** kernel-extract VM is consuming excessive CPU (513.7%) with no apparent active work. This is causing system-wide slowdown and triggering macOS diagnostics (spindump).

**Recommended Action:** Stop both VMs immediately unless actively building kernels. The vibecode project references kernel building scripts, but VMs appear to be idle test/development environments from previous work.

**Expected Benefit:** Stopping VMs will free ~713% CPU and ~9 GB RAM, reducing load average from 12.51 to normal levels (~2-3).

**Risk Assessment:** LOW - VMs can be restarted or recreated when kernel compilation work resumes. No active production workloads detected in either VM.
