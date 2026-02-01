#!/usr/bin/env python3
"""Quick Launch Script for Valkey VM.

Launches the Valkey (Redis-compatible) VM and monitors its boot process.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.GREEN = cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Configuration
AZURE_DIR = Path.home() / "vibecode-webgui" / "azure"
VALKEY_INITRAMFS = AZURE_DIR / "valkey-standalone-v2.cpio.gz"
NODEJS_INITRAMFS = AZURE_DIR / "nodejs-complete.cpio.gz"
BACKUP_INITRAMFS = AZURE_DIR / "nodejs-backup.cpio.gz"
VM_APP = AZURE_DIR / "SwiftUI-Apps" / "NodeJSVibeCode.app" / "Contents" / "MacOS" / "NodeJS"
CONSOLE_LOG_PATTERN = "/tmp/vibecode-console-*.log"
BOOT_WAIT_TIME = 30


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def kill_running_vms() -> None:
    """Kill any running VMs."""
    print("Stopping any running VMs...")
    run_cmd(["killall", "ValkeyVibeCode"])
    run_cmd(["killall", "NodeJS"])
    time.sleep(2)


def clean_console_logs() -> None:
    """Remove old console logs."""
    print("Cleaning old console logs...")
    for log_file in glob.glob(CONSOLE_LOG_PATTERN):
        try:
            Path(log_file).unlink()
        except OSError:
            pass


def get_latest_console_log() -> Path | None:
    """Get the most recent console log file."""
    logs = sorted(glob.glob(CONSOLE_LOG_PATTERN), key=os.path.getmtime, reverse=True)
    return Path(logs[0]) if logs else None


def extract_vm_ip(log_path: Path) -> str | None:
    """Extract VM IP address from console log."""
    try:
        content = log_path.read_text()
        lines = content.splitlines()[-100:]
        for line in lines:
            match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", line)
            if match:
                return match.group(1)
    except OSError:
        pass
    return None


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--no-tail",
        action="store_true",
        help="Don't tail the console log",
    )
    parser.add_argument(
        "--boot-wait",
        type=int,
        default=BOOT_WAIT_TIME,
        help=f"Boot wait time in seconds (default: {BOOT_WAIT_TIME})",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    print(f"{Colors.BLUE}================================={Colors.NC}")
    print(f"{Colors.BLUE}  Valkey VM Quick Launch{Colors.NC}")
    print(f"{Colors.BLUE}================================={Colors.NC}")
    print()

    kill_running_vms()
    clean_console_logs()

    # Check if initramfs exists
    if not VALKEY_INITRAMFS.exists():
        print("ERROR: Valkey initramfs not found!")
        return 1

    # Launch VM
    print("Launching Valkey VM...")

    # Backup current nodejs initramfs and swap in Valkey
    if NODEJS_INITRAMFS.exists():
        shutil.copy2(NODEJS_INITRAMFS, BACKUP_INITRAMFS)
    shutil.copy2(VALKEY_INITRAMFS, NODEJS_INITRAMFS)

    if not VM_APP.exists():
        print(f"ERROR: VM app not found: {VM_APP}")
        return 1

    proc = subprocess.Popen(
        [str(VM_APP)],
        cwd=str(AZURE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    print(f"VM PID: {proc.pid}")
    print("Waiting for boot...")

    time.sleep(args.boot_wait)

    # Get console log
    console_log = get_latest_console_log()

    if not console_log:
        print("WARNING: No console log found")
        return 1

    # Extract IP
    vm_ip = extract_vm_ip(console_log)

    if vm_ip:
        print(f"{Colors.GREEN}[OK]{Colors.NC} VM booted successfully")
        print()
        print(f"VM IP Address: {vm_ip}")
        print("Valkey Port: 6379")
        print()
        print("Access Instructions:")
        print(f"  redis-cli -h {vm_ip} -p 6379")
        print()
        print("Test Connection:")
        print(f"  redis-cli -h {vm_ip} -p 6379 PING")
        print()
    else:
        print("WARNING: Could not determine VM IP")

    print(f"Console log: {console_log}")
    print()

    if not args.no_tail:
        print("Press Ctrl+C to stop tailing log...")
        try:
            subprocess.run(["tail", "-f", str(console_log)])
        except KeyboardInterrupt:
            print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
