# Gitpod Workspace Images - ARM64 Build Plan

**Date:** 2025-12-01  
**Reference:** [Gitpod workspace-images](https://github.com/gitpod-io/workspace-images)  
**Goal:** Build ARM64 versions for Apple Silicon VMs

---

## Executive Summary

Gitpod's workspace-images are **x86_64 only**. We need to:
1. ✅ Fork/adapt their Dockerfiles for ARM64
2. ✅ Build ARM64 versions using Docker buildx
3. ✅ Use these as base images for VMs (via K3s or initramfs conversion)

---

## Gitpod Images Overview

### Base Images (from [Gitpod workspace-images](https://github.com/gitpod-io/workspace-images))

**Maintained Images:**
- `gitpod/workspace-base` - Minimal base
- `gitpod/workspace-full` - Full development environment
- `gitpod/workspace-node` - Node.js specific
- `gitpod/workspace-python` - Python specific
- `gitpod/workspace-go` - Go specific
- `gitpod/workspace-rust` - Rust specific
- Plus many more...

**Architecture:** x86_64 only (Ubuntu 22.04.3 LTS)

---

## ARM64 Build Strategy

### Option 1: Multi-Arch Docker Images (Recommended)

Build both x86_64 and ARM64 using Docker buildx:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag gitpod/workspace-base:arm64 \
  --file base/Dockerfile \
  --push \
  .
```

### Option 2: ARM64-Only Builds

Build ARM64 versions specifically for Apple Silicon:

```bash
docker buildx build \
  --platform linux/arm64 \
  --tag gitpod/workspace-base:arm64 \
  --file base/Dockerfile \
  --load \
  .
```

---

## Implementation Plan

### Phase 1: Fork Gitpod's Dockerfiles

1. Clone Gitpod workspace-images repo
2. Adapt Dockerfiles for ARM64:
   - Change base images to ARM64 versions
   - Update package repositories for ARM64
   - Fix any x86_64-specific dependencies

### Phase 2: Build ARM64 Images

1. Set up Docker buildx for multi-arch
2. Build each workspace image for ARM64
3. Push to Docker Hub (or local registry)

### Phase 3: Integration with VMs

**Option A: Use with K3s (Recommended)**
- Deploy Gitpod images as containers in K3s VM
- Use Helm charts to deploy services
- Standard Kubernetes patterns

**Option B: Convert to Initramfs**
- Extract Docker image contents
- Create initramfs from image
- Use in VM boot process

---

## Quick Start: Build ARM64 Base Image

```bash
# Clone Gitpod workspace-images
git clone https://github.com/gitpod-io/workspace-images.git
cd workspace-images

# Set up buildx for multi-arch
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Build ARM64 base
docker buildx build \
  --platform linux/arm64 \
  --tag gitpod/workspace-base:arm64 \
  --file base/Dockerfile \
  --load \
  .

# Test
docker run --rm --platform linux/arm64 gitpod/workspace-base:arm64 uname -m
# Should output: aarch64
```

---

## Integration with K3s Approach

Using Gitpod images with K3s in VMs:

```yaml
# helm-charts/openvscode/values.yaml
image:
  repository: gitpod/workspace-full
  tag: arm64
  pullPolicy: IfNotPresent
```

This gives us:
- ✅ Standard Docker images (easier to maintain)
- ✅ ARM64 support
- ✅ All Gitpod tooling pre-installed
- ✅ Kubernetes-native deployment

---

## Benefits

1. **Standard Tooling** - Gitpod images include all dev tools
2. **Maintained** - Gitpod actively maintains these images
3. **ARM64 Support** - We build ARM64 versions
4. **Kubernetes Ready** - Works perfectly with K3s
5. **License Compatible** - MIT license (same as VibeCode)

---

## Next Steps

1. Create fork/adaptation of Gitpod Dockerfiles for ARM64
2. Build ARM64 versions
3. Test in K3s VM
4. Create Helm charts for deployment

