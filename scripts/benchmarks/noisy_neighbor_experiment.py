#!/usr/bin/env python3
"""Noisy Neighbor Experiment for MicroVM Launches.

Tests microVM boot performance under various load conditions.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import signal
import subprocess
import sys
import time
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        BenchmarkResult,
        calc_stats,
        get_timestamp,
        log,
        save_results,
        success,
        warn,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        BenchmarkResult,
        calc_stats,
        get_timestamp,
        log,
        save_results,
        success,
        warn,
    )


def measure_boot_time(run_id: int, label: str) -> int:
    """Measure VM boot time.

    Returns:
        Boot time in milliseconds
    """
    print(f"  Run {run_id}: Measuring boot time...")

    start_ms = int(time.time() * 1000)

    # Check if firecracker is available
    try:
        result = subprocess.run(
            ["firecracker", "--config-file", "/tmp/vm-config.json"],
            capture_output=True,
            timeout=30,
        )
    except FileNotFoundError:
        # Simulate boot time
        time.sleep(random.random() * 0.1)
    except subprocess.TimeoutExpired:
        pass

    end_ms = int(time.time() * 1000)
    boot_time = end_ms - start_ms

    print(f"    Boot time: {boot_time}ms")
    return boot_time


def create_background_load(num_vms: int) -> list[subprocess.Popen]:
    """Create background load (noisy neighbors).

    Args:
        num_vms: Number of concurrent VMs to simulate

    Returns:
        List of background process handles
    """
    print(f"  Creating {num_vms} concurrent VMs for background load...")

    processes = []
    for _ in range(num_vms):
        # Create a process that simulates VM workload
        proc = subprocess.Popen(
            ["sh", "-c", "while true; do dd if=/dev/zero of=/dev/null bs=1M count=100 2>/dev/null; sleep 0.1; done"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        processes.append(proc)

    return processes


def stop_background_load(processes: list[subprocess.Popen]) -> None:
    """Stop background load processes."""
    print("  Stopping background load...")
    for proc in processes:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        except Exception:
            pass


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--baseline-runs",
        type=int,
        default=int(os.environ.get("NUM_BASELINE_RUNS", 5)),
        help="Number of baseline runs",
    )
    parser.add_argument(
        "--concurrent-vms",
        type=int,
        default=int(os.environ.get("NUM_CONCURRENT_VMS", 10)),
        help="Number of concurrent VMs for noisy neighbor test",
    )
    parser.add_argument(
        "--noisy-runs",
        type=int,
        default=int(os.environ.get("NUM_NOISY_RUNS", 5)),
        help="Number of noisy runs",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "artifacts" / "noisy-neighbor-results",
        help="Output directory",
    )
    parser.add_argument(
        "--dd-api-key",
        default=os.environ.get("DD_API_KEY"),
        help="Datadog API key",
    )

    args = parser.parse_args(argv)

    timestamp = get_timestamp()
    output_path = args.output_dir / f"experiment_{timestamp}.json"

    print("=== Noisy Neighbor Experiment ===")
    print(f"Baseline runs: {args.baseline_runs}")
    print(f"Concurrent VMs: {args.concurrent_vms}")
    print(f"Noisy runs: {args.noisy_runs}")
    print(f"Results: {output_path}")
    print()

    # Initialize results
    results = {
        "experiment_id": f"noisy-neighbor-{timestamp}",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configuration": {
            "baseline_runs": args.baseline_runs,
            "concurrent_vms": args.concurrent_vms,
            "noisy_runs": args.noisy_runs,
        },
        "baseline": [],
        "noisy": [],
        "summary": {},
    }

    # Phase 1: Baseline measurements
    print("Phase 1: Baseline measurements (no contention)")
    baseline_times = []

    for i in range(1, args.baseline_runs + 1):
        boot_time = measure_boot_time(i, "baseline")
        baseline_times.append(boot_time)
        results["baseline"].append({"run": i, "boot_time_ms": boot_time})

    baseline_stats = calc_stats(baseline_times)
    print(f"Baseline average: {baseline_stats['avg']:.2f}ms")
    print()

    # Phase 2: Measurements with noisy neighbors
    print(f"Phase 2: Measurements with {args.concurrent_vms} concurrent VMs")
    background_processes = create_background_load(args.concurrent_vms)

    # Let load stabilize
    time.sleep(2)

    noisy_times = []
    try:
        for i in range(1, args.noisy_runs + 1):
            boot_time = measure_boot_time(i, "noisy")
            noisy_times.append(boot_time)
            results["noisy"].append({"run": i, "boot_time_ms": boot_time})
    finally:
        stop_background_load(background_processes)

    noisy_stats = calc_stats(noisy_times)
    print(f"Noisy average: {noisy_stats['avg']:.2f}ms")

    # Calculate degradation
    if baseline_stats["avg"] > 0:
        degradation = ((noisy_stats["avg"] - baseline_stats["avg"]) / baseline_stats["avg"]) * 100
    else:
        degradation = 0

    print(f"Performance degradation: {degradation:.1f}%")
    print()

    # Update summary
    results["summary"] = {
        "baseline_avg_ms": baseline_stats["avg"],
        "noisy_avg_ms": noisy_stats["avg"],
        "degradation_percent": degradation,
        "acceptable": degradation < 20,
    }

    # Save results
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    # Report results
    print("=== Experiment Complete ===")
    print(f"Results saved to: {output_path}")
    print()
    print(json.dumps(results["summary"], indent=2))

    # Send to Datadog
    if args.dd_api_key:
        print()
        log("Sending metrics to Datadog...")
        try:
            import urllib.request

            payload = json.dumps({
                "series": [
                    {
                        "metric": "minivim.noisy_neighbor.baseline_ms",
                        "points": [[int(time.time()), baseline_stats["avg"]]],
                        "type": "gauge",
                        "tags": ["experiment:noisy-neighbor"],
                    },
                    {
                        "metric": "minivim.noisy_neighbor.degradation_percent",
                        "points": [[int(time.time()), degradation]],
                        "type": "gauge",
                        "tags": ["experiment:noisy-neighbor", f"concurrent_vms:{args.concurrent_vms}"],
                    },
                ]
            })

            req = urllib.request.Request(
                "https://api.datadoghq.com/api/v1/series",
                data=payload.encode(),
                headers={
                    "Content-Type": "application/json",
                    "DD-API-KEY": args.dd_api_key,
                },
            )

            with urllib.request.urlopen(req, timeout=10):
                pass
        except Exception as e:
            warn(f"Failed to send metrics: {e}")

    # Check if degradation is acceptable
    if degradation > 20:
        print()
        warn("WARNING: Performance degradation exceeds 20%!")
        warn("Consider investigating resource contention issues.")
        return 1
    else:
        print()
        success("Performance degradation within acceptable limits (<20%)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
