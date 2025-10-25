# VM Operations Script Reference

## Quick Reference

### List all VMs
```bash
./scripts/vm-ops.sh list
```

### Create a new VM
```bash
# Create VM from default source
./scripts/vm-ops.sh create my-vm

# Create VM from specific source
./scripts/vm-ops.sh create my-vm "Supporting Anteater"
```

### Start a VM
```bash
# Start VM in VirtualBuddy GUI
./scripts/vm-ops.sh start my-vm
```

### Check VM status
```bash
./scripts/vm-ops.sh status my-vm
```

### Test VM connectivity
```bash
./scripts/vm-ops.sh test my-vm
```

### Install code-server
```bash
./scripts/vm-ops.sh install-code my-vm
```

### Remove a VM
```bash
./scripts/vm-ops.sh remove my-vm
```

### Clone a VM
```bash
./scripts/vm-ops.sh clone source-vm target-vm
```

### Cleanup all test VMs
```bash
./scripts/vm-ops.sh cleanup
```

## Testing Scripts

### Create and test VM
```bash
./scripts/test-codeserver-build.sh create-test
./scripts/vm-ops.sh start test-codeserver-1
# Wait for VM to boot...
./scripts/test-codeserver-build.sh run-test
```

### Show test VM status
```bash
./scripts/test-codeserver-build.sh status
```

### Cleanup test VMs
```bash
./scripts/test-codeserver-build.sh cleanup
```

## Complete Workflow Example

```bash
# 1. Create a test VM
./scripts/test-codeserver-build.sh create-test

# 2. Start the VM in VirtualBuddy GUI
./scripts/vm-ops.sh start test-codeserver-1

# 3. Wait for VM to boot (30-60 seconds)
echo "Waiting for VM to boot..."
sleep 60

# 4. Run tests
./scripts/test-codeserver-build.sh run-test test-codeserver-1

# 5. Access code-server in browser
open http://test-codeserver-1.local:8080

# 6. Cleanup when done
./scripts/test-codeserver-build.sh cleanup
```

## Files

- `vm-ops.sh` - Main VM operations script
- `test-codeserver-build.sh` - Automated testing workflow
- `clone-vm-and-setup-codeserver.sh` - Legacy clone script
- `setup-codeserver-in-vm.sh` - Legacy setup script
