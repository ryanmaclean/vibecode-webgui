#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "automated-vm-test-harness"
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

"""Automated VM Test Harness.

Staff Engineer Level: No manual testing required.
Tests VM infrastructure, service availability, and observability.
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
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
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

SERVICES = {
    5432: "PostgreSQL",
    6379: "Valkey",
    3000: "Node.js",
    8080: "OpenVSCode",
    8443: "IDE",
    5433: "Pgvector",
}

EFI_VMS = ["postgresql", "valkey", "nodejs", "nodejs-codeserver"]
EXPECTED_EFI_SIZE = 131072  # 128K


@dataclass
class TestResults:
    """Track test results."""

    total: int = 0
    passed: int = 0
    failed: int = 0
    verbose: bool = False


def test_result(results: TestResults, success: bool, description: str) -> bool:
    """Record a test result."""
    results.total += 1
    if success:
        print(f"  ✅ PASS: {description}")
        results.passed += 1
    else:
        print(f"  ❌ FAIL: {description}")
        results.failed += 1
    return success


def run_cmd(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def check_port(host: str, port: int, timeout: float = 1.0) -> bool:
    """Check if a port is open."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, socket.timeout):
        return False


def validate_infrastructure(results: TestResults) -> None:
    """Phase 1: Infrastructure validation."""
    print("[Phase 1] Infrastructure Validation")
    print("------------------------------------")

    # Check app binary
    app_binary = PROJECT_ROOT / "VibeCodeSwift" / ".build" / "debug" / "VibeCode"
    test_result(results, app_binary.exists(), "App binary exists")

    # Check VM images
    vm_images_dir = PROJECT_ROOT / "dist" / "vm-images"
    if vm_images_dir.exists():
        img_count = len(list(vm_images_dir.glob("*.img")))
        test_result(results, img_count == 6, f"All 6 VM images present (found {img_count})")

        nvram_count = len(list(vm_images_dir.glob("*-efi.nvram")))
        test_result(results, nvram_count == 6, f"All 6 EFI NVRAM files present (found {nvram_count})")
    else:
        test_result(results, False, "VM images directory exists")
        test_result(results, False, "EFI NVRAM files present")

    print()


def test_programmatic_vm(results: TestResults) -> int | None:
    """Phase 2: Programmatic VM testing."""
    print("[Phase 2] Programmatic VM Testing")
    print("----------------------------------")

    # Kill any existing instances
    run_cmd(["killall", "VibeCode"], check=False)
    time.sleep(2)

    # Start app in background
    print("Starting app...")
    launch_script = SCRIPT_DIR / "launch-vibecode.sh"
    if not launch_script.exists():
        print("  ⏭️  SKIP: launch-vibecode.sh not found")
        print()
        return None

    proc = subprocess.Popen(
        [str(launch_script)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(10)

    # Verify app is running
    try:
        os.kill(proc.pid, 0)
        test_result(results, True, "App launched successfully")
    except OSError:
        test_result(results, False, "App launched successfully")
        print()
        return None

    # Wait for VM discovery
    time.sleep(5)
    log_file = PROJECT_ROOT / "logs" / "vibecode.log"
    vm_count = 0
    if log_file.exists():
        try:
            content = log_file.read_text()
            lines = content.splitlines()[-50:]
            for line in reversed(lines):
                if '"vm_count":' in line:
                    import re
                    match = re.search(r'"vm_count":(\d+)', line)
                    if match:
                        vm_count = int(match.group(1))
                        break
        except Exception:
            pass

    test_result(results, vm_count == 6, f"All 6 VMs discovered (found {vm_count})")
    print()

    return proc.pid


def validate_running_vms(results: TestResults) -> None:
    """Phase 3: Running VM validation."""
    print("[Phase 3] Running VM Validation")
    print("-------------------------------")

    log_file = PROJECT_ROOT / "logs" / "vibecode.log"
    running_vms = 0
    if log_file.exists():
        try:
            content = log_file.read_text()
            lines = content.splitlines()[-100:]
            for line in lines:
                if "Running" in line or "started" in line:
                    running_vms += 1
        except Exception:
            pass

    print(f"Found {running_vms} running VMs (Pgvector and Ide auto-run)")

    # Check network presence
    print()
    print("Scanning for VMs on network...")
    result = run_cmd(["arp", "-a"])
    vm_ips = 0
    for line in result.stdout.splitlines():
        if "192.168.64" in line and "192.168.64.1" not in line and "192.168.64.255" not in line:
            vm_ips += 1

    test_result(results, vm_ips > 0, f"VMs present on bridge100 network ({vm_ips} VMs)")
    print()


def test_service_availability(results: TestResults) -> None:
    """Phase 4: Service availability testing."""
    print("[Phase 4] Service Availability")
    print("------------------------------")

    for port, service in SERVICES.items():
        if check_port("localhost", port):
            test_result(results, True, f"{service} accessible on localhost:{port}")
        else:
            test_result(results, False, f"{service} not accessible on localhost:{port}")

    print()


def test_service_functionality(results: TestResults) -> None:
    """Phase 5: Service functional tests."""
    print("[Phase 5] Service Functional Tests")
    print("-----------------------------------")

    # Test Valkey
    if check_port("localhost", 6379):
        try:
            with socket.create_connection(("localhost", 6379), timeout=5) as sock:
                sock.sendall(b"PING\r\n")
                response = sock.recv(1024).decode()
                if "PONG" in response or "AUTH" in response:
                    test_result(results, True, "Valkey responding to commands")
                else:
                    test_result(results, False, "Valkey not responding properly")
        except Exception:
            test_result(results, False, "Valkey not responding properly")
    else:
        print("  ⏭️  SKIP: Valkey not accessible")

    # Test Node.js
    if check_port("localhost", 3000):
        result = run_cmd(["curl", "-s", "-m", "5", "http://localhost:3000/"])
        test_result(results, result.returncode == 0, "Node.js HTTP server responding")
    else:
        print("  ⏭️  SKIP: Node.js not accessible")

    # Test PostgreSQL
    if check_port("localhost", 5432):
        if shutil.which("psql"):
            result = run_cmd(["psql", "-h", "localhost", "-p", "5432", "-U", "postgres", "-c", "SELECT 1;"])
            test_result(results, result.returncode == 0, "PostgreSQL accepting connections")
        else:
            print("  ⏭️  SKIP: psql not installed")
    else:
        print("  ⏭️  SKIP: PostgreSQL not accessible")

    # Test OpenVSCode
    if check_port("localhost", 8080):
        result = run_cmd(["curl", "-s", "-m", "5", "http://localhost:8080/"])
        has_vscode = "vscode" in result.stdout.lower() or "code-server" in result.stdout.lower()
        test_result(results, has_vscode, "OpenVSCode web interface responding")
    else:
        print("  ⏭️  SKIP: OpenVSCode not accessible")

    print()


def validate_efi_config(results: TestResults) -> None:
    """Phase 6: EFI bootloader validation."""
    print("[Phase 6] EFI Bootloader Validation")
    print("-----------------------------------")

    vm_images_dir = PROJECT_ROOT / "dist" / "vm-images"
    for vm in EFI_VMS:
        nvram_file = vm_images_dir / f"vibecode-{vm}-efi.nvram"
        if nvram_file.exists():
            size = nvram_file.stat().st_size
            if size == EXPECTED_EFI_SIZE:
                test_result(results, True, f"{vm} EFI NVRAM valid (128K)")
            else:
                test_result(results, False, f"{vm} EFI NVRAM invalid (size: {size})")
        else:
            test_result(results, False, f"{vm} EFI NVRAM not found")

    print()


def check_console_output(results: TestResults) -> None:
    """Phase 7: VM console output check."""
    print("[Phase 7] VM Console Output")
    print("---------------------------")

    logs_dir = PROJECT_ROOT / "logs"
    console_logs = list(logs_dir.glob("*-console.log")) if logs_dir.exists() else []

    if console_logs:
        test_result(results, True, f"Console logs created ({len(console_logs)} VMs)")

        # Check for boot messages
        has_output = False
        for log in console_logs:
            try:
                content = log.read_text()
                if "login" in content or "Welcome" in content or "Alpine" in content:
                    has_output = True
                    break
            except Exception:
                pass

        test_result(results, has_output, "VMs producing console output")
    else:
        test_result(results, False, "No console logs found")

    print()


def check_observability(results: TestResults) -> None:
    """Phase 8: Datadog integration check."""
    print("[Phase 8] Observability")
    print("----------------------")

    # Check Datadog agent
    result = run_cmd(["datadog-agent", "status"])
    if "DogStatsD" in result.stdout or "DogStatsD" in result.stderr:
        test_result(results, True, "Datadog agent running")
    else:
        test_result(results, False, "Datadog agent not running")

    # Check metrics in logs
    log_file = PROJECT_ROOT / "logs" / "vibecode.log"
    if log_file.exists():
        try:
            content = log_file.read_text()
            lines = content.splitlines()[-100:]
            has_metrics = any("vibecode.vm" in line for line in lines)
            if has_metrics:
                test_result(results, True, "App sending Datadog metrics")
            else:
                print("  ⏭️  SKIP: No metrics in logs yet")
        except Exception:
            print("  ⏭️  SKIP: Could not read logs")
    else:
        print("  ⏭️  SKIP: No log file found")

    print()


def cleanup(app_pid: int | None) -> None:
    """Cleanup running processes."""
    if app_pid:
        try:
            os.kill(app_pid, signal.SIGTERM)
        except OSError:
            pass
    time.sleep(2)
    run_cmd(["killall", "VibeCode"], check=False)


def print_final_report(results: TestResults) -> int:
    """Print final test report."""
    print("==========================================")
    print("Test Harness Results")
    print("==========================================")
    print()
    print(f"Total Tests: {results.total}")
    if results.total > 0:
        pct = results.passed * 100 // results.total
        print(f"Passed: {results.passed} ({pct}%)")
    else:
        print(f"Passed: {results.passed}")
    print(f"Failed: {results.failed}")
    print()

    if results.failed == 0:
        print("🎉 ALL TESTS PASSED - READY FOR MAIN")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED")
        print()
        print("Common Issues:")
        print("  - VMs not starting: Check EFI NVRAM files")
        print("  - Services not accessible: VMs may need services installed")
        print("  - Boot loader invalid: Copy EFI from working VM")
        print()
        print("Debug:")
        print(f"  tail -100 {PROJECT_ROOT}/logs/vibecode.log")
        print("  ./scripts/find-vm-ips.sh")
        print("  ./scripts/test-service-health.sh <ip>")
        return 1


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "--skip-launch",
        action="store_true",
        help="Skip launching the app (assume already running)",
    )

    args = parser.parse_args(argv)

    print("==========================================")
    print("Automated VM Test Harness")
    print("Staff Engineer Level - Full Automation")
    print("==========================================")
    print()

    results = TestResults(verbose=args.verbose)
    app_pid = None

    try:
        # Phase 1: Infrastructure
        validate_infrastructure(results)

        # Phase 2: Programmatic VM
        if not args.skip_launch:
            app_pid = test_programmatic_vm(results)
        else:
            print("[Phase 2] Skipped (--skip-launch)")
            print()

        # Phase 3: Running VMs
        validate_running_vms(results)

        # Phase 4: Service availability
        test_service_availability(results)

        # Phase 5: Service functionality
        test_service_functionality(results)

        # Phase 6: EFI validation
        validate_efi_config(results)

        # Phase 7: Console output
        check_console_output(results)

        # Phase 8: Observability
        check_observability(results)

    finally:
        # Cleanup
        cleanup(app_pid)

    return print_final_report(results)


if __name__ == "__main__":
    sys.exit(main())