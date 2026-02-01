#!/usr/bin/env python3


"""Download minimal Alpine Linux kernel for ASIF test VM.

Downloads ONLY vmlinuz-virt (~8-10MB) - no ISO kept.
For ultra-low disk space environments (<100MB free).
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

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional


# Constants
DEFAULT_ALPINE_VERSION = "3.20"
DEFAULT_ALPINE_ARCH = "aarch64"
DEFAULT_TEST_DIR = Path("/tmp/asif-test")
ALPINE_BASE_URL = "https://dl-cdn.alpinelinux.org/alpine"


def get_kernel_base_url(version: str, arch: str) -> str:
    """Build the Alpine release URL."""
    return f"{ALPINE_BASE_URL}/v{version}/releases/{arch}"


def check_existing_kernel(test_dir: Path) -> Optional[Path]:
    """Check if kernel already exists.

    Returns:
        Path to kernel if exists, None otherwise.
    """
    kernel_path = test_dir / "vmlinuz"
    if kernel_path.exists():
        return kernel_path
    return None


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def find_latest_alpine_release(base_url: str) -> str:
    """Find the latest Alpine release version from the release directory.

    Returns:
        Version string like "3.20.3"
    """
    try:
        result = subprocess.run(
            ["curl", "-sL", f"{base_url}/"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return "3.20.3"  # Fallback

        # Parse HTML for ISO filenames
        matches = re.findall(r"alpine-virt-([0-9.]+)-aarch64\.iso", result.stdout)
        if matches:
            # Sort versions and return latest
            matches.sort(key=lambda v: [int(x) for x in v.split(".")])
            return matches[-1]
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass

    return "3.20.3"  # Fallback


def download_iso(url: str, dest: Path) -> bool:
    """Download Alpine ISO using curl.

    Returns:
        True if successful, False otherwise.
    """
    try:
        result = subprocess.run(
            ["curl", "-L", "-o", str(dest), url],
            timeout=300,  # 5 minute timeout for download
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def extract_kernel_from_iso(iso_path: Path, dest_dir: Path) -> Optional[Path]:
    """Extract kernel from Alpine ISO using bsdtar.

    Returns:
        Path to extracted kernel, or None if failed.
    """
    if not shutil.which("bsdtar"):
        print("Error: bsdtar not found (should be built into macOS)")
        return None

    try:
        # Extract boot directory
        subprocess.run(
            ["bsdtar", "-xf", str(iso_path), "boot/"],
            cwd=dest_dir,
            capture_output=True,
            timeout=60,
        )

        boot_dir = dest_dir / "boot"
        kernel_path = dest_dir / "vmlinuz"

        # Try different kernel names in order of preference
        kernel_names = ["vmlinuz-virt", "vmlinuz-lts"]
        for name in kernel_names:
            src = boot_dir / name
            if src.exists():
                shutil.copy(src, kernel_path)
                shutil.rmtree(boot_dir, ignore_errors=True)
                return kernel_path

        # Fallback: find any vmlinuz-* file
        for vmlinuz in boot_dir.glob("vmlinuz-*"):
            shutil.copy(vmlinuz, kernel_path)
            shutil.rmtree(boot_dir, ignore_errors=True)
            return kernel_path

        return None

    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return None


def download_alpine_kernel(
    test_dir: Path = DEFAULT_TEST_DIR,
    version: str = DEFAULT_ALPINE_VERSION,
    arch: str = DEFAULT_ALPINE_ARCH,
) -> int:
    """Download minimal Alpine Linux kernel.

    Args:
        test_dir: Directory to store kernel
        version: Alpine version (e.g., "3.20")
        arch: Architecture (e.g., "aarch64")

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    print("=== Downloading Minimal Alpine Kernel ===")
    print()
    print(f"Alpine Version: {version}")
    print(f"Architecture: {arch}")
    print(f"Target: {test_dir}")
    print()

    # Create test directory
    test_dir.mkdir(parents=True, exist_ok=True)

    # Check if kernel already exists
    existing = check_existing_kernel(test_dir)
    if existing:
        size = get_file_size_human(existing)
        print(f"Kernel already exists: vmlinuz ({size})")
        print()
        return 0

    # Check for curl
    if not shutil.which("curl"):
        print("Error: curl not found")
        return 1

    # Find latest release
    base_url = get_kernel_base_url(version, arch)
    print(f"Finding latest Alpine {version} release...")

    release_version = find_latest_alpine_release(base_url)
    print(f"   Latest version: {release_version}")

    # Download ISO
    iso_name = f"alpine-virt-{release_version}-{arch}.iso"
    iso_url = f"{base_url}/{iso_name}"
    iso_path = test_dir / iso_name

    print()
    print(f"Downloading: {iso_name}")
    print(f"   URL: {iso_url}")
    print("   This is ~60MB but we'll delete it after extracting kernel")
    print()

    if not download_iso(iso_url, iso_path):
        print("Error: Failed to download Alpine ISO")
        return 1

    size = get_file_size_human(iso_path)
    print(f"Downloaded: {iso_name} ({size})")

    # Extract kernel
    print()
    print("Extracting kernel from ISO...")

    kernel_path = extract_kernel_from_iso(iso_path, test_dir)
    if not kernel_path:
        print("Error: Failed to extract kernel from ISO")
        iso_path.unlink(missing_ok=True)
        return 1

    # Cleanup ISO
    print()
    print("Cleaning up ISO to save space...")
    iso_path.unlink(missing_ok=True)
    print("Deleted ISO")

    # Verify and report
    if not kernel_path.exists():
        print()
        print("Error: Failed to download/extract kernel")
        return 1

    kernel_size = get_file_size_human(kernel_path)
    print()
    print("=== Download Complete ===")
    print()
    print(f"Kernel: {kernel_path} ({kernel_size})")
    print()
    print("Next steps:")
    print("  1. ./scripts/vz/create-minimal-initramfs.sh")
    print("  2. ./scripts/vz/create-asif-disk.sh")
    print("  3. ./scripts/vz/asif-test-vm.swift")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    return download_alpine_kernel()


if __name__ == "__main__":
    sys.exit(main())