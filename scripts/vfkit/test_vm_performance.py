#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "vfkit-test-vm-performance"
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

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


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

"""Test VM performance: optimized vs non-optimized.

Measures and compares boot times between optimized and non-optimized VMs.
"""

import argparse
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'


@dataclass
class BootResult:
    """Result of a boot time measurement."""

    vm_name: str
    boot_time: float
    success: bool


@dataclass
class TestConfig:
    """Test configuration."""

    boot_timeout: int = 60
    vfkit_base: Path = Path.home() / ".vfkit" / "vms"
    ready_marker: str = "System ready"


def measure_boot_time(
    vm_name: str,
    vm_dir: Path,
    launch_script: str,
    config: TestConfig
) -> BootResult:
    """Measure boot time for a VM.

    Args:
        vm_name: Name of the VM.
        vm_dir: Directory containing the VM.
        launch_script: Script to launch the VM.
        config: Test configuration.

    Returns:
        BootResult with timing information.
    """
    print(f"{BLUE}🚀 Testing {vm_name} boot time...{NC}")

    if not vm_dir.exists():
        print(f"{RED}❌ VM directory not found: {vm_dir}{NC}")
        return BootResult(vm_name=vm_name, boot_time=999.0, success=False)

    launch_path = vm_dir / launch_script
    if not launch_path.exists():
        print(f"{RED}❌ Launch script not found: {launch_path}{NC}")
        return BootResult(vm_name=vm_name, boot_time=999.0, success=False)

    console_log = vm_dir / "logs" / "console.log"

    # Clear old console log if exists
    if console_log.exists():
        console_log.unlink()

    # Start VM
    start_time = time.time()
    try:
        process = subprocess.Popen(
            [str(launch_path)],
            cwd=str(vm_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
    except Exception as e:
        print(f"{RED}❌ Failed to start VM: {e}{NC}")
        return BootResult(vm_name=vm_name, boot_time=999.0, success=False)

    # Wait for VM to boot
    boot_complete = False
    deadline = time.time() + config.boot_timeout

    while time.time() < deadline:
        if console_log.exists():
            try:
                content = console_log.read_text()
                if config.ready_marker in content:
                    boot_complete = True
                    break
            except (IOError, OSError):
                pass
        time.sleep(1)

    end_time = time.time()
    boot_time = end_time - start_time

    # Stop VM
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except (ProcessLookupError, OSError):
        pass

    time.sleep(2)

    if boot_complete:
        print(f"{GREEN}✅ {vm_name} booted in {boot_time:.2f}s{NC}")
        return BootResult(vm_name=vm_name, boot_time=boot_time, success=True)
    else:
        print(f"{RED}❌ {vm_name} failed to boot within {config.boot_timeout}s{NC}")
        return BootResult(vm_name=vm_name, boot_time=999.0, success=False)


def compare_results(
    non_optimized: BootResult,
    optimized: BootResult
) -> None:
    """Compare and display performance results.

    Args:
        non_optimized: Result from non-optimized VM.
        optimized: Result from optimized VM.
    """
    print()
    print(f"{BLUE}📈 Performance Comparison{NC}")
    print("=" * 40)
    print()
    print("Boot Time:")
    print(f"  • Non-optimized: {non_optimized.boot_time:.2f}s")
    print(f"  • Optimized: {optimized.boot_time:.2f}s")
    print()

    if optimized.boot_time < non_optimized.boot_time:
        improvement = (
            (non_optimized.boot_time - optimized.boot_time)
            / non_optimized.boot_time * 100
        )
        print(f"{GREEN}✅ Optimized VM is {improvement:.1f}% faster to boot{NC}")
    elif optimized.boot_time > non_optimized.boot_time:
        slowdown = (
            (optimized.boot_time - non_optimized.boot_time)
            / non_optimized.boot_time * 100
        )
        print(f"{RED}❌ Optimized VM is {slowdown:.1f}% slower to boot{NC}")
    else:
        print(f"{YELLOW}⚠ Boot times are equal{NC}")

    print()
    print(f"{BLUE}🎯 Conclusion:{NC}")
    if optimized.success and non_optimized.success:
        if optimized.boot_time < non_optimized.boot_time:
            print(f"{GREEN}✅ Kernel optimizations provide measurable "
                  f"performance benefits!{NC}")
        else:
            print(f"{RED}❌ Kernel optimizations do not provide measurable "
                  f"performance benefits.{NC}")
    else:
        print(f"{YELLOW}⚠ Unable to draw conclusions - one or more VMs "
              f"failed to boot{NC}")


def main(
    boot_timeout: int = 60,
    non_opt_vm: Optional[str] = None,
    opt_vm: Optional[str] = None
) -> int:
    """Main entry point.

    Args:
        boot_timeout: Timeout for VM boot in seconds.
        non_opt_vm: Path to non-optimized VM directory.
        opt_vm: Path to optimized VM directory.

    Returns:
        Exit code (0 for success).
    """
    print(f"{BLUE}🧪 VM Performance Test{NC}")
    print("=" * 40)
    print("Testing optimized vs non-optimized kernel performance")
    print()

    config = TestConfig(boot_timeout=boot_timeout)

    # Default VM paths
    non_opt_dir = Path(non_opt_vm) if non_opt_vm else (
        config.vfkit_base / "vibecode-working-alpine"
    )
    opt_dir = Path(opt_vm) if opt_vm else (
        config.vfkit_base / "vibecode-optimized-alpine"
    )

    print(f"{BLUE}📊 Performance Test Results{NC}")
    print("=" * 40)

    # Test non-optimized VM
    print()
    print(f"{BLUE}🔍 Testing Non-Optimized VM...{NC}")
    non_opt_result = measure_boot_time(
        "non-optimized",
        non_opt_dir,
        "launch.sh",
        config
    )

    # Test optimized VM
    print()
    print(f"{BLUE}🚀 Testing Optimized VM...{NC}")
    opt_result = measure_boot_time(
        "optimized",
        opt_dir,
        "launch.sh",
        config
    )

    # Compare results
    compare_results(non_opt_result, opt_result)

    return 0 if (non_opt_result.success and opt_result.success) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Test VM boot performance: optimized vs non-optimized"
    )
    parser.add_argument(
        '-t', '--timeout',
        type=int,
        default=60,
        help='Boot timeout in seconds (default: 60)'
    )
    parser.add_argument(
        '--non-optimized',
        help='Path to non-optimized VM directory'
    )
    parser.add_argument(
        '--optimized',
        help='Path to optimized VM directory'
    )

    args = parser.parse_args()
    sys.exit(main(args.timeout, args.non_optimized, args.optimized))