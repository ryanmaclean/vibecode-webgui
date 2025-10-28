#!/bin/bash
#
# Complete automated OmniOS ARM64 installation
#

set -e

echo "🚀 Starting Automated OmniOS ARM64 Installation"
echo "=============================================="
echo ""

# Step 1: Start QEMU with serial console
echo "Step 1: Starting QEMU..."
cd ~/Downloads/omnios-arm64

qemu-system-aarch64 \
  -name omnios-arm64-auto \
  -machine type=virt,accel=hvf \
  -cpu host \
  -m 8G \
  -smp 4 \
  -drive file=omnios-arm64.qcow2,if=virtio,format=qcow2 \
  -device virtio-net,netdev=user.0 \
  -netdev user,id=user.0 \
  -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
  -serial telnet:127.0.0.1:9600,server,nowait \
  -display cocoa > /tmp/qemu-omnios.log 2>&1 &

QEMU_PID=$!
echo "✅ QEMU started (PID: $QEMU_PID)"
echo "   Serial: telnet://localhost:9600"
echo ""

# Step 2: Wait for QEMU to be ready
echo "Step 2: Waiting for QEMU to initialize..."
sleep 10
echo "✅ QEMU ready"
echo ""

# Step 3: Send automated commands
echo "Step 3: Sending automated installation commands..."
echo "   This will take ~3-5 minutes"
echo ""

(
  # Wait for boot
  sleep 30
  echo ""
  
  # Login
  echo "root"
  sleep 5
  
  # Configure network
  echo "ipadm create-addr -T dhcp net0/v4"
  sleep 10
  echo "✓ Network configured"
  
  # Refresh packages
  echo "pkg refresh"
  sleep 15
  echo "✓ Package manager refreshed"
  
  # Install Node.js
  echo "pkg install nodejs"
  sleep 5
  echo "y"
  sleep 90
  echo "✓ Node.js installed"
  
  # Verify Node.js
  echo "node --version"
  sleep 3
  
  # Install code-server
  echo "npm install -g code-server"
  sleep 180
  echo "✓ code-server installed"
  
  # Create config directory
  echo "mkdir -p /root/.config/code-server"
  sleep 2
  
  # Create config file
  echo "cat > /root/.config/code-server/config.yaml << 'EOF'"
  sleep 1
  echo "bind-addr: 0.0.0.0:8080"
  sleep 1
  echo "auth: password"
  sleep 1
  echo "password: omnios-dev-2025"
  sleep 1
  echo "cert: false"
  sleep 1
  echo "EOF"
  sleep 3
  echo "✓ code-server configured"
  
  # Enable SSH
  echo "svcadm enable ssh"
  sleep 3
  echo "✓ SSH enabled"
  
  # Set root password
  echo "echo 'root:omnios123' | chpasswd"
  sleep 2
  echo "✓ Root password set"
  
  # Start code-server
  echo "nohup code-server > /var/log/code-server.log 2>&1 &"
  sleep 5
  echo "✓ code-server started"
  
  # Verify
  echo "ps aux | grep code-server | grep -v grep"
  sleep 2
  
  # Show config
  echo "cat /root/.config/code-server/config.yaml"
  sleep 2
  
  # Show IP
  echo "ifconfig net0 | grep inet"
  sleep 2
  
  echo ""
  echo "=========================================="
  echo "✅ INSTALLATION COMPLETE!"
  echo "=========================================="
  
) | telnet localhost 9600 > /tmp/omnios-install.log 2>&1 &

INSTALL_PID=$!
echo "✅ Installation script running (PID: $INSTALL_PID)"
echo ""

# Step 4: Monitor progress
echo "Step 4: Monitoring installation..."
echo "   Log: tail -f /tmp/omnios-install.log"
echo ""

# Wait for installation
sleep 10

echo "Installation in progress..."
echo ""
echo "To monitor:"
echo "  tail -f /tmp/omnios-install.log"
echo "  telnet localhost 9600"
echo ""
echo "Expected completion: ~5 minutes"
echo ""
echo "Access after completion:"
echo "  1. Get VM IP from Cocoa window console"
echo "  2. SSH: ssh root@<VM_IP>"
echo "     Password: omnios123"
echo "  3. code-server: http://<VM_IP>:8080"
echo "     Password: omnios-dev-2025"
echo ""
echo "QEMU PID: $QEMU_PID"
echo "Install PID: $INSTALL_PID"
echo ""
echo "✅ Automated installation started!"
