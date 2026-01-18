# Agent AC - Consolidated Production Build Instructions

**Mission**: Create single production build with all iteration 1 features

---

## Prerequisites

**Wait for**:
- Agent AA integration test results (verify 64MB build works)
- Agent AB volume mounting test results (verify persistence works)

**If AA reports PASS**: Proceed with consolidation
**If AA reports FAIL**: Analyze issues before proceeding

---

## Features to Merge

### From Agent X: Boot Display Enhancements
**Location**: `azure/build-unified-services-with-datadog.sh`
**Changes**:
- Port connectivity tests (`nc -z` checks for ports 22, 6379, 5432, 8080)
- ACCESS CREDENTIALS section with copy-paste ready connection strings

**Lines to verify**:
```bash
# After each service health check:
if nc -z -w 2 localhost 22 2>/dev/null; then
    echo "  ✓ Port 22 LISTENING"
fi

# At end of boot:
echo "==========================================="
echo "  ACCESS CREDENTIALS"
echo "==========================================="
# ... credentials display
```

### From Agent Y: Size Optimizations
**Source**: `/tmp/initramfs-analysis/` (Agent Y's optimized extraction)
**Target**: 64MB compressed

**Optimizations applied**:
1. Removed source maps (*.map files)
2. Removed TypeScript definitions (*.d.ts files)
3. Removed ThirdPartyNotices.txt and large docs
4. Replaced ICU data (30MB → 1KB stub)
5. Removed pip wheel
6. Removed specialized extensions (markdown-math, latex, profiler, debugger)
7. Removed duplicate libraries
8. Removed Python test modules
9. Removed authentication extensions
10. Removed unused language extensions
11. Cleaned Python encodings
12. Removed telemetry modules

**Critical**: If Agent AA found ICU issues, may need to restore minimal ICU data (2MB) instead of 1KB stub

### From Agent Z: Volume Mounting
**Location**: `azure/build-unified-services-with-datadog.sh` and `azure/test-unified-vm-boot.sh`

**In build script** (init script generation):
```bash
# Mount host shared directory (virtio-fs)
mkdir -p /mnt/host /mnt/config /mnt/data /mnt/logs

if mount -t virtiofs hostshare /mnt/host 2>/dev/null; then
    echo "✓ Host filesystem mounted at /mnt/host"
    # Create subdirectories
    mkdir -p /mnt/host/{config,data,logs}
    # Create symlinks
    ln -sf /mnt/host/config /mnt/config
    ln -sf /mnt/host/data /mnt/data
    ln -sf /mnt/host/logs /mnt/logs
    # Detect persistent storage
    if [ -d /mnt/host/postgresql ]; then
        POSTGRES_DATA_DIR="/mnt/host/postgresql"
    fi
    if [ -d /mnt/host/valkey ]; then
        VALKEY_DATA_DIR="/mnt/host/valkey"
    fi
fi
```

**In test script**:
```bash
SHARED_DIR="/tmp/vm-shared-storage"
MOUNT_TAG="hostshare"
--device virtio-fs,sharedDir="$SHARED_DIR",mountTag="$MOUNT_TAG"
```

---

## Build Process

### Step 1: Verify Current State

```bash
# Check that Agent X changes are present
grep "ACCESS CREDENTIALS" azure/build-unified-services-with-datadog.sh

# Check that Agent Z changes are present
grep "virtio-fs" azure/build-unified-services-with-datadog.sh
grep "virtiofs" azure/build-unified-services-with-datadog.sh

# Current build size
ls -lh azure/unified-services-static.cpio.gz
```

### Step 2: Apply Size Optimizations

Agent Y created the optimizations in `/tmp/initramfs-analysis/`. We need to rebuild the initramfs with those optimizations applied.

**Option A: Rebuild from scratch with optimizations**

```bash
cd azure
./build-unified-services-with-datadog.sh
# Then apply optimizations manually or...
```

**Option B: Copy Agent Y's optimized build**

```bash
# Agent Y's build already has optimizations but not Agent X/Z changes
# We need to rebuild WITH Agent X/Z changes AND Agent Y optimizations
```

**Recommended Approach**:
1. Agent X and Z changes are already in build script
2. Rebuild initramfs: `./azure/build-unified-services-with-datadog.sh`
3. Extract the new build
4. Apply Agent Y's optimizations to the extracted initramfs
5. Repack as `unified-services-production-v1.0.cpio.gz`

### Step 3: Apply Optimizations Script

Create optimization script:

```bash
#!/bin/bash
# apply-optimizations.sh - Apply Agent Y optimizations to new build

BUILD_DIR="/tmp/production-build"

# Extract current build
mkdir -p $BUILD_DIR
cd $BUILD_DIR
gunzip -c /Users/ryan.maclean/vibecode-webgui/azure/unified-services-static.cpio.gz | cpio -idm

# Apply optimizations (from Agent Y)

# 1. Remove source maps
find . -name "*.map" -delete

# 2. Remove TypeScript definitions
find . -name "*.d.ts" -delete

# 3. Remove large docs
find . -name "ThirdPartyNotices.txt" -size +1M -delete
find opt/openvscode/node_modules opt/openvscode/extensions/node_modules -type f \
  \( -name "README*" -o -name "CHANGELOG*" -o -name "*.md" \) -delete 2>/dev/null

# 4. Replace ICU data with stub
rm -f usr/share/icu/76.1/icudt76l.dat
dd if=/dev/zero of=usr/share/icu/76.1/icudt76l.dat bs=1024 count=1 2>/dev/null

# 5. Remove pip wheel
rm -f usr/lib/python3.12/ensurepip/_bundled/pip-25.0.1-py3-none-any.whl

# 6. Remove specialized extensions
rm -rf opt/openvscode/extensions/{markdown-math,latex,ms-vscode.vscode-js-profile-table}

# 7. Remove duplicate libs
rm -f usr/lib/libicui18n.so.76 usr/lib/libicuuc.so.76 usr/lib/libstdc++.so.6

# 8. Remove Python test modules
rm -rf usr/lib/python3.12/{unittest,lib2to3,pydoc_data,turtledemo,turtle.py,tarfile.py,test} 2>/dev/null

# 9. Remove auth extensions
rm -rf opt/openvscode/extensions/{github,github-authentication,microsoft-authentication}

# 10. Remove unused language extensions
for lang in objective-c php swift perl ruby java fsharp coffeescript rust powershell groovy pug lua vb restructuredtext shaderlab hlsl dart clojure docker; do
  rm -rf opt/openvscode/extensions/$lang opt/openvscode/extensions/${lang}-language-features 2>/dev/null
done

# 11. Remove TypeScript locales
rm -rf opt/openvscode/extensions/node_modules/typescript/lib/{cs,de,es,fr,it,ja,ko,pl,pt-br,ru,tr,zh-cn,zh-tw}

# 12. Remove node_modules docs
find opt/openvscode/node_modules -type f \
  \( -name "*.md" -o -name "*.txt" -o -name "LICENSE*" -o -name "CHANGELOG*" -o -name "*.markdown" \) -delete

# 13. Remove debugger extensions
rm -rf opt/openvscode/extensions/{ms-vscode.js-debug,ms-vscode.js-debug-companion}

# 14. Clean Python encodings
cd usr/lib/python3.12/encodings
ls | grep -v -E "(utf_8|ascii|latin_1|__init__|aliases)" | xargs rm -f
cd $BUILD_DIR

# 15. Remove CJK codecs
rm -f usr/lib/python3.12/lib-dynload/_codecs_{cn,hk,iso2022,jp,kr,tw}.cpython-312-aarch64-linux-musl.so

# 16. Remove test/curses modules
rm -f usr/lib/python3.12/lib-dynload/{_curses,_curses_panel,_dbm,_ctypes_test}.cpython-312-aarch64-linux-musl.so 2>/dev/null

# 17. Remove HTML/CSS/theme extensions
rm -rf opt/openvscode/extensions/{html-language-features,css-language-features,extension-editing,ipynb,simple-browser,theme-*}

# 18. Remove tree-sitter
rm -rf opt/openvscode/node_modules/@vscode/tree-sitter-wasm

# 19. Remove telemetry
rm -rf opt/openvscode/node_modules/@microsoft/{1ds-core-js,1ds-post-js,dynamicproto-js}

# 20. Remove markdown extension
rm -rf opt/openvscode/extensions/markdown-language-features

# Repack
echo "Repacking optimized initramfs..."
find . | cpio -o -H newc 2>/dev/null | gzip -9 > /Users/ryan.maclean/vibecode-webgui/azure/unified-services-production-v1.0.cpio.gz

# Check size
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/unified-services-production-v1.0.cpio.gz

echo "Done! Production build created."
```

### Step 4: Build and Optimize

```bash
# 1. Rebuild with latest changes
cd /Users/ryan.maclean/vibecode-webgui/azure
./build-unified-services-with-datadog.sh

# 2. Apply optimizations
chmod +x apply-optimizations.sh
./apply-optimizations.sh

# 3. Check final size
ls -lh azure/unified-services-production-v1.0.cpio.gz
```

### Step 5: Test Production Build

```bash
# Quick boot test
./test-unified-vm-boot.sh  # but point to production build

# Verify:
# - All 4 services start
# - Port tests visible
# - Credentials displayed
# - Volume mounting works (if configured)
# - Size ≤ 65MB
```

---

## Quality Checklist

Before declaring production build complete:

- [ ] Build completes successfully
- [ ] Size ≤ 65MB (target: 64-65MB)
- [ ] Agent X features present (port tests, credentials)
- [ ] Agent Z features present (volume mounting)
- [ ] All 4 services start
- [ ] No critical errors in console
- [ ] ICU data sufficient for PostgreSQL (check Agent AA report)
- [ ] Boot time ≤ 15 seconds
- [ ] Console output clean and professional

---

## Output Files

Create these files:

1. **Production Build**:
   - `azure/unified-services-production-v1.0.cpio.gz` (~64-65MB)

2. **Checksums**:
   ```bash
   sha256sum azure/unified-services-production-v1.0.cpio.gz > azure/unified-services-production-v1.0.cpio.gz.sha256
   ```

3. **Build Manifest**:
   - `azure/unified-services-production-v1.0-manifest.txt`
   - List all included services, versions, features

4. **Report**:
   - `AGENT-AC-PRODUCTION-BUILD-REPORT.md`
   - Build process, size metrics, features included, test results

---

## Success Criteria

**PASS if**:
- Build size 64-66MB
- All services start
- All Agent X/Y/Z features present
- No critical regressions

**CONDITIONAL PASS if**:
- Size 66-70MB (acceptable if more stable)
- Minor feature limitations documented

**FAIL if**:
- Services don't start
- Size > 70MB
- Critical features missing

---

## Troubleshooting

### If PostgreSQL fails (ICU issue):
- Restore minimal ICU data (2MB instead of 1KB)
- Test again
- Document ICU requirement

### If services fail:
- Check which optimization broke it
- Remove that specific optimization
- Rebuild and test
- Document known limitation

### If size > 65MB:
- Identify largest remaining components
- Consider additional removals:
  - More extensions
  - More Python modules
  - Strip binaries (postgres, node)

---

## Agent AC Task Summary

1. Wait for AA/AB completion
2. Review test results
3. Create consolidation script
4. Rebuild with all features
5. Apply optimizations
6. Test production build
7. Generate checksums and manifest
8. Document in report

**Estimated time**: 30-40 minutes
**Expected output**: Production-ready 64-66MB build with all features
