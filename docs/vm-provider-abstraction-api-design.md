# VM Provider Abstraction Layer API Design

## Overview

VibeCode implements a unified VM provider abstraction layer that enables seamless switching between multiple virtualization backends. This abstraction allows developers to write provider-agnostic code while leveraging platform-specific optimizations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│            (VM Management UI, API Endpoints)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Provider Factory                            │
│      (Auto-detection, Provider Selection, Fallback)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              VMProvider Interface (Abstraction)              │
│   detect() | create() | start() | stop() | destroy()        │
│   list() | exec() | status()                                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  vfkit       │    │    QEMU      │    │    Lima      │
│  Provider    │    │   Provider   │    │   Provider   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Apple Virt   │    │  KVM/QEMU    │    │  Lima CLI    │
│  Framework   │    │   Binary     │    │              │
└──────────────┘    └──────────────┘    └──────────────┘

Additional Providers:
┌──────────────┐    ┌──────────────┐
│    WSL2      │    │   Docker     │
│   Provider   │    │   Provider   │
└──────────────┘    └──────────────┘
```

## Core API Specification

### VMProvider Interface

The `VMProvider` interface defines the contract that all provider implementations must satisfy:

```typescript
interface VMProvider {
  /** Provider name (vfkit, lima, qemu, wsl2, docker) */
  name: string;

  /** Detect if provider is available on current system */
  detect(): Promise<boolean>;

  /** Create and start a new VM */
  create(config: VMConfig): Promise<VM>;

  /** Start an existing VM */
  start(vmId: string): Promise<void>;

  /** Stop a running VM */
  stop(vmId: string): Promise<void>;

  /** Destroy a VM and its resources */
  destroy(vmId: string): Promise<void>;

  /** List all VMs managed by this provider */
  list(): Promise<VM[]>;

  /** Execute command in VM */
  exec(vmId: string, command: string): Promise<ExecResult>;

  /** Get VM status */
  status(vmId: string): Promise<VMStatus>;
}
```

### Data Types

#### VMConfig

Configuration for creating a new VM:

```typescript
interface VMConfig {
  /** VM name (must be unique) */
  name: string;

  /** Number of CPU cores */
  cpus: number;

  /** Memory size (e.g., "4GB", "2048MB") */
  memory: string;

  /** Disk size (e.g., "20GB", "100GB") */
  disk: string;

  /** Base image (alpine-3.22, ubuntu-24.04, etc.) */
  image: string;

  /** Architecture (arm64, x86_64, auto) */
  arch?: 'arm64' | 'x86_64' | 'auto';

  /** Port mappings */
  ports?: PortMapping[];

  /** Volume mappings */
  volumes?: VolumeMapping[];

  /** Provisioning scripts */
  provision?: ProvisionScript[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Provider-specific options */
  providerOptions?: Record<string, any>;
}
```

#### VM

VM instance representation:

```typescript
interface VM {
  /** Unique VM identifier */
  id: string;

  /** VM name */
  name: string;

  /** Provider managing this VM */
  provider: string;

  /** Current status */
  status: VMStatus;

  /** VM IP address (if available) */
  ip?: string;

  /** Port mappings */
  ports: PortMapping[];

  /** Volume mappings */
  volumes?: VolumeMapping[];

  /** VM metadata */
  metadata?: Record<string, any>;

  /** Creation timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;
}
```

#### VMStatus

```typescript
type VMStatus =
  | 'creating'
  | 'running'
  | 'stopped'
  | 'stopping'
  | 'error'
  | 'unknown';
```

#### PortMapping

```typescript
interface PortMapping {
  /** Guest (VM) port */
  guest: number;

  /** Host port */
  host: number;

  /** Protocol (tcp, udp) */
  protocol?: 'tcp' | 'udp';
}
```

#### VolumeMapping

```typescript
interface VolumeMapping {
  /** Host path */
  host: string;

  /** Guest (VM) path */
  guest: string;

  /** Writable flag */
  writable?: boolean;
}
```

#### ProvisionScript

```typescript
interface ProvisionScript {
  /** Execution mode (system, user) */
  mode: 'system' | 'user';

  /** Script content */
  script: string;

  /** Script description */
  description?: string;
}
```

#### ExecResult

```typescript
interface ExecResult {
  /** Exit code */
  exitCode: number;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Execution duration (ms) */
  duration: number;
}
```

## Provider Factory

The `ProviderFactory` class handles provider detection and selection:

### Auto-Detection

```typescript
class ProviderFactory {
  /**
   * Auto-detect and return best VM provider for current platform
   */
  static async detectProvider(): Promise<VMProvider>

  /**
   * Get specific provider by name
   */
  static async getProvider(name: string): Promise<VMProvider>

  /**
   * Get system information
   */
  static async getSystemInfo(): Promise<SystemInfo>
}
```

### Detection Logic

The factory uses the following priority order:

**macOS (Apple Silicon)**
1. vfkit (native Virtualization.framework - best performance)
2. Lima (QEMU wrapper with good defaults)
3. Error if none available

**macOS (Intel)**
1. Lima (QEMU wrapper)
2. QEMU directly
3. Error if none available

**Linux**
1. QEMU with KVM (hardware acceleration)
2. Lima (QEMU wrapper)
3. QEMU without KVM (slower)
4. Error if none available

**Windows**
1. WSL2 (native Windows integration)
2. QEMU
3. Error if none available

**FreeBSD**
1. bhyve (not yet implemented)
2. QEMU
3. Error if none available

### SystemInfo

```typescript
interface SystemInfo {
  /** Operating system */
  os: 'darwin' | 'linux' | 'win32' | 'freebsd';

  /** CPU architecture */
  arch: 'arm64' | 'x86_64';

  /** Is Apple Silicon */
  isAppleSilicon: boolean;

  /** Available providers */
  availableProviders: string[];

  /** Recommended provider */
  recommendedProvider: string;
}
```

## Provider Capabilities

Each provider has different capabilities:

```typescript
interface ProviderCapabilities {
  /** Supports port forwarding */
  portForwarding: boolean;

  /** Supports volume mounting */
  volumeMounting: boolean;

  /** Supports snapshots */
  snapshots: boolean;

  /** Supports live migration */
  liveMigration: boolean;

  /** Supports GPU passthrough */
  gpuPassthrough: boolean;

  /** Maximum CPUs */
  maxCpus: number;

  /** Maximum memory (GB) */
  maxMemory: number;
}
```

## Usage Examples

### Basic Usage

```typescript
import { ProviderFactory } from '@/lib/vm/provider-factory';

// Auto-detect best provider
const provider = await ProviderFactory.detectProvider();
console.log(`Using provider: ${provider.name}`);

// Create a VM
const vm = await provider.create({
  name: 'dev-vm-1',
  cpus: 4,
  memory: '8GB',
  disk: '50GB',
  image: 'alpine-3.22',
  ports: [
    { guest: 22, host: 2222 },
    { guest: 8080, host: 8080 }
  ]
});

console.log(`VM created: ${vm.id}`);
console.log(`Status: ${vm.status}`);

// Execute command
const result = await provider.exec(vm.id, 'uname -a');
console.log(result.stdout);

// Stop VM
await provider.stop(vm.id);
```

### Specific Provider

```typescript
import { ProviderFactory } from '@/lib/vm/provider-factory';

// Get specific provider
const vfkit = await ProviderFactory.getProvider('vfkit');

// Check if available
if (await vfkit.detect()) {
  console.log('vfkit is available');
}
```

### System Information

```typescript
import { ProviderFactory } from '@/lib/vm/provider-factory';

const sysInfo = await ProviderFactory.getSystemInfo();

console.log(`OS: ${sysInfo.os}`);
console.log(`Architecture: ${sysInfo.arch}`);
console.log(`Apple Silicon: ${sysInfo.isAppleSilicon}`);
console.log(`Available: ${sysInfo.availableProviders.join(', ')}`);
console.log(`Recommended: ${sysInfo.recommendedProvider}`);
```

### List VMs

```typescript
const provider = await ProviderFactory.detectProvider();
const vms = await provider.list();

vms.forEach(vm => {
  console.log(`${vm.name} (${vm.provider}): ${vm.status}`);
});
```

### VM Lifecycle Management

```typescript
// Create
const vm = await provider.create(config);

// Stop
await provider.stop(vm.id);

// Start
await provider.start(vm.id);

// Check status
const status = await provider.status(vm.id);

// Destroy
await provider.destroy(vm.id);
```

## Error Handling

All provider methods can throw errors. Recommended error handling:

```typescript
try {
  const provider = await ProviderFactory.detectProvider();
  const vm = await provider.create(config);
} catch (error) {
  if (error.message.includes('No VM provider found')) {
    // Guide user to install a provider
    console.error('Please install vfkit or Lima');
  } else {
    // Handle other errors
    console.error('VM creation failed:', error);
  }
}
```

## Provider-Specific Options

Each provider can accept custom options via `providerOptions`:

### vfkit Options

```typescript
{
  providerOptions: {
    useNetboot: boolean,      // Use netboot kernel
    customKernel: string,     // Custom kernel path
    bootloaderPath: string,   // Custom bootloader
    useVirtioFS: boolean      // Enable VirtioFS for volumes
  }
}
```

### QEMU Options

```typescript
{
  providerOptions: {
    kvm: boolean,             // Enable KVM acceleration
    machine: string,          // Machine type (pc, q35, virt)
    cpu: string,              // CPU model
    accel: string,            // Acceleration (kvm, tcg, hvf)
    display: string,          // Display type (none, gtk, cocoa)
    uefi: boolean            // Use UEFI firmware
  }
}
```

### Lima Options

```typescript
{
  providerOptions: {
    vmType: string,           // qemu, vz (macOS 13+)
    rosetta: boolean,         // Enable Rosetta (macOS only)
    mountType: string,        // reverse-sshfs, 9p, virtiofs
    containerd: boolean       // Install containerd
  }
}
```

### WSL2 Options

```typescript
{
  providerOptions: {
    distribution: string,     // Base distribution
    version: number,          // WSL version (1 or 2)
    defaultUser: string       // Default user
  }
}
```

### Docker Options

```typescript
{
  providerOptions: {
    remoteHost: string,       // Remote Docker host
    registry: string,         // Custom registry
    network: string,          // Docker network
    privileged: boolean       // Privileged mode
  }
}
```

## Implementation Status

### Current Implementation (v1.0)

| Provider | Status | Platform | Notes |
|----------|--------|----------|-------|
| vfkit | ✅ Implemented | macOS (Apple Silicon) | Uses Virtualization.framework |
| QEMU | ✅ Implemented | Linux, macOS, Windows | KVM support on Linux |
| Lima | ✅ Implemented | macOS, Linux | QEMU wrapper with good defaults |
| WSL2 | ✅ Implemented | Windows | Native Windows integration |
| Docker | ✅ Implemented | All | Container-based alternative |

### Future Enhancements (v2.0)

- [ ] Bhyve provider (FreeBSD)
- [ ] VMware provider (commercial license required)
- [ ] VirtualBox provider
- [ ] Hyper-V provider (Windows)
- [ ] Firecracker provider (AWS microVMs)
- [ ] Cloud-init support for all providers
- [ ] Snapshot/restore functionality
- [ ] Live migration between providers
- [ ] GPU passthrough support
- [ ] USB device passthrough

## Testing

### Unit Tests

```typescript
describe('VMProvider', () => {
  it('should detect available providers', async () => {
    const sysInfo = await ProviderFactory.getSystemInfo();
    expect(sysInfo.availableProviders.length).toBeGreaterThan(0);
  });

  it('should create and destroy VM', async () => {
    const provider = await ProviderFactory.detectProvider();
    const vm = await provider.create(testConfig);
    expect(vm.status).toBe('running');
    await provider.destroy(vm.id);
  });
});
```

### Integration Tests

See `tests/integration/vm-providers.test.ts` for comprehensive integration tests.

## Performance Considerations

### vfkit (macOS Apple Silicon)
- **Boot time**: 2-5 seconds
- **Memory overhead**: ~100MB
- **CPU overhead**: <5%
- **Best for**: macOS development

### QEMU with KVM (Linux)
- **Boot time**: 3-8 seconds
- **Memory overhead**: ~150MB
- **CPU overhead**: <10%
- **Best for**: Linux servers

### Lima
- **Boot time**: 5-15 seconds
- **Memory overhead**: ~200MB
- **CPU overhead**: ~15%
- **Best for**: Cross-platform development

### WSL2 (Windows)
- **Boot time**: 1-3 seconds
- **Memory overhead**: ~50MB
- **CPU overhead**: <5%
- **Best for**: Windows development

### Docker
- **Boot time**: <1 second
- **Memory overhead**: ~30MB
- **CPU overhead**: <3%
- **Best for**: Testing, CI/CD

## Security Considerations

1. **Isolation**: Each VM is isolated at the hypervisor level
2. **Network**: VMs use NAT networking by default
3. **File System**: Volume mounts can be read-only
4. **Resource Limits**: CPU and memory limits enforced
5. **User Permissions**: VMs run as unprivileged users

## Monitoring and Observability

Integration with Datadog for VM metrics:

```typescript
import { getTracer } from 'dd-trace';

// Track VM creation
const span = getTracer().startSpan('vm.create');
span.setTag('vm.provider', 'vfkit');
const vm = await provider.create(config);
span.finish();
```

## Related Documentation

- [VM Provider Implementation Guide](./vm-provider-implementation-guide.md)
- [VM Provider Comparison](./vm-provider-comparison.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/vibecode-webgui/issues
- Documentation: https://docs.vibecode.dev
- Community: https://discord.gg/vibecode
