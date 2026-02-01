#!/usr/bin/env python3
"""
Boot All VMs - VM Operations

Converts boot-all-vms.sh to Python with proper error handling and testability.
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import sys
import time
from pathlib import Path
from typing import Optional


# VM configurations
EXPECTED_VMS = [
    ("vibecode-postgresql", "PostgreSQL database"),
    ("vibecode-valkey", "Valkey cache"),
    ("vibecode-nodejs", "Node.js runtime"),
    ("vibecode-nodejs-codeserver", "OpenVSCode server [AUTO-START]"),
    ("vibecode-ide", "IDE environment"),
    ("vibecode-pgvector", "PostgreSQL with pgvector"),
]


def get_script_dir() -> Path:
    """Get the directory containing this script."""
    return Path(__file__).parent.resolve()


def get_project_root() -> Path:
    """Get the project root directory."""
    return get_script_dir().parent


def is_app_running() -> bool:
    """Check if VibeCode app is running."""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "VibeCode.*MacOS"],
            capture_output=True,
        )
        return result.returncode == 0
    except Exception:
        return False


def launch_app() -> bool:
    """Launch the VibeCode app."""
    script_dir = get_script_dir()
    launch_script = script_dir / "launch-vibecode.sh"

    if not launch_script.exists():
        print(f"  Launch script not found: {launch_script}")
        return False

    try:
        subprocess.Popen(
            [str(launch_script)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception as e:
        print(f"  Failed to launch app: {e}")
        return False


def count_booted_vms(log_file: Path) -> int:
    """Count VMs that have booted successfully."""
    if not log_file.exists():
        return 0

    try:
        with open(log_file, "r") as f:
            content = f.read()
        return content.count("VM started successfully")
    except Exception:
        return 0


def get_booted_vm_lines(log_file: Path, limit: int = 5) -> list[str]:
    """Get recent VM boot success lines."""
    if not log_file.exists():
        return []

    try:
        with open(log_file, "r") as f:
            lines = f.readlines()

        boot_lines = [
            line.strip()
            for line in lines
            if "VM started successfully" in line
        ]
        return boot_lines[-limit:]
    except Exception:
        return []


def check_vm_network() -> list[str]:
    """Check for VMs on the network."""
    try:
        result = subprocess.run(
            ["arp", "-a"],
            capture_output=True,
            text=True,
        )

        vm_entries = [
            line.strip()
            for line in result.stdout.splitlines()
            if "192.168.64" in line
        ]
        return vm_entries
    except Exception:
        return []


def print_vm_list() -> None:
    """Print the expected VM list."""
    print("\nExpected VMs:")
    for i, (name, description) in enumerate(EXPECTED_VMS, 1):
        print(f"  {i}. {name} ({description})")


def print_manual_instructions(project_root: Path) -> None:
    """Print manual start instructions."""
    print("\nTo manually start remaining VMs:")
    print("  1. Open VibeCode app GUI")
    print("  2. Click each VM in sidebar")
    print("  3. Click 'Start VM' button")
    print("\nOr wait for programmatic start implementation")
    print(f"\nMonitor boot progress with:")
    print(f"  tail -f {project_root}/logs/vibecode.log")


def main(auto_start_wait: int = 20) -> int:
    """
    Main entry point.

    Args:
        auto_start_wait: Seconds to wait for auto-start (default 20)

    Returns:
        Exit code (0 for success)
    """
    script_dir = get_script_dir()
    project_root = get_project_root()
    log_file = project_root / "logs" / "vibecode.log"

    print("==================================")
    print("Boot All VMs - Agent 2 Task")
    print("==================================")
    print()

    # Ensure app is running
    if not is_app_running():
        print("App not running, launching...")
        if not launch_app():
            print("Failed to launch app")
            return 1
        time.sleep(10)

    print("App running, VMs discovered")
    print()

    # Wait for auto-start
    print(f"Waiting for auto-start (codeserver VM)... ({auto_start_wait}s)")
    time.sleep(auto_start_wait)

    # Check boot status
    print()
    print("Checking VM boot status...")
    booted = count_booted_vms(log_file)
    print(f"VMs booted so far: {booted}/{len(EXPECTED_VMS)}")

    if booted > 0:
        print()
        print("Successfully booted VMs:")
        for line in get_booted_vm_lines(log_file):
            print(f"  {line}")

    print()
    print("==================================")
    print("VM List Status:")
    print("==================================")

    print_vm_list()

    print_manual_instructions(project_root)

    # Check network
    print()
    print("Checking for VM network activity...")
    vm_entries = check_vm_network()

    if vm_entries:
        print("VMs detected on network:")
        for entry in vm_entries:
            print(f"  {entry}")
    else:
        print("No VMs detected yet (they may still be booting)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
