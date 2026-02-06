#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build K3s + Gitpod tools initramfs for ARM64

# Initialize log aggregation
init_log_aggregation

set -e

cd "$(dirname "$0")/.."
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

INITRAMFS_DIR="$WORK_DIR/initramfs"
mkdir -p "$INITRAMFS_DIR"

echo "=== Building K3s + Gitpod ARM64 Initramfs ==="

# Extract Alpine base
tar -xzf /tmp/alpine-minirootfs-3.19-aarch64.tar.gz -C "$INITRAMFS_DIR"

# Download K3s
echo "Downloading K3s..."
curl -L "https://github.com/k3s-io/k3s/releases/download/v1.29.0+k3s1/k3s-arm64" \
    -o "$INITRAMFS_DIR/usr/local/bin/k3s"
chmod +x "$INITRAMFS_DIR/usr/local/bin/k3s"

# Download Helm
echo "Downloading Helm..."
curl -L "https://get.helm.sh/helm-v3.13.0-linux-arm64.tar.gz" | tar -xz -C "$WORK_DIR"
cp "$WORK_DIR/linux-arm64/helm" "$INITRAMFS_DIR/usr/local/bin/"
chmod +x "$INITRAMFS_DIR/usr/local/bin/helm"

# Create init script
cat > "$INITRAMFS_DIR/init" << 'INIT_EOF'
#!/bin/sh
set -e

echo "=== Booting K3s + Gitpod Workspace (ARM64) ==="

mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /var/lib/rancher/k3s

# Network
ip link set lo up
for i in $(seq 1 30); do
    if ip link show eth0 >/dev/null 2>&1; then
        ip link set eth0 up
        udhcpc -i eth0 -n -q || true
        break
    fi
    sleep 1
done

VM_IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || echo "unknown")
echo "Network: $VM_IP"

# Install Gitpod tools
apk update
apk add --no-cache bash curl git vim sudo openssh nodejs npm python3 docker-cli jq htop || true

# Start K3s
echo "Starting K3s..."
/usr/local/bin/k3s server --disable traefik --disable servicelb --write-kubeconfig-mode 644 --data-dir /var/lib/rancher/k3s &

# Wait for K3s
export KUBECONFIG=/var/lib/rancher/k3s/agent/kubeconfig.yaml
for i in $(seq 1 60); do
    if /usr/local/bin/k3s kubectl get nodes >/dev/null 2>&1; then
        echo "✅ K3s ready"
        break
    fi
    sleep 1
done

# Add Helm repos
/usr/local/bin/helm repo add bitnami https://charts.bitnami.com/bitnami
/usr/local/bin/helm repo update

echo ""
echo "=== K3s + Gitpod Workspace Ready ==="
echo "IP: $VM_IP"
echo "K3s: kubectl --kubeconfig=$KUBECONFIG get pods"
echo ""

exec /bin/sh
INIT_EOF

chmod +x "$INITRAMFS_DIR/init"

# Build
cd "$INITRAMFS_DIR"
find . | cpio -o -H newc | gzip > "$WORK_DIR/gitpod-k3s-arm64.cpio.gz"

SIZE=$(du -h "$WORK_DIR/gitpod-k3s-arm64.cpio.gz" | cut -f1)
mkdir -p azure
cp "$WORK_DIR/gitpod-k3s-arm64.cpio.gz" azure/

echo "✅ Built: azure/gitpod-k3s-arm64.cpio.gz ($SIZE)"
