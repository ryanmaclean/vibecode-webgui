# Dockerfile Variants - Quick Reference

Three Dockerfile variants available, optimized for different use cases.

## Quick Comparison

| Variant | Build Time | Size | Tools | Extensions | Use Case |
|---------|-----------|------|-------|------------|----------|
| **Dockerfile** | 15-20 min | 4-5 GB | 30+ | 20+ | Production, full features |
| **Dockerfile.optimized** | 10-12 min | 4-5 GB | 30+ | 20+ | Balanced speed + features |
| **Dockerfile.fast** | **4-6 min** | **2-3 GB** | **8** | **5** | **Local dev, CI/CD** |

---

## Dockerfile (Original)

**Purpose**: Full-featured production-ready image with all tools and extensions.

### Features
- 30+ CLI tools (kubectl, helm, k9s, goose, etc.)
- 20+ VSCode extensions
- All profiles supported (minimal, standard, ai, web, full)
- Full binary verification (cosign)
- Kubernetes development ready
- Multiple shell options (bash, zsh, fish, nushell, elvish)

### Build Command
```bash
docker build -f docker/code-server/Dockerfile -t vibecode:full .
```

### When to Use
- Production deployments
- Team development environments
- Kubernetes development
- Full VibeCode feature set required

---

## Dockerfile.optimized

**Purpose**: Layer-optimized version with reduced layer count (78% reduction).

### Features
- All features of original Dockerfile
- Reduced from 57 layers to 12 layers
- Consolidated RUN operations
- Better caching strategy
- Same tool and extension set

### Build Command
```bash
docker build -f docker/code-server/Dockerfile.optimized -t vibecode:optimized .
```

### When to Use
- Faster builds while maintaining all features
- All profile support needed
- Security verification required
- Development iteration

---

## Dockerfile.fast

**Purpose**: Minimal fast-building variant optimized for speed.

### Features
- **4-6 minute builds** (70-80% faster)
- **2-3 GB image size** (51% smaller)
- Multi-stage build with parallel downloads
- BuildKit cache mounts for extensions
- 8 essential CLI tools only
- 5 essential VSCode extensions only
- **Minimal profile only**

### Tools Included
- vim, git, Node.js, npm, lazygit, starship
- TypeScript, prettier, eslint
- aider-chat, python-lsp-server

### Extensions Included
- anthropic.claude-code (AI assistant)
- codeium.codeium (AI completion)
- ms-python.python (Python support)
- dbaeumer.vscode-eslint (JavaScript linting)
- esbenp.prettier-vscode (Code formatting)

### Build Command
```bash
# First build (5-9 minutes)
DOCKER_BUILDKIT=1 docker build \
  -f docker/code-server/Dockerfile.fast \
  -t vibecode:fast \
  --build-arg PROFILE=minimal \
  .

# Subsequent builds (1-2 minutes with cache)
DOCKER_BUILDKIT=1 docker build \
  -f docker/code-server/Dockerfile.fast \
  -t vibecode:fast \
  .
```

### When to Use
- Local development iteration
- CI/CD pipelines requiring speed
- Minimal AI-assisted development
- Learning and experimentation

### Limitations
- Minimal profile only (cannot build other profiles)
- No Kubernetes tools (kubectl, helm, k9s)
- No alternative shells (fish, nushell, elvish)
- No database tools (goose)
- Reduced binary verification

---

## Architecture Differences

### Dockerfile (Original)
```
┌─────────────────────────────────┐
│ Base: code-server:4.104.2       │
├─────────────────────────────────┤
│ 57 Layers (Sequential)          │
│ - System packages               │
│ - CLI tools (30+)               │
│ - Node.js + Go                  │
│ - Extensions (20+)              │
│ - VibeCode extensions           │
│ - LSP servers                   │
│ - Verification                  │
└─────────────────────────────────┘
Build: 15-20 min | Size: 4-5 GB
```

### Dockerfile.fast
```
┌─────────────────────────────────┐
│ Stage 1: Downloader (Parallel)  │
│ - lazygit (parallel)            │
│ - starship (parallel)           │
│ - Node.js (parallel)            │
└─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Stage 2: Runtime                │
├─────────────────────────────────┤
│ 10 Layers (Optimized)           │
│ - System packages (minimal)     │
│ - Binary tools (8)              │
│ - npm packages (4)              │
│ - Python packages (2)           │
│ - Extensions (5, cached)        │
│ - Settings                      │
└─────────────────────────────────┘
Build: 4-6 min | Size: 2-3 GB
```

---

## Benchmarking

Run the included benchmark script to compare build times:

```bash
cd docker/code-server
./benchmark-builds.sh
```

Expected results:
```
Description                      Time      Size
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fast Build (Minimal)             5-9 min   2.2 GB
Fast Build (Cached)              1-2 min   2.2 GB
Optimized Build (Minimal)        8-10 min  2.5 GB
Original Build (Estimated)       20 min    4.5 GB
```

---

## Migration Guide

### From Original → Fast

```bash
# 1. Backup existing image
docker tag vibecode:latest vibecode:backup

# 2. Build fast variant
DOCKER_BUILDKIT=1 docker build \
  -f docker/code-server/Dockerfile.fast \
  -t vibecode:fast \
  .

# 3. Test functionality
docker run -it --rm -p 8765:8765 vibecode:fast

# 4. Check tools
docker exec <container> bash -c "
  vim --version &&
  git --version &&
  node --version &&
  aider --version
"

# 5. Replace if satisfied
docker tag vibecode:fast vibecode:latest
```

### From Fast → Original

```bash
# Build full variant for additional tools
docker build \
  -f docker/code-server/Dockerfile \
  -t vibecode:full \
  --build-arg PROFILE=full \
  .
```

---

## Profile Support Matrix

| Profile | Dockerfile | Dockerfile.optimized | Dockerfile.fast |
|---------|-----------|---------------------|-----------------|
| minimal | ✅ | ✅ | ✅ |
| standard | ✅ | ✅ | ❌ |
| ai | ✅ | ✅ | ❌ |
| web | ✅ | ✅ | ❌ |
| full | ✅ | ✅ | ❌ |

---

## Troubleshooting

### Fast build fails with extension errors
```bash
# Clear BuildKit cache and retry
docker builder prune -a -f
DOCKER_BUILDKIT=1 docker build -f docker/code-server/Dockerfile.fast -t vibecode:fast --no-cache .
```

### Need additional tools in fast build
```bash
# Option 1: Install at runtime
docker exec -it <container> bash
apt-get update && apt-get install -y <tool>

# Option 2: Extend Dockerfile.fast
FROM vibecode:fast
RUN apt-get update && apt-get install -y kubectl helm
```

### Cache not working
```bash
# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1

# Check BuildKit cache
docker buildx du

# Clear and rebuild
docker builder prune -f
```

---

## Recommendations

### For Most Users
Start with **Dockerfile.fast** for local development:
- Fastest iteration
- Minimal resource usage
- Essential AI tools included

Upgrade to **Dockerfile** when you need:
- Kubernetes development
- Full extension set
- Production deployment

### For CI/CD
Use **Dockerfile.fast** with cache persistence:
```yaml
# GitHub Actions example
- name: Build Docker image
  run: |
    DOCKER_BUILDKIT=1 docker build \
      -f docker/code-server/Dockerfile.fast \
      -t vibecode:fast \
      --cache-from vibecode:fast \
      .
```

### For Teams
Use **Dockerfile.optimized** for balanced approach:
- All features available
- Faster builds than original
- All profiles supported

---

## Support

- Full documentation: `/claudedocs/agent5-dockerfile-optimization.md`
- Build benchmark: `./docker/code-server/benchmark-builds.sh`
- Issues: Report to VibeCode team

---

**Last Updated**: 2025-10-02
**Version**: 1.0.0
