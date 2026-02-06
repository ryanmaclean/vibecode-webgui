#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build K3s-based initramfs for VM deployment
# Creates minimal Alpine Linux + K3s + Helm initramfs

# Initialize log aggregation
init_log_aggregation


set -e

cd "$(dirname "$0")/.."

WORKDIR=$(mktemp -d)
# Don't use trap - we'll clean up manually after copy

echo "=== Building K3s-Based Initramfs ==="
echo "Working directory: $WORKDIR"
echo ""

# Configuration
K3S_VERSION="v1.29.0+k3s1"
HELM_VERSION="v3.13.0"
ALPINE_VERSION="3.19"
ARCH="arm64"

# Create initramfs structure
INITRAMFS_DIR="$WORKDIR/initramfs"
mkdir -p "$INITRAMFS_DIR"/{bin,sbin,usr/local/bin,etc/init.d,lib,proc,sys,dev,tmp,var/lib/rancher/k3s}

echo "1. Downloading K3s..."
K3S_URL="https://github.com/k3s-io/k3s/releases/download/${K3S_VERSION}/k3s-${ARCH}"
curl -L "$K3S_URL" -o "$INITRAMFS_DIR/usr/local/bin/k3s"
chmod +x "$INITRAMFS_DIR/usr/local/bin/k3s"
echo "   ✅ K3s downloaded ($(du -h "$INITRAMFS_DIR/usr/local/bin/k3s" | cut -f1))"

echo ""
echo "2. Downloading Helm..."
HELM_URL="https://get.helm.sh/helm-${HELM_VERSION}-linux-${ARCH}.tar.gz"
curl -L "$HELM_URL" | tar -xz -C "$WORKDIR"
chmod +x "$WORKDIR/linux-${ARCH}/helm"
cp "$WORKDIR/linux-${ARCH}/helm" "$INITRAMFS_DIR/usr/local/bin/"
echo "   ✅ Helm downloaded ($(du -h "$INITRAMFS_DIR/usr/local/bin/helm" | cut -f1))"

echo ""
echo "3. Creating init script..."
cat > "$INITRAMFS_DIR/init" << 'INITEOF'
#!/bin/sh
# K3s-based VM init script

set -e

echo "=== Booting K3s-Based VM ==="

# Mount filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /var/lib/rancher/k3s

# Setup networking
echo "Setting up networking..."
ip link set lo up

# Wait for network interface
for i in $(seq 1 30); do
    if ip link show eth0 >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ip link show eth0 >/dev/null 2>&1; then
    ip link set eth0 up
    udhcpc -i eth0 || true
    echo "Network configured"
else
    echo "Warning: No network interface found"
fi

# Start K3s server
echo "Starting K3s..."
/usr/local/bin/k3s server \
  --disable traefik \
  --disable servicelb \
  --write-kubeconfig-mode 644 \
  --data-dir /var/lib/rancher/k3s \
  --log /tmp/k3s.log &

# Wait for K3s to be ready
echo "Waiting for K3s API..."
export KUBECONFIG=/var/lib/rancher/k3s/agent/kubeconfig.yaml
for i in $(seq 1 60); do
    if /usr/local/bin/k3s kubectl get nodes >/dev/null 2>&1; then
        echo "✅ K3s is ready!"
        break
    fi
    sleep 1
done

# Display node status
/usr/local/bin/k3s kubectl get nodes

# Add Helm repositories
echo ""
echo "Adding Helm repositories..."
/usr/local/bin/helm repo add bitnami https://charts.bitnami.com/bitnami
/usr/local/bin/helm repo update

# Deploy services (can be customized)
echo ""
echo "=== Deploying Services ==="

# Example: Deploy Valkey
if [ -f /helm-charts/valkey/Chart.yaml ]; then
    echo "Deploying Valkey from local chart..."
    /usr/local/bin/helm install valkey /helm-charts/valkey --wait
else
    echo "Deploying Valkey from Bitnami..."
    /usr/local/bin/helm install valkey bitnami/redis \
      --set auth.enabled=false \
      --set master.persistence.enabled=false \
      --wait || true
fi

# Example: Deploy PostgreSQL
if [ -f /helm-charts/postgresql/Chart.yaml ]; then
    echo "Deploying PostgreSQL from local chart..."
    /usr/local/bin/helm install postgresql /helm-charts/postgresql --wait
else
    echo "Deploying PostgreSQL from Bitnami..."
    /usr/local/bin/helm install postgresql bitnami/postgresql \
      --set auth.postgresPassword=vibecode \
      --set auth.database=vibecode \
      --set persistence.enabled=false \
      --wait || true
fi

# Display deployed services
echo ""
echo "=== Deployed Services ==="
/usr/local/bin/k3s kubectl get pods --all-namespaces

# Get VM IP
VM_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
echo ""
echo "=========================================="
echo "=== K3s VM Ready ==="
echo "=========================================="
echo "VM IP address: $VM_IP"
echo ""
echo "Access Kubernetes:"
echo "  kubectl --kubeconfig=/var/lib/rancher/k3s/agent/kubeconfig.yaml get pods"
echo ""
echo "Access Services:"
echo "  Valkey: redis-cli -h $VM_IP -p 6379"
echo "  PostgreSQL: psql -h $VM_IP -U postgres -d vibecode"
echo "=========================================="

# Keep running
exec /bin/sh
INITEOF

chmod +x "$INITRAMFS_DIR/init"

echo ""
echo "4. Creating minimal Alpine base..."
# Copy essential binaries from Alpine (if available)
# For now, we'll create a minimal structure
mkdir -p "$INITRAMFS_DIR"/{bin,sbin,lib}
# Note: In production, you'd extract these from Alpine rootfs

echo ""
echo "5. Building initramfs..."
cd "$INITRAMFS_DIR"
find . | cpio -o -H newc | gzip > "$WORKDIR/k3s-base.cpio.gz"

SIZE=$(du -h "$WORKDIR/k3s-base.cpio.gz" | cut -f1)
echo "   ✅ Initramfs created: $SIZE"

echo ""
echo "6. Copying to azure/ directory..."
mkdir -p azure
OUTPUT_FILE="azure/k3s-base.cpio.gz"
cp -v "$WORKDIR/k3s-base.cpio.gz" "$OUTPUT_FILE" || {
    echo "ERROR: Failed to copy file"
    exit 1
}
rm -rf "$WORKDIR"

echo ""
echo "=== Build Complete ==="
echo "Output: azure/k3s-base.cpio.gz ($SIZE)"
echo ""
echo "Next steps:"
echo "1. Test with: swift scripts/test-initramfs-cli.swift azure/k3s-base.cpio.gz"
echo "2. Create Helm charts in helm-charts/ directory"
echo "3. Update VM manager to support K3s deployment"

