# VibeCode Post-Build Verification - Quick Reference

## TL;DR

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Full verification (build + test everything)
./post-build-verification.sh

# Quick check (app already running)
./post-build-verification.sh --skip-build --skip-launch

# CI/CD mode
./post-build-verification.sh --headless
```

## What Gets Tested

| Test | Method | What It Checks |
|------|--------|----------------|
| **Datadog Extension (SSH)** | SSH into VM | Extension files exist at `/root/.openvscode-server/extensions/` |
| **Datadog Extension (Browser)** | Playwright | Extension visible in UI, commands available |
| **Terminal Functionality** | Playwright | Terminal opens, commands work, output captured |

## Files Created

```
azure/SwiftUI-Apps/
├── post-build-verification.sh              ← Run this
├── verify-datadog-extension-ssh.sh
├── test-datadog-extension-post-build.js
├── test-terminal-functionality-post-build.js
├── POST_BUILD_VERIFICATION_GUIDE.md        ← Full docs
└── QUICK_VERIFICATION_REFERENCE.md         ← This file
```

## Prerequisites

```bash
# Install Node.js (if not installed)
brew install node

# Install Playwright
npm install playwright
npx playwright install chromium

# Install sshpass (optional but recommended)
brew install hudochenkov/sshpass/sshpass
```

## Common Commands

### Run All Tests

```bash
./post-build-verification.sh
```

### Run Individual Tests

```bash
# SSH test (fast, no browser needed)
./verify-datadog-extension-ssh.sh

# Datadog browser test
node test-datadog-extension-post-build.js

# Terminal browser test
node test-terminal-functionality-post-build.js
```

### Options

```bash
# Skip build step
./post-build-verification.sh --skip-build

# Skip launch step
./post-build-verification.sh --skip-launch

# Run in headless mode (no browser window)
./post-build-verification.sh --headless

# Quick mode (skip non-critical tests)
./post-build-verification.sh --quick

# Verbose output
./post-build-verification.sh --verbose

# Combine options
./post-build-verification.sh --skip-build --skip-launch --headless
```

## Results Location

```bash
# View report
cat test-results/post-build-verification-report.md

# Open results folder
open test-results/

# View screenshots
open test-results/datadog-extension/
open test-results/terminal-functionality/
```

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | ✅ All passed | Ship it! |
| 1 | ❌ Tests failed | Check report, fix issues |
| 2 | ⚠️ Build/launch failed | Check build logs |
| 3 | 🔧 Missing prerequisites | Install required software |

## Troubleshooting

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

# Install sshpass
brew install hudochenkov/sshpass/sshpass
```

### "OpenVSCode not responding"
```bash
# Check if port 8080 is listening
lsof -i :8080

# Try in browser
open http://localhost:8080

# Wait longer (VM boot takes 30-60s)
```

### "Extension not found"
```bash
# SSH into VM and check manually
ssh -p 2222 root@localhost
# Password: vibecode
ls -la /root/.openvscode-server/extensions/
```

### Scripts not executable
```bash
chmod +x post-build-verification.sh
chmod +x verify-datadog-extension-ssh.sh
```

## Expected Timeline

| Phase | Time |
|-------|------|
| Build | 30-60s |
| Launch | 5-10s |
| Services ready | 30-60s |
| SSH tests | 5-10s |
| Browser tests | 30-45s each |
| **Total** | **2-3 minutes** |

## What Success Looks Like

```bash
$ ./post-build-verification.sh

╔═══════════════════════════════════════════════════════════════╗
║      VibeCode Post-Build Verification Master Script          ║
╚═══════════════════════════════════════════════════════════════╝

...

╔═══════════════════════════════════════════════════════════════╗
║                      TEST SUMMARY                             ║
╚═══════════════════════════════════════════════════════════════╝

Test Statistics:
  Total:   8
  Passed:  8
  Failed:  0
  Skipped: 0

╔═══════════════════════════════════════════════════════════════╗
║                  ✅ ALL TESTS PASSED                          ║
╚═══════════════════════════════════════════════════════════════╝
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run verification
  run: |
    cd azure/SwiftUI-Apps
    ./post-build-verification.sh --headless
```

### Jenkins
```groovy
sh 'cd azure/SwiftUI-Apps && ./post-build-verification.sh --headless'
```

### GitLab CI
```yaml
script:
  - cd azure/SwiftUI-Apps
  - ./post-build-verification.sh --headless
```

## Need More Info?

See full documentation: `POST_BUILD_VERIFICATION_GUIDE.md`

---

**Quick Start:** `./post-build-verification.sh`
