#!/usr/bin/env python3
"""Download Linux kernel for macOS Virtualization.framework."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Optional
from urllib.request import urlopen
from urllib.error import URLError

# ANSI color codes
GREEN = "\033[0;32m"
NC = "\033[0m"


@dataclass
class KernelConfig:
    """Kernel download configuration."""

    vm_dir: Path = field(default_factory=lambda: Path.home() / ".vibecode" / "vm")
    kernel_version: str = "6.6.68"
    release_url: str = (
        "https://github.com/ryanmaclean/vibecode-webgui/releases/download/"
        "cloud-hypervisor-v1.0.0-alpha/vibecode-cloud-hypervisor-binaries-v1.0.0.tar.gz"
    )

    @property
    def vmlinuz_versioned(self) -> str:
        """Get versioned vmlinuz filename."""
        return f"vmlinuz-{self.kernel_version}-mseries"

    @property
    def vmlinuz_path(self) -> Path:
        """Get vmlinuz path."""
        return self.vm_dir / "vmlinuz"

    @property
    def initramfs_path(self) -> Path:
        """Get initramfs path."""
        return self.vm_dir / "initramfs"

    @classmethod
    def from_env(cls) -> "KernelConfig":
        """Create config from environment variables."""
        vm_dir_str = os.environ.get("VM_DIR")
        vm_dir = Path(vm_dir_str) if vm_dir_str else Path.home() / ".vibecode" / "vm"
        return cls(
            vm_dir=vm_dir,
            kernel_version=os.environ.get("KERNEL_VERSION", "6.6.68"),
        )


def log_info(msg: str) -> None:
    """Print info message."""
    print(msg)


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}{msg}{NC}")


def download_tarball(url: str, timeout: int = 120) -> Optional[bytes]:
    """Download tarball from URL.

    Args:
        url: URL to download from.
        timeout: Download timeout in seconds.

    Returns:
        Tarball bytes or None on failure.
    """
    try:
        with urlopen(url, timeout=timeout) as response:
            return response.read()
    except URLError as e:
        print(f"ERROR: Failed to download: {e}", file=sys.stderr)
        return None
    except TimeoutError:
        print("ERROR: Download timed out", file=sys.stderr)
        return None


def extract_kernel_files(
    tarball_data: bytes,
    config: KernelConfig,
) -> bool:
    """Extract kernel files from tarball.

    Args:
        tarball_data: Raw tarball bytes.
        config: Kernel configuration.

    Returns:
        True if extraction successful.
    """
    try:
        with tarfile.open(fileobj=BytesIO(tarball_data), mode="r:gz") as tar:
            # Find and extract the specific files we need
            members_to_extract = []
            for member in tar.getmembers():
                name = member.name
                # Strip leading path components
                basename = Path(name).name
                if basename == config.vmlinuz_versioned or basename == "initramfs":
                    members_to_extract.append((member, basename))

            if not members_to_extract:
                print("ERROR: Required files not found in tarball", file=sys.stderr)
                return False

            # Extract to temp dir first, then move
            with tempfile.TemporaryDirectory() as tmpdir:
                tmppath = Path(tmpdir)
                for member, basename in members_to_extract:
                    # Extract file
                    tar.extract(member, tmppath)
                    extracted = tmppath / member.name

                    # Determine destination
                    if basename == config.vmlinuz_versioned:
                        dest = config.vmlinuz_path
                    else:
                        dest = config.initramfs_path

                    # Move to final location
                    shutil.move(str(extracted), str(dest))

            return True

    except tarfile.TarError as e:
        print(f"ERROR: Failed to extract tarball: {e}", file=sys.stderr)
        return False
    except OSError as e:
        print(f"ERROR: Failed to move files: {e}", file=sys.stderr)
        return False


def list_kernel_files(config: KernelConfig) -> None:
    """List kernel files with sizes.

    Args:
        config: Kernel configuration.
    """
    for path in [config.vmlinuz_path, config.initramfs_path]:
        if path.exists():
            size = path.stat().st_size
            # Format size in human-readable form
            for unit in ["B", "K", "M", "G"]:
                if size < 1024:
                    print(f"  {path}: {size:.1f}{unit}")
                    break
                size /= 1024


def download_kernel(config: Optional[KernelConfig] = None) -> int:
    """Download Linux kernel for macOS Virtualization.framework.

    Args:
        config: Kernel configuration (uses defaults if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = KernelConfig.from_env()

    log_info("🔽 Downloading Linux kernel for macOS Virtualization.framework...")

    # Create VM directory
    try:
        config.vm_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        print(f"ERROR: Failed to create directory: {e}", file=sys.stderr)
        return 1

    # Download tarball
    log_info("📦 Fetching kernel components...")
    tarball_data = download_tarball(config.release_url)
    if tarball_data is None:
        return 1

    # Extract kernel files
    if not extract_kernel_files(tarball_data, config):
        return 1

    # Verify files exist
    if not config.vmlinuz_path.exists():
        print("ERROR: vmlinuz not found after extraction", file=sys.stderr)
        return 1

    if not config.initramfs_path.exists():
        print("ERROR: initramfs not found after extraction", file=sys.stderr)
        return 1

    log_success("✅ Kernel components downloaded:")
    list_kernel_files(config)

    print()
    log_info(f"📍 Files installed to: {config.vm_dir}")
    log_info("🚀 Ready to run: swift run --package-path macos-vm")

    return 0


def main() -> int:
    """Main entry point."""
    return download_kernel()


if __name__ == "__main__":
    sys.exit(main())
