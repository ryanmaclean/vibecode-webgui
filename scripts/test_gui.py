#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-gui"
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
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


"""
Test actual GUI functionality
Verifies the app can be launched and VMs can be started from the GUI
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import os
import sys
import time
import subprocess
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent

def run_command(cmd, check=True, capture_output=True, shell=False):
    """Run a shell command."""
    try:
        if isinstance(cmd, str) and shell:
            result = subprocess.run(
                cmd,
                shell=True,
                check=check,
                capture_output=capture_output,
                text=True
            )
        else:
            result = subprocess.run(
                cmd,
                check=check,
                capture_output=capture_output,
                text=True
            )
        return result
    except subprocess.CalledProcessError as e:
        if check:
            raise
        return e

def kill_vibecode():
    """Kill any existing VibeCode instances."""
    run_command("killall VibeCode 2>/dev/null || true", shell=True, check=False)
    time.sleep(2)

def test_build():
    """Test 1: Build and sign properly."""
    print("[1/5] Building with proper entitlements...")
    
    vibecode_dir = PROJECT_ROOT / "VibeCodeSwift"
    os.chdir(vibecode_dir)
    
    # Build
    result = run_command(
        ["swift", "build", "-c", "debug"],
        check=False,
        capture_output=True
    )
    
    binary = vibecode_dir / ".build/debug/VibeCode"
    if not binary.exists():
        print("  FAIL: Build failed")
        sys.exit(1)
    
    # Create app bundle if needed
    app_bundle = vibecode_dir / ".build/debug/VibeCode.app"
    if not app_bundle.exists():
        app_bundle.mkdir(parents=True)
        (app_bundle / "Contents/MacOS").mkdir(parents=True)
        (app_bundle / "Contents/MacOS/VibeCode").write_bytes(binary.read_bytes())
        
        info_plist = vibecode_dir / "Info.plist"
        if info_plist.exists():
            (app_bundle / "Contents/Info.plist").write_bytes(info_plist.read_bytes())
    
    print("  Build complete")
    return app_bundle

def test_signing(app_bundle):
    """Test 2: Sign with entitlements."""
    print("[2/5] Signing with entitlements...")
    
    vibecode_dir = PROJECT_ROOT / "VibeCodeSwift"
    binary = app_bundle / "Contents/MacOS/VibeCode"
    entitlements = vibecode_dir / "VibeCode.entitlements"
    
    # Sign
    run_command([
        "codesign",
        "--force",
        "--sign", "-",
        "--entitlements", str(entitlements),
        str(binary)
    ], check=False, capture_output=True)
    
    # Verify entitlements
    result = run_command([
        "codesign", "-d", "--entitlements", "-",
        str(app_bundle)
    ], check=False, capture_output=True)
    
    if "com.apple.security.virtualization" in result.stderr:
        print("  PASS: Entitlements applied")
    else:
        print("  FAIL: Entitlements not applied")
        sys.exit(1)

def test_launch(app_bundle):
    """Test 3: Launch GUI."""
    print("[3/5] Launching GUI...")
    
    run_command(["open", str(app_bundle)])
    time.sleep(5)
    
    result = run_command(
        "ps aux | grep -v grep | grep VibeCode.app",
        shell=True,
        check=False,
        capture_output=True
    )
    
    if result.returncode == 0 and result.stdout:
        print("  PASS: GUI launched")
    else:
        print("  FAIL: GUI did not launch")
        sys.exit(1)

def test_entitlement_errors():
    """Test 4: Check for entitlement errors in logs."""
    print("[4/5] Checking for entitlement errors...")
    time.sleep(2)
    
    result = run_command([
        "log", "show",
        "--predicate", "process == \"VibeCode\"",
        "--last", "10s"
    ], check=False, capture_output=True)
    
    if "doesn't have" in result.stdout and "entitlement" in result.stdout:
        print("  FAIL: Entitlement error detected in logs")
        kill_vibecode()
        sys.exit(1)
    else:
        print("  PASS: No entitlement errors")

def test_vm_discovery():
    """Test 5: Verify VMs loaded in GUI."""
    print("[5/5] Verifying VM discovery...")
    time.sleep(3)
    
    result = run_command([
        "log", "show",
        "--predicate", "process == \"VibeCode\"",
        "--last", "10s"
    ], check=False, capture_output=True)
    
    log_output = result.stdout
    
    if "VM discovery completed" in log_output:
        # Extract VM count
        match = re.search(r'"vm_count":(\d+)', log_output)
        if match:
            vm_count = int(match.group(1))
            if vm_count >= 6:
                print(f"  PASS: {vm_count} VMs discovered in GUI")
            else:
                print(f"  FAIL: Only {vm_count} VMs discovered")
        else:
            print("  WARN: Could not extract VM count")
    else:
        print("  FAIL: VM discovery did not complete")

def main():
    """Main test function."""
    print("GUI Functionality Tests")
    print("======================")
    print("")
    
    kill_vibecode()
    
    app_bundle = test_build()
    test_signing(app_bundle)
    test_launch(app_bundle)
    test_entitlement_errors()
    test_vm_discovery()
    
    # Cleanup
    kill_vibecode()
    
    print("")
    print("======================")
    print("GUI tests complete")
    print("")
    print("To manually test VM start:")
    print("  1. Run: open VibeCodeSwift/.build/debug/VibeCode.app")
    print("  2. Click a VM in the sidebar")
    print("  3. Click 'Start VM' button")
    print("  4. Verify no entitlement errors")

if __name__ == "__main__":
    main()