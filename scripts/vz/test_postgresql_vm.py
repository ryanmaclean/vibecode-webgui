#!/usr/bin/env python3
"""Test script for PostgreSQL VM using Virtualization framework."""

from __future__ import annotations

import os
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
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()


def print_status(message: str) -> None:
    """Print blue status message."""
    print(f"{COLORS.blue}[*]{COLORS.reset} {message}")


def print_success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}[\u2713]{COLORS.reset} {message}")


def print_error(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}[\u2717]{COLORS.reset} {message}")


def print_warning(message: str) -> None:
    """Print yellow warning message."""
    print(f"{COLORS.yellow}[!]{COLORS.reset} {message}")


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "K", "M", "G", "T"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}P"


def check_prerequisites(vm_dir: Path) -> bool:
    """Check that all required files exist.

    Returns True if all prerequisites are met, False otherwise.
    """
    print_status("Checking prerequisites...")

    root_disk = vm_dir / "disk" / "root.qcow2"
    if not root_disk.exists():
        print_error(f"Root disk not found: {root_disk}")
        return False
    print_success(f"Root disk found ({get_file_size_human(root_disk)})")

    data_disk = vm_dir / "disk" / "data.qcow2"
    if not data_disk.exists():
        print_error(f"Data disk not found: {data_disk}")
        return False
    print_success(f"Data disk found ({get_file_size_human(data_disk)})")

    kernel = vm_dir / "kernel" / "vmlinuz"
    if not kernel.exists():
        print_error(f"Kernel not found: {kernel}")
        return False
    print_success("Kernel found")

    initramfs = vm_dir / "kernel" / "initramfs"
    if not initramfs.exists():
        print_error(f"Initramfs not found: {initramfs}")
        return False
    print_success("Initramfs found")

    return True


def build_vm(package_dir: Path) -> bool:
    """Build the PostgreSQL VM executable.

    Returns True if build succeeds, False otherwise.
    """
    print_status("Building PostgreSQL VM...")

    try:
        result = subprocess.run(
            ["swift", "build", "--configuration", "release"],
            cwd=package_dir,
            check=True,
            capture_output=True,
            text=True,
        )
        print_success("Build successful")
        return True
    except subprocess.CalledProcessError as e:
        print_error("Build failed")
        if e.stderr:
            print(e.stderr)
        return False
    except FileNotFoundError:
        print_error("Swift not found. Please install Xcode command line tools.")
        return False


def check_lima_status() -> bool:
    """Check if Lima PostgreSQL VM is running.

    Returns True if safe to continue, False if user aborts.
    """
    print_status("Checking Lima PostgreSQL VM status...")

    try:
        result = subprocess.run(
            ["limactl", "list"],
            capture_output=True,
            text=True,
        )
        if "vibecode-pgvector" in result.stdout and "Running" in result.stdout:
            print_warning("Lima PostgreSQL VM is running. You may want to stop it to avoid port conflicts.")
            print("           Run: limactl stop vibecode-pgvector")
            print()

            try:
                response = input("Continue anyway? (y/N) ").strip().lower()
            except EOFError:
                response = ""

            if response not in ("y", "yes"):
                return False
        else:
            print_success("Lima PostgreSQL VM is not running (no port conflicts)")
    except FileNotFoundError:
        print_success("Lima not installed (no port conflicts)")

    return True


def show_vm_info(vm_dir: Path, package_dir: Path) -> None:
    """Display VM configuration information."""
    print_status("VM Configuration:")
    print(f"           VM Path: {vm_dir}")
    print(f"           Package: {package_dir}")
    print(f"           Binary: {package_dir}/.build/release/postgresql-vm")


def show_instructions(package_dir: Path) -> None:
    """Display instructions for running the VM."""
    print_status("To start the PostgreSQL VM, run:")
    print()
    print(f"   cd {package_dir}")
    print("   swift run postgresql-vm")
    print()
    print("Or use the release binary:")
    print()
    print(f"   {package_dir}/.build/release/postgresql-vm")
    print()

    print_status("To test PostgreSQL connection once VM is running:")
    print()
    print("   # Check if port 5432 is listening")
    print("   nc -zv 127.0.0.1 5432")
    print()
    print("   # Connect to PostgreSQL")
    print('   psql -h 127.0.0.1 -U vibecode -d vibecode -c "SELECT version();"')
    print()
    print("   # Test pgvector extension")
    print("   psql -h 127.0.0.1 -U vibecode -d vibecode -c \"SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';\"")
    print()


def prompt_start_vm(package_dir: Path) -> None:
    """Prompt user to start the VM."""
    print()
    try:
        response = input("Do you want to start the PostgreSQL VM now? (y/N) ").strip().lower()
    except EOFError:
        response = ""

    if response in ("y", "yes"):
        print_status("Starting PostgreSQL VM...")
        print()
        binary = package_dir / ".build" / "release" / "postgresql-vm"
        os.execv(str(binary), [str(binary)])
    else:
        print_success("Test preparation complete. VM ready to start.")


def main() -> int:
    """Main entry point."""
    print("========================================================")
    print("PostgreSQL VM Test Suite")
    print("========================================================")
    print()

    # Determine paths
    script_dir = Path(__file__).resolve().parent
    vm_dir = Path.home() / ".vfkit" / "vms" / "postgresql-vz"
    package_dir = (script_dir / ".." / ".." / "platforms" / "macos" / "postgresql-vm").resolve()

    # Step 1: Check prerequisites
    if not check_prerequisites(vm_dir):
        return 1
    print()

    # Step 2: Build the VM
    if not build_vm(package_dir):
        return 1
    print()

    # Step 3: Check Lima status
    if not check_lima_status():
        return 1
    print()

    # Step 4: Show VM information
    show_vm_info(vm_dir, package_dir)
    print()

    # Step 5: Show instructions
    show_instructions(package_dir)

    # Step 6: Offer to start the VM
    prompt_start_vm(package_dir)

    print()
    print("========================================================")
    print_success("PostgreSQL VM test suite completed")
    print("========================================================")

    return 0


if __name__ == "__main__":
    sys.exit(main())
