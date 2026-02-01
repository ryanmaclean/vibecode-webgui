#!/usr/bin/env python3
"""Command-line tool to manage VirtualBuddy VMs with vfkit.

Launch VirtualBuddy VMs from the command line using vfkit.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


VB_VMS_DIR = Path.home() / "Library" / "Application Support" / "VirtualBuddy"
PID_DIR = Path("/tmp")
BACKUP_DIR = Path("/Volumes/tank3/vm-backups")


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def get_pid_file(vm_name: str) -> Path:
    """Get the PID file path for a VM."""
    return PID_DIR / f"vm-{vm_name}.pid"


def is_vm_running(vm_name: str) -> tuple[bool, int | None]:
    """Check if a VM is running.

    Returns:
        Tuple of (is_running, pid).
    """
    pid_file = get_pid_file(vm_name)
    if not pid_file.exists():
        return False, None

    try:
        pid = int(pid_file.read_text().strip())
        result = run_cmd(["ps", "-p", str(pid)])
        if result.returncode == 0:
            return True, pid
    except (ValueError, OSError):
        pass

    # Clean up stale PID file
    pid_file.unlink(missing_ok=True)
    return False, None


def list_vms() -> int:
    """List all VirtualBuddy VMs."""
    print("VirtualBuddy VMs:")
    print()

    vm_count = 0
    if not VB_VMS_DIR.exists():
        print(f"  VirtualBuddy directory not found: {VB_VMS_DIR}")
        return 1

    for vm_path in VB_VMS_DIR.glob("*.vbvm"):
        if vm_path.is_dir():
            vm_name = vm_path.stem

            # Get size
            result = run_cmd(["du", "-sh", str(vm_path)])
            size = result.stdout.split()[0] if result.returncode == 0 else "?"

            # Check status
            running, pid = is_vm_running(vm_name)
            status = f" (running, PID: {pid})" if running else ""

            print(f"  - {vm_name} ({size}){status}")
            vm_count += 1

    print()
    print(f"Total: {vm_count} VM(s)")
    return 0


def start_vm(vm_name: str) -> int:
    """Start a VM with vfkit."""
    vm_path = VB_VMS_DIR / f"{vm_name}.vbvm"

    if not vm_path.exists():
        print(f"[X] VM not found: {vm_name}")
        return 1

    print(f"Starting VM: {vm_name}")

    # Check required files
    disk = vm_path / "Disk.img"
    hw = vm_path / "HardwareModel"
    mid = vm_path / "MachineIdentifier"
    aux = vm_path / "AuxiliaryStorage"

    for required_file in [disk, hw, mid, aux]:
        if not required_file.exists():
            print(f"[X] Missing file: {required_file}")
            return 1

    # Check if vfkit is available
    if not shutil.which("vfkit"):
        print("[X] vfkit not found. Install with: brew install vfkit")
        return 1

    # Build vfkit command
    cmd = [
        "vfkit",
        "--cpus", "4",
        "--memory", "8192",
        "--bootloader", f"macos,machineIdentifierPath={mid},hardwareModelPath={hw},auxImagePath={aux}",
        "--device", f"virtio-blk,path={disk}",
        "--device", "virtio-net,nat",
        "--gui",
        "--log-level", "info",
    ]

    print(f"Command: {' '.join(cmd)}")
    print()

    # Start vfkit in background
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Save PID
    pid_file = get_pid_file(vm_name)
    pid_file.write_text(str(proc.pid))

    print(f"[OK] VM started (PID: {proc.pid})")
    print("Check VirtualBuddy GUI for VM window")
    print()
    print(f"To stop: vm-cli.py stop \"{vm_name}\"")

    return 0


def stop_vm(vm_name: str) -> int:
    """Stop a running VM."""
    pid_file = get_pid_file(vm_name)

    if not pid_file.exists():
        print(f"[X] No PID file found for {vm_name}")
        print("   VM may not be running")
        return 1

    try:
        pid = int(pid_file.read_text().strip())
    except (ValueError, OSError):
        print("[X] Invalid PID file")
        pid_file.unlink(missing_ok=True)
        return 1

    # Check if process exists
    result = run_cmd(["ps", "-p", str(pid)])
    if result.returncode != 0:
        print(f"[!] VM not running (stale PID file)")
        pid_file.unlink(missing_ok=True)
        return 0

    print(f"Stopping VM: {vm_name} (PID: {pid})")

    # Try graceful kill
    run_cmd(["kill", str(pid)])
    time.sleep(2)

    # Check if still running
    result = run_cmd(["ps", "-p", str(pid)])
    if result.returncode == 0:
        print("[!] Force stopping...")
        run_cmd(["kill", "-9", str(pid)])

    pid_file.unlink(missing_ok=True)
    print("[OK] VM stopped")
    return 0


def status_vm(vm_name: str) -> int:
    """Check VM status."""
    running, pid = is_vm_running(vm_name)

    if running:
        print(f"[OK] VM is running (PID: {pid})")
    else:
        print("[X] VM is not running")

    return 0 if running else 1


def backup_vm(vm_name: str) -> int:
    """Backup a VM to tank3."""
    vm_path = VB_VMS_DIR / f"{vm_name}.vbvm"

    if not vm_path.exists():
        print(f"[X] VM not found: {vm_name}")
        return 1

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_name = f"{vm_name}-{timestamp}.vbvm"
    backup_path = BACKUP_DIR / backup_name

    print(f"Backing up: {vm_name}")

    # Stop VM if running
    running, _ = is_vm_running(vm_name)
    if running:
        print("[!] Warning: VM is still running. Backup may be inconsistent.")

    # Create backup using ditto (preserves metadata)
    result = run_cmd(["ditto", str(vm_path), str(backup_path)], capture=False)
    if result.returncode != 0:
        print("[X] Backup failed")
        return 1

    # Get backup size
    result = run_cmd(["du", "-sh", str(backup_path)])
    size = result.stdout.split()[0] if result.returncode == 0 else "?"

    print(f"[OK] Backup created: {backup_name} ({size})")
    return 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # List command
    subparsers.add_parser("list", help="List all VirtualBuddy VMs")

    # Start command
    start_parser = subparsers.add_parser("start", help="Start a VM with vfkit")
    start_parser.add_argument("name", help="VM name")

    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop a running VM")
    stop_parser.add_argument("name", help="VM name")

    # Status command
    status_parser = subparsers.add_parser("status", help="Check VM status")
    status_parser.add_argument("name", help="VM name")

    # Backup command
    backup_parser = subparsers.add_parser("backup", help="Backup a VM to tank3")
    backup_parser.add_argument("name", help="VM name")

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        print()
        print("Examples:")
        print("  vm_cli.py list")
        print('  vm_cli.py start "Supporting Anteater"')
        print('  vm_cli.py stop "Supporting Anteater"')
        print('  vm_cli.py status "Supporting Anteater"')
        print('  vm_cli.py backup "Supporting Anteater"')
        return 1

    if args.command == "list":
        return list_vms()
    elif args.command == "start":
        return start_vm(args.name)
    elif args.command == "stop":
        return stop_vm(args.name)
    elif args.command == "status":
        return status_vm(args.name)
    elif args.command == "backup":
        return backup_vm(args.name)

    return 1


if __name__ == "__main__":
    sys.exit(main())
