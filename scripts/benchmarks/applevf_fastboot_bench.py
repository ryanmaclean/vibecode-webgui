#!/usr/bin/env python3
"""Apple Virtualization Framework Fast Boot Benchmark.

Measures cold boot to /healthz for EFI-stub kernel + minimal initramfs.
"""

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.request import urlopen
from urllib.error import URLError


@dataclass
class BenchmarkConfig:
    """Benchmark configuration."""

    kernel: Path
    initrd: Path
    cpus: int = 2
    memory_mb: int = 512
    port: int = 3000
    host: str = "127.0.0.1"
    timeout: int = 30
    iterations: int = 5
    launcher: str = "vfkit"
    bench_dir: Path = field(default_factory=Path)
    results_dir: Path = field(default_factory=Path)


@dataclass
class BenchmarkResults:
    """Benchmark results."""

    boot_times_ms: list[int] = field(default_factory=list)
    avg_ms: int = 0
    min_ms: int = 0
    max_ms: int = 0
    config: dict = field(default_factory=dict)


def ms_now() -> int:
    """Get current time in milliseconds."""
    return int(time.time() * 1000)


def wait_for_healthz(host: str, port: int, timeout: int) -> Optional[int]:
    """Wait for /healthz endpoint to respond.

    Returns:
        Elapsed time in milliseconds, or None if timeout.
    """
    start = ms_now()
    deadline = start + timeout * 1000

    while True:
        try:
            with urlopen(f"http://{host}:{port}/healthz", timeout=1) as response:
                if response.status == 200:
                    return ms_now() - start
        except (URLError, TimeoutError, Exception):
            pass

        if ms_now() >= deadline:
            return None

        time.sleep(0.05)


def stop_vm(pid_file: Path) -> None:
    """Stop the VM."""
    if not pid_file.exists():
        return

    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, signal.SIGTERM)
        time.sleep(0.5)
        try:
            os.kill(pid, signal.SIGKILL)
        except (OSError, ProcessLookupError):
            pass
    except (ValueError, OSError, ProcessLookupError):
        pass

    pid_file.unlink(missing_ok=True)


def start_vm_vfkit(config: BenchmarkConfig, pid_file: Path, serial_log: Path) -> bool:
    """Start VM using vfkit."""
    cmd = [
        "vfkit",
        "--cpus", str(config.cpus),
        "--memory", str(config.memory_mb),
        "--bootloader", f"linux,kernel={config.kernel},initrd={config.initrd},cmdline=console=hvc0 rdinit=/init quiet",
        "--device", f"virtio-net,nat,localPort={config.port}:3000",
        "--device", "virtio-serial,stdio",
        "--device", "virtio-rng"
    ]

    with open(serial_log, "w") as log_file:
        proc = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=log_file
        )

    pid_file.write_text(str(proc.pid))
    return True


def start_vm_custom(config: BenchmarkConfig, pid_file: Path, serial_log: Path) -> bool:
    """Start VM using custom launcher."""
    env = os.environ.copy()
    env.update({
        "MICROVM_KERNEL": str(config.kernel),
        "MICROVM_INITRD": str(config.initrd),
        "MICROVM_CMDLINE": "console=hvc0 rdinit=/init quiet",
        "MICROVM_CPUS": str(config.cpus),
        "MICROVM_MEMORY_MB": str(config.memory_mb),
        "MICROVM_HOST": config.host,
        "MICROVM_PORT": str(config.port),
        "MICROVM_PID_FILE": str(pid_file),
        "MICROVM_SERIAL_LOG": str(serial_log)
    })

    with open(serial_log, "w") as log_file:
        proc = subprocess.Popen(
            [config.launcher],
            env=env,
            stdout=log_file,
            stderr=log_file
        )

    pid_file.write_text(str(proc.pid))
    return True


def start_vm(config: BenchmarkConfig, pid_file: Path, serial_log: Path) -> bool:
    """Start the VM."""
    serial_log.parent.mkdir(parents=True, exist_ok=True)
    serial_log.write_text("")

    if config.launcher == "vfkit":
        return start_vm_vfkit(config, pid_file, serial_log)
    else:
        return start_vm_custom(config, pid_file, serial_log)


def run_benchmark(config: BenchmarkConfig) -> BenchmarkResults:
    """Run the fast boot benchmark."""
    results = BenchmarkResults()
    pid_file = config.bench_dir / ".vm.pid"
    serial_log = config.bench_dir / "console.log"

    samples = []

    for i in range(1, config.iterations + 1):
        stop_vm(pid_file)
        time.sleep(0.5)

        print(f"  Run {i}/{config.iterations}: ", end="", flush=True)

        start_vm(config, pid_file, serial_log)

        elapsed = wait_for_healthz(config.host, config.port, config.timeout)

        if elapsed is not None:
            print(f"{elapsed}ms")
            samples.append(elapsed)
        else:
            print("TIMEOUT")
            stop_vm(pid_file)
            continue

        stop_vm(pid_file)

    if samples:
        results.boot_times_ms = samples
        results.avg_ms = sum(samples) // len(samples)
        results.min_ms = min(samples)
        results.max_ms = max(samples)

    results.config = {
        "cpus": config.cpus,
        "memory_mb": config.memory_mb,
        "kernel": config.kernel.name,
        "initrd": config.initrd.name,
        "launcher": config.launcher
    }

    return results


def print_results(results: BenchmarkResults) -> None:
    """Print benchmark results."""
    print()
    print("=== Results ===")
    print(json.dumps({
        "boot_to_healthz_ms": results.boot_times_ms,
        "avg_ms": results.avg_ms,
        "min_ms": results.min_ms,
        "max_ms": results.max_ms,
        "config": results.config
    }, indent=2))


def save_results(results: BenchmarkResults, results_dir: Path, config: BenchmarkConfig) -> Path:
    """Save results to file."""
    results_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    results_file = results_dir / f"applevf-fastboot-{timestamp}.json"

    # Get file sizes
    kernel_size = config.kernel.stat().st_size if config.kernel.exists() else 0
    initrd_size = config.initrd.stat().st_size if config.initrd.exists() else 0

    data = {
        "timestamp": timestamp,
        "boot_to_healthz_ms": results.boot_times_ms,
        "avg_ms": results.avg_ms,
        "min_ms": results.min_ms,
        "max_ms": results.max_ms,
        "config": {
            **results.config,
            "initrd_size_bytes": initrd_size,
            "kernel_size_bytes": kernel_size,
            "host": os.uname().machine
        }
    }

    results_file.write_text(json.dumps(data, indent=2))
    return results_file


def cmd_bench(config: BenchmarkConfig) -> int:
    """Run benchmark command."""
    results = run_benchmark(config)
    print_results(results)

    results_file = save_results(results, config.results_dir, config)
    print()
    print(f"Results saved to: {results_file}")

    return 0


def cmd_start(config: BenchmarkConfig) -> int:
    """Start VM command."""
    pid_file = config.bench_dir / ".vm.pid"
    serial_log = config.bench_dir / "console.log"

    stop_vm(pid_file)
    start_vm(config, pid_file, serial_log)

    elapsed = wait_for_healthz(config.host, config.port, config.timeout)

    if elapsed is not None:
        print(f"VM started in {elapsed}ms")
        print(f"PID: {pid_file.read_text().strip()}")
        print(f"Health: http://{config.host}:{config.port}/healthz")
        return 0
    else:
        print("VM failed to start")
        stop_vm(pid_file)
        return 1


def cmd_stop(config: BenchmarkConfig) -> int:
    """Stop VM command."""
    pid_file = config.bench_dir / ".vm.pid"
    stop_vm(pid_file)
    print("VM stopped")
    return 0


def cmd_status(config: BenchmarkConfig) -> int:
    """Status command."""
    pid_file = config.bench_dir / ".vm.pid"

    if not pid_file.exists():
        print("VM stopped")
        return 0

    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 0)  # Check if process exists
        print(f"VM running (PID {pid})")
    except (ValueError, OSError, ProcessLookupError):
        print("VM stopped")

    return 0


def main() -> int:
    """Main entry point."""
    # Get paths
    script_dir = Path(__file__).parent.resolve()
    root_dir = script_dir.parent.parent
    bench_dir = root_dir / "bench-images" / "apple-vf-fastboot"
    results_dir = root_dir / "docs" / "reports" / "benchmarks"

    # Default paths
    default_kernel = bench_dir / "vmlinux-efi-stub"
    default_initrd = bench_dir / "initramfs-minimal.cpio.gz"

    parser = argparse.ArgumentParser(
        description="Apple VF Fast Boot Benchmark"
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="bench",
        choices=["bench", "measure", "start", "stop", "status", "help"],
        help="Command to run"
    )
    parser.add_argument(
        "iterations",
        nargs="?",
        type=int,
        default=5,
        help="Number of iterations for benchmark"
    )

    args = parser.parse_args()

    print("=== Apple VF Fast Boot Benchmark ===")

    # Get configuration from environment
    kernel = Path(os.environ.get("APPLEVF_KERNEL", default_kernel))
    initrd = Path(os.environ.get("APPLEVF_INITRD", default_initrd))
    cpus = int(os.environ.get("APPLEVF_CPUS", "2"))
    memory_mb = int(os.environ.get("APPLEVF_MEMORY_MB", "512"))
    port = int(os.environ.get("APPLEVF_PORT", "3000"))
    host = os.environ.get("APPLEVF_HOST", "127.0.0.1")
    timeout = int(os.environ.get("APPLEVF_TIMEOUT", "30"))
    launcher = os.environ.get("APPLEVF_LAUNCHER", "vfkit")

    print(f"Kernel: {kernel}")
    print(f"Initrd: {initrd}")
    print(f"Iterations: {args.iterations}")
    print()

    # Validate kernel
    if not kernel.exists():
        print(f"Error: Kernel not found at {kernel}")
        print()
        print("Build it with:")
        print("  lima kernel-builder -- ./scripts/benchmarks/build-efi-stub-kernel.sh arm64")
        return 1

    # Validate initrd
    if not initrd.exists():
        print(f"Error: Initramfs not found at {initrd}")
        print()
        print("Build it with:")
        print("  ./scripts/benchmarks/build-minimal-initramfs.sh arm64")
        return 1

    config = BenchmarkConfig(
        kernel=kernel,
        initrd=initrd,
        cpus=cpus,
        memory_mb=memory_mb,
        port=port,
        host=host,
        timeout=timeout,
        iterations=args.iterations,
        launcher=launcher,
        bench_dir=bench_dir,
        results_dir=results_dir
    )

    if args.command in ("bench", "measure"):
        return cmd_bench(config)
    elif args.command == "start":
        return cmd_start(config)
    elif args.command == "stop":
        return cmd_stop(config)
    elif args.command == "status":
        return cmd_status(config)
    elif args.command == "help":
        print(f"Usage: {sys.argv[0]} {{bench|start|stop|status}} [iterations]")
        print()
        print("Environment variables:")
        print("  APPLEVF_KERNEL   - Path to kernel")
        print("  APPLEVF_INITRD   - Path to initramfs")
        print("  APPLEVF_CPUS     - Number of CPUs (default: 2)")
        print("  APPLEVF_MEMORY_MB - Memory in MB (default: 512)")
        print("  APPLEVF_LAUNCHER - vfkit or custom launcher path")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
