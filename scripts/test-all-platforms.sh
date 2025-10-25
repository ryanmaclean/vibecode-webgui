#!/bin/bash
# Test RAG System Deployment on All Platforms
# Tests: Local macOS, i9-zfs-pop.local, snas.local

set -e

echo "🧪 Testing RAG System Deployment on All Platforms"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
RESULTS=()

test_result() {
    local name=$1
    local status=$2
    if [ "$status" = "0" ]; then
        echo -e "${GREEN}✅ $name${NC}"
        RESULTS+=("✅ $name")
    else
        echo -e "${RED}❌ $name${NC}"
        RESULTS+=("❌ $name")
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Testing Local macOS (vfkit)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test vfkit
echo "Testing vfkit availability..."
if which vfkit > /dev/null 2>&1; then
    VFKIT_VERSION=$(vfkit --version)
    echo "  vfkit: $VFKIT_VERSION"
    test_result "macOS: vfkit installed" 0
else
    echo "  vfkit not found"
    test_result "macOS: vfkit installed" 1
fi

# Test existing VMs
echo ""
echo "Checking existing vfkit VMs..."
VM_COUNT=$(ls -1 ~/.vfkit/vms/ 2>/dev/null | wc -l | tr -d ' ')
echo "  Found $VM_COUNT VMs"
test_result "macOS: $VM_COUNT vfkit VMs detected" 0

# Test Lima
echo ""
echo "Testing Lima availability..."
if which limactl > /dev/null 2>&1; then
    LIMA_VMS=$(limactl list 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
    echo "  Lima VMs: $LIMA_VMS"
    test_result "macOS: Lima available ($LIMA_VMS VMs)" 0
else
    echo "  Lima not found"
    test_result "macOS: Lima available" 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Testing i9-zfs-pop.local (Linux + Docker + QEMU)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test SSH connectivity
echo "Testing SSH connectivity..."
if ssh -o ConnectTimeout=5 studio@i9-zfs-pop.local "echo 'Connected'" > /dev/null 2>&1; then
    test_result "i9: SSH connectivity" 0
    
    # Test Docker
    echo ""
    echo "Testing Docker..."
    DOCKER_VERSION=$(ssh studio@i9-zfs-pop.local "docker --version" 2>/dev/null || echo "Not found")
    echo "  $DOCKER_VERSION"
    if [[ "$DOCKER_VERSION" != "Not found" ]]; then
        test_result "i9: Docker installed" 0
    else
        test_result "i9: Docker installed" 1
    fi
    
    # Test KVM
    echo ""
    echo "Testing KVM support..."
    if ssh studio@i9-zfs-pop.local "test -c /dev/kvm" 2>/dev/null; then
        CPU_MODEL=$(ssh studio@i9-zfs-pop.local "cat /proc/cpuinfo | grep -m1 'model name' | cut -d: -f2" | xargs)
        echo "  CPU: $CPU_MODEL"
        test_result "i9: KVM available" 0
    else
        test_result "i9: KVM available" 1
    fi
    
    # Test Alpine container
    echo ""
    echo "Testing Alpine 3.22 container..."
    if ssh studio@i9-zfs-pop.local "docker run --rm alpine:3.22 cat /etc/os-release | head -1" 2>/dev/null | grep -q "Alpine"; then
        test_result "i9: Alpine 3.22 container" 0
    else
        test_result "i9: Alpine 3.22 container" 1
    fi
    
else
    test_result "i9: SSH connectivity" 1
    echo "  Skipping remaining i9 tests..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Testing snas.local (Synology NAS + Docker)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test SSH connectivity
echo "Testing SSH connectivity..."
if ssh -o ConnectTimeout=5 string@snas.local "echo 'Connected'" > /dev/null 2>&1; then
    test_result "snas: SSH connectivity" 0
    
    # Test Docker
    echo ""
    echo "Testing Docker..."
    DOCKER_VERSION=$(ssh string@snas.local "/usr/local/bin/docker --version" 2>/dev/null || echo "Not found")
    echo "  $DOCKER_VERSION"
    if [[ "$DOCKER_VERSION" != "Not found" ]]; then
        test_result "snas: Docker installed" 0
    else
        test_result "snas: Docker installed" 1
    fi
    
    # Test system info
    echo ""
    echo "System information..."
    SNAS_KERNEL=$(ssh string@snas.local "uname -r" 2>/dev/null || echo "Unknown")
    echo "  Kernel: $SNAS_KERNEL"
    test_result "snas: System accessible" 0
    
else
    test_result "snas: SSH connectivity" 1
    echo "  Skipping remaining snas tests..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  RAG Component Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test PostgreSQL on i9
echo "Testing PostgreSQL 16 on i9-zfs-pop.local..."
if ssh studio@i9-zfs-pop.local "docker run --rm postgres:16-alpine postgres --version" 2>/dev/null | grep -q "PostgreSQL 16"; then
    test_result "i9: PostgreSQL 16 ready" 0
else
    test_result "i9: PostgreSQL 16 ready" 1
fi

# Test Valkey on i9
echo ""
echo "Testing Valkey 7.2 on i9-zfs-pop.local..."
if ssh studio@i9-zfs-pop.local "docker run --rm valkey/valkey:7.2-alpine valkey-server --version" 2>/dev/null | grep -q "7.2"; then
    test_result "i9: Valkey 7.2 ready" 0
else
    test_result "i9: Valkey 7.2 ready" 1
fi

# Test Node.js on i9
echo ""
echo "Testing Node.js on i9-zfs-pop.local..."
if ssh studio@i9-zfs-pop.local "docker run --rm alpine:3.22 sh -c 'apk add --no-cache nodejs > /dev/null 2>&1 && node --version'" 2>/dev/null | grep -q "v"; then
    test_result "i9: Node.js installation" 0
else
    test_result "i9: Node.js installation" 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for result in "${RESULTS[@]}"; do
    echo "$result"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Platform Testing Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
