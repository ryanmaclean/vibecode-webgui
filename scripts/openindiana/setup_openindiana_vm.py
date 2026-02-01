#!/usr/bin/env python3
"""
OpenIndiana VM Setup Script for VibeCode.

Creates optimized VM for running VibeCode with ZFS and DTrace.
Supports: UTM (macOS), VirtualBox (cross-platform), QEMU/KVM (Linux)
"""

import argparse
import hashlib
import os
import platform
import shutil
import subprocess
import sys
from enum import Enum
from pathlib import Path
from typing import Optional, Tuple


# Configuration defaults
DEFAULT_VM_NAME = "vibecode-openindiana"
DEFAULT_VM_CPUS = 4
DEFAULT_VM_MEMORY = 8192  # MB
DEFAULT_VM_DISK_SIZE = "60G"
DEFAULT_NETWORK_MODE = "bridged"  # or "nat"
ISO_URL = "https://dlc.openindiana.org/isos/hipster/OI-hipster-gui-20231027.iso"
ISO_FILE = "OI-hipster-gui-20231027.iso"


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'  # No Color


class Platform(Enum):
    MACOS = "macos"
    LINUX = "linux"
    WINDOWS = "windows"


class Hypervisor(Enum):
    UTM = "utm"
    VIRTUALBOX = "virtualbox"
    KVM = "kvm"


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {message}")


def log_warn(message: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def detect_platform() -> Tuple[Platform, Hypervisor]:
    """Detect host platform and appropriate hypervisor."""
    system = platform.system()

    if system == "Darwin":
        plat = Platform.MACOS
        hypervisor = Hypervisor.UTM
    elif system == "Linux":
        plat = Platform.LINUX
        if shutil.which("virt-install"):
            hypervisor = Hypervisor.KVM
        elif shutil.which("VBoxManage"):
            hypervisor = Hypervisor.VIRTUALBOX
        else:
            log_error("No supported hypervisor found (KVM or VirtualBox)")
            sys.exit(1)
    elif system in ("Windows", "MINGW", "CYGWIN") or system.startswith("MINGW") or system.startswith("CYGWIN"):
        plat = Platform.WINDOWS
        hypervisor = Hypervisor.VIRTUALBOX
    else:
        log_error(f"Unsupported platform: {system}")
        sys.exit(1)

    log_info(f"Detected platform: {plat.value}")
    log_info(f"Using hypervisor: {hypervisor.value}")

    return plat, hypervisor


def download_iso(iso_file: str = ISO_FILE, iso_url: str = ISO_URL) -> None:
    """Download OpenIndiana ISO if not already present."""
    if Path(iso_file).exists():
        log_info(f"ISO already downloaded: {iso_file}")
        return

    log_info("Downloading OpenIndiana ISO...")
    log_info(f"URL: {iso_url}")

    if shutil.which("curl"):
        subprocess.run(["curl", "-L", "-o", iso_file, iso_url], check=True)
    elif shutil.which("wget"):
        subprocess.run(["wget", "-O", iso_file, iso_url], check=True)
    else:
        log_error("Neither curl nor wget found. Please install one.")
        sys.exit(1)

    log_info(f"ISO downloaded: {iso_file}")


def verify_iso(iso_file: str = ISO_FILE) -> None:
    """Verify ISO checksum."""
    log_info("Verifying ISO checksum...")

    if not Path(iso_file).exists():
        log_warn(f"ISO file not found: {iso_file}")
        return

    # Calculate SHA256
    sha256_hash = hashlib.sha256()
    with open(iso_file, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)

    actual_sha256 = sha256_hash.hexdigest()
    log_info(f"SHA256: {actual_sha256}")
    log_warn("Please verify checksum manually from https://www.openindiana.org/downloads/")


def create_utm_vm(
    vm_name: str,
    vm_cpus: int,
    vm_memory: int,
    vm_disk_size: str,
    iso_file: str,
) -> None:
    """Create VM with UTM (macOS) - provides manual instructions."""
    log_info("Creating VM with UTM...")
    log_warn("UTM requires manual VM creation through GUI")

    print(f"""
=====================================================
UTM VM Creation Instructions
=====================================================

1. Open UTM application
2. Click "Create a New Virtual Machine"
3. Select "Virtualize" (for x86_64)
4. Select "Other" as operating system
5. Configure:
   - Name: {vm_name}
   - CPU Cores: {vm_cpus}
   - Memory: {vm_memory}MB
   - Storage: {vm_disk_size}
6. Add CD/DVD drive with: {iso_file}
7. Network: Shared Network (or Bridged)
8. Click "Save" and start VM
9. Follow OpenIndiana installation wizard

Installation Tips:
- Use entire disk for ZFS
- Create root password
- Enable SSH server
- Set timezone appropriately

After installation:
- Boot into OpenIndiana
- Login as root
- Run: pkg install brand/lx git curl wget
- Continue with 02-configure-lx-zone.sh

=====================================================
""")


def create_virtualbox_vm(
    vm_name: str,
    vm_cpus: int,
    vm_memory: int,
    vm_disk_size: str,
    iso_file: str,
    network_mode: str,
) -> None:
    """Create VM with VirtualBox."""
    log_info("Creating VM with VirtualBox...")

    if not shutil.which("VBoxManage"):
        log_error("VBoxManage not found. Please install VirtualBox.")
        sys.exit(1)

    # Create VM
    subprocess.run([
        "VBoxManage", "createvm",
        "--name", vm_name,
        "--ostype", "Solaris11_64",
        "--register",
    ], check=True)

    # Set VM parameters
    subprocess.run([
        "VBoxManage", "modifyvm", vm_name,
        "--memory", str(vm_memory),
        "--cpus", str(vm_cpus),
        "--vram", "128",
        "--graphicscontroller", "vmsvga",
        "--boot1", "dvd",
        "--boot2", "disk",
        "--acpi", "on",
        "--ioapic", "on",
        "--rtcuseutc", "on",
        "--hwvirtex", "on",
        "--nestedpaging", "on",
        "--largepages", "on",
        "--pae", "on",
    ], check=True)

    # Get VM directory
    result = subprocess.run(
        ["VBoxManage", "showvminfo", vm_name],
        capture_output=True,
        text=True,
        check=True,
    )
    vm_dir = None
    for line in result.stdout.split('\n'):
        if "Config file:" in line:
            config_path = line.split(":", 1)[1].strip()
            vm_dir = str(Path(config_path).parent)
            break

    if not vm_dir:
        log_error("Could not determine VM directory")
        sys.exit(1)

    # Convert disk size to MB
    disk_size_mb = int(vm_disk_size.replace("G", "")) * 1000

    # Create disk
    subprocess.run([
        "VBoxManage", "createhd",
        "--filename", f"{vm_dir}/{vm_name}.vdi",
        "--size", str(disk_size_mb),
        "--format", "VDI",
    ], check=True)

    # Add storage controller
    subprocess.run([
        "VBoxManage", "storagectl", vm_name,
        "--name", "SATA Controller",
        "--add", "sata",
        "--controller", "IntelAhci",
        "--portcount", "2",
        "--bootable", "on",
    ], check=True)

    # Attach disk
    subprocess.run([
        "VBoxManage", "storageattach", vm_name,
        "--storagectl", "SATA Controller",
        "--port", "0",
        "--device", "0",
        "--type", "hdd",
        "--medium", f"{vm_dir}/{vm_name}.vdi",
    ], check=True)

    # Attach ISO
    iso_path = str(Path(iso_file).resolve())
    subprocess.run([
        "VBoxManage", "storageattach", vm_name,
        "--storagectl", "SATA Controller",
        "--port", "1",
        "--device", "0",
        "--type", "dvddrive",
        "--medium", iso_path,
    ], check=True)

    # Configure network
    if network_mode == "bridged":
        # Get first bridged interface
        result = subprocess.run(
            ["VBoxManage", "list", "bridgedifs"],
            capture_output=True,
            text=True,
            check=True,
        )
        bridge_adapter = None
        for line in result.stdout.split('\n'):
            if line.startswith("Name:"):
                bridge_adapter = line.split(":", 1)[1].strip()
                break

        if bridge_adapter:
            subprocess.run([
                "VBoxManage", "modifyvm", vm_name,
                "--nic1", "bridged",
                "--bridgeadapter1", bridge_adapter,
            ], check=True)
    else:
        subprocess.run([
            "VBoxManage", "modifyvm", vm_name,
            "--nic1", "nat",
        ], check=True)
        subprocess.run([
            "VBoxManage", "modifyvm", vm_name,
            "--natpf1", "ssh,tcp,,2222,,22",
        ], check=True)
        subprocess.run([
            "VBoxManage", "modifyvm", vm_name,
            "--natpf1", "http,tcp,,3000,,3000",
        ], check=True)

    log_info(f"VM created successfully: {vm_name}")

    network_info = ""
    if network_mode == "nat":
        network_info = "  SSH: ssh -p 2222 root@localhost\n  Web: http://localhost:3000"
    else:
        network_info = "  Use VM's IP address (check with: ipadm show-addr)"

    print(f"""
=====================================================
VirtualBox VM Created: {vm_name}
=====================================================

Start VM:
  VBoxManage startvm "{vm_name}" --type gui

Installation:
1. Boot from ISO
2. Follow OpenIndiana installer
   - Use entire disk for ZFS
   - Set root password
   - Enable SSH
3. After installation:
   - Eject ISO from storage menu
   - Reboot
4. Login and run: pkg install brand/lx git curl wget
5. Continue with 02-configure-lx-zone.sh

Network Access:
{network_info}

=====================================================
""")


def create_kvm_vm(
    vm_name: str,
    vm_cpus: int,
    vm_memory: int,
    vm_disk_size: str,
    iso_file: str,
) -> None:
    """Create VM with QEMU/KVM."""
    log_info("Creating VM with QEMU/KVM...")

    if not shutil.which("virt-install"):
        log_error("virt-install not found. Install: apt install virtinst")
        sys.exit(1)

    disk_path = f"/var/lib/libvirt/images/{vm_name}.qcow2"

    # Create disk image
    subprocess.run([
        "qemu-img", "create", "-f", "qcow2", disk_path, vm_disk_size,
    ], check=True)

    # Create VM
    iso_path = str(Path(iso_file).resolve())
    subprocess.run([
        "virt-install",
        "--name", vm_name,
        "--ram", str(vm_memory),
        "--vcpus", str(vm_cpus),
        "--disk", f"path={disk_path},format=qcow2,bus=virtio",
        "--cdrom", iso_path,
        "--os-variant", "solaris11",
        "--network", "network=default,model=virtio",
        "--graphics", "vnc,listen=0.0.0.0",
        "--console", "pty,target_type=serial",
        "--noautoconsole",
    ], check=True)

    log_info(f"VM created successfully: {vm_name}")

    print(f"""
=====================================================
KVM VM Created: {vm_name}
=====================================================

Connect to console:
  virt-viewer "{vm_name}"

Or via VNC:
  virsh vncdisplay "{vm_name}"

Installation:
1. Follow OpenIndiana installer
2. Use entire disk for ZFS
3. Set root password and enable SSH
4. After installation, start VM:
   virsh start "{vm_name}"
5. Login and install packages:
   pkg install brand/lx git curl wget
6. Continue with 02-configure-lx-zone.sh

Manage VM:
  virsh list --all
  virsh start "{vm_name}"
  virsh shutdown "{vm_name}"

=====================================================
""")


def setup_vm(
    vm_name: str = DEFAULT_VM_NAME,
    vm_cpus: int = DEFAULT_VM_CPUS,
    vm_memory: int = DEFAULT_VM_MEMORY,
    vm_disk_size: str = DEFAULT_VM_DISK_SIZE,
    network_mode: str = DEFAULT_NETWORK_MODE,
    iso_file: str = ISO_FILE,
    iso_url: str = ISO_URL,
    skip_download: bool = False,
    skip_verify: bool = False,
) -> int:
    """
    Set up OpenIndiana VM for VibeCode.

    Args:
        vm_name: Name of the VM
        vm_cpus: Number of CPUs
        vm_memory: Memory in MB
        vm_disk_size: Disk size (e.g., "60G")
        network_mode: Network mode ("bridged" or "nat")
        iso_file: ISO filename
        iso_url: ISO download URL
        skip_download: Skip ISO download
        skip_verify: Skip ISO verification

    Returns:
        0 on success, 1 on failure
    """
    log_info("VibeCode OpenIndiana VM Setup")
    log_info("==============================")

    plat, hypervisor = detect_platform()

    if not skip_download:
        download_iso(iso_file, iso_url)

    if not skip_verify:
        verify_iso(iso_file)

    if hypervisor == Hypervisor.UTM:
        create_utm_vm(vm_name, vm_cpus, vm_memory, vm_disk_size, iso_file)
    elif hypervisor == Hypervisor.VIRTUALBOX:
        create_virtualbox_vm(vm_name, vm_cpus, vm_memory, vm_disk_size, iso_file, network_mode)
    elif hypervisor == Hypervisor.KVM:
        create_kvm_vm(vm_name, vm_cpus, vm_memory, vm_disk_size, iso_file)
    else:
        log_error(f"Unsupported hypervisor: {hypervisor}")
        return 1

    log_info("VM setup complete!")
    log_info("Next steps:")
    log_info("  1. Install OpenIndiana from ISO")
    log_info("  2. Boot into installed system")
    log_info("  3. Run: ./02-configure-lx-zone.sh")

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="OpenIndiana VM Setup Script for VibeCode"
    )
    parser.add_argument(
        "--vm-name",
        type=str,
        default=DEFAULT_VM_NAME,
        help=f"VM name (default: {DEFAULT_VM_NAME})",
    )
    parser.add_argument(
        "--cpus",
        type=int,
        default=DEFAULT_VM_CPUS,
        help=f"Number of CPUs (default: {DEFAULT_VM_CPUS})",
    )
    parser.add_argument(
        "--memory",
        type=int,
        default=DEFAULT_VM_MEMORY,
        help=f"Memory in MB (default: {DEFAULT_VM_MEMORY})",
    )
    parser.add_argument(
        "--disk-size",
        type=str,
        default=DEFAULT_VM_DISK_SIZE,
        help=f"Disk size (default: {DEFAULT_VM_DISK_SIZE})",
    )
    parser.add_argument(
        "--network-mode",
        type=str,
        choices=["bridged", "nat"],
        default=DEFAULT_NETWORK_MODE,
        help=f"Network mode (default: {DEFAULT_NETWORK_MODE})",
    )
    parser.add_argument(
        "--iso-file",
        type=str,
        default=ISO_FILE,
        help=f"ISO filename (default: {ISO_FILE})",
    )
    parser.add_argument(
        "--iso-url",
        type=str,
        default=ISO_URL,
        help="ISO download URL",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip ISO download",
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip ISO verification",
    )
    args = parser.parse_args()

    return setup_vm(
        vm_name=args.vm_name,
        vm_cpus=args.cpus,
        vm_memory=args.memory,
        vm_disk_size=args.disk_size,
        network_mode=args.network_mode,
        iso_file=args.iso_file,
        iso_url=args.iso_url,
        skip_download=args.skip_download,
        skip_verify=args.skip_verify,
    )


if __name__ == "__main__":
    sys.exit(main())
