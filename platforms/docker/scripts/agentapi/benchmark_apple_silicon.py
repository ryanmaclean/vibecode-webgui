#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Apple Silicon Performance Benchmark Suite for AgentAPI

Tests: Startup time, CPU efficiency, memory usage, I/O performance, power consumption
Target: M1/M2/M3 with OrbStack runtime

Usage:
    python benchmark_apple_silicon.py
"""

import csv
import os
import platform
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes for terminal output."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class BenchmarkConfig:
    """Configuration for benchmarks."""
    compose_file: str = "docker-compose.agentapi.apple-silicon.yml"
    service_name: str = "agentapi"
    container_name: str = "vibecode-agentapi"
    results_dir: str = "./benchmark-results"
    iterations: int = 10


@dataclass
class BenchmarkResult:
    """Result of a benchmark run."""
    name: str
    values: dict = field(default_factory=dict)


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Color.BLUE}[INFO]{Color.NC} {message}")


def log_success(message: str) -> None:
    """Print success message."""
    print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")


def log_warning(message: str) -> None:
    """Print warning message."""
    print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def get_ms() -> int:
    """Get current time in milliseconds."""
    return int(time.time() * 1000)


def run_command(cmd: list[str], capture: bool = False, timeout: int = 60) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def check_apple_silicon() -> bool:
    """Check if running on Apple Silicon."""
    if platform.machine() != "arm64":
        log_error("Not running on Apple Silicon (ARM64)")
        return False

    try:
        result = subprocess.run(
            ["sysctl", "-n", "machdep.cpu.brand_string"],
            capture_output=True,
            text=True,
        )
        cpu_brand = result.stdout.strip()
        log_success(f"Detected Apple Silicon: {cpu_brand}")
        return True
    except Exception:
        return True  # Assume ARM64 is Apple Silicon


def get_core_info() -> str:
    """Get CPU core information."""
    try:
        perf_cores = subprocess.run(
            ["sysctl", "-n", "hw.perflevel0.physicalcpu"],
            capture_output=True, text=True
        ).stdout.strip() or "0"

        eff_cores = subprocess.run(
            ["sysctl", "-n", "hw.perflevel1.physicalcpu"],
            capture_output=True, text=True
        ).stdout.strip() or "0"

        return f"{perf_cores}P + {eff_cores}E"
    except Exception:
        return "Unknown"


def get_total_memory() -> str:
    """Get total system memory."""
    try:
        result = subprocess.run(
            ["sysctl", "-n", "hw.memsize"],
            capture_output=True, text=True
        )
        mem_bytes = int(result.stdout.strip())
        mem_gb = mem_bytes / (1024 * 1024 * 1024)
        return f"{mem_gb:.0f} GB"
    except Exception:
        return "Unknown"


def get_docker_version() -> str:
    """Get Docker version."""
    try:
        result = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True, text=True
        )
        return result.stdout.strip()
    except Exception:
        return "Unknown"


def benchmark_startup(config: BenchmarkConfig, timestamp: str) -> BenchmarkResult:
    """Benchmark container startup time."""
    log_info("=== Benchmark 1: Container Startup Time ===")

    results_file = Path(config.results_dir) / f"startup_{timestamp}.csv"
    result = BenchmarkResult(name="startup")

    with open(results_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["iteration", "stop_ms", "start_ms", "health_ms", "total_ms"])

        totals = []

        for i in range(1, config.iterations + 1):
            log_info(f"Iteration {i}/{config.iterations}")

            # Stop and remove container
            stop_start = get_ms()
            run_command(["docker", "stop", config.container_name], capture=True)
            run_command(["docker", "rm", config.container_name], capture=True)
            time.sleep(1)
            stop_end = get_ms()
            stop_duration = stop_end - stop_start

            # Start container
            start_start = get_ms()
            run_command([
                "docker-compose", "-f", config.compose_file,
                "up", "-d", config.service_name
            ], capture=True)
            start_end = get_ms()
            start_duration = start_end - start_start

            # Wait for health check
            health_start = get_ms()
            timeout = 30
            for _ in range(timeout * 2):
                rc, stdout, _ = run_command([
                    "docker", "inspect", config.container_name,
                    "--format", "{{.State.Health.Status}}"
                ], capture=True)
                if stdout.strip() == "healthy":
                    break
                time.sleep(0.5)
            health_end = get_ms()
            health_duration = health_end - health_start
            total_duration = health_end - stop_start

            writer.writerow([i, stop_duration, start_duration, health_duration, total_duration])
            totals.append(total_duration)

            log_info(f"Total: {total_duration}ms (stop: {stop_duration}ms, start: {start_duration}ms, health: {health_duration}ms)")
            time.sleep(2)

    # Calculate statistics
    avg_total = sum(totals) / len(totals) if totals else 0
    result.values["avg_total_ms"] = avg_total

    log_success(f"Startup benchmark complete: {results_file}")
    print(f"\nAverage startup time: {avg_total:.0f}ms")

    if avg_total < 300:
        log_success(f"✓ Target met: {avg_total:.0f}ms < 300ms")
    else:
        log_warning(f"✗ Target missed: {avg_total:.0f}ms >= 300ms")

    return result


def benchmark_memory(config: BenchmarkConfig, timestamp: str) -> BenchmarkResult:
    """Benchmark memory usage."""
    log_info("=== Benchmark 3: Memory Usage ===")

    results_file = Path(config.results_dir) / f"memory_{timestamp}.csv"
    result = BenchmarkResult(name="memory")

    # Ensure container is running
    run_command([
        "docker-compose", "-f", config.compose_file,
        "up", "-d", config.service_name
    ], capture=True)
    time.sleep(5)

    with open(results_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "memory_mb", "memory_percent"])

        memory_values = []

        log_info("Monitoring memory usage for 60 seconds...")
        for _ in range(12):
            ts = int(time.time())

            rc, stdout, _ = run_command([
                "docker", "stats", config.container_name,
                "--no-stream", "--format", "{{.MemUsage}}"
            ], capture=True)

            # Parse memory usage like "100MiB / 2GiB"
            try:
                mem_part = stdout.split("/")[0].strip()
                if "MiB" in mem_part:
                    mem_mb = float(mem_part.replace("MiB", "").strip())
                elif "GiB" in mem_part:
                    mem_mb = float(mem_part.replace("GiB", "").strip()) * 1024
                else:
                    mem_mb = 0
            except (ValueError, IndexError):
                mem_mb = 0

            rc, stdout, _ = run_command([
                "docker", "stats", config.container_name,
                "--no-stream", "--format", "{{.MemPerc}}"
            ], capture=True)
            mem_percent = float(stdout.strip().replace("%", "") or "0")

            writer.writerow([ts, mem_mb, mem_percent])
            memory_values.append(mem_mb)

            time.sleep(5)

    avg_mem = sum(memory_values) / len(memory_values) if memory_values else 0
    result.values["avg_memory_mb"] = avg_mem

    log_success(f"Memory benchmark complete: {results_file}")
    print(f"\nAverage memory usage: {avg_mem:.0f}MB")

    if avg_mem < 512:
        log_success(f"✓ Target met: {avg_mem:.0f}MB < 512MB")
    else:
        log_warning(f"✗ Target missed: {avg_mem:.0f}MB >= 512MB")

    return result


def benchmark_api_latency(config: BenchmarkConfig, timestamp: str) -> BenchmarkResult:
    """Benchmark API latency."""
    log_info("=== Benchmark 5: API Latency ===")

    results_file = Path(config.results_dir) / f"api_latency_{timestamp}.txt"
    result = BenchmarkResult(name="api_latency")

    # Ensure container is running
    run_command([
        "docker-compose", "-f", config.compose_file,
        "up", "-d", config.service_name
    ], capture=True)
    time.sleep(5)

    # Wait for API to be ready
    ready = False
    for _ in range(30):
        rc, _, _ = run_command([
            "curl", "-f", "-s", "http://localhost:3284/health"
        ], capture=True)
        if rc == 0:
            ready = True
            break
        time.sleep(1)

    if not ready:
        log_error("API not ready after 30 seconds")
        return result

    # Check if hey is available
    if shutil.which("hey"):
        log_info("Running load test with hey (10000 requests, 100 concurrent)...")
        rc, stdout, _ = run_command([
            "hey", "-n", "10000", "-c", "100", "-m", "GET",
            "http://localhost:3284/health"
        ], capture=True, timeout=120)

        with open(results_file, "w") as f:
            f.write(stdout)

        log_success(f"API latency benchmark complete: {results_file}")
    else:
        log_warning("hey not installed, using simple curl test...")

        log_info("Testing API latency (100 requests)...")
        total_time = 0
        for _ in range(100):
            start = get_ms()
            run_command([
                "curl", "-f", "-s", "http://localhost:3284/health"
            ], capture=True)
            end = get_ms()
            total_time += (end - start)

        avg_latency = total_time / 100
        result.values["avg_latency_ms"] = avg_latency

        with open(results_file, "w") as f:
            f.write(f"Average latency: {avg_latency}ms\n")

        log_success(f"API latency benchmark complete: {results_file}")
        log_info(f"Average latency: {avg_latency}ms")

    return result


def generate_summary(config: BenchmarkConfig, timestamp: str, results: list[BenchmarkResult]) -> None:
    """Generate summary report."""
    summary_file = Path(config.results_dir) / f"summary_{timestamp}.txt"

    with open(summary_file, "w") as f:
        f.write("Apple Silicon AgentAPI Benchmark Summary\n")
        f.write("=" * 40 + "\n\n")
        f.write("System Information:\n")
        f.write(f"  Platform: {platform.machine()}\n")
        try:
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True
            )
            f.write(f"  CPU: {result.stdout.strip()}\n")
        except Exception:
            pass
        f.write(f"  Cores: {get_core_info()}\n")
        f.write(f"  Memory: {get_total_memory()}\n")
        f.write(f"\nBenchmark Results:\n")
        f.write(f"  - Startup time: See startup_{timestamp}.csv\n")
        f.write(f"  - Memory usage: See memory_{timestamp}.csv\n")
        f.write(f"  - API latency: See api_latency_{timestamp}.txt\n")
        f.write(f"\nTimestamp: {datetime.now().isoformat()}\n")

    log_info(f"Summary report: {summary_file}")


def run_benchmarks(config: Optional[BenchmarkConfig] = None) -> int:
    """Run all benchmarks."""
    if config is None:
        config = BenchmarkConfig(
            compose_file=os.environ.get("COMPOSE_FILE", "docker-compose.agentapi.apple-silicon.yml"),
            service_name=os.environ.get("SERVICE_NAME", "agentapi"),
            container_name=os.environ.get("CONTAINER_NAME", "vibecode-agentapi"),
            results_dir=os.environ.get("RESULTS_DIR", "./benchmark-results"),
            iterations=int(os.environ.get("ITERATIONS", "10")),
        )

    log_info("=" * 42)
    log_info("Apple Silicon AgentAPI Benchmark Suite")
    log_info("=" * 42)
    print()

    # Check Apple Silicon
    if not check_apple_silicon():
        return 1

    log_info(f"CPU cores: {get_core_info()}")
    log_info(f"Total memory: {get_total_memory()}")
    log_info(f"Container runtime: {get_docker_version()}")
    print()

    # Create results directory
    results_dir = Path(config.results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results = []

    # Run benchmarks
    results.append(benchmark_startup(config, timestamp))
    print()
    results.append(benchmark_memory(config, timestamp))
    print()
    results.append(benchmark_api_latency(config, timestamp))
    print()

    # Generate summary
    log_info("=" * 42)
    log_success("Benchmark suite complete!")
    log_info(f"Results saved to: {config.results_dir}")
    log_info("=" * 42)
    print()

    generate_summary(config, timestamp, results)

    return 0


def main() -> int:
    """Main entry point."""
    return run_benchmarks()


if __name__ == "__main__":
    sys.exit(main())