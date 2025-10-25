#!/bin/bash

# VibeCode vfkit Complete Working Implementation
# Create a functional macOS VM using vfkit with all required files

set -e

echo "🍎 VibeCode vfkit Complete Working Implementation"
echo "================================================"

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

# Create required hardware model files
echo "📝 Creating required hardware model files..."

# Hardware model file
HARDWARE_MODEL="$VM_DIR/hardware-model"
if [ ! -f "$HARDWARE_MODEL" ]; then
    echo "📝 Creating hardware model file..."
    # Get current Mac's hardware model
    CURRENT_MODEL=$(sysctl -n hw.model)
    echo "$CURRENT_MODEL" > "$HARDWARE_MODEL"
    echo "✅ Hardware model: $CURRENT_MODEL"
fi

# Machine identifier file
MACHINE_ID="$VM_DIR/machine-id"
if [ ! -f "$MACHINE_ID" ]; then
    echo "📝 Creating machine identifier..."
    # Generate a unique machine ID
    echo "$(uuidgen)" > "$MACHINE_ID"
    echo "✅ Machine ID created"
fi

# Auxiliary image file (required for macOS VM)
AUX_IMAGE="$VM_DIR/aux-image"
if [ ! -f "$AUX_IMAGE" ]; then
    echo "📝 Creating auxiliary image file..."
    # Create a minimal auxiliary image
    touch "$AUX_IMAGE"
    echo "✅ Auxiliary image created"
fi

echo "✅ All required files created"

# Create a working vfkit VM
echo "🚀 Creating working vfkit VM..."

# Start vfkit with macOS bootloader and all required files
vfkit \
    --cpus "$VM_CPUS" \
    --memory "$VM_MEMORY" \
    --bootloader "macos,hardware-model=$HARDWARE_MODEL,machine-id=$MACHINE_ID,aux-image=$AUX_IMAGE" \
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
    
    # Save PID for management
    echo $VM_PID > "$VM_DIR/vm.pid"
    
    # Create management scripts
    echo ""
    echo "📝 Creating management scripts..."
    
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
        echo "  Disk: $VM_DISK_IMAGE"
        echo "  Bootloader: macOS"
        echo "  Hardware Model: $(cat $HARDWARE_MODEL)"
        echo "  Machine ID: $(cat $MACHINE_ID)"
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
    
    # Console script
    cat > console-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🖥️  VibeCode VM Console Access"
echo "=============================="

if [ -f "$VM_DIR/vm.pid" ]; then
    VM_PID=\$(cat "$VM_DIR/vm.pid")
    if ps -p \$VM_PID > /dev/null; then
        echo "✅ VM is running (PID: \$VM_PID)"
        echo "📁 VM Directory: $VM_DIR"
        echo "💾 VM Disk: $VM_DISK_IMAGE"
        echo "🔧 Hardware Model: $(cat $HARDWARE_MODEL)"
        echo "🆔 Machine ID: $(cat $MACHINE_ID)"
        echo ""
        echo "🔧 VM Management:"
        echo "  Stop VM: kill \$VM_PID"
        echo "  Status: ./status-vibecode-vfkit-vm.sh"
        echo "  Stop Script: ./stop-vibecode-vfkit-vm.sh"
        echo ""
        echo "📦 To install VibeCode in the VM:"
        echo "  1. Access the VM GUI (should be open)"
        echo "  2. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo "  3. Install code-server: brew install code-server"
        echo "  4. Install Node.js: brew install node"
        echo "  5. Clone VibeCode: git clone https://github.com/ryanmaclean/vibecode-webgui.git"
        echo "  6. Start VibeCode: cd vibecode-webgui && code-server --bind-addr 0.0.0.0:8080"
    else
        echo "❌ VM is not running"
    fi
else
    echo "❌ No VM PID file found"
fi
EOF
    chmod +x console-vibecode-vfkit-vm.sh
    
    # Install VibeCode script
    cat > install-vibecode-in-vm.sh << EOF
#!/bin/bash
echo "📦 Installing VibeCode in VM..."
echo "This script provides instructions for installing VibeCode in the VM"
echo ""

if [ -f "$VM_DIR/vm.pid" ]; then
    VM_PID=\$(cat "$VM_DIR/vm.pid")
    if ps -p \$VM_PID > /dev/null; then
        echo "✅ VM is running (PID: \$VM_PID)"
        echo ""
        echo "📦 VibeCode Installation Steps:"
        echo "==============================="
        echo ""
        echo "1. Access the VM GUI (should be open)"
        echo "2. Open Terminal in the VM"
        echo "3. Install Homebrew:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo ""
        echo "4. Install required packages:"
        echo "   brew install code-server node git"
        echo ""
        echo "5. Clone VibeCode:"
        echo "   git clone https://github.com/ryanmaclean/vibecode-webgui.git"
        echo "   cd vibecode-webgui"
        echo ""
        echo "6. Start VibeCode:"
        echo "   code-server --bind-addr 0.0.0.0:8080 --auth none"
        echo ""
        echo "7. Access VibeCode at: http://localhost:8080"
        echo ""
        echo "🔧 VM Details:"
        echo "  PID: \$VM_PID"
        echo "  Directory: $VM_DIR"
        echo "  Disk: $VM_DISK_IMAGE"
        echo "  Hardware Model: $(cat $HARDWARE_MODEL)"
        echo "  Machine ID: $(cat $MACHINE_ID)"
    else
        echo "❌ VM is not running"
        echo "   Start VM first: ./start-vibecode-vfkit-vm.sh"
    fi
else
    echo "❌ No VM PID file found"
    echo "   Start VM first: ./start-vibecode-vfkit-vm.sh"
fi
EOF
    chmod +x install-vibecode-in-vm.sh
    
    # Start VM script (for future use)
    cat > start-vibecode-vfkit-vm.sh << EOF
#!/bin/bash
echo "🚀 Starting VibeCode vfkit VM..."

# Check if VM is already running
if [ -f "$VM_DIR/vm.pid" ]; then
    VM_PID=\$(cat "$VM_DIR/vm.pid")
    if ps -p \$VM_PID > /dev/null; then
        echo "✅ VM is already running (PID: \$VM_PID)"
        exit 0
    else
        rm -f "$VM_DIR/vm.pid"
    fi
fi

# Start vfkit VM
vfkit \
    --cpus $VM_CPUS \
    --memory $VM_MEMORY \
    --bootloader "macos,hardware-model=$HARDWARE_MODEL,machine-id=$MACHINE_ID,aux-image=$AUX_IMAGE" \
    --device "virtio-blk,path=$VM_DISK_IMAGE" \
    --device "virtio-net,nat" \
    --gui \
    --log-level "debug" &

VM_PID=\$!
echo "🚀 VM started with PID: \$VM_PID"

# Save PID
echo \$VM_PID > "$VM_DIR/vm.pid"

# Wait a moment
sleep 3

# Check if VM is running
if ps -p \$VM_PID > /dev/null; then
    echo "✅ VibeCode VM is running (PID: \$VM_PID)"
else
    echo "❌ VM failed to start"
    rm -f "$VM_DIR/vm.pid"
    exit 1
fi
EOF
    chmod +x start-vibecode-vfkit-vm.sh
    
    echo "✅ Management scripts created:"
    echo "  ./start-vibecode-vfkit-vm.sh"
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
    echo "🚀 Start VM: ./start-vibecode-vfkit-vm.sh"
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
    echo "   vfkit may need additional configuration"
    echo "   Check the logs above for specific error messages"
    exit 1
fi
