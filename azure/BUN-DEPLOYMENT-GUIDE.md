# Bun OpenVSCode VM: Deployment Guide
## Quick Start to Production Deployment

**Date**: October 28, 2025
**Target**: 14 MB Ultra-Minimal VS Code VM

---

## Table of Contents

1. [Quick Test (macOS)](#quick-test-macos) - Test current 97 MB build
2. [Full Optimization (Linux ARM64)](#full-optimization-linux-arm64) - Achieve 14 MB target
3. [Local Development](#local-development) - vfkit deployment
4. [Docker Deployment](#docker-deployment) - Container deployment
5. [Kubernetes](#kubernetes) - Orchestrated deployment
6. [Azure](#azure) - Cloud deployment
7. [Troubleshooting](#troubleshooting) - Common issues

---

## Quick Test (macOS)

### Prerequisites

```bash
# Check for existing kernel
ls ~/.vfkit/vms/*/kernel/vmlinux

# Install vfkit if needed
brew install vfkit
```

### Test Current Build (97 MB)

```bash
# 1. Navigate to build directory
cd /Users/ryan.maclean/vibecode-webgui/azure

# 2. Verify build exists
ls -lh bun-openvscode.cpio.gz
# Expected: ~97 MB

# 3. Launch VM
vfkit \
  --cpus 2 \
  --memory 512 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux \
  --initrd bun-openvscode.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:60 \
  --device virtio-rng

# 4. Wait for boot (~2 seconds)
# Watch console for:
# "Booting OpenVSCode VM..."
# "Network ready: 192.168.127.2"
# "Starting OpenVSCode Server..."
# "Access at: http://192.168.127.2:3000"

# 5. Test connectivity
curl http://localhost:3000/healthz
# Expected: HTTP 200 OK

# 6. Open in browser
open http://localhost:3000
```

### Expected Results

- **Boot time**: <2 seconds
- **Startup time**: ~150ms
- **Memory usage**: ~384 MB
- **Access**: http://localhost:3000
- **Features**: Full VS Code functionality

---

## Full Optimization (Linux ARM64)

### Why Linux ARM64 Required

macOS **cannot** perform full optimization because:
- `bun build --compile` for Linux must run on Linux
- UPX on macOS creates incompatible binaries
- Cross-compilation limitations

### Option 1: AWS Graviton Instance

```bash
# 1. Launch ARM64 instance
aws ec2 run-instances \
  --image-id ami-xxxxx \
  --instance-type t4g.small \
  --key-name your-key \
  --security-groups default

# 2. Connect
ssh -i your-key.pem ubuntu@instance-ip

# 3. Install dependencies
sudo apt-get update
sudo apt-get install -y wget unzip cpio gzip upx-ucl

# 4. Transfer build from macOS
# On macOS:
scp -r /tmp/bun-openvscode-* ubuntu@instance-ip:/tmp/

# 5. Continue to optimization steps below
```

### Option 2: Azure ARM64 VM

```bash
# 1. Create ARM64 VM
az vm create \
  --resource-group vibecode \
  --name bun-build \
  --image Ubuntu2204 \
  --size Standard_B2pls_v2 \
  --admin-username ubuntu \
  --generate-ssh-keys

# 2. Connect
ssh ubuntu@vm-ip

# 3. Install dependencies
sudo apt-get update
sudo apt-get install -y wget unzip cpio gzip upx-ucl

# 4. Transfer build
scp -r /tmp/bun-openvscode-* ubuntu@vm-ip:/tmp/

# 5. Continue to optimization steps below
```

### Option 3: Local ARM64 Linux

If you have:
- Raspberry Pi 4 or newer
- ARM64 Linux laptop/desktop
- QEMU ARM64 Linux VM

Install dependencies:
```bash
# Debian/Ubuntu
sudo apt-get install -y wget unzip cpio gzip upx-ucl

# Arch Linux
sudo pacman -S wget unzip cpio gzip upx

# Fedora/RHEL
sudo dnf install -y wget unzip cpio gzip upx
```

### Optimization Steps (On Linux ARM64)

```bash
# 1. Navigate to build directory
cd /tmp/bun-openvscode-30675

# 2. Verify components
ls -lh
# Should see:
# - bun-linux-aarch64/
# - openvscode/
# - initramfs/

# 3. Bundle OpenVSCode with Bun
./bun-linux-aarch64/bun build \
    ./openvscode/bun-server.js \
    --compile \
    --target=bun-linux-arm64 \
    --outfile openvscode-bun-static \
    --minify \
    --sourcemap=none

# Expected: Single binary, ~80 MB
ls -lh openvscode-bun-static

# 4. Apply UPX ultra-compression
echo "Compressing with UPX (this takes 2-5 minutes)..."
upx --ultra-brute --best openvscode-bun-static

# Expected: ~12 MB (86% compression)
ls -lh openvscode-bun-static
# Should show: 11-13 MB

# 5. Create minimal initramfs structure
mkdir -p minimal-initramfs/{bin,dev,proc,sys,tmp}

# 6. Copy optimized binary
cp openvscode-bun-static minimal-initramfs/bin/openvscode
chmod +x minimal-initramfs/bin/openvscode

# 7. Add minimal busybox
cd minimal-initramfs/bin
wget -q https://busybox.net/downloads/binaries/1.35.0-arm64/busybox
chmod +x busybox

# Create symlinks
for cmd in sh mount ip udhcpc; do
    ln -s busybox $cmd
done
cd ../..

# 8. Create minimal init script
cat > minimal-initramfs/init << 'EOF'
#!/bin/sh
# Ultra-minimal init for Bun OpenVSCode
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mount -t tmpfs tmp /tmp

# Network
ip link set lo up
ip link set eth0 up
udhcpc -i eth0 -n -q 2>/dev/null &

# Start OpenVSCode
sleep 1
exec /bin/openvscode
EOF
chmod +x minimal-initramfs/init

# 9. Create DHCP helper script
cat > minimal-initramfs/bin/simple-dhcp.sh << 'EOF'
#!/bin/sh
[ -n "$ip" ] && ip addr add $ip/$mask dev $interface
[ -n "$router" ] && ip route add default via $router
EOF
chmod +x minimal-initramfs/bin/simple-dhcp.sh

# 10. Package initramfs
cd minimal-initramfs
find . | cpio -H newc -o 2>/dev/null | gzip -9 > ../bun-openvscode-14mb.cpio.gz
cd ..

# 11. Verify final size
ls -lh bun-openvscode-14mb.cpio.gz
# Expected: 12-14 MB

# 12. Verify structure
echo "Verifying initramfs structure..."
gunzip -c bun-openvscode-14mb.cpio.gz | cpio -tv | head -20

# 13. Test locally (if you have a kernel)
vfkit \
  --cpus 2 \
  --memory 384 \
  --kernel /path/to/vmlinux-arm64 \
  --initrd bun-openvscode-14mb.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet"

# 14. Transfer back to macOS (if built on cloud)
# On macOS:
scp ubuntu@instance-ip:/tmp/bun-openvscode-30675/bun-openvscode-14mb.cpio.gz \
    /Users/ryan.maclean/vibecode-webgui/azure/
```

### Verification Checklist

- [ ] Binary size: 11-13 MB
- [ ] Initramfs size: 12-14 MB
- [ ] Boot test successful
- [ ] Port 3000 accessible
- [ ] VS Code UI loads
- [ ] Memory usage <384 MB
- [ ] Startup time <2s

---

## Local Development

### vfkit (macOS)

**Current build (97 MB)**:
```bash
cd /Users/ryan.maclean/vibecode-webgui/azure

vfkit \
  --cpus 2 \
  --memory 512 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux \
  --initrd bun-openvscode.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:60 \
  --device virtio-rng
```

**Optimized build (14 MB)**:
```bash
vfkit \
  --cpus 2 \
  --memory 384 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux \
  --initrd bun-openvscode-14mb.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:60 \
  --device virtio-rng
```

**Custom kernel + optimized build**:
```bash
vfkit \
  --cpus 2 \
  --memory 384 \
  --kernel vmlinux-arm64-ultra \
  --initrd bun-openvscode-14mb.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:60 \
  --device virtio-rng
```

### QEMU (Linux/macOS)

```bash
qemu-system-aarch64 \
  -M virt \
  -cpu cortex-a72 \
  -m 384 \
  -smp 2 \
  -kernel vmlinux-arm64-ultra \
  -initrd bun-openvscode-14mb.cpio.gz \
  -append "console=ttyAMA0" \
  -nographic \
  -netdev user,id=net0,hostfwd=tcp::3000-:3000 \
  -device virtio-net-device,netdev=net0
```

### Firecracker (Production)

```bash
# 1. Create Firecracker config
cat > vm-config.json << EOF
{
  "boot-source": {
    "kernel_image_path": "vmlinux-arm64-ultra",
    "boot_args": "console=ttyS0 reboot=k panic=1 pci=off",
    "initrd_path": "bun-openvscode-14mb.cpio.gz"
  },
  "drives": [],
  "machine-config": {
    "vcpu_count": 2,
    "mem_size_mib": 384
  },
  "network-interfaces": [{
    "iface_id": "eth0",
    "guest_mac": "AA:FC:00:00:00:01",
    "host_dev_name": "tap0"
  }]
}
EOF

# 2. Launch Firecracker
firecracker --api-sock /tmp/firecracker.socket --config-file vm-config.json
```

---

## Docker Deployment

### Create Docker Image

```dockerfile
# Dockerfile.bun-minimal
FROM scratch
ADD bun-openvscode-14mb.cpio.gz /
CMD ["/init"]
```

```bash
# Build
docker build -t vibecode/bun-openvscode:minimal -f Dockerfile.bun-minimal .

# Verify size
docker images vibecode/bun-openvscode:minimal
# Expected: 14 MB

# Run (requires privileged mode)
docker run -d \
  --name openvscode-bun \
  --privileged \
  -p 3000:3000 \
  vibecode/bun-openvscode:minimal

# Test
curl http://localhost:3000
open http://localhost:3000
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  openvscode:
    image: vibecode/bun-openvscode:minimal
    container_name: openvscode-bun
    privileged: true
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - HOST=0.0.0.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
```

```bash
# Deploy
docker-compose up -d

# Monitor
docker-compose logs -f

# Scale
docker-compose up -d --scale openvscode=3
```

### Registry Push

**Docker Hub**:
```bash
# Tag
docker tag vibecode/bun-openvscode:minimal \
    yourusername/bun-openvscode:minimal

# Login
docker login

# Push
docker push yourusername/bun-openvscode:minimal
```

**Azure Container Registry**:
```bash
# Login
az acr login --name yourregistry

# Tag
docker tag vibecode/bun-openvscode:minimal \
    yourregistry.azurecr.io/bun-openvscode:minimal

# Push
docker push yourregistry.azurecr.io/bun-openvscode:minimal
```

**GitHub Container Registry**:
```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag
docker tag vibecode/bun-openvscode:minimal \
    ghcr.io/username/bun-openvscode:minimal

# Push
docker push ghcr.io/username/bun-openvscode:minimal
```

---

## Kubernetes

### Basic Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openvscode-bun
  labels:
    app: openvscode-bun
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openvscode-bun
  template:
    metadata:
      labels:
        app: openvscode-bun
    spec:
      containers:
      - name: openvscode
        image: vibecode/bun-openvscode:minimal
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
        resources:
          requests:
            memory: "384Mi"
            cpu: "500m"
          limits:
            memory: "512Mi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 2
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: openvscode-bun
spec:
  type: LoadBalancer
  selector:
    app: openvscode-bun
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
```

```bash
# Deploy
kubectl apply -f deployment.yaml

# Check status
kubectl get pods -l app=openvscode-bun
kubectl get svc openvscode-bun

# Get external IP
kubectl get svc openvscode-bun -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Scale
kubectl scale deployment openvscode-bun --replicas=10

# Update
kubectl set image deployment/openvscode-bun \
    openvscode=vibecode/bun-openvscode:minimal-v2
```

### Helm Chart

```yaml
# values.yaml
replicaCount: 3

image:
  repository: vibecode/bun-openvscode
  tag: minimal
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 80
  targetPort: 3000

resources:
  requests:
    memory: 384Mi
    cpu: 500m
  limits:
    memory: 512Mi
    cpu: 1000m

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

```bash
# Install
helm install openvscode-bun ./helm-chart -f values.yaml

# Upgrade
helm upgrade openvscode-bun ./helm-chart -f values.yaml

# Rollback
helm rollback openvscode-bun

# Uninstall
helm uninstall openvscode-bun
```

---

## Azure

### Azure Container Instances

```bash
# Create resource group
az group create --name vibecode --location eastus

# Deploy container
az container create \
  --resource-group vibecode \
  --name openvscode-bun \
  --image vibecode/bun-openvscode:minimal \
  --dns-name-label vibecode-code \
  --ports 3000 \
  --cpu 0.5 \
  --memory 0.5 \
  --restart-policy Always

# Get FQDN
az container show \
  --resource-group vibecode \
  --name openvscode-bun \
  --query ipAddress.fqdn

# Access: http://vibecode-code.eastus.azurecontainer.io:3000

# Monitor logs
az container logs \
  --resource-group vibecode \
  --name openvscode-bun \
  --follow

# Delete
az container delete \
  --resource-group vibecode \
  --name openvscode-bun
```

### Azure Kubernetes Service (AKS)

```bash
# Create AKS cluster
az aks create \
  --resource-group vibecode \
  --name openvscode-cluster \
  --node-count 3 \
  --node-vm-size Standard_B2s \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials \
  --resource-group vibecode \
  --name openvscode-cluster

# Deploy
kubectl apply -f deployment.yaml

# Get service IP
kubectl get svc openvscode-bun
```

### Azure VM with Custom Image

```bash
# 1. Create VHD from initramfs
qemu-img create -f raw bun-openvscode.raw 128M
dd if=bun-openvscode-14mb.cpio.gz of=bun-openvscode.raw conv=notrunc

# Convert to VHD
qemu-img convert -f raw -O vpc bun-openvscode.raw bun-openvscode.vhd

# 2. Upload to Azure
az storage account create \
  --name vibecodeimages \
  --resource-group vibecode

az storage container create \
  --name vhds \
  --account-name vibecodeimages

az storage blob upload \
  --account-name vibecodeimages \
  --container-name vhds \
  --name bun-openvscode.vhd \
  --file bun-openvscode.vhd \
  --type page

# 3. Create managed disk
az disk create \
  --resource-group vibecode \
  --name openvscode-bun-disk \
  --source https://vibecodeimages.blob.core.windows.net/vhds/bun-openvscode.vhd \
  --size-gb 1

# 4. Create VM from disk
az vm create \
  --resource-group vibecode \
  --name openvscode-bun-vm \
  --attach-os-disk openvscode-bun-disk \
  --os-type linux \
  --size Standard_B1s \
  --public-ip-address-dns-name vibecode-code

# 5. Access
# http://vibecode-code.eastus.cloudapp.azure.com:3000
```

---

## Troubleshooting

### Common Issues

**Issue 1: VM doesn't boot**

```bash
# Check kernel compatibility
file vmlinux-arm64-ultra
# Should show: ARM aarch64 executable

# Check initramfs structure
gunzip -c bun-openvscode-14mb.cpio.gz | cpio -tv
# Should see: init, bin/*, etc.

# Test with verbose kernel output
vfkit \
  --kernel vmlinux-arm64-ultra \
  --initrd bun-openvscode-14mb.cpio.gz \
  --kernel-cmdline "console=hvc0 debug loglevel=7"
```

**Issue 2: Network not working**

```bash
# Check DHCP in console
# Should see: "Network ready: 192.168.x.x"

# If DHCP fails, use static IP
cat > minimal-initramfs/init << 'EOF'
#!/bin/sh
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mount -t tmpfs tmp /tmp
ip link set lo up
ip link set eth0 up
ip addr add 192.168.127.2/24 dev eth0
ip route add default via 192.168.127.1
exec /bin/openvscode
EOF
```

**Issue 3: Port 3000 not accessible**

```bash
# Check if Bun started
# In VM console, should see:
# "Starting OpenVSCode Server..."
# "Web UI available at http://0.0.0.0:3000"

# Test from host
curl -v http://localhost:3000/healthz

# Check vfkit networking
vfkit \
  --device virtio-net,nat,mac=52:54:00:12:34:60
# NAT should allow access to localhost:3000
```

**Issue 4: High memory usage**

```bash
# Monitor in VM
free -m

# If >384 MB, check:
# 1. Kernel cmdline includes: mem=384M
# 2. Bun not loading unnecessary extensions
# 3. Multiple instances not running

# Reduce memory allocation
vfkit --memory 384  # Start with 384 MB
```

**Issue 5: Slow startup**

```bash
# Time each phase
time vfkit ...

# Expected timings:
# - Kernel load: <200ms
# - Init script: <100ms
# - Network: <500ms
# - Bun start: <150ms
# Total: <2s

# If slower:
# 1. Check CPU allocation (need >=2 cores)
# 2. Verify UPX compression applied
# 3. Check disk I/O (shouldn't be any)
```

### Debugging Commands

**Check initramfs contents**:
```bash
gunzip -c bun-openvscode-14mb.cpio.gz | cpio -tv
```

**Extract and inspect**:
```bash
mkdir test-extract
cd test-extract
gunzip -c ../bun-openvscode-14mb.cpio.gz | cpio -id
ls -lhR
```

**Test binary directly** (on Linux ARM64):
```bash
./bin/openvscode
# Should start Bun and OpenVSCode
```

**Check binary dependencies**:
```bash
ldd ./bin/openvscode
# Should show: statically linked or minimal deps
```

**Monitor VM resources**:
```bash
# In VM console
top
free -m
ps aux
netstat -tlnp
```

### Performance Tuning

**Faster boot**:
```bash
# Use more CPUs
vfkit --cpus 4

# More memory (faster decompression)
vfkit --memory 512

# Skip network delay
# In init script: Remove "sleep 2" line
```

**Lower memory usage**:
```bash
# Reduce Bun heap
export NODE_OPTIONS="--max-old-space-size=256"

# Limit OpenVSCode extensions
# Edit bun-server.js to disable extensions
```

**Better network performance**:
```bash
# Use virtio for networking
vfkit --device virtio-net,nat

# Increase MTU
ip link set eth0 mtu 9000
```

---

## Production Checklist

### Pre-Deployment

- [ ] Optimization complete (14 MB target achieved)
- [ ] Boot test successful (<2s)
- [ ] Network connectivity verified
- [ ] Port 3000 accessible
- [ ] VS Code UI loads completely
- [ ] All features tested
- [ ] Memory usage <384 MB confirmed
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Backup plan in place

### Monitoring

- [ ] Boot time alerts (<2s threshold)
- [ ] Memory alerts (>400 MB threshold)
- [ ] Response time alerts (>200ms threshold)
- [ ] Error rate monitoring (<0.1% threshold)
- [ ] Resource utilization tracking
- [ ] Logging configured
- [ ] Health checks enabled
- [ ] Metrics dashboard created

### Maintenance

- [ ] Update procedure documented
- [ ] Rollback procedure tested
- [ ] Backup schedule configured
- [ ] Security patches automated
- [ ] Version control for builds
- [ ] Change log maintained
- [ ] Team training completed

---

## Next Steps

### Week 1: Complete Optimization

1. Acquire Linux ARM64 system
2. Transfer build artifacts
3. Run full optimization
4. Verify 14 MB target achieved
5. Document any issues

### Month 1: Production Ready

1. Create automated build pipeline
2. Test on all platforms
3. Performance benchmark vs Node.js
4. Security audit
5. Production deployment

### Quarter 1: Scale

1. Deploy to multiple environments
2. Gather user feedback
3. Optimize further (10 MB goal)
4. Build ecosystem (Helm charts, Terraform)
5. Community engagement

---

## Support & Resources

### Documentation
- **Technical Report**: `/Users/ryan.maclean/vibecode-webgui/azure/BUN-TECHNICAL-REPORT.md`
- **Executive Summary**: `/Users/ryan.maclean/vibecode-webgui/azure/BUN-EXECUTIVE-SUMMARY.md`
- **Visual Comparison**: `/Users/ryan.maclean/vibecode-webgui/azure/BUN-VISUAL-COMPARISON.md`
- **Build Status**: `/Users/ryan.maclean/vibecode-webgui/azure/BUN-BUILD-STATUS.md`

### Build Scripts
- **Main Build**: `/Users/ryan.maclean/vibecode-webgui/azure/build-bun-minimal.sh`
- **Optimization Guide**: `/Users/ryan.maclean/vibecode-webgui/azure/BUN-ULTRA-MINIMAL.md`

### External Resources
- Bun Documentation: https://bun.sh/docs
- OpenVSCode: https://github.com/gitpod-io/openvscode-server
- UPX: https://upx.github.io/
- vfkit: https://github.com/crc-org/vfkit

---

**Guide Version**: 1.0
**Last Updated**: October 28, 2025
**Status**: Ready for deployment
**Target**: 14 MB ultra-minimal VS Code VM ⭐
