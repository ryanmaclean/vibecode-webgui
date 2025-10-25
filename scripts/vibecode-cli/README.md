# VibeCode CLI - Universal Script Management System

A comprehensive command-line interface that consolidates 126+ deployment, VM management, and infrastructure scripts into organized, navigable menus.

## Quick Start

```bash
# Run the CLI
./scripts/vibecode-cli/main.sh

# Or create a symlink for easier access
ln -s $(pwd)/scripts/vibecode-cli/main.sh /usr/local/bin/vibecode-cli
vibecode-cli
```

## Features

### 1. Deployment Management (78+ scripts)

Comprehensive deployment operations organized into:

#### Kind/Kubernetes Operations
- Create and manage Kind clusters
- Deploy services to Kind
- Health checks and status monitoring
- Full automation workflows

#### Docker Operations
- Build and push Docker images
- Docker Compose management
- Optimized builds
- Diagnostics and troubleshooting

#### Production Deployment (AKS)
- Azure Kubernetes Service deployment
- Production validation
- Bootstrap and setup

#### Monitoring & Observability
- Datadog integration (Kind & AKS)
- Database monitoring (DBM)
- APM and error tracking
- Complete monitoring stacks

### 2. VM Management (48+ scripts)

Complete VM lifecycle management:

#### vfkit Operations
- **Quick Actions**: Launch VMs instantly
- **Alpine VMs**: Download, create, optimize Alpine-based VMs
- **Specialized VMs**: Node 24, VSCode Server, Busybox, Minimal variants
- **Advanced Operations**: AI Tools VM, persistent storage, preinstalled environments

#### Performance & Benchmarks
- Boot time comparisons
- Comprehensive performance testing
- M-Series optimization tests
- Continuous monitoring
- Firecracker benchmarks

#### Lima Operations
- Build and kernel compilation
- Automated setup

#### Kernel & Build Tools
- Minimal kernel building
- ARM64 and ARMv7 support
- Docker-based builds

### 3. Future Modules (Coming Soon)

- Development Tools
- Testing & Validation
- Database Operations
- Security & Monitoring
- Documentation Tools
- Build & CI/CD

## Menu Structure

```
VibeCode CLI v1.0
├── 1. Deployment Management
│   ├── Kind/K8s Operations (7 options)
│   ├── Docker Operations (5 options)
│   ├── Production (AKS) (5 options)
│   ├── Monitoring (6 options)
│   ├── Complete Platforms (4 options)
│   └── Additional Deployments (5 options)
│
├── 2. VM Management
│   ├── Quick Actions (4 options)
│   ├── Setup & Installation (4 options)
│   ├── Alpine VMs (5 options)
│   ├── Specialized VMs (6 options)
│   ├── Advanced Operations (5 options)
│   ├── Performance & Benchmarks (7+ options)
│   ├── Lima Operations (3 options)
│   ├── Kernel & Build Tools (4 options)
│   └── Comparisons (3 options)
│
└── 3-8. Additional Modules (Coming Soon)
```

## Architecture

```
scripts/
├── vibecode-cli/
│   ├── main.sh              # Main CLI entry point
│   ├── install.sh           # Installation script
│   ├── uninstall.sh         # Uninstallation script
│   └── README.md            # This file
│
└── vibecode-cli-lib/
    ├── common.sh            # Shared utilities
    ├── deploy-menu.sh       # Deployment menu (78+ scripts)
    └── vm-menu.sh           # VM management menu (48+ scripts)
```

## Key Features

### User Experience
- **Color-coded menus** for easy navigation
- **Clear section headers** grouping related operations
- **Error handling** with user-friendly messages
- **Execution feedback** showing success/failure status
- **Persistent navigation** - easy to go back/forward

### Script Management
- **Automatic script discovery** from organized directories
- **Execution context preservation** (runs in correct directory)
- **Logging** to `~/.vibecode-cli.log`
- **Permission handling** (auto-chmod +x)

### Platform Support
- macOS (including Apple Silicon)
- Linux
- Detects architecture and platform automatically

## Common Workflows

### Deploy to Kind with Monitoring
```
1. Select "1" (Deployment Management)
2. Select "5" (Kind Full Automation)
   OR
2. Select "42" (Deploy with Monitoring)
```

### Create and Launch a VM
```
1. Select "2" (VM Management)
2. Select "1" (Create & Launch VibeCode VM)
   OR
2. Select "13" (Install AI Tools VM)
```

### Run Performance Benchmarks
```
1. Select "2" (VM Management)
2. Select "52" (Comprehensive Performance Test)
   OR
2. Select "57" (All Benchmarks Menu)
```

## Deployment Scripts Mapped

### Kind/K8s (10 scripts)
- kind-create-cluster.sh
- kind-deploy-services.sh
- kind-status.sh
- kind-cleanup.sh
- kind-full-automation.sh
- kind-health-check.sh
- kind-datadog-core.sh
- And more...

### Deploy Scripts (19 scripts)
- deploy-production.sh
- deploy-monitoring.sh
- deploy-complete-platform.sh
- deploy-kind-with-monitoring.sh
- deploy-agentapi.sh
- deploy-authelia.sh
- And 13 more...

### Setup Scripts (24 scripts)
- setup-kind-cluster.sh
- setup-aks-datadog-monitoring.sh
- setup-production-monitoring.sh
- And 21 more...

### Docker & Build (5 scripts)
- build-and-push-codeserver.sh
- docker-build-optimized.sh
- docker-doctor.sh
- And more...

## VM Scripts Mapped

### vfkit Core (14 numbered scripts)
- 01-setup-vfkit.sh through 14-create-fun-demo-rootfs.sh
- Complete VM lifecycle management

### vfkit Additional (34+ scripts)
- create-*-vm.sh variants
- build-*-vm.sh variants
- Performance and benchmark scripts
- Comparison scripts

### Benchmarks (20+ scripts)
- boot_latency_bench.py
- firecracker_bench.py
- openvscode-benchmark.sh
- m-series-performance-test.sh
- And 16 more...

## Utility Functions

The `common.sh` library provides:

- **Display functions**: Color-coded output, status indicators
- **Validation**: Command existence, Docker status, kubectl context
- **Confirmation prompts**: Safe destructive operations
- **Platform detection**: macOS, Linux, architecture detection
- **Logging**: Execution history tracking

## Tips

1. **Use Quick Actions** for common operations (top of each menu)
2. **Check status** before deploying (status/health check options)
3. **Read script output** - includes helpful error messages
4. **Use benchmarks** to validate VM performance
5. **Check logs** at `~/.vibecode-cli.log` for history

## Requirements

### For Deployment Features
- Docker
- kubectl
- kind (for Kind operations)
- Azure CLI (for AKS operations)
- Helm (for chart deployments)

### For VM Features
- vfkit (macOS)
- Lima (optional)
- Python 3 (for benchmark scripts)

## Development

### Adding New Menu Items

1. Add the script to the appropriate directory
2. Update the corresponding menu file (deploy-menu.sh or vm-menu.sh)
3. Add menu item in the display function
4. Add case handler in the menu loop

### Adding New Menu Sections

1. Create new menu file in `vibecode-cli-lib/`
2. Add handler function in `main.sh`
3. Add menu item in main menu
4. Source the new menu file

## Troubleshooting

**Menu doesn't show?**
- Check that vibecode-cli-lib directory exists
- Verify permissions: `chmod +x scripts/vibecode-cli/main.sh`

**Script not found?**
- Scripts must be in correct directories (scripts/, scripts/vfkit/, scripts/benchmarks/)
- Check script names match exactly (case-sensitive)

**Script fails to execute?**
- Check script permissions
- Review `~/.vibecode-cli.log` for details
- Run script directly to see full output

## License

Part of the VibeCode project.
