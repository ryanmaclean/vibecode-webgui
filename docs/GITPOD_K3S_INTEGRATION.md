# Gitpod Workspace Images + K3s Integration

**Date:** 2025-12-01  
**Approach:** Use Gitpod workspace images in K3s VMs for Apple Silicon

---

## Architecture

```
VM (Apple Silicon)
├── K3s (lightweight Kubernetes)
│   ├── Gitpod workspace-base:arm64 (container)
│   ├── Gitpod workspace-node:arm64 (container)
│   └── Gitpod workspace-python:arm64 (container)
└── Helm charts for deployment
```

---

## Benefits

### Using Gitpod Images ✅
- ✅ **Pre-configured** - All dev tools included
- ✅ **Maintained** - Gitpod actively updates
- ✅ **Standard** - Docker images, easy to use
- ✅ **ARM64** - We build ARM64 versions

### Using K3s ✅
- ✅ **Lightweight** - ~50MB vs full Kubernetes
- ✅ **Helm built-in** - Easy deployments
- ✅ **Single-node** - Perfect for VMs
- ✅ **License compatible** - Apache 2.0

### Combined Approach ✅
- ✅ **Best of both** - Gitpod tooling + K3s orchestration
- ✅ **Standard patterns** - Docker + Kubernetes
- ✅ **Easy updates** - Helm upgrades, no initramfs rebuilds
- ✅ **Flexible** - Mix and match services

---

## Implementation Steps

### Step 1: Build ARM64 Gitpod Images

```bash
# Adapt Dockerfiles
bash scripts/adapt-gitpod-dockerfiles.sh

# Build ARM64 versions
bash scripts/build-gitpod-arm64.sh
```

### Step 2: Create K3s Initramfs

```bash
# Build K3s-based initramfs
bash scripts/build-k3s-initramfs.sh
```

### Step 3: Create Helm Charts

**`helm-charts/gitpod-workspace/Chart.yaml`:**
```yaml
apiVersion: v2
name: gitpod-workspace
description: Gitpod workspace image deployment
version: 1.0.0
```

**`helm-charts/gitpod-workspace/values.yaml`:**
```yaml
image:
  repository: ghcr.io/ryanmaclean/workspace-base
  tag: arm64
  
service:
  type: ClusterIP
  port: 3000
  
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2
    memory: 4Gi
```

### Step 4: Deploy in K3s VM

```bash
# In VM, after K3s starts:
helm install workspace ./helm-charts/gitpod-workspace

# Or use Gitpod images directly:
kubectl run workspace \
  --image=ghcr.io/ryanmaclean/workspace-base:arm64 \
  --port=3000
```

---

## Example: OpenVSCode with Gitpod Base

**Helm Chart:**
```yaml
# helm-charts/openvscode-gitpod/values.yaml
image:
  repository: ghcr.io/ryanmaclean/workspace-base
  tag: arm64

openvscode:
  enabled: true
  port: 3000
  
services:
  - name: openvscode
    image: gitpod/openvscode-server:latest
    port: 3000
```

**Deploy:**
```bash
helm install openvscode ./helm-charts/openvscode-gitpod
```

---

## Comparison

| Approach | Size | Maintenance | Flexibility |
|----------|------|--------------|-------------|
| **Custom Initramfs** | 120MB | Manual | Low |
| **Gitpod + K3s** | 90MB + containers | Helm updates | High |

---

## Next Steps

1. ✅ Build ARM64 Gitpod images
2. ✅ Create K3s initramfs
3. ⏳ Create Helm charts for Gitpod images
4. ⏳ Test deployment in VM
5. ⏳ Document usage

---

## References

- [Gitpod workspace-images](https://github.com/gitpod-io/workspace-images) - Original x86_64 images
- [K3s Documentation](https://k3s.io/) - Lightweight Kubernetes
- [Helm Documentation](https://helm.sh/) - Kubernetes package manager

