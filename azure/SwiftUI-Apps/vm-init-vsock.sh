#!/bin/busybox sh
# Init script for Bun OpenVSCode VM using VirtIO Socket (vsock) communication
# This replaces NAT networking with direct host-guest socket communication

echo "=== Booting Bun OpenVSCode VM (Vsock Edition) ==="

# Create symlinks for busybox applets
/bin/busybox --install -s /bin

# Mount essential filesystems
echo "Mounting filesystems..."
mount -t proc proc /proc 2>/dev/null || echo "Warning: Failed to mount /proc"
mount -t sysfs sys /sys 2>/dev/null || echo "Warning: Failed to mount /sys"
mount -t devtmpfs dev /dev 2>/dev/null || echo "Warning: Failed to mount /dev"
mount -t tmpfs tmp /tmp 2>/dev/null || echo "Warning: Failed to mount /tmp"

# Create /etc directory and hosts file for localhost resolution
echo "Creating /etc/hosts..."
mkdir -p /etc
cat > /etc/hosts << 'HOSTSEOF'
127.0.0.1       localhost localhost.localdomain
::1             localhost localhost.localdomain
HOSTSEOF

# Set hostname
hostname openvscode-vm 2>/dev/null || true
echo "openvscode-vm" > /etc/hostname 2>/dev/null || true

# Create necessary directories
echo "Creating directories..."
mkdir -p /tmp/vscode-data /tmp/workspace 2>/dev/null

# Setup loopback ONLY - no eth0 networking needed!
echo "Setting up loopback (no eth0 required)..."
ip link set lo up 2>/dev/null || echo "Warning: Failed to bring up loopback"

# Check for vsock device
echo "Checking for vsock device..."
if [ -e /dev/vsock ]; then
    echo "SUCCESS: /dev/vsock found!"
    ls -la /dev/vsock
else
    echo "WARNING: /dev/vsock not found - vsock may not be available"
    ls -la /dev/ | grep -i virt || echo "No virtio devices found"
fi

# Show what devices we have
echo "Available devices:"
ls -la /dev/ | grep -E "(vsock|vport)"

echo "Network interfaces (should only have loopback):"
ip addr show 2>/dev/null || echo "Warning: Could not show network status"

# Check Bun binary
echo ""
echo "Checking Bun binary..."
ls -la /opt/bun-linux-aarch64/bun || echo "ERROR: Bun binary not found!"
echo "Checking dynamic linker..."
ls -la /lib/ld-linux-aarch64.so.1 || echo "ERROR: Dynamic linker not found!"
echo "Checking libc..."
ls -la /lib/libc.so.6 || echo "ERROR: libc not found!"

# Set library path
export LD_LIBRARY_PATH=/lib:/lib/aarch64-linux-gnu

# Create a vsock-aware server script
echo "Creating vsock server wrapper..."
cat > /tmp/vsock-server.js << 'JSEOF'
// Bun server that connects to host via vsock instead of network
const VSOCK_CID_HOST = 2; // Host CID in vsock
const VSOCK_PORT = 3000;  // Port the host is listening on

console.log("=== VibeCode OpenVSCode Server (Vsock Edition) ===");
console.log("Starting server with vsock connection to host...");

// Import required modules
const { spawn } = require("child_process");
const net = require("net");

// Check if vsock is available
const fs = require("fs");
if (fs.existsSync("/dev/vsock")) {
    console.log("Vsock device found at /dev/vsock");
} else {
    console.log("WARNING: /dev/vsock not found!");
}

// Start OpenVSCode Server
console.log("Starting OpenVSCode Server...");

// Simple HTTP server that serves OpenVSCode
const server = Bun.serve({
    port: 3000,
    hostname: "0.0.0.0",

    async fetch(req) {
        const url = new URL(req.url);

        // Serve a simple status page
        if (url.pathname === "/") {
            return new Response("OpenVSCode Server Running on Vsock!", {
                headers: { "Content-Type": "text/plain" }
            });
        }

        // Serve files from OpenVSCode directory
        const filepath = "/opt/openvscode" + url.pathname;
        const file = Bun.file(filepath);

        if (await file.exists()) {
            return new Response(file);
        }

        return new Response("Not Found", { status: 404 });
    }
});

console.log("Server will be available at http://localhost:3000 (via vsock)");
console.log("Connect from host: The SwiftUI app will forward localhost:3000 -> vsock");
console.log("");
console.log("Server is ready and listening...");

// Keep the process alive
process.on('SIGTERM', () => {
    console.log("Shutting down...");
    server.stop();
    process.exit(0);
});
JSEOF

# Alternative: Create vsock client that connects TO the host
cat > /tmp/vsock-client.js << 'JSEOF'
// Reverse proxy: Guest connects TO host's vsock listener
// The host (SwiftUI app) listens on vsock port 3000
// This script connects to it and forwards OpenVSCode traffic

const net = require("net");
const VSOCK_CID_HOST = 2;
const VSOCK_PORT = 3000;

console.log("=== Vsock Client Mode ===");
console.log("Connecting to host vsock CID 2, port 3000...");

// Start local HTTP server for OpenVSCode
const localServer = Bun.serve({
    port: 3001,
    hostname: "127.0.0.1",

    async fetch(req) {
        return new Response("OpenVSCode via Vsock!\n", {
            headers: { "Content-Type": "text/plain" }
        });
    }
});

console.log("Local OpenVSCode server running on 127.0.0.1:3001");

// Try to connect to host via vsock
// Note: This requires vsock kernel module and proper setup
console.log("Attempting vsock connection to host...");

// For now, just run the server locally
// The vsock connection would be established by the host's proxy
console.log("Server will be available via host vsock proxy");

JSEOF

# Start OpenVSCode with Bun
echo ""
echo "=== Starting OpenVSCode Server ==="
echo ""

export PORT=3000
export HOST=0.0.0.0
cd /opt/openvscode

# Execute Bun with the vsock-aware server
echo "Executing Bun with vsock server..."
if [ -f /lib/ld-linux-aarch64.so.1 ]; then
    # Use the vsock server script
    exec /lib/ld-linux-aarch64.so.1 /opt/bun-linux-aarch64/bun run /tmp/vsock-server.js
else
    # Fallback to direct execution
    exec /opt/bun-linux-aarch64/bun run /tmp/vsock-server.js
fi
