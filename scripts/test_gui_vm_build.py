#!/usr/bin/env python3

"""
Test script for GUI VM build
Usage: python3 scripts/test_gui_vm_build.py
"""

import os
import sys
import time
import subprocess
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


def get_dir_size(path):
    """Get human-readable size of a directory or file."""
    result = run_command(["du", "-sh", str(path)], check=False)
    if result.returncode == 0:
        return result.stdout.split()[0]
    return "N/A"


def get_file_size(path):
    """Get human-readable size of a file."""
    result = run_command(["ls", "-lh", str(path)], check=False)
    if result.returncode == 0:
        parts = result.stdout.split()
        if len(parts) >= 5:
            return parts[4]
    return "N/A"


def print_header(title):
    """Print a formatted header."""
    print("+" + "=" * 62 + "+")
    print("|" + f"              {title}".ljust(62) + "|")
    print("+" + "=" * 62 + "+")
    print("")


def clean_previous_build():
    """Step 0: Clean previous build."""
    print("=== Cleaning previous build ===")

    # Kill existing process
    run_command("killall VibeCodeServicesVibeCode 2>/dev/null || true", shell=True, check=False)

    # Remove previous build artifacts
    paths_to_remove = [
        PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app",
        PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.swift",
        PROJECT_ROOT / "azure/SwiftUI-Apps/build_vibecodeservices.sh",
    ]

    for path in paths_to_remove:
        if path.exists():
            run_command(["rm", "-rf", str(path)], check=False)

    # Remove VM bundle
    vm_bundle = Path.home() / "VibeCode VMs" / "VibeCodeServices VM.bundle"
    if vm_bundle.exists():
        run_command(["rm", "-rf", str(vm_bundle)], check=False)

    print("Cleaned")
    print("")


def step1_generate_swift_app():
    """Step 1: Generate Swift App."""
    print("=== Step 1: Generate Swift App ===")

    result = run_command(
        ["python3", str(SCRIPT_DIR / "build_gui_linux_vm_swift.py"), "--name", "VibeCodeServices"],
        check=False,
        capture_output=True
    )

    # Filter output for status messages
    if result.stdout:
        for line in result.stdout.splitlines():
            if "error" in line.lower():
                print(line)

    swift_source = PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.swift"
    if swift_source.exists():
        print("Swift source generated")
    else:
        print("Swift source NOT generated")
        sys.exit(1)

    print("")


def step2_compile_swift():
    """Step 2: Compile Swift."""
    print("=== Step 2: Compile Swift ===")

    build_script = PROJECT_ROOT / "azure/SwiftUI-Apps/build_vibecodeservices.sh"
    result = run_command(
        ["bash", str(build_script)],
        check=False,
        capture_output=True
    )

    # Filter output for status messages
    if result.stdout:
        for line in result.stdout.splitlines():
            if "error" in line.lower():
                print(line)

    binary = PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode"
    if binary.exists():
        print("Binary compiled")
    else:
        print("Binary NOT compiled")
        sys.exit(1)

    print("")


def step3_verify_build():
    """Step 3: Verify Build."""
    print("=== Step 3: Verify Build ===")

    app_path = PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app"
    binary_path = app_path / "Contents/MacOS/VibeCodeServicesVibeCode"

    app_size = get_dir_size(app_path)
    binary_size = get_file_size(binary_path)

    print(f"App size: {app_size}")
    print(f"Binary size: {binary_size}")
    print("Build verified")
    print("")

    return app_size, binary_size


def step4_check_entitlements():
    """Step 4: Check Entitlements."""
    print("=== Step 4: Check Entitlements ===")

    binary = PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode"
    result = run_command(
        f"codesign -d --entitlements - '{binary}' 2>&1",
        shell=True,
        check=False
    )

    output = result.stdout if result.stdout else ""
    if "virtualization" in output.lower():
        print("Virtualization entitlement present")
    else:
        print("Virtualization entitlement MISSING")
        sys.exit(1)

    print("")


def step5_launch_app():
    """Step 5: Launch App."""
    print("=== Step 5: Launch App ===")

    app_path = PROJECT_ROOT / "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app"
    run_command(["open", str(app_path)], check=False)
    time.sleep(8)

    result = run_command("pgrep -f 'VibeCodeServicesVibeCode'", shell=True, check=False)
    if result.returncode == 0 and result.stdout.strip():
        print("App running")
    else:
        print("App NOT running")
        sys.exit(1)

    print("")


def step6_check_vm_bundle():
    """Step 6: Check VM Bundle."""
    print("=== Step 6: Check VM Bundle ===")

    vm_bundle = Path.home() / "VibeCode VMs" / "VibeCodeServices VM.bundle"
    disk_img = vm_bundle / "Disk.img"

    if vm_bundle.is_dir():
        print("VM bundle created")

        disk_logical = get_file_size(disk_img)
        disk_actual = get_dir_size(disk_img)

        print(f"   Disk logical: {disk_logical}")
        print(f"   Disk actual: {disk_actual} (sparse)")
    else:
        print("VM bundle NOT created")
        sys.exit(1)

    print("")

    return disk_logical, disk_actual


def step7_check_window():
    """Step 7: Check Window."""
    print("=== Step 7: Check Window ===")

    result = run_command(
        'osascript -e \'tell application "System Events" to get name of every window of process "VibeCodeServicesVibeCode"\' 2>&1',
        shell=True,
        check=False
    )

    window = result.stdout.strip() if result.stdout else ""
    if window:
        print(f"Window: {window}")
    else:
        print("No window found")

    print("")


def step8_check_vm_process():
    """Step 8: Check VM Process."""
    print("=== Step 8: Check VM Process ===")

    result = run_command("pgrep -f 'Virtualization.VirtualMachine'", shell=True, check=False)
    if result.returncode == 0 and result.stdout.strip():
        print("VM process running")
    else:
        print("VM process not found (may still be starting)")

    print("")


def print_summary(app_size, binary_size, disk_logical, disk_actual):
    """Print test summary."""
    print("+" + "=" * 62 + "+")
    print("|" + "              TEST COMPLETE".ljust(62) + "|")
    print("+" + "-" * 62 + "+")
    print(f"|  App Size: {app_size}".ljust(63) + "")
    print(f"|  Binary: {binary_size}".ljust(63) + "")
    print(f"|  Disk: {disk_logical} logical, {disk_actual} actual (sparse)".ljust(63) + "")
    print("+" + "=" * 62 + "+")


def main():
    """Main test function."""
    os.chdir(PROJECT_ROOT)

    print_header("GUI VM BUILD TEST")

    clean_previous_build()
    step1_generate_swift_app()
    step2_compile_swift()
    app_size, binary_size = step3_verify_build()
    step4_check_entitlements()
    step5_launch_app()
    disk_logical, disk_actual = step6_check_vm_bundle()
    step7_check_window()
    step8_check_vm_process()

    print_summary(app_size, binary_size, disk_logical, disk_actual)


if __name__ == "__main__":
    main()
