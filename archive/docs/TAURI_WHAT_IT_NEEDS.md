# What Does the Tauri App Really Need?

## Current Reality Check

Looking at the Tauri app (`src-tauri/src/commands.rs` and `src-tauri/src/main.rs`), here's what it **actually does**:

### ✅ What It HAS (Actually Implemented)

1. **code-server** - ✅ CRITICAL
   - Starts code-server on port 8080
   - Looks for bundled binary in app Resources/
   - Falls back to system installation
   - **This is the core product**

2. **Docker commands** - ✅
   - `check_docker()` - Check if Docker is available
   - `get_docker_version()` - Get Docker version
   - `get_docker_status()` - Get Docker status
   - `start_containers()` - Start Docker containers
   - `stop_containers()` - Stop containers
   - `restart_containers()` - Restart containers

3. **VM Commands (Lima/vfkit)** - ✅
   - `start_lima_vm()` - Start Lima VM
   - `stop_lima_vm()` - Stop Lima VM
   - `status_lima_vm()` - Get Lima status
   - `start_vfkit_vm()` - Start vfkit VM

4. **mDNS/Bonjour** - ✅
   - `start_mdns_service()` - Advertise session
   - `discover_vibecode_sessions()` - Find other sessions
   - `stop_mdns_service()` - Stop advertising

5. **Browser launcher** - ✅
   - `launch_browser(url)` - Open URL in default browser
   - `open_browser_window()` - Open browser window
   - `navigate_to(url)` - Navigate to URL

6. **AI commands** - ✅ (In src-tauri/src/ai/commands.rs)
   - `ai_chat()` - AI chat
   - `ai_complete()` - Code completion
   - `ai_explain()` - Code explanation
   - `ai_list_models()` - List AI models
   - `ai_chat_stream()` - Streaming chat
   - MCP (Model Context Protocol) commands
   - Agent orchestration commands

### ❌ What It DOESN'T Have

1. **git** - ❌
   - No git integration commands
   - VS Code extension handles git

2. **mc (Midnight Commander)** - ❌
   - Not needed - code-server has integrated file browser
   - VS Code has built-in file explorer

3. **wetty (Web TTY)** - ❌
   - Not needed - code-server has integrated terminal
   - VS Code has built-in terminal

## The Truth

**VibeCode = code-server + Tauri wrapper**

That's it. Nothing more.

### What code-server Provides (VS Code in Browser)

VS Code already includes:
- ✅ **File manager** - Integrated file browser
- ✅ **Terminal** - Integrated terminal (no need for wetty)
- ✅ **Git integration** - Built-in git commands
- ✅ **Extensions** - Full VS Code extension marketplace

So we don't need:
- ❌ **mc** - VS Code has better file browser
- ❌ **wetty** - VS Code has integrated terminal
- ❌ **git** - VS Code has built-in git

### What the Tauri App Provides

The Tauri app just wraps code-server with:
1. Native desktop app
2. System tray integration
3. Easy launcher (no command line needed)
4. Optional extras (Docker, VM, mDNS commands)

## What It REALLY Needs

### Core (Don't Remove)

1. **code-server** - ✅ ESSENTIAL
   - Without this, there's no app

### Nice to Have (Keep These)

2. **Docker commands** - ✅ KEEP
   - Useful for development workflows
   - Start/stop dev containers

3. **mDNS/Bonjour** - ✅ KEEP
   - Makes it easy to find other VibeCode sessions on network
   - Good for collaboration

4. **VM commands** - ✅ KEEP
   - Useful for Lima/vfkit development
   - Running VMs for testing

5. **AI commands** - ✅ KEEP
   - Core feature - AI assistant
   - MCP integration

### Don't Add These

1. ❌ **git** - Already in VS Code
2. ❌ **mc** - Already in VS Code
3. ❌ **wetty** - Already in VS Code

## Recommendations

### 1. Simplify the README

Current README is cluttered. It should say:

```markdown
# VibeCode

Native desktop app wrapping code-server.

**What it is**: VS Code in a browser, wrapped with Tauri for native desktop.

**Features**:
- VS Code with full extension support
- Integrated terminal (no wetty needed)
- Built-in git (no extra tools needed)
- File browser (no mc needed)
- AI Assistant extension

That's it.
```

### 2. Remove Unused Commands

If you're not using them, remove:
- VM commands (if not needed for your workflow)
- Docker commands (if not needed)
- mDNS commands (if not collaborating)

Keep only what you use.

### 3. Focus on the Core

The core is **code-server**. Everything else is optional.

The Tauri app is just a wrapper that:
1. Launches code-server
2. Provides a native desktop experience
3. Adds AI features via extension

That's all it needs to be.

## Summary

**What does the Tauri app need?**

✅ **code-server** - The only essential component
✅ **VS Code extension** - Adds AI features
❌ **git** - Not needed (VS Code has it)
❌ **mc** - Not needed (VS Code has it)
❌ **wetty** - Not needed (VS Code has it)

The Tauri app just wraps code-server. Keep it simple.
