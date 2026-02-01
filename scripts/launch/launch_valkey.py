#!/usr/bin/env python3
"""
Quick Launch Script for Valkey VM.

Launches a Valkey (Redis-compatible) VM using the VibeCode VM infrastructure.
"""

import argparse
import glob
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'  # No Color


# Default paths
DEFAULT_AZURE_DIR = Path.home() / "vibecode-webgui" / "azure"
DEFAULT_INITRAMFS = "valkey-standalone-v2.cpio.gz"
DEFAULT_NODEJS_INITRAMFS = "nodejs-complete.cpio.gz"
CONSOLE_LOG_PATTERN = "/tmp/vibecode-console-*.log"
VALKEY_PORT = 6379
BOOT_WAIT_SECONDS = 30


def kill_running_vms() -> None:
    """Kill any running VMs."""
    print("Stopping any running VMs...")

    for process_name in ["ValkeyVibeCode", "NodeJS"]:
        subprocess.run(
            ["killall", process_name],
            capture_output=True,
            check=False,
        )

    time.sleep(2)


def clean_console_logs() -> None:
    """Clean old console logs."""
    print("Cleaning old console logs...")

    for log_file in glob.glob(CONSOLE_LOG_PATTERN):
        try:
            os.remove(log_file)
        except OSError:
            pass


def check_initramfs(azure_dir: Path, initramfs_name: str) -> bool:
    """Check if the Valkey initramfs exists."""
    initramfs_path = azure_dir / initramfs_name

    if not initramfs_path.exists():
        print(f"{Colors.RED}ERROR: Valkey initramfs not found!{Colors.NC}")
        print(f"Expected: {initramfs_path}")
        return False

    return True


def swap_initramfs(azure_dir: Path, valkey_initramfs: str, nodejs_initramfs: str) -> None:
    """Swap in the Valkey initramfs for the NodeJS one."""
    nodejs_path = azure_dir / nodejs_initramfs
    valkey_path = azure_dir / valkey_initramfs
    backup_path = azure_dir / "nodejs-backup.cpio.gz"

    # Backup current nodejs initramfs
    if nodejs_path.exists():
        shutil.copy2(nodejs_path, backup_path)

    # Copy Valkey initramfs to nodejs location
    shutil.copy2(valkey_path, nodejs_path)


def launch_vm(azure_dir: Path) -> Optional[int]:
    """
    Launch the VM and return its PID.

    Returns:
        Process ID of the VM, or None if launch failed
    """
    print("Launching Valkey VM...")

    vm_executable = azure_dir / "SwiftUI-Apps" / "NodeJSVibeCode.app" / "Contents" / "MacOS" / "NodeJS"

    if not vm_executable.exists():
        print(f"{Colors.RED}ERROR: VM executable not found: {vm_executable}{Colors.NC}")
        return None

    # Start VM in background
    process = subprocess.Popen(
        [str(vm_executable)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=azure_dir,
    )

    return process.pid


def get_latest_console_log() -> Optional[Path]:
    """Get the most recent console log file."""
    log_files = glob.glob(CONSOLE_LOG_PATTERN)

    if not log_files:
        return None

    # Sort by modification time, newest first
    log_files.sort(key=os.path.getmtime, reverse=True)
    return Path(log_files[0])


def extract_vm_ip(console_log: Path) -> Optional[str]:
    """Extract the VM IP address from the console log."""
    try:
        # Read last 100 lines
        with open(console_log, 'r') as f:
            lines = f.readlines()
            tail_lines = lines[-100:] if len(lines) > 100 else lines

        content = ''.join(tail_lines)

        # Look for IP address pattern after "inet"
        match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', content)
        if match:
            return match.group(1)

    except (OSError, IOError):
        pass

    return None


def tail_log(console_log: Path) -> None:
    """Tail the console log file."""
    print(f"Console log: {console_log}")
    print()
    print("Press Ctrl+C to stop tailing log...")

    try:
        subprocess.run(["tail", "-f", str(console_log)])
    except KeyboardInterrupt:
        print()
        print("Stopped tailing log.")


def print_access_instructions(vm_ip: str) -> None:
    """Print access instructions for the Valkey VM."""
    print(f"{Colors.GREEN}+{Colors.NC} VM booted successfully")
    print()
    print(f"VM IP Address: {vm_ip}")
    print(f"Valkey Port: {VALKEY_PORT}")
    print()
    print("Access Instructions:")
    print(f"  redis-cli -h {vm_ip} -p {VALKEY_PORT}")
    print()
    print("Test Connection:")
    print(f"  redis-cli -h {vm_ip} -p {VALKEY_PORT} PING")
    print()


def launch_valkey(
    azure_dir: Optional[Path] = None,
    valkey_initramfs: str = DEFAULT_INITRAMFS,
    boot_wait: int = BOOT_WAIT_SECONDS,
    no_tail: bool = False,
) -> int:
    """
    Launch the Valkey VM.

    Args:
        azure_dir: Directory containing VM files
        valkey_initramfs: Name of the Valkey initramfs file
        boot_wait: Seconds to wait for VM boot
        no_tail: Don't tail the console log

    Returns:
        0 on success, 1 on failure
    """
    print(f"{Colors.BLUE}================================={Colors.NC}")
    print(f"{Colors.BLUE}  Valkey VM Quick Launch{Colors.NC}")
    print(f"{Colors.BLUE}================================={Colors.NC}")
    print()

    if azure_dir is None:
        azure_dir = DEFAULT_AZURE_DIR

    # Kill any running VMs
    kill_running_vms()

    # Clean console logs
    clean_console_logs()

    # Check initramfs exists
    if not check_initramfs(azure_dir, valkey_initramfs):
        return 1

    # Swap initramfs
    swap_initramfs(azure_dir, valkey_initramfs, DEFAULT_NODEJS_INITRAMFS)

    # Launch VM
    vm_pid = launch_vm(azure_dir)
    if vm_pid is None:
        return 1

    print(f"VM PID: {vm_pid}")
    print("Waiting for boot...")

    # Wait for boot
    time.sleep(boot_wait)

    # Get console log
    console_log = get_latest_console_log()

    if console_log is None:
        print(f"{Colors.YELLOW}WARNING: No console log found{Colors.NC}")
        return 0

    # Extract IP
    vm_ip = extract_vm_ip(console_log)

    if vm_ip:
        print_access_instructions(vm_ip)
    else:
        print(f"{Colors.YELLOW}WARNING: Could not determine VM IP{Colors.NC}")

    # Tail console log
    if not no_tail:
        tail_log(console_log)

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Quick Launch Script for Valkey VM"
    )
    parser.add_argument(
        "--azure-dir",
        type=Path,
        default=DEFAULT_AZURE_DIR,
        help=f"Directory containing VM files (default: {DEFAULT_AZURE_DIR})",
    )
    parser.add_argument(
        "--initramfs",
        type=str,
        default=DEFAULT_INITRAMFS,
        help=f"Valkey initramfs filename (default: {DEFAULT_INITRAMFS})",
    )
    parser.add_argument(
        "--boot-wait",
        type=int,
        default=BOOT_WAIT_SECONDS,
        help=f"Seconds to wait for VM boot (default: {BOOT_WAIT_SECONDS})",
    )
    parser.add_argument(
        "--no-tail",
        action="store_true",
        help="Don't tail the console log after boot",
    )
    args = parser.parse_args()

    return launch_valkey(
        azure_dir=args.azure_dir,
        valkey_initramfs=args.initramfs,
        boot_wait=args.boot_wait,
        no_tail=args.no_tail,
    )


if __name__ == "__main__":
    sys.exit(main())
