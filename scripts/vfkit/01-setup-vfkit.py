#!/usr/bin/env python3
"""Setup and verify vfkit for Alpine ARM64 VMs.

This script installs vfkit and prepares the environment.
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn


def check_macos() -> bool:
    """Check if running on macOS."""
    if platform.system() != "Darwin":
        log_error("This script requires macOS")
        return False
    return True


def check_apple_silicon() -> bool:
    """Check if running on Apple Silicon."""
    arch = platform.machine()
    if arch != "arm64":
        log_warn(f"Not running on Apple Silicon (detected: {arch})")
        print("vfkit works best on Apple Silicon M1/M2/M3")
        response = input("Continue anyway? (y/N) ").strip().lower()
        if response != "y":
            return False
    print(f"✅ Platform: macOS on {arch}")
    print()
    return True


def check_homebrew() -> bool:
    """Check if Homebrew is installed."""
    if not shutil.which("brew"):
        log_error("Homebrew is not installed")
        print("Install Homebrew from: https://brew.sh")
        print()
        print("Run this command:")
        print('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
        return False

    result = subprocess.run(["brew", "--version"], capture_output=True, text=True, check=False)
    version = result.stdout.strip().split("\n")[0] if result.returncode == 0 else "unknown"
    print(f"✅ Homebrew installed: {version}")
    print()
    return True


def check_and_install_vfkit() -> bool:
    """Check if vfkit is installed, install if needed."""
    if not shutil.which("vfkit"):
        log_warn("vfkit is not installed")
        print("Installing vfkit via Homebrew...")
        print()

        result = subprocess.run(["brew", "install", "vfkit"], check=False)
        if result.returncode != 0:
            log_error("Failed to install vfkit")
            print("Try manually: brew install vfkit")
            return False
        log_success("vfkit installed successfully")
    else:
        print("✅ vfkit already installed")
        result = subprocess.run(["vfkit", "--version"], capture_output=True, text=True, check=False)
        version = result.stdout.strip() if result.returncode == 0 else "unknown"
        print(f"   Version: {version}")

    print()
    return True


def verify_vfkit() -> bool:
    """Verify vfkit can run."""
    print("Verifying vfkit...")
    result = subprocess.run(["vfkit", "--help"], capture_output=True, check=False)
    if result.returncode != 0:
        log_error("vfkit is installed but not working")
        print("Try: brew reinstall vfkit")
        return False
    log_success("vfkit is working")
    print()
    return True


def create_vm_directories() -> Path:
    """Create VM directory structure."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    subdirs = ["kernel", "rootfs", "disk", "logs"]

    print("Creating VM directories...")
    for subdir in subdirs:
        (vm_dir / subdir).mkdir(parents=True, exist_ok=True)

    log_success("Created VM directories:")
    for subdir in subdirs:
        desc = {
            "kernel": "Kernel and initramfs",
            "rootfs": "Root filesystem builds",
            "disk": "VM disk images",
            "logs": "VM console and error logs",
        }.get(subdir, "")
        print(f"   {vm_dir / subdir}  - {desc}")

    print()
    return vm_dir


def check_disk_space() -> None:
    """Check available disk space."""
    home = Path.home()
    stat = os.statvfs(home)
    available_gb = (stat.f_bavail * stat.f_frsize) // (1024**3)

    print(f"Available disk space: {available_gb}GB")
    if available_gb < 5:
        log_warn("Less than 5GB available")
        print("Recommended: At least 10GB free space")
    print()


def print_summary(vm_dir: Path) -> None:
    """Print setup summary."""
    log_section("Setup Complete")
    print()
    print("✅ vfkit installed and verified")
    print(f"✅ VM directories created at: {vm_dir}")
    print()
    print("Next steps:")
    print("  1. Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
    print("  2. Run: ./scripts/vfkit/03-create-alpine-rootfs.sh")
    print("  3. Run: ./scripts/vfkit/04-launch-alpine-vm.sh")
    print()
    print("Or run the all-in-one installer:")
    print("  ./scripts/vfkit/install-alpine-vm.sh")
    print()


def main() -> int:
    """Main entry point."""
    log_section("vfkit Setup for Alpine ARM64")
    print()

    if not check_macos():
        return 1

    if not check_apple_silicon():
        return 1

    if not check_homebrew():
        return 1

    if not check_and_install_vfkit():
        return 1

    if not verify_vfkit():
        return 1

    vm_dir = create_vm_directories()
    check_disk_space()
    print_summary(vm_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
