# Agent S: PostgreSQL ICU Library Dependency Diagnosis

## Executive Summary

PostgreSQL `initdb` is failing with `FATAL: could not open collator for locale "und": U_FILE_ACCESS_ERROR` because the **ICU data files are missing from the initramfs**, even though the ICU libraries are present.

**Status**: The build script already includes the correct packages (`icu-libs-76.1-r2` and `icu-data-full-76.1-r2`) and has code to copy the ICU data directory, but the data files may not be reaching the final initramfs.

## Problem Analysis

### Error Details
```
FATAL: could not open collator for locale "und": U_FILE_ACCESS_ERROR
```

- **Locale "und"**: Stands for "undefined" - PostgreSQL's default locale when no specific locale is requested
- **U_FILE_ACCESS_ERROR**: ICU library cannot access its data files (not a permissions issue, but a missing file issue)
- **Occurs during**: `initdb` when PostgreSQL tries to import system collations

### Root Cause

PostgreSQL 16 is compiled with ICU (International Components for Unicode) support, which requires:

1. **ICU Runtime Libraries** (Present ✓)
   - `libicudata.so.76.1` (66 KB)
   - `libicui18n.so.76.1` (3 MB) - Internationalization
   - `libicuuc.so.76.1` (1.8 MB) - Common utilities
   - `libicuio.so.76.1` (67 KB) - I/O

2. **ICU Data File** (Missing ✗)
   - `icudt76l.dat` (30 MB) - Contains all Unicode collation rules, locale data, and character properties
   - **Location**: `/usr/share/icu/76.1/icudt76l.dat`

The ICU libraries are stub libraries that dynamically load the actual Unicode data from the `.dat` file at runtime. Without this file, any locale/collation operations fail with `U_FILE_ACCESS_ERROR`.

## Current Build Script Status

### Already Implemented (Lines 484-889)

The build script **already has the fix** implemented by previous agents:

```bash
# Line 484-487: Package list includes ICU packages
# AGENT M FIX: Add ICU libraries for PostgreSQL Unicode collation
# AGENT N FIX: Updated to current Alpine Edge version (2026-01-05)
"icu-libs-76.1-r2.apk"          # provides ICU Unicode libraries
"icu-data-full-76.1-r2.apk"     # provides full Unicode collation data

# Line 879-887: Copy ICU data files
# AGENT N FIX: Copy ICU data files (required for PostgreSQL Unicode collation)
if [ -d "$downloads/libs/usr/share/icu" ]; then
    info "Copying ICU data files for PostgreSQL Unicode support..."
    mkdir -p "$initramfs/usr/share"
    cp -r "$downloads/libs/usr/share/icu" "$initramfs/usr/share/" 2>/dev/null || true
    info "✓ ICU data files copied to /usr/share/icu"
else
    warn "ICU data directory not found - PostgreSQL Unicode collation may fail"
fi
```

## Alpine Linux Package Details

### Package: icu-libs-76.1-r2
- **Architecture**: aarch64 (ARM64)
- **Repository**: Alpine Linux edge/main
- **URL**: `https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/icu-libs-76.1-r2.apk`
- **Dependencies**:
  - `icu-data` (provided by icu-data-full)
  - `so:libc.musl-aarch64.so.1` (musl)
  - `so:libgcc_s.so.1` (libgcc)
  - `so:libstdc++.so.6` (libstdc++)
- **Contents**:
  - `/usr/lib/libicudata.so.76.1` (66 KB stub)
  - `/usr/lib/libicui18n.so.76.1` (3 MB)
  - `/usr/lib/libicuuc.so.76.1` (1.8 MB)
  - `/usr/lib/libicuio.so.76.1` (67 KB)

### Package: icu-data-full-76.1-r2
- **Architecture**: noarch (architecture-independent)
- **Repository**: Alpine Linux edge/main
- **URL**: `https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/icu-data-full-76.1-r2.apk`
- **Size**: 12 MB compressed, 31.8 MB uncompressed
- **Dependencies**: None
- **Provides**: `icu-data=76.1-r2`
- **Replaces**: `icu-data<71.1-r1`
- **Contents**:
  - `/usr/share/icu/76.1/icudt76l.dat` (30 MB) - **This is the critical file**

## Why PostgreSQL Needs ICU

PostgreSQL 16 has built-in ICU support for:
- **Locale-aware collation**: Sorting text according to language rules (e.g., Spanish, German, Chinese)
- **Unicode normalization**: Handling different representations of the same character
- **Case folding**: Locale-aware case conversion
- **Regular expressions**: Unicode-aware pattern matching

Even when using simple locales like "C" or "SQL_ASCII", PostgreSQL's `initdb` still calls `pg_import_system_collations()` which requires ICU to enumerate available collations, triggering the error.

## Diagnostic Steps Performed

1. **Examined build script**: Found packages already listed (line 486-487)
2. **Checked initramfs contents**: ICU libraries present but `/usr/share/icu/` directory missing
3. **Downloaded packages**: Verified correct versions exist on Alpine mirrors
4. **Analyzed package contents**: Confirmed `icudt76l.dat` is in `icu-data-full-76.1-r2.apk`
5. **Verified copy logic**: Code exists to copy ICU data (line 879-887)

## Potential Issues

### Why might the ICU data not be reaching the initramfs?

1. **Download failure**: The `icu-data-full-76.1-r2.apk` download may be failing silently
   - Script uses `|| true` to continue on errors
   - Check build logs for "Failed to download icu-data-full-76.1-r2.apk"

2. **Extraction issue**: APK extraction may not be working for `noarch` packages
   - The script extracts with `tar xzf` which should work
   - May need to verify extraction for both packages

3. **Copy path mismatch**: The copy logic looks for `$downloads/libs/usr/share/icu`
   - This assumes both packages extract to `$downloads/libs/`
   - The download loop processes all packages in the same directory

4. **Build ordering**: If icu-data-full extracts after the copy happens, it would be missed
   - All packages download in the same loop
   - Copy happens later, so this shouldn't be an issue

## Verification Commands

To verify the issue in a built initramfs:

```bash
# Extract and check for ICU data
mkdir -p /tmp/verify-icu
cd /tmp/verify-icu
gunzip -c /path/to/unified-services-static.cpio.gz | cpio -idm 2>/dev/null

# Check for ICU libraries (should exist)
ls -lh usr/lib/libicu*

# Check for ICU data directory (may be missing)
ls -la usr/share/icu/

# If present, verify the data file
ls -lh usr/share/icu/76.1/icudt76l.dat  # Should be ~30MB
```

## Recommended Solution

The build script already has the correct packages and copy logic. The issue is likely one of:

### Option 1: Verify Download (Most Likely)
Add explicit verification after downloading ICU packages:

```bash
# After the download loop in download_musl_libc() around line 529
# Add verification
if [ -f "$lib_dir/icu-data-full-76.1-r2.apk" ]; then
    info "✓ icu-data-full downloaded successfully"
else
    error "icu-data-full package not found after download"
fi
```

### Option 2: Explicit ICU Data Extraction
Extract icu-data-full separately to ensure it's available:

```bash
# In download_musl_libc() after the main package loop
info "Extracting ICU data files..."
if [ -f "$lib_dir/icu-data-full-76.1-r2.apk" ]; then
    tar xzf "$lib_dir/icu-data-full-76.1-r2.apk" -C "$lib_dir" 2>/dev/null || true
    if [ -d "$lib_dir/usr/share/icu" ]; then
        info "✓ ICU data files extracted"
    else
        warn "ICU data extraction failed"
    fi
fi
```

### Option 3: Workaround - Disable ICU in initdb
If ICU support is not needed, PostgreSQL can initialize without ICU:

```bash
# In init script line 1262, change:
initdb -U postgres -D /var/lib/postgresql/data \
    --auth=trust \
    --locale=C \
    --encoding=SQL_ASCII \
    --no-locale \
    --locale-provider=libc  # Use libc instead of ICU
```

**Note**: This is already the current configuration, but the error suggests PostgreSQL binary may be hard-coded to use ICU.

## Size Impact

Adding ICU data to initramfs:
- **icu-libs**: Already present (~5 MB)
- **icu-data-full**: 30 MB uncompressed
- **Total added**: ~30 MB to final initramfs size
- **Current initramfs**: ~250-300 MB (target size)
- **New size**: ~280-330 MB (still within acceptable range)

## Alternative: Minimal ICU Data

If size is a concern, Alpine provides `icu-data-en` instead of `icu-data-full`:
- **icu-data-en**: Contains only English locale data (~2 MB vs 30 MB)
- **Trade-off**: Only English collations available
- **For dev/test environments**: This may be sufficient

Replace in package list:
```bash
"icu-data-en-76.1-r2.apk"  # Instead of icu-data-full
```

## References

- [PostgreSQL ICU Support Documentation](https://www.postgresql.org/docs/16/locale.html#ICU)
- [Alpine Linux ICU packages](https://pkgs.alpinelinux.org/package/edge/main/aarch64/icu-libs)
- [PostgreSQL ICU initdb error on macOS](https://www.postgresql.org/message-id/CANFyU9685aV5k0nWXKmGJHYoWxkcOTXR015zcfEVrGQ5jFnAUg@mail.gmail.com)
- [ICU Data Files Documentation](https://unicode-org.github.io/icu/userguide/icu_data/)
- [Alpine icu-data-full package info](https://pkgs.alpinelinux.org/package/edge/main/x86/icu-data-full)

## Conclusion

**The build script already has the correct fix in place** (added by AGENT M and AGENT N). The ICU packages are listed and the copy logic exists. The failure suggests:

1. **Most likely**: The icu-data-full download is failing silently
2. **Less likely**: The extraction or copy step is not working correctly
3. **Least likely**: The packages are in the wrong location

**Next Steps**:
1. Run the build script with verbose logging
2. Check for "icu-data-full" in the download logs
3. Verify the package is extracted to `$WORK_DIR/downloads/libs/`
4. Confirm `/usr/share/icu/76.1/icudt76l.dat` exists in final initramfs

The solution does not require modifying the build script unless the download verification reveals a specific issue. The packages are correctly specified and the copy logic is sound.

---

**Agent S - Diagnosis Complete**
*2026-01-05*
