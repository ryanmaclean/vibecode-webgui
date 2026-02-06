#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "launch-nodejs"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Quick Launch Script for Node.js Reference VM.

Launches the Node.js VM and monitors its boot process.
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import glob
import os
import re
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
INITRAMFS = AZURE_DIR / "nodejs-complete.cpio.gz"
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


def restore_initramfs() -> None:
    """Restore original initramfs if backed up."""
    if BACKUP_INITRAMFS.exists():
        print("Restoring original Node.js initramfs...")
        BACKUP_INITRAMFS.rename(INITRAMFS)


def get_latest_console_log() -> Path | None:
    """Get the most recent console log file."""
    logs = sorted(glob.glob(CONSOLE_LOG_PATTERN), key=os.path.getmtime, reverse=True)
    return Path(logs[0]) if logs else None


def extract_vm_ip(log_path: Path) -> str | None:
    """Extract VM IP address from console log."""
    try:
        content = log_path.read_text()
        # Look for inet IP addresses in last 100 lines
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
    print(f"{Colors.BLUE}  Node.js VM Quick Launch{Colors.NC}")
    print(f"{Colors.BLUE}================================={Colors.NC}")
    print()

    kill_running_vms()
    clean_console_logs()
    restore_initramfs()

    # Check if initramfs exists
    if not INITRAMFS.exists():
        print("ERROR: Node.js initramfs not found!")
        return 1

    # Launch VM
    print("Launching Node.js VM...")

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
        print("Node.js HTTP Port: 3000")
        print()
        print("Access Instructions:")
        print(f"  curl http://{vm_ip}:3000")
        print()
        print("Test Connection:")
        print(f"  curl -s http://{vm_ip}:3000 | head -20")
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