# AGENT E: PostgreSQL LDAP Dependencies Fix

## Mission Status: IN PROGRESS

### Problem Identified
PostgreSQL binary requires LDAP libraries but they are missing from the initramfs:

```
Error: Error relocating /usr/bin/postgres: ldap_initialize: symbol not found
```

### Root Cause Analysis

1. **PostgreSQL Dependencies Check**:
   - PostgreSQL binary (`usr/bin/postgres`) is present and valid (8.7M, ARM64 ELF)
   - Binary requires 19+ LDAP functions from OpenLDAP 2.200:
     - `ldap_initialize`
     - `ldap_simple_bind_s`
     - `ldap_search_s`
     - `ldap_get_option`
     - etc.

2. **Missing Libraries**:
   - `libldap.so.2` (387K) - OpenLDAP client library
   - `liblber.so.2` (66K) - LDAP BER encoding library
   - `libsasl2.so.3` (131K) - SASL authentication library

3. **Build Script Status**:
   - The packages ARE listed in `download_musl_libc()` function:
     - Line 407: `"libldap-2.6.10-r0.apk"`
     - Line 412: `"libsasl-2.1.28-r9.apk"`
   - **BUT** these libraries are not appearing in the final initramfs
   - This suggests the packages may not be extracting properly

### Investigation Findings

#### Test Results
Created and ran `scripts/test-postgresql-ldap.sh`:
```
Test 1: Extracting initramfs...
✓ Extraction complete

Test 2: PostgreSQL binary...
✓ PostgreSQL binary found: 8.7M
✓ PostgreSQL is ARM64 ELF format

Test 3: LDAP and SASL libraries...
✗ libldap.so.2 NOT FOUND
✗ liblber.so.2 NOT FOUND
✗ libsasl2.so.3 NOT FOUND
```

#### Package Download Test
Manual verification of Alpine packages:
```bash
# libldap-2.6.10-r0.apk contains:
- usr/lib/libldap.so.2 -> libldap.so.2.0.200
- usr/lib/libldap.so.2.0.200 (387K)
- usr/lib/liblber.so.2 -> liblber.so.2.0.200
- usr/lib/liblber.so.2.0.200 (66K)

# libsasl-2.1.28-r9.apk contains:
- usr/lib/libsasl2.so.3 -> libsasl2.so.3.0.0
- usr/lib/libsasl2.so.3.0.0 (131K)
- usr/lib/sasl2/* (SASL plugins)
```

### Changes Made

1. **Updated `copy_libraries()` function** (azure/build-unified-services-with-datadog.sh):
   - Added LDAP/SASL libraries to `critical_libs` verification:
     ```bash
     "libldap.so.2"
     "liblber.so.2"
     "libsasl2.so.3"
     ```
   - This will now warn if these libraries are missing during build

2. **Created Test Script** (`scripts/test-postgresql-ldap.sh`):
   - Extracts initramfs and verifies all LDAP libraries present
   - Checks PostgreSQL binary format and symbols
   - Validates library file integrity
   - Can be run to verify fix effectiveness

### Next Steps Required

The build script already downloads the correct packages, but they're not making it into the final initramfs. Possible causes:

1. **Package extraction issue**: The APK files may not be extracting properly
   - Need to verify `tar xzf "$pkg"` is working correctly
   - Check if extracted files are in expected locations

2. **Library copying issue**: Files may be extracted but not copied to initramfs
   - The `copy_libraries()` function copies from `$downloads/libs/usr/lib/`
   - Need to verify extracted libraries are in this location

3. **Build order issue**: Libraries may be extracted after they're copied
   - Need to ensure `download_musl_libc()` completes before `copy_libraries()`

### Recommended Fix

To properly debug and fix, we need to:

1. **Add debug output** to `download_musl_libc()`:
   ```bash
   # After extraction, list what was extracted
   echo "DEBUG: Extracted contents of $pkg:"
   find . -name "*ldap*" -o -name "*sasl*" | head -10
   ```

2. **Verify extraction** in `copy_libraries()`:
   ```bash
   # Before copying, check what's available
   echo "DEBUG: LDAP libraries in downloads/libs:"
   find "$downloads/libs" -name "*ldap*" -o -name "*sasl*"
   ```

3. **Alternative approach**: Explicitly download and extract LDAP packages
   - Create dedicated function `download_ldap_libraries()`
   - Download packages to separate directory
   - Explicitly extract and copy libraries

### Files Modified

1. `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
   - Added LDAP/SASL libraries to critical_libs verification (line 801-803)

2. `/tmp/vibecode-worktrees-binary/agent-fix-postgresql/scripts/test-postgresql-ldap.sh` (NEW)
   - Comprehensive test script for PostgreSQL LDAP dependencies

### Success Criteria

- [ ] All three libraries present in initramfs:
  - `libldap.so.2`
  - `liblber.so.2`
  - `libsasl2.so.3`
- [ ] Test script passes all checks
- [ ] PostgreSQL starts without "symbol not found" errors
- [ ] Can verify with: `ldd /usr/bin/postgres` (inside VM)

### Verification Command

After fix is applied and new initramfs is built:
```bash
./scripts/test-postgresql-ldap.sh
```

Expected output:
```
✓ libldap.so.2 found: 387K
✓ liblber.so.2 found: 66K
✓ libsasl2.so.3 found: 131K
✓ ALL TESTS PASSED
```

---

## Status: READY FOR BUILD DEBUG

The packages are in the build script but not making it to the final initramfs. Need to either:
1. Debug why extraction is failing, OR
2. Run a test build with debug output to see where libraries are getting lost

Current recommendation: Run the build script manually with debug output to see exactly where the LDAP libraries are being extracted and why they're not being copied to the initramfs.
