from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "vfkit-launch-postgresql"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "vm-management"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation




"""PostgreSQL + pgvector VM Launch Script for vfkit v0.6.1.

This script uses CLI flags, NOT --config YAML.

Prerequisites:
- Bootable PostgreSQL disk images:
  - root.img (20GB) - OS and PostgreSQL binaries
  - data.img (100GB) - PostgreSQL data directory
  - backup.img (50GB) - Backup storage
- Alpine kernel and initramfs at ~/.vfkit/vms/vibecode-alpine/kernel/
- vfkit v0.6.1 installed (brew install vfkit)
"""


# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass
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

import shutil
import subprocess
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import log_error, log_section, log_warn

# Configuration
VM_NAME = "vibecode-postgresql"
CPUS = 4
MEMORY = 8192  # MB
MAC_ADDR = "52:54:00:12:34:58"


def get_paths() -> dict[str, Path]:
    """Get all required paths."""
    vfkit_dir = Path.home() / ".vfkit" / "vms"
    return {
        "kernel": vfkit_dir / "vibecode-alpine" / "kernel" / "vmlinuz",
        "initramfs": vfkit_dir / "vibecode-alpine" / "kernel" / "initramfs",
        "root_disk": vfkit_dir / "postgresql" / "disk" / "root.img",
        "data_disk": vfkit_dir / "postgresql" / "disk" / "data.img",
        "backup_disk": vfkit_dir / "postgresql" / "disk" / "backup.img",
        "log": vfkit_dir / "postgresql" / "logs" / "vm.log",
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

    if not paths["root_disk"].exists():
        log_error(f"Root disk not found at {paths['root_disk']}")
        print("Run scripts/vfkit/create-postgresql-vm.sh first")
        return False

    if not paths["data_disk"].exists():
        log_error(f"Data disk not found at {paths['data_disk']}")
        print("Run scripts/vfkit/create-postgresql-vm.sh first")
        return False

    if not paths["backup_disk"].exists():
        log_error(f"Backup disk not found at {paths['backup_disk']}")
        print("Run scripts/vfkit/create-postgresql-vm.sh first")
        return False

    if not shutil.which("vfkit"):
        log_error("vfkit not found. Install with: brew install vfkit")
        return False

    return True


def check_already_running() -> bool:
    """Check if PostgreSQL VM is already running."""
    result = subprocess.run(
        ["pgrep", "-f", "vfkit.*postgresql"],
        capture_output=True,
        check=False,
    )

    if result.returncode == 0:
        log_warn("PostgreSQL VM appears to be already running")
        print("To stop: pkill -f 'vfkit.*postgresql'")
        response = input("Continue anyway? (y/N) ").strip().lower()
        return response != "y"

    return False


def print_config(paths: dict[str, Path]) -> None:
    """Print VM configuration."""
    print()
    print("Starting PostgreSQL VM with configuration:")
    print(f"  Name: {VM_NAME}")
    print(f"  CPUs: {CPUS}")
    print(f"  Memory: {MEMORY}MB")
    print(f"  Root Disk: {paths['root_disk']}")
    print(f"  Data Disk: {paths['data_disk']}")
    print(f"  Backup Disk: {paths['backup_disk']}")
    print(f"  Kernel: {paths['kernel']}")
    print(f"  Initramfs: {paths['initramfs']}")
    print(f"  Log: {paths['log']}")
    print()


def launch_vm(paths: dict[str, Path]) -> int:
    """Launch the PostgreSQL VM."""
    cmdline = "console=hvc0 root=/dev/vda rootfstype=ext4 rw quiet"

    # Create log directory
    paths["log"].parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "vfkit",
        "--cpus", str(CPUS),
        "--memory", str(MEMORY),
        "--bootloader", f"linux,kernel={paths['kernel']},initrd={paths['initramfs']},cmdline={cmdline}",
        # Root disk (OS and binaries)
        "--device", f"virtio-blk,path={paths['root_disk']}",
        # Data disk (PostgreSQL data)
        "--device", f"virtio-blk,path={paths['data_disk']}",
        # Backup disk
        "--device", f"virtio-blk,path={paths['backup_disk']}",
        # Network with NAT
        "--device", f"virtio-net,nat,mac={MAC_ADDR}",
        # Serial console for logging
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
    print()
    print("NOTE: Port forwarding must be configured separately:")
    print("  Option 1 (SSH tunnel): ssh -L 5432:localhost:5432 root@<vm-ip>")
    print("  Option 2 (pf rules): See docs/VFKIT_ANALYSIS.md")
    print()
    print("Disk layout in VM:")
    print("  /dev/vda - Root filesystem (OS)")
    print("  /dev/vdb - PostgreSQL data (/var/lib/postgresql)")
    print("  /dev/vdc - Backup storage (/backup)")
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
    log_section("PostgreSQL + pgvector VM Launch")

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