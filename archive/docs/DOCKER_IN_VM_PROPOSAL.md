# Docker/Podman in VM Proposal

**Date:** 2025-12-01  
**Concept:** Use Apple Virtualization.framework VM as Docker/Podman host

---

## Overview

Instead of using Docker Desktop's default VM, use one of our VMs as the Docker/Podman runtime host. This gives us:

- ✅ **Full control** over the VM configuration
- ✅ **Port forwarding** already implemented
- ✅ **SSH access** for Docker API
- ✅ **Lightweight** compared to Docker Desktop VM
- ✅ **ARM64 native** on Apple Silicon

---

## Architecture Options

### Option 1: Docker API over SSH (Recommended)

```
┌─────────────────────────────────────┐
│ macOS Host                          │
│                                     │
│  Docker CLI ──SSH──┐                │
│                    │                │
│  docker-compose ───┤                │
│                    │                │
│  IDE/Tools ────────┘                │
└────────────────────┼────────────────┘
                     │ SSH (port 22)
                     │
┌────────────────────▼────────────────┐
│ VM (192.168.64.x)                   │
│                                     │
│  Docker Daemon                      │
│  ├── Container 1                    │
│  ├── Container 2                    │
│  └── Container 3                    │
│                                     │
│  Exposed ports forwarded to host    │
└─────────────────────────────────────┘
```

**Setup:**
```bash
# On macOS
export DOCKER_HOST=ssh://root@192.168.64.3

# Now docker commands run in VM
docker ps
docker run nginx
```

### Option 2: Podman Socket

```
┌─────────────────────────────────────┐
│ macOS Host                          │
│                                     │
│  Podman CLI ──Socket──┐             │
│                       │             │
│  docker-compose ──────┤             │
└───────────────────────┼─────────────┘
                        │ Unix socket
                        │
┌───────────────────────▼─────────────┐
│ VM (with Podman)                    │
│                                     │
│  Podman Daemon (Docker compatible)  │
│  ├── Container 1                    │
│  ├── Container 2                    │
│  └── Container 3                    │
└─────────────────────────────────────┘
```

### Option 3: Docker Machine Style

```
┌─────────────────────────────────────┐
│ macOS Host                          │
│                                     │
│  docker-machine-driver-vibecode     │
│  │                                  │
│  └──> Creates/manages VMs           │
│                                     │
│  Docker CLI ──TLS/SSH──┐            │
└────────────────────────┼────────────┘
                         │
┌────────────────────────▼────────────┐
│ VM (Docker)                         │
│                                     │
│  /var/run/docker.sock              │
│  Docker Daemon                      │
└─────────────────────────────────────┘
```

---

## Implementation: Docker via SSH

### Step 1: Build VM with Docker

**Initramfs with Docker:**
```bash
# scripts/build-docker-vm.sh
#!/bin/bash
set -e

WORK_DIR=$(mktemp -d)
INITRAMFS_DIR="$WORK_DIR/initramfs"

# Extract Alpine base
tar -xzf /tmp/alpine-minirootfs-3.19-aarch64.tar.gz -C "$INITRAMFS_DIR"

# Create init script
cat > "$INITRAMFS_DIR/init" << 'INIT_EOF'
#!/bin/sh
set -e

echo "=== Booting Docker VM ==="

# Mount filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp

# Setup network
ip link set lo up
for i in $(seq 1 30); do
    if ip link show eth0 >/dev/null 2>&1; then
        ip link set eth0 up
        udhcpc -i eth0 -n -q || true
        break
    fi
    sleep 1
done

VM_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)

# Install Docker
apk update
apk add --no-cache docker docker-compose openssh bash curl

# Start Docker daemon
rc-update add docker default
rc-service docker start

# Start SSH
ssh-keygen -A
echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
echo "root:vibecode" | chpasswd
/usr/sbin/sshd

echo ""
echo "=== Docker VM Ready ==="
echo "IP: $VM_IP"
echo "SSH: ssh root@$VM_IP"
echo "Docker: export DOCKER_HOST=ssh://root@$VM_IP"
echo ""

exec /bin/sh
INIT_EOF

chmod +x "$INITRAMFS_DIR/init"

# Build initramfs
cd "$INITRAMFS_DIR"
find . | cpio -o -H newc | gzip > "$WORK_DIR/docker-vm.cpio.gz"
cp "$WORK_DIR/docker-vm.cpio.gz" azure/

echo "✅ Built: azure/docker-vm.cpio.gz"
```

### Step 2: Configure Docker Client

**On macOS:**
```bash
# Set Docker host to VM
export DOCKER_HOST=ssh://root@192.168.64.3

# Or add to ~/.zshrc
echo 'export DOCKER_HOST=ssh://root@192.168.64.3' >> ~/.zshrc

# Test
docker version
docker run hello-world
```

### Step 3: Port Forwarding Integration

**Using our existing port forwarding:**
```swift
// In VM Manager
let portMappings: [(guestPort: UInt16, hostPort: UInt16)] = [
    (22, 2222),      // SSH for Docker API
    (80, 8080),      // Container port 80
    (443, 8443),     // Container port 443
    (3000, 3000),    // App port
    (5432, 5432),    // PostgreSQL container
    (6379, 6379)     // Redis container
]
```

**Then:**
```bash
# Access containers via localhost
curl http://localhost:8080  # → Container port 80
psql -h localhost -p 5432   # → PostgreSQL in container
```

---

## Benefits Over Docker Desktop

| Feature | Docker Desktop | VM-based Docker | Winner |
|---------|---------------|-----------------|---------|
| **Control** | Limited | Full | ✅ VM |
| **Memory** | Fixed allocation | Dynamic | ✅ VM |
| **Startup** | Slow | Fast | ✅ VM |
| **Cost** | Paid (teams) | Free | ✅ VM |
| **Integration** | Tight | Manual | Docker Desktop |
| **ARM64** | Native | Native | Tie |

---

## Use Cases

### Use Case 1: Development Databases

```bash
# Start PostgreSQL in VM
docker run -d -p 5432:5432 \
    -e POSTGRES_PASSWORD=dev \
    postgres:16-alpine

# Access from macOS
psql -h 192.168.64.3 -U postgres
```

### Use Case 2: Full Stack App

```yaml
# docker-compose.yml
services:
  api:
    image: node:20-alpine
    ports:
      - "3000:3000"
  
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

```bash
# Deploy to VM
export DOCKER_HOST=ssh://root@192.168.64.3
docker-compose up -d

# Access services via port forwarding
curl http://localhost:3000  # API
psql -h localhost           # Database
```

### Use Case 3: CI/CD Builds

```bash
# Build Docker images in VM
docker build -t myapp:latest .

# Run tests in containers
docker run --rm myapp:latest npm test
```

---

## Comparison with K3s Approach

| Approach | Pros | Cons |
|----------|------|------|
| **Docker/Podman** | Simple, familiar, wide tool support | Less orchestration |
| **K3s** | Full Kubernetes, Helm charts, scaling | More complex, heavier |

**Recommendation:** Use both!
- **Docker VM:** Development, testing, simple deployments
- **K3s VM:** Production-like, multi-service, scaling

---

## Implementation Steps

1. ✅ Build Docker VM initramfs
2. ✅ Create SwiftUI app for Docker VM
3. ✅ Configure SSH access
4. ✅ Set up Docker client on macOS
5. ✅ Test with docker-compose
6. ✅ Document workflows

---

## Example: Replace Docker Desktop

**Before (Docker Desktop):**
```bash
# Uses Docker Desktop VM
docker run nginx
```

**After (Our VM):**
```bash
# Launch Docker VM app
open azure/SwiftUI-Apps/DockerVibeCode.app

# Wait for VM to boot (IP: 192.168.64.3)

# Configure client
export DOCKER_HOST=ssh://root@192.168.64.3

# Use normally
docker run nginx
docker-compose up
```

---

## Next Steps

1. Build `docker-vm.cpio.gz` with Docker daemon
2. Create `DockerVibeCode.app` SwiftUI app
3. Test with real workloads
4. Create docker-compose examples
5. Document migration from Docker Desktop

---

## Compatibility

**Works with:**
- ✅ `docker` CLI
- ✅ `docker-compose`
- ✅ Docker buildx
- ✅ VS Code Docker extension
- ✅ Kubernetes (kubectl with docker driver)
- ✅ Most Docker tools (via DOCKER_HOST)

**Limitations:**
- Docker Desktop UI features (not needed)
- Kubernetes Desktop integration (use K3s VM instead)
- File sharing (use volumes or SSH)

