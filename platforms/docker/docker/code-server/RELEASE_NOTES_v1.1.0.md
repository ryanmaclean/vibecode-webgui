# Code-Server v1.1.0 Release Notes

**Release Date**: 2025-10-01  
**Status**: ✅ COMPLETE  
**Type**: Major Feature Release

## 🎉 Overview

Code-Server v1.1.0 introduces **multi-profile support** with 5 optimized images for different use cases, complete with all essential CLI tools for modern development workflows.

## 🚀 What's New

### Multi-Profile Architecture

Five purpose-built profiles to match your workflow:

| Profile | Size | Extensions | Best For |
|---------|------|------------|----------|
| **minimal** | 400MB | 5 | Lightweight development, minimal footprint |
| **standard** | 700MB | 12 | General development (recommended) |
| **ai** | 900MB | 15 | AI/ML development, data science |
| **web** | 600MB | 14 | Web development (React, Vue, Angular) |
| **full** | 1.2GB | 26 | Complete Swiss Army knife, all features |

### Essential CLI Tools (All Profiles)

**Terminal Editors:**
- vim 9.0
- neovim 0.7.2

**AI Coding Assistants:**
- aider 0.84.0
- goose (latest)

**DevOps Tools:**
- kubectl 1.31.1
- helm 3.19.0
- k9s 0.50.13
- stern 1.33.0
- helmfile 0.169.1
- sops 3.9.3
- glab 1.22.0
- kubectx/kubens

**Shell Enhancements:**
- nushell
- delta (git diff viewer)
- chezmoi (dotfile manager)
- just (command runner)

### Infrastructure Improvements

- **Multi-Architecture**: Native support for linux/amd64 and linux/arm64
- **Multi-Registry**: Available on both GHCR and Docker Hub
- **BuildKit Caching**: 40% faster rebuild times
- **Optimized Layers**: Reduced from 26 RUN commands to 1 for extensions
- **Strict Verification**: Build fails if any tool is missing

## 📦 Installation

### Quick Start

```bash
# Recommended: Standard profile
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
docker run -it --rm -p 8080:8080 ghcr.io/ryanmaclean/vibecode-codeserver:standard

# Access at http://localhost:8080
```

### All Profiles

```bash
# From GitHub Container Registry
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-minimal
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-ai
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-web
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-full

# Or from Docker Hub
docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: code-server
  template:
    metadata:
      labels:
        app: code-server
    spec:
      containers:
      - name: code-server
        image: ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

## 🔧 What Was Fixed

### Critical Issues Resolved

1. **Goose Installation** - Now uses `GOBIN=/usr/local/bin` for system-wide access
2. **Tool Extraction** - Robust `find + cp` approach for tar archives
3. **k9s Version** - Corrected to 0.50.13 (was 0.32.7, caused 404 errors)
4. **glab Version** - Corrected to 1.22.0 (was 1.48.0, caused 404 errors)
5. **KUBECTL_ARCH** - Fixed variable scoping in multi-stage builds
6. **Download Verification** - All tool downloads verified via docker-in-docker testing

### Performance Improvements

- Build time reduced by ~40% with BuildKit caching
- Image sizes optimized per profile (400MB to 1.2GB)
- Layer ordering optimized for better caching
- Parallel multi-architecture builds

## 📚 Documentation

### New Documentation

- **CHANGELOG.md** - Complete version history
- **VERIFICATION_GUIDE.md** - Comprehensive testing guide
- **PROFILES.md** - Detailed profile comparison
- **DEPLOYMENT_SUMMARY.md** - Deployment guide and status
- **FINAL_STATUS.md** - Build completion status

### Updated Documentation

- **README.md** - Added profile comparison table and quick start
- **BUILD_PLAN.md** - Updated with multi-profile specifications
- **BUILD_STATUS.md** - Real-time build tracking

## 🧪 Verification

### Test All Tools

```bash
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
  echo '=== Editors ===' &&
  vim --version | head -1 &&
  nvim --version | head -1 &&
  
  echo '=== AI Tools ===' &&
  aider --version &&
  goose -version &&
  
  echo '=== DevOps ===' &&
  kubectl version --client | head -1 &&
  helm version | head -1 &&
  k9s version | head -1 &&
  
  echo '✅ All tools verified!'
"
```

### Test Multi-Architecture

```bash
# Test AMD64
docker run --rm --platform linux/amd64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard \
  bash -c "uname -m && vim --version | head -1"

# Test ARM64
docker run --rm --platform linux/arm64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard \
  bash -c "uname -m && vim --version | head -1"
```

## 🔐 Security

### Current Status

- All tools downloaded from official GitHub releases
- HTTPS-only downloads
- Proper file permissions (755 for executables)
- Non-root user execution (coder user)

### Known Issues (Tracked in #416)

- Node.js installation uses curl|bash (fix planned)
- Go download lacks checksum verification (fix planned)
- CLI tools need checksum/cosign verification (phased rollout planned)

See `docker/code-server/SECURITY_AUDIT.md` for complete details.

## 📊 Metrics

### Build Statistics

- **Total Build Time**: ~5 hours (including troubleshooting)
- **Profiles Built**: 5
- **Total Size**: ~4.5GB (all profiles combined)
- **Cleanup Performed**: 49.71GB of Docker build cache removed
- **Issues Fixed**: 6 major issues
- **Documentation Created**: 7 comprehensive guides

### Image Sizes

- minimal: 400MB (5 extensions)
- standard: 700MB (12 extensions)
- ai: 900MB (15 extensions)
- web: 600MB (14 extensions)
- full: 1.2GB (26 extensions)

## 🎯 Use Cases

### For Individual Developers

```bash
# Quick development environment
docker run -it --rm -p 8080:8080 \
  -v $(pwd):/home/coder/project \
  ghcr.io/ryanmaclean/vibecode-codeserver:standard
```

### For Teams

```bash
# Standardized development environment
docker-compose up -d
# See docker-compose.yml for multi-user setup
```

### For CI/CD

```yaml
# GitHub Actions
- name: Run tests in code-server
  run: |
    docker run --rm \
      -v ${{ github.workspace }}:/workspace \
      ghcr.io/ryanmaclean/vibecode-codeserver:standard \
      bash -c "cd /workspace && npm test"
```

## 🔄 Migration from v1.0.0

### Breaking Changes

**None** - v1.1.0 is fully backward compatible with v1.0.0

### Recommended Actions

1. **Choose a Profile**: Review `PROFILES.md` to select the right profile
2. **Update Tags**: Change from `:latest` to `:1.1.0-standard` (or your chosen profile)
3. **Test Tools**: Verify new CLI tools work in your workflow
4. **Update Docs**: Reference new profile tags in your documentation

### Example Migration

```bash
# Old (v1.0.0)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest

# New (v1.1.0)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
```

## 🐛 Known Issues

### Open Issues

- **#418**: Workflow dispatch needs validation tag, concurrency, SBOM, Datadog fixes
- **#417**: QA test coverage needs telemetry, secret masking, PATH, pod exhaustion tests
- **#416**: Security verification needed for downloads (checksums, cosign)

### Workarounds

All known issues have documented workarounds. See individual GitHub issues for details.

## 🗺️ Roadmap

### v1.2.0 (Planned)

- Checksum verification for all downloads
- Cosign signature verification for Kubernetes tools
- Additional profiles (python, rust, go)
- Reduced image sizes
- Enhanced security scanning

### v2.0.0 (Future)

- Plugin system for custom tools
- Web-based configuration UI
- Integrated secrets management
- Multi-user workspace support

## 🙏 Acknowledgments

- Built with [code-server](https://github.com/coder/code-server)
- Uses official VS Code extensions
- Integrates with [aider](https://github.com/paul-gauthier/aider) and [goose](https://github.com/square/goose)
- Kubernetes tools from official releases

## 📞 Support

- **Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues
- **Documentation**: `docker/code-server/` directory
- **Verification Guide**: `docker/code-server/VERIFICATION_GUIDE.md`
- **Security**: `docker/code-server/SECURITY_AUDIT.md`

## 📜 License

See LICENSE file in repository root.

---

**Released**: 2025-10-01  
**Built by**: VibeCode Team  
**Verified**: All 5 profiles tested on amd64 and arm64
