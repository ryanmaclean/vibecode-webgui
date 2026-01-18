# Native VM Provider

A high-performance VM provider that wraps Apple's Virtualization.framework using Swift for native macOS virtualization.

## Architecture

The Native VM Provider consists of two layers:

### 1. TypeScript Layer (`native-vm.ts`)
- Implements the `VMProvider` interface
- Manages VM lifecycle (create, start, stop, destroy)
- Communicates with Swift binary via JSON-RPC over stdio
- Handles VM directory structure and configuration files

### 2. Swift Layer (`platforms/macos/vm/Sources/main.swift`)
- Wraps Apple Virtualization.framework
- Implements JSON-RPC server for programmatic control
- Manages actual VM instances using VZVirtualMachine
- Handles hardware configuration (CPU, memory, disk, network)

## Communication Protocol

The two layers communicate using JSON-RPC 2.0 over stdin/stdout:

```json
// Request (TypeScript → Swift)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "vm.create",
  "params": {
    "vmId": "my-vm",
    "cpus": 4,
    "memoryGB": 4,
    "kernelPath": "/path/to/vmlinuz",
    "initrdPath": "/path/to/initramfs",
    "diskPath": "/path/to/disk.img"
  }
}

// Response (Swift → TypeScript)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "vmId": "my-vm",
    "status": "running"
  }
}
```

### Supported JSON-RPC Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `vm.create` | `vmId`, `cpus`, `memoryGB`, `kernelPath`, `initrdPath`, `diskPath` | Create and start a new VM |
| `vm.start` | `vmId` | Start an existing VM |
| `vm.stop` | `vmId` | Stop a running VM |
| `vm.status` | `vmId` | Get VM status |
| `vm.list` | - | List all managed VMs |
| `vm.exec` | `vmId`, `command` | Execute command (not yet implemented) |
| `vm.destroy` | `vmId` | Destroy a VM |

## Requirements

- **Platform**: macOS only
- **OS Version**: macOS 12.0+ (Monterey or later)
- **Swift Binary**: Compiled Swift binary at `platforms/macos/vm/.build/release/vibecode-vm`

## Building the Swift Binary

```bash
cd platforms/macos/vm
swift build -c release
```

The binary will be created at `.build/release/vibecode-vm`.

## Directory Structure

Each VM has the following directory structure:

```
~/.vibecode/native-vms/
└── vm-name/
    ├── kernel/
    │   ├── vmlinuz      # Linux kernel
    │   └── initramfs    # Initial ramdisk
    ├── disk/
    │   └── root.img     # VM disk image
    ├── logs/
    │   └── console.log  # VM console output (if configured)
    └── config.json      # VM configuration
```

## Usage

### Automatic Detection

The provider is automatically detected if:
1. Running on macOS 12.0+
2. Swift binary exists and is executable

```typescript
import { ProviderFactory } from '@/lib/vm/provider-factory';

const provider = await ProviderFactory.detectProvider();
// Will return NativeVMProvider if available
```

### Explicit Provider Selection

```typescript
const provider = await ProviderFactory.getProvider('native-vm');
```

### Creating a VM

```typescript
import { VMConfig } from '@/lib/vm/types';

const config: VMConfig = {
  name: 'my-vm',
  cpus: 4,
  memory: '4GB',
  disk: '20GB',
  image: 'alpine-3.22',
  arch: 'arm64',
  ports: [
    { host: 8080, guest: 8080, protocol: 'tcp' }
  ]
};

const vm = await provider.create(config);
```

### Managing VMs

```typescript
// List all VMs
const vms = await provider.list();

// Get VM status
const status = await provider.status('my-vm');

// Stop a VM
await provider.stop('my-vm');

// Start a stopped VM
await provider.start('my-vm');

// Destroy a VM
await provider.destroy('my-vm');
```

## Implementation Details

### VM Lifecycle

1. **Create**:
   - Create directory structure
   - Download/verify kernel and initramfs
   - Create disk image (sparse file)
   - Launch Swift process with JSON-RPC
   - Send `vm.create` request
   - Wait for VM to be ready

2. **Start**:
   - Load VM configuration from disk
   - Launch Swift process
   - Send `vm.start` request
   - Wait for VM to be ready

3. **Stop**:
   - Send `vm.stop` request
   - Wait for graceful shutdown (10s timeout)
   - Force kill if timeout exceeded
   - Clean up process map

4. **Destroy**:
   - Stop VM (if running)
   - Remove VM directory and all files

### Error Handling

- **Platform Check**: Returns false during detection if not macOS
- **Version Check**: Returns false if macOS < 12.0
- **Binary Check**: Returns false if Swift binary not found/executable
- **Graceful Shutdown**: 10-second timeout before force kill
- **JSON-RPC Timeout**: 30-second timeout for requests (configurable)

### Process Management

- Each VM has a dedicated Swift process
- Processes are tracked in a Map<vmId, ChildProcess>
- Processes are cleaned up on VM stop/destroy
- Orphaned processes are detected during list()

## Testing

Unit tests are provided in `__tests__/native-vm.test.ts`:

```bash
npm test src/lib/vm/providers/__tests__/native-vm.test.ts
```

Tests cover:
- Platform detection
- VM creation and lifecycle
- JSON-RPC communication
- Error handling
- Utility methods

## Performance Characteristics

### Advantages
- **Native Performance**: Direct access to Apple Virtualization.framework
- **No Emulation**: Hardware-accelerated virtualization
- **Low Overhead**: Minimal abstraction layers
- **Fast Boot**: VMs boot in 2-3 seconds
- **Efficient Memory**: Shared memory with host

### Limitations
- **macOS Only**: Not portable to other platforms
- **macOS 12+**: Requires recent macOS version
- **No Live Migration**: VMs cannot be moved between hosts
- **No Snapshots**: Snapshot functionality not yet implemented
- **Limited Exec**: Command execution requires SSH/serial setup

## Future Enhancements

### Short Term
1. Implement `vm.exec` using virtio-serial or SSH
2. Add port forwarding support in Swift layer
3. Implement VM snapshots
4. Add volume mounting support

### Long Term
1. GUI for VM management
2. Live migration between Macs
3. GPU passthrough for ML workloads
4. Integration with Apple Silicon optimizations
5. Rosetta 2 support for x86_64 VMs on ARM

## Troubleshooting

### Swift Binary Not Found
```bash
# Build the Swift binary
cd platforms/macos/vm
swift build -c release

# Verify it exists
ls -l .build/release/vibecode-vm
```

### VM Fails to Start
Check the Swift process stderr:
```typescript
// The provider logs stderr to logger
// Check application logs for Swift VM errors
```

### JSON-RPC Communication Issues
- Ensure Swift binary supports `--json-rpc` flag
- Check that stdin/stdout are not blocked
- Verify JSON formatting in requests/responses

### macOS Version Issues
```bash
# Check macOS version
sw_vers -productVersion

# Minimum: 12.0
```

## Related Files

- **Provider Implementation**: `src/lib/vm/providers/native-vm.ts`
- **Swift VM Manager**: `platforms/macos/vm/Sources/main.swift`
- **Swift Package**: `platforms/macos/vm/Package.swift`
- **Provider Factory**: `src/lib/vm/provider-factory.ts`
- **Type Definitions**: `src/lib/vm/types.ts`
- **Unit Tests**: `src/lib/vm/providers/__tests__/native-vm.test.ts`

## Credits

Developed as part of VibeCode WebGUI to provide native macOS virtualization support using Apple's Virtualization.framework.
