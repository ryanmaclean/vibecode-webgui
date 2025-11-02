# VibeCode Desktop - User Installation Guide

**Version:** 1.0.0
**Last Updated:** November 1, 2025
**Platform Support:** macOS, Linux, Windows

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
   - [macOS Installation](#macos-installation)
   - [Linux Installation](#linux-installation)
   - [Windows Installation](#windows-installation)
4. [First Launch](#first-launch)
5. [Configuration](#configuration)
6. [Features Overview](#features-overview)
7. [Troubleshooting](#troubleshooting)
8. [Uninstallation](#uninstallation)
9. [FAQ](#faq)
10. [Support](#support)

---

## Introduction

VibeCode Desktop is a native desktop application that brings AI-powered development tools to your computer. Built with Tauri 2.9.1, it combines the power of OpenVSCode Server with native system integration, offering:

- **Native Performance** - Rust + Swift backend for minimal resource usage
- **AI Integration** - 321+ AI models for code completion, review, and generation
- **VM Management** - Native virtualization on macOS via Apple Virtualization Framework
- **Cross-Platform** - Works on macOS, Linux, and Windows
- **Privacy-First** - No telemetry, local-first architecture

This guide will walk you through installation, configuration, and basic usage.

---

## System Requirements

### Minimum Requirements

#### macOS
- **OS Version:** macOS 13.0 (Ventura) or later
- **Processor:** Intel Core i5 or Apple M1 (or newer)
- **RAM:** 4GB (8GB recommended)
- **Storage:** 1GB free space (plus 10-50GB per VM if using VM features)
- **Display:** 1280x720 minimum resolution

#### Linux
- **Distribution:** Ubuntu 20.04+, Debian 11+, Fedora 35+, or equivalent
- **Processor:** x86_64 or ARM64 (2+ cores recommended)
- **RAM:** 4GB (8GB recommended)
- **Storage:** 1GB free space
- **Libraries:** GTK 3.24+, WebKit2GTK 4.1+
- **Display:** 1280x720 minimum resolution

#### Windows
- **OS Version:** Windows 10 (build 1809) or Windows 11
- **Processor:** Intel Core i5 or AMD equivalent (2+ cores)
- **RAM:** 4GB (8GB recommended)
- **Storage:** 1GB free space
- **WebView2:** Automatically installed if missing
- **Display:** 1280x720 minimum resolution

### Recommended Requirements

For optimal performance, especially when using VMs or AI features:

- **RAM:** 16GB or more
- **Storage:** SSD with 100GB+ free space
- **Processor:** 4+ cores (6+ for VMs)
- **Network:** Broadband internet connection for AI model access

### Additional Requirements for VM Features (macOS only)

- **macOS 13.0+** required for Apple Virtualization Framework
- **8GB+ RAM** to run VMs comfortably
- **50-100GB** free storage per VM
- **Virtualization enabled** (enabled by default on Apple Silicon, check BIOS on Intel)

---

## Installation

### macOS Installation

#### Method 1: DMG Installer (Recommended)

1. **Download the DMG**
   - Visit the [Releases page](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)
   - Download `VibeCode-{version}.dmg`
   - Choose the correct architecture:
     - `VibeCode-{version}-aarch64.dmg` for Apple Silicon (M1/M2/M3/M4)
     - `VibeCode-{version}-x64.dmg` for Intel Macs
     - `VibeCode-{version}-universal.dmg` for both (larger file)

2. **Open the DMG**
   - Double-click the downloaded DMG file
   - A new window will open showing the VibeCode application

3. **Install the Application**
   - Drag the `VibeCode.app` icon to the `Applications` folder shortcut
   - Wait for the copy to complete (may take 10-30 seconds)

4. **Eject the DMG**
   - Right-click the mounted DMG in Finder sidebar
   - Select "Eject"

5. **Launch VibeCode**
   - Open your Applications folder
   - Locate `VibeCode.app`
   - **First launch:** Right-click the app and select "Open" (this bypasses Gatekeeper)
   - Click "Open" in the security dialog
   - **Subsequent launches:** Double-click normally

#### Method 2: App Bundle (tar.gz)

1. **Download the Archive**
   - Download `VibeCode.app.tar.gz` from the Releases page

2. **Extract the Archive**
   ```bash
   # Navigate to Downloads folder
   cd ~/Downloads

   # Extract the archive
   tar -xzf VibeCode.app.tar.gz
   ```

3. **Move to Applications**
   ```bash
   mv VibeCode.app /Applications/
   ```

4. **Launch**
   - Open from Applications folder (right-click + Open on first launch)

#### Homebrew Cask (Future Release)

*Coming soon:*
```bash
brew install --cask vibecode
```

### Linux Installation

#### Debian/Ubuntu (.deb)

1. **Download the Package**
   ```bash
   wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.0.0/vibecode_1.0.0_amd64.deb
   ```

2. **Install**
   ```bash
   sudo dpkg -i vibecode_1.0.0_amd64.deb

   # If there are dependency issues:
   sudo apt-get install -f
   ```

3. **Launch**
   ```bash
   vibecode
   # Or launch from application menu
   ```

#### Fedora/RHEL/CentOS (.rpm)

1. **Download the Package**
   ```bash
   wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.0.0/vibecode-1.0.0-1.x86_64.rpm
   ```

2. **Install**
   ```bash
   sudo rpm -i vibecode-1.0.0-1.x86_64.rpm
   # Or use dnf:
   sudo dnf install vibecode-1.0.0-1.x86_64.rpm
   ```

3. **Launch**
   ```bash
   vibecode
   ```

#### AppImage (Universal)

1. **Download the AppImage**
   ```bash
   wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.0.0/vibecode_1.0.0_amd64.AppImage
   ```

2. **Make Executable**
   ```bash
   chmod +x vibecode_1.0.0_amd64.AppImage
   ```

3. **Run**
   ```bash
   ./vibecode_1.0.0_amd64.AppImage
   ```

4. **Optional: Integrate with Desktop**
   ```bash
   # Install AppImageLauncher for desktop integration
   # Ubuntu/Debian:
   sudo add-apt-repository ppa:appimagelauncher-team/stable
   sudo apt update
   sudo apt install appimagelauncher

   # Then run the AppImage - it will prompt to integrate
   ```

#### Arch Linux (AUR)

*Community package coming soon*

### Windows Installation

#### Method 1: MSI Installer (Recommended)

1. **Download the Installer**
   - Visit the [Releases page](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)
   - Download `VibeCode_1.0.0_x64.msi`

2. **Run the Installer**
   - Double-click the downloaded MSI file
   - If Windows SmartScreen appears, click "More info" then "Run anyway"

3. **Follow the Installation Wizard**
   - Accept the license agreement
   - Choose installation location (default: `C:\Program Files\VibeCode`)
   - Select "Create desktop shortcut" if desired
   - Click "Install"

4. **Complete Installation**
   - Click "Finish"
   - Launch from Start Menu or desktop shortcut

#### Method 2: Portable Executable

1. **Download the Executable**
   - Download `VibeCode_1.0.0_x64.exe` from Releases

2. **Create a Folder**
   ```powershell
   # Create a dedicated folder
   mkdir C:\VibeCode
   # Move the executable
   move Downloads\VibeCode_1.0.0_x64.exe C:\VibeCode\
   ```

3. **Run**
   - Double-click `VibeCode_1.0.0_x64.exe`
   - Settings will be stored in `%APPDATA%\com.vibecode.app\`

#### WebView2 Installation

If WebView2 is not installed (Windows 10), it will download automatically on first launch. This may require:
- Administrator permissions
- Internet connection
- ~150MB download
- Application restart after installation

---

## First Launch

### Initial Configuration

When you launch VibeCode for the first time:

1. **Welcome Screen**
   - Introduction to VibeCode features
   - Quick setup wizard (optional)
   - Skip or complete the wizard

2. **Directory Creation**
   VibeCode creates configuration directories:
   - **macOS:** `~/Library/Application Support/com.vibecode.app/`
   - **Linux:** `~/.config/vibecode/`
   - **Windows:** `%APPDATA%\com.vibecode.app\`

3. **Permission Requests (macOS/Linux)**
   - File system access (for opening projects)
   - Network access (for AI providers)
   - Approve when prompted

4. **Main Window Opens**
   - Welcome tab with quick start guide
   - Empty editor ready for your first project

### Quick Start Workflow

1. **Open a Project**
   - Click **File > Open Folder**
   - Select a project directory
   - Or create a new folder for a fresh project

2. **Optional: Configure AI Provider**
   - Click **Settings** icon (gear) or press `Cmd/Ctrl + ,`
   - Navigate to **AI Providers**
   - Add your API key:
     - OpenAI: Get key from [platform.openai.com](https://platform.openai.com)
     - Anthropic: Get key from [console.anthropic.com](https://console.anthropic.com)
     - OpenRouter: Get key from [openrouter.ai](https://openrouter.ai)
   - Click **Save**

3. **Start Coding**
   - Create or open a file
   - Begin typing - AI suggestions appear automatically
   - Use `Cmd/Ctrl + Shift + P` for command palette

---

## Configuration

### Settings Location

Access settings via:
- **Menu:** VibeCode > Preferences (macOS) or File > Settings (Windows/Linux)
- **Keyboard:** `Cmd + ,` (macOS) or `Ctrl + ,` (Windows/Linux)
- **Command Palette:** `Cmd/Ctrl + Shift + P` > "Open Settings"

### Configuration File

Advanced users can edit the configuration file directly:

**Location:**
- **macOS:** `~/Library/Application Support/com.vibecode.app/config.json`
- **Linux:** `~/.config/vibecode/config.json`
- **Windows:** `%APPDATA%\com.vibecode.app\config.json`

**Example config.json:**
```json
{
  "editor": {
    "fontSize": 14,
    "fontFamily": "Monaco, 'Courier New', monospace",
    "theme": "vs-dark",
    "tabSize": 2,
    "autoSave": "afterDelay",
    "autoSaveDelay": 1000
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2048
  },
  "vm": {
    "autoStart": ["vibecode-nodejs"],
    "memoryGB": 4,
    "cpuCores": 2
  },
  "monitoring": {
    "datadogEnabled": false,
    "opentelemetryEnabled": false
  }
}
```

### Environment Variables

Create a `.env` file in your project directory or set system environment variables:

**Location:** Project root or application directory

**Example .env:**
```bash
# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...

# Datadog (Optional)
DD_API_KEY=your_datadog_api_key
DD_SITE=datadoghq.com

# Application Settings
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=production
PORT=3000
```

### AI Provider Configuration

#### OpenAI
1. Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key
4. In VibeCode: Settings > AI Providers > OpenAI
5. Paste the key and save

#### Anthropic Claude
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Navigate to API Keys
3. Create a new key
4. Copy and paste into VibeCode Settings

#### OpenRouter (321+ Models)
1. Visit [openrouter.ai](https://openrouter.ai)
2. Sign up for an account
3. Generate an API key
4. Configure in VibeCode Settings
5. Select from 321+ available models

### VM Configuration (macOS only)

**Requirements:** macOS 13.0+, 8GB+ RAM

1. **Access VM Settings**
   - Menu: VibeCode > VM Manager
   - Or: Settings > Virtual Machines

2. **Configure Auto-Start**
   - Select VMs to start automatically
   - Check "Auto-start on launch"

3. **Adjust Resources**
   - Memory: 2-8GB per VM (default: 4GB)
   - CPU Cores: 1-4 cores (default: 2)
   - Storage: Fixed at VM creation

4. **Available VMs**
   - `vibecode-postgresql` - PostgreSQL 16
   - `vibecode-valkey` - Redis-compatible cache
   - `vibecode-nodejs` - Node.js 24.x environment
   - `vibecode-nodejs-codeserver` - Node.js + code-server
   - `vibecode-pgvector` - PostgreSQL with vector extensions
   - `vibecode-ide` - Full development environment

### Editor Customization

**Themes:**
- Light: `vs-light`
- Dark: `vs-dark` (default)
- High Contrast: `hc-black`, `hc-light`

**Fonts:**
- Popular choices: Monaco, Fira Code, JetBrains Mono, Cascadia Code
- Enable font ligatures in settings for better readability

**Keyboard Shortcuts:**
- Settings > Keyboard Shortcuts
- Click to rebind any command
- Search for specific actions

---

## Features Overview

### Code Editor (Monaco)

**Key Features:**
- Syntax highlighting for 50+ languages
- IntelliSense code completion
- Multi-cursor editing (`Cmd/Ctrl + Click`)
- Find and replace (`Cmd/Ctrl + F`)
- Go to definition (`F12`)
- Peek definition (`Cmd/Ctrl + Shift + F10`)

**Common Shortcuts:**
- `Cmd/Ctrl + P` - Quick file open
- `Cmd/Ctrl + Shift + P` - Command palette
- `Cmd/Ctrl + /` - Toggle line comment
- `Cmd/Ctrl + D` - Add selection to next match
- `Option/Alt + ↑/↓` - Move line up/down

### AI Code Assistance

**Features:**
- **Auto-completion:** AI suggestions as you type
- **Code Review:** Right-click > "AI Review"
- **Refactoring:** Select code > "AI Refactor"
- **Documentation:** Auto-generate comments and docs
- **Bug Detection:** Inline warnings and suggestions

**Using AI Chat:**
1. Open AI sidebar (icon on left)
2. Type your question or request
3. AI responds with code, explanations, or suggestions
4. Insert suggested code with one click

### VM Management (macOS)

**Starting a VM:**
1. Menu: VM > Start VM
2. Select the VM to start
3. Wait for boot (10-30 seconds)
4. VM status shows "Running"

**Stopping a VM:**
1. Menu: VM > Stop VM
2. Select running VM
3. Confirm shutdown

**Connecting to a VM:**
- SSH: VMs are accessible on localhost with port forwarding
- Check VM settings for port mappings
- Example: `ssh -p 2222 alpine@localhost`

### Git Integration

**Clone a Repository:**
1. File > Clone Repository
2. Enter Git URL
3. Choose local folder
4. Click "Clone"

**Commit Changes:**
1. Open Source Control panel (left sidebar)
2. Stage changes (click + icon)
3. Enter commit message
4. Click checkmark to commit

**Push/Pull:**
- Use Source Control panel menu (...)
- Select Push or Pull
- Authenticate if required

### Monitoring (Optional)

**Enable Datadog:**
1. Settings > Monitoring > Datadog
2. Enter DD_API_KEY
3. Select DD_SITE (datadoghq.com, datadoghq.eu, etc.)
4. Enable APM tracing
5. Restart application

**View Metrics:**
- Datadog dashboard shows:
  - Application performance
  - Error rates
  - Custom metrics
  - Distributed traces

**Prometheus Metrics:**
- Available at `http://localhost:9090/metrics`
- Scrape with Prometheus server
- Visualize in Grafana

---

## Troubleshooting

### Common Issues

#### Application Won't Launch

**macOS:**
- **Gatekeeper Block:**
  - Right-click app > Open (don't double-click)
  - Click "Open" in security dialog
  - Or: System Settings > Privacy & Security > Allow
- **Corrupted Download:**
  - Re-download the DMG/app
  - Verify checksum (see Releases page)
- **Insufficient Permissions:**
  - Check `~/Library/Application Support/` is writable
  - Run: `chmod -R u+w ~/Library/Application\ Support/com.vibecode.app`

**Linux:**
- **Missing Dependencies:**
  ```bash
  # Ubuntu/Debian
  sudo apt-get install libgtk-3-0 libwebkit2gtk-4.1-0

  # Fedora
  sudo dnf install gtk3 webkit2gtk4.1
  ```
- **AppImage Not Executing:**
  ```bash
  chmod +x vibecode_*.AppImage
  # Install FUSE if needed:
  sudo apt install fuse libfuse2  # Ubuntu/Debian
  ```

**Windows:**
- **WebView2 Missing:**
  - Should auto-install on first launch
  - Manual download: [WebView2 Runtime](https://go.microsoft.com/fwlink/p/?LinkId=2124703)
- **Antivirus Blocking:**
  - Add VibeCode to antivirus exclusions
  - Common with Windows Defender SmartScreen

#### AI Features Not Working

**Check API Keys:**
1. Settings > AI Providers
2. Verify key is entered correctly
3. Test key on provider website
4. Check key permissions (some keys may be restricted)

**Network Issues:**
- Verify internet connection
- Check firewall isn't blocking VibeCode
- Try different AI provider to isolate issue

**Rate Limiting:**
- AI providers have rate limits
- Wait and retry
- Consider upgrading API plan

#### VM Won't Start (macOS)

**Check Requirements:**
```bash
# Verify macOS version
sw_vers

# Should show 13.0 or higher
```

**Common Fixes:**
- **NVRAM Missing:**
  - VM requires `.nvram` file alongside disk image
  - Check `~/Library/Application Support/com.vibecode.app/vm-images/`
  - Re-download VM if NVRAM missing
- **Insufficient RAM:**
  - Check Activity Monitor for available RAM
  - Close other apps or reduce VM memory allocation
- **Disk Space:**
  - VMs need 10-50GB each
  - Check available space: `df -h`

**Logs:**
```bash
# View VibeCode logs
tail -f ~/Library/Logs/com.vibecode.app/app.log

# View VM console output
# Available in VM Manager > Select VM > Show Console
```

#### High Memory Usage

**Expected Memory Usage:**
- Base app: 200-400MB
- With editor and files: 400-800MB
- Per VM: 2-8GB (configurable)
- With AI features active: +200-500MB

**Reduce Memory:**
1. Close unused files/tabs
2. Stop VMs not in use
3. Reduce VM memory allocation (Settings > VMs)
4. Disable monitoring features if not needed
5. Restart VibeCode periodically

#### Slow Performance

**Check System Resources:**
- Activity Monitor (macOS)
- System Monitor (Linux)
- Task Manager (Windows)

**Optimization Tips:**
1. **Disable Unused Features:**
   - Turn off Datadog if not using
   - Reduce AI model max tokens
2. **Close Heavy Applications:**
   - Chrome, Slack, etc. can consume RAM
3. **Restart Application:**
   - Memory leaks may occur (rare)
4. **Update to Latest Version:**
   - Check for updates regularly

### Getting Logs

**macOS:**
```bash
# Application logs
open ~/Library/Logs/com.vibecode.app/

# Console.app for system logs
```

**Linux:**
```bash
# Application logs
tail -f ~/.config/vibecode/logs/app.log

# System journal
journalctl --user -u vibecode
```

**Windows:**
```powershell
# Application logs
explorer %APPDATA%\com.vibecode.app\logs

# Event Viewer for system logs
```

### Reporting Bugs

When reporting issues on [GitHub](https://github.com/ryanmaclean/vibecode-webgui/issues):

1. **Search Existing Issues** - Your issue may already be reported
2. **Provide Details:**
   - OS and version (e.g., "macOS 14.1 on M1 Mac")
   - VibeCode version (Help > About)
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs (redact sensitive info)
   - Screenshots if applicable

3. **Use Issue Template** - Follow the provided template for consistency

---

## Uninstallation

### macOS

1. **Quit VibeCode**
   - VibeCode > Quit (Cmd + Q)

2. **Remove Application**
   ```bash
   # Delete the app
   sudo rm -rf /Applications/VibeCode.app
   ```

3. **Remove Configuration (Optional)**
   ```bash
   # Remove settings
   rm -rf ~/Library/Application\ Support/com.vibecode.app

   # Remove logs
   rm -rf ~/Library/Logs/com.vibecode.app

   # Remove caches
   rm -rf ~/Library/Caches/com.vibecode.app

   # Remove preferences
   rm ~/Library/Preferences/com.vibecode.app.plist
   ```

4. **Remove VMs (Optional)**
   ```bash
   # Remove downloaded VM images (10-50GB each)
   rm -rf ~/Library/Application\ Support/com.vibecode.app/vm-images
   ```

### Linux

**Debian/Ubuntu:**
```bash
sudo apt remove vibecode
sudo apt autoremove  # Remove dependencies

# Remove configuration
rm -rf ~/.config/vibecode
rm -rf ~/.local/share/vibecode
```

**Fedora/RHEL:**
```bash
sudo rpm -e vibecode
# Or:
sudo dnf remove vibecode

# Remove configuration
rm -rf ~/.config/vibecode
rm -rf ~/.local/share/vibecode
```

**AppImage:**
```bash
# Just delete the AppImage file
rm vibecode_*.AppImage

# Remove configuration if desired
rm -rf ~/.config/vibecode
```

### Windows

**MSI Installer:**
1. Open **Add or Remove Programs**
2. Search for "VibeCode"
3. Click **Uninstall**
4. Follow the uninstallation wizard

**Portable Executable:**
1. Delete the `VibeCode.exe` file
2. Remove configuration:
   ```powershell
   Remove-Item -Recurse -Force "$env:APPDATA\com.vibecode.app"
   ```

---

## FAQ

### General Questions

**Q: Is VibeCode free?**
A: The application is free and open-source (MIT license). AI provider usage may require paid API keys.

**Q: Do I need an internet connection?**
A: Internet is required for:
- AI features (API calls to providers)
- Downloading updates
- Git operations with remote repositories

Local editing, file management, and VM features work offline.

**Q: Does VibeCode collect telemetry?**
A: No. VibeCode has telemetry disabled by default (`NEXT_TELEMETRY_DISABLED=1`). We do not collect usage data.

**Q: Can I use VibeCode for commercial projects?**
A: Yes. VibeCode is MIT licensed. Check your AI provider's terms for commercial use.

### AI Features

**Q: Which AI providers are supported?**
A: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Google (Gemini), Mistral, and 321+ models via OpenRouter.

**Q: How much does AI usage cost?**
A: Costs depend on your provider:
- OpenAI: ~$0.03/1K tokens (GPT-4)
- Anthropic: ~$0.015/1K tokens (Claude 3.5)
- OpenRouter: Varies by model

Monitor usage in your provider dashboard.

**Q: Can I use local AI models?**
A: Not yet. Ollama integration is planned for v1.1.0.

**Q: How do I reduce AI costs?**
A:
- Use cheaper models (GPT-3.5 instead of GPT-4)
- Reduce max tokens in settings
- Lower temperature for more deterministic responses
- Use AI selectively (not for every keystroke)

### VM Features

**Q: Why are VMs only available on macOS?**
A: v1.0.0 uses Apple Virtualization Framework. Windows (Hyper-V/WSL2) and Linux (KVM/QEMU) support coming in v1.1.0.

**Q: Can I create custom VMs?**
A: Not in the UI yet. Advanced users can create VMs manually and place them in the VM images directory.

**Q: How do I free up disk space used by VMs?**
A:
1. Stop VMs you don't use
2. Delete VM images from settings
3. VMs are stored in `~/Library/Application Support/com.vibecode.app/vm-images/`

**Q: Can VMs access my files?**
A: VMs are isolated. You can share folders via VM settings (feature coming in v1.1.0).

### Performance

**Q: Why is VibeCode faster than Electron apps?**
A: Tauri uses native webview (not Chromium) and Rust backend, reducing memory by 50-70%.

**Q: How can I improve performance?**
A:
- Use an SSD
- Increase RAM (8GB minimum, 16GB+ recommended)
- Close unused VMs
- Disable monitoring if not needed

**Q: Is VibeCode suitable for large codebases?**
A: Yes. Monaco editor handles large files well. For monorepos (10,000+ files), performance depends on your hardware.

### Security & Privacy

**Q: Where are my API keys stored?**
A: In platform-native secure storage:
- macOS: Keychain
- Linux: Secret Service / gnome-keyring
- Windows: Credential Manager

**Q: Can I audit VibeCode's network activity?**
A: Yes. VibeCode is open-source. Review code at [github.com/ryanmaclean/vibecode-webgui](https://github.com/ryanmaclean/vibecode-webgui).

**Q: Is my code sent to third parties?**
A: Only to AI providers you configure. No code is sent elsewhere. Disable AI features for fully local editing.

---

## Support

### Documentation

- **User Guide:** This document
- **Quick Start:** [docs/QUICKSTART.md](./docs/QUICKSTART.md)
- **Desktop Build Guide:** [docs/DESKTOP_BUILD_GUIDE.md](./docs/DESKTOP_BUILD_GUIDE.md)
- **Release Notes:** [RELEASE_NOTES.md](./RELEASE_NOTES.md)
- **Full Documentation:** [docs/](./docs/)

### Community

- **GitHub Discussions:** [Ask questions](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- **GitHub Issues:** [Report bugs](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Contributing:** [docs/contributing.md](./docs/src/content/docs/contributing.md)

### Getting Help

1. **Check Documentation:** Search this guide and other docs
2. **Search Issues:** Your question may already be answered
3. **Ask on Discussions:** For usage questions
4. **File an Issue:** For bugs or feature requests

### Updates

**Check for Updates:**
- Help > Check for Updates
- Or manually visit [Releases](https://github.com/ryanmaclean/vibecode-webgui/releases)

**Auto-Update:** Coming in v1.1.0

**Release Notifications:**
- Watch the repository on GitHub
- Enable "Releases only" notifications

---

## Appendix: Keyboard Shortcuts

### Editor

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Command Palette | `Cmd + Shift + P` | `Ctrl + Shift + P` |
| Quick Open | `Cmd + P` | `Ctrl + P` |
| Save | `Cmd + S` | `Ctrl + S` |
| Save All | `Cmd + Option + S` | `Ctrl + Alt + S` |
| Find | `Cmd + F` | `Ctrl + F` |
| Replace | `Cmd + Option + F` | `Ctrl + H` |
| Find in Files | `Cmd + Shift + F` | `Ctrl + Shift + F` |
| Toggle Comment | `Cmd + /` | `Ctrl + /` |
| Format Document | `Shift + Option + F` | `Shift + Alt + F` |
| Go to Line | `Ctrl + G` | `Ctrl + G` |

### Navigation

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Go to Definition | `F12` | `F12` |
| Peek Definition | `Option + F12` | `Alt + F12` |
| Go Back | `Ctrl + -` | `Ctrl + Alt + -` |
| Go Forward | `Ctrl + Shift + -` | `Ctrl + Shift + -` |
| Toggle Sidebar | `Cmd + B` | `Ctrl + B` |
| Toggle Terminal | `Ctrl + \`` | `Ctrl + \`` |

### Multi-Cursor

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Add Cursor | `Cmd + Click` | `Ctrl + Click` |
| Add Cursor Above | `Cmd + Option + ↑` | `Ctrl + Alt + ↑` |
| Add Cursor Below | `Cmd + Option + ↓` | `Ctrl + Alt + ↓` |
| Select Next Match | `Cmd + D` | `Ctrl + D` |
| Select All Matches | `Cmd + Shift + L` | `Ctrl + Shift + L` |

### AI Features

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Toggle AI Chat | `Cmd + Shift + A` | `Ctrl + Shift + A` |
| AI Code Review | `Cmd + Shift + R` | `Ctrl + Shift + R` |
| AI Refactor | `Cmd + Shift + E` | `Ctrl + Shift + E` |

---

**Version:** 1.0.0
**Last Updated:** November 1, 2025
**License:** MIT

For the latest version of this guide, visit [github.com/ryanmaclean/vibecode-webgui](https://github.com/ryanmaclean/vibecode-webgui)

Generated with [Claude Code](https://claude.com/claude-code)
