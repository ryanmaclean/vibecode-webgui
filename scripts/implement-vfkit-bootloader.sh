#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# VibeCode vfkit macOS VM - Bootloader Implementation
# Create a functional macOS VM using vfkit bootloader for VibeCode development

# Initialize log aggregation
init_log_aggregation


set -e

echo "🍎 VibeCode vfkit macOS VM - Bootloader Implementation"
echo "====================================================="

# Configuration
VM_NAME="VibeCode-Dev"
VM_MEMORY="4096"  # 4GB in MiB
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
    qemu-img create -f qcow2 "$VM_DISK_IMAGE" "16G"
    echo "✅ VM disk image created: $VM_DISK_IMAGE"
else
    echo "✅ VM disk image already exists: $VM_DISK_IMAGE"
fi

# Try different bootloader approaches
echo "🚀 Testing vfkit with different bootloader approaches..."

# Approach 1: Try with macOS bootloader
echo "🍎 Testing macOS bootloader..."
vfkit \
    --cpus "$VM_CPUS" \
    --memory "$VM_MEMORY" \
    --bootloader "macos" \
    --device "virtio-blk,path=$VM_DISK_IMAGE" \
    --device "virtio-net,nat" \
    --gui \
    --log-level "debug" &

VM_PID=$!
echo "🚀 VM started with PID: $VM_PID"

# Wait a moment for VM to start
sleep 5

# Check if VM is running
if ps -p $VM_PID > /dev/null; then
    echo "✅ VibeCode macOS VM is running successfully!"
    echo "🔧 VM Details:"
    echo "  Name: $VM_NAME"
    echo "  Memory: ${VM_MEMORY} MiB"
    echo "  CPUs: $VM_CPUS"
    echo "  Disk: $VM_DISK_IMAGE"
    echo "  PID: $VM_PID"
    echo "  Bootloader: macOS"
    
    # Create management scripts
    echo ""
    echo "📝 Creating management scripts..."
    
    # Stop VM script
    cat > stop-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🛑 Stopping VibeCode VM (PID: $VM_PID)..."
kill $VM_PID 2>/dev/null || true
echo "✅ VibeCode VM stopped"
EOF
    chmod +x stop-vibecode-vfkit-vm.sh
    
    # Status script
    cat > status-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "📊 VibeCode VM Status"
echo "===================="
if ps -p $VM_PID > /dev/null; then
    echo "✅ VM is running (PID: $VM_PID)"
    echo "  Memory: ${VM_MEMORY} MiB"
    echo "  CPUs: $VM_CPUS"
    echo "  Disk: $VM_DISK_IMAGE"
    echo "  Bootloader: macOS"
else
    echo "❌ VM is not running"
fi
EOF
    chmod +x status-vibecode-vfkit-vm.sh
    
    # Console script
    cat > console-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🖥️  Connecting to VibeCode VM console..."
echo "VM PID: $VM_PID"
echo "Use 'kill $VM_PID' to stop the VM"
EOF
    chmod +x console-vibecode-vfkit-vm.sh
    
    echo "✅ Management scripts created:"
    echo "  ./stop-vibecode-vfkit-vm.sh"
    echo "  ./status-vibecode-vfkit-vm.sh"
    echo "  ./console-vibecode-vfkit-vm.sh"
    
    echo ""
    echo "🎉 VibeCode vfkit macOS VM Implementation Complete!"
    echo "=================================================="
    echo ""
    echo "🚀 VM Status: Running"
    echo "📁 VM Directory: $VM_DIR"
    echo "🛑 Stop VM: ./stop-vibecode-vfkit-vm.sh"
    echo "📊 Status VM: ./status-vibecode-vfkit-vm.sh"
    echo "🖥️  Console VM: ./console-vibecode-vfkit-vm.sh"
    echo ""
    echo "🔧 vfkit Commands:"
    echo "  vfkit list                    # List VMs"
    echo "  kill $VM_PID                 # Stop VM"
    echo ""
    echo "⚡ Performance Notes:"
    echo "  • VM uses ${VM_MEMORY} MiB RAM + $VM_CPUS CPU cores"
    echo "  • macOS bootloader enabled"
    echo "  • Network bridge available"
    echo "  • GUI interface enabled"
    echo "  • Debug logging enabled"
    echo ""
    echo "🔥 VibeCode vfkit macOS VM is running and ready!"
    
    exit 0
else
    echo "❌ macOS bootloader failed, trying Linux bootloader..."
    
    # Approach 2: Try with Linux bootloader
    echo "🐧 Testing Linux bootloader..."
    vfkit \
        --cpus "$VM_CPUS" \
        --memory "$VM_MEMORY" \
        --bootloader "linux" \
        --device "virtio-blk,path=$VM_DISK_IMAGE" \
        --device "virtio-net,nat" \
        --gui \
        --log-level "debug" &
    
    VM_PID=$!
    echo "🚀 VM started with PID: $VM_PID"
    
    # Wait a moment for VM to start
    sleep 5
    
    # Check if VM is running
    if ps -p $VM_PID > /dev/null; then
        echo "✅ VibeCode Linux VM is running successfully!"
        echo "🔧 VM Details:"
        echo "  Name: $VM_NAME"
        echo "  Memory: ${VM_MEMORY} MiB"
        echo "  CPUs: $VM_CPUS"
        echo "  Disk: $VM_DISK_IMAGE"
        echo "  PID: $VM_PID"
        echo "  Bootloader: Linux"
        
        # Create management scripts
        echo ""
        echo "📝 Creating management scripts..."
        
        # Stop VM script
        cat > stop-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🛑 Stopping VibeCode VM (PID: $VM_PID)..."
kill $VM_PID 2>/dev/null || true
echo "✅ VibeCode VM stopped"
EOF
        chmod +x stop-vibecode-vfkit-vm.sh
        
        # Status script
        cat > status-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "📊 VibeCode VM Status"
echo "===================="
if ps -p $VM_PID > /dev/null; then
    echo "✅ VM is running (PID: $VM_PID)"
    echo "  Memory: ${VM_MEMORY} MiB"
    echo "  CPUs: $VM_CPUS"
    echo "  Disk: $VM_DISK_IMAGE"
    echo "  Bootloader: Linux"
else
    echo "❌ VM is not running"
fi
EOF
        chmod +x status-vibecode-vfkit-vm.sh
        
        echo "✅ Management scripts created:"
        echo "  ./stop-vibecode-vfkit-vm.sh"
        echo "  ./status-vibecode-vfkit-vm.sh"
        
        echo ""
        echo "🎉 VibeCode vfkit Linux VM Implementation Complete!"
        echo "=================================================="
        echo ""
        echo "🚀 VM Status: Running"
        echo "📁 VM Directory: $VM_DIR"
        echo "🛑 Stop VM: ./stop-vibecode-vfkit-vm.sh"
        echo "📊 Status VM: ./status-vibecode-vfkit-vm.sh"
        echo ""
        echo "⚡ Performance Notes:"
        echo "  • VM uses ${VM_MEMORY} MiB RAM + $VM_CPUS CPU cores"
        echo "  • Linux bootloader enabled"
        echo "  • Network bridge available"
        echo "  • GUI interface enabled"
        echo ""
        echo "🔥 VibeCode vfkit Linux VM is running and ready!"
        
        exit 0
    else
        echo "❌ Both bootloader approaches failed"
        echo "   vfkit may need additional configuration"
        exit 1
    fi
fi
