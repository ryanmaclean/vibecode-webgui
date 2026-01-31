#!/usr/bin/env python3
"""Setup and verify vfkit for Alpine ARM64 VMs.

This script installs vfkit and prepares the environment.
"""

from __future__ import annotations

import platform
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    reset: str = "\033[0m"


COLORS = Colors()

VM_DIR = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"


def print_header(message: str) -> None:
    """Print a header message."""
    print(f"=== {message} ===")
    print()


def print_success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}✅ {message}{COLORS.reset}")


def print_warning(message: str) -> None:
    """Print yellow warning message."""
    print(f"{COLORS.yellow}⚠️  {message}{COLORS.reset}")


def print_error(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}❌ {message}{COLORS.reset}")


def check_macos() -> bool:
    """Check if running on macOS.

    Returns:
        True if on macOS, False otherwise.
    """
    if platform.system() != "Darwin":
        print_error("Error: This script requires macOS")
        return False
    return True


def check_apple_silicon() -> bool:
    """Check if running on Apple Silicon.

    Returns:
        True if should continue, False to abort.
    """
    arch = platform.machine()

    if arch != "arm64":
        print_warning(f"Warning: Not running on Apple Silicon (detected: {arch})")
        print("vfkit works best on Apple Silicon M1/M2/M3")

        try:
            response = input("Continue anyway? (y/N) ").strip().lower()
        except EOFError:
            response = ""

        if response not in ("y", "yes"):
            return False

    print_success(f"Platform: macOS on {arch}")
    print()
    return True


def check_homebrew() -> bool:
    """Check if Homebrew is installed.

    Returns:
        True if Homebrew is available, False otherwise.
    """
    if not shutil.which("brew"):
        print_error("Homebrew is not installed")
        print("Install Homebrew from: https://brew.sh")
        print()
        print("Run this command:")
        print('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
        return False

    result = subprocess.run(
        ["brew", "--version"],
        capture_output=True,
        text=True,
    )
    version = result.stdout.strip().split("\n")[0] if result.stdout else "unknown"
    print_success(f"Homebrew installed: {version}")
    print()
    return True


def install_vfkit() -> bool:
    """Install vfkit via Homebrew.

    Returns:
        True if installation succeeded, False otherwise.
    """
    print("Installing vfkit via Homebrew...")
    print()

    result = subprocess.run(["brew", "install", "vfkit"])

    if result.returncode == 0:
        print_success("vfkit installed successfully")
        return True
    else:
        print_error("Failed to install vfkit")
        print("Try manually: brew install vfkit")
        return False


def check_vfkit() -> bool:
    """Check if vfkit is installed, install if not.

    Returns:
        True if vfkit is available, False otherwise.
    """
    if not shutil.which("vfkit"):
        print_warning("vfkit is not installed")
        return install_vfkit()

    print_success("vfkit already installed")

    result = subprocess.run(
        ["vfkit", "--version"],
        capture_output=True,
        text=True,
    )
    version = result.stdout.strip() if result.stdout else result.stderr.strip() if result.stderr else "unknown"
    print(f"   Version: {version}")
    print()
    return True


def verify_vfkit() -> bool:
    """Verify vfkit can run.

    Returns:
        True if vfkit works, False otherwise.
    """
    print("Verifying vfkit...")

    result = subprocess.run(
        ["vfkit", "--help"],
        capture_output=True,
    )

    if result.returncode == 0:
        print_success("vfkit is working")
        print()
        return True
    else:
        print_error("vfkit is installed but not working")
        print("Try: brew reinstall vfkit")
        return False


def create_vm_directories() -> None:
    """Create VM directory structure."""
    print("Creating VM directories...")

    subdirs = ["kernel", "rootfs", "disk", "logs"]
    for subdir in subdirs:
        (VM_DIR / subdir).mkdir(parents=True, exist_ok=True)

    print_success("Created VM directories:")
    print(f"   {VM_DIR}/kernel  - Kernel and initramfs")
    print(f"   {VM_DIR}/rootfs  - Root filesystem builds")
    print(f"   {VM_DIR}/disk    - VM disk images")
    print(f"   {VM_DIR}/logs    - VM console and error logs")
    print()


def check_disk_space() -> None:
    """Check available disk space."""
    result = subprocess.run(
        ["df", "-g", str(Path.home())],
        capture_output=True,
        text=True,
    )

    available_gb = 0
    if result.returncode == 0 and result.stdout:
        lines = result.stdout.strip().split("\n")
        if len(lines) > 1:
            parts = lines[-1].split()
            if len(parts) >= 4:
                try:
                    available_gb = int(parts[3])
                except ValueError:
                    pass

    print(f"Available disk space: {available_gb}GB")

    if available_gb < 5:
        print_warning("Warning: Less than 5GB available")
        print("Recommended: At least 10GB free space")

    print()


def print_summary() -> None:
    """Print setup summary and next steps."""
    print_header("Setup Complete")

    print_success("vfkit installed and verified")
    print_success(f"VM directories created at: {VM_DIR}")
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
    print_header("vfkit Setup for Alpine ARM64")

    # Check platform requirements
    if not check_macos():
        return 1

    if not check_apple_silicon():
        return 1

    # Check dependencies
    if not check_homebrew():
        return 1

    if not check_vfkit():
        return 1

    if not verify_vfkit():
        return 1

    # Setup environment
    create_vm_directories()
    check_disk_space()

    # Summary
    print_summary()

    return 0


if __name__ == "__main__":
    sys.exit(main())
