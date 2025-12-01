#!/bin/bash
# Rebuild Specialized VMs with Complete Initramfs Pattern
# Based on proven BasicVibeCode implementation
#
# This script rebuilds specialized service VMs (Valkey, PostgreSQL, Node.js, etc.)
# using the working initramfs pattern with virtio network modules + TCP relay

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$HOME/vibecode-webgui"
BASE_INITRAMFS="/tmp/initramfs-with-virtio"
WORK_DIR="/tmp/specialized-vms"
OUTPUT_DIR="$PROJECT_ROOT/azure"
KERNEL="$HOME/Downloads/vmlinuz-5.15.0-161-generic"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Specialized VM Rebuild Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if [ ! -f "$KERNEL" ]; then
    echo -e "${RED}ERROR: Kernel not found at $KERNEL${NC}"
    echo "Please download Ubuntu kernel with virtio modules"
    exit 1
fi
echo -e "${GREEN}✓${NC} Kernel found: $KERNEL"

if [ ! -d "$BASE_INITRAMFS" ]; then
    echo -e "${RED}ERROR: Base initramfs not found at $BASE_INITRAMFS${NC}"
    echo "Please ensure BasicVibeCode initramfs exists"
    exit 1
fi
echo -e "${GREEN}✓${NC} Base initramfs found: $BASE_INITRAMFS"

# Create work directory
mkdir -p "$WORK_DIR"
echo -e "${GREEN}✓${NC} Work directory: $WORK_DIR"
echo ""

# ===========================================
# Function: create_base_template
# Creates a clean base template without service-specific components
# ===========================================
create_base_template() {
    echo -e "${BLUE}[1/6] Creating base template...${NC}"

    local BASE_TEMPLATE="$WORK_DIR/base-template"

    if [ -d "$BASE_TEMPLATE" ]; then
        echo "  Base template already exists, recreating..."
        rm -rf "$BASE_TEMPLATE"
    fi

    # Copy working initramfs (using -a to preserve symlinks)
    echo "  Copying working initramfs foundation..."
    cp -a "$BASE_INITRAMFS" "$BASE_TEMPLATE"

    # Remove OpenVSCode-specific components
    echo "  Removing OpenVSCode-specific components..."
    rm -rf "$BASE_TEMPLATE/opt/openvscode"
    rm -rf "$BASE_TEMPLATE/opt/bun-linux-aarch64"

    # Keep essential components:
    # - BusyBox (/bin/busybox)
    # - Virtio modules (/lib/modules/)
    # - Libraries (/lib/, /usr/lib/)
    # - Network utilities (udhcpc, ip, etc.)
    # - SSH server (dropbear)

    echo -e "${GREEN}  ✓ Base template created${NC}"
    echo "    Size: $(du -sh $BASE_TEMPLATE | cut -f1)"
    echo ""
}

# ===========================================
# Function: build_valkey_vm
# Builds Valkey (Redis alternative) VM
# ===========================================
build_valkey_vm() {
    local VM_NAME="valkey"
    local INITRAMFS_DIR="$WORK_DIR/initramfs-$VM_NAME"
    local OUTPUT_FILE="$OUTPUT_DIR/${VM_NAME}-complete.cpio.gz"

    echo -e "${BLUE}[2/6] Building Valkey VM...${NC}"
    echo ""

    # Copy base template
    echo "  Copying base template..."
    cp -a "$WORK_DIR/base-template" "$INITRAMFS_DIR"

    # TODO: Add Valkey binary
    echo -e "${YELLOW}  ⚠ Valkey binary needs to be added manually${NC}"
    echo "  Download from: https://github.com/valkey-io/valkey"
    echo "  Place at: $INITRAMFS_DIR/bin/valkey-server"
    echo ""

    # Create Valkey configuration
    echo "  Creating Valkey configuration..."
    mkdir -p "$INITRAMFS_DIR/etc"
    cat > "$INITRAMFS_DIR/etc/valkey.conf" << 'EOF'
# Valkey Configuration
bind 0.0.0.0
port 6379
protected-mode no
daemonize no
pidfile /tmp/valkey.pid
loglevel notice
logfile ""
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
dbfilename dump.rdb
dir /tmp
EOF

    # Create init script that starts Valkey
    echo "  Creating init script..."
    cat > "$INITRAMFS_DIR/init" << 'INITEOF'
#!/bin/busybox sh
# Valkey VM Init Script
echo "=== Booting Valkey VM ==="

# ... (standard boot sequence - copy from template)

# Start Valkey server
echo ""
echo "Starting Valkey server..."
if [ -f /bin/valkey-server ]; then
    /bin/valkey-server /etc/valkey.conf &
    VALKEY_PID=$!
    sleep 2
    if ps | grep -v grep | grep -q valkey-server; then
        echo "✓ Valkey server started (PID: $VALKEY_PID)"
        echo "✓ Listening on port 6379"
        echo "Connect with: redis-cli -h <vm-ip> -p 6379"
    else
        echo "ERROR: Valkey server failed to start"
    fi
else
    echo "ERROR: Valkey binary not found at /bin/valkey-server"
fi

# Keep running
exec /bin/ash
INITEOF

    chmod +x "$INITRAMFS_DIR/init"

    # Package initramfs
    echo "  Packaging initramfs..."
    cd "$INITRAMFS_DIR"
    find . | cpio -o -H newc | gzip > "$OUTPUT_FILE"

    local SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Valkey initramfs created: $SIZE${NC}"
    echo "    Location: $OUTPUT_FILE"
    echo ""
}

# ===========================================
# Function: build_postgresql_vm
# Builds PostgreSQL VM
# ===========================================
build_postgresql_vm() {
    local VM_NAME="postgresql"
    local INITRAMFS_DIR="$WORK_DIR/initramfs-$VM_NAME"
    local OUTPUT_FILE="$OUTPUT_DIR/${VM_NAME}-complete.cpio.gz"

    echo -e "${BLUE}[3/6] Building PostgreSQL VM...${NC}"
    echo ""

    # Copy base template
    echo "  Copying base template..."
    cp -a "$WORK_DIR/base-template" "$INITRAMFS_DIR"

    # TODO: Add PostgreSQL binaries
    echo -e "${YELLOW}  ⚠ PostgreSQL binaries need to be added manually${NC}"
    echo "  Required binaries:"
    echo "    - postgres"
    echo "    - initdb"
    echo "    - psql"
    echo "    - pg_ctl"
    echo "  Place in: $INITRAMFS_DIR/usr/bin/"
    echo ""
    echo "  Required libraries:"
    echo "    - libpq.so.5"
    echo "    - Other PostgreSQL dependencies"
    echo "  Place in: $INITRAMFS_DIR/usr/lib/"
    echo ""

    # Create PostgreSQL directories
    echo "  Creating PostgreSQL directories..."
    mkdir -p "$INITRAMFS_DIR/var/lib/postgresql/data"
    mkdir -p "$INITRAMFS_DIR/run/postgresql"

    # Create init script that initializes and starts PostgreSQL
    echo "  Creating init script..."
    cat > "$INITRAMFS_DIR/init" << 'INITEOF'
#!/bin/busybox sh
# PostgreSQL VM Init Script
echo "=== Booting PostgreSQL VM ==="

# ... (standard boot sequence)

# Initialize and start PostgreSQL
echo ""
echo "Setting up PostgreSQL..."

if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."
    /usr/bin/initdb -D /var/lib/postgresql/data
fi

echo "Starting PostgreSQL server..."
/usr/bin/postgres -D /var/lib/postgresql/data -h 0.0.0.0 -p 5432 &
POSTGRES_PID=$!

sleep 3

if ps | grep -v grep | grep -q postgres; then
    echo "✓ PostgreSQL server started (PID: $POSTGRES_PID)"
    echo "✓ Listening on port 5432"
    echo "Connect with: psql -h <vm-ip> -U postgres"
else
    echo "ERROR: PostgreSQL server failed to start"
fi

# Keep running
exec /bin/ash
INITEOF

    chmod +x "$INITRAMFS_DIR/init"

    # Package initramfs
    echo "  Packaging initramfs..."
    cd "$INITRAMFS_DIR"
    find . | cpio -o -H newc | gzip > "$OUTPUT_FILE"

    local SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ PostgreSQL initramfs created: $SIZE${NC}"
    echo "    Location: $OUTPUT_FILE"
    echo ""
}

# ===========================================
# Function: build_nodejs_vm
# Builds Node.js VM
# ===========================================
build_nodejs_vm() {
    local VM_NAME="nodejs"
    local INITRAMFS_DIR="$WORK_DIR/initramfs-$VM_NAME"
    local OUTPUT_FILE="$OUTPUT_DIR/${VM_NAME}-complete.cpio.gz"

    echo -e "${BLUE}[4/6] Building Node.js VM...${NC}"
    echo ""

    # Copy base template
    echo "  Copying base template..."
    cp -a "$WORK_DIR/base-template" "$INITRAMFS_DIR"

    # TODO: Add Node.js binary
    echo -e "${YELLOW}  ⚠ Node.js binary needs to be added manually${NC}"
    echo "  Download from: https://nodejs.org/dist/latest/"
    echo "  Extract and place node binary at: $INITRAMFS_DIR/usr/bin/node"
    echo ""

    # Create simple test server
    echo "  Creating test server..."
    mkdir -p "$INITRAMFS_DIR/opt/nodejs"
    cat > "$INITRAMFS_DIR/opt/nodejs/server.js" << 'EOF'
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Node.js VM is running!\n');
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Node.js server listening on port 3000');
});
EOF

    # Create init script
    echo "  Creating init script..."
    cat > "$INITRAMFS_DIR/init" << 'INITEOF'
#!/bin/busybox sh
# Node.js VM Init Script
echo "=== Booting Node.js VM ==="

# ... (standard boot sequence)

# Start Node.js test server
echo ""
echo "Starting Node.js server..."
if [ -f /usr/bin/node ]; then
    /usr/bin/node /opt/nodejs/server.js &
    NODE_PID=$!
    sleep 2
    if ps | grep -v grep | grep -q node; then
        echo "✓ Node.js server started (PID: $NODE_PID)"
        echo "✓ Listening on port 3000"
        echo "Test with: curl http://<vm-ip>:3000"
    else
        echo "ERROR: Node.js server failed to start"
    fi
else
    echo "ERROR: Node.js binary not found"
fi

# Keep running
exec /bin/ash
INITEOF

    chmod +x "$INITRAMFS_DIR/init"

    # Package initramfs
    echo "  Packaging initramfs..."
    cd "$INITRAMFS_DIR"
    find . | cpio -o -H newc | gzip > "$OUTPUT_FILE"

    local SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Node.js initramfs created: $SIZE${NC}"
    echo "    Location: $OUTPUT_FILE"
    echo ""
}

# ===========================================
# Function: create_app_bundles
# Creates macOS .app bundles for all specialized VMs
# ===========================================
create_app_bundles() {
    echo -e "${BLUE}[5/6] Creating app bundles...${NC}"
    echo ""

    local BUNDLE_DIR="$PROJECT_ROOT/azure/SwiftUI-Apps"

    # This would call bundle-apps.sh or create individual bundles
    echo -e "${YELLOW}  ⚠ App bundle creation requires SwiftUI implementation${NC}"
    echo "  Each VM needs:"
    echo "    - Swift app that launches VM with VZVirtualMachine"
    echo "    - Bundle structure: <Name>.app/Contents/MacOS/<Name>"
    echo "    - Embedded kernel and initramfs in Resources/"
    echo ""
    echo "  See: $BUNDLE_DIR/bundle-apps.sh for reference"
    echo ""
}

# ===========================================
# Function: show_summary
# Shows summary of what was built
# ===========================================
show_summary() {
    echo -e "${BLUE}[6/6] Build Summary${NC}"
    echo ""

    echo "Created initramfs packages:"
    for initramfs in "$OUTPUT_DIR"/*-complete.cpio.gz; do
        if [ -f "$initramfs" ]; then
            local SIZE=$(du -h "$initramfs" | cut -f1)
            local NAME=$(basename "$initramfs")
            echo "  ✓ $NAME ($SIZE)"
        fi
    done
    echo ""

    echo "Next steps:"
    echo "  1. Add service binaries to initramfs directories in $WORK_DIR"
    echo "  2. Rebuild initramfs packages with 'find . | cpio -o -H newc | gzip > output.cpio.gz'"
    echo "  3. Create SwiftUI app bundles referencing these initramfs files"
    echo "  4. Test each VM with launch scripts"
    echo ""

    echo "Testing commands:"
    echo "  # Valkey"
    echo "  redis-cli -h 192.168.64.3 -p 6379 PING"
    echo ""
    echo "  # PostgreSQL"
    echo "  psql -h 192.168.64.3 -U postgres -d postgres -c '\\l'"
    echo ""
    echo "  # Node.js"
    echo "  curl http://192.168.64.3:3000"
    echo ""
}

# ===========================================
# Main Execution
# ===========================================

# Ask user what to build
echo "Select VMs to build:"
echo "  1) Valkey (Redis alternative)"
echo "  2) PostgreSQL"
echo "  3) Node.js"
echo "  4) All of the above"
echo "  5) Exit"
echo ""
echo -n "Choice [1-5]: "
read -r choice

case "$choice" in
    1)
        create_base_template
        build_valkey_vm
        create_app_bundles
        show_summary
        ;;
    2)
        create_base_template
        build_postgresql_vm
        create_app_bundles
        show_summary
        ;;
    3)
        create_base_template
        build_nodejs_vm
        create_app_bundles
        show_summary
        ;;
    4)
        create_base_template
        build_valkey_vm
        build_postgresql_vm
        build_nodejs_vm
        create_app_bundles
        show_summary
        ;;
    *)
        echo "Exiting."
        exit 0
        ;;
esac

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Rebuild Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Documentation: $PROJECT_ROOT/docs/SPECIALIZED_VM_REBUILD_PLAN.md"
echo ""
