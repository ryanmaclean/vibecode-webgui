# VM Management Tools Summary

Created comprehensive VM management system for macOS on Apple Silicon.

## Tools Created

1. **vm-menu.py** - Interactive Python CLI
   - Clone VMs with unique Machine IDs
   - Start/stop/backup operations
   - VirtualBuddy + standalone support

2. **vm-native.swift** - Native Apple Virtualization Framework
   - Uses VZVirtualMachineConfiguration
   - IPSW-based creation
   - Configuration persistence

3. **vm-native-cli.py** - Python wrapper
   - Text-based interface
   - Easy commands

4. **vm-cli.sh** - Direct vfkit control
5. **standalone-vm.py** - Independent operation

## Features

✅ Machine ID isolation (prevents conflicts)
✅ IPSW-based creation (clean VM setup)
✅ APFS efficient cloning (minimal disk usage)
✅ Configuration save/load
✅ VirtualBuddy integration
✅ Background processes

## Best Practices from Viable/Vimy/Livable

- Bundle structure for VMs
- ~35MB launcher overhead
- virtiofs for shared folders
- HiDPI/Retina support

## Usage

```bash
# Clone a VM
./vm-menu.py clone "Source" "Target"

# Start VM
./vm-menu.py start "VM Name"

# List VMs
./vm-menu.py list
```

## Documentation

- Wiki: `docs/src/content/docs/wiki/vm-management.md`
- Updated: `docs/src/content/docs/wiki-index.md`

## Next Steps

- Add unit tests for VM operations
- Create CI workflow for VM testing
- Add integration tests

See `scripts/README.md` for full documentation.
