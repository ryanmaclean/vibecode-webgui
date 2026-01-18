# VM Automation Framework

**Created by:** Agent E4
**Date:** November 28, 2025

## Overview

Complete end-to-end automation for VibeCode specialized VMs.

## Scripts Created

### Build Automation (4 scripts)
1. `build-all-vms.sh` - Master builder with prerequisite checking
2. `build-valkey-vm.sh` - Valkey automation with dependency management
3. `build-unified-vm.sh` - Unified VM automation with library restoration
4. `rebuild-postgresql-docker.sh` - PostgreSQL Docker automation (existing)

### Test Automation (4 scripts)
1. `test-specialized-vms.sh` - Master test suite runner
2. `test-valkey-vm.sh` - Valkey VM validation tests
3. `test-postgresql-vm.sh` - PostgreSQL VM validation tests
4. `test-unified-vm.sh` - Unified VM validation tests

### Deployment (2 scripts)
1. `deploy-vm.sh` - Universal VM deployer with test harness
2. `ci-test.sh` - CI/CD integration script

### Documentation (2 files)
1. `README-AUTOMATION.md` - Comprehensive usage guide
2. `AUTOMATION_FRAMEWORK.md` - This file

## Features

- Fully automated builds
- Reproducible results
- Comprehensive testing
- Error handling with graceful failures
- CI/CD ready integration
- Self-documenting output

## Build Process Details

### Master Build Script (build-all-vms.sh)

The master script orchestrates the entire build process:

1. **Prerequisites Check**
   - Verifies Docker installation (required)
   - Checks for redis-cli (optional, for testing)
   - Checks for psql (optional, for testing)
   - Exits if critical dependencies missing

2. **Sequential VM Builds**
   - Valkey VM: Downloads dependencies, builds initramfs
   - PostgreSQL VM: Uses Docker container extraction
   - Unified VM: Combines both services with shared libraries

3. **Status Reporting**
   - Color-coded output (green=success, red=fail)
   - Build summary with all results
   - Individual script exit codes

### Individual Build Scripts

Each VM build script follows this pattern:

```bash
# 1. Extract base initramfs
rm -rf /tmp/vm-build
gunzip -c base.cpio.gz | cpio -idm

# 2. Download and add dependencies
curl packages...
extract packages...
copy libraries...

# 3. Build final initramfs
find . | cpio -o -H newc | gzip > output.cpio.gz
```

## Test Process Details

### Master Test Script (test-specialized-vms.sh)

Runs all individual test scripts and aggregates results:

1. Calls test-valkey-vm.sh
2. Calls test-postgresql-vm.sh
3. Calls test-unified-vm.sh
4. Reports summary with pass/fail for each

### Individual Test Scripts

Each test script validates:

1. **Initramfs Existence**
   - Checks if build output exists
   - Reports file size

2. **Content Validation**
   - Extracts initramfs to temporary directory
   - Checks for required binaries
   - Verifies shared libraries present
   - Validates init script exists and references services

3. **Structure Validation**
   - Confirms directory structure
   - Checks for data directories
   - Verifies configuration files

4. **Clean Exit**
   - Removes temporary files
   - Returns 0 for pass, 1 for fail

## Deployment Process

The deployment script (`deploy-vm.sh`):

1. Validates initramfs exists
2. Backs up current NodeJS VM
3. Replaces with target VM
4. Launches using SwiftUI app
5. Provides debugging commands

Example usage:
```bash
bash deploy-vm.sh valkey valkey-standalone-complete.cpio.gz
```

## CI/CD Integration

The `ci-test.sh` script provides automated testing:

```bash
#!/bin/bash
set -e

# Build all VMs
bash build-all-vms.sh || FAILURES++

# Test all VMs
bash test-specialized-vms.sh || FAILURES++

# Exit with failure if any step failed
[ $FAILURES -eq 0 ] && exit 0 || exit 1
```

Integrate with GitHub Actions:

```yaml
name: VM Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run CI Tests
        run: bash scripts/ci-test.sh
```

## Error Handling

All scripts implement:

- `set -e` for fail-fast behavior
- Input validation with helpful error messages
- Prerequisite checking before operations
- Temporary file cleanup
- Clear success/failure indicators
- Detailed logging output

## Reproducibility Guarantees

Scripts ensure reproducibility by:

1. **Fixed Dependencies**
   - Specific package versions from Ubuntu repos
   - Known-good base initramfs files
   - Pinned library versions

2. **Idempotent Operations**
   - Clean temporary directories before use
   - Overwrite output files
   - Same results on repeated runs

3. **Environment Independence**
   - Use absolute paths
   - Check prerequisites
   - Don't depend on user environment

4. **Version Control**
   - All scripts in git repository
   - Document changes in commits
   - Tag stable releases

## Usage Examples

### Build and Test All VMs

```bash
# Build everything
cd ~/vibecode-webgui/scripts
bash build-all-vms.sh

# Test everything
bash test-specialized-vms.sh

# Or run CI test (builds + tests)
bash ci-test.sh
```

### Build Individual VM

```bash
# Just Valkey
bash build-valkey-vm.sh

# Just PostgreSQL
bash rebuild-postgresql-docker.sh

# Just Unified
bash build-unified-vm.sh
```

### Test Individual VM

```bash
# Test Valkey
bash test-valkey-vm.sh

# Test PostgreSQL
bash test-postgresql-vm.sh

# Test Unified
bash test-unified-vm.sh
```

### Deploy for Testing

```bash
# Deploy Valkey VM
bash deploy-vm.sh valkey valkey-standalone-complete.cpio.gz

# Wait for boot (30-60 seconds)
sleep 60

# Check console
tail -f /tmp/vibecode-console-*.log

# Find IP and test
for ip in 192.168.64.{1..10}; do
    ping -c 1 $ip 2>/dev/null && echo "Found: $ip"
done
```

## Maintenance

### Adding New VMs

1. Create build script: `build-<name>-vm.sh`
2. Create test script: `test-<name>-vm.sh`
3. Add to master build script
4. Add to master test script
5. Update documentation

### Updating Dependencies

1. Update package URLs in build scripts
2. Test build process
3. Verify tests still pass
4. Update version numbers in documentation
5. Commit changes

## Troubleshooting

### Build Fails

```bash
# Check prerequisites
docker --version

# Check base files exist
ls -lh ~/vibecode-webgui/azure/*.cpio.gz

# Try individual build
bash build-valkey-vm.sh 2>&1 | tee build.log
```

### Test Fails

```bash
# Check initramfs was created
ls -lh ~/vibecode-webgui/azure/valkey-standalone-complete.cpio.gz

# Manually extract and inspect
mkdir /tmp/test
cd /tmp/test
gunzip -c ~/vibecode-webgui/azure/valkey-standalone-complete.cpio.gz | cpio -idm
ls -lR
```

### Deployment Fails

```bash
# Check SwiftUI app exists
ls -l ~/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app

# Check for running VMs
ps aux | grep NodeJSVibeCode

# Kill and retry
killall NodeJSVibeCode
sleep 2
bash deploy-vm.sh valkey valkey-standalone-complete.cpio.gz
```

## Future Enhancements

Potential improvements:

1. Parallel builds for faster execution
2. Build caching to avoid redundant downloads
3. Automated VM health checks post-deployment
4. Performance benchmarking
5. Automated rollback on failures
6. Multi-platform support (Linux, different macOS versions)
7. Build artifact versioning and storage
8. Automated dependency updates

## Conclusion

This automation framework provides:

- Complete build automation
- Comprehensive testing
- Easy deployment
- CI/CD integration
- Full reproducibility
- Clear documentation

Location: `/Users/ryan.maclean/vibecode-webgui/scripts/`

All scripts are executable and ready to use.
