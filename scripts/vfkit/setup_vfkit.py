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


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(cmd, check=check, capture_output=capture, text=True)


def get_available_disk_space_gb(path: Path) -> int:
    """Get available disk space in GB."""
    result = run_command(["df", "-g", str(path)], capture=True)
    lines = result.stdout.strip().split("\n")
    if len(lines) >= 2:
        parts = lines[-1].split()
        if len(parts) >= 4:
            return int(parts[3])
    return 0


def check_macos() -> bool:
    """Check if running on macOS."""
    if platform.system() != "Darwin":
        print(f"{Colors.RED}\u274c Error: This script requires macOS{Colors.NC}")
        return False
    return True


def check_apple_silicon() -> bool:
    """Check if running on Apple Silicon."""
    arch = platform.machine()
    if arch != "arm64":
        print(f"{Colors.YELLOW}\u26a0\ufe0f  Warning: Not running on Apple Silicon (detected: {arch}){Colors.NC}")
        print("vfkit works best on Apple Silicon M1/M2/M3")
        try:
            response = input("Continue anyway? (y/N) ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            response = ""
        if response not in ("y", "yes"):
            return False
    print(f"\u2705 Platform: macOS on {arch}")
    print()
    return True


def check_homebrew() -> bool:
    """Check if Homebrew is installed."""
    if not shutil.which("brew"):
        print(f"{Colors.RED}\u274c Homebrew is not installed{Colors.NC}")
        print("Install Homebrew from: https://brew.sh")
        print()
        print("Run this command:")
        print('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
        return False

    result = run_command(["brew", "--version"], capture=True)
    version = result.stdout.strip().split("\n")[0]
    print(f"\u2705 Homebrew installed: {version}")
    print()
    return True


def install_vfkit() -> bool:
    """Install or verify vfkit."""
    if not shutil.which("vfkit"):
        print(f"{Colors.YELLOW}\u26a0\ufe0f  vfkit is not installed{Colors.NC}")
        print("Installing vfkit via Homebrew...")
        print()

        result = run_command(["brew", "install", "vfkit"], check=False)
        if result.returncode == 0:
            print(f"{Colors.GREEN}\u2705 vfkit installed successfully{Colors.NC}")
        else:
            print(f"{Colors.RED}\u274c Failed to install vfkit{Colors.NC}")
            print("Try manually: brew install vfkit")
            return False
    else:
        print("\u2705 vfkit already installed")
        result = run_command(["vfkit", "--version"], check=False, capture=True)
        version = result.stdout.strip() if result.returncode == 0 else "unknown"
        print(f"   Version: {version}")

    print()
    return True


def verify_vfkit() -> bool:
    """Verify vfkit can run."""
    print("Verifying vfkit...")
    result = run_command(["vfkit", "--help"], check=False, capture=True)
    if result.returncode == 0:
        print(f"{Colors.GREEN}\u2705 vfkit is working{Colors.NC}")
        return True
    else:
        print(f"{Colors.RED}\u274c vfkit is installed but not working{Colors.NC}")
        print("Try: brew reinstall vfkit")
        return False


def create_vm_directories(vm_dir: Path) -> None:
    """Create VM directory structure."""
    print("Creating VM directories...")

    subdirs = ["kernel", "rootfs", "disk", "logs"]
    for subdir in subdirs:
        (vm_dir / subdir).mkdir(parents=True, exist_ok=True)

    print(f"{Colors.GREEN}\u2705 Created VM directories:{Colors.NC}")
    print(f"   {vm_dir}/kernel  - Kernel and initramfs")
    print(f"   {vm_dir}/rootfs  - Root filesystem builds")
    print(f"   {vm_dir}/disk    - VM disk images")
    print(f"   {vm_dir}/logs    - VM console and error logs")
    print()


def check_disk_space() -> None:
    """Check available disk space."""
    home = Path.home()
    available_gb = get_available_disk_space_gb(home)
    print(f"Available disk space: {available_gb}GB")

    if available_gb < 5:
        print(f"{Colors.YELLOW}\u26a0\ufe0f  Warning: Less than 5GB available{Colors.NC}")
        print("Recommended: At least 10GB free space")

    print()


def print_summary(vm_dir: Path) -> None:
    """Print setup summary."""
    print("=== Setup Complete ===")
    print()
    print("\u2705 vfkit installed and verified")
    print(f"\u2705 VM directories created at: {vm_dir}")
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
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"

    print("=== vfkit Setup for Alpine ARM64 ===")
    print()

    # Check platform requirements
    if not check_macos():
        return 1

    if not check_apple_silicon():
        return 1

    # Check Homebrew
    if not check_homebrew():
        return 1

    # Install/verify vfkit
    if not install_vfkit():
        return 1

    print()

    # Verify vfkit works
    if not verify_vfkit():
        return 1

    print()

    # Create directories
    create_vm_directories(vm_dir)

    # Check disk space
    check_disk_space()

    # Print summary
    print_summary(vm_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
