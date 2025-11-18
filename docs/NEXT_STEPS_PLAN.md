# Next Steps Plan - Post Datadog Integration

## ✅ Recently Completed

1. **Datadog Input/Output Capture**
   - Fixed CrewAI traces showing "No content"
   - Implemented explicit LLMObs annotations
   - Executed full 4-agent demo successfully
   - Created verification tools and documentation

2. **VM Bootloader Fixes**
   - Fixed bootloader issues for all 6 VMs
   - Created setup scripts for new contributors
   - Documented VM management process

## 🎯 Next Priority Steps

### Priority 1: Build Process Improvement
**Status**: `build-vibecode.sh` is simple, needs enhancement

**Current State**:
- `scripts/build-vibecode.sh`: Only builds Swift code
- `scripts/build-tauri-with-vms.sh`: Builds Tauri app with VMs
- No unified build process

**Action Items**:
1. [ ] Create comprehensive build script that handles:
   - Swift VM manager build
   - Next.js frontend build (if needed)
   - Tauri app build
   - Code signing
   - Bundle creation
2. [ ] Test complete build process
3. [ ] Document build requirements and dependencies

### Priority 2: VM Services Installation
**Status**: Bootloaders fixed, services need installation

**Current State**:
- All 6 VMs boot successfully
- Services not yet installed in VMs:
  - PostgreSQL (postgresql VM)
  - Valkey (valkey VM)
  - Node.js server (nodejs VM)
  - OpenVSCode (codeserver VM)

**Action Items**:
1. [ ] Install PostgreSQL in postgresql VM
2. [ ] Install Valkey in valkey VM
3. [ ] Install Node.js + test server in nodejs VM
4. [ ] Install code-server in codeserver VM
5. [ ] Verify all services accessible from host
6. [ ] Update cloud-init configs for reproducibility

### Priority 3: Frontend AI Panel
**Status**: Backend exists, UI missing

**Current State**:
- AI Manager backend implemented (`src-tauri/src/ai/manager.rs`)
- AI Commands available (`src-tauri/src/ai/commands.rs`)
- MCP Manager ready (`src-tauri/src/ai/mcp.rs`)
- **Missing**: Frontend React components

**Action Items**:
1. [ ] Create AI Panel component
2. [ ] Build Chat interface
3. [ ] Add Code completion UI
4. [ ] Create Settings panel
5. [ ] Wire up Tauri commands
6. [ ] Add event listeners for streaming

### Priority 4: Testing & Verification
**Status**: Many features implemented, need tests

**Action Items**:
1. [ ] Verify Datadog traces show input/output in UI
2. [ ] Test VM service connectivity
3. [ ] Test Tauri app VM control
4. [ ] Run end-to-end workflow tests
5. [ ] Verify build produces working app

### Priority 5: Documentation & Polish
**Action Items**:
1. [ ] Update README with latest features
2. [ ] Document build process
3. [ ] Create user guide for VM management
4. [ ] Document AI Panel usage
5. [ ] Add examples and tutorials

## 📋 Recommended Order

1. **Build Process** (1-2 hours)
   - Quick win, improves developer experience
   - Enables easier testing and deployment

2. **VM Services** (2-3 hours)
   - Completes the VM infrastructure work
   - Makes VMs actually useful

3. **Frontend AI Panel** (4-6 hours)
   - Adds visible feature
   - Uses existing backend

4. **Testing** (Ongoing)
   - Verify everything works
   - Catch issues early

5. **Documentation** (Ongoing)
   - Keep docs up to date
   - Help other contributors

## 🚀 Starting Point

Based on user looking at `build-vibecode.sh`, let's start with **Priority 1: Build Process Improvement**.

