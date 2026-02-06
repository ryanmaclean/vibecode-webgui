#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "unified-vm-manager"
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


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Unified VM Manager - Works with VirtualBuddy or Standalone
"""

# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import os
from pathlib import Path

def has_virtualbuddy() -> bool:
    """Check if VirtualBuddy is installed"""
    vb_dir = Path.home() / "Library/Application Support/VirtualBuddy"
    return vb_dir.exists() and any(vb_dir.glob("*.vbvm"))

def list_vms():
    """List all VMs"""
    vms = []
    
    # Check VirtualBuddy VMs
    if has_virtualbuddy():
        vb_dir = Path.home() / "Library/Application Support/VirtualBuddy"
        for vm in vb_dir.glob("*.vbvm"):
            vms.append({
                "name": vm.stem,
                "path": str(vm),
                "type": "VirtualBuddy"
            })
    
    # Check standalone VMs
    standalone_dir = Path.home() / "VMs"
    if standalone_dir.exists():
        for vm in standalone_dir.iterdir():
            if (vm / "config.json").exists():
                vms.append({
                    "name": vm.name,
                    "path": str(vm),
                    "type": "Standalone"
                })
    
    return vms

def create_vm(name: str, source: str = None) -> bool:
    """Create/clone a VM"""
    # Use vm-ops.sh for VirtualBuddy VMs
    # Use standalone-vm.py for new VMs
    
    if source:
        # Clone existing VM
        return subprocess.run(
            ["./scripts/vm-ops.sh", "create", name, source],
            capture_output=True
        ).returncode == 0
    
    # Create new VM
    return subprocess.run(
        ["./standalone-vm.py", "create", name],
        capture_output=True
    ).returncode == 0

def main():
    print("🍎 Unified VM Manager")
    print("=" * 40)
    
    vms = list_vms()
    
    if not vms:
        print("No VMs found")
        response = input("Create a new VM? (y/n): ")
        if response.lower() == 'y':
            name = input("VM name: ").strip()
            create_vm(name)
        return
    
    print("\nVMs:")
    for i, vm in enumerate(vms, 1):
        print(f"{i}. {vm['name']} ({vm['type']})")
    
    print("\nCommands:")
    print("  start <name> - Start a VM")
    print("  stop <name>  - Stop a VM")
    print("  clone <source> <target> - Clone VM")
    print("  quit        - Exit")

if __name__ == "__main__":
    main()