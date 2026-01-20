# VibeCode

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/ryanmaclean/vibecode-webgui/releases)
[![CI](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)

**Containerized Development Environment with Full IDE Support**

VibeCode is a containerized development platform providing a complete development environment with SSH access, PostgreSQL database, Valkey cache, and a full VS Code editor in your browser.

## Features

- **Container Native**: Runs on Docker, Podman, Kubernetes, or Apple Containers
- **Full Development Stack**:
  - OpenVSCode Server - Full VS Code editor in your browser
  - PostgreSQL 16 - Production-ready relational database
  - Valkey - High-performance in-memory data store
  - SSH Server - Secure remote access
- **Volume Mounting**: Persistent storage and file sharing with host
- **Multi-Platform**: macOS (Apple Silicon + Intel), Linux
- **Orchestration Ready**: Works with Gas Town multi-agent orchestration

## Quick Start

### Prerequisites

- Docker, Podman, or compatible container runtime
- 2GB RAM available
- 500MB disk space

### Installation

```bash
# Clone the repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Start with Docker Compose
docker compose up -d

# Or use the launcher
./install.sh
vibecode start

# Check status
vibecode status

# Access services
vibecode ssh              # SSH access
open http://localhost:8080     # OpenVSCode in browser
```

See [QUICK-START.md](QUICK-START.md) for more details.

### Container Runtimes

VibeCode supports multiple container runtimes:

| Runtime | Status | Notes |
|---------|--------|-------|
| Docker | Supported | Primary runtime |
| Podman | Supported | Daemonless alternative |
| Kubernetes | Supported | Production orchestration |
| Apple Containers | Planned | Native macOS containers |

See [Issue #877](https://github.com/ryanmaclean/vibecode-webgui/issues/877) for runtime roadmap.

### Access Services

- **OpenVSCode**: http://localhost:8080
- **SSH**: `ssh root@localhost -p 2222` (password: `vibecode`)
- **PostgreSQL**: `psql -h localhost -U postgres`
- **Valkey**: `redis-cli -h localhost -p 6379`

## What's Inside

### Services

| Service | Port | Description |
|---------|------|-------------|
| OpenVSCode Server | 8080 | Full VS Code editor with terminal |
| SSH (Dropbear) | 22 | Secure shell access |
| PostgreSQL 16 | 5432 | Relational database |
| Valkey | 6379 | In-memory cache and data store |

### Performance

- **Startup Time**: ~5 seconds from container start to IDE ready
- **Memory Usage**: ~400MB baseline
- **Image Size**: ~500MB compressed
- **Services**: Parallel startup for maximum efficiency

## Volume Mounting

Share files between your host and the container:

```bash
# Docker
docker run -v /path/to/project:/workspace vibecode

# Docker Compose (recommended)
# Edit docker-compose.yml volumes section
volumes:
  - ./workspace:/workspace
  - vibecode-data:/data
```

Files will be mounted at `/workspace` inside the container. See [Volume Mounting Guide](docs/volume-mounting.md) for details.

## Use Cases

- **Development Environments**: Full-stack development with code editor, database, and cache
- **Testing**: Isolated environments for integration testing
- **Education**: Learn Linux, databases, and web development
- **Prototyping**: Rapid application development with persistent storage
- **CI/CD**: Lightweight build and test environments

## CLI Tool

VibeCode includes a command-line tool for easy container management:

```bash
# Start/stop/restart
vibecode start              # Start containers
vibecode stop               # Stop containers
vibecode restart            # Restart containers

# Status and access
vibecode status             # Show container and service status
vibecode ssh                # SSH into the container
vibecode logs               # View container logs
vibecode logs -f            # Follow logs in real-time

# Configuration
vibecode config show        # Show current configuration
vibecode config edit        # Edit configuration

# Help
vibecode help               # Show help
vibecode version            # Show version info
```

### Features

- Single command to start/stop/restart containers
- Automatic service health checking
- Built-in SSH with password handling
- Log viewing and following
- Configuration management
- Volume mounting setup
- Datadog monitoring integration

See [UNIFIED-TOOL-GUIDE.md](UNIFIED-TOOL-GUIDE.md) for complete documentation.

## Documentation

- [Quick Start Guide](QUICK-START.md) - Get up and running in 5 minutes
- [Unified Tool Guide](UNIFIED-TOOL-GUIDE.md) - Complete launcher documentation
- [Volume Mounting](docs/volume-mounting.md) - File sharing between host and VM
- [Performance & Optimization](docs/optimization.md) - Boot time and size optimizations
- [Architecture](docs/architecture.md) - Technical details and design decisions
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## Building from Source

Want to customize the VM or build it yourself? See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions.

## Performance Benchmarks

Tested on Apple Silicon and Linux:

- **Container Start**: ~5 seconds to IDE ready
- **Image Pull**: ~30 seconds (first time only)
- **Service Startup**: Parallel (all services launch simultaneously)
- **Memory Footprint**: ~400MB baseline, ~800MB with active workload
- **Image Size**: ~500MB compressed

## Technical Highlights

- **Container Native**: Runs on any OCI-compliant runtime
- **Multi-Arch**: Supports ARM64 and AMD64 architectures
- **Parallel Startup**: Services launch simultaneously for fast boot
- **Optimized Images**: Minimal base images with multi-stage builds
- **Health Checks**: Built-in container health monitoring

## System Requirements

### Host System
- macOS, Linux, or Windows with WSL2
- Docker, Podman, or compatible container runtime
- 4GB RAM (2GB for container, 2GB for host)
- 1GB free disk space

### Container Resources
- 2 CPU cores (configurable)
- 2GB RAM (configurable, minimum 1GB)
- ~500MB disk space for images

## Community & Support

- **Issues**: [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

VibeCode VM is open source software licensed under the [MIT License](LICENSE).

## Acknowledgments

Built with:
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) - VS Code in the browser
- [PostgreSQL](https://www.postgresql.org/) - World's most advanced open source database
- [Valkey](https://valkey.io/) - High-performance in-memory data store
- [Docker](https://www.docker.com/) - Container platform
- [Gas Town](https://github.com/ryanmaclean/gas-town) - Multi-agent orchestration

## Project Status

VibeCode VM is currently in **active development**. The core functionality is stable and ready for use, with ongoing improvements to documentation, testing, and features.

Current Version: **v1.5.0**

---

**Made with care for developers who value speed and simplicity.**
