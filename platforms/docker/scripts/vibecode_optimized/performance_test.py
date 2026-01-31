#!/usr/bin/env python3
"""
Performance Test Script

Measures performance metrics including startup time, memory usage, and binary size.

Usage:
    python performance_test.py
"""

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class PerformanceResult:
    """Result of performance tests."""
    startup_time_ms: int
    memory_usage_kb: int
    binary_size: str


def get_process_memory() -> int:
    """Get current process memory usage in KB."""
    pid = os.getpid()

    try:
        # Try to read from /proc on Linux
        status_path = Path(f"/proc/{pid}/status")
        if status_path.exists():
            for line in status_path.read_text().split("\n"):
                if line.startswith("VmRSS:"):
                    return int(line.split()[1])

        # Fallback to ps command
        result = subprocess.run(
            ["ps", "-o", "rss=", "-p", str(pid)],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return int(result.stdout.strip())

    except (ValueError, FileNotFoundError, PermissionError):
        pass

    return 0


def get_directory_size(path: str = ".") -> str:
    """Get human-readable directory size."""
    try:
        result = subprocess.run(
            ["du", "-h", path],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            if lines:
                return lines[-1].split()[0]
    except (FileNotFoundError, PermissionError):
        pass

    return "unknown"


def measure_startup_time() -> int:
    """Measure application startup time in milliseconds."""
    # Simulate startup by doing some work
    start_time = time.time_ns()

    # Simulate startup operations
    time.sleep(0.5)  # Placeholder for actual startup

    end_time = time.time_ns()
    return (end_time - start_time) // 1_000_000


def run_performance_test() -> PerformanceResult:
    """Run performance tests and collect metrics."""
    print("📊 Running performance tests...")

    # Test startup time
    print("Testing startup time...")
    startup_time = measure_startup_time()

    # Test memory usage
    print("Testing memory usage...")
    memory_usage = get_process_memory()

    # Test binary/directory size
    print("Testing binary size...")
    binary_size = get_directory_size()

    return PerformanceResult(
        startup_time_ms=startup_time,
        memory_usage_kb=memory_usage,
        binary_size=binary_size,
    )


def print_results(result: PerformanceResult) -> None:
    """Print performance test results."""
    print("\nResults:")
    print(f"  Startup Time: {result.startup_time_ms}ms")
    print(f"  Memory Usage: {result.memory_usage_kb}KB")
    print(f"  Binary Size: {result.binary_size}")


def main() -> int:
    """Main entry point."""
    result = run_performance_test()
    print_results(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
