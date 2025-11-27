---
title: "GRUB EFI Python Scripts"
description: "Python scripts for GRUB EFI bootloader management with ddtrace observability"
sidebar:
  order: 2
---

# GRUB EFI Python Scripts

All GRUB EFI bootloader management scripts are written in Python for better observability with ddtrace and easier maintenance.

## Overview

The Python scripts provide:
- **ddtrace integration** for observability and tracing
- **Better error handling** with clear messages and exit codes
- **JSON output** for automation and integration
- **Comprehensive validation** of GRUB installation
- **End-to-end testing** capabilities

## Available Scripts

### 1. validate-grub-installation.py

Validates GRUB installation on Alpine Linux disk images.

```bash
python scripts/vfkit/validate-grub-installation.py <disk_path> [efi_store_path] [--json]
```

**Features:**
- Checks disk image exists and is readable
- Validates partition structure (GPT with ESP)
- Verifies GRUB EFI bootloader files exist
- Validates EFI variable store
- Supports JSON output for automation

**Example:**
```bash
# Basic validation
python scripts/vfkit/validate-grub-installation.py \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img

# With EFI store and JSON output
python scripts/vfkit/validate-grub-installation.py \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram \
    --json
```

### 2. install-grub-alpine.py

Installs GRUB EFI bootloader on Alpine Linux disk images.

```bash
python scripts/vfkit/install-grub-alpine.py <disk_path> [vm_name] [--method=auto|vm|chroot]
```

**Features:**
- VM-based installation (uses vfkit + cloud-init)
- Chroot installation (mounts disk, requires root)
- Auto-detects best method
- Full ddtrace tracing

**Example:**
```bash
# Auto-detect method
python scripts/vfkit/install-grub-alpine.py \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    postgresql

# Force VM method
python scripts/vfkit/install-grub-alpine.py \
    <disk_path> <vm_name> --method=vm
```

### 3. manage-efi-boot-entries.py

Manages EFI boot entries for Virtualization.framework VMs.

```bash
python scripts/vfkit/manage-efi-boot-entries.py create <vm_name> <disk_path> <efi_store_path>
python scripts/vfkit/manage-efi-boot-entries.py discover <disk_path> <efi_store_path>
python scripts/vfkit/manage-efi-boot-entries.py list <efi_store_path>
```

**Commands:**
- `create` - Prepare EFI boot entry (actual entry created on first boot)
- `discover` - Boot VM once to let EFI firmware discover bootloader
- `list` - List boot entries (limited - Virtualization.framework doesn't expose API)

**Example:**
```bash
# Create boot entry
python scripts/vfkit/manage-efi-boot-entries.py create postgresql \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram

# Discover boot entries
python scripts/vfkit/manage-efi-boot-entries.py discover \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
```

### 4. test-grub-boot.py

End-to-end test workflow for GRUB installation.

```bash
python scripts/vfkit/test-grub-boot.py [--vm-name=test-vm] [--disk-size=5] [--cleanup]
```

**Features:**
- Creates test VM
- Installs GRUB
- Validates installation
- Creates EFI store
- Optional cleanup

**Example:**
```bash
# Run test with default settings
python scripts/vfkit/test-grub-boot.py

# Custom VM name and disk size
python scripts/vfkit/test-grub-boot.py --vm-name=my-test-vm --disk-size=10

# Clean up after test
python scripts/vfkit/test-grub-boot.py --cleanup
```

## ddtrace Integration

All scripts support ddtrace for observability. To enable:

```bash
# Install ddtrace
pip install ddtrace

# Run with tracing
ddtrace-run python scripts/vfkit/validate-grub-installation.py <disk_path>
```

**Configuration:**
```bash
export DD_SERVICE=vibecode-vm
export DD_ENV=development
export DD_AGENT_HOST=localhost
export DD_TRACE_AGENT_PORT=8126
```

**Traces include:**
- Operation spans (validation, installation, discovery)
- Error tracking
- Performance metrics
- Tags (VM name, disk path, method, etc.)

## Integration Examples

### In Build Scripts

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

### JSON Output for Automation

```python
import json
import subprocess

def check_grub_status(disk_path: str) -> dict:
    """Check GRUB installation status"""
    result = subprocess.run([
        "python", "scripts/vfkit/validate-grub-installation.py",
        disk_path, "--json"
    ], capture_output=True, text=True)
    
    return json.loads(result.stdout)
```

## Requirements

- Python 3.7+
- macOS (for hdiutil, diskutil)
- vfkit (for VM-based GRUB installation)
- Optional: ddtrace (for observability)
- Optional: qemu-img (for disk creation)

## Error Handling

All scripts provide:
- Clear error messages with color coding
- Exit codes (0 = success, 1 = failure)
- Detailed validation reports
- JSON output option for automation

## Migration from Bash Scripts

The original bash scripts are still available for compatibility:
- `install-grub-alpine.sh` → `install-grub-alpine.py`
- `manage-efi-boot-entries.sh` → `manage-efi-boot-entries.py`

Python scripts provide:
- Better error handling
- ddtrace integration
- JSON output for automation
- Easier testing and maintenance

## See Also

- [EFI Bootloader Setup Guide](./efi-bootloader-setup.md) - Complete setup guide
- [README-PYTHON-SCRIPTS.md](../../../scripts/vfkit/README-PYTHON-SCRIPTS.md) - Detailed script documentation


