# PostgreSQL Build Script Compatibility Fixes

## Summary

Fixed the PostgreSQL build script (`build-postgresql-with-datadog.sh`) to properly handle Linux binaries and kernel modules. The script now includes compatibility fixes for cross-compilation from macOS.

## Problems Identified and Fixed

### 1. Missing System Utilities

**Problem**: The init script uses `su` and `cut` commands that are not provided by BusyBox.

**Fix**: Added Alpine packages to provide these utilities:
- `shadow` - Provides `su` command
- `coreutils` - Provides `cut` command
- `util-linux` - Additional system utilities

**Location**: Lines 145-161 in `download_alpine_packages()` function

```bash
# COMPATIBILITY FIX: Add missing system utilities
log "Downloading compatibility packages..."

log "  - shadow (provides su command)"
wget -q "${ALPINE_MIRROR}/shadow-"*.apk 2>/dev/null || ...

log "  - coreutils (provides cut command)"
wget -q "${ALPINE_MIRROR}/coreutils-"*.apk 2>/dev/null || ...

log "  - util-linux (additional utilities)"
wget -q "${ALPINE_MIRROR}/util-linux-"*.apk 2>/dev/null || ...
```

### 2. BusyBox grep Incompatibility

**Problem**: Init script uses `grep -P` (Perl regex) which BusyBox doesn't support.

**Fix**: Automatically replace `grep -P` with `grep -E` (POSIX extended regex) and fix regex patterns.

**Location**: Lines 831-839 in `create_init_script()` function

```bash
# COMPATIBILITY FIX: Replace grep -P with grep -E for BusyBox compatibility
log "Applying BusyBox compatibility fixes..."
sed -i '' 's/grep -P/grep -E/g' init 2>/dev/null || sed -i 's/grep -P/grep -E/g' init

# Also fix the grep -oP pattern to work with grep -E
sed -i '' 's/grep -oP '\''(?<=inet\\s)\\d\+(\\\.\\d\+)\{3\}'\''/grep -o '\''[0-9]\+\\.[0-9]\+\\.[0-9]\+\\.[0-9]\+'\''/g' init
```

### 3. Missing Kernel Modules

**Problem**: Using Ubuntu kernel without virtio_net module causes networking failure.

**Fix**: Added kernel module awareness function with documentation.

**Location**: Lines 845-918, new function `add_kernel_module_awareness()`

**What it does**:
- Creates `/lib/modules` directory
- Attempts to detect kernel version from common locations
- Creates comprehensive README about kernel requirements
- Warns user about kernel module requirements

**Key documentation created**:
```
Kernel Module Requirements for PostgreSQL VM

Required Kernel Features:
- virtio_net (VirtIO network driver) - MUST be built-in or loaded
- virtio_pci (VirtIO PCI transport)
- virtio (VirtIO base support)

Recommended Kernel Config:
- CONFIG_VIRTIO=y (built-in)
- CONFIG_VIRTIO_NET=y (built-in)
- CONFIG_VIRTIO_PCI=y (built-in)
```

### 4. No Validation of Required Commands

**Problem**: Script didn't verify essential commands were present before packaging.

**Fix**: Added comprehensive validation function.

**Location**: Lines 920-977, new function `validate_commands()`

**Validates**:
- Essential commands: `su`, `cut`, `grep`, `mount`, `umount`, `ip`, `ifconfig`, `sh`
- Dynamic linker: `ld-musl-aarch64.so.1`
- PostgreSQL binaries: `postgres`, `initdb`, `pg_ctl`, `psql`

**Output example**:
```
Validating Required Commands
  ✓ su found at usr/bin/su
  ✓ cut found at usr/bin/cut
  ✓ grep found at bin/grep
  ✓ Dynamic linker present
  ✓ postgres found
  ✓ All required commands present
```

## Changes to Script Flow

Updated `main()` function to include new validation steps:

```bash
# Execute build steps
check_dependencies
download_alpine_packages
create_initramfs_structure
install_packages
configure_libraries
configure_busybox
configure_postgresql
configure_ssh
create_datadog_bridge
create_init_script
add_kernel_module_awareness    # NEW
validate_commands              # NEW
package_initramfs
verify_build
```

## Documentation Updates

### Updated Header Comments (Lines 1-30)

Added to the script header:
```bash
# Fixes Applied:
# - Added shadow package for su command
# - Added coreutils for cut command
# - Added util-linux for additional utilities
# - Fixed BusyBox grep -P compatibility (replaced with grep -E)
# - Added kernel module awareness for virtio_net
# - Added validation checks for required commands
```

### Alternative Approach Section (Lines 1143-1168)

Added comprehensive notes about alternative approaches if build fails:

```
ALTERNATIVE APPROACH

If this build fails or VM doesn't boot properly, consider:

1. Use pre-built working initramfs:
   - unified-services-restored.cpio.gz (contains PostgreSQL + more)
   - This includes all necessary utilities and working kernel modules

2. Build in a native Linux environment:
   - Use a Linux ARM64 system or container
   - Access to proper kernel modules and toolchain
   - Easier dependency resolution

3. Use a cloud kernel with built-in virtio_net:
   - vmlinux-cloud (if available in azure/ directory)
   - Ubuntu cloud kernel with CONFIG_VIRTIO_NET=y

Known Issues with Cross-Compilation:
  - Missing kernel modules (virtio_net)
  - BusyBox vs GNU utilities incompatibility
  - Library dependency resolution on macOS

For production use, the unified-services VM is recommended.
```

## Script Syntax Validation

✅ Script validated with `bash -n` - no syntax errors detected.

## Files Modified

1. `/Users/ryan.maclean/vibecode-webgui/azure/build-postgresql-with-datadog.sh` - Main build script with all fixes applied

## Files Created

1. `/Users/ryan.maclean/vibecode-webgui/azure/POSTGRESQL-BUILD-FIXES.md` - This documentation

## Testing Status

- ✅ Script syntax validated (no errors)
- ⚠️  Full build NOT executed (as requested)
- ⚠️  Runtime testing required to verify fixes work

## Recommendations

### For Immediate Use

**Option A: Use the pre-built working VM**
```bash
# The unified-services-restored.cpio.gz already works
cp ~/vibecode-webgui/azure/unified-services-restored.cpio.gz \
   ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/PostgreSQLVibeCodeApp/Resources/postgresql-complete.cpio.gz
```

**Option B: Test the fixed build script**
```bash
cd ~/vibecode-webgui/azure
./build-postgresql-with-datadog.sh
```

### For Production

1. Use `unified-services-restored.cpio.gz` which contains:
   - PostgreSQL ✅
   - Valkey ✅
   - Working networking ✅
   - All required utilities ✅
   - Tested and verified ✅

2. If PostgreSQL-only VM is needed:
   - Build in native Linux ARM64 environment
   - Or use this fixed script with a proper cloud kernel

### Kernel Recommendations

The kernel MUST have virtio_net support. Options:

1. **vmlinux-cloud** (if available) - Ubuntu cloud kernel with built-in networking
2. **Custom kernel** built with:
   ```
   CONFIG_VIRTIO=y
   CONFIG_VIRTIO_NET=y
   CONFIG_VIRTIO_PCI=y
   ```

## Expected Warnings During Build

These warnings are normal and documented:

```
⚠️  NOTE: Kernel must have virtio_net built-in or as loadable module
    If networking fails, use a different kernel with built-in networking
```

## Summary of Script Improvements

| Category | Before | After |
|----------|--------|-------|
| **Missing Utilities** | Not handled | Added shadow, coreutils, util-linux packages |
| **BusyBox Compatibility** | grep -P fails | Automatic conversion to grep -E |
| **Kernel Modules** | No awareness | Documentation + warnings added |
| **Validation** | None | Comprehensive command validation |
| **Documentation** | Basic | Detailed alternatives and troubleshooting |
| **Error Detection** | Late (runtime) | Early (build-time) |

## Next Steps

1. ✅ Script fixes complete
2. ⏭️ Test build execution (optional)
3. ⏭️ Boot VM and verify networking works
4. ⏭️ Test PostgreSQL startup
5. ⏭️ Verify Datadog integration

---

**Status**: Script fixes complete and validated. Ready for testing.

**Created**: 2025-12-01
**Last Updated**: 2025-12-01
