# Agent M: PostgreSQL initdb Deep Diagnostic Report

## Executive Summary

PostgreSQL initdb is failing because the `postgres` backend binary is installed at `/usr/bin/postgres`, but `initdb` is hardcoded to look for it at `/usr/libexec/postgresql16/postgres`. This is a PATH MISMATCH BUG in the build script.

## Diagnostic Process

### 1. Initramfs Extraction Analysis

**Location**: `/tmp/agent-m-diagnosis/`
**Extraction Command**:
```bash
gunzip -c unified-services-static.cpio.gz | cpio -idm
```
**Result**: Successfully extracted 481466 blocks

### 2. Init Script Analysis

**File**: `/tmp/agent-m-diagnosis/init`
**Lines 220-249**: PostgreSQL initialization logic

**Key Finding**: Init script calls initdb correctly (lines 231-233):
```bash
if (cd /var/lib/postgresql && \
    HOME=/var/lib/postgresql USER=postgres LOGNAME=postgres \
    /usr/bin/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --no-locale --encoding=UTF8)
```

The error handling is present (lines 240-247):
```bash
else
    echo "⚠ Database initialization failed (will skip PostgreSQL)"
    echo "  Error log: /tmp/postgresql-init.log"
    if [ -f /tmp/postgresql-init.log ]; then
        echo "  First 10 lines of error:"
        head -10 /tmp/postgresql-init.log | sed 's/^/    /'
    fi
fi
```

### 3. User and Permissions Check

**Findings**:
- `/etc/passwd`: postgres user exists (UID 70, GID 70, home `/var/lib/postgresql`)
- `/etc/group`: postgres group exists (GID 70)
- `/bin/su`: symlink to busybox EXISTS (Agent J's fix worked)
- Directory structure: Correct permissions would be set by init script

**Verdict**: User setup is CORRECT

### 4. Binary Location Analysis

**initdb binary**:
- Location: `/tmp/agent-m-diagnosis/usr/bin/initdb`
- Type: ELF 64-bit LSB pie executable, ARM aarch64
- Size: 199,696 bytes
- Interpreter: `/lib/ld-musl-aarch64.so.1`

**postgres binary**:
- Location: `/tmp/agent-m-diagnosis/usr/bin/postgres`
- Type: ELF 64-bit LSB pie executable, ARM aarch64
- Size: 9,154,288 bytes

**Critical Discovery**: Using `strings` on initdb binary:
```bash
$ strings /tmp/agent-m-diagnosis/usr/bin/initdb | grep -E "libexec|share"
/usr/libexec/postgresql16
/usr/share/postgresql16
```

**ROOT CAUSE IDENTIFIED**: initdb is hardcoded to look for:
1. Backend binary: `/usr/libexec/postgresql16/postgres`
2. Share files: `/usr/share/postgresql16/`

### 5. Directory Structure Verification

**What EXISTS in initramfs**:
```
/usr/bin/postgres                    ✓ (but wrong location)
/usr/bin/initdb                      ✓
/usr/lib/postgresql16/               ✓ (extensions)
/usr/share/postgresql16/             ✓ (includes postgres.bki)
/lib/ld-musl-aarch64.so.1           ✓
```

**What is MISSING**:
```
/usr/libexec/                        ✗ (directory doesn't exist)
/usr/libexec/postgresql16/           ✗ (directory doesn't exist)
/usr/libexec/postgresql16/postgres   ✗ (expected by initdb)
```

### 6. Build Script Analysis

**File**: `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
**Lines 237-254**: PostgreSQL binary copy logic

**The Bug**:
```bash
# Line 240: Searches for postgres in correct location
for pg_path in "$temp_extract/usr/libexec/postgresql16/postgres" ...; do
    if [ -f "$pg_path" ]; then
        local pg_bin_dir=$(dirname "$pg_path")
        mkdir -p "$pg_dir/usr/bin"

        # Line 247: BUT COPIES TO WRONG LOCATION
        cp "$pg_path" "$pg_dir/usr/bin/"  # ← BUG: Should preserve libexec path
        [ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/bin/" || true
```

The script finds the binaries at `/usr/libexec/postgresql16/` but copies them to `/usr/bin/`, breaking the hardcoded paths in initdb.

### 7. Historical Evidence

**Git commit 4510a8827** (Dec 16, 2025):
```
fix: correct Alpine package extraction paths for Dropbear and PostgreSQL

- Dropbear binary is in usr/sbin/ not usr/bin/
- PostgreSQL binaries are in usr/libexec/postgresql16/
- All binaries now correctly Linux ELF arm64
```

This commit in the Ansible playbook shows the correct path structure was known, but the bash build script (`build-unified-services-with-datadog.sh`) doesn't follow this pattern.

## Root Cause Summary

**The Issue**: Path Structure Mismatch
- Alpine PostgreSQL packages install binaries to `/usr/libexec/postgresql16/`
- The `initdb` binary is hardcoded to execute `/usr/libexec/postgresql16/postgres` as the backend
- Build script copies binaries to `/usr/bin/` instead of preserving the libexec structure
- When initdb runs, it cannot find the postgres backend and fails

**Why Agent J's Fixes Didn't Work**:
- Agent J focused on the `su` command and user switching
- The busybox `su` symlink fix was correct and needed
- The environment variable fixes were correct
- However, the underlying path mismatch bug prevented initdb from ever reaching the user permission checks

## Recommended Fix

### Option 1: Preserve Original Path Structure (RECOMMENDED)

Modify `build-unified-services-with-datadog.sh` lines 244-248:

```bash
# BEFORE (WRONG):
local pg_bin_dir=$(dirname "$pg_path")
mkdir -p "$pg_dir/usr/bin"
cp "$pg_path" "$pg_dir/usr/bin/"
[ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/bin/" || true

# AFTER (CORRECT):
local pg_bin_dir=$(dirname "$pg_path")
mkdir -p "$pg_dir/usr/libexec/postgresql16"
cp "$pg_path" "$pg_dir/usr/libexec/postgresql16/"
[ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/libexec/postgresql16/" || true
[ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/libexec/postgresql16/" || true
[ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/libexec/postgresql16/" || true
```

Also update init script to call binaries from correct location:

```bash
# Line 233 in init script:
/usr/libexec/postgresql16/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --no-locale --encoding=UTF8

# Line 306 in init script:
su postgres -c "/usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data"
```

### Option 2: Create Symlinks (FALLBACK)

Add symlinks in the initramfs assembly phase:

```bash
mkdir -p "$initramfs/usr/libexec/postgresql16"
ln -s /usr/bin/postgres "$initramfs/usr/libexec/postgresql16/postgres"
ln -s /usr/bin/initdb "$initramfs/usr/libexec/postgresql16/initdb"
ln -s /usr/bin/pg_ctl "$initramfs/usr/libexec/postgresql16/pg_ctl"
```

## Verification Steps

After implementing the fix:

1. Extract the new initramfs:
   ```bash
   mkdir /tmp/verify-fix
   cd /tmp/verify-fix
   gunzip -c unified-services-static.cpio.gz | cpio -idm
   ```

2. Verify directory structure:
   ```bash
   ls -la /tmp/verify-fix/usr/libexec/postgresql16/postgres
   ls -la /tmp/verify-fix/usr/libexec/postgresql16/initdb
   ```

3. Verify hardcoded paths match:
   ```bash
   strings /tmp/verify-fix/usr/libexec/postgresql16/initdb | grep libexec
   # Should output: /usr/libexec/postgresql16
   ```

4. Boot test with error logging:
   - Check `/tmp/postgresql-init.log` should now show successful initialization
   - PostgreSQL should start and accept connections

## Impact Assessment

**Severity**: HIGH
**Scope**: Affects all PostgreSQL initialization attempts
**Workaround**: None without rebuilding initramfs

**Why This Wasn't Caught Earlier**:
- Error message was generic ("initialization failed")
- Log file `/tmp/postgresql-init.log` not easily accessible without SSH
- Build script succeeded without errors
- Binary extraction and copying appeared correct

## Files Analyzed

1. `/tmp/agent-m-diagnosis/init` - Init script (466 lines)
2. `/tmp/agent-m-diagnosis/usr/bin/initdb` - initdb binary
3. `/tmp/agent-m-diagnosis/usr/bin/postgres` - postgres binary
4. `/tmp/agent-m-diagnosis/etc/passwd` - User configuration
5. `/tmp/agent-m-diagnosis/etc/group` - Group configuration
6. `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh` - Build script
7. Git commit 4510a8827 - Historical path structure documentation

## Confidence Level

**95% Confident** this is the root cause because:
1. initdb binary strings clearly show hardcoded path `/usr/libexec/postgresql16`
2. Directory structure analysis confirms this path doesn't exist
3. Build script analysis shows the bug where files are copied to wrong location
4. Git history confirms the correct path structure
5. All other aspects (user, permissions, su symlink) are correct

---

**Agent M Diagnostic Complete**
**Timestamp**: 2026-01-05
**Next Agent**: Should implement Option 1 fix and rebuild initramfs
