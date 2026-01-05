#!/bin/bash
# Test script to verify OpenVSCode Node.js binary path fix
# This validates that all GNU libc compatibility symlinks are present

set -e

INITRAMFS="/tmp/unified-services-consolidated.cpio.gz"
EXTRACT_DIR="/tmp/test-openvscode-fix-$$"

echo "=== OpenVSCode Node.js Binary Path Fix Test ==="
echo ""

# Extract initramfs
echo "1. Extracting initramfs..."
mkdir -p "$EXTRACT_DIR"
cd "$EXTRACT_DIR"
gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null
echo "   ✓ Extracted"
echo ""

# Check OpenVSCode structure
echo "2. Checking OpenVSCode structure..."
if [ ! -f "opt/openvscode/node" ]; then
    echo "   ✗ Node.js binary not found at opt/openvscode/node"
    exit 1
fi
echo "   ✓ Node.js binary exists: $(ls -lh opt/openvscode/node | awk '{print $5}')"

if [ ! -f "opt/openvscode/bin/openvscode-server" ]; then
    echo "   ✗ Wrapper script not found"
    exit 1
fi
echo "   ✓ Wrapper script exists"

if [ ! -f "opt/openvscode/out/server-main.js" ]; then
    echo "   ✗ server-main.js not found"
    exit 1
fi
echo "   ✓ server-main.js exists"
echo ""

# Check Node.js binary type
echo "3. Checking Node.js binary properties..."
NODE_TYPE=$(file opt/openvscode/node)
if echo "$NODE_TYPE" | grep -q "ARM aarch64"; then
    echo "   ✓ Architecture: ARM64"
else
    echo "   ✗ Wrong architecture: $NODE_TYPE"
    exit 1
fi

if echo "$NODE_TYPE" | grep -q "dynamically linked"; then
    echo "   ✓ Linking: Dynamic"
else
    echo "   ✗ Not dynamically linked"
    exit 1
fi
echo ""

# Check required libraries from Node.js binary
echo "4. Checking Node.js required libraries..."
REQUIRED_LIBS=$(strings opt/openvscode/node | grep -E "^lib.*\.so\.[0-9]+" | sort -u)
echo "   Required libraries:"
echo "$REQUIRED_LIBS" | sed 's/^/     - /'
echo ""

# Check if symlinks exist
echo "5. Verifying GNU libc compatibility symlinks..."
MISSING=0

# Check dynamic linker
if [ -L "lib/ld-linux-aarch64.so.1" ]; then
    TARGET=$(readlink lib/ld-linux-aarch64.so.1)
    echo "   ✓ /lib/ld-linux-aarch64.so.1 -> $TARGET"
else
    echo "   ✗ /lib/ld-linux-aarch64.so.1 MISSING"
    MISSING=$((MISSING + 1))
fi

# Check glibc-style library symlinks
for lib in libc.so.6 libm.so.6 libpthread.so.0 libdl.so.2 librt.so.1; do
    if [ -L "lib/$lib" ] || [ -f "lib/$lib" ]; then
        if [ -L "lib/$lib" ]; then
            TARGET=$(readlink lib/$lib)
            echo "   ✓ /lib/$lib -> $TARGET"
        else
            echo "   ✓ /lib/$lib (file)"
        fi
    else
        echo "   ✗ /lib/$lib MISSING"
        MISSING=$((MISSING + 1))
    fi
done

# Check C++ library (should be a real file)
if [ -f "usr/lib/libstdc++.so.6" ]; then
    echo "   ✓ /usr/lib/libstdc++.so.6"
else
    echo "   ✗ /usr/lib/libstdc++.so.6 MISSING"
    MISSING=$((MISSING + 1))
fi

# Check GCC support library
if [ -f "usr/lib/libgcc_s.so.1" ]; then
    echo "   ✓ /usr/lib/libgcc_s.so.1"
else
    echo "   ✗ /usr/lib/libgcc_s.so.1 MISSING"
    MISSING=$((MISSING + 1))
fi
echo ""

# Test wrapper script logic
echo "6. Testing wrapper script logic..."
cd opt/openvscode
WRAPPER_OUTPUT=$(sh -x ./bin/openvscode-server --version 2>&1 || true)
if echo "$WRAPPER_OUTPUT" | grep -q "ROOT="; then
    ROOT_PATH=$(echo "$WRAPPER_OUTPUT" | grep "ROOT=" | sed 's/.*ROOT=//' | sed 's/ .*//')
    echo "   ✓ Wrapper script resolves ROOT path"
    echo "     ROOT=$ROOT_PATH"

    # Verify paths exist
    if echo "$WRAPPER_OUTPUT" | grep -q "$(basename $ROOT_PATH)/node"; then
        echo "   ✓ Node.js path resolved correctly"
    fi
    if echo "$WRAPPER_OUTPUT" | grep -q "server-main.js"; then
        echo "   ✓ server-main.js path resolved correctly"
    fi
else
    echo "   ✗ Wrapper script failed to resolve paths"
fi
cd "$EXTRACT_DIR"
echo ""

# Summary
echo "=== Test Results ==="
if [ $MISSING -eq 0 ]; then
    echo "✓ All GNU libc compatibility symlinks present"
    echo "✓ OpenVSCode should start successfully"
    EXIT_CODE=0
else
    echo "✗ $MISSING symlinks missing"
    echo "✗ OpenVSCode will fail with 'not found' error"
    EXIT_CODE=1
fi
echo ""

# Cleanup
cd /tmp
rm -rf "$EXTRACT_DIR"

echo "Expected behavior in VM:"
echo "  - Node.js binary will find dynamic linker: /lib/ld-linux-aarch64.so.1"
echo "  - Dynamic linker will resolve to musl: /lib/ld-musl-aarch64.so.1"
echo "  - Node.js will load libraries: libc.so.6, libm.so.6, libpthread.so.0, libdl.so.2"
echo "  - All symlinks point to musl libc, which provides all these functions"
echo "  - OpenVSCode will start without 'not found' errors"
echo ""

exit $EXIT_CODE
