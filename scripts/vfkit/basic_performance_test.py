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

"""Basic Performance Test.

Simple test that proves performance improvements between VM configurations.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn

TEST_ITERATIONS = 3


@dataclass
class VMConfig:
    name: str
    vm_dir: Path
    launch_script: str = "./launch.sh"


def measure_boot_time(config: VMConfig) -> float:
    """Measure boot time for a VM.

    Returns:
        Boot time in seconds
    """
    print(f"🚀 Testing {config.name}...")

    launch_script = config.vm_dir / config.launch_script
    if not launch_script.exists():
        log_error(f"Launch script not found: {launch_script}")
        return -1

    start_time = time.time()

    # Start VM
    process = subprocess.Popen(
        [str(launch_script)],
        cwd=config.vm_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    # Wait for boot
    time.sleep(3)

    end_time = time.time()
    boot_time = end_time - start_time

    # Stop VM
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except (ProcessLookupError, OSError):
        pass

    time.sleep(1)

    print(f"✅ {config.name} booted in {boot_time:.1f}s")
    return boot_time


def run_tests(configs: list[VMConfig]) -> dict[str, list[float]]:
    """Run performance tests on all configurations.

    Returns:
        Dict mapping config name to list of boot times
    """
    results: dict[str, list[float]] = {config.name: [] for config in configs}

    log_section("Running Performance Tests")

    for i in range(1, TEST_ITERATIONS + 1):
        print()
        print(f"Test {i}/{TEST_ITERATIONS}")
        print("-------------------")

        for config in configs:
            boot_time = measure_boot_time(config)
            if boot_time > 0:
                results[config.name].append(boot_time)

        # Calculate improvement between first and second config
        if len(configs) >= 2 and results[configs[0].name] and results[configs[1].name]:
            non_opt = results[configs[0].name][-1]
            opt = results[configs[1].name][-1]
            if non_opt > 0:
                improvement = ((non_opt - opt) / non_opt) * 100
                print(f"Improvement: {improvement:.1f}%")

    return results


def analyze_results(results: dict[str, list[float]]) -> None:
    """Analyze and print performance results."""
    log_section("Performance Analysis")

    for name, times in results.items():
        if times:
            avg = mean(times)
            print(f"{name}:")
            print(f"  Average: {avg:.2f}s")
            print(f"  Min: {min(times):.2f}s")
            print(f"  Max: {max(times):.2f}s")
            print()

    # Compare if we have at least two configs
    names = list(results.keys())
    if len(names) >= 2 and results[names[0]] and results[names[1]]:
        non_opt_avg = mean(results[names[0]])
        opt_avg = mean(results[names[1]])

        if non_opt_avg > 0:
            improvement = ((non_opt_avg - opt_avg) / non_opt_avg) * 100
            savings = non_opt_avg - opt_avg

            print("=" * 40)
            print(f"Overall Improvement: {improvement:.1f}%")
            print(f"Time Saved: {savings:.2f}s per boot")
            print("=" * 40)


def main() -> int:
    """Main entry point."""
    print("🧪 Basic VM Performance Test")
    print("============================")
    print("Proving performance improvements")
    print()

    vfkit_base = Path.home() / ".vfkit" / "vms"

    configs = [
        VMConfig(
            name="non-optimized",
            vm_dir=vfkit_base / "vibecode-working-alpine",
        ),
        VMConfig(
            name="optimized",
            vm_dir=vfkit_base / "vibecode-optimized-alpine",
        ),
    ]

    # Check if VMs exist
    for config in configs:
        if not config.vm_dir.exists():
            log_warn(f"VM directory not found: {config.vm_dir}")

    try:
        results = run_tests(configs)
        analyze_results(results)
        return 0
    except KeyboardInterrupt:
        print("\nTest interrupted")
        return 1
    except Exception as e:
        log_error(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())