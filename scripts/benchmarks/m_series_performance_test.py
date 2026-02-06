#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "bench-m-series-performance-test"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "benchmarks"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""M-Series Performance Testing Suite.

Tests Apple Silicon optimizations for microVM workloads.
"""


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


# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        BenchmarkResult,
        check_command,
        get_hardware_info,
        get_iso_timestamp,
        get_timestamp,
        log,
        ms_now,
        save_results,
        success,
        warn,
    )
    from ._dogstatsd import DogStatsDSender
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        BenchmarkResult,
        check_command,
        get_hardware_info,
        get_iso_timestamp,
        get_timestamp,
        log,
        ms_now,
        save_results,
        success,
        warn,
    )
    from _dogstatsd import DogStatsDSender


def test_apple_virtualization_boot() -> dict | None:
    """Test Apple Virtualization.framework boot time."""
    log("Test 1: Apple Virtualization.framework boot time")

    vm_binary = Path("macos-vm/.build/debug/macos-vm")
    if not vm_binary.exists():
        warn("VM binary not found, skipping")
        return None

    log("  Testing native VM boot...")
    start = ms_now()

    try:
        subprocess.run(
            [str(vm_binary), "test"],
            timeout=10,
            capture_output=True,
        )
    except subprocess.TimeoutExpired:
        pass
    except FileNotFoundError:
        warn("VM binary not executable, skipping")
        return None

    boot_ms = ms_now() - start

    return {
        "name": "apple_virtualization_boot",
        "duration_ms": boot_ms,
        "status": "completed",
    }


def test_kernel_build(hw_info) -> dict | None:
    """Test arm64 kernel build performance."""
    log("")
    log("Test 2: arm64 kernel build performance")

    build_script = Path("scripts/benchmarks/build-minivim-kernel.sh")
    if not build_script.exists():
        warn("Build script not found, skipping")
        return None

    log("  Building MiniVim kernel for arm64...")
    start = time.time()

    env = os.environ.copy()
    env["MINIVIM_JOBS"] = str(hw_info.logical_cpus)

    try:
        subprocess.run(
            [str(build_script), "arm64", "6.17.14"],
            env=env,
            capture_output=True,
            timeout=3600,  # 1 hour max
        )
    except subprocess.TimeoutExpired:
        warn("Kernel build timed out")
        return None
    except Exception as e:
        warn(f"Kernel build failed: {e}")
        return None

    build_sec = int(time.time() - start)

    return {
        "name": "kernel_build_arm64",
        "duration_seconds": build_sec,
        "cores_used": hw_info.logical_cpus,
        "status": "completed",
    }


def test_docker_container_start() -> dict | None:
    """Test Docker container start time."""
    log("")
    log("Test 3: Container runtime performance")

    if not check_command("docker"):
        warn("Docker not available, skipping")
        return None

    log("  Testing Docker container start time...")
    start = ms_now()

    try:
        subprocess.run(
            ["docker", "run", "--rm", "alpine:latest", "echo", "test"],
            capture_output=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        warn("Docker test timed out")
        return None
    except Exception as e:
        warn(f"Docker test failed: {e}")
        return None

    docker_ms = ms_now() - start

    return {
        "name": "docker_container_start",
        "duration_ms": docker_ms,
        "runtime": "docker",
        "status": "completed",
    }


def test_memory_bandwidth() -> dict:
    """Test memory bandwidth."""
    log("")
    log("Test 4: Memory bandwidth test")
    log("  Running memory bandwidth benchmark...")

    start = time.time()

    try:
        subprocess.run(
            ["dd", "if=/dev/zero", "of=/dev/null", "bs=1m", "count=1024"],
            capture_output=True,
            timeout=30,
        )
    except (subprocess.TimeoutExpired, Exception):
        pass

    test_sec = int(time.time() - start)

    return {
        "name": "memory_bandwidth",
        "duration_seconds": test_sec,
        "status": "completed",
    }


def test_ebpf_btf_support() -> dict:
    """Check eBPF/BTF support."""
    log("")
    log("Test 5: eBPF/BTF support check")

    btf_available = check_command("bpftool")

    if btf_available:
        success("bpftool available")
    else:
        warn("bpftool not installed")

    return {
        "name": "ebpf_btf_support",
        "btf_available": btf_available,
        "status": "completed",
    }


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "artifacts" / "m-series-benchmarks",
        help="Output directory for results",
    )
    parser.add_argument(
        "--dd-api-key",
        default=os.environ.get("DD_API_KEY"),
        help="Datadog API key for metric submission",
    )

    args = parser.parse_args(argv)

    # Get hardware info
    hw = get_hardware_info()

    print("=== M-Series Performance Test ===")
    print(f"Hardware: {hw.chip}")
    print(f"Cores: {hw.logical_cpus}")
    print(f"Memory: {hw.memory_gb}GB")
    print()

    if not hw.is_apple_silicon:
        warn(f"Warning: Not running on Apple Silicon ({hw.chip})")

    # Initialize results
    timestamp = get_timestamp()
    results = BenchmarkResult(
        benchmark_id=f"m-series-{timestamp}",
        hardware=hw.to_dict(),
    )

    # Run tests
    tests = []

    test1 = test_apple_virtualization_boot()
    if test1:
        tests.append(test1)

    test2 = test_kernel_build(hw)
    if test2:
        tests.append(test2)

    test3 = test_docker_container_start()
    if test3:
        tests.append(test3)

    tests.append(test_memory_bandwidth())
    tests.append(test_ebpf_btf_support())

    results.results = tests

    # Print summary
    print()
    print("=== Performance Summary ===")
    for test in tests:
        name = test["name"]
        if "duration_ms" in test:
            print(f"- {name}: {test['duration_ms']}ms")
        elif "duration_seconds" in test:
            print(f"- {name}: {test['duration_seconds']}s")
        else:
            print(f"- {name}: \u2713")

    # Save results
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / f"benchmark_{timestamp}.json"
    save_results(results, output_path)

    # Validate targets
    print()
    print("=== Target Validation ===")

    vm_boot = next((t for t in tests if t["name"] == "apple_virtualization_boot"), None)
    if vm_boot and "duration_ms" in vm_boot:
        if vm_boot["duration_ms"] < 5000:
            success("VM boot <5s (M-Series optimized)")
        else:
            warn("VM boot >5s (expected <5s on M-Series)")

    kernel_build = next((t for t in tests if t["name"] == "kernel_build_arm64"), None)
    if kernel_build and "duration_seconds" in kernel_build:
        if kernel_build["duration_seconds"] < 600:
            success("Kernel build <10min (good)")
        else:
            warn("Kernel build >10min (consider optimization)")

    # Send to Datadog
    if args.dd_api_key and vm_boot and "duration_ms" in vm_boot:
        print()
        log("Sending metrics to Datadog...")
        try:
            import urllib.request

            payload = json.dumps({
                "series": [{
                    "metric": "mseries.vm_boot_ms",
                    "points": [[int(time.time()), vm_boot["duration_ms"]]],
                    "type": "gauge",
                    "tags": [f"chip:{hw.chip}", "test:virtualization"],
                }]
            })

            req = urllib.request.Request(
                "https://api.datadoghq.com/api/v1/series",
                data=payload.encode(),
                headers={
                    "DD-API-KEY": args.dd_api_key,
                    "Content-Type": "application/json",
                },
            )

            with urllib.request.urlopen(req, timeout=10):
                success("Metrics sent to Datadog")
        except Exception as e:
            warn(f"Failed to send metrics: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())