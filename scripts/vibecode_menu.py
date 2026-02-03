#!/usr/bin/env python3
"""VibeCode Development Menu.

Quick access to common operations.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    cyan: str = "\033[0;36m"
    bold: str = "\033[1m"
    reset: str = "\033[0m"


COLORS = Colors()


def get_paths() -> tuple[Path, Path]:
    """Get script directory and project root paths."""
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    return script_dir, project_root


def clear_screen() -> None:
    """Clear the terminal screen."""
    os.system("clear" if os.name != "nt" else "cls")


def print_status(message: str) -> None:
    """Print a status message."""
    print(f"{COLORS.blue}[*]{COLORS.reset} {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{COLORS.green}[✓]{COLORS.reset} {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{COLORS.red}[✗]{COLORS.reset} {message}")


def run_script(script_name: str, *, with_datadog: bool = False) -> None:
    """Run a shell script from the scripts directory.

    Args:
        script_name: Name of the script to run
        with_datadog: If True, wrap with run-with-secure-datadog-key.sh
    """
    script_dir, _ = get_paths()
    script_path = script_dir / script_name

    if not script_path.exists():
        print_error(f"Script not found: {script_path}")
        return

    try:
        if with_datadog:
            wrapper = script_dir / "run-with-secure-datadog-key.sh"
            subprocess.run([str(wrapper), str(script_path)], check=True)
        else:
            subprocess.run([str(script_path)], check=True)
    except subprocess.CalledProcessError as e:
        print_error(f"Script failed with exit code {e.returncode}")
    except FileNotFoundError:
        print_error(f"Could not execute: {script_path}")


def show_menu() -> None:
    """Display the main menu."""
    clear_screen()
    menu = """\
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                   VibeCode Dev Menu                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Development:
  1) Build and launch VibeCode
  2) Run Swift tests
  3) Run integration tests
  4) Clean build artifacts

VM Operations:
  5) Build VZ VMs (parallel)
  6) Build VZ VMs (sequential)
  7) Check VM status
  8) List Lima VMs

Testing:
  9) Run full test suite
  10) Run regression tests
  11) Run functional tests (VM launch)
  12) Run GUI tests (entitlements)
  13) Run service tests (connectivity)
  14) Run E2E with Datadog

Datadog:
  15) Test Datadog integration
  16) Start Lima VMs with Datadog

Utilities:
  17) View logs
  18) Check system requirements
  19) Git status

  0) Exit
"""
    print(menu)


def build_and_launch() -> None:
    """Build and launch VibeCode."""
    print_status("Building and launching VibeCode...")
    run_script("launch-vibecode.sh")


def run_swift_tests() -> None:
    """Run Swift unit tests."""
    print_status("Running Swift unit tests...")
    _, project_root = get_paths()
    swift_dir = project_root / "VibeCodeSwift"

    try:
        subprocess.run(["swift", "test"], cwd=swift_dir, check=True)
    except subprocess.CalledProcessError as e:
        print_error(f"Swift tests failed with exit code {e.returncode}")
    except FileNotFoundError:
        print_error("Swift not found. Please install Xcode command line tools.")


def run_integration_tests() -> None:
    """Run integration tests."""
    print_status("Running integration tests...")
    run_script("test-vibecode-vms.sh")


def clean_build() -> None:
    """Clean build artifacts."""
    print_status("Cleaning build artifacts...")
    _, project_root = get_paths()
    swift_dir = project_root / "VibeCodeSwift"

    try:
        subprocess.run(["swift", "package", "clean"], cwd=swift_dir, check=True)
        build_dir = swift_dir / ".build"
        if build_dir.exists():
            shutil.rmtree(build_dir)
        print_success("Clean complete")
    except subprocess.CalledProcessError as e:
        print_error(f"Clean failed with exit code {e.returncode}")
    except FileNotFoundError:
        print_error("Swift not found. Please install Xcode command line tools.")


def build_vms_parallel() -> None:
    """Build VMs in parallel."""
    print_status("Building VMs in parallel...")
    run_script("build-vz-vms-parallel.sh", with_datadog=True)


def build_vms_sequential() -> None:
    """Build VMs sequentially."""
    print_status("Sequential build not yet implemented")


def check_vm_status() -> None:
    """Check VM image status."""
    _, project_root = get_paths()
    vm_images_dir = project_root / "dist" / "vm-images"

    print("VM Image Status:")
    print("================")

    # List .img files
    img_files = list(vm_images_dir.glob("*.img")) if vm_images_dir.exists() else []
    if img_files:
        for img in sorted(img_files):
            size = img.stat().st_size
            size_str = format_size(size)
            print(f"  {img.name}: {size_str}")
    else:
        print("  No VMs found")

    print()
    print("EFI NVRAM Files:")

    # List NVRAM files
    nvram_files = list(vm_images_dir.glob("*-efi.nvram")) if vm_images_dir.exists() else []
    if nvram_files:
        for nvram in sorted(nvram_files):
            size = nvram.stat().st_size
            size_str = format_size(size)
            print(f"  {nvram.name}: {size_str}")
    else:
        print("  No NVRAM files found")


def format_size(size: int) -> str:
    """Format file size in human-readable form."""
    for unit in ["B", "K", "M", "G", "T"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}P"


def list_lima_vms() -> None:
    """List Lima VMs."""
    print("Lima VMs:")
    try:
        subprocess.run(["limactl", "list"], check=True)
    except subprocess.CalledProcessError:
        print_error("Failed to list Lima VMs")
    except FileNotFoundError:
        print_error("limactl not found. Is Lima installed?")


def run_full_tests() -> None:
    """Run the full test suite."""
    print_status("Running full test suite...")
    scripts = [
        "regression-tests.sh",
        "test-vibecode-vms.sh",
        "functional-tests.sh",
        "test-gui.sh",
        "service-tests.sh",
        "test-e2e-with-datadog.sh",
    ]
    for script in scripts:
        run_script(script)
        print()
    print_success("Full test suite complete")


def view_logs() -> None:
    """View recent logs."""
    _, project_root = get_paths()
    log_file = project_root / "logs" / "vibecode.log"

    print("Recent logs:")
    if log_file.exists():
        try:
            with log_file.open() as f:
                lines = f.readlines()
                for line in lines[-50:]:
                    print(line, end="")
        except OSError as e:
            print_error(f"Failed to read logs: {e}")
    else:
        print("No logs found")


def check_requirements() -> None:
    """Check system requirements."""
    _, project_root = get_paths()

    print("System Requirements Check:")
    print("=========================")

    # macOS version
    try:
        result = subprocess.run(
            ["sw_vers", "-productVersion"],
            capture_output=True,
            text=True,
        )
        print(f"macOS version: {result.stdout.strip()}")
    except FileNotFoundError:
        print("macOS version: Unknown (not macOS?)")

    # Swift version
    try:
        result = subprocess.run(
            ["swift", "--version"],
            capture_output=True,
            text=True,
        )
        first_line = result.stdout.strip().split("\n")[0]
        print(f"Swift version: {first_line}")
    except FileNotFoundError:
        print("Swift version: Not installed")

    # Xcode version
    try:
        result = subprocess.run(
            ["xcodebuild", "-version"],
            capture_output=True,
            text=True,
        )
        first_line = result.stdout.strip().split("\n")[0]
        print(f"Xcode version: {first_line}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("Xcode version: Not installed")

    print()

    # Disk space for VMs
    vm_images_dir = project_root / "dist" / "vm-images"
    print("Disk space in dist/vm-images:")
    if vm_images_dir.exists():
        total_size = sum(f.stat().st_size for f in vm_images_dir.rglob("*") if f.is_file())
        print(f"  {format_size(total_size)}")
    else:
        print("  No VMs found")

    print()

    # Available disk space
    print("Available disk space:")
    try:
        result = subprocess.run(
            ["df", "-h", str(project_root)],
            capture_output=True,
            text=True,
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) > 1:
            print(f"  {lines[-1]}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("  Unknown")


def git_status() -> None:
    """Show git status."""
    _, project_root = get_paths()

    print("Git Status:")
    try:
        subprocess.run(
            ["git", "status", "--short"],
            cwd=project_root,
            check=True,
        )
    except subprocess.CalledProcessError:
        print_error("Failed to get git status")

    print()
    print("Current branch:")
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=project_root,
            capture_output=True,
            text=True,
            check=True,
        )
        print(f"  {result.stdout.strip()}")
    except subprocess.CalledProcessError:
        print_error("Failed to get current branch")


def test_datadog() -> None:
    """Test Datadog integration."""
    print_status("Testing Datadog integration...")
    run_script("test-parallel-datadog.sh", with_datadog=True)


def wait_for_enter() -> None:
    """Wait for user to press Enter."""
    print()
    try:
        input("Press Enter to continue...")
    except EOFError:
        pass


def get_menu_actions() -> dict[str, Callable[[], None]]:
    """Get mapping of menu choices to actions."""
    script_dir, _ = get_paths()

    return {
        "1": build_and_launch,
        "2": run_swift_tests,
        "3": run_integration_tests,
        "4": clean_build,
        "5": build_vms_parallel,
        "6": build_vms_sequential,
        "7": check_vm_status,
        "8": list_lima_vms,
        "9": run_full_tests,
        "10": lambda: run_script("regression-tests.sh"),
        "11": lambda: run_script("functional-tests.sh"),
        "12": lambda: run_script("test-gui.sh"),
        "13": lambda: run_script("service-tests.sh"),
        "14": lambda: run_script("test-e2e-with-datadog.sh"),
        "15": lambda: run_script("test-all-datadog-solutions.sh"),
        "16": lambda: run_script("start-lima-vms-with-datadog.sh"),
        "17": view_logs,
        "18": check_requirements,
        "19": git_status,
    }


def main() -> int:
    """Main entry point."""
    actions = get_menu_actions()

    while True:
        show_menu()
        try:
            choice = input("Select option: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting...")
            return 0

        if choice == "0":
            print("Exiting...")
            return 0

        action = actions.get(choice)
        if action:
            action()
        else:
            print_error("Invalid option")

        wait_for_enter()

    return 0


if __name__ == "__main__":
    sys.exit(main())
