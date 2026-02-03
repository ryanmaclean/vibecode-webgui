#!/usr/bin/env python3
"""Rebuild all VMs with services installed.

Option A: Complete rebuild with proper configuration.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    red: str = "\033[0;31m"
    reset: str = "\033[0m"


COLORS = Colors()

ALPINE_CLOUD_IMAGE_URL = (
    "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/"
    "nocloud_alpine-3.19.0-aarch64-uefi-cloudinit-r0.qcow2"
)


@dataclass
class VMConfig:
    """Configuration for a VM build."""

    name: str
    cloud_init_path: Path
    disk_size: str = "10G"


def get_paths() -> tuple[Path, Path, Path, Path]:
    """Get project paths.

    Returns:
        Tuple of (project_root, dist_dir, tmp_dir, cloud_init_dir).
    """
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    dist_dir = project_root / "dist" / "vm-images"
    tmp_dir = project_root / "tmp"
    cloud_init_dir = tmp_dir / "cloud-init"
    return project_root, dist_dir, tmp_dir, cloud_init_dir


def print_success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}✅ {message}{COLORS.reset}")


def print_error(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}ERROR: {message}{COLORS.reset}")


def get_ssh_pubkey() -> str:
    """Get SSH public key for VMs.

    Returns:
        SSH public key content or placeholder string.
    """
    ssh_key_path = Path.home() / ".ssh" / "vibecode" / "id_ed25519.pub"
    if ssh_key_path.exists():
        return ssh_key_path.read_text().strip()
    return "GENERATE_SSH_KEY_FIRST"


def create_directories(dist_dir: Path, cloud_init_dir: Path) -> None:
    """Create output directories."""
    dist_dir.mkdir(parents=True, exist_ok=True)
    cloud_init_dir.mkdir(parents=True, exist_ok=True)


def download_alpine_image(tmp_dir: Path) -> bool:
    """Download Alpine cloud image if not exists.

    Args:
        tmp_dir: Temporary directory for downloads.

    Returns:
        True if image is available, False on error.
    """
    image_path = tmp_dir / "alpine-virt-cloud.qcow2"

    if image_path.exists():
        print("Using existing Alpine cloud image")
        return True

    print("Downloading Alpine 3.19 cloud image (UEFI)...")
    result = subprocess.run(
        ["curl", "-L", "-o", str(image_path), ALPINE_CLOUD_IMAGE_URL],
    )

    if result.returncode != 0:
        print_error("Failed to download Alpine cloud image")
        return False

    # Verify it's a valid QCOW2 image
    result = subprocess.run(
        ["qemu-img", "info", str(image_path)],
        capture_output=True,
        text=True,
    )

    if "qcow2" not in result.stdout:
        print_error("Downloaded file is not a valid QCOW2 image")
        subprocess.run(["file", str(image_path)])
        image_path.unlink(missing_ok=True)
        return False

    print_success("Alpine cloud image downloaded and verified")
    return True


def prepare_cloud_init(
    vm_config: VMConfig,
    pubkey: str,
    cloud_init_dir: Path,
) -> Path:
    """Prepare cloud-init user-data with SSH key.

    Args:
        vm_config: VM configuration.
        pubkey: SSH public key.
        cloud_init_dir: Cloud-init directory.

    Returns:
        Path to prepared user-data file.
    """
    user_data_path = cloud_init_dir / f"{vm_config.name}-user-data.yaml"

    if vm_config.cloud_init_path.exists():
        content = vm_config.cloud_init_path.read_text()
        content = content.replace("__SSH_PUBKEY__", pubkey)
        user_data_path.write_text(content)
    else:
        print(f"Warning: Cloud-init file not found: {vm_config.cloud_init_path}")
        user_data_path.write_text(f"#cloud-config\nssh_authorized_keys:\n  - {pubkey}\n")

    return user_data_path


def convert_to_raw(tmp_dir: Path, dist_dir: Path, vm_name: str) -> bool:
    """Convert QCOW2 image to RAW format.

    Args:
        tmp_dir: Directory with source QCOW2.
        dist_dir: Directory for output RAW image.
        vm_name: Name of the VM.

    Returns:
        True if successful, False otherwise.
    """
    print("Converting to RAW format...")
    source = tmp_dir / "alpine-virt-cloud.qcow2"
    dest = dist_dir / f"{vm_name}.img"

    result = subprocess.run([
        "qemu-img", "convert",
        "-f", "qcow2",
        "-O", "raw",
        str(source),
        str(dest),
    ])

    return result.returncode == 0


def resize_disk(dist_dir: Path, vm_name: str, disk_size: str) -> bool:
    """Resize disk image.

    Args:
        dist_dir: Directory with disk image.
        vm_name: Name of the VM.
        disk_size: Target disk size (e.g., "10G").

    Returns:
        True if successful, False otherwise.
    """
    print(f"Resizing disk to {disk_size}...")
    disk_path = dist_dir / f"{vm_name}.img"

    result = subprocess.run([
        "qemu-img", "resize",
        str(disk_path),
        disk_size,
    ])

    return result.returncode == 0


def create_cloud_init_iso(
    vm_name: str,
    user_data_path: Path,
    cloud_init_dir: Path,
) -> bool:
    """Create cloud-init ISO image.

    Args:
        vm_name: Name of the VM.
        user_data_path: Path to user-data file.
        cloud_init_dir: Cloud-init directory.

    Returns:
        True if successful, False otherwise.
    """
    print("Creating cloud-init ISO...")

    seed_dir = cloud_init_dir / f"{vm_name}-seed"
    seed_dir.mkdir(parents=True, exist_ok=True)

    # Copy user-data
    shutil.copy(user_data_path, seed_dir / "user-data")

    # Create meta-data
    meta_data = seed_dir / "meta-data"
    meta_data.write_text(f"instance-id: {vm_name}-001\nlocal-hostname: {vm_name}\n")

    iso_path = cloud_init_dir / f"{vm_name}-seed.iso"

    # Try different ISO creation tools
    tools = [
        (["hdiutil", "makehybrid", "-o", str(iso_path), str(seed_dir), "-iso", "-joliet"], True),
        (["mkisofs", "-output", str(iso_path), "-volid", "cidata", "-joliet", "-rock", str(seed_dir)], False),
        (["genisoimage", "-output", str(iso_path), "-volid", "cidata", "-joliet", "-rock", str(seed_dir)], False),
    ]

    for cmd, suppress_output in tools:
        if shutil.which(cmd[0]):
            result = subprocess.run(
                cmd,
                capture_output=suppress_output,
            )
            if result.returncode == 0:
                return True

    print_error("No ISO creation tool available (hdiutil, mkisofs, or genisoimage)")
    return False


def create_efi_nvram(dist_dir: Path, vm_name: str) -> bool:
    """Create EFI variable store.

    Args:
        dist_dir: Directory for NVRAM file.
        vm_name: Name of the VM.

    Returns:
        True if successful, False otherwise.
    """
    print("Creating EFI variable store...")

    nvram_path = dist_dir / f"{vm_name}-efi.nvram"

    # Try macOS Virtualization framework NVRAM
    macos_nvram = Path("/System/Library/Frameworks/Virtualization.framework/Resources/UEFI/OVMF_VARS.fd")
    if macos_nvram.exists():
        shutil.copy(macos_nvram, nvram_path)
        return True

    # Try QEMU EDK2 NVRAM
    qemu_nvram = Path("/usr/share/qemu/edk2-aarch64-vars.fd")
    if qemu_nvram.exists():
        shutil.copy(qemu_nvram, nvram_path)
        return True

    # Create empty NVRAM (64MB)
    with nvram_path.open("wb") as f:
        f.write(b"\x00" * (64 * 1024 * 1024))

    return True


def build_vm(
    vm_config: VMConfig,
    pubkey: str,
    project_root: Path,
    dist_dir: Path,
    tmp_dir: Path,
    cloud_init_dir: Path,
) -> bool:
    """Build a single VM.

    Args:
        vm_config: VM configuration.
        pubkey: SSH public key.
        project_root: Project root directory.
        dist_dir: Directory for VM images.
        tmp_dir: Temporary directory.
        cloud_init_dir: Cloud-init directory.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Building {vm_config.name}...")
    print("====================")

    # Prepare cloud-init
    user_data_path = prepare_cloud_init(vm_config, pubkey, cloud_init_dir)

    # Download Alpine image if needed
    if not download_alpine_image(tmp_dir):
        return False

    # Convert to RAW
    if not convert_to_raw(tmp_dir, dist_dir, vm_config.name):
        print_error(f"Failed to convert image for {vm_config.name}")
        return False

    # Resize disk
    if not resize_disk(dist_dir, vm_config.name, vm_config.disk_size):
        print_error(f"Failed to resize disk for {vm_config.name}")
        return False

    # Create cloud-init ISO
    if not create_cloud_init_iso(vm_config.name, user_data_path, cloud_init_dir):
        print_error(f"Failed to create cloud-init ISO for {vm_config.name}")
        return False

    # Create EFI NVRAM
    if not create_efi_nvram(dist_dir, vm_config.name):
        print_error(f"Failed to create EFI NVRAM for {vm_config.name}")
        return False

    print_success(f"{vm_config.name} built successfully")
    print()
    return True


def get_vm_configs(project_root: Path) -> list[VMConfig]:
    """Get list of VM configurations to build.

    Args:
        project_root: Project root directory.

    Returns:
        List of VMConfig objects.
    """
    config_dir = project_root / "config" / "cloud-init"

    return [
        VMConfig(
            name="vibecode-postgresql",
            cloud_init_path=config_dir / "postgresql-user-data.yaml",
            disk_size="15G",
        ),
        VMConfig(
            name="vibecode-valkey",
            cloud_init_path=config_dir / "valkey-user-data.yaml",
            disk_size="10G",
        ),
        VMConfig(
            name="vibecode-nodejs",
            cloud_init_path=config_dir / "nodejs-user-data.yaml",
            disk_size="15G",
        ),
        VMConfig(
            name="vibecode-nodejs-codeserver",
            cloud_init_path=config_dir / "codeserver-user-data.yaml",
            disk_size="20G",
        ),
    ]


def print_completion_info() -> None:
    """Print completion information and next steps."""
    print("==================================")
    print("VM Build Complete")
    print("==================================")
    print()
    print("Built VMs:")
    print("  - vibecode-postgresql (PostgreSQL 15+ on port 5432)")
    print("  - vibecode-valkey (Redis/Valkey on port 6379)")
    print("  - vibecode-nodejs (Node.js with test server on port 3000)")
    print("  - vibecode-nodejs-codeserver (OpenVSCode on port 8080)")
    print()
    print("Each VM includes:")
    print("  - Services configured and auto-start")
    print("  - SSH access (user: vibecode, key-based)")
    print("  - Network configured (DHCP)")
    print()
    print("Next steps:")
    print("  1. Launch VibeCode app: ./scripts/launch-vibecode.sh")
    print("  2. VMs will auto-discover")
    print("  3. Start VMs from GUI")
    print("  4. Find IPs: ./scripts/find-vm-ips.sh")
    print("  5. Test services: ./scripts/test-service-health.sh <ip>")


def main() -> int:
    """Main entry point."""
    print("==================================")
    print("Rebuild All VMs with Services")
    print("==================================")
    print()

    project_root, dist_dir, tmp_dir, cloud_init_dir = get_paths()

    # Get SSH public key
    pubkey = get_ssh_pubkey()
    if pubkey == "GENERATE_SSH_KEY_FIRST":
        print("Warning: SSH key not found at ~/.ssh/vibecode/id_ed25519.pub")
        print("VMs will be built but SSH access may not work.")
        print()

    # Create directories
    create_directories(dist_dir, cloud_init_dir)

    # Get VM configurations
    vm_configs = get_vm_configs(project_root)

    print("Starting VM builds...")
    print()

    # Build all VMs
    success_count = 0
    for vm_config in vm_configs:
        if build_vm(vm_config, pubkey, project_root, dist_dir, tmp_dir, cloud_init_dir):
            success_count += 1

    if success_count == len(vm_configs):
        print_completion_info()
        return 0
    else:
        print_error(f"Only {success_count}/{len(vm_configs)} VMs built successfully")
        return 1


if __name__ == "__main__":
    sys.exit(main())
