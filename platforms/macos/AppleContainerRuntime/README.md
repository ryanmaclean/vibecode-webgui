# Apple Container Runtime

Production-grade containerization runtime built on Apple's Virtualization.framework for native macOS container support.

## Overview

Apple Container Runtime provides lightweight, fast, and secure Linux containers on Apple Silicon Macs. Built specifically for agentapi and code-server deployment, it delivers sub-second startup times and production reliability.

### Key Features

- **Native Performance**: Built on Virtualization.framework for optimal Apple Silicon utilization
- **Fast Startup**: Sub-500ms container boot time
- **OCI Compatible**: Pull and run standard Docker images
- **Resource Efficient**: <100MB memory overhead per container
- **Production Ready**: Health checks, crash recovery, monitoring
- **Rosetta Support**: Run x86_64 images on Apple Silicon

## Architecture

```
┌─────────────────────────────────────────┐
│         TypeScript Bridge               │
│  (apple-container-v2.ts)                │
└────────────────┬────────────────────────┘
                 │
                 │ child_process
                 ▼
┌─────────────────────────────────────────┐
│      Swift Container Runtime            │
│  - OCI Image Manager                    │
│  - Virtualization.framework             │
│  - Container Lifecycle                  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│    macOS Virtualization.framework       │
│  - VZVirtualMachine                     │
│  - VZLinuxBootLoader                    │
│  - VZNATNetworkDeviceAttachment         │
└─────────────────────────────────────────┘
```

## Requirements

- macOS 14.0 or later
- Apple Silicon (M1/M2/M3)
- Xcode 15+ or Swift 5.9+
- 4GB RAM minimum
- 20GB free disk space

## Installation

### Development Setup

```bash
# Build the runtime
./scripts/build-apple-runtime.sh release

# Run tests
cd AppleContainerRuntime
swift test

# Test CLI
./bin/apple-container-runtime --version
```

### System-Wide Installation

```bash
# Install as launchd service (requires sudo)
sudo ./scripts/install-runtime.sh

# Verify installation
apple-container-runtime --version

# Check service status
sudo launchctl list com.vibecode.container-runtime
```

## Quick Start

### Pull an Image

```bash
apple-container-runtime pull ghcr.io/vibecode/agentapi:latest
```

### Run a Container

```bash
# Run in detached mode
apple-container-runtime run ghcr.io/vibecode/agentapi:latest \
  --name my-agent \
  --port 8080:8080 \
  --env API_KEY=secret \
  --detach

# Run interactively
apple-container-runtime run ubuntu:22.04 \
  --name test \
  --cpus 2 \
  --memory 2048
```

### Manage Containers

```bash
# List running containers
apple-container-runtime list

# View logs
apple-container-runtime logs my-agent

# Follow logs
apple-container-runtime logs my-agent --follow

# Stop container
apple-container-runtime stop my-agent

# Remove container
apple-container-runtime remove my-agent
```

### Container Details

```bash
# Inspect container
apple-container-runtime inspect my-agent

# Output (JSON):
{
  "id": "a1b2c3d4e5f6",
  "name": "my-agent",
  "image": "ghcr.io/vibecode/agentapi:latest",
  "state": "running",
  "ipAddress": "192.168.64.2",
  "created": "2025-10-02T00:00:00Z",
  "config": {
    "cpuCount": 2,
    "memorySize": 2147483648,
    "portMappings": [
      { "hostPort": 8080, "containerPort": 8080 }
    ]
  }
}
```

## TypeScript Integration

### Basic Usage

```typescript
import { appleContainerV2 } from '@/lib/container/apple-container-v2'

// Check availability
const available = await appleContainerV2.isAvailable()

// Start container
const result = await appleContainerV2.start('ghcr.io/vibecode/agentapi:latest', {
  name: 'my-agent',
  ports: { 8080: 8080 },
  env: { API_KEY: 'secret' },
  cpus: 2,
  memory: 2048,
  detached: true,
})

if (result.success) {
  console.log(`Container started: ${result.id}`)
}

// List containers
const { containers } = await appleContainerV2.list()

// Stop container
await appleContainerV2.stop(result.id)
```

### Stream Logs

```typescript
await appleContainerV2.streamLogs('my-agent', (line) => {
  console.log(line)
})
```

### Pull with Progress

```typescript
await appleContainerV2.pull('ubuntu:22.04', (progress) => {
  console.log(`Downloaded: ${progress.percentComplete}%`)
})
```

## Configuration

Configuration file: `/usr/local/etc/vibecode/container-runtime.json`

### Resource Limits

```json
{
  "limits": {
    "maxConcurrentContainers": 10,
    "maxTotalCpus": 8,
    "maxTotalMemory": 17179869184,
    "perContainerCpuLimit": 4,
    "perContainerMemoryLimit": 8589934592
  }
}
```

### Network Settings

```json
{
  "networking": {
    "mode": "nat",
    "ipRange": "192.168.64.0/24",
    "enableIPv6": false,
    "dns": ["8.8.8.8", "8.8.4.4"]
  }
}
```

### Image Profiles

```json
{
  "profiles": {
    "minimal": {
      "cpuCount": 1,
      "memorySize": 1073741824,
      "diskSize": 5368709120
    },
    "standard": {
      "cpuCount": 2,
      "memorySize": 2147483648,
      "diskSize": 10737418240
    }
  }
}
```

## Performance Characteristics

### Startup Time

- Container creation: <200ms
- VM boot: <300ms
- Total ready time: <500ms

### Resource Usage

- Runtime overhead: ~50MB
- Per-container overhead: ~80MB
- Disk usage: ~2GB for runtime + image cache

### Scalability

- Max concurrent containers: 10 (configurable)
- Boot time scaling: O(1) with container count
- Memory scaling: Linear with container count

## Production Deployment

### Health Checks

Configure health checks in container config:

```json
{
  "healthCheck": {
    "command": ["curl", "-f", "http://localhost:8080/health"],
    "interval": 30,
    "timeout": 5,
    "retries": 3
  }
}
```

### Monitoring

Metrics exposed on port 9090 (configurable):

- Container count
- CPU usage per container
- Memory usage per container
- Network I/O
- Startup/shutdown times

### Crash Recovery

Automatic restart policies:

```json
{
  "restartPolicy": {
    "type": "on-failure",
    "maxRetries": 3,
    "backoff": "exponential"
  }
}
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
tail -f /usr/local/var/log/vibecode/container-runtime.error.log

# Verify image
apple-container-runtime inspect <image>

# Check resource limits
apple-container-runtime list --all
```

### Network Issues

```bash
# Verify NAT configuration
scutil --nwi

# Check port conflicts
lsof -i :<port>

# Reset networking
sudo launchctl unload /Library/LaunchDaemons/com.vibecode.container-runtime.plist
sudo launchctl load /Library/LaunchDaemons/com.vibecode.container-runtime.plist
```

### Performance Issues

```bash
# Check system resources
top -o cpu

# Monitor container metrics
apple-container-runtime inspect <container-id>

# View resource usage
ps aux | grep apple-container-runtime
```

## Development

### Building from Source

```bash
cd AppleContainerRuntime
swift build -c release
```

### Running Tests

```bash
swift test
```

### Code Structure

```
AppleContainerRuntime/
├── Sources/
│   └── AppleContainerRuntime/
│       ├── main.swift              # CLI entry point
│       ├── ContainerRuntime.swift  # Core runtime logic
│       ├── Models.swift            # Data models
│       └── OCIImageManager.swift   # Image management
├── Tests/
│   └── AppleContainerRuntimeTests/
└── Package.swift                   # Swift package manifest
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `swift test` and `swift build`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues: https://github.com/vibecode/vibecode-webgui/issues
- Documentation: https://docs.vibecode.dev/container-runtime
- Email: support@vibecode.dev
