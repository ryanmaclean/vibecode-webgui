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

"""Start all 4 VMs in sequence with proper delays."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn

VM_BASE = Path.home() / ".vfkit" / "vms"

VMS = [
    "vibecode-valkey",
    "vibecode-postgresql",
    "vibecode-pgvector",
    "vibecode-nodejs-dev",
]


def start_vm(vm_name: str) -> bool:
    """Start a single VM."""
    launch_script = VM_BASE / vm_name / "launch.sh"

    if not launch_script.exists():
        log_error(f"Launch script not found: {launch_script}")
        return False

    print(f"Starting {vm_name}...")
    result = subprocess.run([str(launch_script)], check=False)
    return result.returncode == 0


def main() -> int:
    """Main entry point."""
    print("Starting all 4 VMs...")
    print()

    for i, vm_name in enumerate(VMS):
        if not start_vm(vm_name):
            log_warn(f"Failed to start {vm_name}")

        # Add delay between VM starts (except after last)
        if i < len(VMS) - 1:
            time.sleep(2)

    print()
    log_success("All VMs started!")
    print()
    print("Check status:")
    print("  ps aux | grep vfkit")
    print()
    print("View logs:")
    for vm_name in VMS:
        print(f"  tail -f {VM_BASE}/{vm_name}/logs/console.log")

    return 0


if __name__ == "__main__":
    sys.exit(main())