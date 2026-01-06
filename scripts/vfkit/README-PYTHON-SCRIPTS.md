# Python Scripts for GRUB EFI Bootloader Management

All scripts in this directory are written in Python for better observability with ddtrace.

## Scripts Overview

### Core Scripts

1. **`validate-grub-installation.py`** - Validates GRUB installation on disk images
   ```bash
   python validate-grub-installation.py <disk_path> [efi_store_path] [--json]
   ```
   - Checks disk image exists and is readable
   - Validates partition structure (GPT with ESP)
   - Verifies GRUB EFI bootloader files exist
   - Validates EFI variable store
   - Supports JSON output for programmatic use

2. **`install-grub-alpine.py`** - Installs GRUB on Alpine disk images
   ```bash
   python install-grub-alpine.py <disk_path> [vm_name] [--method=auto|vm|chroot]
   ```
   - VM-based installation (uses vfkit + cloud-init)
   - Chroot installation (mounts disk, requires root)
   - Auto-detects best method

3. **`manage-efi-boot-entries.py`** - Manages EFI boot entries
   ```bash
   python manage-efi-boot-entries.py create <vm_name> <disk_path> <efi_store_path>
   python manage-efi-boot-entries.py discover <disk_path> <efi_store_path>
   python manage-efi-boot-entries.py list <efi_store_path>
   ```
   - Creates EFI boot entry preparation
   - Discovers boot entries by booting VM
   - Lists boot entries (limited - Virtualization.framework doesn't expose API)

4. **`test-grub-boot.py`** - End-to-end test workflow
   ```bash
   python test-grub-boot.py [--vm-name=test-vm] [--disk-size=5] [--cleanup]
   ```
   - Creates test VM
   - Installs GRUB
   - Validates installation
   - Creates EFI store
   - Optional cleanup

## ddtrace Integration

All scripts support ddtrace for observability. To enable:

```bash
# Install ddtrace
pip install ddtrace

# Run with tracing
ddtrace-run python validate-grub-installation.py <disk_path>
```

Scripts automatically detect ddtrace availability and add tracing spans for:
- Major operations (validation, installation, discovery)
- Error tracking
- Performance metrics
- Tagged with VM name, disk path, etc.

## Usage Examples

### Validate GRUB Installation

```bash
# Basic validation
python validate-grub-installation.py ~/.vfkit/vms/vibecode-postgresql/disk/root.img

# With EFI store
python validate-grub-installation.py \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram

# JSON output for automation
python validate-grub-installation.py <disk_path> --json
```

### Install GRUB

```bash
# Auto-detect method
python install-grub-alpine.py ~/.vfkit/vms/vibecode-postgresql/disk/root.img postgresql

# Force VM method
python install-grub-alpine.py <disk_path> <vm_name> --method=vm

# Force chroot method (requires root)
python install-grub-alpine.py <disk_path> <vm_name> --method=chroot
```

### Manage EFI Boot Entries

```bash
# Create boot entry
python manage-efi-boot-entries.py create postgresql \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram

# Discover boot entries (boots VM once)
python manage-efi-boot-entries.py discover \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram

# List boot entries (limited)
python manage-efi-boot-entries.py list \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
```

### End-to-End Test

```bash
# Run test with default settings
python test-grub-boot.py

# Custom VM name and disk size
python test-grub-boot.py --vm-name=my-test-vm --disk-size=10

# Clean up after test
python test-grub-boot.py --cleanup
```

## Integration with Build Scripts

You can integrate these scripts into your build process:

```python
#!/usr/bin/env python3
import subprocess
from pathlib import Path

def ensure_grub_installed(disk_path: Path, vm_name: str):
    """Ensure GRUB is installed on disk"""
    script = Path(__file__).parent / "vfkit" / "install-grub-alpine.py"
    result = subprocess.run([
        "python", str(script),
        str(disk_path), vm_name
    ], check=True)
    return result.returncode == 0

def validate_vm_setup(disk_path: Path, efi_store_path: Path):
    """Validate VM is ready to boot"""
    script = Path(__file__).parent / "vfkit" / "validate-grub-installation.py"
    result = subprocess.run([
        "python", str(script),
        str(disk_path), str(efi_store_path)
    ], check=True)
    return result.returncode == 0
```

## Error Handling

All scripts provide:
- Clear error messages with color coding
- Exit codes (0 = success, 1 = failure)
- Detailed validation reports
- JSON output option for automation

## Requirements

- Python 3.7+
- macOS (for hdiutil, diskutil)
- vfkit (for VM-based GRUB installation)
- Optional: ddtrace (for observability)
- Optional: qemu-img (for disk creation)

## Tracing with ddtrace

To enable full observability:

```bash
# Set up ddtrace
export DD_SERVICE=vibecode-vm
export DD_ENV=development
export DD_AGENT_HOST=localhost
export DD_TRACE_AGENT_PORT=8126

# Run with tracing
ddtrace-run python validate-grub-installation.py <disk_path>
```

Traces will include:
- Operation spans (validation, installation, discovery)
- Error tracking
- Performance metrics
- Tags (VM name, disk path, method, etc.)

## Migration from Bash Scripts

The original bash scripts are still available for compatibility:
- `install-grub-alpine.sh` → `install-grub-alpine.py`
- `manage-efi-boot-entries.sh` → `manage-efi-boot-entries.py`
- `prepare-vm-with-grub.sh` → (use Python scripts directly)

Python scripts provide:
- Better error handling
- ddtrace integration
- JSON output for automation
- Easier testing and maintenance

