# VM Provider Implementation Guide

## Overview

This guide walks through implementing a new VM provider for the VibeCode VM abstraction layer. You'll learn how to create a provider that integrates seamlessly with the existing architecture.

## Prerequisites

Before implementing a provider, ensure you understand:

1. The [VM Provider Abstraction API](./vm-provider-abstraction-api-design.md)
2. TypeScript and async/await patterns
3. The target virtualization technology
4. Platform-specific considerations

## Step-by-Step Implementation

### Step 1: Create Provider File

Create a new file in `src/lib/vm/providers/`:

```typescript
// src/lib/vm/providers/your-provider.ts

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export class YourProvider implements VMProvider {
  name = 'your-provider';

  // Implement required methods...
}
```

### Step 2: Implement Detection

The `detect()` method checks if the provider is available:

```typescript
async detect(): Promise<boolean> {
  try {
    // Check if binary exists
    await exec('which your-vm-binary');
    return true;
  } catch {
    return false;
  }
}
```

**Best Practices:**
- Check for required binaries
- Verify minimum versions if needed
- Check platform compatibility
- Test for required permissions

**Examples from existing providers:**

```typescript
// vfkit: Simple binary check
async detect(): Promise<boolean> {
  try {
    await exec('which vfkit');
    return true;
  } catch {
    return false;
  }
}

// WSL2: Platform + feature check
async detect(): Promise<boolean> {
  if (os.platform() !== 'win32') {
    return false;
  }

  try {
    const { stdout } = await exec('wsl --status');
    return stdout.includes('WSL 2');
  } catch {
    return false;
  }
}

// QEMU: Multiple binary options
async detect(): Promise<boolean> {
  const arch = os.arch();
  const qemuBinary = arch === 'arm64'
    ? 'qemu-system-aarch64'
    : 'qemu-system-x86_64';

  try {
    await exec(`which ${qemuBinary}`);
    return true;
  } catch {
    return false;
  }
}
```

### Step 3: Implement VM Creation

The `create()` method provisions and starts a new VM:

```typescript
async create(config: VMConfig): Promise<VM> {
  logger.info('Creating VM', { name: config.name, provider: this.name });

  // 1. Create VM directory structure
  const vmDir = await this.createVMDirectory(config.name);

  // 2. Download/prepare base image
  await this.ensureBaseImage(vmDir, config.image);

  // 3. Create disk
  await this.createDisk(vmDir, config.disk);

  // 4. Launch VM
  const vm = await this.launchVM(vmDir, config);

  // 5. Wait for boot
  await this.waitForBoot(vm.id);

  // 6. Run provisioning
  if (config.provision) {
    await this.runProvisioning(vm.id, config.provision);
  }

  return vm;
}
```

**Key considerations:**
- Create reproducible VM environments
- Handle errors gracefully
- Provide progress feedback
- Support idempotent operations (re-running is safe)
- Clean up on failure

**Example from vfkit:**

```typescript
async create(config: VMConfig): Promise<VM> {
  const vmDir = path.join(this.vmBaseDir, config.name);

  // Create directories
  await this.createDirectories(vmDir);

  // Ensure kernel
  await this.ensureKernel(vmDir, config);

  // Ensure rootfs
  await this.ensureRootfs(vmDir, config);

  // Create disk
  await this.createDisk(vmDir, config.disk);

  // Launch
  return await this.launch(vmDir, config);
}
```

### Step 4: Implement VM Lifecycle

Implement start, stop, and destroy operations:

```typescript
async start(vmId: string): Promise<void> {
  logger.info('Starting VM', { vmId });

  // Read VM configuration
  const config = await this.loadVMConfig(vmId);

  // Start the VM
  await this.launchVM(vmId, config);
}

async stop(vmId: string): Promise<void> {
  logger.info('Stopping VM', { vmId });

  // Get PID or handle
  const pid = await this.getVMPid(vmId);

  // Send shutdown signal
  process.kill(pid, 'SIGTERM');

  // Wait for graceful shutdown
  await this.waitForShutdown(vmId, 30000);

  // Force kill if needed
  try {
    process.kill(pid, 0);
    process.kill(pid, 'SIGKILL');
  } catch {
    // Already stopped
  }
}

async destroy(vmId: string): Promise<void> {
  logger.info('Destroying VM', { vmId });

  // Stop if running
  try {
    await this.stop(vmId);
  } catch {
    // May not be running
  }

  // Remove VM files
  const vmDir = path.join(this.vmBaseDir, vmId);
  await fs.rm(vmDir, { recursive: true, force: true });
}
```

### Step 5: Implement VM Listing

```typescript
async list(): Promise<VM[]> {
  const vms: VM[] = [];

  try {
    const entries = await fs.readdir(this.vmBaseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const vmDir = path.join(this.vmBaseDir, entry.name);
          const config = await this.loadVMConfig(vmDir);
          const status = await this.getVMStatus(entry.name);

          vms.push({
            id: entry.name,
            name: entry.name,
            provider: this.name,
            status,
            ports: config.ports || [],
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } catch {
          // Skip invalid VMs
        }
      }
    }
  } catch (error) {
    logger.error('Failed to list VMs', { error });
  }

  return vms;
}
```

### Step 6: Implement Command Execution

```typescript
async exec(vmId: string, command: string): Promise<ExecResult> {
  const startTime = Date.now();

  logger.info('Executing command', { vmId, command });

  try {
    // Method depends on provider:
    // - SSH for network-accessible VMs
    // - Serial console for low-level access
    // - Provider CLI (like Lima)
    // - Direct exec (like Docker)

    const { stdout, stderr } = await exec(
      `your-vm-exec ${vmId} -- ${command}`
    );

    return {
      exitCode: 0,
      stdout,
      stderr,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      duration: Date.now() - startTime
    };
  }
}
```

**Execution methods by provider type:**

| Provider | Method | Notes |
|----------|--------|-------|
| vfkit | Serial console | Need virtio-serial device |
| QEMU | SSH | Requires SSH server in VM |
| Lima | `limactl shell` | Built-in |
| WSL2 | `wsl -d` | Native command |
| Docker | `docker exec` | Native command |

### Step 7: Implement Status Checking

```typescript
async status(vmId: string): Promise<VMStatus> {
  try {
    const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');
    const pid = await fs.readFile(pidPath, 'utf-8');

    // Check if process is running
    try {
      process.kill(parseInt(pid.trim()), 0);
      return 'running';
    } catch {
      return 'stopped';
    }
  } catch {
    return 'unknown';
  }
}
```

### Step 8: Add to Provider Factory

Update `src/lib/vm/provider-factory.ts`:

```typescript
import { YourProvider } from './providers/your-provider';

export class ProviderFactory {
  static async detectProvider(): Promise<VMProvider> {
    const sysInfo = await this.getSystemInfo();

    // Add your provider to detection logic
    if (sysInfo.os === 'your-platform') {
      if (await this.hasYourProvider()) {
        logger.info('Using your provider');
        return new YourProvider();
      }
    }

    // ... existing logic
  }

  static async getProvider(name: string): Promise<VMProvider> {
    switch (name.toLowerCase()) {
      case 'your-provider':
        if (!await this.hasYourProvider()) {
          throw new Error('Your provider not found');
        }
        return new YourProvider();

      // ... existing cases
    }
  }

  private static async hasYourProvider(): Promise<boolean> {
    return await this.commandExists('your-vm-binary');
  }
}
```

### Step 9: Add Tests

Create integration tests in `tests/integration/vm-providers.test.ts`:

```typescript
describe('YourProvider Tests', () => {
  it('should detect your provider', async () => {
    const { YourProvider } = await import('@/lib/vm/providers/your-provider');
    const provider = new YourProvider();

    const canDetect = await provider.detect();

    if (canDetect) {
      console.log('Your provider is available');
      const vms = await provider.list();
      console.log(`VMs found: ${vms.length}`);
    } else {
      console.log('Your provider not available');
    }
  });

  it.skip('should create and destroy VM', async () => {
    const provider = new YourProvider();

    const vm = await provider.create({
      name: 'test-vm',
      cpus: 1,
      memory: '512MB',
      disk: '1GB',
      image: 'alpine-3.22'
    });

    expect(vm.status).toBe('running');

    await provider.destroy(vm.id);
  });
});
```

## Helper Utilities

### Size Parsing

```typescript
private parseSizeToBytes(size: string): number {
  const match = size.match(/^(\d+)(GB|MB|KB)?$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseInt(match[1]);
  const unit = (match[2] || 'MB').toUpperCase();

  switch (unit) {
    case 'GB':
      return value * 1024 * 1024 * 1024;
    case 'MB':
      return value * 1024 * 1024;
    case 'KB':
      return value * 1024;
    default:
      return value;
  }
}
```

### PID Management

```typescript
private async savePID(vmDir: string, pid: number): Promise<void> {
  const pidPath = path.join(vmDir, 'vm.pid');
  await fs.writeFile(pidPath, pid.toString());
}

private async loadPID(vmDir: string): Promise<number> {
  const pidPath = path.join(vmDir, 'vm.pid');
  const pid = await fs.readFile(pidPath, 'utf-8');
  return parseInt(pid.trim());
}
```

### Config Management

```typescript
private async saveConfig(vmDir: string, config: VMConfig): Promise<void> {
  const configPath = path.join(vmDir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

private async loadVMConfig(vmDir: string): Promise<VMConfig> {
  const configPath = path.join(vmDir, 'config.json');
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}
```

## Provider-Specific Considerations

### macOS Providers (vfkit)

- Use Apple's Virtualization.framework
- Requires macOS 11+ and arm64 architecture
- No nested virtualization
- Excellent performance on Apple Silicon
- Limited to macOS guests (experimental Linux support)

**Key APIs:**
```typescript
import { Virtualization } from 'virtualization-framework';

const vm = new Virtualization.VM({
  cpuCount: config.cpus,
  memorySize: this.parseSizeToBytes(config.memory),
  bootLoader: new Virtualization.LinuxBootLoader({
    kernelPath: '/path/to/vmlinux',
    initialRamdiskPath: '/path/to/initrd'
  })
});
```

### Linux Providers (QEMU/KVM)

- Use QEMU with optional KVM acceleration
- Check for `/dev/kvm` availability
- Support wide range of guest OSes
- Good performance with KVM

**Command structure:**
```bash
qemu-system-aarch64 \
  -M virt \
  -cpu host \
  -enable-kvm \
  -m 4096 \
  -smp 4 \
  -drive file=disk.qcow2,format=qcow2 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -device virtio-net-pci,netdev=net0
```

### Windows Providers (WSL2)

- Use `wsl` command-line tool
- Import custom distributions
- Limited to Linux guests
- Excellent performance
- Tight Windows integration

**Key commands:**
```bash
# Import distribution
wsl --import distro-name install-dir rootfs.tar.gz

# Run command
wsl -d distro-name -- command

# Terminate
wsl --terminate distro-name
```

### Cross-Platform (Lima)

- Wraps QEMU with sensible defaults
- YAML configuration format
- Good for development
- Slightly slower than native

**Configuration:**
```yaml
arch: aarch64
cpus: 4
memory: 8GB
disk: 50GB
images:
  - location: https://example.com/image.iso
    arch: aarch64
```

## Performance Optimization

### 1. Use Hardware Acceleration

```typescript
// Check for KVM on Linux
async hasKVM(): Promise<boolean> {
  try {
    await fs.access('/dev/kvm');
    return true;
  } catch {
    return false;
  }
}

// Enable in QEMU
if (await this.hasKVM()) {
  args.push('-enable-kvm', '-cpu', 'host');
}
```

### 2. Optimize Disk I/O

```typescript
// Use virtio for better performance
args.push('-drive', `file=${diskPath},format=qcow2,if=virtio`);

// Enable discard/trim
args.push('-drive', `file=${diskPath},discard=unmap`);
```

### 3. Optimize Network

```typescript
// Use virtio-net
args.push('-device', 'virtio-net-pci,netdev=net0');

// Enable multiqueue
args.push('-netdev', 'user,id=net0,mq=on');
```

### 4. Memory Optimization

```typescript
// Enable memory ballooning
args.push('-device', 'virtio-balloon');

// Use huge pages (Linux)
args.push('-mem-path', '/dev/hugepages');
```

## Debugging

### Enable Verbose Logging

```typescript
import { logger } from '@/lib/logger';

logger.debug('VM operation', {
  provider: this.name,
  vmId,
  operation: 'start',
  config
});
```

### Monitor VM Console

```typescript
// Redirect VM console to file
const consolePath = path.join(vmDir, 'console.log');
args.push('-serial', `file:${consolePath}`);

// Read console output
const console = await fs.readFile(consolePath, 'utf-8');
logger.debug('VM console output', { console });
```

### Integration with Datadog

```typescript
let __tracer: any;
function getTracer() {
  if (!__tracer) {
    try {
      const t = require('dd-trace');
      if (!t._initialized) {
        t.init({ service: 'vibecode-webgui' });
        t._initialized = true;
      }
      __tracer = t;
    } catch {
      __tracer = { startSpan: () => ({ setTag() {}, finish() {} }) };
    }
  }
  return __tracer;
}

// Use in operations
const span = getTracer().startSpan('vm.create');
span.setTag('vm.provider', this.name);
try {
  const vm = await this.create(config);
  span.finish();
  return vm;
} catch (e) {
  span.setTag('error', true);
  span.finish();
  throw e;
}
```

## Common Pitfalls

### 1. Race Conditions

**Problem:** VM not ready when returning from `create()`

**Solution:** Wait for VM to be fully booted
```typescript
async waitForBoot(vmId: string, timeout = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await this.exec(vmId, 'echo ready');
      if (result.exitCode === 0) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('VM boot timeout');
}
```

### 2. Resource Leaks

**Problem:** VMs not cleaned up on failure

**Solution:** Use try-finally blocks
```typescript
async create(config: VMConfig): Promise<VM> {
  const vmDir = path.join(this.vmBaseDir, config.name);

  try {
    await this.createVMDirectory(vmDir);
    // ... rest of creation
  } catch (error) {
    // Clean up on failure
    await fs.rm(vmDir, { recursive: true, force: true });
    throw error;
  }
}
```

### 3. Platform-Specific Paths

**Problem:** Hard-coded paths don't work cross-platform

**Solution:** Use path helpers
```typescript
import * as path from 'path';
import * as os from 'os';

const vmBaseDir = path.join(os.homedir(), '.vibecode', 'vms');
```

### 4. Missing Error Context

**Problem:** Generic errors are hard to debug

**Solution:** Add context to errors
```typescript
try {
  await this.launchVM(config);
} catch (error) {
  throw new Error(`Failed to launch ${this.name} VM: ${error.message}`);
}
```

## Testing Checklist

- [ ] Provider detection works correctly
- [ ] VM creation succeeds
- [ ] VM starts and stops correctly
- [ ] VM can be destroyed
- [ ] VM listing works
- [ ] Command execution works
- [ ] Status checking works
- [ ] Port forwarding works (if supported)
- [ ] Volume mounting works (if supported)
- [ ] Error handling is robust
- [ ] Resource cleanup is complete
- [ ] Performance is acceptable
- [ ] Documentation is complete

## Example: Minimal Provider

Here's a minimal working provider:

```typescript
import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export class MinimalProvider implements VMProvider {
  name = 'minimal';

  async detect(): Promise<boolean> {
    try {
      await exec('which my-vm-tool');
      return true;
    } catch {
      return false;
    }
  }

  async create(config: VMConfig): Promise<VM> {
    // Call your VM tool
    const { stdout } = await exec(
      `my-vm-tool create ${config.name} --cpus ${config.cpus} --memory ${config.memory}`
    );

    return {
      id: config.name,
      name: config.name,
      provider: this.name,
      status: 'running',
      ports: config.ports || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async start(vmId: string): Promise<void> {
    await exec(`my-vm-tool start ${vmId}`);
  }

  async stop(vmId: string): Promise<void> {
    await exec(`my-vm-tool stop ${vmId}`);
  }

  async destroy(vmId: string): Promise<void> {
    await exec(`my-vm-tool delete ${vmId}`);
  }

  async list(): Promise<VM[]> {
    const { stdout } = await exec('my-vm-tool list --json');
    const vms = JSON.parse(stdout);

    return vms.map((vm: any) => ({
      id: vm.id,
      name: vm.name,
      provider: this.name,
      status: vm.status,
      ports: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  async exec(vmId: string, command: string): Promise<ExecResult> {
    const start = Date.now();

    try {
      const { stdout, stderr } = await exec(
        `my-vm-tool exec ${vmId} -- ${command}`
      );

      return {
        exitCode: 0,
        stdout,
        stderr,
        duration: Date.now() - start
      };
    } catch (error: any) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        duration: Date.now() - start
      };
    }
  }

  async status(vmId: string): Promise<VMStatus> {
    try {
      const { stdout } = await exec(`my-vm-tool status ${vmId}`);
      return stdout.includes('running') ? 'running' : 'stopped';
    } catch {
      return 'unknown';
    }
  }
}
```

## Next Steps

1. Review [VM Provider Comparison](./vm-provider-comparison.md) to understand trade-offs
2. Check existing providers for reference implementations
3. Test your provider thoroughly
4. Submit a pull request with documentation
5. Update the provider factory detection logic

## Resources

- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [QEMU Documentation](https://www.qemu.org/documentation/)
- [Lima Documentation](https://lima-vm.io/)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Docker Documentation](https://docs.docker.com/)
