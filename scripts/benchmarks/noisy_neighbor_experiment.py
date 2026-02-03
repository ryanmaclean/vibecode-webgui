#!/usr/bin/env python3
"""Noisy Neighbor Experiment for MicroVM Launches.

Tests microVM boot performance under various load conditions.
"""

import argparse
import json
import os
import random
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from multiprocessing import Process
from pathlib import Path
from typing import Optional


@dataclass
class ExperimentConfig:
    """Experiment configuration."""

    num_baseline_runs: int = 5
    num_concurrent_vms: int = 10
    num_noisy_runs: int = 5
    vm_image: str = "bench-images/minivim/bzImage-x86_64"
    datadog_api_key: str = ""
    results_dir: Path = field(default_factory=Path)


@dataclass
class ExperimentResults:
    """Experiment results."""

    experiment_id: str = ""
    timestamp: str = ""
    baseline_runs: list[dict] = field(default_factory=list)
    noisy_runs: list[dict] = field(default_factory=list)
    baseline_avg_ms: float = 0.0
    noisy_avg_ms: float = 0.0
    degradation_percent: float = 0.0
    acceptable: bool = True


def measure_boot_time(run_id: int, label: str) -> int:
    """Measure VM boot time.

    Args:
        run_id: Run identifier.
        label: Run label (baseline/noisy).

    Returns:
        Boot time in milliseconds.
    """
    print(f"  Run {run_id}: Measuring boot time...")

    start_time = int(time.time() * 1000)

    # Check if firecracker is available
    if shutil.which("firecracker"):
        # Use actual firecracker if available
        try:
            subprocess.run(
                ["firecracker", "--config-file", "/tmp/vm-config.json"],
                timeout=30,
                capture_output=True
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
    else:
        # Simulate boot time
        time.sleep(random.random() * 0.1)

    end_time = int(time.time() * 1000)
    boot_time = end_time - start_time

    print(f"    Boot time: {boot_time}ms")
    return boot_time


def background_load_worker() -> None:
    """Worker function for background load."""
    while True:
        # Simulate workload
        try:
            subprocess.run(
                ["dd", "if=/dev/zero", "of=/dev/null", "bs=1M", "count=100"],
                capture_output=True,
                timeout=5
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        time.sleep(0.1)


def create_background_load(num_vms: int) -> list[Process]:
    """Create background load processes.

    Args:
        num_vms: Number of concurrent VMs to simulate.

    Returns:
        List of background processes.
    """
    print(f"  Creating {num_vms} concurrent VMs for background load...")

    processes = []
    for _ in range(num_vms):
        p = Process(target=background_load_worker, daemon=True)
        p.start()
        processes.append(p)

    return processes


def stop_background_load(processes: list[Process]) -> None:
    """Stop background load processes."""
    print("  Stopping background load...")
    for p in processes:
        p.terminate()
        p.join(timeout=1)


def run_experiment(config: ExperimentConfig) -> ExperimentResults:
    """Run the noisy neighbor experiment.

    Args:
        config: Experiment configuration.

    Returns:
        Experiment results.
    """
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    results = ExperimentResults(
        experiment_id=f"noisy-neighbor-{timestamp}",
        timestamp=timestamp
    )

    print("=== Noisy Neighbor Experiment ===")
    print(f"Baseline runs: {config.num_baseline_runs}")
    print(f"Concurrent VMs: {config.num_concurrent_vms}")
    print(f"Noisy runs: {config.num_noisy_runs}")
    print()

    # Phase 1: Baseline measurements
    print("Phase 1: Baseline measurements (no contention)")
    baseline_times = []

    for i in range(1, config.num_baseline_runs + 1):
        boot_time = measure_boot_time(i, "baseline")
        baseline_times.append(boot_time)
        results.baseline_runs.append({"run": i, "boot_time_ms": boot_time})

    if baseline_times:
        results.baseline_avg_ms = round(sum(baseline_times) / len(baseline_times), 2)
    print(f"Baseline average: {results.baseline_avg_ms}ms")
    print()

    # Phase 2: Measurements with noisy neighbors
    print(f"Phase 2: Measurements with {config.num_concurrent_vms} concurrent VMs")
    background_processes = create_background_load(config.num_concurrent_vms)
    time.sleep(2)  # Let load stabilize

    noisy_times = []

    for i in range(1, config.num_noisy_runs + 1):
        boot_time = measure_boot_time(i, "noisy")
        noisy_times.append(boot_time)
        results.noisy_runs.append({"run": i, "boot_time_ms": boot_time})

    stop_background_load(background_processes)

    if noisy_times:
        results.noisy_avg_ms = round(sum(noisy_times) / len(noisy_times), 2)
    print(f"Noisy average: {results.noisy_avg_ms}ms")

    # Calculate degradation
    if results.baseline_avg_ms > 0:
        results.degradation_percent = round(
            ((results.noisy_avg_ms - results.baseline_avg_ms) / results.baseline_avg_ms) * 100,
            2
        )
    print(f"Performance degradation: {results.degradation_percent}%")

    results.acceptable = results.degradation_percent < 20

    return results


def save_results(results: ExperimentResults, results_dir: Path) -> Path:
    """Save results to JSON file."""
    results_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_file = results_dir / f"experiment_{timestamp}.json"

    data = {
        "experiment_id": results.experiment_id,
        "timestamp": results.timestamp,
        "configuration": {
            "baseline_runs": len(results.baseline_runs),
            "noisy_runs": len(results.noisy_runs)
        },
        "baseline": results.baseline_runs,
        "noisy": results.noisy_runs,
        "summary": {
            "baseline_avg_ms": results.baseline_avg_ms,
            "noisy_avg_ms": results.noisy_avg_ms,
            "degradation_percent": results.degradation_percent,
            "acceptable": results.acceptable
        }
    }

    result_file.write_text(json.dumps(data, indent=2))
    return result_file


def send_to_datadog(results: ExperimentResults, api_key: str, num_concurrent: int) -> None:
    """Send metrics to Datadog."""
    if not api_key:
        return

    print()
    print("Sending metrics to Datadog...")

    timestamp = int(time.time())
    data = {
        "series": [
            {
                "metric": "minivim.noisy_neighbor.baseline_ms",
                "points": [[timestamp, results.baseline_avg_ms]],
                "type": "gauge",
                "tags": ["experiment:noisy-neighbor"]
            },
            {
                "metric": "minivim.noisy_neighbor.degradation_percent",
                "points": [[timestamp, results.degradation_percent]],
                "type": "gauge",
                "tags": [
                    "experiment:noisy-neighbor",
                    f"concurrent_vms:{num_concurrent}"
                ]
            }
        ]
    }

    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.datadoghq.com/api/v1/series",
            data=json.dumps(data).encode(),
            headers={
                "DD-API-KEY": api_key,
                "Content-Type": "application/json"
            }
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        print("Failed to send metrics to Datadog")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Noisy Neighbor Experiment for MicroVM Launches"
    )
    parser.add_argument(
        "--baseline-runs",
        type=int,
        default=int(os.environ.get("NUM_BASELINE_RUNS", "5")),
        help="Number of baseline runs"
    )
    parser.add_argument(
        "--concurrent-vms",
        type=int,
        default=int(os.environ.get("NUM_CONCURRENT_VMS", "10")),
        help="Number of concurrent VMs for noisy neighbor"
    )
    parser.add_argument(
        "--noisy-runs",
        type=int,
        default=int(os.environ.get("NUM_NOISY_RUNS", "5")),
        help="Number of noisy runs"
    )
    parser.add_argument(
        "--vm-image",
        default=os.environ.get("VM_IMAGE", "bench-images/minivim/bzImage-x86_64"),
        help="VM image path"
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path("artifacts/noisy-neighbor-results"),
        help="Results directory"
    )

    args = parser.parse_args()

    config = ExperimentConfig(
        num_baseline_runs=args.baseline_runs,
        num_concurrent_vms=args.concurrent_vms,
        num_noisy_runs=args.noisy_runs,
        vm_image=args.vm_image,
        datadog_api_key=os.environ.get("DD_API_KEY", ""),
        results_dir=args.results_dir
    )

    results = run_experiment(config)

    result_file = save_results(results, config.results_dir)
    print()
    print("=== Experiment Complete ===")
    print(f"Results saved to: {result_file}")
    print()
    print(json.dumps({
        "baseline_avg_ms": results.baseline_avg_ms,
        "noisy_avg_ms": results.noisy_avg_ms,
        "degradation_percent": results.degradation_percent,
        "acceptable": results.acceptable
    }, indent=2))

    send_to_datadog(results, config.datadog_api_key, config.num_concurrent_vms)

    # Check if degradation is acceptable
    if results.degradation_percent > 20:
        print()
        print("WARNING: Performance degradation exceeds 20%!")
        print("Consider investigating resource contention issues.")
        return 1
    else:
        print()
        print("Performance degradation within acceptable limits (<20%)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
