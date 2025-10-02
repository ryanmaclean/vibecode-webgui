# How to Monitor Code-Server Extension Builds

A step-by-step guide for monitoring code-server extension update builds.

## 🎯 Overview

This guide walks through the complete process of monitoring a code-server extension build from trigger to verification.

---

## 📋 Prerequisites

### Required Tools
```bash
# Check if tools are installed
command -v gh &> /dev/null && echo "✓ GitHub CLI installed" || echo "✗ Install gh CLI"
command -v docker &> /dev/null && echo "✓ Docker installed" || echo "✗ Install Docker"
command -v jq &> /dev/null && echo "✓ jq installed" || echo "✗ Install jq"
```

### Install Missing Tools
```bash
# GitHub CLI
brew install gh              # macOS
sudo apt install gh          # Ubuntu/Debian
winget install GitHub.cli    # Windows

# Docker
# See: https://docs.docker.com/get-docker/

# jq
brew install jq              # macOS
sudo apt install jq          # Ubuntu/Debian
choco install jq             # Windows
```

### Authentication
```bash
# Authenticate GitHub CLI
gh auth login
gh auth status

# Login to GHCR (if pulling images)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

---

## 🚀 Step-by-Step Process

### Step 1: Build Triggered

When a Dockerfile is updated with new extension versions, the `codeserver-multiarch.yml` workflow is automatically triggered.

**Check if workflow was triggered:**
```bash
# List recent workflow runs
gh run list --workflow=codeserver-multiarch.yml --limit 5

# Example output:
# ✓ Build code-server multi-arch image  main  push      1234567  23m34s  completed  success
```

### Step 2: Monitor Build Progress

**Option A: Use our monitoring script (recommended)**
```bash
# Quick status check
./scripts/monitor-codeserver-build.sh

# Continuous monitoring (updates every 30s)
./scripts/monitor-codeserver-build.sh --watch
```

**Option B: Use GitHub CLI directly**
```bash
# Watch workflow in real-time
gh run watch

# View specific run
gh run view <RUN_ID>

# View logs
gh run view <RUN_ID> --log
```

**Option C: Use GitHub Web UI**
- Go to: https://github.com/ryanmaclean/vibecode-webgui/actions
- Click on "Build code-server multi-arch image"
- View latest run

### Step 3: Check Build Status

**What to look for:**
- ✅ Validation job completed (lint, typecheck, unit tests)
- ✅ Multi-arch build successful (AMD64 + ARM64)
- ✅ KinD smoke test passed
- ✅ Images pushed to GHCR
- ✅ SBOM generated
- ✅ Datadog metrics submitted

**Build duration:**
- Expected: 15-25 minutes
- Warning if: > 30 minutes
- Check logs if: > 45 minutes

### Step 4: Verify Extensions

Once build completes successfully, verify the extensions:

**Option A: Automated verification (recommended)**
```bash
# Run all 7 tests
./scripts/verify-codeserver-extensions.sh

# Expected output:
# 🔍 Code-Server Extension Verification
# ========================================
# ...
# ✓ Image Pull: Successfully pulled ...
# ✓ Extension List: Successfully retrieved extension list
# ✓ Cline Version: Version 3.32.6 matches expected 3.32.6
# ✓ Continue Version: Version 1.3.15 matches expected 1.3.15
# ✓ AMD64 Extensions: Both extensions found on AMD64 platform
# ✓ ARM64 Extensions: Both extensions found on ARM64 platform
# ✓ Container Startup: Container started successfully
# ========================================
# Summary
# ========================================
# Tests Passed: 7
# Tests Failed: 0
# ✓ All tests passed!
```

**Option B: Manual verification**
```bash
# Pull latest image
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest

# Check extension versions
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions | grep -E "saoudrizwan|continue"

# Expected output:
# saoudrizwan.claude-dev@3.32.6
# continue.continue@1.3.15
```

### Step 5: Functional Testing

Test extensions actually work:

```bash
# Start code-server
docker run -d --name test-codeserver \
  -p 8765:8765 \
  -e PASSWORD=test123 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest

# Wait for startup
sleep 10

# Access UI
open http://localhost:8765
# Or: http://localhost:8765

# In the UI:
# 1. Press Cmd/Ctrl+Shift+P (Command Palette)
# 2. Type "Cline" - should see Cline commands
# 3. Type "Continue" - should see Continue commands
# 4. Test basic functionality

# Cleanup
docker stop test-codeserver && docker rm test-codeserver
```

### Step 6: Update Documentation

If everything works:

```bash
# Update CHANGELOG if not already done
# Edit CHANGELOG.md and add:
# - Cline updated to 3.32.6
# - Continue updated to 1.3.15
# - Note profiles affected (ai, full)

# Commit changes (if any)
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for extension versions"
git push
```

### Step 7: Close Tracking Issue

If you created a monitoring issue:

1. Update all checkboxes to [x]
2. Add verification results
3. Close the issue with comment:
   ```
   ✅ Build verified successfully
   
   Verification results:
   - Cline 3.32.6: ✓ Installed and functional
   - Continue 1.3.15: ✓ Installed and functional
   - Multi-arch: ✓ AMD64 and ARM64 working
   - Container: ✓ Starts and runs correctly
   
   All 7 automated tests passed.
   ```

---

## 🚨 Troubleshooting

### Build Failed

**Check logs:**
```bash
# View failed run
gh run list --workflow=codeserver-multiarch.yml --status=failure --limit 1

# Get run ID and view logs
gh run view <RUN_ID> --log-failed
```

**Common issues:**
1. **Extension marketplace timeout**
   - Solution: Re-run workflow (`gh run rerun <RUN_ID>`)
   
2. **KinD smoke test failed**
   - Check KinD diagnostics artifacts
   - Review cluster logs
   
3. **Multi-arch build failed**
   - Check QEMU setup
   - Review architecture-specific errors

### Extensions Not Found

**Check extension IDs:**
```bash
# List all extensions in image
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions

# Compare with profile files
cat docker/code-server/profiles/full.txt
cat docker/code-server/profiles/ai.txt
```

**Possible issues:**
1. Extension ID typo in profile file
2. BuildKit cache issue (rebuild with --no-cache)
3. Marketplace unavailable during build

### Wrong Version Installed

**Check marketplace:**
```bash
# Visit marketplace page
open https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev
open https://marketplace.visualstudio.com/items?itemName=Continue.continue
```

**Solutions:**
1. Verify version exists on marketplace
2. Clear GitHub Actions cache
3. Rebuild with `--no-cache` flag
4. Check profile files for version pinning

### Container Won't Start

**Check container logs:**
```bash
docker logs test-codeserver

# Or run interactively to see errors
docker run -it --rm \
  -p 8765:8765 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest
```

**Common issues:**
1. Port already in use (try different port)
2. Permission issues (check volume mounts)
3. Extension compatibility issues

---

## 📊 Metrics & Reporting

### Build Metrics
- **Duration:** Should be 15-25 minutes
- **Image Size:** ~1.2GB for full profile
- **Success Rate:** Target 95%+
- **Extension Install Success:** 100%

### Datadog Dashboard
Check metrics at: https://app.datadoghq.com/dashboard/code-server-builds

**Key Metrics:**
- `codeserver.build.duration` - Build time
- `codeserver.build.status` - Success/failure
- `codeserver.build.image_size` - Image size per arch
- `codeserver.build.layers` - Layer count

---

## 📚 Documentation Reference

| Document | Purpose | Location |
|----------|---------|----------|
| Full Monitoring Guide | Comprehensive reference | `claudedocs/CODE_SERVER_BUILD_MONITORING_2025-10-01.md` |
| Quick Reference | Common commands | `docs/CODE_SERVER_BUILD_MONITORING_QUICK_REF.md` |
| Infrastructure README | Overview & setup | `docs/CODE_SERVER_MONITORING_README.md` |
| Implementation Summary | What was built | `claudedocs/CODE_SERVER_MONITORING_IMPLEMENTATION_SUMMARY.md` |
| This Guide | Step-by-step process | `docs/HOW_TO_MONITOR_CODESERVER_BUILDS.md` |

---

## 🎯 Quick Reference Card

```bash
# Monitor build
./scripts/monitor-codeserver-build.sh --watch

# Verify extensions
./scripts/verify-codeserver-extensions.sh

# Manual check
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions | grep -E "saoudrizwan|continue"

# Test container
docker run -d --name test -p 8765:8765 ghcr.io/ryanmaclean/vibecode-codeserver:latest
open http://localhost:8765
docker stop test && docker rm test

# Check logs
gh run list --workflow=codeserver-multiarch.yml --limit 5
gh run view <RUN_ID> --log
```

---

## ✅ Success Checklist

- [ ] Build triggered and running
- [ ] Monitoring script shows progress
- [ ] Build completes successfully (15-25 minutes)
- [ ] All validation tests pass
- [ ] KinD smoke test passes
- [ ] Images pushed to GHCR
- [ ] Verification script: 7/7 tests pass
- [ ] Cline 3.32.6 verified
- [ ] Continue 1.3.15 verified
- [ ] AMD64 platform working
- [ ] ARM64 platform working
- [ ] Container starts successfully
- [ ] Extensions load in UI
- [ ] Basic functionality works
- [ ] CHANGELOG updated
- [ ] Tracking issue closed

---

**Time Required:** ~30-45 minutes total (build + verification)
**Automation Level:** High - scripts handle most verification
**Manual Steps:** UI testing and documentation updates

🤖 Happy monitoring!
