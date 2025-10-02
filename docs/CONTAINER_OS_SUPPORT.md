# Container-Based OS Support

VibeCode is designed for container-native infrastructure.

## Supported Platforms

### Talos Linux ✅
- **Status**: Compatible
- **Value**: Web-based development for API-only clusters
- **Setup**: Deploy via Kubernetes manifests

### AWS Bottlerocket ✅
- **Status**: Compatible
- **Value**: EKS-native cloud IDE
- **Setup**: Deploy to EKS cluster

### Flatcar Container Linux ✅
- **Status**: Compatible
- **Value**: CoreOS successor support
- **Setup**: Standard Kubernetes deployment

### Fedora CoreOS ✅
- **Status**: Compatible
- **Value**: Red Hat ecosystem integration
- **Setup**: Deploy via Ignition config

## macOS Container Runtimes

### OrbStack
- Fast, native macOS containers
- Better performance than Docker Desktop
- **Setup**: `brew install orbstack`

### Colima
- Open source Docker alternative
- **Setup**: `brew install colima`

### Rancher Desktop
- Kubernetes + containers
- **Setup**: Download from rancher.io

## Why VibeCode for Container OSes

Container-based OSes remove development tools for security.
VibeCode adds them back safely:

- Web-based terminal (no SSH needed)
- Isolated development containers
- Full tooling without OS compromise
- AI-assisted development

## Quick Start

```bash
# Deploy to any Kubernetes cluster
kubectl apply -f k8s/vibecode-deployment.yaml

# Works on: Talos, Bottlerocket, Flatcar, CoreOS, standard K8s
```

See deployment guides for platform-specific optimizations.
