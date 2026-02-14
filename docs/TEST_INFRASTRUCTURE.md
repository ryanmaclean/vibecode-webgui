# Test Infrastructure

This document describes the test infrastructure available for VibeCode development, including self-hosted runners, VM testing capabilities, and resource planning.

## Infrastructure Overview

### Available Hardware

VibeCode has access to significant test infrastructure across multiple machines:

#### Development Machines (macOS)

| Machine | CPU | RAM | Storage | Platform | Use Case |
|---------|-----|-----|---------|----------|----------|
| MBP M1 | Apple M1 | 16GB | 500GB | macOS | ARM64 native testing, vfkit/Apple VZ |
| Mac Studio | Apple M2 Ultra | 128GB | 2TB | macOS | ARM64 heavy workloads, multi-VM testing |

#### Linux Workstations (Production Testing)

| Machine | CPU | RAM | Storage | Platform | Use Case |
|---------|-----|-----|---------|----------|----------|
| workstation-1 | AMD Ryzen 9 5950x | 128GB | ~5TB | Linux | x86_64 native, QEMU/KVM, CI/CD |
| workstation-2 | AMD Ryzen 9 7950x | 128GB | ~5TB | Linux | x86_64 native, QEMU/KVM, parallel testing |
| workstation-3 | AMD Ryzen 9 5950x | 128GB | ~5TB | Linux | x86_64 native, load testing |
| workstation-4 | AMD Ryzen 9 7950x | 128GB | ~5TB | Linux | x86_64 native, integration testing |

**Total Linux Resources**: ~512GB RAM, ~20TB storage, 64-128 CPU cores

### Network Configuration

- All workstations on same local network
- SSH access configured for automation
- Shared NFS/Samba for build artifacts (optional)
- Datadog agents deployed for monitoring

## 1. Self-Hosted GitHub Actions Runners

Self-hosted runners enable CI/CD testing on actual hardware, avoiding GitHub's ARM64 runner limitations.

### Setup Instructions

#### Linux Workstation Runner

```bash
# On each Linux workstation
cd /opt
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.314.1.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.314.1/actions-runner-linux-x64-2.314.1.tar.gz
tar xzf ./actions-runner-linux-x64-2.314.1.tar.gz

# Configure runner (requires GitHub repo token)
./config.sh --url https://github.com/ryanmaclean/vibecode \
  --token <GITHUB_RUNNER_TOKEN> \
  --name "workstation-1-vm-testing" \
  --labels "self-hosted,linux,x64,vm-testing,qemu-kvm" \
  --work _work

# Install as systemd service
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

#### macOS Runner (M1/M2/M3/M4)

```bash
# On Mac Studio or MBP
cd ~/actions-runner
curl -o actions-runner-osx-arm64-2.314.1.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.314.1/actions-runner-osx-arm64-2.314.1.tar.gz
tar xzf ./actions-runner-osx-arm64-2.314.1.tar.gz

./config.sh --url https://github.com/ryanmaclean/vibecode \
  --token <GITHUB_RUNNER_TOKEN> \
  --name "mac-studio-arm64-testing" \
  --labels "self-hosted,macOS,ARM64,vm-testing,apple-vz" \
  --work _work

# Install as LaunchAgent
./svc.sh install
./svc.sh start
```

### Runner Labels Strategy

#### Deployed Runners (Wave 39+)

| Runner | Labels | Capabilities | Use Case |
|--------|--------|--------------|----------|
| **i7-zfs-pop** | `self-hosted`, `Linux`, `X64`, `vm-testing`, `qemu-only`, `pop-os` | QEMU (no KVM) | VM tests without hardware acceleration |
| **i9-zfs-pop** | `self-hosted`, `Linux`, `X64`, `pop-os` | KVM only (no QEMU yet) | Reserved for future VM testing |

**Status Notes:**
- ✅ **i7-zfs-pop**: ONLINE, runs VM tests via QEMU software emulation (slower but functional)
- ⏳ **i9-zfs-pop**: ONLINE, but QEMU not installed yet (will add `vm-testing`, `qemu-kvm` labels after installation)

See [RUNNER_LABEL_FIX.md](./RUNNER_LABEL_FIX.md) for label management commands.

#### Planned Runners (Future)

| Runner | Labels | Use Case |
|--------|--------|----------|
| workstation-1 | `self-hosted`, `linux`, `x64`, `vm-testing`, `qemu-kvm` | x86_64 VM testing, heavy parallel jobs |
| workstation-2 | `self-hosted`, `linux`, `x64`, `vm-testing`, `qemu-kvm`, `parallel` | Parallel test matrix |
| mac-studio | `self-hosted`, `macOS`, `ARM64`, `vm-testing`, `apple-vz` | ARM64 native VM testing |
| mbp-m1 | `self-hosted`, `macOS`, `ARM64`, `vm-testing`, `apple-vz`, `dev` | Development testing |

### Security Considerations

**Critical**: Self-hosted runners execute untrusted code from PRs.

#### Isolation Strategy

1. **Dedicated user accounts**: Run runners as unprivileged users
2. **Docker isolation**: Run tests inside Docker containers
3. **VM isolation**: Use ephemeral VMs for each test run
4. **No secrets on self-hosted**: Use GitHub's cloud runners for secret-dependent jobs
5. **Firewall rules**: Restrict runner network access
6. **Audit logging**: Enable detailed logging for all runner activity

#### Recommended GitHub Workflow Configuration

```yaml
# .github/workflows/vm-test-linux.yml
name: VM Testing (Linux x86_64)

on:
  pull_request:
    paths:
      - 'platforms/linux/**'
      - 'platforms/alpine/**'
      - 'src-tauri/src/vm/**'

jobs:
  vm-test-linux:
    runs-on: [self-hosted, linux, x64, vm-testing, qemu-kvm]
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      # Run in Docker for isolation
      - name: Run VM tests in Docker
        run: |
          docker run --rm \
            --privileged \
            -v /dev/kvm:/dev/kvm \
            -v $(pwd):/workspace \
            -w /workspace \
            ubuntu:22.04 \
            bash -c "apt-get update && apt-get install -y qemu-system-x86 && ./test-vm.sh"

      # Cleanup
      - name: Cleanup
        if: always()
        run: |
          docker system prune -f
          rm -rf _work/_temp/*
```

### Runner Maintenance

```bash
# Update runner
cd /opt/actions-runner
./svc.sh stop
./config.sh remove --token <GITHUB_REMOVE_TOKEN>
# Download new version
./config.sh --url ... --token <GITHUB_RUNNER_TOKEN>
./svc.sh start

# Monitor runner logs
journalctl -u actions.runner.ryanmaclean-vibecode.workstation-1-vm-testing.service -f

# Check runner status
./run.sh --once  # Test mode
```

## 2. VM Testing (QEMU/KVM)

### Linux Workstation Setup

#### Prerequisites

```bash
# Install QEMU/KVM on Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  qemu-system-x86 \
  qemu-system-arm \
  qemu-efi-aarch64 \
  qemu-utils \
  libvirt-daemon-system \
  libvirt-clients \
  bridge-utils

# Verify KVM support
sudo kvm-ok
# Expected: "KVM acceleration can be used"

# Add user to kvm group
sudo usermod -aG kvm $USER
newgrp kvm

# Verify /dev/kvm access
ls -la /dev/kvm
# Expected: crw-rw---- 1 root kvm
```

### Test Scenarios

#### Scenario 1: Native x86_64 Alpine Boot Test

**Objective**: Verify Alpine Linux kernel boots and initramfs unpacks on x86_64.

**Resources**: 2 vCPU, 4GB RAM, 10GB disk
**Duration**: ~30 seconds
**Automation**: Fully automated via CI

```bash
#!/bin/bash
# test-alpine-x86_64-boot.sh

set -e

KERNEL="platforms/alpine/linux/x86_64/vmlinuz-lts"
INITRAMFS="platforms/alpine/linux/x86_64/initramfs-lts"
DISK_IMG="/tmp/alpine-test-x86_64.qcow2"

# Create disk image
qemu-img create -f qcow2 "$DISK_IMG" 10G

# Boot VM with serial console
timeout 60 qemu-system-x86_64 \
  -machine q35,accel=kvm \
  -cpu host \
  -smp 2 \
  -m 4096 \
  -kernel "$KERNEL" \
  -initrd "$INITRAMFS" \
  -append "console=ttyS0 quiet" \
  -drive if=virtio,format=qcow2,file="$DISK_IMG" \
  -netdev user,id=net0 \
  -device virtio-net-pci,netdev=net0 \
  -nographic \
  -serial mon:stdio | tee /tmp/boot.log

# Verify boot success
grep -q "Welcome to Alpine Linux" /tmp/boot.log
echo "✓ Alpine Linux x86_64 boot test PASSED"

# Cleanup
rm -f "$DISK_IMG" /tmp/boot.log
```

**CI Integration**:
```yaml
# .github/workflows/vm-boot-x86_64.yml
- name: Boot Alpine x86_64 VM
  run: ./tests/vm/test-alpine-x86_64-boot.sh
  timeout-minutes: 2
```

#### Scenario 2: ARM64 Cross-Architecture Emulation Test

**Objective**: Verify Alpine ARM64 boot on x86_64 workstation via QEMU emulation.

**Resources**: 2 vCPU, 4GB RAM, 10GB disk
**Duration**: ~3 minutes (emulation is slow)
**Automation**: Nightly CI (too slow for every PR)

```bash
#!/bin/bash
# test-alpine-arm64-emulated.sh

set -e

KERNEL="platforms/alpine/linux/aarch64/vmlinuz-lts"
INITRAMFS="platforms/alpine/linux/aarch64/initramfs-lts"
DISK_IMG="/tmp/alpine-test-arm64.qcow2"
BIOS="/usr/share/AAVMF/AAVMF_CODE.fd"

qemu-img create -f qcow2 "$DISK_IMG" 10G

timeout 180 qemu-system-aarch64 \
  -machine virt \
  -cpu cortex-a72 \
  -smp 2 \
  -m 4096 \
  -bios "$BIOS" \
  -kernel "$KERNEL" \
  -initrd "$INITRAMFS" \
  -append "console=ttyAMA0 quiet" \
  -drive if=none,file="$DISK_IMG",id=hd0 \
  -device virtio-blk-device,drive=hd0 \
  -netdev user,id=net0 \
  -device virtio-net-device,netdev=net0 \
  -nographic \
  -serial mon:stdio | tee /tmp/boot-arm64.log

grep -q "Welcome to Alpine Linux" /tmp/boot-arm64.log
echo "✓ Alpine Linux ARM64 emulation test PASSED"

rm -f "$DISK_IMG" /tmp/boot-arm64.log
```

**Note**: Emulation is 10-100x slower than native/KVM. Use only for compatibility testing, not performance benchmarks.

#### Scenario 3: Service Health Check Test

**Objective**: Boot VM and verify all 5 services start successfully (SSH, PostgreSQL, Valkey, OpenVSCode, Docker).

**Resources**: 4 vCPU, 8GB RAM, 20GB disk
**Duration**: ~90 seconds after boot
**Automation**: Per-PR on self-hosted runners

```bash
#!/bin/bash
# test-alpine-services.sh

set -e

KERNEL="platforms/alpine/linux/x86_64/vmlinuz-lts"
INITRAMFS="platforms/alpine/linux/x86_64/initramfs-lts"
DISK_IMG="/tmp/alpine-test-services.qcow2"

qemu-img create -f qcow2 "$DISK_IMG" 20G

# Start VM in background with SSH forwarding
qemu-system-x86_64 \
  -machine q35,accel=kvm \
  -cpu host \
  -smp 4 \
  -m 8192 \
  -kernel "$KERNEL" \
  -initrd "$INITRAMFS" \
  -append "console=ttyS0 quiet" \
  -drive if=virtio,format=qcow2,file="$DISK_IMG" \
  -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5432-:5432,hostfwd=tcp::6379-:6379,hostfwd=tcp::8080-:8080,hostfwd=tcp::2375-:2375 \
  -device virtio-net-pci,netdev=net0 \
  -nographic \
  -daemonize \
  -pidfile /tmp/qemu-test.pid

# Wait for VM boot (max 60s)
for i in {1..60}; do
  nc -z localhost 2222 && break
  sleep 1
done

# Test SSH (port 22)
timeout 5 ssh -o StrictHostKeyChecking=no -p 2222 root@localhost 'echo "SSH OK"' || echo "✗ SSH failed"

# Test PostgreSQL (port 5432)
timeout 5 pg_isready -h localhost -p 5432 && echo "✓ PostgreSQL OK" || echo "✗ PostgreSQL failed"

# Test Valkey (port 6379)
timeout 5 redis-cli -h localhost -p 6379 ping && echo "✓ Valkey OK" || echo "✗ Valkey failed"

# Test OpenVSCode (port 8080)
timeout 5 curl -f http://localhost:8080 && echo "✓ OpenVSCode OK" || echo "✗ OpenVSCode failed"

# Test Docker (port 2375)
timeout 5 docker -H tcp://localhost:2375 version && echo "✓ Docker OK" || echo "✗ Docker failed"

# Cleanup
kill $(cat /tmp/qemu-test.pid)
rm -f "$DISK_IMG" /tmp/qemu-test.pid
```

**CI Integration**:
```yaml
# .github/workflows/vm-services.yml
- name: Test VM Services
  run: ./tests/vm/test-alpine-services.sh
  timeout-minutes: 5
```

### Resource Estimates per Test

| Test Type | vCPU | RAM | Disk | Duration | Parallelism |
|-----------|------|-----|------|----------|-------------|
| Boot test | 2 | 4GB | 10GB | 30s | 10x per machine |
| Service check | 4 | 8GB | 20GB | 90s | 5x per machine |
| ARM64 emulation | 2 | 4GB | 10GB | 3min | 4x per machine |
| Full integration | 4 | 8GB | 20GB | 3min | 4x per machine |

**Maximum parallel tests on one workstation (128GB RAM)**:
- Boot tests: 10-16 VMs simultaneously
- Service tests: 5-8 VMs simultaneously
- Integration tests: 4-6 VMs simultaneously

## 3. Container Testing (Docker)

For lighter-weight testing, use Docker containers instead of full VMs.

### Alpine Rootfs Container Test

```bash
#!/bin/bash
# test-alpine-rootfs-docker.sh

set -e

# Build Alpine rootfs image
docker build -t vibecode-alpine-rootfs -f - . <<'EOF'
FROM alpine:3.22
RUN apk add --no-cache \
  openssh-server \
  postgresql16 \
  redis \
  docker-cli
EOF

# Test services in container
docker run --rm vibecode-alpine-rootfs sh -c '
  ssh -V && echo "✓ SSH installed" &&
  postgres --version && echo "✓ PostgreSQL installed" &&
  redis-server --version && echo "✓ Redis installed" &&
  docker --version && echo "✓ Docker CLI installed"
'

echo "✓ Alpine rootfs container test PASSED"
```

**Advantages**:
- Fast: <5 seconds per test
- Lightweight: Minimal resource usage
- Easy CI: No KVM/virtualization required

**Limitations**:
- Cannot test kernel boot
- Cannot test VM-specific features (virtio, UEFI)
- Limited service integration testing

## 4. Storage Plan

### Disk Usage Estimates

| Category | Size | Location | Retention |
|----------|------|----------|-----------|
| VM disk images cache | 50GB | `/var/lib/vm-images/` | Persistent |
| Docker layer cache | 100GB | `/var/lib/docker/` | Auto-pruned |
| Build artifacts | 20GB | `/var/lib/ci-artifacts/` | 30 days |
| Test results | 10GB | `/var/lib/test-results/` | 90 days |
| Runner work directory | 50GB | `/opt/actions-runner/_work/` | Per-job |
| Logs | 20GB | `/var/log/vm-tests/` | 7 days |
| **Total** | **250GB** | | |

**Available**: ~20TB across 4 workstations → 19.75TB headroom

### Storage Management

```bash
# Cleanup old VM images (keep last 10 runs)
find /var/lib/vm-images/ -name "*.qcow2" -mtime +7 -delete

# Prune Docker
docker system prune -af --volumes

# Archive old test results
tar -czf test-results-$(date +%F).tar.gz /var/lib/test-results/
mv test-results-*.tar.gz /archive/
rm -rf /var/lib/test-results/*

# Rotate logs
logrotate /etc/logrotate.d/vm-tests
```

## 5. CI/CD Integration

### GitHub Actions Matrix Strategy

```yaml
# .github/workflows/vm-test-matrix.yml
name: VM Test Matrix

on:
  pull_request:
    paths:
      - 'platforms/**'
      - 'src-tauri/src/vm/**'

jobs:
  test-matrix:
    strategy:
      fail-fast: false
      matrix:
        include:
          # x86_64 native tests (fast, every PR)
          - runner: [self-hosted, linux, x64, vm-testing]
            arch: x86_64
            platform: linux
            test_type: boot
            timeout: 2

          - runner: [self-hosted, linux, x64, vm-testing]
            arch: x86_64
            platform: linux
            test_type: services
            timeout: 5

          # ARM64 native tests (Mac Studio)
          - runner: [self-hosted, macOS, ARM64, vm-testing]
            arch: aarch64
            platform: macos
            test_type: boot
            timeout: 2

          - runner: [self-hosted, macOS, ARM64, vm-testing]
            arch: aarch64
            platform: macos
            test_type: services
            timeout: 5

          # ARM64 emulation (nightly only, slow)
          - runner: [self-hosted, linux, x64, vm-testing]
            arch: aarch64
            platform: linux-emulated
            test_type: boot
            timeout: 10

    runs-on: ${{ matrix.runner }}
    timeout-minutes: ${{ matrix.timeout }}

    steps:
      - uses: actions/checkout@v4

      - name: Run VM test
        run: |
          ./tests/vm/test-${{ matrix.test_type }}-${{ matrix.arch }}.sh

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.platform }}-${{ matrix.arch }}-${{ matrix.test_type }}
          path: /tmp/test-results/
          retention-days: 30
```

### Datadog Integration

Monitor VM tests in Datadog for metrics and alerting:

```bash
# Send test metrics to Datadog
curl -X POST "https://api.datadoghq.com/api/v1/series" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d @- <<EOF
{
  "series": [{
    "metric": "vibecode.vm.test.duration",
    "points": [[$EPOCH_TIME, $DURATION_SECONDS]],
    "type": "gauge",
    "tags": ["platform:$PLATFORM", "arch:$ARCH", "test_type:$TEST_TYPE"]
  }]
}
EOF
```

**Dashboards**:
- VM test success rate (by platform/arch)
- Test duration trends
- Resource utilization during tests
- Failed test alerts

## 6. Monitoring and Alerting

### Datadog Alerts

```yaml
# Datadog Monitor: VM Test Failure Rate
name: "VM Test Failure Rate High"
type: metric alert
query: "avg(last_1h):sum:vibecode.vm.test.failures{*} > 5"
message: |
  VM tests are failing at a high rate.
  Check recent CI runs and runner logs.
tags:
  - team:vibecode
  - service:vm-testing
```

### Runner Health Checks

```bash
#!/bin/bash
# runner-healthcheck.sh
# Run via cron every 5 minutes

RUNNER_PID=$(pgrep -f "Runner.Listener")
if [ -z "$RUNNER_PID" ]; then
  echo "Runner not running, restarting..."
  cd /opt/actions-runner
  ./svc.sh start
fi

# Check disk space
DISK_USAGE=$(df -h /opt/actions-runner | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
  echo "Disk usage high: ${DISK_USAGE}%"
  docker system prune -af
fi
```

## 7. Future Enhancements

### Cloud CI (GitHub Larger Runners)

For PRs from external contributors, use GitHub's cloud runners with nested virtualization:

```yaml
jobs:
  vm-test-cloud:
    runs-on: ubuntu-latest-8-cores  # GitHub larger runner
    steps:
      - name: Enable KVM
        run: |
          sudo apt-get install -y qemu-system-x86
          # Nested virtualization check
          cat /proc/cpuinfo | grep vmx || echo "No nested KVM"
```

**Cost**: ~$0.064/min for 8-core runner → ~$0.05 per VM test

### Container-Based Service Testing

Replace full VMs with Docker Compose for faster service tests:

```yaml
# docker-compose.test.yml
services:
  postgres:
    image: postgres:16-alpine
  valkey:
    image: valkey/valkey:7.2-alpine
  openvscode:
    image: gitpod/openvscode-server:latest
```

```bash
docker-compose -f docker-compose.test.yml up -d
# Run health checks
docker-compose -f docker-compose.test.yml down
```

**Advantages**: 10x faster, no VM overhead
**Limitations**: Doesn't test kernel, initramfs, or VM-specific features

## Related Documentation

- [VM_LAUNCH_METHODS.md](VM_LAUNCH_METHODS.md) - VM hypervisor documentation
- [BUILD_GUIDE.md](BUILD_GUIDE.md) - Building VibeCode from source
- [CI.md](CI.md) - CI/CD pipeline documentation

## Related Issues

- [#1850 - Alpine Linux VM: Boot, but services fail to start (macOS)](https://github.com/ryanmaclean/vibecode/issues/1850)
- [#1851 - Test Alpine Linux VM on x86_64 Linux with QEMU/KVM](https://github.com/ryanmaclean/vibecode/issues/1851)
- [#1866 - Implement health check retries and timeout improvements for VM services](https://github.com/ryanmaclean/vibecode/issues/1866)
- [#1867 - Validate VM services integration: SSH, PostgreSQL, Valkey, OpenVSCode, Docker](https://github.com/ryanmaclean/vibecode/issues/1867)
- [#1877 - Document VM launch methods (vfkit, QEMU, Lima)](https://github.com/ryanmaclean/vibecode/issues/1877)

## Appendix: Quick Commands

```bash
# Check KVM support
sudo kvm-ok

# List running VMs
ps aux | grep qemu

# Kill all test VMs
pkill -f qemu-system

# Monitor runner
journalctl -u actions.runner.*.service -f

# Docker cleanup
docker system prune -af --volumes

# VM disk usage
du -sh /var/lib/vm-images/

# Test results archive
tar -czf test-archive-$(date +%F).tar.gz /var/lib/test-results/
```
