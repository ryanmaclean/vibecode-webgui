# vfkit Menu Structure - Complete Visual Guide

## Overview

The VM Management menu consolidates 48+ vfkit scripts and 20+ benchmark scripts into a hierarchical, easy-to-navigate menu system.

## Main VM Management Menu

```
╔════════════════════════════════════════════════════════════════╗
║                    VM MANAGEMENT SYSTEM                         ║
║                  vfkit • Lima • Benchmarks                      ║
╚════════════════════════════════════════════════════════════════╝

═══ Quick Actions ═══

  1) Create & Launch VibeCode VM (Quick)     [05-launch-vibecode-vm.sh]
  2) Launch Alpine VM                        [04-launch-alpine-vm.sh]
  3) VM Status Check                         [Built-in function]
  4) Stop All VMs                            [Built-in function]

═══ vfkit Setup & Installation ═══

  11) Setup vfkit (Initial)                  [01-setup-vfkit.sh]
  12) Install Alpine VM                      [install-alpine-vm.sh]
  13) Install AI Tools VM                    [install-ai-tools-vfkit.sh]
  14) Install VSCode Server VM               [install-vscode-server.sh]

═══ Alpine-based VMs ═══

  21) Download Alpine Kernel                 [02-download-alpine-kernel.sh]
  22) Create Alpine Rootfs                   [03-create-alpine-rootfs.sh]
  23) Launch Alpine VM                       [04-launch-alpine-vm.sh]
  24) Create Optimized Alpine VM             [create-optimized-alpine-vm.sh]
  25) Upgrade to Alpine 3.22                 [10-upgrade-to-alpine-3.22.sh]

═══ Specialized VMs ═══

  31) Create Node 24 VM                      [09-launch-node24-vm.sh]
  32) Create VSCode Server VM                [13-launch-vscode-server-vm.sh]
  33) Create Busybox VM                      [create-busybox-vm.sh]
  34) Create Minimal VM                      [create-minimal-alpine-vm.sh]
  35) Create Ultra-Minimal VM                [create-ultra-minimal-vm.sh]
  36) Create Fun Demo VM                     [14-create-fun-demo-rootfs.sh]

═══ Advanced VM Operations ═══

  41) Build AI Tools VM (Complete)           [build-ai-tools-vm-complete.sh]
  42) Create Persistent VM                   [07-create-persistent-vm.sh]
  43) Create Preinstalled VM                 [create-preinstalled-vm.sh]
  44) Build Minimal Kernel (Docker)          [11-build-minimal-kernel-docker.sh]
  45) Build Busybox Node (Docker)            [build-busybox-node-docker.sh]

═══ Performance & Benchmarks ═══

  51) Run Basic Performance Test             [basic-performance-test.sh]
  52) Run Comprehensive Performance Test     [comprehensive-performance-test.sh]
  53) Compare Boot Times                     [compare-boot-times.sh]
  54) M-Series Performance Test              [m-series-performance-test.sh]
  55) Continuous Performance Monitor         [continuous-performance-monitor.sh]
  56) Benchmark Validation                   [benchmark-validation.sh]
  57) All Benchmarks Menu                    [Submenu →]

═══ Lima Operations ═══

  61) Lima Build                             [lima-build.sh]
  62) Lima Kernel Build                      [lima-kernel-build.sh]
  63) Automate Lima VibeCode                 [automate-lima-vibecode.sh]

═══ Kernel & Build Tools ═══

  71) Build Minimal Kernel                   [11-build-minimal-kernel.sh]
  72) Analyze Kernel Optimization            [analyze-kernel-optimization.sh]
  73) Build ARM64 Kernel (6.17)              [build-and-validate-arm64-6.17.sh]
  74) Build ARMv7 Kernel (6.17)              [build-armv7-6.17-complete.sh]

═══ Comparisons & Analysis ═══

  81) Compare Busybox vs Alpine              [compare-busybox-alpine.sh]
  82) Compare VSCode Builds                  [compare-vscode-builds.sh]
  83) Detailed Performance Test              [detailed-performance-test.sh]

  0) Back to Main Menu
```

## Benchmarks Submenu (Option 57)

```
Benchmark & Performance Testing

  1) Boot Latency Benchmark                  [boot_latency_bench.py]
  2) Firecracker Benchmark                   [firecracker_bench.py]
  3) Build MiniVim Kernel                    [build-minivim-kernel-6.17.sh]
  4) Build Neovim Initramfs                  [build-neovim-initramfs.sh]
  5) OpenVSCode Benchmark                    [openvscode-benchmark.sh]
  6) Docker MUSL vs GLIBC Comparison         [docker-musl-vs-glibc.sh]
  7) Noisy Neighbor Experiment               [noisy-neighbor-experiment.sh]
  8) Datadog Integration Test                [emit_to_datadog.py]

  0) Back
```

## Script Organization

### vfkit Scripts Directory (`scripts/vfkit/`)

#### Core Setup Scripts (01-14)
```
01-setup-vfkit.sh                      # Initial vfkit setup
02-download-alpine-kernel.sh           # Download Alpine Linux kernel
03-create-alpine-rootfs.sh             # Create Alpine root filesystem
04-launch-alpine-vm.sh                 # Launch basic Alpine VM
05-launch-vibecode-vm.sh               # Launch VibeCode VM
06-create-vibecode-rootfs.sh           # Create VibeCode rootfs
07-create-persistent-vm.sh             # Create VM with persistent storage
08-create-node24-rootfs.sh             # Create Node.js 24 rootfs
09-launch-node24-vm.sh                 # Launch Node.js 24 VM
10-upgrade-to-alpine-3.22.sh           # Upgrade to Alpine 3.22
11-build-minimal-kernel.sh             # Build minimal custom kernel
11-build-minimal-kernel-docker.sh      # Docker-based kernel build
12-create-vscode-server-rootfs.sh      # Create VSCode Server rootfs
13-launch-vscode-server-vm.sh          # Launch VSCode Server VM
14-create-fun-demo-rootfs.sh           # Create demo/fun VM
```

#### VM Creation Scripts
```
create-busybox-vm.sh                   # Minimal Busybox-based VM
create-minimal-alpine-vm.sh            # Minimal Alpine VM
create-minimal-busybox-vm.sh           # Extra minimal Busybox
create-optimized-alpine-vm.sh          # Optimized Alpine configuration
create-practical-busybox-vm.sh         # Practical Busybox setup
create-preinstalled-vm.sh              # VM with pre-installed tools
create-simple-alpine-vm.sh             # Simple Alpine setup
create-simple-busybox-vm.sh            # Simple Busybox setup
create-ultra-minimal-vm.sh             # Ultra-minimal configuration
create-working-alpine-vm.sh            # Working Alpine environment
create-working-busybox-vm.sh           # Working Busybox environment
```

#### AI Tools & Advanced VMs
```
build-ai-tools-vm.sh                   # Build AI tools VM
build-ai-tools-vm-complete.sh          # Complete AI tools setup
install-ai-tools-vfkit.sh              # Install AI tools in VM
prove-ai-tools-work.sh                 # Test AI tools functionality
```

#### Build & Docker Scripts
```
build-busybox-node-docker.sh           # Docker build for Busybox Node
build-fast-openvscode-vm-with-ai-tools.sh  # Fast VSCode with AI
Dockerfile.busybox-node                # Busybox Node Dockerfile
```

#### Installation & Setup
```
install-alpine-vm.sh                   # Install Alpine VM
install-vscode-server.sh               # Install VSCode Server
install.sh                             # General installation
```

#### Performance Testing
```
basic-performance-test.sh              # Basic performance metrics
benchmark-validation.sh                # Validate benchmarks
compare-boot-times.sh                  # Boot time comparison
compare-busybox-alpine.sh              # Compare distributions
comprehensive-performance-test.sh      # Full performance suite
continuous-performance-monitor.sh      # Continuous monitoring
detailed-performance-test.sh           # Detailed metrics
final-performance-test.sh              # Final validation
```

#### Analysis & Optimization
```
analyze-kernel-optimization.sh         # Kernel optimization analysis
```

### Benchmark Scripts Directory (`scripts/benchmarks/`)

```
boot_latency_bench.py                  # Boot latency measurements
firecracker_bench.py                   # Firecracker comparisons
build-and-validate-arm64-6.17.sh       # ARM64 kernel build & test
build-armv7-6.17-complete.sh           # ARMv7 kernel complete build
build-busybox-musl.sh                  # Busybox with MUSL
build-minivim-kernel-6.17.sh           # MiniVim kernel 6.17
build-minivim-kernel-docker.sh         # MiniVim Docker build
build-minivim-kernel.sh                # MiniVim kernel build
build-neovim-avante-initramfs.sh       # Neovim Avante in initramfs
build-neovim-initramfs-macos.sh        # Neovim initramfs for macOS
build-neovim-initramfs.sh              # Neovim in initramfs
compare-vscode-builds.sh               # VSCode build comparison
docker-musl-vs-glibc.sh                # MUSL vs GLIBC comparison
emit_to_datadog.py                     # Datadog metrics emission
_dogstatsd.py                          # DogStatsD helper
m-series-performance-test.sh           # Apple M-series tests
noisy-neighbor-experiment.sh           # Multi-VM interference test
openvscode-benchmark.sh                # OpenVSCode performance
firecracker                            # Firecracker binary
kernel-configs/                        # Kernel configuration files
```

### Lima Scripts (main scripts directory)

```
lima-build.sh                          # Lima VM build
lima-kernel-build.sh                   # Lima kernel compilation
automate-lima-vibecode.sh              # Automated Lima VibeCode setup
```

## Workflow Examples

### Complete VM Setup Flow

```
1. Initial Setup
   Main Menu > 2 (VM Management) > 11 (Setup vfkit)
   
2. Install Base VM
   VM Menu > 12 (Install Alpine VM)
   
3. Launch VM
   VM Menu > 1 (Create & Launch VibeCode VM)
   
4. Check Status
   VM Menu > 3 (VM Status Check)
```

### AI Development Environment

```
1. Build AI Tools VM
   Main Menu > 2 > 41 (Build AI Tools VM Complete)
   
2. Verify Installation
   VM Menu > 13 (Install AI Tools VM)
   
3. Test Functionality
   Run: prove-ai-tools-work.sh (manual)
```

### Performance Testing Workflow

```
1. Basic Test
   Main Menu > 2 > 51 (Basic Performance Test)
   
2. Comprehensive Test
   VM Menu > 52 (Comprehensive Performance Test)
   
3. Boot Time Analysis
   VM Menu > 53 (Compare Boot Times)
   
4. Detailed Benchmarks
   VM Menu > 57 (All Benchmarks) > Select specific benchmark
```

### Kernel Development

```
1. Analyze Current Kernel
   Main Menu > 2 > 72 (Analyze Kernel Optimization)
   
2. Build Custom Kernel
   VM Menu > 71 (Build Minimal Kernel)
   
3. Build ARM64 Kernel
   VM Menu > 73 (Build ARM64 Kernel 6.17)
   
4. Validate
   VM Menu > 56 (Benchmark Validation)
```

## Script Categories by Purpose

### Quick Operations (Fastest)
- Launch VibeCode VM (1)
- Launch Alpine VM (2)
- VM Status (3)
- Stop All VMs (4)

### Initial Setup (First Time)
- Setup vfkit (11)
- Install Alpine VM (12)
- Download Alpine Kernel (21)

### Development VMs
- Node 24 VM (31)
- VSCode Server VM (32)
- AI Tools VM (41)

### Performance Optimization
- Basic Performance (51)
- Comprehensive Performance (52)
- M-Series Performance (54)
- Continuous Monitor (55)
- All Benchmarks (57)

### Minimal/Experimental
- Busybox VM (33)
- Minimal VM (34)
- Ultra-Minimal VM (35)
- Demo VM (36)

### Advanced/Custom
- Persistent VM (42)
- Preinstalled VM (43)
- Minimal Kernel (44, 71)
- ARM Kernels (73, 74)

## Color Coding

```
GREEN   - Quick/Safe operations (launch, create)
CYAN    - Status/Information (status, check, compare)
BLUE    - Installation/Setup (install, setup)
YELLOW  - Build/Compile (build, kernel)
MAGENTA - Advanced/Complete operations (full setup, comprehensive)
RED     - Destructive operations (stop, cleanup)
```

## Built-in Functions

### VM Status Check (Option 3)
```bash
- Checks for running vfkit processes
- Lists Lima VMs if installed
- Shows VM counts and PIDs
```

### Stop All VMs (Option 4)
```bash
- Stops all vfkit VMs (pkill -f vfkit)
- Stops all Lima VMs (limactl stop --all)
- Confirms actions
```

## Script Execution Context

All scripts execute in their proper directory context:
- vfkit scripts: `cd scripts/vfkit && bash script.sh`
- Benchmark scripts: `cd scripts/benchmarks && bash/python script.sh`
- Lima scripts: `cd scripts && bash script.sh`

## Platform Support

### macOS (Primary)
- Full vfkit support
- Apple Silicon optimization (M-series tests)
- Lima integration

### Linux (Secondary)
- Lima support
- Limited vfkit (macOS only)
- All benchmark scripts

## Documentation Files

```
scripts/vfkit/
├── INDEX.md                           # vfkit documentation index
├── QUICK_INSTALL.md                   # Quick installation guide
├── BOOT_TIME_COMPARISON.md            # Boot time analysis
├── NODE_24_UPGRADE.md                 # Node 24 upgrade guide
├── NODE24_SUCCESS_SUMMARY.md          # Node 24 success report
├── KERNEL_OPTIMIZATION_ANALYSIS.md    # Kernel optimization details
└── DOCUMENTATION_UPDATE_SUMMARY.md    # Documentation changelog
```

## Total Coverage

- **Core vfkit scripts**: 14 (01-14)
- **VM creation variants**: 11
- **AI/Advanced tools**: 4
- **Performance tests**: 8
- **Benchmark scripts**: 20+
- **Lima operations**: 3
- **Build/Docker**: 5
- **Documentation**: 7

**Total: 72+ scripts and files**

All accessible through the VM Management menu system!
