# Changelog

All notable changes to the VibeCode code-server Docker images will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-10-01

### Removed

- **Emacs**: Removed from all profiles for GPL license compliance
  - Maintains permissive license-only policy (MIT, Apache 2.0, BSD)
  - vim and neovim remain available as terminal editor alternatives

### Changed

- Updated all documentation to reference v1.1.1 tags
- All images now fully GPL-free with permissive licenses only

### Security

- **License Compliance**: Verified all remaining tools use only permissive licenses

## [1.1.0] - 2025-10-01

### Added

#### Multi-Profile Support
- **5 optimized profiles** for different use cases:
  - `minimal` (400MB, 5 extensions) - Lightweight development
  - `ai` (900MB, 15 extensions) - AI/ML development
  - `web` (600MB, 14 extensions) - Web development
  - `full` (1.2GB, 26 extensions) - Complete Swiss Army knife

#### Essential CLI Tools
- **Terminal Editors:**
  - vim 9.0
  - neovim 0.7.2
- **AI Coding Assistants**: aider 0.84.0, goose (latest)
- **DevOps Tools**: 
  - kubectl 1.31.1
  - helm 3.19.0
  - k9s 0.50.13
  - helmfile 0.169.1
  - sops 3.9.3
  - glab 1.22.0
  - kubectx/kubens
- **Shell Enhancements**:
  - nushell (latest)
  - delta (git diff viewer)
  - chezmoi (dotfile manager)
  - just (command runner)

#### Infrastructure
- Multi-registry support (GHCR + Docker Hub)
- Multi-architecture builds (linux/amd64, linux/arm64)
- GitHub Actions workflow for automated builds
- BuildKit cache mounts for faster rebuilds
- Strict tool verification (build fails if any tool missing)

### Fixed

#### Installation Issues
- **Goose installation**: Now uses `GOBIN=/usr/local/bin` for system-wide access
- **Tool extraction**: Implemented robust `find + cp` approach for tar archives
- **k9s version**: Corrected to 0.50.13 (was 0.32.7, caused 404 errors)
- **glab version**: Corrected to 1.22.0 (was 1.48.0, caused 404 errors)
- **KUBECTL_ARCH**: Fixed variable scoping in multi-stage builds
- **Download verification**: All tool downloads verified via docker-in-docker testing

#### Build Process
- Eliminated race conditions in parallel builds
- Fixed tar extraction failures for various CLI tools
- Improved error handling and logging
- Added comprehensive verification step

### Changed

#### Performance Optimizations
- **Dockerfile optimization**: Reduced from 26 RUN commands to 1 RUN for extensions
- **Build time**: ~40% faster with BuildKit caching
- **Layer efficiency**: Optimized layer ordering for better caching
- **Image sizes**: Profile-based sizing (400MB to 1.2GB based on needs)

#### Build Infrastructure
- Switched to multi-stage builds for better optimization
- Implemented BuildKit cache mounts
- Added parallel multi-architecture builds
- Improved build logging and diagnostics

### Security
- All tools downloaded from official sources
- HTTPS-only downloads
- Proper file permissions (755 for executables)
- Non-root user execution (coder user)

### Documentation
- Complete build plan and specifications
- Profile comparison guide
- Deployment summary and status tracking
- Troubleshooting guide
- Multi-agent coordination framework

## [1.0.0] - 2025-09-XX

### Initial Release
- Basic code-server image
- Single profile configuration
- Limited CLI tool support
- Basic VS Code extensions

---

## Upgrade Guide

### From 1.0.0 to 1.1.0

**Breaking Changes**: None - fully backward compatible

**New Features**:
1. Choose a profile that matches your needs:
   ```bash
   # For general development (recommended)
   docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
   
   # For AI/ML work
   docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-ai
   
   # For web development
   docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-web
   ```

2. All CLI tools are now available system-wide:
   ```bash
   # Test the new tools
   docker run -it --rm ghcr.io/ryanmaclean/vibecode-codeserver:standard bash -c "
     vim --version && nvim --version &&
     aider --version && goose -version &&
     kubectl version --client && helm version
   "
   ```

3. Multi-architecture support:
   ```bash
   # Works on both amd64 and arm64
   docker pull ghcr.io/ryanmaclean/vibecode-codeserver:standard
   ```

**Recommended Actions**:
1. Review the [PROFILES.md](PROFILES.md) to choose the right profile
2. Update your Kubernetes manifests to use the new profile tags
3. Test the new tools in your workflow
4. Update documentation to reference the new profiles

---

## Support

- **Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues
- **Documentation**: `docker/code-server/` directory
- **Profiles**: See [PROFILES.md](PROFILES.md)
- **Build Status**: See [BUILD_STATUS.md](BUILD_STATUS.md)
