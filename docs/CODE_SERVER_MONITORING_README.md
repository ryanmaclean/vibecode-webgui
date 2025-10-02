# Code-Server Extension Build Monitoring

This directory contains the infrastructure for monitoring and verifying code-server extension update builds.

## 📁 Files

### Documentation
- **`claudedocs/CODE_SERVER_BUILD_MONITORING_2025-10-01.md`** - Comprehensive build monitoring guide with checklists, commands, and troubleshooting
- **`docs/CODE_SERVER_BUILD_MONITORING_QUICK_REF.md`** - Quick reference for common monitoring commands
- **`claudedocs/CODE_SERVER_EXTENSIONS_UPDATE_2025-10-01.md`** - Details of the Cline 3.32.6 and Continue 1.3.15 updates

### Scripts
- **`scripts/monitor-codeserver-build.sh`** - Automated workflow monitoring with status checks
- **`scripts/verify-codeserver-extensions.sh`** - Automated extension version verification

### Templates
- **`.github/ISSUE_TEMPLATE/code-server-build-monitoring.md`** - Issue template for tracking future builds

## 🚀 Quick Start

### Monitor Active Build

```bash
# Check latest workflow run
./scripts/monitor-codeserver-build.sh

# Watch workflow continuously
./scripts/monitor-codeserver-build.sh --watch

# Or use gh CLI directly
gh run watch
```

### Verify Built Image

```bash
# Run automated verification
./scripts/verify-codeserver-extensions.sh

# Or verify manually
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions | grep -E "saoudrizwan|continue"
```

Expected output:
```
saoudrizwan.claude-dev@3.32.6
continue.continue@1.3.15
```

## 📊 Monitoring Scripts

### monitor-codeserver-build.sh

Monitors GitHub Actions workflow runs for the codeserver-multiarch.yml workflow.

**Features:**
- Fetches latest workflow run status
- Calculates build duration
- Checks for success/failure
- Provides next steps based on status
- Optional continuous monitoring with `--watch`

**Usage:**
```bash
./scripts/monitor-codeserver-build.sh           # Check once
./scripts/monitor-codeserver-build.sh --watch   # Continuous monitoring
```

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- `jq` for JSON parsing

### verify-codeserver-extensions.sh

Verifies extension versions in the built code-server image.

**Tests:**
1. Image pull from registry
2. Extension list retrieval
3. Cline version verification (3.32.6)
4. Continue version verification (1.3.15)
5. AMD64 platform verification
6. ARM64 platform verification
7. Container startup test

**Usage:**
```bash
# Use default image
./scripts/verify-codeserver-extensions.sh

# Verify specific image
IMAGE_NAME=ghcr.io/ryanmaclean/vibecode-codeserver:stable \
  ./scripts/verify-codeserver-extensions.sh
```

**Requirements:**
- Docker installed and running
- Access to GHCR registry

## 📝 Using the Issue Template

When monitoring a new extension build, create a tracking issue:

1. Go to GitHub Issues → New Issue
2. Select "Code-Server Extension Build Monitoring" template
3. Fill in extension names and versions
4. Update checklists as build progresses
5. Close issue when verification complete

## 🎯 Build Verification Checklist

### Pre-Build
- [ ] Dockerfile updated with new extension versions
- [ ] Profile files updated (ai.txt, full.txt)
- [ ] Documentation updated
- [ ] Workflow triggered

### Build Monitoring
- [ ] Workflow starts successfully
- [ ] Validation tests pass (lint, typecheck, unit)
- [ ] Multi-arch build completes
- [ ] KinD smoke test passes
- [ ] Images pushed to GHCR
- [ ] SBOM generated

### Post-Build Verification
- [ ] Run `./scripts/verify-codeserver-extensions.sh`
- [ ] All 7 tests pass
- [ ] Extensions work in both AMD64 and ARM64
- [ ] Container starts successfully
- [ ] Manual functionality test passed

### Documentation
- [ ] Update CHANGELOG.md
- [ ] Update monitoring document
- [ ] Close tracking issue

## 📚 Related Documentation

- **Workflows:**
  - `.github/workflows/codeserver-multiarch.yml` - Primary multi-arch build workflow
  - `.github/workflows/codeserver-profiles.yml` - Profile-specific builds
  
- **Docker:**
  - `docker/code-server/Dockerfile` - Main Dockerfile with extension installation
  - `docker/code-server/profiles/` - Extension profile lists
  - `docker/code-server/MULTIARCH_BUILD.md` - Multi-arch build guide

- **Monitoring:**
  - `claudedocs/CODE_SERVER_BUILD_MONITORING_2025-10-01.md` - Full monitoring guide
  - `docs/CODE_SERVER_BUILD_MONITORING_QUICK_REF.md` - Quick reference

## 🔧 Troubleshooting

### Scripts Not Executable

```bash
chmod +x scripts/monitor-codeserver-build.sh
chmod +x scripts/verify-codeserver-extensions.sh
```

### GitHub CLI Not Authenticated

```bash
gh auth login
gh auth status
```

### Docker Permission Denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo
sudo ./scripts/verify-codeserver-extensions.sh
```

### Image Not Found

```bash
# Verify image exists
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest

# Check workflow completed successfully
gh run list --workflow=codeserver-multiarch.yml --limit 1
```

### Extension Version Mismatch

1. Check marketplace for current version
2. Verify Dockerfile has correct version in comments
3. Clear BuildKit cache: `docker buildx prune`
4. Trigger rebuild: `gh workflow run codeserver-multiarch.yml`

## 🤖 Automation

The monitoring infrastructure is designed to be:

1. **Automated** - Scripts can run without manual intervention
2. **Verifiable** - All tests have pass/fail criteria
3. **Documented** - Clear output and error messages
4. **Reusable** - Templates for future builds

### CI/CD Integration

The scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Verify extensions
  run: ./scripts/verify-codeserver-extensions.sh
```

### Scheduled Monitoring

Monitor builds on a schedule:

```bash
# Add to crontab
*/30 * * * * cd /path/to/repo && ./scripts/monitor-codeserver-build.sh
```

## 📊 Metrics

The monitoring infrastructure tracks:

- Build duration (target: 15-25 minutes)
- Build success rate
- Extension installation success
- Multi-arch compatibility
- Container startup reliability

These metrics are also sent to Datadog for observability.

## 🎯 Future Enhancements

- [ ] Slack/Discord notifications on build completion
- [ ] Automatic CHANGELOG updates
- [ ] Extension functionality tests
- [ ] Performance regression detection
- [ ] Automated issue closing on success
- [ ] Integration with Dependabot for extension updates

## 📞 Support

For issues with the monitoring infrastructure:

1. Check this README
2. Review script output for error messages
3. Check GitHub Actions logs
4. Consult full monitoring guide in `claudedocs/`
5. Open an issue with the `build-monitoring` label

---

**Last Updated:** 2025-10-01
**Maintainer:** VibeCode Team
