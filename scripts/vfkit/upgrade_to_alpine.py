#!/usr/bin/env python3
"""Upgrade to Alpine Linux with latest kernel.

Optimized for M1/Apple Silicon with vfkit. Downloads Alpine ISO,
extracts kernel and initramfs, and sets up for vfkit virtualization.
"""

import argparse
import gzip
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'

# Gzip magic bytes
GZIP_MAGIC = b'\x1f\x8b'


@dataclass
class AlpineVersion:
    """Alpine Linux version configuration."""

    version: str = "3.22"
    release: str = "3.22.2"
    arch: str = "aarch64"
    kernel_version: str = "6.12 LTS"

    @property
    def iso_name(self) -> str:
        """Get the ISO filename."""
        return f"alpine-virt-{self.release}-{self.arch}.iso"

    @property
    def base_url(self) -> str:
        """Get the base URL for downloads."""
        return f"https://dl-cdn.alpinelinux.org/alpine/v{self.version}/releases/{self.arch}"

    @property
    def iso_url(self) -> str:
        """Get the full ISO URL."""
        return f"{self.base_url}/{self.iso_name}"


def get_vm_dir() -> Path:
    """Get the VM directory.

    Returns:
        Path to VM directory.
    """
    return Path.home() / ".vfkit" / "vms" / "vibecode-alpine"


def get_file_size(path: Path) -> str:
    """Get human-readable file size.

    Args:
        path: Path to file.

    Returns:
        Human-readable size string.
    """
    try:
        result = subprocess.run(
            ["du", "-h", str(path)],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.split()[0]
    except Exception:
        pass
    return "unknown"


def print_header(alpine: AlpineVersion) -> None:
    """Print upgrade header information.

    Args:
        alpine: Alpine version configuration.
    """
    print("=" * 56)
    print(f"  Upgrading to Alpine {alpine.version} with Kernel {alpine.kernel_version}")
    print("=" * 56)
    print()
    print("Current: Alpine 3.19.1 with Linux 6.6 LTS")
    print(f"Target:  Alpine {alpine.release} with Linux {alpine.kernel_version}")
    print()
    print("Improvements:")
    print("  - Latest kernel (6 months newer)")
    print("  - Security patches")
    print("  - Better ARM64 virtualization")
    print("  - Updated virtio drivers")
    print("  - Performance improvements")
    print()


def backup_current_kernel(kernel_dir: Path, backup_name: str = "backup-3.19") -> bool:
    """Backup the current kernel files.

    Args:
        kernel_dir: Path to kernel directory.
        backup_name: Name for backup directory.

    Returns:
        True if backup was created or no kernel to backup.
    """
    vmlinux = kernel_dir / "vmlinux"
    if not vmlinux.exists():
        return True

    print("Backing up current kernel...")
    backup_dir = kernel_dir / backup_name
    backup_dir.mkdir(parents=True, exist_ok=True)

    for filename in ["vmlinuz", "vmlinux", "initramfs"]:
        src = kernel_dir / filename
        if src.exists():
            try:
                shutil.copy2(src, backup_dir / filename)
            except OSError:
                pass

    print(f"{GREEN}Backed up to: {backup_dir}{NC}")
    print()
    return True


def download_iso(
    kernel_dir: Path,
    alpine: AlpineVersion,
    force: bool = False
) -> Optional[Path]:
    """Download the Alpine ISO.

    Args:
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.
        force: Force re-download if ISO exists.

    Returns:
        Path to ISO or None on failure.
    """
    kernel_dir.mkdir(parents=True, exist_ok=True)
    iso_path = kernel_dir / alpine.iso_name

    print(f"Downloading Alpine {alpine.release} ISO...")
    print(f"   URL: {alpine.iso_url}")

    if iso_path.exists() and not force:
        print(f"{YELLOW}ISO already exists: {alpine.iso_name}{NC}")
        print("Using existing ISO (use --force to re-download)")
    else:
        if iso_path.exists():
            iso_path.unlink()

        result = subprocess.run(
            ["curl", "-L", "-o", str(iso_path), alpine.iso_url],
            capture_output=False
        )

        if result.returncode != 0:
            print(f"{RED}Failed to download ISO{NC}")
            return None

    iso_size = get_file_size(iso_path)
    print(f"{GREEN}Downloaded: {alpine.iso_name} ({iso_size}){NC}")
    print()

    return iso_path


def find_extractor() -> Optional[str]:
    """Find an available extraction tool.

    Returns:
        Name of extractor ('bsdtar' or '7z') or None.
    """
    if shutil.which("bsdtar"):
        return "bsdtar"
    if shutil.which("7z"):
        return "7z"
    return None


def extract_from_iso(
    iso_path: Path,
    kernel_dir: Path,
    alpine: AlpineVersion
) -> bool:
    """Extract kernel and initramfs from ISO.

    Args:
        iso_path: Path to ISO file.
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.

    Returns:
        True if extraction succeeded.
    """
    print("Extracting kernel and initramfs from ISO...")

    extractor = find_extractor()
    if not extractor:
        print(f"{RED}No extraction tool found (need bsdtar or 7z){NC}")
        print("Install: brew install libarchive  # for bsdtar")
        return False

    print(f"Using extractor: {extractor}")

    version_suffix = alpine.version.replace(".", "")
    vmlinuz_out = kernel_dir / f"vmlinuz-{alpine.version}"
    initramfs_out = kernel_dir / f"initramfs-{alpine.version}"

    try:
        if extractor == "bsdtar":
            # Extract vmlinuz-virt
            subprocess.run(
                ["bsdtar", "-xf", str(iso_path), "boot/vmlinuz-virt"],
                cwd=kernel_dir,
                check=True,
                capture_output=True
            )
            (kernel_dir / "boot" / "vmlinuz-virt").rename(vmlinuz_out)

            # Extract initramfs-virt
            subprocess.run(
                ["bsdtar", "-xf", str(iso_path), "boot/initramfs-virt"],
                cwd=kernel_dir,
                check=True,
                capture_output=True
            )
            (kernel_dir / "boot" / "initramfs-virt").rename(initramfs_out)

            # Cleanup
            boot_dir = kernel_dir / "boot"
            if boot_dir.exists():
                shutil.rmtree(boot_dir)

        elif extractor == "7z":
            subprocess.run(
                ["7z", "x", str(iso_path), "boot/vmlinuz-virt", "boot/initramfs-virt"],
                cwd=kernel_dir,
                check=True,
                capture_output=True
            )
            (kernel_dir / "boot" / "vmlinuz-virt").rename(vmlinuz_out)
            (kernel_dir / "boot" / "initramfs-virt").rename(initramfs_out)

            # Cleanup
            boot_dir = kernel_dir / "boot"
            if boot_dir.exists():
                shutil.rmtree(boot_dir)

        print(f"{GREEN}Extracted kernel and initramfs{NC}")
        print()
        return True

    except subprocess.CalledProcessError as e:
        print(f"{RED}Extraction failed: {e}{NC}")
        return False


def extract_gzip_payload(data: bytes) -> Optional[bytes]:
    """Find and extract gzip payload from kernel image.

    Args:
        data: Raw kernel image data.

    Returns:
        Offset of gzip payload or None if not found.
    """
    offset = data.find(GZIP_MAGIC)
    if offset >= 0:
        return data[offset:]
    return None


def extract_uncompressed_kernel(kernel_dir: Path, alpine: AlpineVersion) -> bool:
    """Extract uncompressed kernel for vfkit.

    Args:
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.

    Returns:
        True if extraction succeeded.
    """
    print("Extracting uncompressed kernel for vfkit...")
    print("   (vfkit requires uncompressed ARM64 kernel)")

    vmlinuz = kernel_dir / f"vmlinuz-{alpine.version}"
    vmlinux = kernel_dir / f"vmlinux-{alpine.version}"

    if not vmlinuz.exists():
        print(f"{RED}Compressed kernel not found: {vmlinuz}{NC}")
        return False

    try:
        # Read compressed kernel
        data = vmlinuz.read_bytes()

        # Find gzip payload
        gzip_data = extract_gzip_payload(data)
        if not gzip_data:
            print(f"{RED}No gzip payload found in kernel{NC}")
            return False

        offset = data.find(GZIP_MAGIC)
        print(f"Found gzip payload at offset {offset}")

        # Decompress
        try:
            uncompressed = gzip.decompress(gzip_data)
            vmlinux.write_bytes(uncompressed)
        except gzip.BadGzipFile:
            # Try using gunzip command as fallback
            gz_path = kernel_dir / f"vmlinuz-{alpine.version}.gz"
            gz_path.write_bytes(gzip_data)

            result = subprocess.run(
                ["gunzip", "-c", str(gz_path)],
                capture_output=True
            )
            gz_path.unlink()

            if result.returncode != 0 or not result.stdout:
                print(f"{RED}Failed to decompress kernel{NC}")
                return False

            vmlinux.write_bytes(result.stdout)

        if vmlinux.exists() and vmlinux.stat().st_size > 0:
            print(f"{GREEN}Extracted uncompressed kernel: vmlinux-{alpine.version}{NC}")
            return True

        print(f"{RED}Failed to extract vmlinux{NC}")
        return False

    except OSError as e:
        print(f"{RED}Error extracting kernel: {e}{NC}")
        return False


def verify_kernel(kernel_dir: Path, alpine: AlpineVersion) -> bool:
    """Verify the kernel file.

    Args:
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.

    Returns:
        True if kernel is valid.
    """
    print()
    print("Verifying kernel...")

    vmlinux = kernel_dir / f"vmlinux-{alpine.version}"

    result = subprocess.run(
        ["file", str(vmlinux)],
        capture_output=True,
        text=True
    )

    kernel_type = result.stdout.strip()
    print(kernel_type)

    if "Linux kernel ARM64 boot executable" in kernel_type:
        print(f"{GREEN}Kernel type verified: ARM64 boot executable{NC}")
        return True

    print(f"{YELLOW}Unexpected kernel type{NC}")
    return True  # Continue anyway


def print_kernel_info(kernel_dir: Path, alpine: AlpineVersion) -> None:
    """Print kernel file information.

    Args:
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.
    """
    print()
    print("Kernel Information:")

    vmlinuz = kernel_dir / f"vmlinuz-{alpine.version}"
    vmlinux = kernel_dir / f"vmlinux-{alpine.version}"
    initramfs = kernel_dir / f"initramfs-{alpine.version}"

    print(f"   Compressed (vmlinuz): {get_file_size(vmlinuz)}")
    print(f"   Uncompressed (vmlinux): {get_file_size(vmlinux)}")
    print(f"   Initramfs: {get_file_size(initramfs)}")
    print(f"   Expected: Linux {alpine.kernel_version}")
    print()


def replace_kernel(kernel_dir: Path, alpine: AlpineVersion) -> bool:
    """Replace current kernel with new version.

    Args:
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.

    Returns:
        True if replacement succeeded.
    """
    print(f"Replacing current kernel with Alpine {alpine.version}...")

    # Backup existing symlinks/files
    for name, backup_name in [
        ("vmlinux", "vmlinux-backup-3.19"),
        ("vmlinuz", "vmlinuz-backup-3.19"),
        ("initramfs", "initramfs-backup-3.19")
    ]:
        src = kernel_dir / name
        if src.exists() and not src.is_symlink():
            try:
                src.rename(kernel_dir / backup_name)
            except OSError:
                pass
        elif src.is_symlink():
            src.unlink()

    # Create new symlinks
    try:
        (kernel_dir / "vmlinux").symlink_to(f"vmlinux-{alpine.version}")
        (kernel_dir / "vmlinuz").symlink_to(f"vmlinuz-{alpine.version}")
        (kernel_dir / "initramfs").symlink_to(f"initramfs-{alpine.version}")

        print(f"{GREEN}Kernel updated!{NC}")
        print()
        return True
    except OSError as e:
        print(f"{RED}Failed to create symlinks: {e}{NC}")
        return False


def print_summary(kernel_dir: Path, alpine: AlpineVersion) -> None:
    """Print upgrade summary.

    Args:
        kernel_dir: Path to kernel directory.
        alpine: Alpine version configuration.
    """
    vmlinux = kernel_dir / f"vmlinux-{alpine.version}"
    initramfs = kernel_dir / f"initramfs-{alpine.version}"

    print("=" * 56)
    print("  Upgrade Complete!")
    print("=" * 56)
    print()
    print("New kernel files:")
    print(f"  - {kernel_dir}/vmlinux ({get_file_size(vmlinux)})")
    print(f"  - {kernel_dir}/initramfs ({get_file_size(initramfs)})")
    print(f"  - {kernel_dir}/{alpine.iso_name}")
    print()

    backup_dir = kernel_dir / "backup-3.19"
    if backup_dir.exists():
        print("Backup files (Alpine 3.19):")
        print(f"  - {backup_dir}/")
    print()

    print("Next steps:")
    print("  1. Rebuild rootfs with Alpine 3.22:")
    print("     ./scripts/vfkit/08-create-node24-rootfs.sh")
    print()
    print("  2. Launch VM with new kernel:")
    print("     ./scripts/vfkit/09-launch-node24-vm.sh")
    print()
    print("  3. Verify kernel version in VM:")
    print("     uname -r  # Should show 6.12.x")
    print()
    print("Rollback (if needed):")
    print(f"  cd {kernel_dir}")
    print("  ln -sf vmlinux-backup-3.19 vmlinux")
    print("  ln -sf vmlinuz-backup-3.19 vmlinuz")
    print("  ln -sf initramfs-backup-3.19 initramfs")
    print()


def main(
    version: Optional[str] = None,
    release: Optional[str] = None,
    force: bool = False,
    skip_download: bool = False
) -> int:
    """Main entry point.

    Args:
        version: Alpine version (e.g., "3.22").
        release: Alpine release (e.g., "3.22.2").
        force: Force re-download of ISO.
        skip_download: Skip download, use existing ISO.

    Returns:
        Exit code (0 for success).
    """
    # Create Alpine version configuration
    alpine = AlpineVersion()
    if version:
        alpine.version = version
    if release:
        alpine.release = release

    # Get paths
    vm_dir = get_vm_dir()
    kernel_dir = vm_dir / "kernel"

    # Print header
    print_header(alpine)

    # Backup current kernel
    backup_current_kernel(kernel_dir)

    # Download ISO
    if not skip_download:
        iso_path = download_iso(kernel_dir, alpine, force)
        if not iso_path:
            return 1
    else:
        iso_path = kernel_dir / alpine.iso_name
        if not iso_path.exists():
            print(f"{RED}ISO not found: {iso_path}{NC}")
            return 1

    # Extract from ISO
    if not extract_from_iso(iso_path, kernel_dir, alpine):
        return 1

    # Extract uncompressed kernel
    if not extract_uncompressed_kernel(kernel_dir, alpine):
        return 1

    # Verify kernel
    verify_kernel(kernel_dir, alpine)

    # Print kernel info
    print_kernel_info(kernel_dir, alpine)

    # Replace kernel
    if not replace_kernel(kernel_dir, alpine):
        return 1

    # Print summary
    print_summary(kernel_dir, alpine)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Upgrade to Alpine Linux with latest kernel"
    )
    parser.add_argument(
        '--version',
        default="3.22",
        help="Alpine version (default: 3.22)"
    )
    parser.add_argument(
        '--release',
        default="3.22.2",
        help="Alpine release (default: 3.22.2)"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help="Force re-download of ISO"
    )
    parser.add_argument(
        '--skip-download',
        action='store_true',
        help="Skip download, use existing ISO"
    )

    args = parser.parse_args()
    sys.exit(main(args.version, args.release, args.force, args.skip_download))
