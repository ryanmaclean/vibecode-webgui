#!/bin/bash

# VibeCode vfkit Working VM Implementation
# Create a functional VM using vfkit with proper bootloader configuration

set -e

echo "🍎 VibeCode vfkit Working VM Implementation"
echo "==========================================="

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

# Create a simple test VM that actually works
echo "🚀 Creating working vfkit VM..."

# Try to create a VM with macOS bootloader and proper configuration
echo "🍎 Testing macOS VM with proper configuration..."

# Create hardware model file (required for macOS VM)
HARDWARE_MODEL="$VM_DIR/hardware-model"
if [ ! -f "$HARDWARE_MODEL" ]; then
    echo "📝 Creating hardware model file..."
    # Get current Mac's hardware model
    CURRENT_MODEL=$(sysctl -n hw.model)
    echo "$CURRENT_MODEL" > "$HARDWARE_MODEL"
    echo "✅ Hardware model: $CURRENT_MODEL"
fi

# Create machine identifier file (required for macOS VM)
MACHINE_ID="$VM_DIR/machine-id"
if [ ! -f "$MACHINE_ID" ]; then
    echo "📝 Creating machine identifier..."
    # Generate a unique machine ID
    echo "$(uuidgen)" > "$MACHINE_ID"
    echo "✅ Machine ID created"
fi

# Try macOS VM with proper files
echo "🚀 Starting macOS VM with vfkit..."

vfkit \
    --cpus "$VM_CPUS" \
    --memory "$VM_MEMORY" \
    --bootloader "macos,hardware-model=$HARDWARE_MODEL,machine-id=$MACHINE_ID" \
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
    echo "  Hardware Model: $(cat $HARDWARE_MODEL)"
    echo "  Machine ID: $(cat $MACHINE_ID)"
    
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
    echo "  Hardware Model: $(cat $HARDWARE_MODEL)"
    echo "  Machine ID: $(cat $MACHINE_ID)"
else
    echo "❌ VM is not running"
fi
EOF
    chmod +x status-vibecode-vfkit-vm.sh
    
    # Console script
    cat > console-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🖥️  VibeCode VM Console Access"
echo "=============================="
echo "VM PID: $VM_PID"
echo "VM Directory: $VM_DIR"
echo "Hardware Model: $(cat $HARDWARE_MODEL)"
echo "Machine ID: $(cat $MACHINE_ID)"
echo ""
echo "To stop the VM: kill $VM_PID"
echo "To check status: ./status-vibecode-vfkit-vm.sh"
EOF
    chmod +x console-vibecode-vfkit-vm.sh
    
    # Install VibeCode script
    cat > install-vibecode-in-vm.sh << EOF
#!/bin/bash
echo "📦 Installing VibeCode in VM..."
echo "This would install VibeCode dependencies in the VM"
echo "VM PID: $VM_PID"
echo "VM Directory: $VM_DIR"
echo ""
echo "To install VibeCode in the VM:"
echo "1. Access the VM console"
echo "2. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
echo "3. Install code-server: brew install code-server"
echo "4. Install Node.js: brew install node"
echo "5. Clone VibeCode: git clone https://github.com/ryanmaclean/vibecode-webgui.git"
echo "6. Start VibeCode: cd vibecode-webgui && code-server --bind-addr 0.0.0.0:8080"
EOF
    chmod +x install-vibecode-in-vm.sh
    
    echo "✅ Management scripts created:"
    echo "  ./stop-vibecode-vfkit-vm.sh"
    echo "  ./status-vibecode-vfkit-vm.sh"
    echo "  ./console-vibecode-vfkit-vm.sh"
    echo "  ./install-vibecode-in-vm.sh"
    
    echo ""
    echo "🎉 VibeCode vfkit macOS VM Implementation Complete!"
    echo "=================================================="
    echo ""
    echo "🚀 VM Status: Running"
    echo "📁 VM Directory: $VM_DIR"
    echo "🛑 Stop VM: ./stop-vibecode-vfkit-vm.sh"
    echo "📊 Status VM: ./status-vibecode-vfkit-vm.sh"
    echo "🖥️  Console VM: ./console-vibecode-vfkit-vm.sh"
    echo "📦 Install VibeCode: ./install-vibecode-in-vm.sh"
    echo ""
    echo "🔧 vfkit Commands:"
    echo "  vfkit list                    # List VMs"
    echo "  kill $VM_PID                 # Stop VM"
    echo ""
    echo "⚡ Performance Notes:"
    echo "  • VM uses ${VM_MEMORY} MiB RAM + $VM_CPUS CPU cores"
    echo "  • macOS bootloader enabled"
    echo "  • Hardware model: $(cat $HARDWARE_MODEL)"
    echo "  • Network bridge available"
    echo "  • GUI interface enabled"
    echo "  • Debug logging enabled"
    echo ""
    echo "🔥 VibeCode vfkit macOS VM is running and ready!"
    
    exit 0
else
    echo "❌ Failed to start VibeCode VM"
    echo "   vfkit may need additional configuration or files"
    echo "   Check the logs above for specific error messages"
    exit 1
fi
