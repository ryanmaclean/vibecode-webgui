#!/usr/bin/env python3
"""Quick Launch Script for Unified Services VM."""

from __future__ import annotations

import glob
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()

BOOT_WAIT_SECONDS = 40
CONSOLE_LOG_PATTERN = "/tmp/vibecode-console-*.log"


def info(message: str) -> None:
    """Print blue info message."""
    print(f"{COLORS.blue}{message}{COLORS.reset}")


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}\u2713{COLORS.reset} {message}")


def kill_process(name: str) -> None:
    """Kill processes by name."""
    subprocess.run(["killall", name], capture_output=True, check=False)


def clean_console_logs() -> None:
    """Remove old console logs."""
    print("Cleaning old console logs...")
    for log_file in glob.glob(CONSOLE_LOG_PATTERN):
        try:
            os.remove(log_file)
        except OSError:
            pass


def get_latest_console_log() -> Path | None:
    """Get the most recent console log file."""
    logs = sorted(glob.glob(CONSOLE_LOG_PATTERN), key=os.path.getmtime, reverse=True)
    return Path(logs[0]) if logs else None


def extract_vm_ip(log_path: Path) -> str | None:
    """Extract VM IP address from console log."""
    try:
        # Read last 100 lines
        with open(log_path) as f:
            lines = f.readlines()[-100:]

        content = "".join(lines)
        # Match "inet X.X.X.X" pattern
        matches = re.findall(r"inet (\d+\.\d+\.\d+\.\d+)", content)
        return matches[0] if matches else None
    except (OSError, IndexError):
        return None


def tail_file(path: Path) -> None:
    """Tail a file continuously until interrupted."""
    print(f"Console log: {path}")
    print()
    print("Press Ctrl+C to stop tailing log...")

    try:
        subprocess.run(["tail", "-f", str(path)], check=False)
    except KeyboardInterrupt:
        print("\nStopped tailing log.")


def print_service_info(vm_ip: str) -> None:
    """Print available services and access instructions."""
    print()
    print(f"VM IP Address: {vm_ip}")
    print()
    print("Available Services:")
    print("  - SSH:        Port 22")
    print("  - OpenVSCode: Port 8080")
    print("  - Valkey:     Port 6379")
    print("  - PostgreSQL: Port 5432")
    print()
    print("Access Instructions:")
    print(f"  ssh root@{vm_ip}")
    print(f"  http://{vm_ip}:8080")
    print(f"  redis-cli -h {vm_ip} -p 6379")
    print(f"  psql -h {vm_ip} -U postgres -d vibecode")
    print()


def main() -> int:
    """Main entry point."""
    info("=================================")
    info("  Unified Services VM Quick Launch")
    info("=================================")
    print()

    home = Path.home()
    azure_dir = home / "vibecode-webgui" / "azure"
    initramfs_path = azure_dir / "unified-services-optimized.cpio.gz"
    nodejs_initramfs = azure_dir / "nodejs-complete.cpio.gz"
    backup_initramfs = azure_dir / "nodejs-backup.cpio.gz"
    vm_binary = azure_dir / "SwiftUI-Apps" / "NodeJSVibeCode.app" / "Contents" / "MacOS" / "NodeJS"

    # Kill any running VMs
    print("Stopping any running VMs...")
    kill_process("UnifiedServicesVibeCode")
    kill_process("NodeJS")
    time.sleep(2)

    # Clean console logs
    clean_console_logs()

    # Check if initramfs exists
    if not initramfs_path.exists():
        print("ERROR: Unified Services initramfs not found!")
        return 1

    # Launch VM
    print("Launching Unified Services VM...")
    os.chdir(azure_dir)

    # Backup current nodejs initramfs and swap in Unified
    if nodejs_initramfs.exists():
        shutil.copy(nodejs_initramfs, backup_initramfs)
    shutil.copy(initramfs_path, nodejs_initramfs)

    # Start VM
    with open(os.devnull, "w") as devnull:
        proc = subprocess.Popen(
            [str(vm_binary)],
            stdout=devnull,
            stderr=devnull,
        )

    print(f"VM PID: {proc.pid}")
    print("Waiting for boot...")

    # Wait for boot
    time.sleep(BOOT_WAIT_SECONDS)

    # Get console log
    console_log = get_latest_console_log()

    if not console_log:
        print("WARNING: No console log found")
        return 0

    # Extract IP
    vm_ip = extract_vm_ip(console_log)

    if vm_ip:
        ok("VM booted successfully")
        print_service_info(vm_ip)
    else:
        print("WARNING: Could not determine VM IP")

    # Tail console log
    tail_file(console_log)

    return 0


if __name__ == "__main__":
    sys.exit(main())
