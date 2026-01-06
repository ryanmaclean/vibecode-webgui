# VibeCode VM Automation Framework

Complete automation for building, testing, and deploying specialized VMs.

## Quick Start

### Build All VMs
```bash
cd ~/vibecode-webgui/scripts
bash build-all-vms.sh
```

### Test All VMs
```bash
bash test-specialized-vms.sh
```

### Deploy a VM
```bash
bash deploy-vm.sh valkey valkey-standalone-complete.cpio.gz
```

## Individual Scripts

### Build Scripts
- `build-all-vms.sh` - Master build script
- `build-valkey-vm.sh` - Build Valkey VM
- `build-unified-vm.sh` - Build Unified VM
- `rebuild-postgresql-docker.sh` - Build PostgreSQL VM (Docker)

### Test Scripts
- `test-specialized-vms.sh` - Master test script
- `test-valkey-vm.sh` - Test Valkey VM
- `test-postgresql-vm.sh` - Test PostgreSQL VM
- `test-unified-vm.sh` - Test Unified VM

### Deployment Scripts
- `deploy-vm.sh` - Deploy any VM
- `ci-test.sh` - CI/CD integration

## Prerequisites

Required:
- Docker (for PostgreSQL build)

Optional (for testing):
- redis-cli: `brew install redis`
- psql: `brew install postgresql`

## CI/CD Integration

```yaml
# .github/workflows/vm-tests.yml
name: VM Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - run: bash scripts/ci-test.sh
```

## Build Process

The master build script:
1. Checks prerequisites (Docker, etc.)
2. Builds each VM in sequence
3. Reports success/failure for each
4. Generates build summary

## Test Process

The master test script:
1. Validates initramfs exists
2. Extracts and checks contents
3. Verifies binaries and libraries
4. Checks init scripts
5. Reports pass/fail for each VM

## Deployment

Deploy any VM to a running instance:

```bash
# Deploy Valkey
bash deploy-vm.sh valkey valkey-standalone-complete.cpio.gz

# Deploy PostgreSQL
bash deploy-vm.sh postgresql postgresql-standalone-complete.cpio.gz

# Deploy Unified
bash deploy-vm.sh unified unified-services-restored.cpio.gz
```

## Error Handling

All scripts:
- Exit on error (`set -e`)
- Check prerequisites
- Validate inputs
- Provide clear error messages
- Clean up temporary files

## Reproducibility

Scripts are designed to:
- Work on any Mac with prerequisites
- Produce identical results
- Be version-controlled
- Self-document their actions
- Fail gracefully with helpful messages
