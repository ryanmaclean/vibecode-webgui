# VM Integration Tests

QEMU-based integration tests for the VibeCode VM boot chain. These tests verify that Alpine Linux kernels, initramfs images, and full VM disk images boot correctly and that services start as expected.

## Overview

This test suite validates:

1. **Kernel Boot** - Verifies Alpine kernel boots to login prompt
2. **Initramfs Unpack** - Validates initramfs loads and /init executes
3. **Service Startup** - Checks SSH, PostgreSQL, and Valkey services start correctly

## Prerequisites

### macOS

```bash
brew install qemu
```

### Linux

```bash
# Ubuntu/Debian
sudo apt-get install qemu-system-x86 qemu-system-arm

# Fedora/RHEL
sudo dnf install qemu-system-x86 qemu-system-aarch64
```

## Quick Start

Run all tests:

```bash
./run-all.sh
```

Run specific test:

```bash
./run-all.sh kernel-boot
./run-all.sh initramfs
./run-all.sh services
```

## Test Scripts

### `common.sh`

Shared functions used by all tests:

- **Output functions**: `pass()`, `fail()`, `warn()`, `info()`
- **Prerequisites**: `check_qemu()`, `check_kvm()`, `check_arch()`
- **Utilities**: `download_alpine_kernel()`, `build_qemu_cmd()`, `wait_for_string()`, `check_port()`

### `test-kernel-boot.sh`

Validates kernel boots to init system:

- Downloads Alpine kernel/initramfs if not cached
- Boots with QEMU (2GB RAM, 2 CPUs, serial console)
- Waits for "Welcome to Alpine Linux" or login prompt
- Timeout: 120 seconds
- **PASS**: Boot messages detected
- **FAIL**: Kernel panic or timeout

Usage:

```bash
./test-kernel-boot.sh [x86_64|aarch64]
```

### `test-initramfs.sh`

Verifies initramfs unpacks and /init executes:

- Boots with debug logging enabled
- Checks for initramfs unpack messages
- Verifies rootfs mount
- Confirms /init process starts
- **PASS**: At least 2 initramfs checks succeed
- **FAIL**: Fewer than 2 checks pass

Usage:

```bash
./test-initramfs.sh [x86_64|aarch64]
```

### `test-services.sh`

Validates services start in full VM (requires built disk images):

- Searches for VM disk images in `dist/vm-images/`
- Boots with port forwarding:
  - SSH: `localhost:2222` → VM:22
  - PostgreSQL: `localhost:5432` → VM:5432
  - Valkey: `localhost:6379` → VM:6379
- Tests each service with `nc -z`
- **PASS**: At least 1 service responds
- **SKIP**: No disk images available

Usage:

```bash
./test-services.sh [x86_64|aarch64]
```

### `test-boot-chain.sh`

Full E2E orchestrator:

- Runs all tests in sequence
- Generates summary report
- Tracks pass/fail/skip counts
- Exit code 0 if all tests pass

Usage:

```bash
./test-boot-chain.sh [x86_64|aarch64]
```

### `run-all.sh`

Main entry point with argument parsing:

```bash
Usage: ./run-all.sh [OPTIONS] [TEST]

OPTIONS:
  --arch ARCH          Set architecture (x86_64 or aarch64, default: x86_64)
  --quick              Run in quick mode (skip slow tests)
  --verbose            Enable verbose output
  -h, --help           Show this help message

TEST:
  kernel-boot          Test kernel boot to login prompt
  initramfs            Test initramfs unpacking
  services             Test service startup
  boot-chain           Run full E2E test suite (default)

EXAMPLES:
  ./run-all.sh                           # Run all tests (x86_64)
  ./run-all.sh --arch aarch64            # Run all tests on ARM64
  ./run-all.sh kernel-boot               # Run only kernel boot test
  ./run-all.sh --quick boot-chain        # Run quick boot chain tests
  ./run-all.sh --verbose services        # Run services test with verbose output
```

## QEMU Configuration

All tests use these QEMU flags:

- `-nographic -serial mon:stdio` - Headless mode with serial console
- `-m 2048` - 2GB RAM
- `-smp 2` - 2 CPU cores
- `-enable-kvm -cpu host` - KVM acceleration (if `/dev/kvm` exists)
- `-cpu max` - Maximum CPU features (fallback without KVM)

## Output

Each test creates a temporary output file in `~/.cache/vibecode-vm-tests/` to capture VM console logs. These files are cleaned up on exit.

### Success Example

```
ℹ INFO: Starting test: Kernel Boot
ℹ INFO: Architecture: x86_64
ℹ INFO: QEMU found: QEMU emulator version 8.2.0
✓ PASS: Kernel booted successfully - 'Welcome to Alpine Linux' message found
✓ PASS: Kernel Boot completed successfully
```

### Failure Example

```
ℹ INFO: Starting test: Kernel Boot
⚠ WARN: No KVM - tests will be slow (expected on macOS)
✗ FAIL: Kernel panic detected
✗ FAIL: Kernel Boot did not complete successfully
```

## CI Integration

These tests are designed to run in GitHub Actions on self-hosted runners with QEMU installed. See `.github/workflows/vm-integration-tests.yml` for the CI configuration.

## Troubleshooting

### Tests timeout on macOS

macOS does not support KVM, so QEMU runs without hardware acceleration. This is expected - tests will be slower but should still pass.

### "QEMU not installed" error

Install QEMU:

```bash
brew install qemu  # macOS
sudo apt-get install qemu-system-x86 qemu-system-arm  # Linux
```

### Disk images not found (services test)

The services test requires pre-built VM disk images. Build them first:

```bash
cd scripts/vfkit
./06-create-vibecode-rootfs.sh
```

Disk images should be in `dist/vm-images/`.

### Boot hangs or fails

Check the console output in `~/.cache/vibecode-vm-tests/vm-test-output.*` for kernel panic or error messages.

## Architecture Support

- **x86_64**: Fully supported (uses `qemu-system-x86_64`)
- **aarch64**: Supported (uses `qemu-system-aarch64`, slower without KVM on macOS)

## Related Documentation

- [scripts/vfkit/](../../scripts/vfkit/) - VM build and launch scripts
- [.github/workflows/vm-integration-tests.yml](../../.github/workflows/vm-integration-tests.yml) - CI workflow
- GitHub Issues: #1850, #1867 - VM boot chain testing requirements
