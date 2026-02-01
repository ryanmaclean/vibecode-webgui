#!/usr/bin/env python3
"""Download minimal Alpine Linux kernel for ASIF test VM.

Downloads ONLY vmlinuz-virt (~8-10MB) - no ISO needed permanently.
For ultra-low disk space environments (<100MB free).
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TEST_DIR = Path("/tmp/asif-test")

# Alpine version - use latest stable
ALPINE_VERSION = "3.20"
ALPINE_ARCH = "aarch64"
FALLBACK_RELEASE = "3.20.3"

# Base URL for Alpine releases
KERNEL_BASE_URL = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/{ALPINE_ARCH}"


def run_cmd(cmd: list[str], check: bool = True, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check, cwd=cwd)


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "K", "M", "G"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}T"


def find_latest_release() -> str:
    """Find the latest Alpine release version."""
    print("Finding latest Alpine release...")

    if not shutil.which("curl"):
        print(f"  curl not available, using fallback: {FALLBACK_RELEASE}")
        return FALLBACK_RELEASE

    release_url = f"{KERNEL_BASE_URL}/"
    result = run_cmd(["curl", "-sL", release_url], check=False)

    if result.returncode != 0:
        print(f"  Could not fetch releases, using fallback: {FALLBACK_RELEASE}")
        return FALLBACK_RELEASE

    # Parse for latest version from ISO filenames
    pattern = rf"alpine-virt-([0-9.]+)-{ALPINE_ARCH}\.iso"
    matches = re.findall(pattern, result.stdout)

    if matches:
        # Sort by version and get the latest
        versions = sorted(matches, key=lambda v: [int(x) for x in v.split(".")])
        latest = versions[-1]
        print(f"  Latest version: {latest}")
        return latest

    print(f"  Could not parse releases, using fallback: {FALLBACK_RELEASE}")
    return FALLBACK_RELEASE


def download_iso(test_dir: Path, release: str) -> Path | None:
    """Download the Alpine ISO."""
    iso_name = f"alpine-virt-{release}-{ALPINE_ARCH}.iso"
    iso_url = f"{KERNEL_BASE_URL}/{iso_name}"
    iso_path = test_dir / iso_name

    print()
    print(f"Downloading: {iso_name}")
    print(f"  URL: {iso_url}")
    print("  This is ~60MB but we'll delete it after extracting kernel")
    print()

    result = run_cmd(["curl", "-L", "-o", str(iso_path), iso_url], check=False)

    if result.returncode != 0 or not iso_path.exists():
        print("Failed to download Alpine ISO")
        return None

    size = get_file_size_human(iso_path)
    print(f"Downloaded: {iso_name} ({size})")

    return iso_path


def extract_kernel(iso_path: Path, test_dir: Path) -> Path | None:
    """Extract the kernel from the ISO."""
    print()
    print("Extracting kernel from ISO...")

    # Check for bsdtar (built into macOS) or tar
    tar_cmd = None
    if shutil.which("bsdtar"):
        tar_cmd = "bsdtar"
    elif shutil.which("tar"):
        tar_cmd = "tar"
    else:
        print("Neither bsdtar nor tar found")
        return None

    # Extract boot directory
    result = run_cmd([tar_cmd, "-xf", str(iso_path), "boot/"], check=False, cwd=test_dir)

    boot_dir = test_dir / "boot"
    if not boot_dir.exists():
        print("Failed to extract boot directory from ISO")
        return None

    # Find and copy kernel
    kernel_path = test_dir / "vmlinuz"
    kernel_candidates = [
        boot_dir / "vmlinuz-virt",
        boot_dir / "vmlinuz-lts",
    ]

    for candidate in kernel_candidates:
        if candidate.exists():
            shutil.copy2(candidate, kernel_path)
            print(f"Extracted: {candidate.name}")
            break
    else:
        # Try to find any vmlinuz file
        vmlinuz_files = list(boot_dir.glob("vmlinuz-*"))
        if vmlinuz_files:
            shutil.copy2(vmlinuz_files[0], kernel_path)
            print(f"Extracted: {vmlinuz_files[0].name}")
        else:
            print("Could not find kernel in ISO")
            shutil.rmtree(boot_dir, ignore_errors=True)
            return None

    # Cleanup boot directory
    shutil.rmtree(boot_dir, ignore_errors=True)

    return kernel_path if kernel_path.exists() else None


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=DEFAULT_TEST_DIR,
        help=f"Output directory (default: {DEFAULT_TEST_DIR})",
    )
    parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="Re-download even if kernel exists",
    )
    parser.add_argument(
        "--version",
        default=None,
        help=f"Alpine version to download (default: auto-detect latest {ALPINE_VERSION}.x)",
    )

    args = parser.parse_args(argv)

    test_dir = args.output_dir
    kernel_path = test_dir / "vmlinuz"

    print("=== Downloading Minimal Alpine Kernel ===")
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Architecture: {ALPINE_ARCH}")
    print(f"Target: {test_dir}")
    print()

    # Create test directory
    test_dir.mkdir(parents=True, exist_ok=True)

    # Check if kernel already exists
    if kernel_path.exists() and not args.force:
        size = get_file_size_human(kernel_path)
        print(f"Kernel already exists: vmlinuz ({size})")
        print()
        return 0

    # Check for curl
    if not shutil.which("curl"):
        print("curl not found")
        return 1

    # Find latest release
    release = args.version or find_latest_release()

    # Download ISO
    iso_path = download_iso(test_dir, release)
    if not iso_path:
        return 1

    # Extract kernel
    kernel_path = extract_kernel(iso_path, test_dir)

    # Delete ISO to save space
    print()
    print("Cleaning up ISO to save space...")
    iso_path.unlink(missing_ok=True)
    print("Deleted ISO")

    # Verify kernel exists
    if not kernel_path or not kernel_path.exists():
        print()
        print("Failed to download/extract kernel")
        return 1

    size = get_file_size_human(kernel_path)
    print()
    print("=== Download Complete ===")
    print()
    print(f"Kernel: {kernel_path} ({size})")
    print()
    print("Next steps:")
    print("  1. ./scripts/vz/create-minimal-initramfs.sh")
    print("  2. ./scripts/vz/create-asif-disk.sh")
    print("  3. ./scripts/vz/asif-test-vm.swift")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
