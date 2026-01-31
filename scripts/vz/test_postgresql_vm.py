#!/usr/bin/env python3
"""Test script for PostgreSQL VM using Virtualization framework."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"  # No Color


@dataclass
class VMConfig:
    """PostgreSQL VM configuration."""

    vm_dir: Path
    package_dir: Path


def get_default_config() -> VMConfig:
    """Get default VM configuration."""
    home = Path.home()
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent

    return VMConfig(
        vm_dir=home / ".vfkit" / "vms" / "postgresql-vz",
        package_dir=project_root / "platforms" / "macos" / "postgresql-vm",
    )


def print_status(msg: str) -> None:
    """Print status message in blue."""
    print(f"{BLUE}[*]{NC} {msg}")


def print_success(msg: str) -> None:
    """Print success message in green."""
    print(f"{GREEN}[ok]{NC} {msg}")


def print_error(msg: str) -> None:
    """Print error message in red."""
    print(f"{RED}[x]{NC} {msg}")


def print_warning(msg: str) -> None:
    """Print warning message in yellow."""
    print(f"{YELLOW}[!]{NC} {msg}")


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def check_disk_file(path: Path, name: str) -> bool:
    """Check if a disk file exists.

    Returns:
        True if exists, False otherwise.
    """
    if not path.exists():
        print_error(f"{name} not found: {path}")
        return False
    size = get_file_size_human(path)
    print_success(f"{name} found ({size})")
    return True


def check_file_exists(path: Path, name: str) -> bool:
    """Check if a file exists.

    Returns:
        True if exists, False otherwise.
    """
    if not path.exists():
        print_error(f"{name} not found: {path}")
        return False
    print_success(f"{name} found")
    return True


def check_prerequisites(config: VMConfig) -> bool:
    """Check all prerequisites for running the PostgreSQL VM.

    Returns:
        True if all prerequisites are met, False otherwise.
    """
    print_status("Checking prerequisites...")

    checks = [
        (config.vm_dir / "disk" / "root.qcow2", "Root disk"),
        (config.vm_dir / "disk" / "data.qcow2", "Data disk"),
    ]

    for path, name in checks:
        if not check_disk_file(path, name):
            return False

    kernel_checks = [
        (config.vm_dir / "kernel" / "vmlinuz", "Kernel"),
        (config.vm_dir / "kernel" / "initramfs", "Initramfs"),
    ]

    for path, name in kernel_checks:
        if not check_file_exists(path, name):
            return False

    return True


def build_postgresql_vm(config: VMConfig) -> bool:
    """Build the PostgreSQL VM executable.

    Returns:
        True if build successful, False otherwise.
    """
    print_status("Building PostgreSQL VM...")

    try:
        result = subprocess.run(
            ["swift", "build", "--configuration", "release"],
            cwd=config.package_dir,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
        if result.returncode == 0:
            print_success("Build successful")
            return True
        else:
            print_error("Build failed")
            if result.stderr:
                print(result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print_error("Build timed out")
        return False
    except FileNotFoundError:
        print_error("swift command not found")
        return False


def check_lima_postgresql_running() -> bool:
    """Check if Lima PostgreSQL VM is running.

    Returns:
        True if running (potential port conflict), False otherwise.
    """
    print_status("Checking Lima PostgreSQL VM status...")

    if not shutil.which("limactl"):
        print_success("limactl not found (no Lima VMs)")
        return False

    try:
        result = subprocess.run(
            ["limactl", "list"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if "vibecode-pgvector" in result.stdout and "Running" in result.stdout:
            print_warning("Lima PostgreSQL VM is running. You may want to stop it to avoid port conflicts.")
            print("           Run: limactl stop vibecode-pgvector")
            return True
        else:
            print_success("Lima PostgreSQL VM is not running (no port conflicts)")
            return False
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        print_success("Could not check Lima status")
        return False


def prompt_continue() -> bool:
    """Prompt user to continue.

    Returns:
        True if user wants to continue, False otherwise.
    """
    try:
        response = input("Continue anyway? (y/N) ")
        return response.lower() == "y"
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def prompt_start_vm() -> bool:
    """Prompt user to start the VM.

    Returns:
        True if user wants to start VM, False otherwise.
    """
    try:
        print()
        response = input("Do you want to start the PostgreSQL VM now? (y/N) ")
        return response.lower() == "y"
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def show_vm_info(config: VMConfig) -> None:
    """Display VM configuration information."""
    print_status("VM Configuration:")
    print(f"           VM Path: {config.vm_dir}")
    print(f"           Package: {config.package_dir}")
    print(f"           Binary: {config.package_dir / '.build' / 'release' / 'postgresql-vm'}")


def show_instructions(config: VMConfig) -> None:
    """Display instructions for running the VM."""
    print_status("To start the PostgreSQL VM, run:")
    print()
    print(f"   cd {config.package_dir}")
    print("   swift run postgresql-vm")
    print()
    print("Or use the release binary:")
    print()
    print(f"   {config.package_dir / '.build' / 'release' / 'postgresql-vm'}")
    print()

    print_status("To test PostgreSQL connection once VM is running:")
    print()
    print("   # Check if port 5432 is listening")
    print("   nc -zv 127.0.0.1 5432")
    print()
    print('   # Connect to PostgreSQL')
    print('   psql -h 127.0.0.1 -U vibecode -d vibecode -c "SELECT version();"')
    print()
    print("   # Test pgvector extension")
    print('   psql -h 127.0.0.1 -U vibecode -d vibecode -c "SELECT extname, extversion FROM pg_extension WHERE extname = \'vector\';"')
    print()


def start_vm(config: VMConfig) -> int:
    """Start the PostgreSQL VM.

    Returns:
        Exit code from VM process.
    """
    print_status("Starting PostgreSQL VM...")
    print()

    binary = config.package_dir / ".build" / "release" / "postgresql-vm"
    try:
        os.execv(str(binary), [str(binary)])
    except OSError as e:
        print_error(f"Failed to start VM: {e}")
        return 1
    return 0


def run_test_suite(
    config: Optional[VMConfig] = None,
    interactive: bool = True,
) -> int:
    """Run the PostgreSQL VM test suite.

    Args:
        config: VM configuration (uses defaults if None)
        interactive: Whether to prompt for user input

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = get_default_config()

    print("=" * 56)
    print("PostgreSQL VM Test Suite")
    print("=" * 56)
    print()

    # Step 1: Check prerequisites
    if not check_prerequisites(config):
        return 1
    print()

    # Step 2: Build PostgreSQL VM
    if not build_postgresql_vm(config):
        return 1
    print()

    # Step 3: Check Lima VM
    if check_lima_postgresql_running() and interactive:
        print()
        if not prompt_continue():
            return 1
    print()

    # Step 4: Show VM info
    show_vm_info(config)
    print()

    # Step 5: Show instructions
    show_instructions(config)

    # Step 6: Offer to start VM
    if interactive and prompt_start_vm():
        return start_vm(config)
    else:
        print_success("Test preparation complete. VM ready to start.")

    print()
    print("=" * 56)
    print_success("PostgreSQL VM test suite completed")
    print("=" * 56)

    return 0


def main() -> int:
    """Main entry point."""
    return run_test_suite()


if __name__ == "__main__":
    sys.exit(main())
