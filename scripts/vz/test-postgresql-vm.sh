#!/bin/bash
#
# Test script for PostgreSQL VM using Virtualization framework
#

set -euo pipefail

echo "========================================================"
echo "PostgreSQL VM Test Suite"
echo "========================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VM_DIR="$HOME/.vfkit/vms/postgresql-vz"
PACKAGE_DIR="$(cd "$(dirname "$0")/../../platforms/macos/postgresql-vm" && pwd)"

# Function to print colored messages
print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Step 1: Check prerequisites
print_status "Checking prerequisites..."

if [ ! -f "$VM_DIR/disk/root.qcow2" ]; then
    print_error "Root disk not found: $VM_DIR/disk/root.qcow2"
    exit 1
fi
print_success "Root disk found ($(du -h "$VM_DIR/disk/root.qcow2" | cut -f1))"

if [ ! -f "$VM_DIR/disk/data.qcow2" ]; then
    print_error "Data disk not found: $VM_DIR/disk/data.qcow2"
    exit 1
fi
print_success "Data disk found ($(du -h "$VM_DIR/disk/data.qcow2" | cut -f1))"

if [ ! -f "$VM_DIR/kernel/vmlinuz" ]; then
    print_error "Kernel not found: $VM_DIR/kernel/vmlinuz"
    exit 1
fi
print_success "Kernel found"

if [ ! -f "$VM_DIR/kernel/initramfs" ]; then
    print_error "Initramfs not found: $VM_DIR/kernel/initramfs"
    exit 1
fi
print_success "Initramfs found"

echo ""

# Step 2: Build the PostgreSQL VM executable
print_status "Building PostgreSQL VM..."
cd "$PACKAGE_DIR"

if swift build --configuration release; then
    print_success "Build successful"
else
    print_error "Build failed"
    exit 1
fi

echo ""

# Step 3: Check if Lima PostgreSQL VM is running
print_status "Checking Lima PostgreSQL VM status..."
if limactl list | grep -q "vibecode-pgvector.*Running"; then
    print_warning "Lima PostgreSQL VM is running. You may want to stop it to avoid port conflicts."
    echo "           Run: limactl stop vibecode-pgvector"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Lima PostgreSQL VM is not running (no port conflicts)"
fi

echo ""

# Step 4: Show VM information
print_status "VM Configuration:"
echo "           VM Path: $VM_DIR"
echo "           Package: $PACKAGE_DIR"
echo "           Binary: $PACKAGE_DIR/.build/release/postgresql-vm"
echo ""

# Step 5: Instructions for running the VM
print_status "To start the PostgreSQL VM, run:"
echo ""
echo "   cd $PACKAGE_DIR"
echo "   swift run postgresql-vm"
echo ""
echo "Or use the release binary:"
echo ""
echo "   $PACKAGE_DIR/.build/release/postgresql-vm"
echo ""

print_status "To test PostgreSQL connection once VM is running:"
echo ""
echo "   # Check if port 5432 is listening"
echo "   nc -zv 127.0.0.1 5432"
echo ""
echo "   # Connect to PostgreSQL"
echo "   psql -h 127.0.0.1 -U vibecode -d vibecode -c \"SELECT version();\""
echo ""
echo "   # Test pgvector extension"
echo "   psql -h 127.0.0.1 -U vibecode -d vibecode -c \"SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';\""
echo ""

# Step 6: Offer to start the VM
echo ""
read -p "Do you want to start the PostgreSQL VM now? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting PostgreSQL VM..."
    echo ""
    exec "$PACKAGE_DIR/.build/release/postgresql-vm"
else
    print_success "Test preparation complete. VM ready to start."
fi

echo ""
echo "========================================================"
print_success "PostgreSQL VM test suite completed"
echo "========================================================"
