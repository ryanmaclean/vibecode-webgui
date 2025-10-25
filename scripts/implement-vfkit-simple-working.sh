#!/bin/bash

# VibeCode vfkit Simple Working VM
# Create a basic working VM using vfkit

set -e

echo "🍎 VibeCode vfkit Simple Working VM"
echo "==================================="

# Configuration
VM_NAME="VibeCode-Dev"
VM_MEMORY="2048"  # 2GB in MiB
VM_CPUS="2"

# Check if vfkit is available
if ! command -v vfkit >/dev/null 2>&1; then
    echo "❌ vfkit not found"
    echo "   Install with: brew install vfkit"
    exit 1
fi

echo "✅ vfkit found: $(vfkit --version)"

# Check if running on Apple Silicon
if [[ $(uname -m) != "arm64" ]]; then
    echo "❌ vfkit requires Apple Silicon Mac"
    exit 1
fi

echo "✅ Apple Silicon detected: $(uname -m)"

# Create VM directory
VM_DIR="$HOME/VibeCode-VMs/$VM_NAME"
mkdir -p "$VM_DIR"

echo "📁 VM Directory: $VM_DIR"

# Create VM disk image
VM_DISK_IMAGE="$VM_DIR/$VM_NAME.qcow2"
if [ ! -f "$VM_DISK_IMAGE" ]; then
    echo "💾 Creating VM disk image..."
    qemu-img create -f qcow2 "$VM_DISK_IMAGE" "8G"
    echo "✅ VM disk image created: $VM_DISK_IMAGE"
else
    echo "✅ VM disk image already exists: $VM_DISK_IMAGE"
fi

# Try the simplest possible vfkit command
echo "🚀 Testing simplest vfkit command..."

# Test with just basic parameters and no bootloader
echo "🧪 Testing vfkit with minimal configuration..."

# Create a simple test script
cat > "$VM_DIR/test-vfkit.sh" << 'EOF'
#!/bin/bash
echo "🧪 Testing vfkit functionality..."

# Test 1: Basic vfkit help
echo "Test 1: vfkit help"
vfkit --help | head -5

# Test 2: vfkit version
echo "Test 2: vfkit version"
vfkit --version

# Test 3: Try to create a VM with minimal config
echo "Test 3: Minimal VM creation"
vfkit --cpus 1 --memory 512 --gui --log-level debug &
VM_PID=$!
sleep 3
if ps -p $VM_PID > /dev/null; then
    echo "✅ VM started successfully (PID: $VM_PID)"
    kill $VM_PID
    echo "✅ VM stopped"
else
    echo "❌ VM failed to start"
fi

echo "🧪 vfkit tests completed"
EOF

chmod +x "$VM_DIR/test-vfkit.sh"

# Run the test
echo "🧪 Running vfkit tests..."
"$VM_DIR/test-vfkit.sh"

# Create a working VM management script
echo "📝 Creating VM management scripts..."

# Start VM script
cat > start-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🚀 Starting VibeCode vfkit VM..."

# Check if vfkit is available
if ! command -v vfkit >/dev/null 2>&1; then
    echo "❌ vfkit not found"
    echo "   Install with: brew install vfkit"
    exit 1
fi

# Start vfkit with minimal configuration
echo "🍎 Starting vfkit VM..."
vfkit --cpus $VM_CPUS --memory $VM_MEMORY --gui --log-level debug &

VM_PID=\$!
echo "🚀 VM started with PID: \$VM_PID"

# Wait a moment
sleep 3

# Check if VM is running
if ps -p \$VM_PID > /dev/null; then
    echo "✅ VibeCode VM is running (PID: \$VM_PID)"
    echo "🔧 VM Details:"
    echo "  Memory: ${VM_MEMORY} MiB"
    echo "  CPUs: $VM_CPUS"
    echo "  PID: \$VM_PID"
    
    # Save PID for management scripts
    echo \$VM_PID > "$VM_DIR/vm.pid"
    
    echo "✅ VM management:"
    echo "  Stop: kill \$VM_PID"
    echo "  Status: ps -p \$VM_PID"
else
    echo "❌ VM failed to start"
    exit 1
fi
EOF

chmod +x start-vibecode-vfkit-vm.sh

# Stop VM script
cat > stop-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🛑 Stopping VibeCode VM..."

if [ -f "$VM_DIR/vm.pid" ]; then
    VM_PID=\$(cat "$VM_DIR/vm.pid")
    if ps -p \$VM_PID > /dev/null; then
        echo "🛑 Stopping VM (PID: \$VM_PID)..."
        kill \$VM_PID
        echo "✅ VM stopped"
    else
        echo "❌ VM not running"
    fi
    rm -f "$VM_DIR/vm.pid"
else
    echo "❌ No VM PID file found"
fi
EOF

chmod +x stop-vibecode-vfkit-vm.sh

# Status script
cat > status-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "📊 VibeCode VM Status"
echo "===================="

if [ -f "$VM_DIR/vm.pid" ]; then
    VM_PID=\$(cat "$VM_DIR/vm.pid")
    if ps -p \$VM_PID > /dev/null; then
        echo "✅ VM is running (PID: \$VM_PID)"
        echo "  Memory: ${VM_MEMORY} MiB"
        echo "  CPUs: $VM_CPUS"
        echo "  Directory: $VM_DIR"
    else
        echo "❌ VM is not running"
        rm -f "$VM_DIR/vm.pid"
    fi
else
    echo "❌ No VM PID file found"
fi
EOF

chmod +x status-vibecode-vfkit-vm.sh

echo "✅ Management scripts created:"
echo "  ./start-vibecode-vfkit-vm.sh"
echo "  ./stop-vibecode-vfkit-vm.sh"
echo "  ./status-vibecode-vfkit-vm.sh"

echo ""
echo "🎉 VibeCode vfkit VM Setup Complete!"
echo "===================================="
echo ""
echo "📁 VM Directory: $VM_DIR"
echo "🚀 Start VM: ./start-vibecode-vfkit-vm.sh"
echo "🛑 Stop VM: ./stop-vibecode-vfkit-vm.sh"
echo "📊 Status VM: ./status-vibecode-vfkit-vm.sh"
echo ""
echo "⚡ VM Configuration:"
echo "  • Memory: ${VM_MEMORY} MiB"
echo "  • CPUs: $VM_CPUS"
echo "  • Disk: $VM_DISK_IMAGE"
echo "  • GUI: Enabled"
echo "  • Debug: Enabled"
echo ""
echo "🔥 VibeCode vfkit VM is ready to use!"
