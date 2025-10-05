# OpenVSCode VM Workflow - Stable + Insiders

## Overview
This document describes the workflow for building and managing both stable and insiders versions of OpenVSCode microVMs for rapid development environments.

## Build Profiles

### Stable Channel
- **Source**: Latest stable OpenVSCode release from GitHub
- **Update Frequency**: Monthly or on security patches
- **Target Users**: Production environments, stable development
- **Verification**: Full test suite + 7-day soak period

### Insiders Channel  
- **Source**: Latest insiders/nightly build
- **Update Frequency**: Daily automated builds
- **Target Users**: Early adopters, testing new features
- **Verification**: Smoke tests only

## Automated Build Pipeline

### Daily Workflow (Insiders)
```yaml
# .github/workflows/openvscode-insiders.yml
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:

jobs:
  build-insiders:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch latest insiders
        run: ./scripts/fetch-openvscode-insiders.sh
      
      - name: Build microVM
        run: ./scripts/build-openvscode-vm.sh --channel insiders
      
      - name: Run smoke tests
        run: ./scripts/test-openvscode-vm.sh --quick
      
      - name: Publish to registry
        run: ./scripts/publish-vm-artifact.sh --tag insiders-$(date +%Y%m%d)
```

### Monthly Workflow (Stable)
```yaml
# .github/workflows/openvscode-stable.yml
on:
  schedule:
    - cron: '0 3 1 * *'  # 3 AM on 1st of month
  workflow_dispatch:

jobs:
  build-stable:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch latest stable
        run: ./scripts/fetch-openvscode-stable.sh
      
      - name: Build microVM
        run: ./scripts/build-openvscode-vm.sh --channel stable
      
      - name: Full test suite
        run: ./scripts/test-openvscode-vm.sh --full
      
      - name: Soak test (7 days)
        run: ./scripts/soak-test-vm.sh --duration 7d
      
      - name: Publish to registry
        run: ./scripts/publish-vm-artifact.sh --tag stable-v$(cat VERSION)
```

## Local Development

### Building Locally
```bash
# Stable build
./scripts/build-openvscode-vm.sh --channel stable --arch arm64

# Insiders build
./scripts/build-openvscode-vm.sh --channel insiders --arch arm64
```

### Testing Locally
```bash
# Quick smoke test
./scripts/test-openvscode-vm.sh --quick --channel insiders

# Full test suite
./scripts/test-openvscode-vm.sh --full --channel stable
```

### Switching Between Channels
```bash
# Use stable
./scripts/switch-openvscode-channel.sh stable

# Use insiders
./scripts/switch-openvscode-channel.sh insiders
```

## Nightly Verification Checklist

See [docs/nightly-vm-verification.md](./nightly-vm-verification.md) for the automated verification checklist that runs every night.

## Release Process

### Insiders Prerelease
1. Daily build completes successfully
2. Smoke tests pass
3. Automatically tagged with date: `insiders-YYYYMMDD`
4. Available in registry within 5 minutes

### Stable Release
1. Monthly build completes
2. Full test suite passes (100% required)
3. 7-day soak test passes
4. Manual approval by maintainer
5. Tagged with version: `stable-vX.Y.Z`
6. Promoted to production registry

## Monitoring

- **Build Status**: Check GitHub Actions workflows
- **Artifact Size**: Monitor for bloat (target <500MB)
- **Boot Time**: Track cold boot performance (target <10s)
- **Test Results**: Review in Datadog dashboards

## Troubleshooting

### Build Failures
- Check OpenVSCode upstream for breaking changes
- Review build logs in GitHub Actions
- Verify dependency versions

### Test Failures
- Compare with previous stable version
- Check for environment-specific issues
- Run locally with verbose logging

## Architecture

See related documentation:
- [MiniVim Kernel](./virtualization/minivim-kernel.md)
- [Fast OpenVSCode](../bench-images/README.md)
- [Benchmarking](../scripts/benchmarks/README-minivim.md)
