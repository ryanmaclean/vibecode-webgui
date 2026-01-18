# Gitpod Workspace Images - ARM64 Versions

ARM64 adaptations of [Gitpod workspace-images](https://github.com/gitpod-io/workspace-images) for Apple Silicon VMs.

## Quick Start

### Build ARM64 Images

```bash
# Adapt Gitpod Dockerfiles for ARM64
bash scripts/adapt-gitpod-dockerfiles.sh

# Build ARM64 images
bash scripts/build-gitpod-arm64.sh
```

### Use in K3s VM

```yaml
# helm-charts/openvscode/values.yaml
image:
  repository: ghcr.io/ryanmaclean/workspace-base
  tag: arm64
```

## Available Images

After building:
- `workspace-base:arm64` - Minimal base image
- `workspace-node:arm64` - Node.js development
- `workspace-python:arm64` - Python development
- `workspace-go:arm64` - Go development
- `workspace-rust:arm64` - Rust development

## Integration with K3s

These images work perfectly with the K3s approach:

1. **Deploy as containers** in K3s VM
2. **Use Helm charts** for service management
3. **Standard Docker images** - easier than initramfs

## License

Same as Gitpod workspace-images: **MIT License** ✅

## Reference

- [Gitpod workspace-images](https://github.com/gitpod-io/workspace-images)
- [Gitpod Docker Hub](https://hub.docker.com/u/gitpod)

