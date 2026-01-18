# Agent M: PostgreSQL Quick Fix Guide

## The Problem in One Sentence

initdb looks for postgres at `/usr/libexec/postgresql16/postgres` but the build script puts it in `/usr/bin/postgres`.

## The Fix (3 Changes Required)

### 1. Fix Build Script - PostgreSQL Binary Copy

**File**: `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
**Lines**: 244-250

**CHANGE FROM**:
```bash
local pg_bin_dir=$(dirname "$pg_path")
mkdir -p "$pg_dir/usr/bin"

# Copy main binaries
cp "$pg_path" "$pg_dir/usr/bin/"
[ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/bin/" || true
[ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/bin/" || true
[ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/bin/" || true
```

**CHANGE TO**:
```bash
local pg_bin_dir=$(dirname "$pg_path")
mkdir -p "$pg_dir/usr/libexec/postgresql16"

# Copy main binaries to correct location (libexec not bin)
cp "$pg_path" "$pg_dir/usr/libexec/postgresql16/"
[ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/libexec/postgresql16/" || true
[ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/libexec/postgresql16/" || true
[ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/libexec/postgresql16/" || true
```

### 2. Fix Build Script - Copy to Initramfs

**File**: Same file
**Lines**: 799-806

**CHANGE FROM**:
```bash
if [ -d "$downloads/postgresql/usr/bin" ]; then
    info "Copying PostgreSQL binaries..."
    cp -r "$downloads/postgresql/usr/bin/"* "$initramfs/usr/bin/" 2>/dev/null || true
fi
```

**CHANGE TO**:
```bash
if [ -d "$downloads/postgresql/usr/libexec/postgresql16" ]; then
    info "Copying PostgreSQL binaries..."
    mkdir -p "$initramfs/usr/libexec/postgresql16"
    cp -r "$downloads/postgresql/usr/libexec/postgresql16/"* "$initramfs/usr/libexec/postgresql16/" 2>/dev/null || true
fi
```

### 3. Fix Init Script - Binary Paths

**File**: Template that generates `/init` in initramfs
**Search for**: References to `/usr/bin/initdb` and `/usr/bin/postgres`

**In build script around line 900-950** (where init script is generated):

**CHANGE**:
```bash
# Line with initdb call (around line 233 of generated init):
/usr/bin/initdb -U postgres ...
# TO:
/usr/libexec/postgresql16/initdb -U postgres ...

# Line with postgres startup (around line 306 of generated init):
su postgres -c "/usr/bin/postgres -D /var/lib/postgresql/data"
# TO:
su postgres -c "/usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data"
```

## Quick Test After Fix

```bash
# 1. Rebuild
cd /Users/ryan.maclean/vibecode-webgui/azure
./build-unified-services-with-datadog.sh

# 2. Extract and verify
mkdir /tmp/test-fix
cd /tmp/test-fix
gunzip -c ../unified-services-static.cpio.gz | cpio -idm

# 3. Check paths exist
ls -la usr/libexec/postgresql16/postgres
ls -la usr/libexec/postgresql16/initdb

# 4. Verify initdb can find it
strings usr/libexec/postgresql16/initdb | grep libexec
# Should show: /usr/libexec/postgresql16
```

## Why This Fix Works

- initdb is hardcoded at compile time to look for postgres at `/usr/libexec/postgresql16/postgres`
- We cannot change this without recompiling PostgreSQL
- Therefore we must put the binaries where initdb expects them
- This matches the standard Alpine Linux PostgreSQL package structure

## Alternative: Symlink Approach (Not Recommended)

If you can't modify the build script, add symlinks in the initramfs:

```bash
mkdir -p initramfs/usr/libexec/postgresql16
ln -s ../../bin/postgres initramfs/usr/libexec/postgresql16/postgres
ln -s ../../bin/initdb initramfs/usr/libexec/postgresql16/initdb
```

But this is messier and should only be used as a temporary workaround.

---

**Estimated Time to Fix**: 10 minutes
**Risk Level**: Low (isolated to PostgreSQL paths)
**Testing Required**: Boot test to verify PostgreSQL starts
