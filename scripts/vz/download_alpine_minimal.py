#!/usr/bin/env python3
"""Download minimal Alpine Linux kernel for ASIF test VM.

Downloads ONLY vmlinuz-virt (~8-10MB) - no ISO needed.
For ultra-low disk space environments (<100MB free).
"""

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import urlopen

# Colors for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
NC = '\033[0m'

# Default configuration
DEFAULT_ALPINE_VERSION = "3.20"
DEFAULT_ALPINE_ARCH = "aarch64"
DEFAULT_TEST_DIR = Path("/tmp/asif-test")


def run_command(
    cmd: list[str],
    capture: bool = True,
    check: bool = False
) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr).

    Args:
        cmd: Command and arguments.
        capture: Whether to capture output.
        check: Whether to raise on error.

    Returns:
        Tuple of (returncode, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            check=check
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout or "", e.stderr or ""
    except FileNotFoundError:
        return -1, "", "command not found"


def get_file_size(path: Path) -> str:
    """Get human-readable file size.

    Args:
        path: Path to file.

    Returns:
        Human-readable size string.
    """
    size = path.stat().st_size
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def fetch_url(url: str, timeout: int = 30) -> Optional[bytes]:
    """Fetch content from URL.

    Args:
        url: URL to fetch.
        timeout: Request timeout.

    Returns:
        Response content or None on error.
    """
    try:
        with urlopen(url, timeout=timeout) as response:
            return response.read()
    except (URLError, TimeoutError):
        return None


def download_file(url: str, dest: Path) -> bool:
    """Download a file using curl.

    Args:
        url: URL to download.
        dest: Destination path.

    Returns:
        True if successful.
    """
    rc, _, _ = run_command(["curl", "-L", "-o", str(dest), url])
    return rc == 0


def find_latest_release(version: str, arch: str) -> str:
    """Find the latest Alpine release version.

    Args:
        version: Alpine major version (e.g., "3.20").
        arch: Architecture.

    Returns:
        Latest release version string.
    """
    base_url = f"https://dl-cdn.alpinelinux.org/alpine/v{version}/releases/{arch}/"
    fallback = f"{version}.3"

    print(f"🔍 Finding latest Alpine {version} release...")

    content = fetch_url(base_url)
    if not content:
        print(f"   Using fallback: {fallback}")
        return fallback

    # Parse for latest version
    html = content.decode('utf-8', errors='ignore')
    pattern = rf'alpine-virt-([0-9.]+)-{arch}\.iso'
    matches = re.findall(pattern, html)

    if matches:
        # Sort versions and get latest
        latest = sorted(matches, key=lambda v: [int(x) for x in v.split('.')])[-1]
        print(f"   Latest version: {latest}")
        return latest

    print(f"   Using fallback: {fallback}")
    return fallback


def extract_kernel_from_iso(iso_path: Path, dest_dir: Path) -> bool:
    """Extract kernel from Alpine ISO.

    Args:
        iso_path: Path to ISO file.
        dest_dir: Destination directory.

    Returns:
        True if successful.
    """
    print()
    print("📦 Extracting kernel from ISO...")

    if not shutil.which("bsdtar"):
        print("❌ bsdtar not found (should be built into macOS)")
        return False

    # Extract boot directory
    run_command(["bsdtar", "-xf", str(iso_path), "boot/"], check=False)

    boot_dir = dest_dir / "boot"
    vmlinuz_dest = dest_dir / "vmlinuz"

    # Try different kernel names
    kernel_names = ["vmlinuz-virt", "vmlinuz-lts"]
    for name in kernel_names:
        kernel_path = boot_dir / name
        if kernel_path.exists():
            shutil.copy(kernel_path, vmlinuz_dest)
            print(f"✅ Extracted: {name}")
            shutil.rmtree(boot_dir, ignore_errors=True)
            return True

    # Try to find any kernel
    if boot_dir.exists():
        for kernel in boot_dir.glob("vmlinuz-*"):
            shutil.copy(kernel, vmlinuz_dest)
            print(f"✅ Extracted: {kernel.name}")
            shutil.rmtree(boot_dir, ignore_errors=True)
            return True

    shutil.rmtree(boot_dir, ignore_errors=True)
    return False


def download_alpine_kernel(
    version: str = DEFAULT_ALPINE_VERSION,
    arch: str = DEFAULT_ALPINE_ARCH,
    test_dir: Path = DEFAULT_TEST_DIR
) -> int:
    """Download minimal Alpine kernel.

    Args:
        version: Alpine version.
        arch: Architecture.
        test_dir: Target directory.

    Returns:
        Exit code.
    """
    print("=== Downloading Minimal Alpine Kernel ===")
    print()
    print(f"Alpine Version: {version}")
    print(f"Architecture: {arch}")
    print(f"Target: {test_dir}")
    print()

    # Create test directory
    test_dir.mkdir(parents=True, exist_ok=True)

    vmlinuz_path = test_dir / "vmlinuz"

    # Check if kernel already exists
    if vmlinuz_path.exists():
        size = get_file_size(vmlinuz_path)
        print(f"✅ Kernel already exists: vmlinuz ({size})")
        print()
        return 0

    # Check for curl
    if not shutil.which("curl"):
        print("❌ curl not found")
        return 1

    # Find latest release
    release = find_latest_release(version, arch)

    # Download ISO
    base_url = f"https://dl-cdn.alpinelinux.org/alpine/v{version}/releases/{arch}"
    iso_name = f"alpine-virt-{release}-{arch}.iso"
    iso_url = f"{base_url}/{iso_name}"
    iso_path = test_dir / iso_name

    print()
    print(f"📥 Downloading: {iso_name}")
    print(f"   URL: {iso_url}")
    print("   This is ~60MB but we'll delete it after extracting kernel")
    print()

    if not download_file(iso_url, iso_path):
        print("❌ Failed to download Alpine ISO")
        return 1

    iso_size = get_file_size(iso_path)
    print(f"✅ Downloaded: {iso_name} ({iso_size})")

    # Extract kernel
    if not extract_kernel_from_iso(iso_path, test_dir):
        print("❌ Failed to extract kernel from ISO")
        iso_path.unlink(missing_ok=True)
        return 1

    # Delete ISO to save space
    print()
    print("🧹 Cleaning up ISO to save space...")
    iso_path.unlink(missing_ok=True)
    print("✅ Deleted ISO")

    # Verify kernel exists
    if not vmlinuz_path.exists():
        print()
        print("❌ Failed to download/extract kernel")
        return 1

    kernel_size = get_file_size(vmlinuz_path)
    print()
    print("=== Download Complete ===")
    print()
    print(f"✅ Kernel: {vmlinuz_path} ({kernel_size})")
    print()
    print("Next steps:")
    print("  1. ./scripts/vz/create-minimal-initramfs.sh")
    print("  2. ./scripts/vz/create-asif-disk.sh")
    print("  3. ./scripts/vz/asif-test-vm.swift")
    print()

    return 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    parser = argparse.ArgumentParser(
        description="Download minimal Alpine Linux kernel for ASIF test VM"
    )
    parser.add_argument(
        '--version',
        default=DEFAULT_ALPINE_VERSION,
        help=f'Alpine version (default: {DEFAULT_ALPINE_VERSION})'
    )
    parser.add_argument(
        '--arch',
        default=DEFAULT_ALPINE_ARCH,
        help=f'Architecture (default: {DEFAULT_ALPINE_ARCH})'
    )
    parser.add_argument(
        '-o', '--output-dir',
        type=Path,
        default=DEFAULT_TEST_DIR,
        help=f'Target directory (default: {DEFAULT_TEST_DIR})'
    )

    args = parser.parse_args()

    return download_alpine_kernel(
        version=args.version,
        arch=args.arch,
        test_dir=args.output_dir
    )


if __name__ == "__main__":
    sys.exit(main())
