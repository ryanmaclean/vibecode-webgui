# VibeCode Desktop Quick Start Guide

**Version:** 1.5.0
**Platform:** macOS Apple Silicon (M1/M2/M3/M4)
**Install Time:** ~5 minutes

---

## Installation (macOS)

### Download
Get the latest release from:
https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v1.5.0

**Choose one:**
- **VibeCode-v1.5.0-macOS-arm64.dmg** (recommended) - Double-click installer
- **VibeCode-v1.5.0-macOS-arm64.app.zip** - Manual installation

### Install from DMG
1. Download `VibeCode-v1.5.0-macOS-arm64.dmg`
2. Double-click to mount
3. Drag `VibeCode.app` to Applications folder
4. Eject DMG
5. **First launch:** Right-click app → "Open" (bypass Gatekeeper)

### Install from ZIP
```bash
# Download and extract
curl -L -o VibeCode.app.zip \
  https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.5.0/VibeCode-v1.5.0-macOS-arm64.app.zip
unzip VibeCode.app.zip
mv VibeCode.app /Applications/

# First launch
open /Applications/VibeCode.app
```

---

## First Launch

### What Happens
On first launch, VibeCode will:
1. Create `~/.vibecode` configuration directory
2. Initialize default settings
3. Open the main editor window
4. Prompt for file access permissions (if needed)

### Expected Prompts
- **Gatekeeper Warning** - Click "Open" (unsigned app)
- **File Access** - Allow access to Documents/Projects
- **Network Access** - Required for AI features (optional)

---

## Quick Workflow

### 1. Open a Project
```
File → Open Folder → Select your project directory
```
Or drag-and-drop a folder onto the VibeCode icon.

### 2. Start Coding
- **Monaco Editor** provides VS Code-like experience
- **IntelliSense** for TypeScript, JavaScript, Python, Rust, Go
- **AI Completion** via Monacopilot (requires API key)

### 3. Configure AI (Optional)
```
VibeCode → Preferences → AI Providers
```
Add API keys for:
- OpenAI (GPT-4)
- Anthropic (Claude)
- OpenRouter (321+ models)

### 4. Use VMs (macOS only)
```
VM → Manage VMs → Select VM image → Start
```
Pre-configured VMs:
- PostgreSQL
- Node.js
- code-server
- pgvector

---

## System Requirements

### macOS
- **OS:** macOS 13.0 (Ventura) or later
- **Chip:** Apple Silicon (M1/M2/M3/M4)
- **RAM:** 8GB recommended
- **Disk:** 1GB app + 10-50GB per VM

### Not Supported Yet
- Intel Macs (coming soon)
- Linux (planned)
- Windows (planned)

---

## Key Features

### Code Editor
- Monaco Editor 0.53.0 (VS Code core)
- Syntax highlighting for 50+ languages
- IntelliSense and autocomplete
- Multi-file tabs and split views

### AI Assistance
- **Monacopilot 1.2.7** - AI code completion
- **321+ Models** - OpenAI, Anthropic, Google, Mistral
- **Context-aware** - Uses project context for suggestions

### Apple Virtualization (macOS)
- **Native VMs** - Apple Virtualization Framework
- **Fast boot** - Seconds instead of minutes
- **6 pre-configured images** - PostgreSQL, Node.js, Redis, etc.
- **Auto-start** - VMs start with the app

### Monitoring (Optional)
- **Datadog** integration
- **OpenTelemetry** tracing
- **Prometheus** metrics on :9090

---

## Troubleshooting

### App Won't Open
**Symptom:** "App is damaged" or "Can't be opened"
**Fix:** Right-click → Open (first time only)
```bash
# Alternative: Remove quarantine
xattr -d com.apple.quarantine /Applications/VibeCode.app
```

### VM Won't Start
**Symptom:** VM fails to start or crashes
**Check:**
- macOS 13.0+ required
- Ensure .nvram file exists next to disk image
- Check RAM allocation (Settings → VMs)

### AI Features Not Working
**Symptom:** No code completion or AI chat
**Fix:** Add API key in Preferences → AI Providers

### High Memory Usage
**Symptom:** System slow, memory pressure
**Fix:**
- Close unused VMs
- Reduce VM RAM allocation
- Restart VibeCode

---

## More Resources

- **Full User Guide:** [USER_GUIDE.md](./USER_GUIDE.md)
- **Installation Guide:** [INSTALL.md](./INSTALL.md)
- **Release Notes:** [RELEASE_NOTES.md](./RELEASE_NOTES.md)
- **GitHub Issues:** https://github.com/ryanmaclean/vibecode-webgui/issues
- **Documentation:** https://github.com/ryanmaclean/vibecode-webgui/tree/main/docs

---

## Getting Help

**Quick Help:**
1. Help → Show Logs (for error messages)
2. GitHub Discussions for questions
3. GitHub Issues for bugs

**Support:**
- Discussions: https://github.com/ryanmaclean/vibecode-webgui/discussions
- Issues: https://github.com/ryanmaclean/vibecode-webgui/issues

---

**That's it! You're ready to code with AI assistance and native VMs.**

Next: Try creating a project or opening an existing one.
