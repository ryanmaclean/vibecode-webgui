#!/bin/bash
#
# Configure LX-Branded Zone for VibeCode
# Sets up Debian-compatible zone with ZFS datasets and networking
#

set -euo pipefail

# Configuration
ZONE_NAME="vibecode-zone"
ZONE_PATH="/zones/$ZONE_NAME"
ZONE_VNIC="vibecode0"
ZONE_CPUS=4
ZONE_MEMORY="8G"
ZONE_SWAP="10G"
DEBIAN_IMAGE_URL="https://us-central.manta.mnx.io/Joyent_Dev/public/lx-debian-11/lx-debian-11-latest.zss.gz"
DEBIAN_IMAGE="lx-debian-11-latest.zss"
PRIMARY_NIC=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Update OpenIndiana packages
update_system() {
    log_info "Updating OpenIndiana base system..."
    pkg update -v || log_warn "Package update failed, continuing..."
}

# Install lx-branded zone support
install_lx_brand() {
    log_info "Installing lx-branded zone support..."

    if pkg list brand/lx >/dev/null 2>&1; then
        log_info "lx-branded zone already installed"
    else
        pkg install -v brand/lx
    fi

    # Verify installation
    if ! pkg list brand/lx >/dev/null 2>&1; then
        log_error "Failed to install lx-branded zone"
        exit 1
    fi

    log_info "lx-branded zone installed successfully"
}

# Download Debian image
download_debian_image() {
    log_info "Downloading Debian 11 image for lx zone..."

    if [ -f "$DEBIAN_IMAGE" ]; then
        log_info "Debian image already exists: $DEBIAN_IMAGE"
        return
    fi

    # Download compressed image
    if [ ! -f "${DEBIAN_IMAGE}.gz" ]; then
        log_info "Downloading from: $DEBIAN_IMAGE_URL"
        curl -L -o "${DEBIAN_IMAGE}.gz" "$DEBIAN_IMAGE_URL"
    fi

    # Decompress
    log_info "Decompressing image..."
    gunzip "${DEBIAN_IMAGE}.gz"

    log_info "Debian image ready: $DEBIAN_IMAGE"
}

# Detect primary network interface
detect_network() {
    log_info "Detecting primary network interface..."

    PRIMARY_NIC=$(dladm show-phys -p -o LINK | head -1)

    if [ -z "$PRIMARY_NIC" ]; then
        log_error "No network interface found"
        exit 1
    fi

    log_info "Primary NIC: $PRIMARY_NIC"
}

# Create VNIC for zone
create_vnic() {
    log_info "Creating VNIC: $ZONE_VNIC"

    # Check if VNIC already exists
    if dladm show-vnic "$ZONE_VNIC" >/dev/null 2>&1; then
        log_warn "VNIC $ZONE_VNIC already exists, removing..."
        dladm delete-vnic "$ZONE_VNIC"
    fi

    # Create VNIC with bandwidth limit
    dladm create-vnic -l "$PRIMARY_NIC" -p maxbw=1000 "$ZONE_VNIC"

    # Verify creation
    dladm show-vnic "$ZONE_VNIC"

    log_info "VNIC created successfully"
}

# Create ZFS datasets
create_zfs_datasets() {
    log_info "Creating ZFS datasets for zone..."

    # Create base zones dataset if it doesn't exist
    if ! zfs list rpool/zones >/dev/null 2>&1; then
        zfs create -o mountpoint=/zones rpool/zones
    fi

    # Create zone dataset
    if zfs list "rpool/zones/$ZONE_NAME" >/dev/null 2>&1; then
        log_warn "Zone dataset already exists"
    else
        zfs create "rpool/zones/$ZONE_NAME"
    fi

    # Create dedicated datasets for different workloads
    log_info "Creating optimized datasets..."

    # PostgreSQL dataset (optimized for small random I/O)
    if ! zfs list "rpool/zones/$ZONE_NAME/postgres" >/dev/null 2>&1; then
        zfs create "rpool/zones/$ZONE_NAME/postgres"
        zfs set recordsize=8K "rpool/zones/$ZONE_NAME/postgres"
        zfs set logbias=latency "rpool/zones/$ZONE_NAME/postgres"
        zfs set primarycache=metadata "rpool/zones/$ZONE_NAME/postgres"
    fi

    # Redis dataset (optimized for fast access)
    if ! zfs list "rpool/zones/$ZONE_NAME/redis" >/dev/null 2>&1; then
        zfs create "rpool/zones/$ZONE_NAME/redis"
        zfs set recordsize=8K "rpool/zones/$ZONE_NAME/redis"
        zfs set compression=lz4 "rpool/zones/$ZONE_NAME/redis"
    fi

    # Application dataset (compressed, no atime)
    if ! zfs list "rpool/zones/$ZONE_NAME/app" >/dev/null 2>&1; then
        zfs create "rpool/zones/$ZONE_NAME/app"
        zfs set compression=lz4 "rpool/zones/$ZONE_NAME/app"
        zfs set atime=off "rpool/zones/$ZONE_NAME/app"
    fi

    log_info "ZFS datasets created"
    zfs list | grep "$ZONE_NAME"
}

# Create zone configuration
create_zone_config() {
    log_info "Creating zone configuration..."

    # Check if zone already exists
    if zoneadm list -cp | grep -q "^$ZONE_NAME:"; then
        log_warn "Zone $ZONE_NAME already exists, removing..."
        zoneadm -z "$ZONE_NAME" halt 2>/dev/null || true
        zoneadm -z "$ZONE_NAME" uninstall -F || true
        zonecfg -z "$ZONE_NAME" delete -F || true
    fi

    # Create zone configuration
    zonecfg -z "$ZONE_NAME" <<EOF
create -t lx
set zonepath=$ZONE_PATH
set autoboot=true
set ip-type=exclusive
add net
set physical=$ZONE_VNIC
end
add attr
set name=resolvers
set type=string
set value=8.8.8.8,8.8.4.4
end
add attr
set name=dns-domain
set type=string
set value=local
end
add capped-cpu
set ncpus=$ZONE_CPUS
end
add capped-memory
set physical=$ZONE_MEMORY
set swap=$ZONE_SWAP
end
EOF

    log_info "Zone configuration created"
    zonecfg -z "$ZONE_NAME" info
}

# Install zone from Debian image
install_zone() {
    log_info "Installing zone from Debian image..."

    if [ ! -f "$DEBIAN_IMAGE" ]; then
        log_error "Debian image not found: $DEBIAN_IMAGE"
        exit 1
    fi

    # Install zone
    zoneadm -z "$ZONE_NAME" install -s "$DEBIAN_IMAGE"

    log_info "Zone installed successfully"
}

# Boot zone
boot_zone() {
    log_info "Booting zone: $ZONE_NAME"

    zoneadm -z "$ZONE_NAME" boot

    # Wait for zone to fully boot
    log_info "Waiting for zone to boot..."
    sleep 10

    # Verify zone is running
    if zoneadm list -v | grep -q "$ZONE_NAME.*running"; then
        log_info "Zone is running"
    else
        log_error "Zone failed to boot"
        zoneadm list -v
        exit 1
    fi
}

# Configure zone networking
configure_zone_network() {
    log_info "Configuring zone networking..."

    # Configure network inside zone
    zlogin "$ZONE_NAME" <<'EOF'
# Configure DHCP
cat > /etc/network/interfaces <<NETCONF
auto lo
iface lo inet loopback

auto net0
iface net0 inet dhcp
NETCONF

# Restart networking
systemctl restart networking

# Test connectivity
sleep 5
ping -c 3 8.8.8.8 || echo "Warning: Network connectivity test failed"

# Update package lists
apt update

echo "Zone network configured"
EOF

    log_info "Zone networking configured"
}

# Create baseline snapshot
create_snapshot() {
    log_info "Creating baseline ZFS snapshot..."

    zfs snapshot "rpool/zones/$ZONE_NAME@baseline"

    log_info "Snapshot created: rpool/zones/$ZONE_NAME@baseline"
}

# Display zone information
show_zone_info() {
    log_info "Zone Configuration Summary"
    echo "================================"

    echo "Zone Name: $ZONE_NAME"
    echo "Zone Path: $ZONE_PATH"
    echo "Zone State: $(zoneadm list -v | grep "$ZONE_NAME" | awk '{print $3}')"
    echo "VNIC: $ZONE_VNIC"

    echo ""
    echo "Resource Limits:"
    echo "  CPUs: $ZONE_CPUS"
    echo "  Memory: $ZONE_MEMORY"
    echo "  Swap: $ZONE_SWAP"

    echo ""
    echo "ZFS Datasets:"
    zfs list | grep "$ZONE_NAME"

    echo ""
    echo "Network Configuration:"
    dladm show-vnic "$ZONE_VNIC"

    echo ""
    echo "Zone IP Address:"
    zlogin "$ZONE_NAME" ip addr show net0 2>/dev/null | grep "inet " | awk '{print $2}' || echo "Not available yet"

    echo ""
    echo "================================"
}

# Main
main() {
    log_info "VibeCode LX Zone Configuration"
    log_info "=============================="

    check_root
    update_system
    install_lx_brand
    download_debian_image
    detect_network
    create_vnic
    create_zfs_datasets
    create_zone_config
    install_zone
    boot_zone
    configure_zone_network
    create_snapshot
    show_zone_info

    cat <<EOF

${GREEN}Zone setup complete!${NC}

Next Steps:
  1. Login to zone:
       zlogin $ZONE_NAME

  2. Inside zone, continue setup:
       Run: ./03-install-node24.sh
       Run: ./04-setup-postgres-pgvector.sh
       Run: ./05-deploy-vibecode.sh

Useful Commands:
  - Zone console:  zlogin -C $ZONE_NAME  (Ctrl+] to exit)
  - Zone status:   zoneadm list -v
  - Zone reboot:   zoneadm -z $ZONE_NAME reboot
  - Zone halt:     zoneadm -z $ZONE_NAME halt
  - Zone stats:    zonestat 5 5

Resource Monitoring:
  - CPU/Memory:    prstat -Z
  - Network:       dladm show-vnic -s
  - ZFS:           zpool iostat 5

EOF
}

main "$@"
