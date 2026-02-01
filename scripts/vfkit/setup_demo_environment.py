#!/usr/bin/env python3


"""Setup complete vfkit demo environment with Alpine ARM64 VMs.

Components: code-server, PostgreSQL, Redis, nginx
"""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import os
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# VM Launcher Script Templates
DEV_VM_SCRIPT = """\
#!/usr/bin/env bash
# Development VM: code-server + Node.js + VibeCode
VFKIT_BASE="${HOME}/.vfkit"

vfkit \\
  --cpus 4 \\
  --memory 4096 \\
  --bootloader efi,variable-store="${VFKIT_BASE}/disks/dev-vm-vars.fd",create \\
  --device virtio-blk,path="${VFKIT_BASE}/disks/dev-vm.img" \\
  --device virtio-serial,logFilePath="${VFKIT_BASE}/vms/dev-vm.log" \\
  --device virtio-net,nat,mac=52:54:00:12:34:56 \\
  --device virtio-rng \\
  --device virtio-fs,sharedDir="${HOME}/vibecode-workspace",mountTag=workspace
"""

DB_VM_SCRIPT = """\
#!/usr/bin/env bash
# Database VM: PostgreSQL
VFKIT_BASE="${HOME}/.vfkit"

vfkit \\
  --cpus 2 \\
  --memory 2048 \\
  --bootloader efi,variable-store="${VFKIT_BASE}/disks/db-vm-vars.fd",create \\
  --device virtio-blk,path="${VFKIT_BASE}/disks/db-vm.img" \\
  --device virtio-blk,path="${VFKIT_BASE}/disks/db-data.img" \\
  --device virtio-serial,logFilePath="${VFKIT_BASE}/vms/db-vm.log" \\
  --device virtio-net,nat,mac=52:54:00:12:34:57 \\
  --device virtio-rng
"""

SERVICES_VM_SCRIPT = """\
#!/usr/bin/env bash
# Services VM: Redis + nginx
VFKIT_BASE="${HOME}/.vfkit"

vfkit \\
  --cpus 2 \\
  --memory 1024 \\
  --bootloader efi,variable-store="${VFKIT_BASE}/disks/services-vm-vars.fd",create \\
  --device virtio-blk,path="${VFKIT_BASE}/disks/services-vm.img" \\
  --device virtio-serial,logFilePath="${VFKIT_BASE}/vms/services-vm.log" \\
  --device virtio-net,nat,mac=52:54:00:12:34:58 \\
  --device virtio-rng
"""

START_DEMO_SCRIPT = """\
#!/usr/bin/env bash
VFKIT_BASE="${HOME}/.vfkit"

echo "Starting VibeCode demo environment..."
"${VFKIT_BASE}/vms/db-vm.sh" &
sleep 3
"${VFKIT_BASE}/vms/services-vm.sh" &
sleep 3
"${VFKIT_BASE}/vms/dev-vm.sh" &

echo "All VMs started!"
echo "Logs: ${VFKIT_BASE}/vms/*.log"
"""


@dataclass
class VMConfig:
    """VM configuration."""

    name: str
    cpus: int
    memory_mb: int
    disk_size: str
    script_content: str


@dataclass
class DiskConfig:
    """Disk image configuration."""

    name: str
    size: str


def get_vfkit_base() -> Path:
    """Get the vfkit base directory."""
    return Path.home() / ".vfkit"


def create_directory_structure(vfkit_base: Path) -> bool:
    """Create the vfkit directory structure.

    Returns:
        True if successful, False otherwise.
    """
    directories = [
        vfkit_base / "vms",
        vfkit_base / "kernels",
        vfkit_base / "disks",
    ]

    try:
        for dir_path in directories:
            dir_path.mkdir(parents=True, exist_ok=True)
        return True
    except OSError:
        return False


def write_executable_script(path: Path, content: str) -> bool:
    """Write a script file and make it executable.

    Returns:
        True if successful, False otherwise.
    """
    try:
        path.write_text(content)
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        return True
    except OSError:
        return False


def create_vm_launcher_scripts(vfkit_base: Path) -> bool:
    """Create VM launcher scripts.

    Returns:
        True if successful, False otherwise.
    """
    scripts = [
        ("dev-vm.sh", DEV_VM_SCRIPT),
        ("db-vm.sh", DB_VM_SCRIPT),
        ("services-vm.sh", SERVICES_VM_SCRIPT),
    ]

    vms_dir = vfkit_base / "vms"

    for script_name, content in scripts:
        script_path = vms_dir / script_name
        if not write_executable_script(script_path, content):
            return False

    return True


def create_disk_image(path: Path, size: str) -> bool:
    """Create a raw disk image using qemu-img.

    Args:
        path: Path to the disk image
        size: Size of the disk (e.g., "20G", "100G")

    Returns:
        True if successful, False otherwise.
    """
    if not shutil.which("qemu-img"):
        print("Warning: qemu-img not found, skipping disk creation")
        return False

    try:
        subprocess.run(
            ["qemu-img", "create", "-f", "raw", str(path), size],
            check=True,
            capture_output=True,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def create_disk_images(vfkit_base: Path) -> bool:
    """Create all disk images.

    Returns:
        True if successful, False otherwise.
    """
    print("Creating disk images...")

    disks_dir = vfkit_base / "disks"
    disk_configs = [
        ("dev-vm.img", "20G"),
        ("db-vm.img", "50G"),
        ("db-data.img", "100G"),
        ("services-vm.img", "10G"),
    ]

    all_success = True
    for disk_name, size in disk_configs:
        disk_path = disks_dir / disk_name
        if disk_path.exists():
            print(f"  Disk already exists: {disk_name}")
            continue

        if create_disk_image(disk_path, size):
            print(f"  Created: {disk_name} ({size})")
        else:
            print(f"  Failed to create: {disk_name}")
            all_success = False

    return all_success


def create_start_script(vfkit_base: Path) -> bool:
    """Create the start-demo.sh script.

    Returns:
        True if successful, False otherwise.
    """
    script_path = vfkit_base / "start-demo.sh"
    return write_executable_script(script_path, START_DEMO_SCRIPT)


def print_summary(vfkit_base: Path) -> None:
    """Print setup summary."""
    print()
    print("[ok] Demo environment setup complete!")
    print()
    print(f"Directory: {vfkit_base}")
    print("VMs: dev-vm (4 CPU, 4GB), db-vm (2 CPU, 2GB), services-vm (2 CPU, 1GB)")
    print("Total: 8 CPU, 7GB RAM")
    print()
    print("Next steps:")
    print("1. Install Alpine on each VM disk")
    print("2. Configure services (code-server, PostgreSQL, Redis, nginx)")
    print(f"3. Start: {vfkit_base}/start-demo.sh")


def setup_demo_environment(vfkit_base: Optional[Path] = None) -> int:
    """Setup the complete vfkit demo environment.

    Args:
        vfkit_base: Base directory for vfkit (defaults to ~/.vfkit)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if vfkit_base is None:
        vfkit_base = get_vfkit_base()

    print("=== VibeCode Demo Environment Setup ===")
    print("Components: code-server, PostgreSQL, Redis, nginx")
    print("Platform: Alpine ARM64 on M-Series")
    print()

    # Create directory structure
    if not create_directory_structure(vfkit_base):
        print("[x] Failed to create directory structure")
        return 1

    # Create VM launcher scripts
    if not create_vm_launcher_scripts(vfkit_base):
        print("[x] Failed to create VM launcher scripts")
        return 1

    # Create disk images
    create_disk_images(vfkit_base)  # Don't fail if qemu-img not available

    # Create start script
    if not create_start_script(vfkit_base):
        print("[x] Failed to create start script")
        return 1

    print_summary(vfkit_base)
    return 0


def main() -> int:
    """Main entry point."""
    return setup_demo_environment()


if __name__ == "__main__":
    sys.exit(main())