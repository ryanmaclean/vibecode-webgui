# Multi-Architecture Build Guide

## Overview

The VibeCode code-server supports both **ARM64** (Apple Silicon, AWS Graviton) and **AMD64** (Intel/AMD x86_64) architectures.

## Quick Start

### Build Both Architectures Locally

```bash
./scripts/build-codeserver-multiarch.sh local
```

This creates two separate images:
- `vibecode-codeserver:latest-arm64`
- `vibecode-codeserver:latest-amd64`

### Build and Push Multi-Arch Manifest

```bash
# Push to Docker Hub
./scripts/build-codeserver-multiarch.sh push docker.io/youruser

# Push to GitHub Container Registry
./scripts/build-codeserver-multiarch.sh push ghcr.io/youruser

# Push to Azure Container Registry
./scripts/build-codeserver-multiarch.sh push yourregistry.azurecr.io
```

### Export for Offline Distribution

```bash
./scripts/build-codeserver-multiarch.sh export ./dist
```

This creates:
- `dist/vibecode-codeserver-arm64.tar`
- `dist/vibecode-codeserver-amd64.tar`

Load them with:
```bash
docker load < dist/vibecode-codeserver-arm64.tar
docker load < dist/vibecode-codeserver-amd64.tar
```

## Architecture-Specific Testing

### Test ARM64 Build

```bash
docker run --rm -p 8765:8765 \
  -e PASSWORD=test123 \
  vibecode-codeserver:latest-arm64
```

### Test AMD64 Build

```bash
docker run --rm -p 8765:8765 \
  -e PASSWORD=test123 \
  vibecode-codeserver:latest-amd64
```

### Verify Architecture

```bash
# Check ARM64
docker inspect vibecode-codeserver:latest-arm64 --format='{{.Architecture}}'
# Output: arm64

# Check AMD64
docker inspect vibecode-codeserver:latest-amd64 --format='{{.Architecture}}'
# Output: amd64
```

## Kubernetes Deployment

### Using Multi-Arch Manifest

When you push a multi-arch manifest to a registry, Kubernetes automatically pulls the correct architecture:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-codeserver
spec:
  template:
    spec:
      containers:
      - name: codeserver
        image: yourregistry/vibecode-codeserver:latest
        # Kubernetes will automatically select arm64 or amd64
```

### Architecture-Specific Deployment

If you need to explicitly specify:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-codeserver-arm64
spec:
  template:
    spec:
      nodeSelector:
        kubernetes.io/arch: arm64
      containers:
      - name: codeserver
        image: yourregistry/vibecode-codeserver:latest-arm64
```

## Build Performance

### Build Times (Approximate)

- **ARM64 on Apple Silicon M1/M2**: ~8-12 minutes
- **AMD64 on Apple Silicon (emulated)**: ~15-25 minutes
- **AMD64 on Intel/AMD native**: ~8-12 minutes
- **ARM64 on Intel/AMD (emulated)**: ~15-25 minutes

### Optimization Tips

1. **Use BuildKit cache**: Speeds up subsequent builds
   ```bash
   export DOCKER_BUILDKIT=1
   ```

2. **Parallel builds**: Build both architectures simultaneously on different machines

3. **Layer caching**: The Dockerfile is optimized to cache expensive operations (npm installs, extension downloads)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Multi-Arch Code-Server

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/code-server/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ghcr.io/${{ github.repository }}/vibecode-codeserver:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Troubleshooting

### Build Fails on Emulated Architecture

If building AMD64 on ARM64 (or vice versa) fails:

1. **Increase Docker resources**: Give Docker more CPU and memory
2. **Use native builders**: Build each architecture on its native platform
3. **Check QEMU**: Ensure QEMU is properly installed for emulation

```bash
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
```

### Image Size Differences

ARM64 and AMD64 images may differ slightly in size due to:
- Architecture-specific binaries
- Different compression ratios
- Platform-specific dependencies

This is normal and expected.

### Extension Compatibility

All extensions in this image are compatible with both ARM64 and AMD64. If you add custom extensions, verify they support both architectures.

## Security Considerations

### No Secrets in Images

✅ **Correct**: Pass secrets at runtime
```bash
docker run -e DD_API_KEY=$DD_API_KEY vibecode-codeserver:latest
```

❌ **Wrong**: Build with secrets
```bash
docker build --build-arg DD_API_KEY=$DD_API_KEY .  # DON'T DO THIS
```

### Multi-Arch Security

- Both architectures use the same secure base image
- Non-root user (coder:coder)
- Minimal attack surface
- Regular security updates

## Performance Comparison

### ARM64 Advantages
- Lower power consumption
- Better performance per watt
- Native on Apple Silicon
- Cost-effective on AWS Graviton

### AMD64 Advantages
- Wider ecosystem support
- More mature tooling
- Better compatibility with legacy software
- Native on most cloud VMs

## Registry Storage

Multi-arch manifests are storage-efficient:
- Shared layers between architectures
- Only architecture-specific binaries differ
- Typical overhead: ~10-15% vs single-arch

Example:
- ARM64 only: 5.91 GB
- AMD64 only: 6.02 GB
- Multi-arch manifest: 6.15 GB (not 11.93 GB!)

## Next Steps

1. ✅ Build and test locally
2. ✅ Push to your container registry
3. ✅ Deploy to Kubernetes
4. ✅ Monitor performance across architectures
5. ✅ Set up automated builds in CI/CD

## Support

For issues or questions:
- Check the [main README](README.md)
- Review [Dockerfile](Dockerfile) comments
- Open an issue on GitHub
