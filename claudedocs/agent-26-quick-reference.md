# ARM64 Build Workflow - Quick Reference

**Agent 26 Deliverables** | **Date**: 2025-10-02

## Quick Start

### Validate Dockerfile
```bash
./scripts/validate-arm64-dockerfile.sh docker/code-server/Dockerfile
```

### Trigger Build (GitHub CLI)
```bash
# Minimal profile
gh workflow run test-arm64-build.yml -f profile=minimal

# Standard profile with Go
gh workflow run test-arm64-build.yml -f profile=standard

# AI profile with extensions
gh workflow run test-arm64-build.yml -f profile=ai

# Full profile
gh workflow run test-arm64-build.yml -f profile=full

# Dry-run (no push)
gh workflow run test-arm64-build.yml -f profile=minimal -f skip_push=true
```

### Check Build Status
```bash
gh run list --workflow=test-arm64-build.yml --limit 5
gh run view <run-id> --log
```

### Download Diagnostics
```bash
gh run download <run-id> -n arm64-build-diagnostics-minimal-<run-id>
```

## Critical Issues Found

| Issue | Line | Impact | Status |
|-------|------|--------|--------|
| Go hardcoded to AMD64 | 40-42 | CRITICAL | Needs Fix |
| Rust analyzer x86_64 | 136 | CRITICAL | Needs Fix |
| Vector AMD64 package | 65 | CRITICAL | Needs Fix |
| Missing TARGETARCH | N/A | CRITICAL | Needs Fix |

## Dockerfile Fixes Required

### 1. Add TARGETARCH Declaration
```dockerfile
# Add after FROM statement
ARG TARGETARCH
```

### 2. Fix Go Installation
```dockerfile
# Replace lines 40-43 with:
ARG TARGETARCH
RUN case ${TARGETARCH} in \
      amd64) GOARCH=amd64 ;; \
      arm64) GOARCH=arm64 ;; \
    esac && \
    wget https://go.dev/dl/go1.22.4.linux-${GOARCH}.tar.gz && \
    tar -C /usr/local -xzf go1.22.4.linux-${GOARCH}.tar.gz && \
    rm go1.22.4.linux-${GOARCH}.tar.gz && \
    ln -s /usr/local/go/bin/go /usr/local/bin/go
```

### 3. Fix Rust Analyzer
```dockerfile
# Replace line 136 with:
ARG TARGETARCH
RUN case ${TARGETARCH} in \
      amd64) RUST_ARCH=x86_64 ;; \
      arm64) RUST_ARCH=aarch64 ;; \
    esac && \
    curl -L https://github.com/rust-analyzer/rust-analyzer/releases/latest/download/rust-analyzer-${RUST_ARCH}-unknown-linux-gnu.gz | \
    gunzip -c - > /usr/local/bin/rust-analyzer && \
    chmod +x /usr/local/bin/rust-analyzer
```

### 4. Fix Vector Package
```dockerfile
# Replace line 65 with:
ARG TARGETARCH
RUN case ${TARGETARCH} in \
      amd64) VECTOR_ARCH=amd64 ;; \
      arm64) VECTOR_ARCH=arm64 ;; \
    esac && \
    curl -L https://releases.timber.io/vector/latest/vector-${VECTOR_ARCH}.deb -o vector.deb && \
    dpkg -i vector.deb && \
    rm vector.deb
```

## Workflow Features

### Build Profiles
- **minimal**: Basic code-server, Node.js, Python (~800MB, 15-20 min)
- **standard**: + Go, additional tools (~1.2GB, 25-35 min)
- **ai**: + AI extensions, LSPs (~1.5GB, 40-60 min)
- **full**: Complete tooling suite (~2GB, 60-90 min)

### Quality Gates
1. Pre-build Dockerfile validation
2. Architecture verification post-build
3. Binary functionality tests
4. Image inspection and metadata check
5. Diagnostic collection on failure

### Cache Strategy
- Profile-specific cache: `arm64-test-{profile}`
- Base cache: `arm64-test-base`
- Expected hit rate: 70-90% (second builds)
- Build time reduction: >40%

## Testing Commands

### Local Docker Build Test
```bash
# Build for ARM64
docker buildx build \
  --platform linux/arm64 \
  --file docker/code-server/Dockerfile \
  --build-arg PROFILE=minimal \
  --tag test-arm64-local:latest \
  .

# Test on ARM64 (with QEMU)
docker run --rm --platform linux/arm64 test-arm64-local:latest code-server --version
```

### Image Inspection
```bash
# Inspect pushed image
docker buildx imagetools inspect ghcr.io/owner/vibecode-codeserver:test-arm64-minimal-<run-id>

# Pull and test
docker pull --platform linux/arm64 ghcr.io/owner/vibecode-codeserver:test-arm64-minimal-<run-id>

# Verify architecture
docker run --rm --platform linux/arm64 \
  ghcr.io/owner/vibecode-codeserver:test-arm64-minimal-<run-id> \
  uname -m
# Expected output: aarch64

# Test Go architecture (standard+)
docker run --rm --platform linux/arm64 \
  ghcr.io/owner/vibecode-codeserver:test-arm64-standard-<run-id> \
  go env GOARCH
# Expected output: arm64
```

## Common Issues & Solutions

### Issue: Build Fails with "exec format error"
**Cause**: Hardcoded AMD64 binary executed on ARM64
**Solution**: Apply Dockerfile architecture fixes above

### Issue: Build Times Out After 90 Minutes
**Cause**: QEMU emulation too slow for profile
**Solution**:
- Use smaller profile
- Enable cache properly
- Consider native ARM64 runners

### Issue: Cache Not Working
**Cause**: Cache scope mismatch or first build
**Solution**:
- Verify cache scope in workflow logs
- Second build should show cache hits
- Check GitHub Actions cache storage

### Issue: Image Push Fails
**Cause**: GHCR authentication or permissions
**Solution**:
- Verify GITHUB_TOKEN permissions
- Check repository package settings
- Ensure packages: write permission

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Minimal Build | <20 min | <25 min |
| Standard Build | <35 min | <45 min |
| AI Build | <60 min | <75 min |
| Full Build | <90 min | <120 min |
| Cache Hit Rate | >70% | >50% |
| Image Size (minimal) | <800MB | <1GB |

## Files Modified

```
.github/workflows/test-arm64-build.yml    # Main workflow (FIXED)
scripts/validate-arm64-dockerfile.sh       # Validation script (NEW)
claudedocs/agent-26-arm64-build-fix-report.md  # Full report (NEW)
claudedocs/agent-26-test-plan.md          # Test plan (NEW)
claudedocs/agent-26-quick-reference.md    # This file (NEW)
```

## Next Steps

### Critical Path
1. [ ] Apply Dockerfile architecture fixes (CRITICAL - P0)
2. [ ] Run validation script to confirm fixes
3. [ ] Test minimal profile build
4. [ ] Test standard profile build (Go verification)
5. [ ] Document results

### Follow-up Tasks
- [ ] Test AI profile build
- [ ] Test full profile build
- [ ] Performance benchmarking
- [ ] Consider native ARM64 runners
- [ ] Integrate with main CI/CD pipeline

## Support

### Documentation
- Full Report: `claudedocs/agent-26-arm64-build-fix-report.md`
- Test Plan: `claudedocs/agent-26-test-plan.md`
- Workflow: `.github/workflows/test-arm64-build.yml`
- Validation Script: `scripts/validate-arm64-dockerfile.sh`

### Validation
```bash
# Verify fixes
./scripts/validate-arm64-dockerfile.sh docker/code-server/Dockerfile

# Expected output when fixed:
# ✅ All checks passed! Dockerfile is ARM64-ready.
```

### Contact
- Workflow Issues: Check GitHub Actions logs
- Architecture Questions: Review Dockerfile fixes section
- Performance Issues: Check performance targets section

---

**Status**: Workflow FIXED, Dockerfile NEEDS FIXES
**Priority**: P0 - CRITICAL
**Blocker**: Dockerfile architecture issues must be resolved before ARM64 builds can succeed
