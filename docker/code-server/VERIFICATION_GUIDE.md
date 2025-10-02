# Code-Server v1.1.1 Verification Guide

This guide provides comprehensive verification steps for all code-server profiles and tools.

## Quick Verification

### Check All Profiles Are Available

```bash
# Verify all profiles on GHCR
for profile in minimal standard ai web full; do
  docker manifest inspect ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-$profile > /dev/null 2>&1 && \
    echo "✅ $profile" || echo "❌ $profile MISSING"
done

# Verify all profiles on Docker Hub
for profile in minimal standard ai web full; do
  docker manifest inspect ryanmaclean/vibecode-codeserver:1.1.1-$profile > /dev/null 2>&1 && \
    echo "✅ $profile" || echo "❌ $profile MISSING"
done
```

## Profile-Specific Verification

### Standard Profile (Recommended)

```bash
# Pull the image
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard

# Verify all tools
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
  echo '=== Terminal Editors ===' &&
  vim --version | head -1 &&
  nvim --version | head -1 &&
  
  echo '' &&
  echo '=== AI Coding Assistants ===' &&
  aider --version &&
  goose -version &&
  
  echo '' &&
  echo '=== DevOps Tools ===' &&
  kubectl version --client | head -1 &&
  helm version | head -1 &&
  k9s version | head -1 &&
  stern --version &&
  helmfile --version &&
  sops --version &&
  glab --version &&
  
  echo '' &&
  echo '=== Shell Enhancements ===' &&
  nu --version &&
  delta --version &&
  chezmoi --version &&
  just --version &&
  
  echo '' &&
  echo '✅ All tools verified!'
"
```

### AI Profile

```bash
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-ai

docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:ai bash -c "
  echo '=== AI Tools ===' &&
  aider --version &&
  goose -version &&
  echo '✅ AI profile verified!'
"
```

### Web Profile

```bash
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-web

docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:web bash -c "
  echo '=== Web Development Tools ===' &&
  vim --version | head -1 &&
  nvim --version | head -1 &&
  echo '✅ Web profile verified!'
"
```

### Full Profile

```bash
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest

docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest bash -c "
  echo '=== Complete Toolset ===' &&
  vim --version | head -1 &&
  aider --version &&
  kubectl version --client | head -1 &&
  echo '✅ Full profile verified!'
"
```

## Multi-Architecture Verification

### Test on AMD64

```bash
docker run --rm --platform linux/amd64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
    echo 'Architecture: amd64' &&
    uname -m &&
    vim --version | head -1 &&
    aider --version &&
    kubectl version --client | head -1 &&
    echo '✅ AMD64 verified!'
  "
```

### Test on ARM64

```bash
docker run --rm --platform linux/arm64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
    echo 'Architecture: arm64' &&
    uname -m &&
    vim --version | head -1 &&
    aider --version &&
    kubectl version --client | head -1 &&
    echo '✅ ARM64 verified!'
  "
```

## Interactive Testing

### Start Interactive Session

```bash
# Standard profile
docker run -it --rm -p 8080:8080 \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard

# Access at http://localhost:8080
```

### Test VS Code Extensions

1. Open code-server at http://localhost:8080
2. Open the Extensions panel (Ctrl+Shift+X)
3. Verify extensions are installed:
   - For standard: 12 extensions
   - For ai: 15 extensions
   - For web: 14 extensions
   - For full: 26 extensions

### Test CLI Tools Interactively

```bash
docker run -it --rm \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard bash

# Inside the container, test:
vim
nvim
aider --help
goose -h
kubectl version
helm version
k9s version
```

## Synology NAS Verification

### SSH to NAS

```bash
ssh your-nas-hostname
```

### Pull and Test

```bash
# Pull standard profile
docker pull ryanmaclean/vibecode-codeserver:1.1.1-standard

# Verify tools
docker run --rm ryanmaclean/vibecode-codeserver:standard bash -c "
  vim --version && nvim --version &&
  aider --version && goose -version &&
  kubectl version --client && helm version
"

# Run interactively
docker run -it --rm -p 8080:8080 \
  ryanmaclean/vibecode-codeserver:standard

# Access at http://nas-ip:8080
```

## Kubernetes Verification

### Deploy to Kubernetes

```bash
# Create deployment
kubectl create deployment code-server \
  --image=ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard

# Expose service
kubectl expose deployment code-server --port=8080 --type=LoadBalancer

# Get service URL
kubectl get svc code-server
```

### Verify in Pod

```bash
# Get pod name
POD=$(kubectl get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')

# Exec into pod and verify tools
kubectl exec -it $POD -- bash -c "
  vim --version | head -1 &&
  aider --version &&
  kubectl version --client
"
```

## Automated Verification Script

Save this as `verify-all-profiles.sh`:

```bash
#!/bin/bash
set -e

PROFILES=("minimal" "standard" "ai" "web" "full")
REGISTRY="${1:-ghcr.io/ryanmaclean}"
IMAGE_NAME="vibecode-codeserver"
VERSION="1.1.1"

echo "🔍 Verifying all code-server profiles..."
echo ""

for profile in "${PROFILES[@]}"; do
  echo "=== Testing $profile profile ==="
  
  # Pull image
  docker pull $REGISTRY/$IMAGE_NAME:$VERSION-$profile
  
  # Test basic tools
  docker run --rm $REGISTRY/$IMAGE_NAME:$VERSION-$profile bash -c "
    vim --version > /dev/null 2>&1 && echo '✅ vim' || echo '❌ vim' &&
    nvim --version > /dev/null 2>&1 && echo '✅ nvim' || echo '❌ nvim' &&
    aider --version > /dev/null 2>&1 && echo '✅ aider' || echo '❌ aider' &&
    goose -version > /dev/null 2>&1 && echo '✅ goose' || echo '❌ goose'
  "
  
  echo ""
done

echo "✅ All profiles verified!"
```

Run it:

```bash
chmod +x verify-all-profiles.sh
./verify-all-profiles.sh
```

## Troubleshooting

### Image Not Found

```bash
# Check if image exists
docker manifest inspect ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard

# Try Docker Hub instead
docker pull ryanmaclean/vibecode-codeserver:1.1.1-standard
```

### Tool Not Working

```bash
# Check if tool is in PATH
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
  which vim && which nvim && which aider && which goose
"

# Check tool versions
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
  vim --version | head -1 &&
  aider --version &&
  goose -version
"
```

### Architecture Issues

```bash
# Force specific architecture
docker pull --platform linux/amd64 ghcr.io/ryanmaclean/vibecode-codeserver:standard
docker pull --platform linux/arm64 ghcr.io/ryanmaclean/vibecode-codeserver:standard
```

### Permission Issues

```bash
# Run as specific user
docker run --rm --user coder \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
    whoami && id
  "
```

## Performance Testing

### Measure Startup Time

```bash
time docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
  echo 'Container started'
"
```

### Check Image Size

```bash
docker images | grep vibecode-codeserver
```

### Test Resource Usage

```bash
docker stats $(docker run -d ghcr.io/ryanmaclean/vibecode-codeserver:standard sleep 60)
```

## Success Criteria

All verifications should show:
- ✅ All profiles available on both registries
- ✅ All tools installed and working
- ✅ Both architectures (amd64, arm64) functional
- ✅ VS Code extensions loaded correctly
- ✅ Interactive sessions work
- ✅ Kubernetes deployments successful

## Next Steps

After verification:
1. Update production Kubernetes manifests
2. Deploy to staging environment
3. Run integration tests
4. Promote to production
5. Update documentation

## Support

If any verification fails:
1. Check the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) guide
2. Review build logs in `docker/code-server/BUILD_STATUS.md`
3. Open an issue at https://github.com/ryanmaclean/vibecode-webgui/issues
