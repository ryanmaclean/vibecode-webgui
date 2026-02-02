#!/usr/bin/env python3


"""Test VM performance: optimized vs non-optimized kernel."""

from __future__ import annotations
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

import argparse
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from .log import COLORS, log_error, log_success, log_warn


@dataclass
class VMConfig:
    """VM configuration for performance testing."""

    name: str
    vm_dir: Path
    launch_script: str = "launch.sh"


def get_vfkit_home() -> Path:
    """Get the vfkit home directory."""
    return Path.home() / ".vfkit" / "vms"


def measure_boot_time(config: VMConfig, boot_timeout: int = 60) -> float | None:
    """Measure VM boot time.

    Returns boot time in seconds, or None if boot failed.
    """
    print(f"\U0001f680 Testing {config.name} boot time...")

    launch_script = config.vm_dir / config.launch_script
    if not launch_script.exists():
        log_error(f"Launch script not found: {launch_script}")
        return None

    console_log = config.vm_dir / "logs" / "console.log"

    # Clear old console log
    if console_log.exists():
        console_log.unlink()

    # Start VM
    start_time = time.time()
    try:
        process = subprocess.Popen(
            [str(launch_script)],
            cwd=config.vm_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError as exc:
        log_error(f"Failed to start VM: {exc}")
        return None

    vm_pid = process.pid
    boot_complete = False

    # Wait for boot completion
    deadline = time.time() + boot_timeout
    while time.time() < deadline:
        if console_log.exists():
            try:
                content = console_log.read_text()
                if "System ready" in content:
                    boot_complete = True
                    break
            except OSError:
                pass
        time.sleep(1)

    end_time = time.time()
    boot_time = end_time - start_time

    # Stop VM
    try:
        os.kill(vm_pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

    time.sleep(2)

    if boot_complete:
        log_success(f"{config.name} booted in {boot_time:.2f}s")
        return boot_time
    else:
        log_error(f"{config.name} failed to boot within {boot_timeout}s")
        return None


def compare_performance(
    non_opt_time: float | None,
    opt_time: float | None,
) -> None:
    """Compare and display performance results."""
    print()
    print(f"{COLORS.blue}\U0001f4c8 Performance Comparison{COLORS.reset}")
    print("========================")

    print("\nBoot Time:")
    if non_opt_time is not None:
        print(f"\u2022 Non-optimized: {non_opt_time:.2f}s")
    else:
        print("\u2022 Non-optimized: Failed")

    if opt_time is not None:
        print(f"\u2022 Optimized: {opt_time:.2f}s")
    else:
        print("\u2022 Optimized: Failed")

    if non_opt_time is not None and opt_time is not None:
        if opt_time < non_opt_time:
            improvement = ((non_opt_time - opt_time) / non_opt_time) * 100
            log_success(f"Optimized VM is {improvement:.1f}% faster to boot")
        elif opt_time > non_opt_time:
            slowdown = ((opt_time - non_opt_time) / non_opt_time) * 100
            log_warn(f"Optimized VM is {slowdown:.1f}% slower to boot")
        else:
            print("Both VMs have the same boot time")

    print()
    print(f"{COLORS.blue}\U0001f3af Conclusion:{COLORS.reset}")
    if non_opt_time is not None and opt_time is not None and opt_time < non_opt_time:
        log_success("Kernel optimizations provide measurable performance benefits!")
    elif non_opt_time is None or opt_time is None:
        log_error("Unable to compare - one or both VMs failed to boot")
    else:
        log_warn("Kernel optimizations do not provide measurable performance benefits.")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Test VM performance: optimized vs non-optimized kernel",
    )
    parser.add_argument(
        "--non-optimized-dir",
        type=Path,
        default=get_vfkit_home() / "vibecode-working-alpine",
        help="Path to non-optimized VM directory",
    )
    parser.add_argument(
        "--optimized-dir",
        type=Path,
        default=get_vfkit_home() / "vibecode-optimized-alpine",
        help="Path to optimized VM directory",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="Boot timeout in seconds",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    print(f"\U0001f9ea VM Performance Test")
    print("====================")
    print("Testing optimized vs non-optimized kernel performance")
    print()

    print(f"{COLORS.blue}\U0001f4ca Performance Test Results{COLORS.reset}")
    print("==========================")

    # Test non-optimized VM
    print()
    print("\U0001f50d Testing Non-Optimized VM...")
    non_opt_config = VMConfig(
        name="non-optimized",
        vm_dir=args.non_optimized_dir,
    )
    non_opt_time = measure_boot_time(non_opt_config, args.timeout)

    # Test optimized VM
    print()
    print("\U0001f680 Testing Optimized VM...")
    opt_config = VMConfig(
        name="optimized",
        vm_dir=args.optimized_dir,
    )
    opt_time = measure_boot_time(opt_config, args.timeout)

    # Compare results
    compare_performance(non_opt_time, opt_time)

    # Return success if at least one VM booted
    if non_opt_time is not None or opt_time is not None:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())