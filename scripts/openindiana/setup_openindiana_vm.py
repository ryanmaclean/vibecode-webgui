#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "setup-openindiana-vm"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""OpenIndiana VM Setup Script for VibeCode.

Creates optimized VM for running VibeCode with ZFS and DTrace.
Platforms: UTM (macOS), VirtualBox (cross-platform), QEMU (Linux)
"""


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


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import platform
import shutil
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Configuration
VM_NAME = "vibecode-openindiana"
VM_CPUS = 4
VM_MEMORY = 8192  # MB
VM_DISK_SIZE = "60G"
VM_NETWORK_MODE = "bridged"  # or "nat"
ISO_URL = "https://dlc.openindiana.org/isos/hipster/OI-hipster-gui-20231027.iso"
ISO_FILE = "OI-hipster-gui-20231027.iso"


def log_info(msg: str) -> None:
    """Log info message."""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {msg}")


def log_warn(msg: str) -> None:
    """Log warning message."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")


def log_error(msg: str) -> None:
    """Log error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(cmd, check=check, capture_output=capture, text=True)


def detect_platform() -> tuple[str, str]:
    """Detect host platform and hypervisor."""
    system = platform.system()

    if system == "Darwin":
        plat = "macos"
        hypervisor = "utm"
    elif system == "Linux":
        plat = "linux"
        if shutil.which("virt-install"):
            hypervisor = "kvm"
        elif shutil.which("VBoxManage"):
            hypervisor = "virtualbox"
        else:
            log_error("No supported hypervisor found (KVM or VirtualBox)")
            sys.exit(1)
    elif system == "Windows" or system.startswith("MINGW") or system.startswith("CYGWIN"):
        plat = "windows"
        hypervisor = "virtualbox"
    else:
        log_error(f"Unsupported platform: {system}")
        sys.exit(1)

    log_info(f"Detected platform: {plat}")
    log_info(f"Using hypervisor: {hypervisor}")

    return plat, hypervisor


def download_iso() -> None:
    """Download OpenIndiana ISO."""
    if Path(ISO_FILE).exists():
        log_info(f"ISO already downloaded: {ISO_FILE}")
        return

    log_info("Downloading OpenIndiana ISO...")
    log_info(f"URL: {ISO_URL}")

    if shutil.which("curl"):
        run_command(["curl", "-L", "-o", ISO_FILE, ISO_URL])
    elif shutil.which("wget"):
        run_command(["wget", "-O", ISO_FILE, ISO_URL])
    else:
        log_error("Neither curl nor wget found. Please install one.")
        sys.exit(1)

    log_info(f"ISO downloaded: {ISO_FILE}")


def verify_iso() -> None:
    """Verify ISO checksum."""
    log_info("Verifying ISO checksum...")

    if shutil.which("sha256sum"):
        result = run_command(["sha256sum", ISO_FILE], capture=True)
        actual_sha256 = result.stdout.split()[0]
    elif shutil.which("shasum"):
        result = run_command(["shasum", "-a", "256", ISO_FILE], capture=True)
        actual_sha256 = result.stdout.split()[0]
    else:
        log_warn("No SHA256 tool found, skipping verification")
        return

    log_info(f"SHA256: {actual_sha256}")
    log_warn("Please verify checksum manually from https://www.openindiana.org/downloads/")


def create_utm_vm() -> None:
    """Create VM with UTM (macOS)."""
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
   - Name: {VM_NAME}
   - CPU Cores: {VM_CPUS}
   - Memory: {VM_MEMORY}MB
   - Storage: {VM_DISK_SIZE}
6. Add CD/DVD drive with: {ISO_FILE}
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


def create_virtualbox_vm() -> None:
    """Create VM with VirtualBox."""
    log_info("Creating VM with VirtualBox...")

    if not shutil.which("VBoxManage"):
        log_error("VBoxManage not found. Please install VirtualBox.")
        sys.exit(1)

    # Create VM
    run_command(["VBoxManage", "createvm", "--name", VM_NAME, "--ostype", "Solaris11_64", "--register"])

    # Set VM parameters
    run_command([
        "VBoxManage", "modifyvm", VM_NAME,
        "--memory", str(VM_MEMORY),
        "--cpus", str(VM_CPUS),
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
    ])

    # Get VM directory
    result = run_command(["VBoxManage", "showvminfo", VM_NAME], capture=True)
    for line in result.stdout.splitlines():
        if "Config file:" in line:
            config_path = line.split(":")[1].strip()
            vm_dir = Path(config_path).parent
            break

    # Create disk
    disk_size_mb = int(VM_DISK_SIZE.replace("G", "")) * 1000
    run_command([
        "VBoxManage", "createhd",
        "--filename", str(vm_dir / f"{VM_NAME}.vdi"),
        "--size", str(disk_size_mb),
        "--format", "VDI",
    ])

    # Add storage controllers
    run_command([
        "VBoxManage", "storagectl", VM_NAME,
        "--name", "SATA Controller",
        "--add", "sata",
        "--controller", "IntelAhci",
        "--portcount", "2",
        "--bootable", "on",
    ])

    # Attach disk
    run_command([
        "VBoxManage", "storageattach", VM_NAME,
        "--storagectl", "SATA Controller",
        "--port", "0",
        "--device", "0",
        "--type", "hdd",
        "--medium", str(vm_dir / f"{VM_NAME}.vdi"),
    ])

    # Attach ISO
    run_command([
        "VBoxManage", "storageattach", VM_NAME,
        "--storagectl", "SATA Controller",
        "--port", "1",
        "--device", "0",
        "--type", "dvddrive",
        "--medium", str(Path.cwd() / ISO_FILE),
    ])

    # Configure network
    if VM_NETWORK_MODE == "bridged":
        # Get first bridged interface
        result = run_command(["VBoxManage", "list", "bridgedifs"], capture=True)
        for line in result.stdout.splitlines():
            if line.startswith("Name:"):
                adapter = line.split(":")[1].strip()
                break
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--nic1", "bridged", "--bridgeadapter1", adapter])
    else:
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--nic1", "nat"])
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--natpf1", "ssh,tcp,,2222,,22"])
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--natpf1", "http,tcp,,3000,,3000"])

    log_info(f"VM created successfully: {VM_NAME}")

    network_info = ""
    if VM_NETWORK_MODE == "nat":
        network_info = "  SSH: ssh -p 2222 root@localhost\n  Web: http://localhost:3000"
    else:
        network_info = "  Use VM's IP address (check with: ipadm show-addr)"

    print(f"""
=====================================================
VirtualBox VM Created: {VM_NAME}
=====================================================

Start VM:
  VBoxManage startvm "{VM_NAME}" --type gui

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


def create_kvm_vm() -> None:
    """Create VM with QEMU/KVM."""
    log_info("Creating VM with QEMU/KVM...")

    if not shutil.which("virt-install"):
        log_error("virt-install not found. Install: apt install virtinst")
        sys.exit(1)

    # Create disk image
    disk_path = f"/var/lib/libvirt/images/{VM_NAME}.qcow2"
    run_command(["qemu-img", "create", "-f", "qcow2", disk_path, VM_DISK_SIZE])

    # Create VM
    run_command([
        "virt-install",
        "--name", VM_NAME,
        "--ram", str(VM_MEMORY),
        "--vcpus", str(VM_CPUS),
        "--disk", f"path={disk_path},format=qcow2,bus=virtio",
        "--cdrom", str(Path.cwd() / ISO_FILE),
        "--os-variant", "solaris11",
        "--network", "network=default,model=virtio",
        "--graphics", "vnc,listen=0.0.0.0",
        "--console", "pty,target_type=serial",
        "--noautoconsole",
    ])

    log_info(f"VM created successfully: {VM_NAME}")

    print(f"""
=====================================================
KVM VM Created: {VM_NAME}
=====================================================

Connect to console:
  virt-viewer "{VM_NAME}"

Or via VNC:
  virsh vncdisplay "{VM_NAME}"

Installation:
1. Follow OpenIndiana installer
2. Use entire disk for ZFS
3. Set root password and enable SSH
4. After installation, start VM:
   virsh start "{VM_NAME}"
5. Login and install packages:
   pkg install brand/lx git curl wget
6. Continue with 02-configure-lx-zone.sh

Manage VM:
  virsh list --all
  virsh start "{VM_NAME}"
  virsh shutdown "{VM_NAME}"

=====================================================
""")


def main() -> int:
    """Main entry point."""
    log_info("VibeCode OpenIndiana VM Setup")
    log_info("==============================")

    plat, hypervisor = detect_platform()
    download_iso()
    verify_iso()

    if hypervisor == "utm":
        create_utm_vm()
    elif hypervisor == "virtualbox":
        create_virtualbox_vm()
    elif hypervisor == "kvm":
        create_kvm_vm()
    else:
        log_error(f"Unsupported hypervisor: {hypervisor}")
        return 1

    log_info("VM setup complete!")
    log_info("Next steps:")
    log_info("  1. Install OpenIndiana from ISO")
    log_info("  2. Boot into installed system")
    log_info("  3. Run: ./02-configure-lx-zone.sh")

    return 0


if __name__ == "__main__":
    sys.exit(main())