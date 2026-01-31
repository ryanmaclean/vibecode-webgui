#!/usr/bin/env python3

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

"""Valkey VM Launch Script for vfkit v0.6.1.

This script uses CLI flags, NOT --config YAML.
The YAML files in config/vfkit/ are documentation only.

Prerequisites:
- Bootable Valkey disk image at ~/.vfkit/vms/valkey/disk/root.img
- Alpine kernel and initramfs at ~/.vfkit/vms/vibecode-alpine/kernel/
- vfkit v0.6.1 installed (brew install vfkit)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn

# Configuration
VM_NAME = "vibecode-valkey"
CPUS = 2
MEMORY = 1024  # MB
MAC_ADDR = "52:54:00:12:34:59"


def get_paths() -> dict[str, Path]:
    """Get all required paths."""
    vfkit_dir = Path.home() / ".vfkit" / "vms"
    return {
        "kernel": vfkit_dir / "vibecode-alpine" / "kernel" / "vmlinuz",
        "initramfs": vfkit_dir / "vibecode-alpine" / "kernel" / "initramfs",
        "disk": vfkit_dir / "valkey" / "disk" / "root.img",
        "log": vfkit_dir / "valkey" / "logs" / "vm.log",
    }


def validate_prerequisites(paths: dict[str, Path]) -> bool:
    """Validate all prerequisites exist."""
    print("Validating prerequisites...")

    if not paths["kernel"].exists():
        log_error(f"Kernel not found at {paths['kernel']}")
        return False

    if not paths["initramfs"].exists():
        log_error(f"Initramfs not found at {paths['initramfs']}")
        return False

    if not paths["disk"].exists():
        log_error(f"Disk image not found at {paths['disk']}")
        print("Run scripts/vfkit/create-valkey-vm.sh first to create the disk image")
        return False

    if not shutil.which("vfkit"):
        log_error("vfkit not found. Install with: brew install vfkit")
        return False

    return True


def check_already_running() -> bool:
    """Check if Valkey VM is already running."""
    result = subprocess.run(
        ["pgrep", "-f", "vfkit.*valkey"],
        capture_output=True,
        check=False,
    )

    if result.returncode == 0:
        log_warn("Valkey VM appears to be already running")
        print("To stop: pkill -f 'vfkit.*valkey'")
        response = input("Continue anyway? (y/N) ").strip().lower()
        return response != "y"

    return False


def print_config(paths: dict[str, Path]) -> None:
    """Print VM configuration."""
    print()
    print("Starting Valkey VM with configuration:")
    print(f"  Name: {VM_NAME}")
    print(f"  CPUs: {CPUS}")
    print(f"  Memory: {MEMORY}MB")
    print(f"  Disk: {paths['disk']}")
    print(f"  Kernel: {paths['kernel']}")
    print(f"  Initramfs: {paths['initramfs']}")
    print(f"  Log: {paths['log']}")
    print()


def launch_vm(paths: dict[str, Path]) -> int:
    """Launch the Valkey VM."""
    cmdline = "console=hvc0 root=/dev/vda rootfstype=ext4 rw quiet"

    # Create log directory
    paths["log"].parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "vfkit",
        "--cpus", str(CPUS),
        "--memory", str(MEMORY),
        "--bootloader", f"linux,kernel={paths['kernel']},initrd={paths['initramfs']},cmdline={cmdline}",
        "--device", f"virtio-blk,path={paths['disk']}",
        "--device", f"virtio-net,nat,mac={MAC_ADDR}",
        "--device", f"virtio-serial,logFilePath={paths['log']}",
        "--device", "virtio-serial,stdio",
    ]

    # Start VM in background
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    print(f"VM started with PID: {process.pid}")
    print()
    print(f"To view logs: tail -f {paths['log']}")
    print(f"To stop VM: kill {process.pid}")
    print("To connect: Once networking is up, Valkey will be accessible")
    print()
    print("NOTE: Port forwarding must be configured separately:")
    print("  Option 1 (SSH tunnel): ssh -L 6379:localhost:6379 root@<vm-ip>")
    print("  Option 2 (pf rules): See docs/VFKIT_ANALYSIS.md")
    print()

    # Wait and check if still running
    time.sleep(2)
    if process.poll() is None:
        print("✓ VM is running")
        return process.pid
    else:
        print("✗ VM failed to start. Check logs:")
        if paths["log"].exists():
            with open(paths["log"]) as f:
                lines = f.readlines()
                for line in lines[-20:]:
                    print(line.rstrip())
        return -1


def main() -> int:
    """Main entry point."""
    log_section("Valkey VM Launch")

    paths = get_paths()

    if not validate_prerequisites(paths):
        return 1

    if check_already_running():
        return 1

    print_config(paths)

    pid = launch_vm(paths)
    return 0 if pid > 0 else 1


if __name__ == "__main__":
    sys.exit(main())