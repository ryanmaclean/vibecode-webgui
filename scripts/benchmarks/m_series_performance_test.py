#!/usr/bin/env python3
"""M-Series Performance Testing Suite.

Tests Apple Silicon optimizations for microVM workloads.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class HardwareInfo:
    """Hardware information."""

    chip: str
    cores: int
    memory_gb: int
    performance_cores: int = 0
    efficiency_cores: int = 0


@dataclass
class TestResult:
    """Result of a performance test."""

    name: str
    status: str = "completed"
    duration_ms: Optional[int] = None
    duration_seconds: Optional[int] = None
    extra: dict = field(default_factory=dict)


@dataclass
class BenchmarkConfig:
    """Benchmark configuration."""

    results_dir: Path = Path("artifacts/m-series-benchmarks")
    vm_binary: Path = Path("macos-vm/.build/debug/macos-vm")
    kernel_build_script: Path = Path("scripts/benchmarks/build-minivim-kernel.sh")


def run_command(
    cmd: list[str],
    timeout: Optional[int] = None,
    capture: bool = True
) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr).

    Args:
        cmd: Command and arguments.
        timeout: Timeout in seconds.
        capture: Whether to capture output.

    Returns:
        Tuple of (returncode, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except FileNotFoundError:
        return -1, "", "command not found"


def get_sysctl(key: str, default: str = "0") -> str:
    """Get a sysctl value.

    Args:
        key: Sysctl key.
        default: Default value if not found.

    Returns:
        The sysctl value.
    """
    rc, stdout, _ = run_command(["sysctl", "-n", key])
    return stdout.strip() if rc == 0 else default


def get_hardware_info() -> HardwareInfo:
    """Get hardware information.

    Returns:
        HardwareInfo with system details.
    """
    chip = get_sysctl("machdep.cpu.brand_string", "Unknown")
    cores = int(get_sysctl("hw.ncpu", "1"))
    mem_bytes = int(get_sysctl("hw.memsize", "0"))
    memory_gb = mem_bytes // (1024 * 1024 * 1024)
    perf_cores = int(get_sysctl("hw.perflevel0.physicalcpu", "0"))
    eff_cores = int(get_sysctl("hw.perflevel1.physicalcpu", "0"))

    return HardwareInfo(
        chip=chip,
        cores=cores,
        memory_gb=memory_gb,
        performance_cores=perf_cores,
        efficiency_cores=eff_cores
    )


def test_vm_boot(config: BenchmarkConfig) -> Optional[TestResult]:
    """Test Apple Virtualization.framework boot time.

    Args:
        config: Benchmark configuration.

    Returns:
        TestResult or None if skipped.
    """
    print("Test 1: Apple Virtualization.framework boot time")

    if not config.vm_binary.exists():
        print("  ⚠️  VM binary not found, skipping")
        return None

    print("  Testing native VM boot...")
    start = time.time()
    run_command([str(config.vm_binary), "test"], timeout=10)
    end = time.time()
    boot_ms = int((end - start) * 1000)

    print(f"  Boot time: {boot_ms}ms")
    return TestResult(name="apple_virtualization_boot", duration_ms=boot_ms)


def test_kernel_build(config: BenchmarkConfig, hw: HardwareInfo) -> Optional[TestResult]:
    """Test arm64 kernel build performance.

    Args:
        config: Benchmark configuration.
        hw: Hardware info.

    Returns:
        TestResult or None if skipped.
    """
    print()
    print("Test 2: arm64 kernel build performance")

    if not config.kernel_build_script.exists():
        print("  ⚠️  Build script not found, skipping")
        return None

    print("  Building MiniVim kernel for arm64...")
    env = os.environ.copy()
    env["MINIVIM_JOBS"] = str(hw.cores)

    start = time.time()
    run_command(
        [str(config.kernel_build_script), "arm64", "6.17.14"],
        timeout=1800  # 30 min timeout
    )
    end = time.time()
    build_sec = int(end - start)

    print(f"  Build time: {build_sec}s")
    return TestResult(
        name="kernel_build_arm64",
        duration_seconds=build_sec,
        extra={"cores_used": hw.cores}
    )


def test_docker_container() -> Optional[TestResult]:
    """Test Docker container start time.

    Returns:
        TestResult or None if skipped.
    """
    print()
    print("Test 3: Container runtime performance")

    if not shutil.which("docker"):
        print("  ⚠️  Docker not available, skipping")
        return None

    print("  Testing Docker container start time...")
    start = time.time()
    run_command(["docker", "run", "--rm", "alpine:latest", "echo", "test"], timeout=60)
    end = time.time()
    docker_ms = int((end - start) * 1000)

    print(f"  Docker start: {docker_ms}ms")
    return TestResult(
        name="docker_container_start",
        duration_ms=docker_ms,
        extra={"runtime": "docker"}
    )


def test_memory_bandwidth() -> TestResult:
    """Test memory bandwidth.

    Returns:
        TestResult with timing.
    """
    print()
    print("Test 4: Memory bandwidth test")
    print("  Running memory bandwidth benchmark...")

    start = time.time()
    run_command(
        ["dd", "if=/dev/zero", "of=/dev/null", "bs=1m", "count=1024"],
        timeout=60
    )
    end = time.time()
    mem_test_sec = int(end - start)

    return TestResult(name="memory_bandwidth", duration_seconds=mem_test_sec)


def test_ebpf_support() -> TestResult:
    """Check eBPF/BTF support.

    Returns:
        TestResult with support status.
    """
    print()
    print("Test 5: eBPF/BTF support check")

    btf_available = shutil.which("bpftool") is not None

    if btf_available:
        print("  ✅ bpftool available")
    else:
        print("  ❌ bpftool not installed")

    return TestResult(
        name="ebpf_btf_support",
        extra={"btf_available": btf_available}
    )


def validate_targets(results: list[TestResult], hw: HardwareInfo) -> None:
    """Validate performance against targets.

    Args:
        results: List of test results.
        hw: Hardware info.
    """
    print()
    print("=== Target Validation ===")

    vm_boot = next(
        (r.duration_ms for r in results if r.name == "apple_virtualization_boot"),
        None
    )
    if vm_boot is not None:
        if vm_boot < 5000:
            print("✅ VM boot <5s (M-Series optimized)")
        else:
            print("⚠️  VM boot >5s (expected <5s on M-Series)")

    kernel_build = next(
        (r.duration_seconds for r in results if r.name == "kernel_build_arm64"),
        None
    )
    if kernel_build is not None:
        if kernel_build < 600:
            print("✅ Kernel build <10min (good)")
        else:
            print("⚠️  Kernel build >10min (consider optimization)")


def send_to_datadog(
    results: list[TestResult],
    hw: HardwareInfo,
    api_key: str
) -> None:
    """Send metrics to Datadog.

    Args:
        results: List of test results.
        hw: Hardware info.
        api_key: Datadog API key.
    """
    print()
    print("Sending metrics to Datadog...")

    vm_boot = next(
        (r.duration_ms for r in results if r.name == "apple_virtualization_boot"),
        None
    )
    if vm_boot is None:
        return

    timestamp = int(time.time())
    payload = {
        "series": [{
            "metric": "mseries.vm_boot_ms",
            "points": [[timestamp, vm_boot]],
            "type": "gauge",
            "tags": [f"chip:{hw.chip}", "test:virtualization"]
        }]
    }

    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.datadoghq.com/api/v1/series",
            data=json.dumps(payload).encode(),
            headers={
                "DD-API-KEY": api_key,
                "Content-Type": "application/json"
            }
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        print("Failed to send metrics")


def build_results_json(
    hw: HardwareInfo,
    results: list[TestResult],
    timestamp: str
) -> dict[str, Any]:
    """Build results JSON structure.

    Args:
        hw: Hardware info.
        results: List of test results.
        timestamp: Benchmark timestamp.

    Returns:
        Results dictionary.
    """
    tests = []
    for r in results:
        test_data: dict[str, Any] = {"name": r.name, "status": r.status}
        if r.duration_ms is not None:
            test_data["duration_ms"] = r.duration_ms
        if r.duration_seconds is not None:
            test_data["duration_seconds"] = r.duration_seconds
        test_data.update(r.extra)
        tests.append(test_data)

    return {
        "benchmark_id": f"m-series-{timestamp}",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hardware": {
            "chip": hw.chip,
            "cores": hw.cores,
            "memory_gb": hw.memory_gb,
            "performance_cores": hw.performance_cores,
            "efficiency_cores": hw.efficiency_cores
        },
        "tests": tests
    }


def main(results_dir: Optional[str] = None) -> int:
    """Main entry point.

    Args:
        results_dir: Custom results directory.

    Returns:
        Exit code.
    """
    script_dir = Path(__file__).parent.resolve()
    config = BenchmarkConfig(
        results_dir=Path(results_dir) if results_dir else script_dir.parent.parent / "artifacts" / "m-series-benchmarks",
        vm_binary=script_dir.parent.parent / "macos-vm" / ".build" / "debug" / "macos-vm",
        kernel_build_script=script_dir / "build-minivim-kernel.sh"
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_file = config.results_dir / f"benchmark_{timestamp}.json"

    # Get hardware info
    hw = get_hardware_info()

    print("=== M-Series Performance Test ===")
    print(f"Hardware: {hw.chip}")
    print(f"Cores: {hw.cores}")
    print(f"Memory: {hw.memory_gb}GB")
    print()

    # Check for Apple Silicon
    if "Apple M" not in hw.chip:
        print(f"{YELLOW}⚠️  Warning: Not running on Apple Silicon ({hw.chip}){NC}")

    # Create results directory
    config.results_dir.mkdir(parents=True, exist_ok=True)

    # Run tests
    results: list[TestResult] = []

    if (result := test_vm_boot(config)):
        results.append(result)

    if (result := test_kernel_build(config, hw)):
        results.append(result)

    if (result := test_docker_container()):
        results.append(result)

    results.append(test_memory_bandwidth())
    results.append(test_ebpf_support())

    # Generate summary
    print()
    print("=== Performance Summary ===")
    for r in results:
        if r.duration_ms is not None:
            print(f"- {r.name}: {r.duration_ms}ms")
        elif r.duration_seconds is not None:
            print(f"- {r.name}: {r.duration_seconds}s")
        else:
            print(f"- {r.name}: ✓")

    # Save results
    results_json = build_results_json(hw, results, timestamp)
    with open(result_file, 'w') as f:
        json.dump(results_json, f, indent=2)

    print()
    print(f"Results saved to: {result_file}")

    # Validate targets
    validate_targets(results, hw)

    # Send to Datadog if configured
    dd_api_key = os.environ.get("DD_API_KEY")
    if dd_api_key:
        send_to_datadog(results, hw, dd_api_key)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="M-Series Performance Testing Suite"
    )
    parser.add_argument(
        '-o', '--output-dir',
        help='Results output directory'
    )

    args = parser.parse_args()
    sys.exit(main(args.output_dir))
