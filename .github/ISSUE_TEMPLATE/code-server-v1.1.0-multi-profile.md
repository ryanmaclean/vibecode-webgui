---
name: Code-Server v1.1.0 Multi-Profile Build
about: Build and deploy optimized code-server images with 5 profiles
title: '[CODE-SERVER] v1.1.0 Multi-Profile Build & Deployment'
labels: ['infrastructure', 'docker', 'high-priority', 'code-server']
assignees: ''
---

## 🎯 Objective

Build and deploy VibeCode Code-Server v1.1.0 with 5 optimized profiles to both GHCR and Docker Hub.

## 🔴 Critical Issues in v1.0.0

- ❌ Only vim-tiny installed (full vim missing)
- ❌ neovim not installed
- ❌ aider (AI CLI) not installed
- ❌ goose (AI CLI) not installed
- ✅ All 26 VS Code extensions working

**Root Cause**: apt-get install step failed during build

## 📋 Tasks

### Task 1: Fix Dockerfile & Verify Packages (HIGH PRIORITY)
**Owner**: @ryanmaclean  
**Status**: IN PROGRESS

- [ ] Install aider via pip (`pip3 install --break-system-packages aider-chat`)
- [ ] Install goose via Go (already present)
- [ ] Add verification step to confirm all tools present
- [ ] Test build locally before pushing

**Files Modified**:
- `docker/code-server/Dockerfile` - Added aider installation and verification step

### Task 2: Build All 5 Profiles (HIGH PRIORITY)
**Owner**: @ryanmaclean  
**Status**: PENDING

Build and test each profile:

- [ ] **Minimal** (400MB, 5 extensions)
  - Extensions: Claude, Codeium, Python, ESLint, Prettier
  - Command: `./scripts/build-profiles.sh 1.1.0 minimal`

- [ ] **Standard** (700MB, 12 extensions) ⭐ RECOMMENDED
  - Extensions: 4 AI + languages + essential tools
  - Command: `./scripts/build-profiles.sh 1.1.0 standard`

- [ ] **AI** (900MB, 15 extensions)
  - Extensions: All 10 AI assistants + minimal tools
  - Command: `./scripts/build-profiles.sh 1.1.0 ai`

- [ ] **Web** (600MB, 14 extensions)
  - Extensions: Web dev focused (TypeScript, Tailwind, etc.)
  - Command: `./scripts/build-profiles.sh 1.1.0 web`

- [ ] **Full** (1.2GB, 26 extensions)
  - Extensions: Everything + all CLI tools
  - Command: `./scripts/build-profiles.sh 1.1.0 full`

### Task 3: Push to Registries (HIGH PRIORITY)
**Owner**: @ryanmaclean  
**Status**: PENDING

- [ ] Push all profiles to GHCR (`ghcr.io/ryanmaclean/vibecode-codeserver`)
- [ ] Push all profiles to Docker Hub (`ryanmaclean/vibecode-codeserver`)
- [ ] Tag with version (1.1.0) and rolling tags (minimal, standard, ai, web, latest)
- [ ] Verify images pullable from both registries

**Commands**:
```bash
# Build and push all profiles
./scripts/build-profiles.sh 1.1.0 all

# Verify
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard
```

### Task 4: Documentation (MEDIUM PRIORITY)
**Owner**: @codex-agent or @cursor-agent  
**Assignable**: YES

- [ ] Update `DEPLOYMENT_REPORT.md` with v1.1.0 details
- [ ] Create `CHANGELOG.md` documenting v1.0.0 → v1.1.0 changes
- [ ] Update `README.md` with profile usage examples
- [ ] Add troubleshooting guide for missing tools
- [ ] Document multi-registry pull commands

**Command for Codex**:
```bash
```

### Task 5: Testing & Validation (MEDIUM PRIORITY)
**Owner**: @cursor-agent or manual testing  
**Assignable**: YES

- [ ] Test each profile on Synology NAS
- [ ] Verify all AI CLIs work (aider, goose)
- [ ] Verify all VS Code extensions load
- [ ] Performance benchmarks (startup time, memory usage)
- [ ] Create test report

**Test Commands**:
```bash
# Test standard profile
docker run -it --rm ryanmaclean/vibecode-codeserver:standard bash -c "
  echo '=== Testing Editors ===' &&
  vim --version | head -1 &&
  nvim --version | head -1 &&
  echo '=== Testing AI CLIs ===' &&
  aider --version &&
  goose version &&
  echo '=== Testing Extensions ===' &&
  code-server --list-extensions | wc -l
"
```

### Task 6: Research & Optimization (LOW PRIORITY)
**Owner**: @codex-agent  
**Assignable**: YES

- [ ] Research additional AI CLI tools to include
- [ ] Investigate Alpine-based alternatives for smaller images
- [ ] Benchmark build times for each profile
- [ ] Explore lazy extension loading strategies
- [ ] Document optimization opportunities

**Command for Codex**:
```bash
codex exec "Research and document: 1) Additional AI CLI tools for code-server (beyond aider/goose), 2) Alpine-based code-server alternatives, 3) Extension lazy-loading strategies. Output to docs/research/code-server-optimization.md"
```

## 📊 Expected Results

### Image Sizes
- Minimal: ~400MB (67% reduction from full)
- Standard: ~700MB (42% reduction from full) ⭐
- AI: ~900MB (25% reduction from full)
- Web: ~600MB (50% reduction from full)
- Full: ~1.2GB (current size)

### Registry Tags
```
# GHCR
ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-minimal
ghcr.io/ryanmaclean/vibecode-codeserver:minimal

# Docker Hub
ryanmaclean/vibecode-codeserver:1.1.0-minimal
ryanmaclean/vibecode-codeserver:minimal

# Available: minimal, standard, ai, web, latest (full)
```

## 🔗 Related Files

- `docker/code-server/Dockerfile` - Main Dockerfile with profile support
- `docker/code-server/profiles/*.txt` - Profile configuration files
- `scripts/build-profiles.sh` - Multi-profile build script
- `docker/code-server/PROFILES.md` - Complete documentation
- `docker/code-server/DEPLOYMENT_REPORT.md` - Deployment details

## ✅ Definition of Done

- [ ] All 5 profiles built successfully
- [ ] All profiles pushed to GHCR and Docker Hub
- [ ] All VS Code extensions working
- [ ] Documentation updated
- [ ] Tests passing
- [ ] Deployed to Synology NAS for validation

## 📝 Notes

- v1.0.0 had critical missing tools due to build failures
- v1.1.0 includes verification step to catch missing tools early
- Profile-based approach reduces image size by 40-67%
- Multi-registry support improves availability and redundancy
