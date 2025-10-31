# VibeCode Quick Start Guide
**Get Up and Running in 5 Minutes**

**Version:** 1.0
**Last Updated:** October 28, 2025
**Audience:** New developers, contributors, and users

---

## What is VibeCode?

VibeCode is a **native macOS development environment** built on OpenVSCode Server with Swift 5 + Rust FFI integration. Think of it as VS Code, but:
- 🍎 **Native to macOS** - Built with Swift 5 and the Virtualization Framework SDK
- 🦀 **Rust-powered** - Native Rust CLI for performance
- 🚫 **No Docker** - Direct native integration with vfkit
- 🤖 **AI-assisted** - 321+ models via OpenRouter
- 🔐 **Secure** - Enterprise-grade authentication with Touch ID support

---

## Quick Architecture Overview

```
┌──────────────────────────────────────────┐
│  VibeCode Desktop App (Swift 5)         │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  WKWebView (webkit)                │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐ │ │
│  │  │  OpenVSCode Server           │ │ │
│  │  │  (Rust CLI + Node.js)        │ │ │
│  │  └──────────────────────────────┘ │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Virtualization Framework SDK      │ │
│  │  (vfkit for VM management)         │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## Prerequisites

### Required Software

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | v22.15.1+ | `nvm install 22` |
| **npm** | v10.9.4+ | Comes with Node.js |
| **Rust** | 1.90.0+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Git** | Any recent version | Comes with macOS / `brew install git` |
| **Xcode Command Line Tools** | Latest | `xcode-select --install` |

### Optional (but recommended)

| Tool | Purpose | Installation |
|------|---------|--------------|
| **nvm** | Node version management | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh \| bash` |
| **Homebrew** | Package management | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |

### System Requirements
- **macOS:** 10.13+ (High Sierra) - Apple Silicon or Intel
- **RAM:** 8 GB minimum, 16 GB recommended
- **Disk Space:** 20 GB free (for build artifacts)
- **Internet:** Required for initial setup

---

## Installation Options

Choose your path:

### Option 1: Download Pre-Built Binary (Coming Soon)
```bash
# Download latest release
curl -LO https://github.com/ryanmaclean/vibecode-webgui/releases/latest/download/VibeCode.dmg

# Mount and install
open VibeCode.dmg
# Drag VibeCode.app to Applications folder
```

### Option 2: Build from Source (Current Method)

#### Step 1: Clone Repository
```bash
cd ~/Projects  # Or your preferred directory
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

#### Step 2: Setup Environment
```bash
# Install Node.js 22 LTS
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22

# Verify versions
node --version  # Should show v22.15.1 or later
npm --version   # Should show v10.9.4 or later

# Setup Rust
source ~/.cargo/env
rustc --version # Should show 1.90.0 or later
```

#### Step 3: Install Dependencies
```bash
# Install root dependencies
npm install --legacy-peer-deps

# This will take 2-3 minutes
```

#### Step 4: Build OpenVSCode Server
```bash
# Run the build script
./scripts/vfkit/build-openvscode.sh --native

# Expected output:
# ✓ Building OpenVSCode Server (native mode)
# ✓ Installing dependencies... (96s)
# ✓ Compiling TypeScript... (55s)
# ✓ Building Rust CLI... (85s)
# ✓ Build complete! Binary at openvscode-server/cli/target/release/code
# ✓ Total time: 4m 17s
```

#### Step 5: Test the Server
```bash
# Start the server (test mode, no auth)
./openvscode-server/cli/target/release/code serve-web \
  --port 8081 \
  --host 127.0.0.1 \
  --without-connection-token

# Expected output:
# Web UI available at http://127.0.0.1:8081

# Open browser to http://127.0.0.1:8081
# You should see the VS Code interface!
```

---

## First Run

### 1. Launch VibeCode Desktop App (When Available)
```bash
# If built as .app bundle
open /Applications/VibeCode.app

# Or from command line (development)
npm run tauri:dev
```

### 2. First-Time Setup Wizard
On first launch, you'll see:
1. **Welcome Screen** - Introduction to VibeCode
2. **Authentication Setup** - Choose your method:
   - Local password (with Touch ID)
   - GitHub OAuth
   - Google OAuth
   - Apple Sign In
3. **Dashboard** - Workspace management interface

### 3. Create Your First Workspace
1. Click **"+ New Workspace"**
2. Choose:
   - **Empty Workspace** - Start from scratch
   - **Template** - Select from 50+ pre-configured projects:
     - Python ML/Data Science
     - React/Next.js Web App
     - Node.js API
     - Rust Project
     - Go Microservice
3. Enter:
   - **Name:** "my-first-project"
   - **Description:** Optional
   - **Resources:** CPU (2 cores), RAM (4 GB)
4. Click **"Create"**
5. IDE launches automatically!

---

## Basic Usage

### Opening a Workspace

#### From Dashboard
1. Launch VibeCode
2. See **Recent Workspaces** at top
3. Click **"Open"** on any workspace with 🟢 (running)
4. Click **"Start"** on any workspace with ⚪ (stopped)

#### From Command Line (Coming Soon)
```bash
vibecode open ~/Projects/my-project
```

### Working in the IDE

VibeCode uses the familiar VS Code interface:

| Action | Shortcut | Description |
|--------|----------|-------------|
| **Command Palette** | `Cmd+Shift+P` | Access all commands |
| **Quick Open** | `Cmd+P` | Open files quickly |
| **Find in Files** | `Cmd+Shift+F` | Search across project |
| **Terminal** | `Ctrl+`` | Open integrated terminal |
| **Git** | `Ctrl+Shift+G` | Source control |
| **Extensions** | `Cmd+Shift+X` | Manage extensions |

### Installing Extensions

1. Click **Extensions icon** (4 squares) in left sidebar
2. Search Open-VSX registry
3. Click **"Install"**
4. Extension applies to all workspaces

**Popular Extensions:**
- Python (Microsoft)
- ESLint (Dirk Baeumer)
- Prettier (Code formatter)
- GitLens (Enhanced Git)
- Thunder Client (API testing)

### Managing Workspaces

#### List All Workspaces
- From **Dashboard:** See "All Workspaces" section
- **Search & Filter:** Type workspace name in search bar

#### Workspace Actions
- **Start:** Click "Start" button (if stopped)
- **Stop:** Click "Stop" button (if running)
- **Delete:** Click "..." menu → "Delete" → Confirm
- **Settings:** Click "..." menu → "Settings" → Configure CPU/RAM

---

## Common Tasks

### Task 1: Open Existing Project
```bash
# Option A: Via Dashboard
1. Launch VibeCode
2. Click "+ New Workspace"
3. Choose "Open Existing Folder"
4. Navigate to ~/Projects/my-existing-project
5. Click "Open"

# Option B: Via CLI (coming soon)
vibecode open ~/Projects/my-existing-project
```

### Task 2: Clone Git Repository
```bash
1. Open VibeCode
2. Cmd+Shift+P → "Git: Clone"
3. Enter repo URL: https://github.com/username/repo.git
4. Choose destination folder
5. Click "Open" when clone completes
```

### Task 3: Run a Build
```bash
# In integrated terminal (Ctrl+`)
npm run build
# or
cargo build --release
# or
python setup.py install
```

### Task 4: Debug Code
```bash
1. Set breakpoints (click left of line number)
2. Press F5 or Run → Start Debugging
3. Choose debugger (Node.js, Python, etc.)
4. Debug console opens automatically
```

### Task 5: Install AI Assistant Extension
```bash
1. Cmd+Shift+X (Extensions)
2. Search "VibeCode AI Assistant"
3. Click "Install"
4. Configure API key in Settings
5. Cmd+I to invoke AI chat
```

---

## Troubleshooting

### Build Fails: "Please use Node.js v22.15.1 or later"
```bash
# Switch to Node 22
source ~/.nvm/nvm.sh
nvm use 22
node --version  # Verify v22.15.1+

# Rebuild
cd openvscode-server
rm -rf node_modules
npm install
```

### Build Fails: "cargo: command not found"
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add to shell profile
echo 'source ~/.cargo/env' >> ~/.zshrc
source ~/.cargo/env

# Verify
rustc --version  # Should show 1.90.0+
```

### Server Won't Start: "Address already in use (os error 48)"
```bash
# Find process using port 8081
lsof -ti:8081

# Kill the process
lsof -ti:8081 | xargs kill -9

# Or use different port
./openvscode-server/cli/target/release/code serve-web --port 9999
```

### IDE Loads But No Syntax Highlighting
```bash
# Install language extension
1. Cmd+Shift+X
2. Search for your language (e.g., "Python")
3. Install official extension
4. Reload window (Cmd+R)
```

### Touch ID Not Working
```bash
# Check System Settings
1. System Settings → Touch ID & Password
2. Verify Touch ID is enabled
3. Add fingerprint if missing

# Check VibeCode Settings
1. Settings → Security → Enable Biometric Authentication
2. Toggle on
3. Restart VibeCode
```

### Extensions Won't Install
```bash
# Verify Open-VSX connection
1. Settings → Extensions
2. Check "Extension Registry URL": https://open-vsx.org
3. Test connection: https://open-vsx.org (should load in browser)

# Clear extension cache
rm -rf ~/.vibecode/extensions/.cache
```

---

## Configuration

### User Settings Location
```
macOS: ~/Library/Application Support/com.vibecode.app/settings.json
Linux: ~/.config/vibecode/settings.json
```

### Common Settings
```json
{
  "editor.fontSize": 14,
  "editor.fontFamily": "Menlo, Monaco, 'Courier New', monospace",
  "editor.tabSize": 2,
  "workbench.colorTheme": "Dark+ (default dark)",
  "terminal.integrated.shell.osx": "/bin/zsh",
  "ai.provider": "openrouter",
  "ai.model": "anthropic/claude-3-sonnet",
  "vm.defaultCPU": 2,
  "vm.defaultRAM": 4096
}
```

### Environment Variables
```bash
# ~/.zshrc or ~/.bashrc

# OpenVSCode Server
export VSCODE_AGENT_FOLDER="$HOME/.vibecode"

# Authentication (if using OAuth)
export GITHUB_CLIENT_ID="your_client_id"
export GITHUB_CLIENT_SECRET="your_secret"

# AI Provider
export OPENROUTER_API_KEY="your_key"
```

---

## Next Steps

### Learn More
- 📖 [Full Documentation](./README.md)
- 🏗️ [Architecture Overview](./ARCHITECTURE_DIAGRAM.md)
- 🛠️ [Build Guide](./BUILD_STATUS.md)
- 🔐 [Authentication Setup](../security/AUTHENTICATION_STRATEGY.md)
- 📊 [Dashboard Usage](./DASHBOARD_DESIGN.md)

### Get Involved
- 🐛 [Report Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- 💬 [Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- 🤝 [Contributing Guide](../CONTRIBUTING.md)
- 📝 [Changelog](../CHANGELOG.md)

### Community
- 💬 Discord: Coming soon
- 🐦 Twitter: [@vibecode_dev](https://twitter.com/vibecode_dev)
- 📧 Email: hello@vibecode.dev

---

## Frequently Asked Questions

### Q: Is VibeCode free?
**A:** Yes, VibeCode is open-source (MIT licensed) and free to use.

### Q: Can I use Microsoft's extension marketplace?
**A:** No. Due to Microsoft's terms of service, VibeCode uses [Open-VSX](https://open-vsx.org), a community-driven extension registry with most popular extensions.

### Q: How is this different from VS Code?
**A:** VibeCode is built on OpenVSCode Server (not official VS Code) with:
- Native macOS integration (Swift 5 + Rust)
- Built-in VM management (Virtualization Framework)
- No Electron (lighter, faster on macOS)
- Custom authentication layer
- AI assistance out-of-the-box

### Q: Can I use VibeCode with my existing VS Code settings?
**A:** Yes! VibeCode reads VS Code settings. Copy `~/.vscode/settings.json` to `~/.vibecode/settings.json`.

### Q: Does it work offline?
**A:** Yes. Desktop mode works fully offline. OAuth-based authentication requires internet for initial login, then works offline with cached credentials.

### Q: Can I migrate my workspaces to another machine?
**A:** Yes. Workspaces are stored in `~/.vibecode/workspaces/`. Copy this folder to another Mac running VibeCode.

### Q: What about Windows/Linux support?
**A:** Currently macOS-focused. Linux support planned (Q2 2026). Windows support under evaluation.

### Q: How do I update VibeCode?
**A:** Auto-updates will be available in v1.1. Currently: Download latest release and replace app.

---

## Quick Reference Card

### Essential Shortcuts

| Action | Shortcut |
|--------|----------|
| Command Palette | `Cmd+Shift+P` |
| Quick Open File | `Cmd+P` |
| Find in Files | `Cmd+Shift+F` |
| Terminal Toggle | ``Ctrl+` `` |
| Extensions | `Cmd+Shift+X` |
| Source Control | `Ctrl+Shift+G` |
| Settings | `Cmd+,` |
| Keyboard Shortcuts | `Cmd+K Cmd+S` |

### CLI Commands (Coming Soon)
```bash
vibecode open <path>       # Open workspace
vibecode create <name>     # Create workspace
vibecode start <name>      # Start workspace
vibecode stop <name>       # Stop workspace
vibecode list              # List workspaces
vibecode extensions        # Manage extensions
vibecode --help            # Full help
```

---

## Getting Help

### Documentation
- 📚 [Full Docs](./README.md) - Complete documentation index
- 🗺️ [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - Current progress
- 🏗️ [Architecture](./ARCHITECTURE_DIAGRAM.md) - System architecture

### Support Channels
1. **GitHub Issues** - Bug reports and feature requests
2. **GitHub Discussions** - Questions and community help
3. **Documentation** - Search docs first!

### Debug Logs
```bash
# View logs
tail -f ~/Library/Logs/VibeCode/main.log

# Verbose logging
vibecode --verbose

# Debug mode
export DEBUG=vibecode:*
vibecode
```

---

**Welcome to VibeCode! Happy coding!** 🚀

---

**Document Version:** 1.0
**Last Updated:** October 28, 2025
**Maintained By:** VibeCode Team
