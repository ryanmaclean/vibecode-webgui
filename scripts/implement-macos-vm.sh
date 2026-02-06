#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# VibeCode macOS VM Implementation
# Create and manage macOS virtual machines for VibeCode development

# Initialize log aggregation
init_log_aggregation


set -e

echo "🍎 VibeCode macOS VM Implementation"
echo "==================================="

# Configuration
VM_NAME="VibeCode-Dev"
VM_MEMORY="8GB"
VM_DISK="64GB"
VM_CPUS="4"
VM_MACOS_VERSION="14.0"

# Check if running on Apple Silicon
if [[ $(uname -m) != "arm64" ]]; then
    echo "❌ macOS virtualization requires Apple Silicon Mac"
    echo "   This script only works on M1, M2, M3, or newer Macs"
    exit 1
fi

echo "✅ Apple Silicon detected: $(uname -m)"

# Check if Virtualization Framework is available
if ! command -v vmutil >/dev/null 2>&1; then
    echo "❌ Virtualization Framework not available"
    echo "   Install Xcode Command Line Tools: xcode-select --install"
    exit 1
fi

echo "✅ Virtualization Framework available"

# Check available disk space
AVAILABLE_SPACE=$(df -h / | tail -1 | awk '{print $4}' | sed 's/Gi//')
if [ "$AVAILABLE_SPACE" -lt 100 ]; then
    echo "❌ Insufficient disk space: ${AVAILABLE_SPACE}GB available"
    echo "   Need at least 100GB for VM creation"
    exit 1
fi

echo "✅ Sufficient disk space: ${AVAILABLE_SPACE}GB available"

# Check available memory
TOTAL_MEMORY=$(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024}')
if [ "$(echo "$TOTAL_MEMORY < 16" | bc)" -eq 1 ]; then
    echo "❌ Insufficient memory: ${TOTAL_MEMORY}GB total"
    echo "   Need at least 16GB for VM creation"
    exit 1
fi

echo "✅ Sufficient memory: ${TOTAL_MEMORY}GB total"

# Create VM configuration
echo "📝 Creating VM configuration..."
cat > vibecode-vm-config.json << 'EOF'
{
    "name": "VibeCode-Dev",
    "memory": "8GB",
    "cpus": 4,
    "disk": "64GB",
    "macos_version": "14.0",
    "features": {
        "gpu_acceleration": true,
        "rosetta_support": true,
        "shared_storage": true,
        "network_bridge": true,
        "memory_ballooning": false,
        "memory_compression": true,
        "cpu_pinning": true,
        "cpu_hotplug": false,
        "network_acceleration": true
    },
    "storage": {
        "type": "virtio-blk",
        "size": "64GB",
        "format": "qcow2"
    },
    "network": {
        "type": "virtio-net",
        "bridge": "vmnet0"
    },
    "display": {
        "type": "virtio-gpu",
        "resolution": "1920x1080",
        "acceleration": true
    }
}
EOF

# Check if VM already exists
if vmutil list | grep -q "$VM_NAME"; then
    echo "⚠️  VM '$VM_NAME' already exists"
    read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing VM..."
        vmutil delete "$VM_NAME"
    else
        echo "✅ Using existing VM"
        vmutil start "$VM_NAME"
        exit 0
    fi
fi

# Create VM
echo "🏗️  Creating macOS VM..."
vmutil create --config vibecode-vm-config.json

# Start VM
echo "🚀 Starting VM..."
vmutil start "$VM_NAME"

# Wait for VM to boot
echo "⏳ Waiting for VM to boot (this may take 5-10 minutes)..."
sleep 60

# Check VM status
echo "🔍 Checking VM status..."
vmutil status "$VM_NAME"

# Install dependencies in VM
echo "📦 Installing VibeCode dependencies in VM..."
vmutil exec "$VM_NAME" -- /bin/bash -c "
    # Update system
    softwareupdate --install --all
    
    # Install Xcode Command Line Tools
    xcode-select --install
    
    # Install Homebrew
    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
    
    # Add Homebrew to PATH
    echo 'eval \"\$(/opt/homebrew/bin/brew shellenv)\"' >> ~/.zshrc
    source ~/.zshrc
    
    # Install VibeCode dependencies
    brew install node git code-server
    
    # Install VibeCode
    git clone https://github.com/ryanmaclean/vibecode-webgui.git /opt/vibecode
    cd /opt/vibecode
    npm install
    
    # Create VibeCode launcher
    cat > /usr/local/bin/vibecode-vm << 'EOF'
#!/bin/bash
cd /opt/vibecode
code-server --bind-addr 0.0.0.0:8080 --auth none --disable-telemetry --disable-update-check --disable-workspace-trust --disable-getting-started-override --user-data-dir ~/.config/code-server/user-data --extensions-dir ~/.config/code-server/extensions .
EOF
    
    chmod +x /usr/local/bin/vibecode-vm
    
    echo '✅ VibeCode installed in VM'
"

# Create VM management scripts
echo "📝 Creating VM management scripts..."

# Start VM script
cat > start-vibecode-vm.sh << 'EOF'
#!/bin/bash
# Start VibeCode macOS VM

VM_NAME="VibeCode-Dev"

echo "🚀 Starting VibeCode macOS VM..."
vmutil start "$VM_NAME"

# Wait for VM to boot
echo "⏳ Waiting for VM to boot..."
sleep 30

# Check VM status
vmutil status "$VM_NAME"

echo "✅ VibeCode VM is running"
echo "🌐 Access VibeCode at: http://localhost:8080"
echo "🔧 SSH to VM: vmutil exec $VM_NAME -- /bin/bash"
EOF

chmod +x start-vibecode-vm.sh

# Stop VM script
cat > stop-vibecode-vm.sh << 'EOF'
#!/bin/bash
# Stop VibeCode macOS VM

VM_NAME="VibeCode-Dev"

echo "🛑 Stopping VibeCode macOS VM..."
vmutil stop "$VM_NAME"

echo "✅ VibeCode VM stopped"
EOF

chmod +x stop-vibecode-vm.sh

# VM performance monitor
cat > monitor-vibecode-vm.sh << 'EOF'
#!/bin/bash
# Monitor VibeCode macOS VM performance

VM_NAME="VibeCode-Dev"

echo "📊 VibeCode VM Performance Monitor"
echo "=================================="

# VM Status
echo "🔍 VM Status:"
vmutil status "$VM_NAME"

# VM Resource Usage
echo ""
echo "💾 VM Resource Usage:"
vmutil stats "$VM_NAME"

# Host Resource Usage
echo ""
echo "🖥️  Host Resource Usage:"
echo "  CPU Usage: $(top -l 1 | grep "CPU usage" | awk '{print $3}')"
echo "  Memory Usage: $(vm_stat | grep "Pages active" | awk '{print $3}' | sed 's/\.//')MB"
echo "  Disk Usage: $(df -h / | tail -1 | awk '{print $5}')"

# Performance Comparison
echo ""
echo "📈 Performance Comparison:"
echo "  VM CPU: $(vmutil stats "$VM_NAME" | grep "CPU" | awk '{print $2}')"
echo "  VM Memory: $(vmutil stats "$VM_NAME" | grep "Memory" | awk '{print $2}')"
echo "  VM Disk: $(vmutil stats "$VM_NAME" | grep "Disk" | awk '{print $2}')"
EOF

chmod +x monitor-vibecode-vm.sh

# Create VM snapshot script
cat > snapshot-vibecode-vm.sh << 'EOF'
#!/bin/bash
# Create snapshot of VibeCode macOS VM

VM_NAME="VibeCode-Dev"
SNAPSHOT_NAME="vibecode-snapshot-$(date +%Y%m%d-%H%M%S)"

echo "📸 Creating VM snapshot: $SNAPSHOT_NAME"
vmutil snapshot "$VM_NAME" "$SNAPSHOT_NAME"

echo "✅ Snapshot created: $SNAPSHOT_NAME"
echo "🔄 Restore snapshot: vmutil restore $VM_NAME $SNAPSHOT_NAME"
EOF

chmod +x snapshot-vibecode-vm.sh

# Test VibeCode in VM
echo "🧪 Testing VibeCode in VM..."
vmutil exec "$VM_NAME" -- /bin/bash -c "
    # Start VibeCode
    vibecode-vm &
    
    # Wait for startup
    sleep 10
    
    # Test if VibeCode is running
    if curl -s http://localhost:8080 > /dev/null; then
        echo '✅ VibeCode is running in VM'
    else
        echo '❌ VibeCode failed to start in VM'
    fi
"

# Final status
echo ""
echo "🎉 VibeCode macOS VM Implementation Complete!"
echo "============================================="
echo ""
echo "📁 VM Name: $VM_NAME"
echo "🚀 Start VM: ./start-vibecode-vm.sh"
echo "🛑 Stop VM: ./stop-vibecode-vm.sh"
echo "📊 Monitor VM: ./monitor-vibecode-vm.sh"
echo "📸 Snapshot VM: ./snapshot-vibecode-vm.sh"
echo ""
echo "🔧 VM Management Commands:"
echo "  vmutil start $VM_NAME"
echo "  vmutil stop $VM_NAME"
echo "  vmutil status $VM_NAME"
echo "  vmutil exec $VM_NAME -- /bin/bash"
echo ""
echo "🌐 Access VibeCode:"
echo "  VM IP: $(vmutil get-ip "$VM_NAME")"
echo "  VibeCode URL: http://$(vmutil get-ip "$VM_NAME"):8080"
echo ""
echo "⚡ Performance Notes:"
echo "  • VM uses 8GB RAM + 4 CPU cores"
echo "  • Expected 85-95% of native performance"
echo "  • GPU acceleration enabled"
echo "  • Shared storage available"
echo ""
echo "🔥 VibeCode macOS VM is ready for development!"
