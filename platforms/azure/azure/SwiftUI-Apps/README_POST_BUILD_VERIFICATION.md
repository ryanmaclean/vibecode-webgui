# VibeCode Post-Build Verification Test Suite

Comprehensive automated testing for UnifiedServicesVibeCodeApp to verify Datadog extension and terminal functionality after building.

## 🚀 Quick Start

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Install Playwright (one-time setup)
npm install playwright
npx playwright install chromium

# Run full verification
./post-build-verification.sh
```

## 📚 Documentation

- **[Deliverables Index](AGENT_S_DELIVERABLES_INDEX.md)** - Overview of all files and features
- **[Complete Guide](POST_BUILD_VERIFICATION_GUIDE.md)** - Comprehensive documentation (800+ lines)
- **[Quick Reference](QUICK_VERIFICATION_REFERENCE.md)** - One-page quick start
- **[Examples](VERIFICATION_EXAMPLES.sh)** - 14 copy-paste examples (run with `./VERIFICATION_EXAMPLES.sh`)
- **[Agent Report](AGENT_S_POST_BUILD_VERIFICATION_REPORT.md)** - Technical implementation details

## ✅ What Gets Tested

| Test | Method | What It Checks |
|------|--------|----------------|
| **Datadog Extension (SSH)** | SSH into VM | Files exist at `/root/.openvscode-server/extensions/` |
| **Datadog Extension (Browser)** | Playwright | Extension visible in UI, commands available |
| **Terminal Functionality** | Playwright | Terminal opens, commands work, output captured |

## 🎯 Common Commands

### Full Verification
```bash
./post-build-verification.sh
```

### Quick Check (App Already Running)
```bash
./post-build-verification.sh --skip-build --skip-launch
```

### CI/CD Mode
```bash
./post-build-verification.sh --headless
```

### Individual Tests
```bash
# SSH test (fast, no browser)
./verify-datadog-extension-ssh.sh

# Datadog browser test
node test-datadog-extension-post-build.js

# Terminal browser test
node test-terminal-functionality-post-build.js
```

## 📊 Test Results

Results are saved to `test-results/`:
```
test-results/
├── post-build-verification-report.md    # Main report
├── datadog-extension/                    # Datadog test artifacts
│   ├── test-results.json
│   └── *.png                            # Screenshots
└── terminal-functionality/               # Terminal test artifacts
    ├── test-results.json
    └── *.png                            # Screenshots
```

## 🔧 Prerequisites

- **Node.js** (v14+) - `brew install node`
- **Playwright** - `npm install playwright`
- **Chromium** - `npx playwright install chromium`
- **sshpass** (optional) - `brew install hudochenkov/sshpass/sshpass`

## 📖 Files Included

| File | Purpose | Size |
|------|---------|------|
| `post-build-verification.sh` | Master orchestration script | 17 KB |
| `verify-datadog-extension-ssh.sh` | SSH-based verification | 11 KB |
| `test-datadog-extension-post-build.js` | Browser Datadog test | 14 KB |
| `test-terminal-functionality-post-build.js` | Browser terminal test | 16 KB |
| `POST_BUILD_VERIFICATION_GUIDE.md` | Complete documentation | 24 KB |
| `QUICK_VERIFICATION_REFERENCE.md` | Quick reference | 5.6 KB |
| `VERIFICATION_EXAMPLES.sh` | Usage examples | 12 KB |

## 🎨 Options

```bash
--skip-build    # Skip building the app
--skip-launch   # Skip launching the app
--headless      # Run browser tests without UI (for CI/CD)
--quick         # Skip non-critical tests
--verbose       # Show detailed output
--help          # Show help message
```

## 💡 Examples

### Development Workflow
```bash
# Quick check during development
./post-build-verification.sh --skip-build --skip-launch --quick
```

### Before Release
```bash
# Full verification
pkill -f UnifiedServicesVibeCode
rm -rf test-results/
./post-build-verification.sh
cat test-results/post-build-verification-report.md
```

### CI/CD Pipeline
```yaml
# GitHub Actions
- run: |
    cd azure/SwiftUI-Apps
    ./post-build-verification.sh --headless
```

## 🐛 Troubleshooting

### "Prerequisites not met"
```bash
brew install node
npm install playwright
npx playwright install chromium
```

### "SSH connection failed"
```bash
# Check if VM is running
pgrep -f UnifiedServicesVibeCode

# Check SSH port
lsof -i :2222
```

### "OpenVSCode not responding"
```bash
# Check if OpenVSCode is accessible
open http://localhost:8080

# Check port
lsof -i :8080
```

See **[Complete Guide](POST_BUILD_VERIFICATION_GUIDE.md)** for detailed troubleshooting.

## 📈 Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | ✅ All passed | Ship it! |
| 1 | ❌ Tests failed | Review report, fix issues |
| 2 | ⚠️ Build/launch failed | Check build logs |
| 3 | 🔧 Prerequisites missing | Install required software |

## ⏱️ Expected Duration

- **Full run:** 2-3 minutes
- **Quick mode:** ~45 seconds
- **Individual tests:** 10-30 seconds each

## 🤝 Support

1. Read the **[Complete Guide](POST_BUILD_VERIFICATION_GUIDE.md)**
2. Check the **[Quick Reference](QUICK_VERIFICATION_REFERENCE.md)**
3. Browse **[Examples](VERIFICATION_EXAMPLES.sh)**
4. Run with `--verbose` flag for debugging
5. Check screenshots in `test-results/`

## ✨ Features

- ✅ Fully automated (no manual steps)
- ✅ CI/CD ready (headless mode + exit codes)
- ✅ Evidence collection (screenshots + JSON)
- ✅ Comprehensive reports (Markdown + Console)
- ✅ Error handling (robust recovery)
- ✅ Modular design (tests run independently)
- ✅ Well documented (800+ lines of docs)

---

**Created by Agent S on 2025-01-14**

For detailed information, see:
- **[Deliverables Index](AGENT_S_DELIVERABLES_INDEX.md)**
- **[Complete Guide](POST_BUILD_VERIFICATION_GUIDE.md)**
