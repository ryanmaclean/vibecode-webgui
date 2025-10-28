# Complete VM Management Solution for Code-Server Testing

## Overview

You now have a complete system to **create, test, and remove** macOS VMs for code-server testing using VirtualBuddy.

## Key Benefits

✅ **Automated Operations**: Script everything from VM creation to cleanup  
✅ **Efficient Cloning**: APFS clones use minimal disk space  
✅ **Testing Workflow**: Automated testing and validation  
✅ **Easy Management**: Single command operations  

## Core Scripts

### `vm-ops.sh` - Main VM Operations
Complete VM lifecycle management:
- `list` - List all VMs
- `create <name>` - Create VM clone
- `start <name>` - Start VM in VirtualBuddy
- `test <name>` - Test VM connectivity
- `install-code <name>` - Install code-server
- `status <name>` - Check VM status
- `remove <name>` - Remove VM
- `clone <source> <target>` - Clone VM
- `cleanup` - Remove all test VMs

### `test-codeserver-build.sh` - Testing Workflow
Automated testing pipeline:
- `create-test` - Create new test VM
- `run-test [name]` - Run full test suite
- `status` - Show all test VM statuses
- `cleanup` - Clean up all test VMs

## Usage Examples

### Basic Workflow

```bash
# 1. List existing VMs
./scripts/vm-ops.sh list

# 2. Create a new test VM
./scripts/vm-ops.sh create my-test-vm

# 3. Start the VM
./scripts/vm-ops.sh start my-test-vm

# 4. Test connectivity (after VM boots)
./scripts/vm-ops.sh test my-test-vm

# 5. Install code-server
./scripts/vm-ops.sh install-code my-test-vm

# 6. Check status
./scripts/vm-ops.sh status my-test-vm

# 7. Remove when done
./scripts/vm-ops.sh remove my-test-vm
```

### Automated Testing Workflow

```bash
# 1. Create test VM
./scripts/test-codeserver-build.sh create-test

# 2. Start VM (opens VirtualBuddy)
./scripts/vm-ops.sh start test-codeserver-1

# 3. Wait for boot, then run tests
./scripts/test-codeserver-build.sh run-test test-codeserver-1

# 4. Access code-server at http://test-codeserver-1.local:8080

# 5. Cleanup when done
./scripts/test-codeserver-build.sh cleanup
```

## Quick Start

```bash
# Show help
./scripts/vm-ops.sh

# Show test script help  
./scripts/test-codeserver-build.sh
```

## Technical Details

### VM Storage
- Location: `~/Library/Application Support/VirtualBuddy/*.vbvm`
- Format: APFS clones (very efficient)
- Each clone: Minimal disk usage

### Network
- Domain: `.local` (Bonjour/mDNS)
- Hostname: `{vm-name}.local`
- SSH: Passwordless authentication
- code-server: Port 8080

### VM Specs
- Hardware: VirtualMac2,1 (VirtualBuddy)
- Architecture: ARM64 on APFS
- OS: macOS 15.6.1
- Memory: Configurable (default 8GB)
- CPUs: Configurable (default 4)

## Complete Feature List

✅ **Create**: Clone VMs from templates  
✅ **Start**: Launch VMs in VirtualBuddy  
✅ **Test**: Connectivity and service checks  
✅ **Install**: code-server setup  
✅ **Status**: Real-time VM status  
✅ **Remove**: Clean up VMs  
✅ **Clone**: Duplicate existing VMs  
✅ **Cleanup**: Bulk removal of test VMs  

## References

- [VirtualBuddy](https://github.com/insidegui/VirtualBuddy) - The VM software
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization) - Underlying technology
- [code-server](https://coder.com/docs/code-server/latest) - VS Code in browser

## File Structure

```
scripts/
├── vm-ops.sh                      # Main operations script
├── test-codeserver-build.sh       # Testing workflow
├── clone-vm-and-setup-codeserver.sh # Legacy clone script
├── setup-codeserver-in-vm.sh      # Legacy setup script
├── README.md                       # Main documentation
├── QUICK-REFERENCE.md             # Quick reference
└── (this file) VM-MANAGEMENT.md    # This file
```

## Success Criteria

✅ Can script VM creation  
✅ Can test VM functionality  
✅ Can remove VMs programmatically  
✅ Can manage multiple test VMs  
✅ Can automate code-server testing  

**You now have complete control over VM lifecycle!**
