# VibeCode Consolidated Script System

This directory contains the consolidated script management system for VibeCode, replacing 362+ scattered scripts with a clean, organized structure.

## Overview

Instead of managing 362+ individual scripts, we now have a single entry point with organized subcommands:

```bash
./vibecode [command] [subcommand] [options]
```

## Quick Start

```bash
# Make the main script executable
chmod +x scripts-consolidated/vibecode

# Create a symlink for easy access
ln -sf scripts-consolidated/vibecode vibecode

# Use the consolidated script
./vibecode dev start
./vibecode build prod
./vibecode deploy aks
./vibecode test all
```

## Commands

### Development (`dev`)
Manage development environment:
```bash
./vibecode dev start                    # Start development environment
./vibecode dev stop                     # Stop development environment
./vibecode dev restart                  # Restart development environment
./vibecode dev status                   # Show development status
./vibecode dev logs                     # Show development logs
./vibecode dev shell                    # Open development shell
```

**Options:**
- `--with-db` - Include database services
- `--with-redis` - Include Redis services
- `--with-monitoring` - Include monitoring services

### Build (`build`)
Build and compilation tasks:
```bash
./vibecode build dev                    # Build development version
./vibecode build prod                   # Build production version
./vibecode build test                   # Build test version
./vibecode build clean                  # Clean build artifacts
./vibecode build watch                  # Build with file watching
```

**Options:**
- `--optimize` - Enable optimizations
- `--source-maps` - Generate source maps
- `--analyze` - Analyze bundle size

### Deploy (`deploy`)
Deployment operations:
```bash
./vibecode deploy local                 # Deploy locally
./vibecode deploy kind                  # Deploy to KIND cluster
./vibecode deploy aks                   # Deploy to AKS
./vibecode deploy azure                 # Deploy to Azure
./vibecode deploy rollback              # Rollback deployment
./vibecode deploy status                # Check deployment status
```

**Options:**
- `--env ENV` - Environment (dev/staging/prod)
- `--namespace NS` - Kubernetes namespace
- `--registry REG` - Container registry
- `--force` - Force deployment

### Test (`test`)
Testing and validation:
```bash
./vibecode test unit                    # Run unit tests
./vibecode test integration             # Run integration tests
./vibecode test e2e                     # Run end-to-end tests
./vibecode test all                     # Run all tests
./vibecode test coverage                # Run tests with coverage
./vibecode test performance             # Run performance tests
```

**Options:**
- `--watch` - Watch mode
- `--verbose` - Verbose output
- `--ci` - CI mode

### Monitor (`monitor`)
Monitoring and observability:
```bash
./vibecode monitor logs                 # Show application logs
./vibecode monitor metrics              # Show metrics
./vibecode monitor health               # Check health status
./vibecode monitor alerts               # Check alerts
./vibecode monitor dashboard            # Open monitoring dashboard
```

**Options:**
- `--follow` - Follow logs
- `--tail N` - Show last N lines
- `--service SVC` - Filter by service

### Cleanup (`cleanup`)
Cleanup and maintenance:
```bash
./vibecode cleanup old-files            # Remove old files
./vibecode cleanup docker               # Clean Docker resources
./vibecode cleanup k8s                  # Clean Kubernetes resources
./vibecode cleanup logs                 # Clean old logs
./vibecode cleanup cache                # Clean caches
```

**Options:**
- `--dry-run` - Show what would be cleaned
- `--force` - Force cleanup

### Docker (`docker`)
Docker operations:
```bash
./vibecode docker build                 # Build Docker images
./vibecode docker run                   # Run Docker containers
./vibecode docker stop                  # Stop Docker containers
./vibecode docker clean                 # Clean Docker resources
./vibecode docker logs                  # Show Docker logs
```

**Options:**
- `--target TGT` - Build target
- `--tag TAG` - Image tag
- `--push` - Push to registry

### Kubernetes (`k8s`)
Kubernetes operations:
```bash
./vibecode k8s apply                    # Apply Kubernetes manifests
./vibecode k8s delete                   # Delete Kubernetes resources
./vibecode k8s get                      # Get Kubernetes resources
./vibecode k8s logs                     # Show Kubernetes logs
./vibecode k8s port-forward             # Port forward services
```

**Options:**
- `--namespace NS` - Kubernetes namespace
- `--context CTX` - Kubernetes context

### Azure (`azure`)
Azure cloud operations:
```bash
./vibecode azure login                  # Login to Azure
./vibecode azure deploy                 # Deploy to Azure
./vibecode azure status                 # Check Azure status
./vibecode azure cleanup                # Clean Azure resources
```

**Options:**
- `--subscription SUB` - Azure subscription
- `--resource-group RG` - Resource group

### Utils (`utils`)
Utility functions:
```bash
./vibecode utils validate               # Validate configuration
./vibecode utils format                 # Format code
./vibecode utils lint                   # Lint code
./vibecode utils docs                   # Generate documentation
./vibecode utils backup                 # Create backup
```

**Options:**
- `--fix` - Fix issues automatically
- `--check` - Check only (don't fix)

## Directory Structure

```
scripts-consolidated/
├── vibecode                           # Main entry point script
├── dev/                              # Development commands
│   ├── start.sh
│   ├── stop.sh
│   ├── restart.sh
│   ├── status.sh
│   ├── logs.sh
│   └── shell.sh
├── build/                            # Build commands
│   ├── dev.sh
│   ├── prod.sh
│   ├── test.sh
│   ├── clean.sh
│   └── watch.sh
├── deploy/                           # Deployment commands
│   ├── local.sh
│   ├── kind.sh
│   ├── aks.sh
│   ├── azure.sh
│   ├── rollback.sh
│   └── status.sh
├── test/                             # Testing commands
│   ├── unit.sh
│   ├── integration.sh
│   ├── e2e.sh
│   ├── all.sh
│   ├── coverage.sh
│   └── performance.sh
├── monitor/                          # Monitoring commands
│   ├── logs.sh
│   ├── metrics.sh
│   ├── health.sh
│   ├── alerts.sh
│   └── dashboard.sh
├── cleanup/                          # Cleanup commands
│   ├── old-files.sh
│   ├── docker.sh
│   ├── k8s.sh
│   ├── logs.sh
│   └── cache.sh
├── docker/                           # Docker commands
│   ├── build.sh
│   ├── run.sh
│   ├── stop.sh
│   ├── clean.sh
│   └── logs.sh
├── k8s/                              # Kubernetes commands
│   ├── apply.sh
│   ├── delete.sh
│   ├── get.sh
│   ├── logs.sh
│   └── port-forward.sh
├── azure/                            # Azure commands
│   ├── login.sh
│   ├── deploy.sh
│   ├── status.sh
│   └── cleanup.sh
└── utils/                            # Utility commands
    ├── validate.sh
    ├── format.sh
    ├── lint.sh
    ├── docs.sh
    └── backup.sh
```

## Benefits

### 🎯 Organization
- **Single entry point** - One script to rule them all
- **Logical grouping** - Commands grouped by function
- **Consistent interface** - Same pattern for all operations
- **Easy discovery** - Clear help and documentation

### 🚀 Efficiency
- **Reduced cognitive load** - No need to remember 362+ script names
- **Faster execution** - Organized, optimized scripts
- **Better error handling** - Consistent error reporting
- **Unified logging** - Same logging format across all operations

### 🔧 Maintainability
- **Single source of truth** - One place to update functionality
- **Reusable components** - Shared functions across scripts
- **Version control** - Clear change history
- **Documentation** - Built-in help system

## Migration from Old Scripts

### Before (362+ scripts)
```bash
# Hard to remember and discover
./scripts/min-kind-bootstrap.sh
./scripts/build-multiarch.sh
./scripts/production-deploy.sh
./scripts/validate-deployment-readiness.sh
./scripts/quick-local-test.sh
./scripts/local-kind-setup.sh
# ... 356+ more scripts
```

### After (1 entry point)
```bash
# Easy to remember and discover
./vibecode dev start
./vibecode build prod
./vibecode deploy aks
./vibecode test all
./vibecode monitor logs
./vibecode cleanup docker
```

## Implementation Status

### ✅ Completed
- [x] Main entry point script (`vibecode`)
- [x] Directory structure created
- [x] Example scripts for key commands
- [x] Help system implemented
- [x] Color-coded output
- [x] Error handling

### 🔄 In Progress
- [ ] Migrate existing scripts to new structure
- [ ] Add remaining subcommands
- [ ] Update documentation references
- [ ] Create migration guide

### 📋 Planned
- [ ] Add configuration management
- [ ] Implement script validation
- [ ] Add performance monitoring
- [ ] Create automated testing

## Getting Help

```bash
# General help
./vibecode --help

# Command-specific help
./vibecode dev --help
./vibecode build --help
./vibecode deploy --help

# List available subcommands
./vibecode dev
./vibecode build
./vibecode deploy
```

## Contributing

When adding new functionality:

1. **Choose the right command** - Group by function (dev, build, deploy, etc.)
2. **Follow naming conventions** - Use clear, descriptive names
3. **Add help text** - Update the help system
4. **Test thoroughly** - Ensure scripts work correctly
5. **Update documentation** - Keep this README current

## Future Enhancements

- **Configuration management** - Centralized config for all scripts
- **Plugin system** - Allow extending functionality
- **Web interface** - GUI for script management
- **API integration** - REST API for script execution
- **Monitoring integration** - Built-in observability
