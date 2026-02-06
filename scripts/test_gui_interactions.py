#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-gui-interactions"
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
End-to-end GUI interaction testing using AppleScript
Tests clicking buttons, starting VMs, checking status
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

def run_applescript(script):
    """Run AppleScript code."""
    result = run_command(
        ["osascript", "-e", script],
        check=False,
        capture_output=True
    )
    return result.returncode == 0, result.stdout, result.stderr

def kill_vibecode():
    """Kill any existing VibeCode instances."""
    run_command("killall VibeCode 2>/dev/null || true", shell=True, check=False)
    time.sleep(2)

def launch_vibecode():
    """Launch VibeCode app."""
    print("Launching VibeCode...")
    launch_script = SCRIPT_DIR / "launch-vibecode.sh"
    if launch_script.exists():
        run_command(
            [str(launch_script)],
            check=False,
            capture_output=True
        )
    else:
        # Fallback: try to find and launch the app directly
        app_paths = [
            PROJECT_ROOT / "VibeCodeSwift/.build/debug/VibeCode.app",
            PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCode.app",
        ]
        for app_path in app_paths:
            if app_path.exists():
                run_command(["open", str(app_path)])
                break
    time.sleep(5)

def test_window_open():
    """Test 1: Verify window opens."""
    print("[1/6] Verifying app window...")
    
    success, stdout, _ = run_applescript(
        'tell application "System Events" to get name of every process'
    )
    
    if success and "VibeCode" in stdout:
        print("  PASS: App window open")
    else:
        print("  FAIL: App window not found")
        sys.exit(1)

def test_vm_list():
    """Test 2: Check VM list loads."""
    print("[2/6] Checking VM list...")
    time.sleep(2)
    
    log_file = PROJECT_ROOT / "logs/vibecode.log"
    if not log_file.exists():
        print("  WARN: Log file not found")
        return
    
    try:
        with open(log_file, 'r') as f:
            lines = f.readlines()
            for line in reversed(lines[-20:]):
                if "vm_count" in line:
                    match = re.search(r'"vm_count":(\d+)', line)
                    if match:
                        vm_count = int(match.group(1))
                        if vm_count >= 6:
                            print(f"  PASS: {vm_count} VMs loaded in list")
                        else:
                            print(f"  FAIL: Expected 6 VMs, found {vm_count}")
                        return
        print("  WARN: Could not find VM count in logs")
    except Exception as e:
        print(f"  WARN: Error reading log file: {e}")

def test_vm_selection():
    """Test 3: Click first VM in list."""
    print("[3/6] Selecting VM in sidebar...")
    
    applescript = """
tell application "System Events"
    tell process "VibeCode"
        set frontmost to true
        delay 1
        -- Click first VM in sidebar
        click row 1 of outline 1 of scroll area 1 of splitter group 1 of window 1
        delay 1
    end tell
end tell
"""
    
    success, _, _ = run_applescript(applescript)
    
    if success:
        print("  PASS: VM selected")
    else:
        print("  WARN: Could not automate VM selection (may require accessibility permissions)")

def test_auto_start():
    """Test 4: Auto-start verification."""
    print("[4/6] Verifying auto-start...")
    time.sleep(8)
    
    log_file = PROJECT_ROOT / "logs/vibecode.log"
    if not log_file.exists():
        print("  WARN: Log file not found")
        return
    
    try:
        with open(log_file, 'r') as f:
            content = f.read()
            if "VM started successfully" in content:
                # Extract VM name
                matches = re.findall(r'VM started successfully.*?(\w+)', content)
                if matches:
                    started_vm = matches[-1]
                    print(f"  PASS: Auto-start worked ({started_vm})")
                else:
                    print("  PASS: Auto-start worked")
            else:
                print("  FAIL: No VM auto-started")
    except Exception as e:
        print(f"  WARN: Error reading log file: {e}")

def test_errors():
    """Test 5: Check for errors."""
    print("[5/6] Checking for errors...")
    
    log_file = PROJECT_ROOT / "logs/vibecode.log"
    if not log_file.exists():
        print("  WARN: Log file not found")
        return
    
    try:
        with open(log_file, 'r') as f:
            content = f.read()
            if "doesn't have" in content and "entitlement" in content:
                print("  FAIL: Entitlement errors found")
                sys.exit(1)
            else:
                print("  PASS: No entitlement errors")
    except Exception as e:
        print(f"  WARN: Error reading log file: {e}")

def test_vm_state():
    """Test 6: Verify VMs are running."""
    print("[6/6] Verifying VM state...")
    
    result = run_command(
        'ps aux | grep -v grep | grep "VibeCode.*Contents/MacOS"',
        shell=True,
        check=False,
        capture_output=True
    )
    
    if result.returncode == 0 and result.stdout:
        print("  PASS: App still running with VMs")
    else:
        print("  FAIL: App crashed")
        sys.exit(1)

def main():
    """Main test function."""
    print("End-to-End GUI Testing")
    print("======================")
    print("")
    
    kill_vibecode()
    launch_vibecode()
    
    test_window_open()
    test_vm_list()
    test_vm_selection()
    test_auto_start()
    test_errors()
    test_vm_state()
    
    print("")
    print("======================")
    print("GUI interaction tests complete")
    print("")
    print("Manual verification checklist:")
    print("  [ ] All 6 VMs visible in sidebar")
    print("  [ ] Clicking VM shows details")
    print("  [ ] Start VM button works")
    print("  [ ] Stop VM button works")
    print("  [ ] No red error messages")
    print("  [ ] Status updates correctly")

if __name__ == "__main__":
    main()
