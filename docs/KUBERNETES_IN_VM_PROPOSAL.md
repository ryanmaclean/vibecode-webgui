# Kubernetes in VM Proposal

**Date:** 2025-12-01  
**Status:** Proposal  
**License Compatibility:** ✅ All options are Apache 2.0 (MIT compatible)

---

## Executive Summary

Instead of baking services into initramfs files, run a lightweight Kubernetes distribution inside each VM and use Helm charts to deploy services. This provides:

- ✅ **Standardized deployment** - Helm charts instead of custom init scripts
- ✅ **Service management** - Kubernetes handles lifecycle, health checks, restarts
- ✅ **Easy updates** - Upgrade services via Helm without rebuilding initramfs
- ✅ **License compatible** - All options are Apache 2.0 (MIT compatible)
- ✅ **Smaller initramfs** - Just Kubernetes + Helm, services deployed dynamically

---

## Recommended Solution: K3s

### Why K3s?

**K3s** (by Rancher) is the best choice for VM deployments:

| Feature | K3s | K0s | MicroK8s |
|---------|-----|-----|----------|
| **License** | Apache 2.0 ✅ | Apache 2.0 ✅ | Apache 2.0 ✅ |
| **Size** | ~50MB | ~100MB | ~200MB |
| **Single Binary** | ✅ Yes | ✅ Yes | ❌ No |
| **Helm Built-in** | ✅ Yes | ⚠️ Plugin | ⚠️ Plugin |
| **ARM64 Support** | ✅ Excellent | ✅ Good | ✅ Good |
| **Single-Node Optimized** | ✅ Yes | ✅ Yes | ⚠️ Multi-node focus |
| **Production Ready** | ✅ Yes | ✅ Yes | ✅ Yes |

**Winner:** K3s - smallest, simplest, Helm built-in, perfect for single-node VMs

---

## Architecture

### Current Approach (Custom Initramfs)
```
Initramfs (100-150MB)
├── Alpine Linux base
├── Valkey binary + deps
├── PostgreSQL binary + deps
├── OpenVSCode Server
├── Custom init scripts
└── All libraries bundled
```

### Proposed Approach (K3s + Helm)
```
Initramfs (60-80MB)
├── Alpine Linux base
├── K3s binary (~50MB)
├── Helm binary (~10MB)
├── K3s startup script
└── Minimal dependencies

Services deployed via Helm:
├── Valkey (Helm chart)
├── PostgreSQL (Helm chart)
├── OpenVSCode Server (Helm chart)
└── Any other service (Helm chart)
```

---

## Implementation Plan

### Phase 1: Create K3s-Based Initramfs

**File:** `azure/k3s-base.cpio.gz`

**Contents:**
- Alpine Linux base (~30MB)
- K3s binary (~50MB)
- Helm binary (~10MB)
- K3s startup script
- Network configuration (DHCP)
- Total: ~90MB (vs 100-150MB current)

**Init Script:**
```bash
#!/bin/sh
# Start K3s server
/usr/local/bin/k3s server \
  --disable traefik \
  --write-kubeconfig-mode 644 \
  --data-dir /var/lib/rancher/k3s &

# Wait for K3s to be ready
until kubectl get nodes; do sleep 1; done

# Install services via Helm
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install valkey bitnami/redis --set auth.enabled=false
helm install postgresql bitnami/postgresql --set auth.postgresPassword=vibecode
# ... etc
```

### Phase 2: Create Helm Charts

**Directory:** `helm-charts/`

Create custom Helm charts for each service:

```
helm-charts/
├── valkey/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
├── postgresql/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
└── openvscode/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

### Phase 3: Update VM Manager

**File:** `azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`

Add K3s-specific configuration:
- Wait for K3s API to be ready
- Deploy Helm charts automatically
- Monitor service health via kubectl

---

## Size Comparison

| Component | Current (Custom) | Proposed (K3s) | Savings |
|-----------|------------------|----------------|---------|
| Base Alpine | 30MB | 30MB | - |
| Valkey + deps | 20MB | 0MB (Helm chart) | -20MB |
| PostgreSQL + deps | 40MB | 0MB (Helm chart) | -40MB |
| OpenVSCode | 30MB | 0MB (Helm chart) | -30MB |
| K3s | 0MB | 50MB | +50MB |
| Helm | 0MB | 10MB | +10MB |
| **Total** | **120MB** | **90MB** | **-30MB** |

**Result:** Smaller initramfs + more flexible deployment

---

## Benefits

### 1. Standardization
- ✅ Use standard Helm charts (Bitnami, etc.)
- ✅ No custom init scripts needed
- ✅ Standard Kubernetes patterns

### 2. Flexibility
- ✅ Add/remove services without rebuilding initramfs
- ✅ Update services independently
- ✅ Easy to test different configurations

### 3. Management
- ✅ `kubectl` for debugging
- ✅ `helm` for deployments
- ✅ Standard Kubernetes monitoring

### 4. Development
- ✅ Test Helm charts locally first
- ✅ Version control for deployments
- ✅ CI/CD friendly

---

## Example Helm Chart

### Valkey Helm Chart

**`helm-charts/valkey/values.yaml`:**
```yaml
image:
  repository: valkey/valkey
  tag: "7.2"
  
service:
  type: ClusterIP
  port: 6379
  
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

**Deploy:**
```bash
helm install valkey ./helm-charts/valkey
```

---

## Migration Path

### Option A: Hybrid Approach
1. Keep current initramfs for Node.js VM (proven working)
2. Create new K3s initramfs for multi-service VMs
3. Gradually migrate services to Helm charts

### Option B: Full Migration
1. Create K3s base initramfs
2. Convert all services to Helm charts
3. Replace all initramfs files

**Recommendation:** Option A (hybrid) - lower risk, allows comparison

---

## Quick Start Script

**`scripts/build-k3s-initramfs.sh`:**
```bash
#!/bin/bash
# Build K3s-based initramfs

set -e

WORKDIR=$(mktemp -d)
cd "$WORKDIR"

# Download K3s
curl -L https://github.com/k3s-io/k3s/releases/download/v1.29.0+k3s1/k3s-arm64 \
  -o k3s
chmod +x k3s

# Download Helm
curl -L https://get.helm.sh/helm-v3.13.0-linux-arm64.tar.gz | tar xz
chmod +x linux-arm64/helm

# Create initramfs structure
mkdir -p initramfs/{bin,sbin,usr/local/bin,etc/init.d}
cp k3s initramfs/usr/local/bin/
cp linux-arm64/helm initramfs/usr/local/bin/

# Create init script
cat > initramfs/init << 'EOF'
#!/bin/sh
# K3s startup script
/usr/local/bin/k3s server --disable traefik &
# ... service deployment ...
EOF

# Build cpio.gz
cd initramfs
find . | cpio -o -H newc | gzip > ../../azure/k3s-base.cpio.gz
```

---

## Next Steps

1. **Create K3s initramfs** - Build minimal Alpine + K3s image
2. **Create Helm charts** - Convert services to Helm charts
3. **Test deployment** - Verify services start correctly
4. **Update VM manager** - Add K3s support to BaseVMManager
5. **Documentation** - Create deployment guides

---

## References

- **K3s:** https://k3s.io/ (Apache 2.0)
- **Helm:** https://helm.sh/ (Apache 2.0)
- **Bitnami Charts:** https://charts.bitnami.com/bitnami (Apache 2.0)
- **License Compatibility:** All Apache 2.0 → MIT compatible ✅

---

## Decision

**Recommendation:** ✅ **Proceed with K3s approach**

**Rationale:**
- Smaller initramfs (90MB vs 120MB)
- More flexible (Helm charts vs custom scripts)
- Standard tooling (kubectl, helm)
- License compatible (Apache 2.0)
- Production proven (K3s is widely used)

**Timeline:** 2-3 days to implement and test

