#!/usr/bin/env python3
"""VibeCode Desktop App Simple Performance Benchmark.

Measures key metrics without requiring UI automation:
- Binary size
- Startup time (process-based)
- Memory usage (RSS/VSZ)
- CPU usage

Usage: ./scripts/benchmark_desktop_simple.py
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


# ANSI color codes
class Colors:
    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.GREEN = cls.BLUE = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log_info(msg: str) -> None:
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {msg}")


def log_warn(msg: str) -> None:
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")


RESULTS_DIR = Path("./performance-results/desktop")


@dataclass
class SystemInfo:
    """System information."""

    platform: str
    os_version: str
    cpu: str
    memory_gb: int


@dataclass
class BinarySizeMetrics:
    """Binary size metrics."""

    binary_bytes: int = 0
    binary_mb: float = 0.0
    bundle_bytes: int = 0
    bundle_mb: float = 0.0


@dataclass
class StartupMetrics:
    """Startup time metrics."""

    runs: int = 3
    times: list[float] = field(default_factory=list)
    average_seconds: float = 0.0
    note: str = "Process launch time (simplified measurement)"


@dataclass
class MemoryMetrics:
    """Memory usage metrics."""

    idle_rss_mb: float = 0.0
    idle_vsz_mb: float = 0.0
    note: str = "Measured after 5s stabilization"


@dataclass
class CpuMetrics:
    """CPU usage metrics."""

    idle_average_percent: float = 0.0
    samples: list[float] = field(default_factory=list)


def run_cmd(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def get_system_info() -> SystemInfo:
    """Get system information."""
    platform = os.uname().sysname
    os_version = ""
    cpu = ""
    memory_gb = 0

    if platform == "Darwin":
        result = run_cmd(["sw_vers", "-productVersion"])
        os_version = result.stdout.strip()

        result = run_cmd(["sysctl", "-n", "machdep.cpu.brand_string"])
        cpu = result.stdout.strip()

        result = run_cmd(["sysctl", "-n", "hw.memsize"])
        try:
            memory_gb = int(int(result.stdout.strip()) / 1024 / 1024 / 1024)
        except ValueError:
            memory_gb = 0
    else:
        os_version = os.uname().release
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        cpu = line.split(":")[1].strip()
                        break
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal"):
                        mem_kb = int(line.split()[1])
                        memory_gb = mem_kb // 1024 // 1024
                        break
        except (OSError, ValueError):
            pass

    return SystemInfo(
        platform=platform,
        os_version=os_version,
        cpu=cpu,
        memory_gb=memory_gb,
    )


def kill_process(name: str) -> None:
    """Kill processes by name."""
    run_cmd(["pkill", "-9", name], check=False)


def get_file_size(path: Path) -> int:
    """Get file size in bytes."""
    try:
        return path.stat().st_size
    except OSError:
        return 0


def get_directory_size(path: Path) -> int:
    """Get directory size in bytes."""
    try:
        total = 0
        for entry in path.rglob("*"):
            if entry.is_file():
                total += entry.stat().st_size
        return total
    except OSError:
        return 0


def measure_binary_size(binary_path: Path, bundle_path: Path) -> BinarySizeMetrics:
    """Measure binary and bundle sizes."""
    log_info("Measuring binary size...")

    if not binary_path.exists():
        log_warn("Binary not found, building...")
        result = run_cmd(["npm", "run", "tauri:build"], check=False)
        if result.returncode != 0:
            log_warn("Build failed, skipping binary size measurement")
            return BinarySizeMetrics()

    binary_bytes = get_file_size(binary_path)
    binary_mb = round(binary_bytes / 1024 / 1024, 2)

    bundle_bytes = 0
    bundle_mb = 0.0
    if bundle_path.exists():
        bundle_bytes = get_directory_size(bundle_path)
        bundle_mb = round(bundle_bytes / 1024 / 1024, 2)

    log_info(f"  Binary: {binary_mb}MB")
    log_info(f"  Bundle: {bundle_mb}MB")

    return BinarySizeMetrics(
        binary_bytes=binary_bytes,
        binary_mb=binary_mb,
        bundle_bytes=bundle_bytes,
        bundle_mb=bundle_mb,
    )


def measure_startup(app_path: Path, runs: int = 3) -> StartupMetrics:
    """Measure startup time."""
    log_info(f"Measuring startup time ({runs} runs)...")

    times: list[float] = []

    for i in range(1, runs + 1):
        # Kill any existing instances
        kill_process("vibecode")
        time.sleep(2)

        # Measure time to launch
        start = time.time()

        # Launch app
        proc = subprocess.Popen(
            [str(app_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait for process to stabilize
        time.sleep(3)

        end = time.time()
        duration = round(end - start, 3)
        times.append(duration)

        log_info(f"  Run {i}: {duration}s (PID: {proc.pid})")

        # Kill it
        try:
            proc.kill()
        except OSError:
            pass
        time.sleep(1)

    avg = round(sum(times) / len(times), 2)

    return StartupMetrics(
        runs=runs,
        times=times,
        average_seconds=avg,
    )


def measure_memory(app_path: Path) -> MemoryMetrics:
    """Measure memory usage."""
    log_info("Measuring memory usage...")

    # Kill any existing
    kill_process("vibecode")
    time.sleep(2)

    # Launch app
    proc = subprocess.Popen(
        [str(app_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait to stabilize
    time.sleep(5)

    # Get memory metrics
    rss_kb = 0
    vsz_kb = 0

    result = run_cmd(["ps", "-o", "rss=,vsz=", "-p", str(proc.pid)])
    if result.returncode == 0 and result.stdout.strip():
        parts = result.stdout.strip().split()
        if len(parts) >= 2:
            try:
                rss_kb = int(parts[0])
                vsz_kb = int(parts[1])
            except ValueError:
                pass

    rss_mb = round(rss_kb / 1024, 2)
    vsz_mb = round(vsz_kb / 1024, 2)

    log_info(f"  RSS: {rss_mb}MB")
    log_info(f"  VSZ: {vsz_mb}MB")

    # Kill it
    try:
        proc.kill()
    except OSError:
        pass

    return MemoryMetrics(
        idle_rss_mb=rss_mb,
        idle_vsz_mb=vsz_mb,
    )


def measure_cpu(app_path: Path, samples: int = 5) -> CpuMetrics:
    """Measure CPU usage."""
    log_info("Measuring CPU usage...")

    # Kill any existing
    kill_process("vibecode")
    time.sleep(2)

    # Launch app
    proc = subprocess.Popen(
        [str(app_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait to stabilize
    time.sleep(5)

    # Sample CPU
    cpu_samples: list[float] = []
    for _ in range(samples):
        result = run_cmd(["ps", "-o", "%cpu=", "-p", str(proc.pid)])
        if result.returncode == 0 and result.stdout.strip():
            try:
                cpu_samples.append(float(result.stdout.strip()))
            except ValueError:
                cpu_samples.append(0.0)
        else:
            cpu_samples.append(0.0)
        time.sleep(2)

    avg_cpu = round(sum(cpu_samples) / len(cpu_samples), 2) if cpu_samples else 0.0

    log_info(f"  Average CPU: {avg_cpu}%")

    # Kill it
    try:
        proc.kill()
    except OSError:
        pass

    return CpuMetrics(
        idle_average_percent=avg_cpu,
        samples=cpu_samples,
    )


def dataclass_to_dict(obj: Any) -> dict[str, Any]:
    """Convert dataclass to dict, handling nested dataclasses."""
    if hasattr(obj, "__dataclass_fields__"):
        return {k: dataclass_to_dict(v) for k, v in obj.__dict__.items()}
    elif isinstance(obj, list):
        return [dataclass_to_dict(item) for item in obj]
    return obj


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=RESULTS_DIR,
        help=f"Output directory for results (default: {RESULTS_DIR})",
    )
    parser.add_argument(
        "--binary",
        type=Path,
        default=Path("./src-tauri/target/release/vibecode"),
        help="Path to the binary",
    )
    parser.add_argument(
        "--bundle",
        type=Path,
        default=Path("./src-tauri/target/release/bundle/macos/VibeCode.app"),
        help="Path to the bundle",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    results_dir = args.output_dir
    results_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = results_dir / f"benchmark_{timestamp}.json"

    print(f"{Colors.BLUE}\u2554{'=' * 60}\u2557{Colors.NC}")
    print(f"{Colors.BLUE}\u2551  VibeCode Desktop Performance Benchmark (Simple)          \u2551{Colors.NC}")
    print(f"{Colors.BLUE}\u255a{'=' * 60}\u255d{Colors.NC}")
    print()

    log_info("Starting simplified benchmark suite...")
    print()

    # Get system info
    system_info = get_system_info()

    # Run benchmarks
    binary_size = measure_binary_size(args.binary, args.bundle)
    startup = measure_startup(args.binary)
    memory = measure_memory(args.binary)
    cpu = measure_cpu(args.binary)

    # Build results
    results = {
        "timestamp": timestamp,
        "platform": system_info.platform,
        "os_version": system_info.os_version,
        "cpu": system_info.cpu,
        "memory_gb": system_info.memory_gb,
        "benchmarks": {
            "binary_size": dataclass_to_dict(binary_size),
            "startup_time": dataclass_to_dict(startup),
            "memory_usage": dataclass_to_dict(memory),
            "cpu_usage": dataclass_to_dict(cpu),
        },
    }

    # Save results
    results_file.write_text(json.dumps(results, indent=2))

    print()
    log_info("\u2705 Benchmarks complete!")
    log_info(f"Results saved to: {results_file}")
    print()

    # Display results
    print(f"{Colors.BLUE}\u2554{'=' * 60}\u2557{Colors.NC}")
    print(f"{Colors.BLUE}\u2551  Results Summary                                           \u2551{Colors.NC}")
    print(f"{Colors.BLUE}\u255a{'=' * 60}\u255d{Colors.NC}")
    print()
    print(json.dumps(results, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
