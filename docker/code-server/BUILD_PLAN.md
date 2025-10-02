# Code-Server v1.1.0 Multi-Profile Build Plan

**Status**: IN PROGRESS  
**GitHub Issue**: [Created - check repo issues]  
**Priority**: HIGH  
**Target Date**: 2025-10-01

## 🎯 Objective

Build and deploy 5 optimized code-server profiles to GHCR and Docker Hub, fixing critical missing tools from v1.0.0.

## 🔴 Critical Fixes

### Missing in v1.0.0:
- ❌ vim (only vim-tiny)
- ❌ neovim
- ❌ 
- ❌ aider (AI CLI)
- ❌ goose (partially - not in PATH)

### Fixed in v1.1.0:
- ✅ Full vim installed via apt
- ✅ neovim installed via apt
- ✅  installed via apt
- ✅ aider installed via pip (`pip3 install --break-system-packages aider-chat`)
- ✅ goose installed via Go (with PATH fix)
- ✅ Verification step added to catch missing tools

## 📦 Profile Specifications

### 1. Minimal (400MB)
**Use Case**: Testing, CI/CD, resource-constrained environments  
**Extensions (5)**:
- anthropic.claude-code
- codeium.codeium
- ms-python.python
- dbaeumer.vscode-eslint
- esbenp.prettier-vscode

**Tools**: vim, nvim, aider, goose, git, python3

### 2. Standard (700MB) ⭐ RECOMMENDED
**Use Case**: General development, most users  
**Extensions (12)**:
- **AI (4)**: Claude, Codeium, Continue, Roo Code
- **Languages (3)**: Python, TypeScript, Clangd
- **Tools (5)**: ESLint, Prettier, Git Graph, Material Icons, Error Lens

**Tools**: All minimal tools + Node.js, Go, LSP servers

### 3. AI (900MB)
**Use Case**: AI-focused development, testing multiple AI assistants  
**Extensions (15)**:
- **AI (10)**: Claude, OpenAI, Codeium, Cline, Kilo Code, Roo Code, Rubberduck, Continue, Supermaven, TabNine
- **Languages (2)**: Python, TypeScript
- **Tools (3)**: ESLint, Prettier, Material Icons

**Tools**: All standard tools + all AI CLIs

### 4. Web (600MB)
**Use Case**: Web development (React, Next.js, etc.)  
**Extensions (14)**:
- **AI (3)**: Claude, Codeium, Continue
- **Web (4)**: TypeScript, Tailwind CSS, REST Client, DotENV
- **Tools (7)**: ESLint, Prettier, Git Graph, Material Icons, Error Lens, YAML, Markdown

**Tools**: All standard tools + web-specific tooling

### 5. Full (1.2GB)
**Use Case**: Power users, all features  
**Extensions (26)**: All extensions  
**Tools**: Everything

## 🏗️ Build Commands

### Build Single Profile
```bash
./scripts/build-profiles.sh 1.1.0 standard
```

### Build All Profiles
```bash
./scripts/build-profiles.sh 1.1.0 all
```

### Build Locally (No Push)
```bash
docker buildx build \
  --platform linux/amd64 \
  -f docker/code-server/Dockerfile \
  --build-arg PROFILE=standard \
  --build-arg VERSION=1.1.0 \
  -t vibecode-codeserver:1.1.0-standard-test \
  --load \
  .
```

## 🧪 Testing Commands

### Verify Tools in Image
```bash
docker run -it --rm ryanmaclean/vibecode-codeserver:standard bash -c "
  echo '=== Editors ===' &&
  vim --version | head -1 &&
  nvim --version | head -1 &&
  echo '=== AI CLIs ===' &&
  aider --version &&
  goose version &&
  echo '=== Extensions ===' &&
  code-server --list-extensions | wc -l &&
  echo '=== SUCCESS ==='
"
```

### Test on Synology NAS
```bash
ssh snas "
  sudo docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard &&
  sudo docker stop vibecode-codeserver || true &&
  sudo docker rm vibecode-codeserver || true &&
  sudo docker run -d --name vibecode-codeserver \
    -p 8765:8765 -p 46203:46203 \
    -e PASSWORD=vibecode \
    -v /volume1/docker/vibecode-codeserver/workspace:/home/coder/workspace \
    --restart unless-stopped \
    ryanmaclean/vibecode-codeserver:1.1.0-standard
"
```

## 📊 Registry Tags

### GHCR (GitHub Container Registry)
```
ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-minimal
ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard
ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-ai
ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-web
ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0

ghcr.io/ryanmaclean/vibecode-codeserver:minimal
ghcr.io/ryanmaclean/vibecode-codeserver:standard
ghcr.io/ryanmaclean/vibecode-codeserver:ai
ghcr.io/ryanmaclean/vibecode-codeserver:web
ghcr.io/ryanmaclean/vibecode-codeserver:latest
```

### Docker Hub
```
ryanmaclean/vibecode-codeserver:1.1.0-minimal
ryanmaclean/vibecode-codeserver:1.1.0-standard
ryanmaclean/vibecode-codeserver:1.1.0-ai
ryanmaclean/vibecode-codeserver:1.1.0-web
ryanmaclean/vibecode-codeserver:1.1.0

ryanmaclean/vibecode-codeserver:minimal
ryanmaclean/vibecode-codeserver:standard
ryanmaclean/vibecode-codeserver:ai
ryanmaclean/vibecode-codeserver:web
ryanmaclean/vibecode-codeserver:latest
```

## 📝 Task Checklist

### Phase 1: Fix & Verify (IN PROGRESS)
- [x] Add aider installation to Dockerfile
- [x] Add tool verification step
- [x] Update TODO.md with task breakdown
- [x] Create GitHub issue
- [x] Create BUILD_PLAN.md
- [ ] Test build locally
- [ ] Verify all tools present

### Phase 2: Build Profiles (PENDING)
- [ ] Build minimal profile
- [ ] Build standard profile
- [ ] Build ai profile
- [ ] Build web profile
- [ ] Build full profile
- [ ] Verify each profile

### Phase 3: Push to Registries (PENDING)
- [ ] Push all profiles to GHCR
- [ ] Push all profiles to Docker Hub
- [ ] Verify pullable from both registries
- [ ] Test on Synology NAS

### Phase 4: Documentation (ASSIGNABLE)
- [ ] Update DEPLOYMENT_REPORT.md
- [ ] Create CHANGELOG.md
- [ ] Update README.md
- [ ] Add troubleshooting guide
- [ ] Document multi-registry usage

### Phase 5: Testing (ASSIGNABLE)
- [ ] Test each profile
- [ ] Verify AI CLIs
- [ ] Verify editors
- [ ] Performance benchmarks
- [ ] Create test report

## 🤝 Agent Collaboration

### For Codex Agent
```bash
codex exec "Update docker/code-server/DEPLOYMENT_REPORT.md with v1.1.0 changes"
codex exec "Research additional AI CLI tools for code-server"
```

### For Cursor Agent
```bash
# Test standard profile
docker run -it --rm ryanmaclean/vibecode-codeserver:standard bash -c "vim --version && nvim --version && aider --version && goose version"
```

## 📈 Success Metrics

- ✅ All 5 profiles build successfully
- ✅ All profiles < expected size (minimal 400MB, standard 700MB, etc.)
- ✅ All required tools verified (vim, nvim, aider, goose)
- ✅ All VS Code extensions working
- ✅ Images available on both GHCR and Docker Hub
- ✅ Deployed to Synology NAS
- ✅ Documentation complete

## 🔗 Related Files

- `docker/code-server/Dockerfile` - Main Dockerfile
- `docker/code-server/profiles/*.txt` - Profile configs
- `scripts/build-profiles.sh` - Build script
- `docker/code-server/PROFILES.md` - User documentation
- `docker/code-server/DEPLOYMENT_REPORT.md` - Deployment details
- `.github/ISSUE_TEMPLATE/code-server-v1.1.0-multi-profile.md` - Issue template

## 📅 Timeline

- **2025-10-01 01:00 UTC**: Started - Dockerfile fixes
- **2025-10-01 02:00 UTC**: Target - Local build test complete
- **2025-10-01 04:00 UTC**: Target - All profiles built and pushed
- **2025-10-01 06:00 UTC**: Target - Documentation complete
- **2025-10-01 08:00 UTC**: Target - Testing complete

## ✅ Definition of Done

All tasks in Phase 1-5 complete, all success metrics met, deployed to production.
