# DEPRECATION NOTICE: Code-Server v1.1.0

**Date**: 2025-10-01
**Status**: DEPRECATED - DO NOT USE
**Severity**: CRITICAL - License Compliance Issue

## Executive Summary

All code-server v1.1.0 Docker images are officially deprecated and must not be used in production or development environments. These images contain GPL-licensed software (GNU Emacs) that violates the MIT license compatibility of the VibeCode project.

**Required Action**: Immediately migrate all deployments to v1.1.1.

## Why v1.1.0 is Deprecated

### License Violation

**Issue**: v1.1.0 includes GNU Emacs, which is licensed under GPL v3.

**Problem**: GPL v3 is a copyleft license that requires derivative works to also be GPL-licensed. This creates a license incompatibility with VibeCode's MIT license and potentially affects all downstream users.

**Legal Risk**: Organizations using v1.1.0 may inadvertently violate license terms, exposing them to:
- Copyright infringement claims
- Requirement to release proprietary modifications under GPL
- Potential litigation from GPL rights holders

### Technical Impact

**Affected Components**:
- GNU Emacs 27.1+ (GPL v3 licensed)
- All profiles: minimal, standard, ai, web, full
- Both architectures: linux/amd64, linux/arm64

**Not Affected**:
- vim 9.0 (Charityware/VIM License - compatible)
- neovim 0.7.2 (Apache 2.0 - compatible)
- All other CLI tools (MIT/Apache 2.0 licensed)

## Migration Path to v1.1.1

### What Changed in v1.1.1

**Removed**:
- GNU Emacs (all versions, all profiles)

**Retained**:
- vim 9.0 (full-featured terminal editor)
- neovim 0.7.2 (modern vim alternative)
- All other CLI tools unchanged

**Added**:
- Enhanced checksum verification for all downloads
- Improved security audit compliance
- Updated documentation

### Migration Steps

#### 1. Update Docker Images

```bash
# BEFORE (v1.1.0 - DEPRECATED)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard

# AFTER (v1.1.1 - GPL-free)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
docker pull ryanmaclean/vibecode-codeserver:1.1.1-standard
```

#### 2. Update Kubernetes Manifests

```yaml
# BEFORE
spec:
  containers:
  - name: code-server
    image: ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard

# AFTER
spec:
  containers:
  - name: code-server
    image: ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
```

#### 3. Update Docker Compose Files

```yaml
# BEFORE
services:
  code-server:
    image: ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard

# AFTER
services:
  code-server:
    image: ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
```

#### 4. Update CI/CD Pipelines

Search for all references to `1.1.0` and replace with `1.1.1`:

```bash
# Find all references
grep -r "1.1.0" .github/workflows/
grep -r "1.1.0" .gitlab-ci.yml
grep -r "1.1.0" Jenkinsfile

# Update to 1.1.1
sed -i 's/1.1.0/1.1.1/g' .github/workflows/*.yml
```

#### 5. Verify Migration

```bash
# Check running containers
docker ps --format "{{.Image}}" | grep "1.1.0"

# Should return empty - if not, update those containers

# Verify new image
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard \
  bash -c "vim --version && nvim --version && ! command -v emacs"
```

### Editor Transition Guide

For users who relied on Emacs in v1.1.0:

#### Option 1: Use vim (Recommended)

```bash
# vim is feature-complete and MIT-compatible
vim filename.txt

# Common operations
:w          # Save
:q          # Quit
:wq         # Save and quit
/search     # Search forward
?search     # Search backward
```

#### Option 2: Use neovim (Modern Alternative)

```bash
# neovim is vim-compatible with modern features
nvim filename.txt

# All vim commands work
# Plus: built-in LSP, Lua config, tree-sitter
```

#### Option 3: VS Code Extensions

All code-server profiles include VS Code extensions that provide:
- Syntax highlighting
- IntelliSense
- Git integration
- Terminal integration
- Multi-cursor editing

No separate terminal editor needed for most workflows.

## Timeline and Removal Schedule

### Phase 1: Deprecation (2025-10-01 - 2025-10-31)

**Status**: ACTIVE

**Actions**:
- ✅ Mark v1.1.0 as deprecated in all documentation
- ✅ Update README.md with migration warnings
- ✅ Update CHANGELOG.md with deprecation notice
- ✅ Create this deprecation notice document
- ⏳ Notify users via GitHub Discussions
- ⏳ Update Docker Hub descriptions

**User Action**: Begin migration planning

### Phase 2: Warning Period (2025-11-01 - 2025-11-30)

**Planned Actions**:
- Add deprecation warnings to Docker image startup
- Update registry descriptions with bold warnings
- Post reminder in GitHub Discussions
- Check for active v1.1.0 pulls from registries

**User Action**: Complete migration to v1.1.1

### Phase 3: Removal (2025-12-01+)

**Planned Actions**:
- Remove v1.1.0 tags from GHCR (requires delete:packages permission)
- Remove v1.1.0 tags from Docker Hub (requires admin access)
- Archive v1.1.0 documentation
- Update git history notes

**User Impact**: v1.1.0 images will no longer be pullable

### Current Status (2025-10-01)

- ✅ v1.1.1 builds complete and verified
- ✅ Deprecation documentation created
- ⏳ Registry cleanup pending (requires admin permissions)
- ⏳ User notification pending

## Registry Cleanup Process

**Note**: Registry image deletion requires elevated permissions and admin access. The following documents the process for administrators.

### GHCR (GitHub Container Registry)

#### Images to Remove

```bash
# GHCR package version IDs for deletion:
532086486  # 1.1.0-minimal
532080021  # 1.1.0-standard
531338584  # 1.1.0-ai
531327265  # 1.1.0-web
531251775  # 1.1.0-full
```

#### Deletion Process (Requires delete:packages Permission)

```bash
# Using GitHub CLI (with appropriate permissions)
gh api \
  --method DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /user/packages/container/vibecode-codeserver/versions/532086486

# Repeat for each version ID
```

#### Alternative: GitHub Web UI

1. Navigate to: https://github.com/users/ryanmaclean/packages/container/vibecode-codeserver/versions
2. For each 1.1.0 version:
   - Click "Delete version"
   - Confirm deletion
3. Verify all 1.1.0 tags removed

### Docker Hub

#### Images to Update

```
ryanmaclean/vibecode-codeserver:1.1.0-minimal
ryanmaclean/vibecode-codeserver:1.1.0-standard
ryanmaclean/vibecode-codeserver:1.1.0-ai
ryanmaclean/vibecode-codeserver:1.1.0-web
ryanmaclean/vibecode-codeserver:1.1.0-full
```

#### Deletion Process (Requires Admin Access)

**Option 1: Docker Hub Web UI**

1. Visit: https://hub.docker.com/r/ryanmaclean/vibecode-codeserver/tags
2. For each 1.1.0 tag:
   - Click tag management icon
   - Select "Delete tag"
   - Confirm deletion

**Option 2: Docker Hub API** (Requires authentication token)

```bash
# Get authentication token
TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username": "USERNAME", "password": "PASSWORD"}' \
  https://hub.docker.com/v2/users/login/ | jq -r .token)

# Delete each tag
curl -X DELETE \
  -H "Authorization: JWT ${TOKEN}" \
  "https://hub.docker.com/v2/repositories/ryanmaclean/vibecode-codeserver/tags/1.1.0-standard/"

# Repeat for each 1.1.0 tag
```

#### Update Latest Tags

```bash
# Ensure 'latest' and profile tags point to v1.1.1
docker tag ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard \
  ryanmaclean/vibecode-codeserver:standard

docker tag ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard \
  ryanmaclean/vibecode-codeserver:latest

docker push ryanmaclean/vibecode-codeserver:standard
docker push ryanmaclean/vibecode-codeserver:latest
```

### Verification After Cleanup

```bash
# Verify v1.1.0 tags no longer exist
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
# Expected: Error: manifest unknown

docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard
# Expected: Error: manifest unknown

# Verify v1.1.1 is available
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
# Expected: Success

# Verify latest points to v1.1.1
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest
docker inspect ghcr.io/ryanmaclean/vibecode-codeserver:latest | grep -i version
# Expected: 1.1.1
```

## User Action Checklist

### For Developers

- [ ] Check local Docker images for v1.1.0
- [ ] Update docker-compose.yml files
- [ ] Update Dockerfiles that reference v1.1.0
- [ ] Update CI/CD pipeline configurations
- [ ] Test applications with v1.1.1 images
- [ ] Update documentation and runbooks
- [ ] Notify team members of the change

### For DevOps/SRE

- [ ] Audit all Kubernetes clusters for v1.1.0 deployments
- [ ] Update Helm charts and values files
- [ ] Update Terraform/IaC configurations
- [ ] Schedule maintenance window for updates
- [ ] Verify v1.1.1 in staging environments
- [ ] Roll out v1.1.1 to production
- [ ] Monitor for issues post-migration
- [ ] Document migration in change logs

### For Administrators

- [ ] Review license compliance policies
- [ ] Audit all organizational deployments
- [ ] Communicate deprecation to all teams
- [ ] Set deadline for v1.1.0 removal
- [ ] Track migration progress
- [ ] Archive v1.1.0 references
- [ ] Update security scanning policies

## FAQ

### Q: Why wasn't Emacs GPL licensing caught earlier?

**A**: The v1.1.0 build focused on functionality and multi-profile support. License audit was performed post-release, revealing the GPL incompatibility. Enhanced license scanning is now part of the build process.

### Q: Can I continue using v1.1.0 internally?

**A**: **Not recommended**. GPL v3 copyleft provisions may require you to release your entire codebase under GPL if you distribute the combined work. Consult your legal team before proceeding.

### Q: What if I need Emacs specifically?

**A**: Options:
1. Use vim/neovim (functionally equivalent for most use cases)
2. Install Emacs at runtime in your own derived image (accepting GPL obligations)
3. Use VS Code extensions within code-server
4. Use a separate Emacs container alongside code-server

### Q: Is v1.1.1 fully compatible with v1.1.0?

**A**: Yes, except for Emacs removal. All other tools, extensions, and configurations are identical.

### Q: When will v1.1.0 be completely removed?

**A**: Target removal date is 2025-12-01 (60 days from deprecation notice). This provides ample time for migration.

### Q: How do I verify my image is GPL-free?

**A**:
```bash
docker run --rm IMAGE:TAG bash -c "
  ! command -v emacs && echo 'GPL-free ✓' || echo 'Contains Emacs ✗'
"
```

### Q: What about existing containers running v1.1.0?

**A**: Existing running containers will continue to work, but:
- Should be replaced at next maintenance window
- May expose organization to license compliance issues
- Will not receive security updates
- Cannot be recreated once registry images are deleted

## Support and Resources

### Documentation

- [CHANGELOG.md](CHANGELOG.md) - Complete version history
- [README.md](README.md) - Current version documentation
- [VERIFICATION_GUIDE.md](VERIFICATION_GUIDE.md) - Image testing procedures
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md) - Security compliance details

### Getting Help

- **Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues
- **Discussions**: https://github.com/ryanmaclean/vibecode-webgui/discussions
- **Security**: security@vibecode.dev (for license compliance questions)

### Related Issues

- #453: v1.1.1 build verification
- #454: v1.1.0 deprecation (this notice)
- #455: Security hardening
- #456: Documentation updates
- #457: Complete security audit

## Legal Disclaimer

This deprecation notice is provided for informational purposes only and does not constitute legal advice. Organizations should consult their own legal counsel regarding GPL compliance and license compatibility issues.

The VibeCode project makes no warranties regarding past or current GPL violations by users of v1.1.0 images. Users are solely responsible for their own license compliance.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Maintained By**: VibeCode Team
**Review Cycle**: Updated as removal phases progress
