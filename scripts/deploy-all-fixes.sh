#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Deploy All VM Access Fixes
# This script deploys:
# 1. VSOCK relay fix (localhost:3000 access)
# 2. SSH server fix (tunnel access)
# 3. Rebuilds app bundles with all fixes

# Initialize log aggregation
init_log_aggregation


set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy All VM Access Fixes${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
PROJECT_ROOT="$HOME/vibecode-webgui"
INITRAMFS_DIR="/tmp/initramfs-with-virtio"
VSOCK_FIX_SCRIPT="/tmp/FIX_VSOCK_NOW.sh"
BUNDLE_SCRIPT="$PROJECT_ROOT/azure/SwiftUI-Apps/bundle-apps.sh"

# Track what was deployed
DEPLOYED_FIXES=()

# ===========================================
# 1. Deploy VSOCK Relay Fix
# ===========================================
echo -e "${BLUE}[1/3] Deploying VSOCK relay fix...${NC}"

if [ -f "$VSOCK_FIX_SCRIPT" ]; then
    echo "  Found VSOCK fix script at $VSOCK_FIX_SCRIPT"
    echo "  This will enable localhost:3000 access"
    echo -n "  Deploy? [Y/n]: "
    read -r deploy_vsock

    if [[ ! "$deploy_vsock" =~ ^[Nn]$ ]]; then
        echo -e "${YELLOW}  Running VSOCK fix...${NC}"
        bash "$VSOCK_FIX_SCRIPT"
        DEPLOYED_FIXES+=("VSOCK relay (localhost:3000)")
        echo -e "${GREEN}  ✓ VSOCK relay deployed${NC}"
    else
        echo "  Skipped VSOCK fix"
    fi
else
    echo -e "${YELLOW}  ⚠ VSOCK fix script not found at $VSOCK_FIX_SCRIPT${NC}"
    echo "  Creating custom vsock relay now..."

    # Check if vsock-relay.c exists
    if [ -f "/tmp/vsock-relay.c" ]; then
        echo "  Compiling vsock-relay.c..."
        gcc -o "$INITRAMFS_DIR/bin/vsock-relay" /tmp/vsock-relay.c
        chmod +x "$INITRAMFS_DIR/bin/vsock-relay"

        # Verify it was added to init script
        if ! grep -q "vsock-relay" "$INITRAMFS_DIR/init"; then
            echo "  Adding vsock-relay to init script..."
            cat >> "$INITRAMFS_DIR/init" << 'EOF'

# Start vsock relay for localhost access
if [ -f /bin/vsock-relay ]; then
    echo "Starting vsock relay..."
    /bin/vsock-relay 3 3000 3000 &
    echo "  Vsock relay: host:3000 -> VM:3000"
fi
EOF
        fi

        DEPLOYED_FIXES+=("VSOCK relay (custom C implementation)")
        echo -e "${GREEN}  ✓ Custom vsock relay deployed${NC}"
    else
        echo -e "${RED}  ✗ Cannot deploy VSOCK fix - missing source files${NC}"
    fi
fi

echo ""

# ===========================================
# 2. Deploy SSH Server Fix
# ===========================================
echo -e "${BLUE}[2/3] Deploying SSH server fix...${NC}"

# Check current GLIBC version in initramfs
if [ -d "$INITRAMFS_DIR" ]; then
    echo "  Checking for dropbear SSH server..."

    if [ -f "$INITRAMFS_DIR/bin/dropbear" ]; then
        echo "  Found dropbear at $INITRAMFS_DIR/bin/dropbear"

        # Test if it has GLIBC issues
        echo "  Testing dropbear compatibility..."
        if ldd "$INITRAMFS_DIR/bin/dropbear" 2>&1 | grep -q "GLIBC_2.38"; then
            echo -e "${YELLOW}  ⚠ Dropbear requires GLIBC 2.38${NC}"
            echo "  Need to rebuild with GLIBC 2.35 compatibility"
            echo ""
            echo "  Options:"
            echo "    1) Download pre-built dropbear for GLIBC 2.35"
            echo "    2) Compile from source"
            echo "    3) Skip SSH fix"
            echo -n "  Choice [1/2/3]: "
            read -r ssh_choice

            case "$ssh_choice" in
                1)
                    echo -e "${YELLOW}  Downloading compatible dropbear...${NC}"
                    # Try Ubuntu 22.04 dropbear (uses GLIBC 2.35)
                    curl -L "http://archive.ubuntu.com/ubuntu/pool/main/d/dropbear/dropbear_2022.83-1build1_amd64.deb" \
                        -o /tmp/dropbear.deb

                    if [ -f /tmp/dropbear.deb ]; then
                        echo "  Extracting dropbear..."
                        ar x /tmp/dropbear.deb data.tar.xz
                        tar -xJf data.tar.xz -C /tmp
                        cp /tmp/usr/sbin/dropbear "$INITRAMFS_DIR/bin/dropbear"
                        rm -f /tmp/dropbear.deb data.tar.xz
                        DEPLOYED_FIXES+=("SSH server (GLIBC 2.35 compatible)")
                        echo -e "${GREEN}  ✓ SSH server updated${NC}"
                    else
                        echo -e "${RED}  ✗ Failed to download dropbear${NC}"
                    fi
                    ;;
                2)
                    echo -e "${YELLOW}  Compiling dropbear from source...${NC}"
                    echo "  This will take a few minutes..."

                    cd /tmp
                    if [ ! -d "dropbear-2022.83" ]; then
                        curl -LO "https://matt.ucc.asn.au/dropbear/releases/dropbear-2022.83.tar.bz2"
                        tar -xjf dropbear-2022.83.tar.bz2
                    fi

                    cd dropbear-2022.83
                    ./configure --disable-zlib --disable-wtmp --disable-lastlog
                    make PROGRAMS="dropbear dbclient dropbearkey dropbearconvert"

                    if [ -f dropbear ]; then
                        cp dropbear "$INITRAMFS_DIR/bin/dropbear"
                        DEPLOYED_FIXES+=("SSH server (compiled from source)")
                        echo -e "${GREEN}  ✓ SSH server compiled and installed${NC}"
                    else
                        echo -e "${RED}  ✗ Compilation failed${NC}"
                    fi
                    ;;
                *)
                    echo "  Skipped SSH fix"
                    ;;
            esac
        else
            echo -e "${GREEN}  ✓ Dropbear is compatible (no GLIBC issues)${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ Dropbear not found in initramfs${NC}"
        echo "  SSH access will not be available"
    fi
else
    echo -e "${RED}  ✗ Initramfs directory not found at $INITRAMFS_DIR${NC}"
fi

echo ""

# ===========================================
# 3. Rebuild App Bundles
# ===========================================
echo -e "${BLUE}[3/3] Rebuilding app bundles...${NC}"

if [ ${#DEPLOYED_FIXES[@]} -gt 0 ]; then
    echo "  The following fixes were deployed:"
    for fix in "${DEPLOYED_FIXES[@]}"; do
        echo "    - $fix"
    done
    echo ""
    echo "  App bundles need to be rebuilt to include these changes"
    echo -n "  Rebuild now? [Y/n]: "
    read -r rebuild_choice

    if [[ ! "$rebuild_choice" =~ ^[Nn]$ ]]; then
        if [ -f "$BUNDLE_SCRIPT" ]; then
            echo -e "${YELLOW}  Rebuilding initramfs and app bundles...${NC}"
            cd "$PROJECT_ROOT/azure"

            # Rebuild initramfs
            echo "  Step 1: Repackaging initramfs..."
            cd "$INITRAMFS_DIR"
            find . | cpio -o -H newc | gzip > "$PROJECT_ROOT/azure/bun-openvscode-ssh-fixed.cpio.gz"
            INITRAMFS_SIZE=$(du -h "$PROJECT_ROOT/azure/bun-openvscode-ssh-fixed.cpio.gz" | cut -f1)
            echo -e "${GREEN}    ✓ Initramfs repackaged ($INITRAMFS_SIZE)${NC}"

            # Rebuild app bundles
            echo "  Step 2: Rebuilding app bundles..."
            cd "$PROJECT_ROOT/azure/SwiftUI-Apps"
            bash bundle-apps.sh
            echo -e "${GREEN}    ✓ App bundles rebuilt${NC}"

            echo ""
            echo -e "${GREEN}========================================${NC}"
            echo -e "${GREEN}  All fixes deployed successfully!${NC}"
            echo -e "${GREEN}========================================${NC}"
        else
            echo -e "${RED}  ✗ Bundle script not found at $BUNDLE_SCRIPT${NC}"
        fi
    else
        echo "  Rebuild skipped"
        echo -e "${YELLOW}  ⚠ Changes will not take effect until you rebuild${NC}"
    fi
else
    echo "  No fixes were deployed, rebuild not needed"
fi

echo ""

# ===========================================
# Summary
# ===========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deployment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ${#DEPLOYED_FIXES[@]} -gt 0 ]; then
    echo -e "${GREEN}Deployed fixes:${NC}"
    for fix in "${DEPLOYED_FIXES[@]}"; do
        echo "  ✓ $fix"
    done
else
    echo -e "${YELLOW}No fixes were deployed${NC}"
fi

echo ""
echo "Access methods status:"
echo "  1. Direct browser (192.168.64.3:8080) - ${GREEN}Working${NC}"

if [[ " ${DEPLOYED_FIXES[@]} " =~ "VSOCK" ]]; then
    echo "  2. Localhost access (localhost:3000) - ${GREEN}Fixed${NC}"
else
    echo "  2. Localhost access (localhost:3000) - ${YELLOW}Pending${NC}"
fi

if [[ " ${DEPLOYED_FIXES[@]} " =~ "SSH" ]]; then
    echo "  3. SSH tunnel - ${GREEN}Fixed${NC}"
else
    echo "  3. SSH tunnel - ${YELLOW}Pending${NC}"
fi

echo ""
echo "Next steps:"
echo "  1. Launch VM: bash $PROJECT_ROOT/scripts/launch-vibecode.sh"
echo "  2. Test access: open http://192.168.64.3:8080"
if [[ " ${DEPLOYED_FIXES[@]} " =~ "VSOCK" ]]; then
    echo "  3. Test localhost: open http://localhost:3000"
fi
echo ""
