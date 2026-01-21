# VibeCode Post-Build Verification Guide

## Overview

This guide explains how to use the comprehensive post-build verification test suite for the VibeCode UnifiedServicesVibeCodeApp. The test suite ensures that after building the app, all services are working correctly, including the Datadog extension and terminal functionality.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Test Scripts Overview](#test-scripts-overview)
4. [Running Individual Tests](#running-individual-tests)
5. [Running the Full Test Suite](#running-the-full-test-suite)
6. [Understanding Test Results](#understanding-test-results)
7. [Troubleshooting](#troubleshooting)
8. [CI/CD Integration](#cicd-integration)
9. [Test Architecture](#test-architecture)

## Prerequisites

### Required Software

1. **Node.js and npm** (for browser-based tests)
   ```bash
   node --version  # Should be v14+ or higher
   npm --version   # Should be v6+ or higher
   ```

2. **Playwright** (for browser automation)
   ```bash
   npm install playwright
   # or globally:
   npm install -g playwright
   ```

3. **SSH client** (for SSH-based tests)
   ```bash
   which ssh  # Should show /usr/bin/ssh or similar
   ```

4. **sshpass** (optional, for automated SSH password entry)
   ```bash
   brew install hudochenkov/sshpass/sshpass
   ```

5. **curl** (for service health checks)
   ```bash
   which curl  # Should show /usr/bin/curl or similar
   ```

### Installing Playwright

If you don't have Playwright installed:

```bash
# Option 1: Local installation (recommended)
cd /path/to/SwiftUI-Apps
npm init -y  # Creates package.json if it doesn't exist
npm install playwright

# Option 2: Global installation
npm install -g playwright

# Install browser binaries
npx playwright install chromium
```

## Quick Start

### Run Full Verification (Recommended)

This is the easiest way to verify everything works:

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
./post-build-verification.sh
```

This will:
1. Build the app
2. Launch the app
3. Wait for services to be ready
4. Run all verification tests
5. Generate a comprehensive report

### Quick Check (Skip Build)

If you already have the app built and running:

```bash
./post-build-verification.sh --skip-build --skip-launch
```

### CI/CD Mode

For automated testing in CI/CD pipelines:

```bash
./post-build-verification.sh --headless
```

## Test Scripts Overview

The test suite consists of four main scripts:

### 1. `post-build-verification.sh` (Master Script)

**Purpose:** Orchestrates all tests and generates reports

**What it does:**
- Builds the app (optional)
- Launches the app (optional)
- Waits for services to be ready
- Runs all individual test scripts
- Generates comprehensive test report
- Provides clear pass/fail status

**Usage:**
```bash
./post-build-verification.sh [OPTIONS]

Options:
  --skip-build    Skip building the app
  --skip-launch   Skip launching the app
  --headless      Run browser tests in headless mode
  --quick         Skip non-critical tests
  --verbose       Enable verbose output
  --help          Show help message
```

**Exit codes:**
- `0` = All tests passed
- `1` = Tests failed
- `2` = Build or launch failed
- `3` = Prerequisites not met

### 2. `verify-datadog-extension-ssh.sh` (SSH Test)

**Purpose:** Verify Datadog extension files exist in VM via SSH

**What it tests:**
- SSH connectivity to VM (port 2222)
- Extension directory exists
- Datadog extension is present
- Extension files are intact
- File permissions are correct

**Usage:**
```bash
./verify-datadog-extension-ssh.sh [--verbose]
```

**Exit codes:**
- `0` = All checks passed
- `1` = Verification failed
- `2` = SSH connection failed

### 3. `test-datadog-extension-post-build.js` (Browser Test)

**Purpose:** Verify Datadog extension is installed and functional in OpenVSCode

**What it tests:**
- OpenVSCode Server loads successfully
- Extensions panel can be opened
- Datadog extension is visible and enabled
- Datadog commands are available in command palette
- Takes screenshots for evidence

**Usage:**
```bash
node test-datadog-extension-post-build.js [--headless]
```

**Exit codes:**
- `0` = All tests passed
- `1` = Tests failed
- `2` = Setup/environment error

### 4. `test-terminal-functionality-post-build.js` (Browser Test)

**Purpose:** Verify terminal functionality works in OpenVSCode Server

**What it tests:**
- Terminal can be opened
- Commands can be executed (echo, pwd, whoami, uname)
- Terminal output is captured correctly
- Terminal scrolling works
- Terminal interactivity (Ctrl+C, Tab, etc.)
- Takes screenshots for evidence

**Usage:**
```bash
node test-terminal-functionality-post-build.js [--headless]
```

**Exit codes:**
- `0` = All tests passed
- `1` = Tests failed
- `2` = Setup/environment error

## Running Individual Tests

### Test 1: SSH-Based Extension Verification

**When to use:** Quick check of extension files without browser automation

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
./verify-datadog-extension-ssh.sh
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════════╗
║  VibeCode Post-Build Verification: Datadog Extension (SSH)   ║
╚═══════════════════════════════════════════════════════════════╝

Timestamp:       2025-01-14T10:30:00Z
SSH target:      root@localhost:2222
Extension dir:   /root/.openvscode-server/extensions
Expected ext:    datadog.datadog-vscode-2.0.0

📋 TEST 1: Check SSH connectivity
✓ [PASS] SSH connectivity
         Connected to localhost:2222

📋 TEST 2: Check extension directory exists
✓ [PASS] Extension directory exists
         /root/.openvscode-server/extensions

...

✅ ALL TESTS PASSED
```

### Test 2: Browser-Based Datadog Extension Test

**When to use:** Verify extension is functional in the browser

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
node test-datadog-extension-post-build.js
```

**With headless mode (for CI/CD):**
```bash
node test-datadog-extension-post-build.js --headless
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════════╗
║  VibeCode Post-Build Verification: Datadog Extension Test    ║
╚═══════════════════════════════════════════════════════════════╝

Timestamp: 2025-01-14T10:30:00.000Z
OpenVSCode URL: http://localhost:8080
Headless mode: false

🚀 Launching Chrome browser...

📋 TEST 1: Navigate to OpenVSCode Server
✓ [PASS] Navigate to OpenVSCode Server
         URL: http://localhost:8080/

...

✅ ALL TESTS PASSED
```

**Screenshots saved to:** `test-results/datadog-extension/`

### Test 3: Browser-Based Terminal Functionality Test

**When to use:** Verify terminal works correctly in OpenVSCode

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
node test-terminal-functionality-post-build.js
```

**With headless mode:**
```bash
node test-terminal-functionality-post-build.js --headless
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════════╗
║  VibeCode Post-Build Verification: Terminal Functionality    ║
╚═══════════════════════════════════════════════════════════════╝

Timestamp: 2025-01-14T10:30:00.000Z
OpenVSCode URL: http://localhost:8080

🚀 Launching Chrome browser...

📋 TEST 1: Navigate to OpenVSCode Server
✓ [PASS] Navigate to OpenVSCode Server

📋 TEST 3: Open terminal
✓ [PASS] Open terminal

📋 TEST 4: Execute test commands in terminal
  Sending command: echo "Hello VibeCode"
  ✓ Found expected output: "Hello VibeCode"

...

✅ ALL TESTS PASSED
```

**Screenshots saved to:** `test-results/terminal-functionality/`

## Running the Full Test Suite

### Standard Verification

Build, launch, and test everything:

```bash
./post-build-verification.sh
```

### Development Mode

Skip build and launch (use already running app):

```bash
./post-build-verification.sh --skip-build --skip-launch
```

### CI/CD Mode

Automated testing with headless browser:

```bash
./post-build-verification.sh --headless
```

### Quick Mode

Fast verification (skip non-critical tests):

```bash
./post-build-verification.sh --quick
```

### Verbose Mode

See detailed output from all commands:

```bash
./post-build-verification.sh --verbose
```

### Combined Options

```bash
# CI/CD with verbose output
./post-build-verification.sh --headless --verbose

# Quick check on running app
./post-build-verification.sh --skip-build --skip-launch --quick
```

## Understanding Test Results

### Test Report Location

After running the full test suite, you'll find:

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

### Reading the Main Report

The main report (`post-build-verification-report.md`) contains:

1. **Configuration:** What options were used
2. **Test Summary:** Total/Passed/Failed/Skipped counts
3. **Test Results:** Individual test outcomes
4. **Verdict:** Overall pass/fail status
5. **Test Artifacts:** Links to detailed results
6. **Next Steps:** What to do next

Example report structure:

```markdown
# VibeCode Post-Build Verification Report

**Generated:** 2025-01-14 10:30:00 UTC
**Duration:** 145s

## Test Summary

- **Total Tests:** 8
- **Passed:** ✅ 8
- **Failed:** ❌ 0
- **Skipped:** ⊘ 0

## Test Results

- ✅ **Build app:** PASS
- ✅ **Launch app:** PASS
- ✅ **Wait for services:** PASS
- ✅ **SSH extension verification:** PASS
- ✅ **Browser Datadog verification:** PASS
- ✅ **Browser terminal verification:** PASS

## Verdict

✅ **ALL TESTS PASSED**

The UnifiedServicesVibeCodeApp has passed all post-build verification tests.
The app is ready for distribution.
```

### Understanding Exit Codes

All scripts use consistent exit codes:

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | All tests passed, proceed with distribution |
| 1 | Test failure | Review failed tests, fix issues, re-run |
| 2 | Build/launch failure | Check build logs, fix build issues |
| 3 | Prerequisites missing | Install required software |

### Reading JSON Test Results

Each browser test generates a JSON file with detailed results:

```json
{
  "timestamp": "2025-01-14T10:30:00.000Z",
  "tests": [
    {
      "name": "Navigate to OpenVSCode Server",
      "status": "passed",
      "error": null,
      "screenshot": "/path/to/screenshot.png",
      "timestamp": "2025-01-14T10:30:05.000Z"
    }
  ],
  "passed": 5,
  "failed": 0,
  "skipped": 0
}
```

### Screenshots

Screenshots are automatically captured:

1. **Success screenshots:** Show the state when tests pass
2. **Failure screenshots:** Show what went wrong
3. **Final screenshot:** Shows the end state

Screenshot naming convention:
```
<timestamp>-<test-name>.png

Examples:
1705229400123-test1-openvscode-loaded.png
1705229405678-test3-terminal-opened.png
1705229410234-command-1-echo-Hello-VibeCode.png
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Prerequisites not met"

**Symptom:**
```
✗ Node.js not found
✗ npm not found
❌ Prerequisites not met
```

**Solution:**
```bash
# Install Node.js via Homebrew
brew install node

# Verify installation
node --version
npm --version
```

#### 2. "Playwright not found"

**Symptom:**
```
⚠ Playwright not found - will attempt to use if available
Error: Cannot find module 'playwright'
```

**Solution:**
```bash
# Install Playwright locally
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
npm install playwright

# Install browser binaries
npx playwright install chromium
```

#### 3. "SSH connection failed"

**Symptom:**
```
✗ [FAIL] SSH connectivity
         Cannot connect to localhost:2222
```

**Solutions:**

a) **Check if VM is running:**
```bash
# Check for VM process
pgrep -f UnifiedServicesVibeCode

# If not running, launch the app
open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app
```

b) **Check SSH port forwarding:**
```bash
# Check if port 2222 is listening
lsof -i :2222

# If not, wait for VM to fully boot (can take 30-60 seconds)
```

c) **Install sshpass for password automation:**
```bash
brew install hudochenkov/sshpass/sshpass
```

#### 4. "OpenVSCode Server not responding"

**Symptom:**
```
✗ [FAIL] Wait for services
         Timeout after 120s
```

**Solutions:**

a) **Check if VM is running:**
```bash
pgrep -f UnifiedServicesVibeCode
```

b) **Check OpenVSCode port forwarding:**
```bash
# Check if port 8080 is listening
lsof -i :8080

# Try accessing in browser
open http://localhost:8080
```

c) **Check VM logs:**
```bash
# If you have access to VM console
log stream --predicate 'process == "UnifiedServicesVibeCode"' --level debug
```

d) **Wait longer:**
```bash
# Increase wait time in the script (edit post-build-verification.sh)
MAX_WAIT_TIME=180  # Change from 120 to 180
```

#### 5. "Extension not found"

**Symptom:**
```
✗ [FAIL] Datadog extension exists
         Datadog extension not found
```

**Solutions:**

a) **Verify extension was included in build:**
```bash
# Check initramfs contents
mkdir -p /tmp/initramfs-check
cd /tmp/initramfs-check
gunzip -c /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz | cpio -idmv
find . -name "*datadog*"
```

b) **Rebuild the VM image with extension:**
```bash
# Check the build process includes the Datadog extension
cd /path/to/vm-build-scripts
./build-vm-with-datadog.sh
```

c) **SSH into VM and check manually:**
```bash
ssh -p 2222 root@localhost
# Password: vibecode

ls -la /root/.openvscode-server/extensions/
```

#### 6. "Terminal not opening"

**Symptom:**
```
✗ [FAIL] Open terminal
         Could not open terminal
```

**Solutions:**

a) **Check browser compatibility:**
```bash
# Make sure Chromium is installed
npx playwright install chromium
```

b) **Try non-headless mode:**
```bash
# Run without --headless to see what's happening
node test-terminal-functionality-post-build.js
```

c) **Check OpenVSCode configuration:**
- Terminal functionality requires proper TTY/PTY support in VM
- Verify kernel has PTY support enabled

#### 7. "Permission denied on test scripts"

**Symptom:**
```
bash: ./post-build-verification.sh: Permission denied
```

**Solution:**
```bash
# Make scripts executable
chmod +x post-build-verification.sh
chmod +x verify-datadog-extension-ssh.sh
chmod +x test-datadog-extension-post-build.js
chmod +x test-terminal-functionality-post-build.js
```

### Debug Mode

For detailed debugging, run with verbose mode:

```bash
./post-build-verification.sh --verbose
```

This will show:
- All SSH commands being executed
- Full build output
- Detailed browser automation steps
- Network requests and responses

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Post-Build Verification

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  verify:
    runs-on: macos-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: |
        npm install playwright
        npx playwright install chromium

    - name: Run post-build verification
      run: |
        cd azure/SwiftUI-Apps
        ./post-build-verification.sh --headless

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: azure/SwiftUI-Apps/test-results/

    - name: Upload test report
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-report
        path: azure/SwiftUI-Apps/test-results/post-build-verification-report.md
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent {
        label 'macos'
    }

    stages {
        stage('Install Dependencies') {
            steps {
                sh '''
                    npm install playwright
                    npx playwright install chromium
                '''
            }
        }

        stage('Run Verification') {
            steps {
                sh '''
                    cd azure/SwiftUI-Apps
                    ./post-build-verification.sh --headless --verbose
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'azure/SwiftUI-Apps/test-results/**/*', allowEmptyArchive: true
            publishHTML([
                reportDir: 'azure/SwiftUI-Apps/test-results',
                reportFiles: 'post-build-verification-report.md',
                reportName: 'Verification Report'
            ])
        }
    }
}
```

### GitLab CI Example

```yaml
verification:
  stage: test
  image: node:18
  before_script:
    - apt-get update && apt-get install -y chromium
    - npm install playwright
    - npx playwright install chromium
  script:
    - cd azure/SwiftUI-Apps
    - ./post-build-verification.sh --headless
  artifacts:
    when: always
    paths:
      - azure/SwiftUI-Apps/test-results/
    reports:
      junit: azure/SwiftUI-Apps/test-results/**/*.xml
```

## Test Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│         post-build-verification.sh (Master Script)          │
│                                                              │
│  Orchestrates: Build → Launch → Wait → Test → Report        │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼──────┐       ┌────────▼────────┐
│  SSH Tests   │       │  Browser Tests  │
│              │       │                 │
│ verify-      │       │ test-datadog-   │
│ datadog-     │       │ extension-      │
│ extension-   │       │ post-build.js   │
│ ssh.sh       │       │                 │
│              │       │ test-terminal-  │
│              │       │ functionality-  │
│              │       │ post-build.js   │
└──────────────┘       └─────────────────┘
```

### Test Layers

1. **Infrastructure Layer:** Build and launch verification
2. **Service Layer:** Service readiness checks
3. **Feature Layer:** Extension and terminal functionality
4. **Evidence Layer:** Screenshots and logs

### Test Execution Flow

```
1. Prerequisites Check
   ├─ Node.js/npm installed?
   ├─ Playwright installed?
   ├─ Test scripts exist?
   └─ SSH client available?

2. Build (optional)
   └─ Run build-unified-menubar.sh

3. Launch (optional)
   └─ Open UnifiedServicesVibeCodeApp.app

4. Service Readiness
   └─ Wait for OpenVSCode on localhost:8080

5. SSH Tests
   ├─ SSH connectivity
   ├─ Extension directory exists
   ├─ Datadog extension present
   └─ File structure intact

6. Browser Tests
   ├─ Datadog Extension Test
   │  ├─ Navigate to OpenVSCode
   │  ├─ Open Extensions panel
   │  ├─ Verify Datadog extension
   │  └─ Check extension commands
   │
   └─ Terminal Functionality Test
      ├─ Navigate to OpenVSCode
      ├─ Open terminal
      ├─ Execute test commands
      ├─ Verify output
      └─ Test interactivity

7. Report Generation
   ├─ Aggregate results
   ├─ Generate markdown report
   └─ Save artifacts
```

### Data Flow

```
Test Scripts → JSON Results → Master Script → Markdown Report
     │              │              │                │
     │              │              │                │
     └──Screenshots─┘              └──Exit Codes────┘
```

## Best Practices

### 1. Always Run Full Verification Before Distribution

```bash
# Clean build and full test
./post-build-verification.sh
```

### 2. Use Quick Mode During Development

```bash
# Fast iterations
./post-build-verification.sh --skip-build --skip-launch --quick
```

### 3. Keep Test Environment Clean

```bash
# Kill any stray processes before testing
pkill -f UnifiedServicesVibeCode

# Clean previous test results
rm -rf test-results/

# Start fresh
./post-build-verification.sh
```

### 4. Review Screenshots on Failure

When tests fail, always check screenshots:

```bash
# Open the test results directory
open test-results/

# View failed test screenshots
open test-results/datadog-extension/*failed*.png
open test-results/terminal-functionality/*failed*.png
```

### 5. Use Verbose Mode for Debugging

```bash
# Get detailed output
./post-build-verification.sh --verbose > verification.log 2>&1

# Review log
less verification.log
```

### 6. Keep Dependencies Updated

```bash
# Update Playwright
npm update playwright

# Reinstall browser binaries
npx playwright install chromium
```

## Support and Contributions

### Reporting Issues

If you encounter issues with the test suite:

1. Run with `--verbose` flag
2. Check the test artifacts in `test-results/`
3. Review screenshots for visual debugging
4. Check the troubleshooting section above

### Extending the Test Suite

To add new tests:

1. Create a new test script (JavaScript or Shell)
2. Add test to `post-build-verification.sh`
3. Update this documentation
4. Add to CI/CD pipeline

Example:

```javascript
// test-new-feature.js
async function testNewFeature() {
  // Your test logic here
}
```

```bash
# In post-build-verification.sh
run_new_feature_test() {
  log_step "Running New Feature Test"
  node "$NEW_FEATURE_TEST" || exit_code=$?
  # ... handle results
}
```

## Appendix

### File Locations

```
azure/SwiftUI-Apps/
├── post-build-verification.sh              # Master script
├── verify-datadog-extension-ssh.sh         # SSH test
├── test-datadog-extension-post-build.js    # Datadog browser test
├── test-terminal-functionality-post-build.js # Terminal browser test
├── POST_BUILD_VERIFICATION_GUIDE.md        # This guide
└── test-results/                           # Generated test results
    ├── post-build-verification-report.md
    ├── datadog-extension/
    │   ├── test-results.json
    │   └── *.png
    └── terminal-functionality/
        ├── test-results.json
        └── *.png
```

### Quick Reference Commands

```bash
# Full verification
./post-build-verification.sh

# Quick check
./post-build-verification.sh --skip-build --skip-launch

# CI/CD mode
./post-build-verification.sh --headless

# Individual tests
./verify-datadog-extension-ssh.sh
node test-datadog-extension-post-build.js
node test-terminal-functionality-post-build.js

# View results
open test-results/
cat test-results/post-build-verification-report.md
```

### Environment Variables

You can customize behavior with environment variables:

```bash
# Custom OpenVSCode URL
export OPENVSCODE_URL="http://localhost:9090"

# Custom SSH port
export SSH_PORT="2223"

# Custom results directory
export RESULTS_DIR="/tmp/test-results"

# Run verification
./post-build-verification.sh
```

---

**Last Updated:** 2025-01-14
**Version:** 1.0.0
**Maintainer:** Agent S
