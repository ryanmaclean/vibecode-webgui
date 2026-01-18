# Backend Decision: OpenVSCode Server

**Date:** October 28, 2025
**Status:** ✅ APPROVED - Moving forward with openvscode-server
**Repository:** vibecode-webgui

---

## Executive Summary

After comprehensive evaluation, **openvscode-server** has been chosen as the definitive IDE backend for VibeCode. The code-server submodule will be removed to eliminate maintenance duplication and clarify the product's direction.

## Decision Rationale

### Why openvscode-server wins:

1. **Native macOS Integration** ⭐⭐⭐
   - Rust CLI with macOS-specific code (`cli/src/tunnels/service_macos.rs`, `cli/src/tunnels/nosleep_macos.rs`)
   - Native service integration and power management
   - Darwin-specific resources and build pipelines
   - Better foundation for Swift 5 FFI integration

2. **Virtualization Framework Compatibility** ⭐⭐⭐
   - Rust CLI can be compiled as native library for VM integration
   - Native compilation path proven via Azure Pipelines
   - Can run in VM or host OS with vfkit
   - Better isolation model for multi-tenant scenarios

3. **No Docker Requirement** ⭐⭐⭐
   - Native macOS build with Xcode + Rust toolchain
   - Swift 5 + Rust interop is well-documented
   - Aligns with existing vfkit + Virtualization Framework SDK approach

4. **Architecture Advantage**
   - Native Rust CLI layer (not just Node.js wrapper)
   - More control over native integrations
   - Existing macOS-specific code to build upon
   - Better performance characteristics

5. **Active Development & Rebrand Path**
   - Gitpod actively maintains it (regular security updates)
   - Proven rebrand capability (Gitpod's own customizations)
   - `product.json` for centralized branding
   - MIT licensed, fork-friendly

### Why code-server was not chosen:

- Node.js wrapper architecture with limited native layer
- No existing Rust CLI components
- Less control over native macOS features
- Would require custom Swift wrapper (more work)
- Smaller footprint (2.3MB) but less extensible

---

## Implementation Plan

### Phase 1: Removal & Cleanup (Week 1) 🔄 IN PROGRESS

**Tasks:**
- [x] Document decision and rationale
- [ ] Remove code-server submodule
- [ ] Clean up build scripts referencing code-server
- [ ] Update documentation to reflect openvscode-server only
- [ ] Update README with clear backend choice

**Files to modify:**
- `.gitmodules` - remove code-server entry
- `docs/CODE_SERVER_COMPARISON.md` - archive or mark as historical
- `scripts/initramfs-builder/build-openvscode.sh` - finalize for openvscode only
- `README.md` - clarify IDE backend

### Phase 2: Build Stabilization (Week 1-2)

**Build Requirements:**
- Node.js 18 LTS or 20 LTS (v24 has native module compatibility issues)
- Rust 1.90+ (cargo + rustc)
- Xcode Command Line Tools
- ~16GB disk space for compilation

**Tasks:**
- [ ] Test build with Node 20 LTS
- [ ] Document successful build process
- [ ] Create reproducible build environment (vfkit VM or native)
- [ ] Verify Rust CLI compilation on Apple Silicon

### Phase 3: Rebrand (Week 2-4)

**Tasks:**
- [ ] Fork openvscode-server or work from submodule
- [ ] Update `product.json` with VibeCode branding
- [ ] Customize resources (icons, logos, splash screens)
- [ ] Rebrand Rust CLI for VibeCode
- [ ] Test rebranded build

**Branding locations:**
- `product.json` - Product name, publisher, version
- `resources/darwin/` - macOS-specific resources
- `cli/src/` - CLI branding and defaults
- Extension marketplace configuration (Open-VSX)

### Phase 4: Swift 5 Integration (Week 4-6)

**Tasks:**
- [ ] Create Swift wrapper for Rust CLI
- [ ] Test Swift-Rust FFI bridge
- [ ] Integrate with Virtualization Framework SDK
- [ ] Build native macOS .app bundle
- [ ] Test webkit rendering integration (Tauri compatibility)

**Architecture:**
```
┌─────────────────────────────────────┐
│     VibeCode (Swift 5)              │
│                                     │
│  ┌────────────────────────────┐   │
│  │   Virtualization Framework  │   │
│  │   (Native macOS SDK)        │   │
│  └────────────────────────────┘   │
│              ↓                      │
│  ┌────────────────────────────┐   │
│  │   Swift <-> Rust FFI       │   │
│  └────────────────────────────┘   │
│              ↓                      │
│  ┌────────────────────────────┐   │
│  │   OpenVSCode Server        │   │
│  │   (Rust CLI + Node.js)     │   │
│  └────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Phase 5: Authentication & Security (Week 6-8)

**Note:** openvscode-server does NOT have built-in authentication like code-server. This must be implemented.

**Tasks:**
- [ ] Design authentication strategy (auth proxy, JWT, OAuth)
- [ ] Implement authentication layer
- [ ] Configure TLS/HTTPS (can use Caddy or nginx as reverse proxy)
- [ ] Security audit of exposed endpoints
- [ ] Document security configuration

**Options:**
1. **Caddy reverse proxy** - Automatic HTTPS, simple auth
2. **Custom Swift auth layer** - Native integration with VibeCode
3. **OAuth/OIDC** - Enterprise-ready authentication

### Phase 6: UI/Dashboard (Week 8-10)

**Goal:** Create lightweight dashboard for workspace management, not duplicate IDE functionality.

**Features:**
- Project/workspace listing
- Quick launch buttons
- Settings management
- Extension management (Open-VSX integration)
- User profile and preferences

**Implementation:**
- Thin React/Svelte dashboard
- Backend API for workspace management
- Integration with openvscode-server API

---

## Extension Management

**Important:** openvscode-server (like all non-Microsoft forks) cannot use Microsoft's marketplace and must rely on **Open-VSX**.

**Open-VSX Registry:**
- URL: https://open-vsx.org
- Community-driven extension registry
- Most popular VS Code extensions available
- MIT licensed, self-hostable

**Configuration:**
```json
// product.json
{
  "extensionsGallery": {
    "serviceUrl": "https://open-vsx.org/vscode/gallery",
    "itemUrl": "https://open-vsx.org/vscode/item"
  }
}
```

---

## Build Notes

### Current Status:
- ✅ vfkit v0.6.1 installed at `src-tauri/resources/vfkit-aarch64-apple-darwin`
- ✅ Rust 1.90.0 installed (cargo + rustc)
- ⚠️ Node v24.10.0 has native module compatibility issues (tree-sitter)
- 🔄 Recommend downgrading to Node 18 LTS or 20 LTS

### Node.js Version Issue:

Node v24.10.0 causes tree-sitter native module compilation to fail:
```
error: unknown type name 'concept'
```

**Solution:** Use Node LTS version:
```bash
nvm install 20
nvm use 20
cd openvscode-server
npm install
npm run compile
```

### Build Commands:

**Full native build:**
```bash
cd openvscode-server

# Install dependencies (with Node 18/20 LTS)
npm install

# Compile TypeScript/JavaScript
npm run compile

# Build Rust CLI
cd cli
cargo build --release

# Test
./cli/target/release/code serve-web --port 8081 --host 0.0.0.0
```

**Access at:** http://localhost:8081

---

## Repository Cleanup

### To Remove:
- `code-server/` submodule
- References to code-server in build scripts
- Dual-backend ambiguity in documentation

### To Keep:
- `openvscode-server/` submodule (shallow clone)
- `config/vfkit/openvscode-build-vm.yaml`
- `scripts/initramfs-builder/build-openvscode.sh`
- `docs/CODE_SERVER_COMPARISON.md` (as historical reference)

---

## Success Metrics

### Phase 1 Complete:
- [ ] code-server submodule removed
- [ ] Documentation updated and unambiguous
- [ ] Single clear IDE backend

### Phase 2 Complete:
- [ ] Successful native build on macOS
- [ ] Reproducible build process documented
- [ ] Binary artifacts generated and tested

### Phase 3 Complete:
- [ ] VibeCode-branded build
- [ ] Custom icons and splash screens
- [ ] Open-VSX integration configured

### Phase 4 Complete:
- [ ] Swift wrapper functional
- [ ] Rust FFI bridge tested
- [ ] Native .app bundle created

### Phase 5 Complete:
- [ ] Authentication implemented
- [ ] HTTPS/TLS configured
- [ ] Security audit passed

### Phase 6 Complete:
- [ ] Dashboard UI functional
- [ ] Workspace management working
- [ ] Extension management via Open-VSX

---

## References

- **openvscode-server:** https://github.com/gitpod-io/openvscode-server
- **code-server (removed):** https://github.com/coder/code-server
- **Swift-Rust FFI:** https://github.com/chinedufn/swift-bridge
- **macOS Virtualization Framework:** https://developer.apple.com/documentation/virtualization
- **Open-VSX Registry:** https://open-vsx.org
- **Comparison Document:** [docs/CODE_SERVER_COMPARISON.md](./CODE_SERVER_COMPARISON.md)
- **Build Script:** [scripts/initramfs-builder/build-openvscode.sh](../scripts/initramfs-builder/build-openvscode.sh)
- **VM Configuration:** [config/vfkit/openvscode-build-vm.yaml](../config/vfkit/openvscode-build-vm.yaml)

---

## Next Immediate Steps

1. **Remove code-server submodule:**
   ```bash
   git submodule deinit -f code-server
   git rm -f code-server
   rm -rf .git/modules/code-server
   git commit -m "chore: remove code-server submodule - standardize on openvscode-server"
   ```

2. **Update Node.js version:**
   ```bash
   nvm install 20
   nvm use 20
   node --version  # Verify v20.x.x
   ```

3. **Test openvscode-server build:**
   ```bash
   ./scripts/initramfs-builder/build-openvscode.sh --native
   ```

4. **Update documentation:**
   - README.md - clarify backend choice
   - wiki/ultrathinking-critical-discoveries.md - add Phase 3 (backend decision)
   - Update any remaining dual-backend references

---

**Decision Made By:** Technical analysis + agent recommendation
**Approved:** October 28, 2025
**Implementation:** In progress (Phase 1)
