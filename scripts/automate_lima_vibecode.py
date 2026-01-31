#!/usr/bin/env python3
"""Automates Lima VM provisioning and Vibecode smoke tests.

This script manages a Lima VM for development and testing:
- Starts or creates the Lima VM
- Syncs project files to the VM
- Installs dependencies
- Runs lint and type-check
- Lists Playwright test suites
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


DEFAULT_VM_NAME = "vibecode-dev"
DEFAULT_CONFIG_PATH = "infrastructure/lima/vibecode-dev.yaml"
WORKSPACE_PATH = "/workspace/vibecode"

EXCLUDES = ["node_modules", ".git", ".next", "dist", "build"]


def check_limactl() -> bool:
    """Check if limactl is available."""
    return shutil.which("limactl") is not None


def check_rsync() -> bool:
    """Check if rsync is available."""
    return shutil.which("rsync") is not None


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return result."""
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def vm_exists(vm_name: str) -> bool:
    """Check if a Lima VM exists."""
    result = run_cmd(["limactl", "list", "--format", "{{.Name}}"], check=False)
    return vm_name in result.stdout.split()


def vm_running(vm_name: str) -> bool:
    """Check if a Lima VM is running."""
    result = run_cmd(["limactl", "list", "--format", "{{.Name}} {{.Status}}"], check=False)
    for line in result.stdout.strip().split("\n"):
        parts = line.split()
        if len(parts) >= 2 and parts[0] == vm_name:
            return parts[1] == "Running"
    return False


def start_vm(vm_name: str, config_path: Path) -> bool:
    """Start or create the Lima VM."""
    print(f"=== Starting Lima VM ({vm_name}) ===")

    if not vm_exists(vm_name):
        print(f"Creating new VM from {config_path}...")
        result = run_cmd(
            ["limactl", "start", str(config_path), "--name", vm_name],
            check=False,
        )
        if result.returncode != 0:
            print(f"Error creating VM: {result.stderr}")
            return False
    elif not vm_running(vm_name):
        print(f"Starting existing VM {vm_name}...")
        result = run_cmd(["limactl", "start", vm_name], check=False)
        if result.returncode != 0:
            print(f"Warning: {result.stderr}")
    else:
        print(f"VM {vm_name} is already running")

    return True


def lima_shell(vm_name: str, command: str, sudo: bool = False) -> subprocess.CompletedProcess:
    """Run a command in the Lima VM shell."""
    if sudo:
        cmd = ["limactl", "shell", vm_name, "sudo", "bash", "-c", command]
    else:
        cmd = ["limactl", "shell", vm_name, "bash", "-lc", command]
    return run_cmd(cmd, check=False)


def sync_files(vm_name: str, source_dir: Path) -> bool:
    """Sync project files to the VM."""
    print("=== Syncing project files ===")

    # Create workspace directory
    lima_shell(vm_name, "mkdir -p /workspace", sudo=True)
    lima_shell(vm_name, "chown -R $(whoami):$(whoami) /workspace", sudo=True)
    lima_shell(vm_name, f"mkdir -p {WORKSPACE_PATH}")

    # Build rsync command with excludes
    rsync_cmd = ["rsync", "-az", "--delete"]
    for exclude in EXCLUDES:
        rsync_cmd.extend(["--exclude", exclude])
    rsync_cmd.extend([f"{source_dir}/", f"{vm_name}:{WORKSPACE_PATH}"])

    result = run_cmd(rsync_cmd, check=False)
    if result.returncode != 0:
        print(f"Error syncing files: {result.stderr}")
        return False

    print("Files synced successfully")
    return True


def install_dependencies(vm_name: str) -> bool:
    """Install npm dependencies inside the VM."""
    print("=== Installing dependencies inside VM ===")

    result = lima_shell(vm_name, f"cd {WORKSPACE_PATH} && npm install")
    if result.returncode != 0:
        print(f"Error installing dependencies: {result.stderr}")
        return False

    print("Dependencies installed")
    return True


def run_checks(vm_name: str) -> bool:
    """Run lint and type-check inside the VM."""
    print("=== Running lint + type-check inside VM ===")

    result = lima_shell(vm_name, f"cd {WORKSPACE_PATH} && npm run check")
    if result.returncode != 0:
        print(f"Checks failed: {result.stderr}")
        print(result.stdout)
        return False

    print("Checks passed")
    return True


def list_playwright_tests(vm_name: str) -> bool:
    """List Playwright test suites inside the VM."""
    print("=== Listing Playwright suites inside VM ===")

    result = lima_shell(vm_name, f"cd {WORKSPACE_PATH} && npx playwright test --list")
    if result.returncode != 0:
        print(f"Error listing tests: {result.stderr}")
        return False

    print(result.stdout)
    return True


def stop_vm(vm_name: str) -> bool:
    """Stop the Lima VM."""
    print(f"=== Stopping Lima VM ({vm_name}) ===")

    result = run_cmd(["limactl", "stop", vm_name], check=False)
    if result.returncode != 0:
        print(f"Error stopping VM: {result.stderr}")
        return False

    print("VM stopped")
    return True


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--vm-name",
        default=DEFAULT_VM_NAME,
        help=f"Lima VM name (default: {DEFAULT_VM_NAME})",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(DEFAULT_CONFIG_PATH),
        help=f"Lima config path (default: {DEFAULT_CONFIG_PATH})",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path.cwd(),
        help="Source directory to sync (default: current directory)",
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Skip npm install step",
    )
    parser.add_argument(
        "--skip-checks",
        action="store_true",
        help="Skip lint and type-check step",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip listing Playwright tests",
    )
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop the VM after running",
    )

    args = parser.parse_args(argv)

    # Check prerequisites
    if not check_limactl():
        print("Error: limactl not found. Install Lima: https://github.com/lima-vm/lima", file=sys.stderr)
        return 1

    if not check_rsync():
        print("Error: rsync not found", file=sys.stderr)
        return 1

    config_path = args.config.resolve()
    if not config_path.exists():
        print(f"Error: Lima config missing: {config_path}", file=sys.stderr)
        return 1

    source_dir = args.source_dir.resolve()
    if not source_dir.is_dir():
        print(f"Error: Source directory not found: {source_dir}", file=sys.stderr)
        return 1

    # Run automation steps
    if not start_vm(args.vm_name, config_path):
        return 1

    if not sync_files(args.vm_name, source_dir):
        return 1

    if not args.skip_install:
        if not install_dependencies(args.vm_name):
            return 1

    if not args.skip_checks:
        if not run_checks(args.vm_name):
            return 1

    if not args.skip_tests:
        if not list_playwright_tests(args.vm_name):
            return 1

    if args.stop:
        if not stop_vm(args.vm_name):
            return 1

    print("=== Lima automation complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
