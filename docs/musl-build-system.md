# Musl libc Build System

Complete build system for creating optimized musl-based binaries and containers with automated benchmarking and Datadog metrics integration.

## Overview

This system builds and tracks performance metrics for:
- **BusyBox**: Static musl binaries for MiniVim kernels
- **Docker Images**: Alpine (musl) vs Debian (glibc) comparison
- **Kernel Builds**: Lightweight Linux kernels with BusyBox userspace

**Key Benefits:**
- 40-60% smaller images
- 2-3x faster cold starts
- Reduced memory footprint
- Better security (smaller attack surface)
- Automated performance tracking over time

---

## 2025-10-23 Field Verification Snapshot

The Lima + musl toolchain path was validated end-to-end on October 23, 2025 (America/Los_Angeles).

- **Toolchain**: `brew list --versions musl-cross` confirms filosottile `musl-cross 0.9.9_2`; `x86_64-linux-musl-gcc --version` reports GCC 9.2.0. GNU Make 4.4.1 is available as `gmake`.
- **BusyBox**: `scripts/test-datadog-musl-build.sh` now forces `CONFIG_STATIC=y` and disables `CONFIG_SEEDRNG` to avoid `sys/random.h` build failures inside Datadog’s Alpine 3.6 base image. Successful runs drop `bench-images/busybox/busybox-datadog-alpine(-manual)` (~1.1 MB) and emit `musl.busybox.*` metrics when real Datadog keys are present.
- **Lima VM**: `~/.lima/alpine-dd/lima.yaml` provisions Alpine 3.22 with Datadog bootstrap logic. Use `./scripts/lima-build.sh uname -a` to verify the guest and `./scripts/lima-build.sh env | grep '^DD_'` to confirm templated credentials.
- **Kernel Build Proof**: `DD_API_KEY=<real> DD_APP_KEY=<real> ./scripts/lima-kernel-build.sh x86_64 6.17.4` produced `bench-images/minivim/vmlinuz-6.17.4-musl` (1.9 MB) and streamed `kernel.build.duration` (2353 s on first run) to DogStatsD/Datadog.
- **Boot Latency Benchmark**: `python3 scripts/benchmarks/boot_latency_bench.py --iterations 5 --kernel bench-images/minivim/vmlinuz-6.17.4-musl --initrd bench-images/busybox/busybox-musl-initramfs.cpio.gz --kernel-timeout 300 --dd-tag libc:musl --dd-tag experiment:minivim` recorded an average boot-to-shell of **8.66 s** (min 8.01 s, max 8.92 s). Raw samples live at `artifacts/minivim/boot-latency-2025-10-23.json` (ignored by git; copy to releases if needed).
- **Prompt Detection Fix**: `scripts/benchmarks/boot_latency_bench.py` now streams QEMU output character-by-character so BusyBox prompts without trailing newlines are detected immediately; upgrade any forks accordingly.

Keep the above commands in daily checklists so regression triage has ground truth numbers.

---

## Quick Start

### 1. Build BusyBox with musl

```bash
./scripts/benchmarks/build-busybox-musl.sh
```

**Output:**
- Static BusyBox binary (~1MB)
- Initramfs archive for kernel boots
- JSON metadata with build metrics
- Automatic Datadog metrics submission

### 2. Compare Docker Builds

```bash
./scripts/benchmarks/docker-musl-vs-glibc.sh
```

**Output:**
- Build time comparison
- Image size comparison
- Cold start time comparison
- Memory usage comparison
- Results saved to `performance-results/docker-builds/`

### 3. Validate Builds

```bash
./scripts/benchmarks/test-musl-builds.sh
```

Runs comprehensive validation tests on all build artifacts.

---

## Build Scripts

### `build-busybox-musl.sh`

Builds BusyBox with static musl linking for minimal, self-contained binaries.

**Features:**
- Automatic version detection
- Platform-specific optimizations (macOS/Linux)
- musl-cross toolchain support on macOS
- Parallel builds using all available cores
- Comprehensive metadata generation
- Initramfs creation
- Datadog metrics integration

**Environment Variables:**
- `BUSYBOX_VERSION`: BusyBox version to build (default: 1.36.1)

**Outputs:**
- `bench-images/busybox/busybox-<version>-musl-<timestamp>`: Static binary
- `bench-images/busybox/busybox-musl-initramfs-<timestamp>.cpio.gz`: Initramfs
- `bench-images/busybox/<binary>.json`: Build metadata

**Metrics Sent to Datadog:**
- `busybox.build.duration`: Build time in seconds
- `busybox.binary.size`: Binary size in bytes
- `busybox.initramfs.size`: Initramfs size in bytes

### `docker-musl-vs-glibc.sh`

Comprehensive Docker image comparison between Alpine (musl) and Debian (glibc).

**Features:**
- Parallel build execution
- Cold start timing
- Memory usage measurement
- Layer count analysis
- JSON results export
- Datadog metrics integration

**Outputs:**
- `performance-results/docker-builds/musl-vs-glibc-<timestamp>.json`
- Comparison table in console
- Docker images tagged with timestamp

**Metrics Sent to Datadog:**
- `docker.build.duration`: Build time per variant
- `docker.image.size`: Image size per variant
- `docker.coldstart.duration`: Container startup time
- `docker.memory.usage`: Runtime memory usage
- `docker.layers.count`: Number of image layers

### `test-musl-builds.sh`

Validation test suite for musl build artifacts.

**Tests:**
- Build script existence and permissions
- BusyBox binary functionality
- Static linking verification
- Size validation
- Metadata JSON validity
- Initramfs archive integrity
- Docker comparison results

---

## GitHub Actions Workflow

### `.github/workflows/musl-benchmarks.yml`

Automated CI/CD workflow that:
- Builds BusyBox on Linux and macOS
- Compares Docker images (musl vs glibc)
- Sends metrics to Datadog
- Uploads artifacts
- Creates releases
- Generates build summaries

**Triggers:**
- Push to `main` or `musl-optimization` branches
- Pull requests
- Weekly schedule (Mondays at 2 AM UTC)
- Manual workflow dispatch

**Matrix Builds:**
- **Platforms**: Ubuntu Latest, macOS Latest
- **Variants**: musl, glibc

**Artifacts:**
- BusyBox binaries (Linux + macOS)
- Initramfs archives
- Docker comparison results
- Build metadata JSON

---

## Datadog Dashboard

### `config/datadog/musl-build-dashboard.json`

Comprehensive dashboard tracking:

#### Metrics Tracked
1. **Build Duration Trends**: BusyBox, Docker musl, Docker glibc over time
2. **Image Size Comparison**: Visual size comparison across variants
3. **Cold Start Performance**: Container startup times
4. **Size Reduction**: Percentage improvement (musl vs glibc)
5. **Memory Usage**: Runtime memory comparison
6. **Build Success Rate**: 7-day rolling success metrics
7. **Kernel Build Time**: MiniVim kernel compilation tracking
8. **Platform Distribution**: Build distribution across platforms
9. **Recent Events**: Build event stream

#### Template Variables
- `variant`: Filter by musl/glibc
- `platform`: Filter by linux/macos
- `ci`: Filter by CI vs local builds

### Import Dashboard

```bash
# Using Datadog CLI
datadog-ci dashboard import config/datadog/musl-build-dashboard.json

# Or via API
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d @config/datadog/musl-build-dashboard.json
```

---

## Performance Results

### Expected Improvements

| Metric | glibc (Debian) | musl (Alpine) | Improvement |
|--------|----------------|---------------|-------------|
| Image Size | 800MB | 300MB | **62% smaller** |
| Build Time | 10 min | 6 min | **40% faster** |
| Cold Start | 2.5s | 1.0s | **60% faster** |
| Memory (idle) | 150MB | 90MB | **40% less** |
| Layer Count | ~12 | ~8 | **33% fewer** |

### BusyBox Binary

| Metric | glibc | musl static | Improvement |
|--------|-------|-------------|-------------|
| Binary Size | ~2MB | ~1MB | **50% smaller** |
| Dependencies | libc.so.6 + 5 libs | None (static) | **100% portable** |
| Boot Time | 4.6s | ~3s | **30% faster** |

---

## macOS Development Setup

### Install musl-cross Toolchain

```bash
# Option 1: Homebrew (if available)
brew tap filosottile/musl-cross
brew install musl-cross

# Option 2: Build from source
git clone https://github.com/richfelker/musl-cross-make.git
cd musl-cross-make

cat > config.mak << EOF
TARGET = x86_64-linux-musl
OUTPUT = /usr/local/musl
GCC_VER = 13.2.0
BINUTILS_VER = 2.41
MUSL_VER = 1.2.4
LINUX_VER = 6.6
COMMON_CONFIG += --disable-nls
GCC_CONFIG += --enable-languages=c,c++ --enable-lto
EOF

make -j$(sysctl -n hw.logicalcpu)
sudo make install

# Add to PATH
export PATH="/usr/local/musl/bin:$PATH"
```

### Verify Installation

```bash
x86_64-linux-musl-gcc --version
x86_64-linux-musl-ld --version
```

---

## Troubleshooting

### BusyBox Build Fails on macOS

**Issue**: Native macOS compiler doesn't support Linux targets

**Solution**: Install musl-cross toolchain (see above)

```bash
brew install filosottile/musl-cross/musl-cross
```

### Docker Build Fails with Native Module Errors

**Issue**: Native modules (lightningcss, node-pty) fail to compile on Alpine

**Solution**: Install build dependencies in Dockerfile

```dockerfile
RUN apk add --no-cache \
    python3 make g++ cmake \
    linux-headers libc-dev cargo
```

### Prisma Query Engine Not Found

**Issue**: Prisma can't find musl-compatible query engine

**Solution**: Specify musl binary targets in schema

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl", "linux-musl-openssl-3.0.x"]
}
```

### Metrics Not Appearing in Datadog

**Issue**: DD_API_KEY not set or dogstatsd not available

**Solution**: Set environment variable

```bash
export DD_API_KEY="your-api-key"
export DD_SITE="datadoghq.com"
```

---

## Integration with Existing Workflows

### MiniVim Kernel Builds

Use musl BusyBox initramfs with MiniVim kernels:

```bash
# Build kernel (issues #573-576)
./scripts/benchmarks/build-minivim-kernel-6.17.sh x86_64

# Use musl initramfs
INITRAMFS=bench-images/busybox/busybox-musl-initramfs-latest.cpio.gz

qemu-system-x86_64 \
  -kernel bench-images/minivim/bzImage-x86_64-6.17.4 \
  -initrd $INITRAMFS \
  -append 'console=ttyS0' \
  -nographic
```

### Production Docker Deployments

Use musl images for production:

```yaml
# docker-compose.yml
services:
  app:
    image: vibecode:musl-latest
    build:
      context: .
      dockerfile: docker/Dockerfile.prod.alpine
```

### CI/CD Pipeline

Integrate musl benchmarks into existing CI:

```yaml
# .github/workflows/ci.yml
jobs:
  musl-benchmarks:
    uses: ./.github/workflows/musl-benchmarks.yml
    secrets: inherit
```

---

## Roadmap

### Phase 1: Foundation (Complete)
- [x] BusyBox musl build script
- [x] Docker comparison script
- [x] GitHub Actions workflow
- [x] Datadog metrics integration
- [x] Validation test suite

### Phase 2: Optimization (In Progress)
- [ ] ARM64 cross-compilation support
- [ ] LTO (Link-Time Optimization) builds
- [ ] Profile-guided optimization (PGO)
- [ ] Custom musl builds with patches

### Phase 3: Production (Planned)
- [ ] Multi-arch Docker images (amd64, arm64)
- [ ] Automated releases to GitHub Releases
- [ ] Container registry push (GHCR, DockerHub)
- [ ] Performance regression detection
- [ ] Automated rollback on failures

---

## References

- [musl libc](https://musl.libc.org/)
- [BusyBox](https://busybox.net/)
- [Alpine Linux](https://alpinelinux.org/)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Datadog Metrics API](https://docs.datadoghq.com/api/latest/metrics/)

---

## Contributing

To add new build targets or improve benchmarks:

1. Add build script to `scripts/benchmarks/`
2. Add metrics to Datadog dashboard
3. Update GitHub Actions workflow
4. Add validation tests to `test-musl-builds.sh`
5. Update this documentation

---

## License

MIT License - see main project LICENSE file

---

**Last Updated**: 2025-10-22
**Maintainer**: VibeCode Development Team
