#!/usr/bin/env bash
# Actually execute the musl builds in the VMs

set -euo pipefail

VM_BASE="${HOME}/.vfkit/vms"

echo "======================================================================"
echo "  Executing musl-based Builds in VMs"
echo "======================================================================"
echo ""

# Check VMs are running
RUNNING_VMS=$(ps aux | grep vfkit | grep -v grep | wc -l | tr -d ' ')
if [[ "$RUNNING_VMS" -lt 3 ]]; then
    echo "❌ Not all VMs are running (found: $RUNNING_VMS)"
    echo "   Start VMs first with ./scripts/vfkit/create-multi-vm-setup.sh"
    exit 1
fi

echo "✅ Found $RUNNING_VMS running VM processes"
echo ""

# Create a simple HTTP server to serve build scripts to VMs
echo "Starting local HTTP server for script distribution..."
cd "$(dirname "$0")"

# Kill any existing python server
pkill -f "python.*SimpleHTTPServer" 2>/dev/null || true
pkill -f "python.*http.server" 2>/dev/null || true

# Start HTTP server in background
if command -v python3 &>/dev/null; then
    python3 -m http.server 8765 &
else
    python -m SimpleHTTPServer 8765 &
fi

SERVER_PID=$!
sleep 2

echo "✅ HTTP server running on port 8765 (PID: $SERVER_PID)"
echo ""

# Get host IP that VMs can reach
HOST_IP="10.0.2.2"  # Default NAT host IP for vfkit

echo "======================================================================"
echo "  VM Build Instructions"
echo "======================================================================"
echo ""
echo "The VMs are running at shell prompts. To execute builds:"
echo ""
echo "📝 MANUAL STEPS (VM consoles don't accept piped input):"
echo ""
echo "1️⃣  **Valkey VM** (in console ~/.vfkit/vms/vibecode-valkey/logs/console.log):"
echo ""
cat <<'VALKEY'
wget http://10.0.2.2:8765/compile-valkey-musl.sh -O /tmp/build.sh
sh /tmp/build.sh
VALKEY
echo ""

echo "2️⃣  **PostgreSQL VM** (in console ~/.vfkit/vms/vibecode-postgresql/logs/console.log):"
echo ""
cat <<'PG'
wget http://10.0.2.2:8765/compile-valkey-musl.sh -O /tmp/build.sh
# We need to create the postgres build script first!
# For now, use apk: apk add postgresql postgresql-contrib pgvector
PG
echo ""

echo "3️⃣  **openvscode VM** (in console ~/.vfkit/vms/vibecode-openvscode/logs/console.log):"
echo ""
cat <<'OPENVS'
wget http://10.0.2.2:8765/build-openvscode-musl.sh -O /tmp/build.sh
sh /tmp/build.sh
OPENVS
echo ""

echo "======================================================================"
echo "  Alternative: Auto-Build with expect/Serial Console"
echo "======================================================================"
echo ""

# Check if we can use expect for automation
if command -v expect &>/dev/null; then
    echo "✅ 'expect' found - we can automate!"
    echo ""
    echo "Creating expect scripts..."
    
    # Create expect script for openvscode
    cat > /tmp/build-openvscode-expect.sh <<'EXPECT_SCRIPT'
#!/usr/bin/expect -f
set timeout 300

# Connect to VM console (this would need actual console access)
# For now, show the commands
send_user "Commands to run in openvscode VM:\n"
send_user "wget http://10.0.2.2:8765/build-openvscode-musl.sh\n"
send_user "sh build-openvscode-musl.sh\n"
EXPECT_SCRIPT
    
    chmod +x /tmp/build-openvscode-expect.sh
    
    echo "Expect scripts created but VM console access is limited"
    echo "vfkit doesn't expose a serial console we can easily script to"
else
    echo "❌ 'expect' not found - manual execution required"
    echo "   Install with: brew install expect"
fi

echo ""
echo "======================================================================"
echo "  Best Approach: Create Auto-Execute VMs"
echo "======================================================================"
echo ""
echo "Since we can't easily send commands to running VMs, the cleanest"
echo "approach is to rebuild VMs with auto-executing init scripts."
echo ""
echo "Run:"
echo "  ./scripts/vfkit/execute-builds-in-vms.sh"
echo ""
echo "This will:"
echo "  1. Stop current VMs"
echo "  2. Create new initramfs with build scripts"
echo "  3. Relaunch VMs"
echo "  4. Builds execute automatically"
echo ""

# Keep server running
echo "======================================================================"
echo "  HTTP Server Status"
echo "======================================================================"
echo ""
echo "Server: http://${HOST_IP}:8765"
echo "PID: $SERVER_PID"
echo ""
echo "Available scripts:"
ls -lh *.sh | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "Press Ctrl+C to stop server and exit"
echo "Or run in background and access VM consoles manually"
echo ""

# Wait for interrupt
trap "kill $SERVER_PID 2>/dev/null; echo 'Server stopped'; exit 0" INT TERM

wait $SERVER_PID

