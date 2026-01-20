# vfkit VM Infrastructure Analysis

**Engineer:** Claude Code (Anthropic)
**Date:** October 28, 2025
**Platform:** macOS Darwin 24.6.0 (ARM64)
**vfkit Version:** v0.6.1
**Status:** CRITICAL BLOCKERS IDENTIFIED

---

## Executive Summary

After comprehensive analysis of vfkit v0.6.1, I have identified **CRITICAL BLOCKERS** that prevent the planned VM infrastructure from working as designed:

### Critical Finding 1: vfkit Does NOT Support `--config` Flag

**Impact:** BLOCKING
**Severity:** CRITICAL

The YAML configuration files in `config/vfkit/*.yaml` **CANNOT be used with vfkit v0.6.1**.

```bash
# This command FAILS:
vfkit --config valkey-vm.yaml
# Error: unknown flag: --config
```

**Root Cause:**
vfkit v0.6.1 does not support configuration files. All VM parameters must be passed as CLI flags.

**Evidence:**
```bash
$ vfkit --help
Flags:
  -b, --bootloader strings      bootloader configuration (default [])
      --cloud-init strings      path to user-data and meta-data cloud-init configuration files (default [])
  -c, --cpus uint               number of virtual CPUs (default 1)
  -d, --device stringArray      devices
      --gui                     display the contents of the virtual machine onto a graphical user interface
  -h, --help                    help for vfkit
      --ignition string         path to the ignition file
  -i, --initrd string           path to the virtual machine initrd
  -k, --kernel string           path to the virtual machine Linux kernel
  -C, --kernel-cmdline string   Linux kernel command line
      --log-level string        set log level
  -m, --memory uint             virtual machine RAM size in mibibytes (default 512)
      --restful-uri string      URI address for RESTful services (default "none://")
  -t, --timesync string         sync guest time when host wakes up from sleep
  -v, --version                 version for vfkit
```

**No `--config` flag exists.**

---

### Critical Finding 2: Empty Disk Images

**Impact:** BLOCKING
**Severity:** CRITICAL

The existing disk image at `~/.vfkit/vms/vibecode-alpine/disk/root.img` is **empty** (0 bytes actual data):

```bash
$ file ~/.vfkit/vms/vibecode-alpine/disk/root.img
/Users/ryan.maclean/.vfkit/vms/vibecode-alpine/disk/root.img: data

$ du -h ~/.vfkit/vms/vibecode-alpine/disk/root.img
  0B    /Users/ryan.maclean/.vfkit/vms/vibecode-alpine/disk/root.img
```

**Issue:** Sparse file created but never formatted or installed with an operating system.

**Impact:** Cannot boot VMs without a bootable filesystem.

---

### Critical Finding 3: Test Scripts Expect `--config` Flag

**Impact:** BLOCKING
**Severity:** CRITICAL

All test scripts in `tests/vm/*.test.sh` assume vfkit supports `--config`:

```bash
# From test-valkey.test.sh line 75:
"$VFKIT_BIN" --config "$VALKEY_CONFIG" > /tmp/valkey-vm.log 2>&1 &
```

**This will fail** because `--config` does not exist.

---

## vfkit v0.6.1 Capabilities

### Supported Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `-k, --kernel` | Kernel path | `--kernel ~/vmlinuz` |
| `-i, --initrd` | Initramfs path | `--initrd ~/initramfs` |
| `-C, --kernel-cmdline` | Kernel cmdline | `--kernel-cmdline "console=hvc0 root=/dev/vda"` |
| `-c, --cpus` | vCPU count | `--cpus 2` |
| `-m, --memory` | RAM in MiB | `--memory 1024` |
| `-d, --device` | Device spec | `--device virtio-blk,path=/disk.img` |
| `-b, --bootloader` | Bootloader type | `--bootloader linux,kernel=...,initrd=...` |
| `--cloud-init` | Cloud-init | `--cloud-init /user-data,/meta-data` |

### Device Types

#### 1. Block Storage (`virtio-blk`)

```bash
--device virtio-blk,path=/path/to/disk.img
```

**Properties:**
- Backed by raw disk image or physical device
- Can specify `deviceId` for cloud-init
- Supports `readonly` flag

#### 2. NVMe Storage (`nvme`)

```bash
--device nvme,path=/path/to/image.img
```

**Properties:**
- Raw disk images only
- Higher performance than virtio-blk

#### 3. USB Mass Storage (`usb-mass-storage`)

```bash
--device usb-mass-storage,path=/distro.iso,readonly
```

**Properties:**
- For ISO images
- Optional read-only mode

#### 4. Network (`virtio-net`)

```bash
--device virtio-net,nat,mac=52:54:00:12:34:56
--device virtio-net,unixSocketPath=/path/to/socket
```

**Modes:**
- `nat` - NAT networking (default)
- `unixSocketPath` - Unix socket
- `fd` - File descriptor

**Limitations:** No built-in port forwarding syntax. Must use macOS pf/nat rules.

#### 5. Serial Console (`virtio-serial`)

```bash
--device virtio-serial,logFilePath=/var/log/vm.log
--device virtio-serial,stdio
```

#### 6. Shared Filesystem (`virtio-fs`)

```bash
--device virtio-fs,sharedDir=/Users/user/workspace,mountTag=workspace
```

**Properties:**
- Share host directories with guest
- Guest must mount via: `mount -t virtiofs workspace /mnt/workspace`

---

## Correct vfkit Usage

### Example 1: Alpine Linux VM (Bootloader Method)

```bash
vfkit \
  --cpus 2 \
  --memory 1024 \
  --bootloader linux,kernel=/path/to/vmlinuz,initrd=/path/to/initramfs,cmdline="console=hvc0 root=/dev/vda rootfstype=ext4" \
  --device virtio-blk,path=/path/to/root.img \
  --device virtio-net,nat,mac=52:54:00:12:34:56 \
  --device virtio-serial,stdio
```

### Example 2: EFI Boot (macOS 13+)

```bash
vfkit \
  --cpus 4 \
  --memory 8192 \
  --bootloader efi,variable-store=/path/to/efi-vars,create \
  --device virtio-blk,path=/path/to/disk.img \
  --device virtio-blk,path=/path/to/install.iso \
  --device virtio-net,nat \
  --device virtio-serial,stdio \
  --gui
```

---

## Why Previous Attempts Failed

### 1. YAML Configs Are Documentation Only

The YAML files in `config/vfkit/` were created with the assumption that vfkit supports `--config`, similar to tools like:
- Lima (uses YAML)
- Colima (uses YAML)
- Docker Compose (uses YAML)

**Reality:** vfkit does NOT support configuration files. These YAMLs are reference documentation only.

### 2. Empty Disk Images

Previous agents created sparse disk files but never:
1. Formatted them with a filesystem
2. Installed an operating system
3. Configured boot parameters

### 3. No Installation Process

To create working VMs, we need:
1. Boot from Alpine ISO
2. Install OS to disk
3. Configure services (Valkey, PostgreSQL, Node.js)
4. Create launch scripts with proper CLI flags

---

## Proposed Solutions

### Option 1: Manual Alpine Installation (RECOMMENDED)

**Approach:** Boot from Alpine ISO, manually install, configure services.

**Pros:**
- Full control over OS installation
- Can optimize for each service
- Native performance
- Reproducible via scripts

**Cons:**
- Time-consuming (10-14 hours estimated)
- Requires manual interaction unless automated with cloud-init
- Complex for 3 different VMs

**Process:**
1. Create empty disk images with qemu-img
2. Boot vfkit with Alpine ISO attached
3. Use `--gui` flag for interactive installation
4. Install OS, partition disks, install services
5. Create launch scripts with exact vfkit CLI flags
6. Test and validate

### Option 2: Pre-built Alpine Images (FASTER)

**Approach:** Download pre-built Alpine root filesystems, customize.

**Pros:**
- Much faster (2-3 hours vs 10-14 hours)
- Alpine provides official root tarballs
- Can extract to disk images
- Automate service installation

**Cons:**
- Less control over base system
- May need additional configuration
- Still need to install services

**Process:**
1. Download Alpine ARM64 root filesystem tarball
2. Create disk images with qemu-img
3. Mount disk images (via qemu-nbd or macOS hdiutil)
4. Extract tarball to mounted disk
5. Chroot and install services
6. Unmount and create launch scripts

### Option 3: Cloud-Init Automation (BEST FOR PRODUCTION)

**Approach:** Use Alpine cloud images with cloud-init.

**Pros:**
- Fully automated
- Industry standard
- Reproducible
- No manual interaction

**Cons:**
- Requires cloud-init configuration expertise
- Alpine cloud images may not support all features
- Complex initial setup

**Process:**
1. Download Alpine cloud image
2. Create cloud-init user-data and meta-data
3. Use `--cloud-init` flag in vfkit
4. Services installed automatically on first boot
5. Create launch scripts

### Option 4: Lima/Colima Instead of vfkit (ALTERNATIVE)

**Approach:** Use Lima which supports YAML configs.

**Pros:**
- YAML configs already exist
- Better documentation
- Easier networking
- Built-in port forwarding

**Cons:**
- User explicitly said "no Docker" (Colima uses Docker)
- Different tooling than vfkit
- May not meet Swift 5 + Virtualization Framework requirement

---

## Recommended Path Forward

### Phase 1: Proof of Concept (2-3 hours)

**Goal:** Get ONE VM working (Valkey) to validate approach.

**Steps:**
1. Download Alpine 3.19 ARM64 root filesystem
2. Create 10GB disk image with qemu-img
3. Mount and extract Alpine to disk
4. Chroot and install Valkey
5. Create vfkit launch script with CLI flags
6. Test basic functionality
7. Document exact process

**Success Criteria:**
- VM boots
- Valkey responds on port 6379
- At least 8/13 Valkey tests pass

### Phase 2: Full Infrastructure (8-10 hours)

**Goal:** Build all 3 VMs with full testing.

**Steps:**
1. PostgreSQL VM (20GB root + 100GB data)
   - Install PostgreSQL 16
   - Compile pgvector from source
   - Configure data volume
   - Run 18 tests

2. Node.js Dev VM (50GB disk)
   - Install Node.js v22 via nvm
   - Install development tools
   - Configure workspace sharing
   - Run 20 tests

3. Integration testing
   - Start all 3 VMs simultaneously
   - Test cross-VM connectivity
   - Run 10 integration tests

### Phase 3: Automation (2-3 hours)

**Goal:** Create reproducible build system.

**Steps:**
1. Create `scripts/vfkit/create-vm.sh` for each VM type
2. Create `scripts/vfkit/launch-vm.sh` with proper CLI flags
3. Update `scripts/vfkit/vm-manager.sh` to work without --config
4. Document complete build process
5. Test full rebuild from scratch

---

## Technical Debt Identified

### 1. YAML Configs Cannot Be Used

**Files Affected:**
- `config/vfkit/valkey-vm.yaml`
- `config/vfkit/postgresql-pgvector-vm.yaml`
- `config/vfkit/nodejs-dev-vm.yaml`
- All other YAML files in `config/vfkit/`

**Action Required:**
- Keep YAMLs as reference documentation
- Create shell scripts with equivalent CLI flags
- Add comments explaining the YAML → CLI mapping

### 2. Test Scripts Need Rewrite

**Files Affected:**
- `tests/vm/test-valkey.test.sh`
- `tests/vm/test-postgresql.test.sh`
- `tests/vm/test-nodejs-dev.test.sh`

**Changes Needed:**
- Remove `--config` flag usage
- Replace with CLI flag equivalents
- Update VFKIT_BIN path expectations

### 3. Port Forwarding Not Built-In

**Issue:** vfkit's `virtio-net,nat` mode does NOT support port forwarding syntax.

**Impact:** Cannot do `--forward host_port:guest_port` like Docker/Lima.

**Solutions:**
- Use macOS `pf` (packet filter) rules
- Use SSH tunneling
- Use socat or netcat for port forwarding
- Switch to Lima which has built-in port forwarding

---

## vfkit Limitations vs Requirements

| Feature | Required | vfkit Support | Workaround |
|---------|----------|---------------|------------|
| YAML config | Nice to have | ❌ No | Use shell scripts |
| Port forwarding | CRITICAL | ❌ No | pf rules or SSH tunnels |
| Shared folders | Nice to have | ✅ Yes (virtio-fs) | Works |
| Multiple disks | CRITICAL | ✅ Yes | Multiple --device flags |
| NAT networking | CRITICAL | ✅ Yes (virtio-net,nat) | Works |
| Serial console | CRITICAL | ✅ Yes (virtio-serial) | Works |
| GUI access | Nice to have | ✅ Yes (--gui) | Works |
| Cloud-init | Nice to have | ✅ Yes | Works |

---

## Estimated Time to Completion

### Conservative Estimate (Manual Installation)
- Valkey VM: 3-4 hours
- PostgreSQL VM: 4-5 hours (complex: pgvector build)
- Node.js VM: 2-3 hours
- Integration & Scripts: 2-3 hours
- **Total: 11-15 hours**

### Optimistic Estimate (Pre-built Images)
- Setup automation: 2 hours
- Valkey VM: 1-2 hours
- PostgreSQL VM: 2-3 hours
- Node.js VM: 1-2 hours
- Integration & Scripts: 1-2 hours
- **Total: 7-11 hours**

### Realistic Estimate (Mixed Approach)
- Proof of concept (Valkey): 2-3 hours
- PostgreSQL with optimizations: 3-4 hours
- Node.js with nvm: 2-3 hours
- Integration, testing, docs: 2-3 hours
- **Total: 9-13 hours**

---

## Critical Decision Points

### Decision 1: Continue with vfkit or Switch to Lima?

**vfkit Pros:**
- Minimal, lightweight
- Direct Virtualization.framework access
- No additional dependencies
- Aligns with "Swift 5 + Virtualization Framework" goal

**vfkit Cons:**
- No YAML support
- No built-in port forwarding
- Limited documentation
- Requires manual networking setup

**Lima Pros:**
- YAML configs work
- Built-in port forwarding
- Better documentation
- Existing config files usable

**Lima Cons:**
- Additional dependency
- More complex architecture
- May conflict with "no Docker" requirement

**Recommendation:** Continue with vfkit for now, but document Lima as alternative.

### Decision 2: Installation Method?

**Recommendation:** Use **Option 2: Pre-built Alpine Images** for speed, with manual configuration for complex services (PostgreSQL/pgvector).

### Decision 3: Port Forwarding Solution?

**Options:**
1. macOS pf rules (complex, root required)
2. SSH tunneling (simple, user-space)
3. socat/netcat forwarding (simple, user-space)

**Recommendation:** SSH tunneling for development, pf rules for production.

---

## Next Actions

### Immediate (Next 30 minutes)
1. ✅ Document vfkit capabilities (this file)
2. ⏳ Download Alpine 3.19 ARM64 root filesystem
3. ⏳ Create proof-of-concept Valkey VM
4. ⏳ Test basic vfkit boot with CLI flags

### Short-term (Next 2-3 hours)
1. Get Valkey VM fully working
2. Create launch script template
3. Run subset of Valkey tests
4. Document process

### Medium-term (Next 8-10 hours)
1. Build PostgreSQL VM
2. Build Node.js VM
3. Run full test suite
4. Create automation scripts

---

## Conclusion

The vfkit VM infrastructure **CAN be built**, but requires:

1. **Rewriting** all launch logic to use CLI flags instead of YAML
2. **Installing** operating systems to disk images (currently empty)
3. **Implementing** port forwarding workarounds
4. **Updating** test scripts to match vfkit's actual capabilities

**Estimated Total Time:** 9-13 hours for full infrastructure with tests.

**Blocker Status:** Can proceed with manual workarounds, but significant effort required.

**Recommendation:** Proceed with Option 2 (pre-built images) for fastest path to working VMs.

---

**Document Version:** 1.0
**Status:** Analysis Complete - Ready to Begin Implementation
**Engineer:** Claude Code (Anthropic)
**Date:** October 28, 2025
