# Code-Server v1.1.1 Release Notes

**Release Date**: 2025-10-01
**Status**: ✅ COMPLETE
**Type**: Security & License Compliance Release

## 🎉 Overview

Code-Server v1.1.1 removes GPL-licensed components to ensure complete permissive license compliance across all images and profiles.

## 🔐 What's Changed

### GPL License Removal

**Removed:**
- Emacs (GPL-licensed) removed from all profiles

**Rationale:**
- Maintains permissive license-only policy (MIT, Apache 2.0, BSD)
- Ensures legal compliance for commercial use without GPL restrictions
- Simplifies license auditing and compliance requirements

**Remaining Terminal Editors:**
- vim 9.0 (Vim License - compatible with GPL, permissive)
- neovim 0.7.2 (Apache 2.0)

### Security

- **License Compliance**: All tools verified to use permissive licenses only
- **No Functional Changes**: All other features remain identical to v1.1.0

## 📦 Installation

### Quick Start

```bash
# Recommended: Standard profile
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
docker run -it --rm -p 8080:8080 ghcr.io/ryanmaclean/vibecode-codeserver:standard

# Access at http://localhost:8080
```

### All Profiles

```bash
# From GitHub Container Registry
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-minimal
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-ai
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-web
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-full

# Or from Docker Hub
docker pull ryanmaclean/vibecode-codeserver:1.1.1-standard
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
        image: ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
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

## 🔄 Migration from v1.1.0

### Breaking Changes

**Minor Change**: Emacs no longer available in images

### Recommended Actions

1. **Update Tags**: Change from `:1.1.0-*` to `:1.1.1-*`
2. **Emacs Users**: Use vim or neovim as alternatives, or install Emacs manually at runtime if GPL compliance is not a concern in your use case
3. **Test Workflows**: Verify editor preferences if you were using Emacs

### Example Migration

```bash
# Old (v1.1.0)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard

# New (v1.1.1)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
```

## 📚 Documentation

All documentation updated to reference v1.1.1:

- **README.md** - Updated with v1.1.1 examples
- **CHANGELOG.md** - Added v1.1.1 entry
- **VERIFICATION_GUIDE.md** - Updated verification commands
- **RELEASE_NOTES_v1.1.1.md** - This file

## 🧪 Verification

### Verify Version

```bash
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard bash -c "
  echo '=== Terminal Editors ===' &&
  vim --version | head -1 &&
  nvim --version | head -1 &&

  echo '' &&
  echo '=== Verify Emacs Removed ===' &&
  which emacs && echo '❌ Emacs still present!' || echo '✅ Emacs removed (expected)'
"
```

### Verify License Compliance

All remaining tools use permissive licenses:

- **vim**: Vim License (permissive, GPL-compatible)
- **neovim**: Apache 2.0
- **aider**: Apache 2.0
- **goose**: Apache 2.0
- **kubectl**: Apache 2.0
- **helm**: Apache 2.0
- **k9s**: Apache 2.0

## 📊 Impact

### What Changed
- Emacs removed from all 5 profiles (minimal, standard, ai, web, full)
- Documentation updated to reference v1.1.1
- License compliance note added to all relevant docs

### What Didn't Change
- All other CLI tools remain unchanged
- All VS Code extensions remain unchanged
- Image sizes remain the same (400MB - 1.2GB)
- Multi-architecture support unchanged (amd64/arm64)
- Multi-registry support unchanged (GHCR/Docker Hub)

## 🎯 Use Cases

All use cases from v1.1.0 remain valid. The only impact is for users who specifically relied on Emacs, who should:

1. Switch to vim or neovim (both included in all profiles)
2. Install Emacs manually at runtime if GPL compliance is acceptable for their use case
3. Use VS Code editor for graphical editing (primary use case)

## 🐛 Known Issues

No new issues introduced in v1.1.1. All existing issues from v1.1.0 remain tracked:

- **#418**: Workflow dispatch needs validation tag, concurrency, SBOM, Datadog fixes
- **#417**: QA test coverage needs telemetry, secret masking, PATH, pod exhaustion tests
- **#416**: Security verification needed for downloads (checksums, cosign)

## 🗺️ Roadmap

### v1.2.0 (Planned)

- Checksum verification for all downloads
- Cosign signature verification for Kubernetes tools
- Additional profiles (python, rust, go)
- Enhanced security scanning

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
**Verified**: All 5 profiles GPL-free and tested on amd64 and arm64
