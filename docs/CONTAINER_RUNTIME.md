# Container Runtime Abstraction

VibeCode now supports multiple container runtimes, allowing you to choose the best option for your deployment environment.

## Supported Runtimes

### 1. Docker (Default)
Most widely adopted container runtime with extensive ecosystem support.

**Pros:**
- Ubiquitous adoption and extensive documentation
- Docker Compose for multi-container orchestration
- Best IDE integration support

**Cons:**
- Resource heavy on macOS
- Requires daemon running

**Installation:**
```bash
# macOS
brew install docker

# Linux
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 2. Podman
Daemonless, rootless container runtime ideal for security-conscious deployments.

**Pros:**
- No daemon required (daemonless architecture)
- Rootless containers by default (better security)
- Docker CLI compatible
- OCI compliant

**Cons:**
- Smaller ecosystem than Docker
- macOS support via podman-machine (VM-based)

**Installation:**
```bash
# macOS
brew install podman
podman machine init
podman machine start

# Linux
sudo apt-get install podman  # Debian/Ubuntu
sudo dnf install podman      # Fedora/RHEL
```

### 3. Kubernetes
Production-grade orchestration for multi-node deployments.

**Pros:**
- Industry standard for container orchestration
- Built-in scaling, load balancing, self-healing
- Declarative configuration

**Cons:**
- Complex setup for local development
- Overkill for single-machine scenarios

**Local Development Options:**
- **kind**: Kubernetes IN Docker
- **minikube**: Single-node cluster
- **k3s**: Lightweight K8s

**Installation:**
```bash
# kind
brew install kind

# minikube
brew install minikube

# k3s
curl -sfL https://get.k3s.io | sh -
```

### 4. Apple Containers (macOS 26+)
Native macOS containerization using Virtualization.framework.

**Pros:**
- Native Apple Silicon optimization
- No VM overhead for macOS containers
- Integrated with macOS security model

**Cons:**
- macOS 26+ only (Sequoia)
- Limited to macOS/Linux containers
- New technology, limited ecosystem

## Configuration

### Environment Variable

Set the preferred runtime via environment variable:

```bash
export VIBECODE_CONTAINER_RUNTIME=docker  # docker | podman | kubernetes | apple
```

### Configuration File

Create a runtime configuration file at one of these locations:

1. `~/.vibecode/runtime.json`
2. `~/.config/vibecode/runtime.json`
3. `./vibecode.runtime.json` (project root)
4. `./config/container-runtime.json`

Example configuration:

```json
{
  "selectedRuntime": "docker",
  "docker": {
    "socketPath": "/var/run/docker.sock",
    "useDesktop": false,
    "tlsVerify": false
  },
  "podman": {
    "machine": "podman-machine-default",
    "rootless": true
  },
  "kubernetes": {
    "context": "minikube",
    "namespace": "vibecode"
  },
  "apple": {
    "isolation": "vm",
    "enableRosetta": true
  }
}
```

## API Usage

### Get Runtime Status

```bash
GET /api/runtime
```

Response:
```json
{
  "current": {
    "runtime": "docker",
    "status": {
      "available": true,
      "running": true,
      "version": "24.0.0"
    }
  },
  "available": {
    "docker": true,
    "podman": false,
    "kubernetes": false,
    "apple": false
  }
}
```

### Switch Runtime

```bash
POST /api/runtime
Content-Type: application/json

{
  "runtime": "podman"
}
```

### Auto-Detect Runtime

```bash
PUT /api/runtime
```

## Programmatic Usage

### Using the Runtime Factory

```typescript
import { getRuntimeWithFallback } from '@/lib/container/runtime-factory';

// Get runtime (with auto-detection fallback)
const runtime = await getRuntimeWithFallback('docker');

// Start a container
const result = await runtime.start('nginx:latest', {
  name: 'my-nginx',
  ports: { 8080: 80 },
  env: { NODE_ENV: 'production' },
});

// List containers
const { containers } = await runtime.list({ all: true });

// Get logs
const { logs } = await runtime.logs('my-nginx', { tail: 100 });

// Stop container
await runtime.stop('my-nginx');

// Remove container
await runtime.remove('my-nginx');
```

### Using Specific Runtime

```typescript
import { createRuntime } from '@/lib/container/runtime-factory';

// Create specific runtime
const runtime = await createRuntime({
  runtime: 'podman',
  podman: {
    machine: 'my-podman-machine',
    rootless: true,
  },
});

const status = await runtime.getStatus();
console.log(status);
```

### Auto-Detection

```typescript
import { detectRuntime } from '@/lib/container/runtime-factory';

// Auto-detect available runtime
const runtimeType = await detectRuntime();
console.log(`Detected runtime: ${runtimeType}`);
```

## Container Operations

All runtimes implement the same interface, so operations are consistent:

```typescript
interface ContainerRuntime {
  // Check availability
  isAvailable(): Promise<boolean>;
  
  // Get runtime status
  getStatus(): Promise<RuntimeStatus>;
  
  // Container lifecycle
  start(image: string, options?: ContainerOptions): Promise<ContainerStartResult>;
  stop(containerId: string): Promise<OperationResult>;
  remove(containerId: string): Promise<OperationResult>;
  
  // Container information
  list(options?: ListOptions): Promise<ContainerListResult>;
  inspect(containerId: string): Promise<ContainerInfo | null>;
  logs(containerId: string, options?: LogOptions): Promise<ContainerLogsResult>;
  stats(containerId: string): Promise<ContainerStats | null>;
  
  // Execute commands
  exec(containerId: string, command: string[]): Promise<ExecResult>;
}
```

## Testing

Run tests for the runtime abstraction:

```bash
# Unit tests
npm run test:unit -- --testPathPattern=container

# Integration tests (requires runtime to be installed)
npm run test:integration -- --testPathPattern=container
```

## Best Practices

1. **Local Development**: Use Docker or Podman for simplicity
2. **CI/CD**: Use Docker for consistency across platforms
3. **Production**: Use Kubernetes for scalability and orchestration
4. **macOS Native**: Use Apple Containers for best performance on Apple Silicon
5. **Security**: Use Podman rootless mode for enhanced security

## Troubleshooting

### Runtime Not Available

If a runtime shows as unavailable:

1. Check if it's installed: `docker --version`, `podman --version`, `kubectl version`
2. Check if the daemon is running (Docker only): `docker ps`
3. Check permissions: Ensure user has access to Docker socket
4. For Podman on macOS: Check if machine is running: `podman machine list`

### Permission Denied

```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker

# For Podman rootless
podman system migrate
```

### Auto-Detection Not Working

Force a specific runtime:

```bash
export VIBECODE_CONTAINER_RUNTIME=docker
```

Or use the API:

```bash
curl -X POST http://localhost:3000/api/runtime \
  -H "Content-Type: application/json" \
  -d '{"runtime": "docker"}'
```

## Migration Guide

### From Apple Container to Unified Runtime

The existing Apple Container implementation has been wrapped in the unified interface. No changes needed to existing code, but you can now also use other runtimes.

### From Direct Docker Usage

Replace direct Docker API calls with the runtime interface:

**Before:**
```typescript
import Docker from 'dockerode';

const docker = new Docker();
const container = await docker.createContainer({ ... });
await container.start();
```

**After:**
```typescript
import { getRuntimeWithFallback } from '@/lib/container';

const runtime = await getRuntimeWithFallback();
await runtime.start('image:tag', { ... });
```

## Performance Benchmarks

Coming soon: Performance comparisons between different runtimes.

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines on adding new runtime implementations.
