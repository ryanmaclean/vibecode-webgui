#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Create tiny macOS VM for OpenClaw
# Target: Tahoe+, ARM64, Apple VZ

# Initialize log aggregation
init_log_aggregation


set -e

VM_NAME="openclaw-tiny"
VM_DIR="$HOME/.vibecode/vms/$VM_NAME"
DISK_PATH="$VM_DIR/openclaw.img"

echo "=== Creating OpenClaw Tiny macOS VM ==="
echo "VM Name: $VM_NAME"
echo "VM Dir: $VM_DIR"
echo ""

# Create VM directory
mkdir -p "$VM_DIR"

# Check for macOS restore image
if [ ! -f "$VM_DIR/restore-image.ipsw" ]; then
    echo "⚠️  macOS restore image required!"
    echo "Download from: https://developer.apple.com/download"
    echo "Save as: $VM_DIR/restore-image.ipsw"
    exit 1
fi

# Build Swift VM tool
echo "Building VM tool..."
cd platforms/macos/vz-swift
swift build -c release

# Create VM (will prompt for restore image)
echo "Creating VM..."
./.build/release/vibecode-vm macos "$VM_NAME"

echo ""
echo "✅ OpenClaw VM created!"
echo "Next: Install OpenClaw, Tailscale, and configure Let's Encrypt"
