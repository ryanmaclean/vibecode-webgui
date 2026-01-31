#!/usr/bin/env python3
"""Apple Virtualization Framework Fast Boot Benchmark.

Measures cold boot to /healthz for EFI-stub kernel + minimal initramfs.
"""
from __future__ import annotations

import argparse
import json
import os
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
        get_hardware_info,
        get_iso_timestamp,
        get_timestamp,
        log,
        ms_now,
        save_results,
        success,
        warn,
        error as log_error,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        BenchmarkResult,
        calc_stats,
        get_hardware_info,
        get_iso_timestamp,
        get_timestamp,
        log,
        ms_now,
        save_results,
        success,
        warn,
        error as log_error,
    )


DEFAULT_BENCH_DIR = REPO_ROOT / "bench-images" / "apple-vf-fastboot"
DEFAULT_RESULTS_DIR = REPO_ROOT / "docs" / "reports" / "benchmarks"


class AppleVFBenchmark:
    """Apple Virtualization Framework fast boot benchmark."""

    def __init__(
        self,
        kernel: Path,
        initrd: Path,
        cpus: int = 2,
        memory_mb: int = 512,
        port: int = 3000,
        host: str = "127.0.0.1",
        timeout: int = 30,
        launcher: str = "vfkit",
        bench_dir: Path = DEFAULT_BENCH_DIR,
    ):
        self.kernel = Path(kernel)
        self.initrd = Path(initrd)
        self.cpus = cpus
        self.memory_mb = memory_mb
        self.port = port
        self.host = host
        self.timeout = timeout
        self.launcher = launcher
        self.bench_dir = Path(bench_dir)

        self.pid_file = self.bench_dir / ".vm.pid"
        self.serial_log = self.bench_dir / "console.log"

    def validate_assets(self) -> None:
        """Validate that required assets exist."""
        if not self.kernel.exists():
            raise BenchmarkError(
                f"Kernel not found at {self.kernel}\n\n"
                "Build it with:\n"
                "  lima kernel-builder -- ./scripts/benchmarks/build-efi-stub-kernel.sh arm64"
            )

        if not self.initrd.exists():
            raise BenchmarkError(
                f"Initramfs not found at {self.initrd}\n\n"
                "Build it with:\n"
                "  ./scripts/benchmarks/build-minimal-initramfs.sh arm64"
            )

    def wait_for_healthz(self) -> int:
        """Wait for /healthz endpoint to become available.

        Returns:
            Time in milliseconds until endpoint was ready

        Raises:
            BenchmarkError: If timeout is reached
        """
        import urllib.request
        import urllib.error

        start = ms_now()
        deadline = start + self.timeout * 1000
        url = f"http://{self.host}:{self.port}/healthz"

        while ms_now() < deadline:
            try:
                with urllib.request.urlopen(url, timeout=1) as resp:
                    if resp.status == 200:
                        return ms_now() - start
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
                pass
            time.sleep(0.05)

        raise BenchmarkError(f"Timeout waiting for healthz after {self.timeout}s")

    def stop_vm(self) -> None:
        """Stop the VM if running."""
        if not self.pid_file.exists():
            return

        try:
            pid = int(self.pid_file.read_text().strip())
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.5)
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        except (ValueError, ProcessLookupError, PermissionError):
            pass
        finally:
            self.pid_file.unlink(missing_ok=True)

    def start_vm_vfkit(self) -> None:
        """Start VM using vfkit."""
        cmd = [
            "vfkit",
            "--cpus", str(self.cpus),
            "--memory", str(self.memory_mb),
            "--bootloader", f"linux,kernel={self.kernel},initrd={self.initrd},cmdline=console=hvc0 rdinit=/init quiet",
            "--device", f"virtio-net,nat,localPort={self.port}:3000",
            "--device", "virtio-serial,stdio",
            "--device", "virtio-rng",
        ]

        self.serial_log.parent.mkdir(parents=True, exist_ok=True)
        with open(self.serial_log, "w") as log_file:
            proc = subprocess.Popen(
                cmd,
                stdout=log_file,
                stderr=subprocess.STDOUT,
            )
            self.pid_file.write_text(str(proc.pid))

    def start_vm_custom(self) -> None:
        """Start VM using custom launcher."""
        env = os.environ.copy()
        env.update({
            "MICROVM_KERNEL": str(self.kernel),
            "MICROVM_INITRD": str(self.initrd),
            "MICROVM_CMDLINE": "console=hvc0 rdinit=/init quiet",
            "MICROVM_CPUS": str(self.cpus),
            "MICROVM_MEMORY_MB": str(self.memory_mb),
            "MICROVM_HOST": self.host,
            "MICROVM_PORT": str(self.port),
            "MICROVM_PID_FILE": str(self.pid_file),
            "MICROVM_SERIAL_LOG": str(self.serial_log),
        })

        self.serial_log.parent.mkdir(parents=True, exist_ok=True)
        with open(self.serial_log, "w") as log_file:
            proc = subprocess.Popen(
                [self.launcher],
                stdout=log_file,
                stderr=subprocess.STDOUT,
                env=env,
            )
            self.pid_file.write_text(str(proc.pid))

    def start_vm(self) -> None:
        """Start the VM."""
        self.serial_log.parent.mkdir(parents=True, exist_ok=True)
        self.serial_log.write_text("")

        if self.launcher == "vfkit":
            self.start_vm_vfkit()
        else:
            self.start_vm_custom()

    def run_benchmark(self, iterations: int) -> dict:
        """Run the benchmark.

        Args:
            iterations: Number of iterations to run

        Returns:
            Dictionary with benchmark results
        """
        samples: list[int] = []

        for i in range(1, iterations + 1):
            self.stop_vm()
            time.sleep(0.5)

            print(f"  Run {i}/{iterations}: ", end="", flush=True)

            self.start_vm()

            try:
                elapsed = self.wait_for_healthz()
                print(f"{elapsed}ms")
                samples.append(elapsed)
            except BenchmarkError:
                print("TIMEOUT")
                self.stop_vm()
                continue

            self.stop_vm()

        if not samples:
            raise BenchmarkError("No successful runs")

        stats = calc_stats(samples)

        return {
            "boot_to_healthz_ms": samples,
            "avg_ms": int(stats["avg"]),
            "min_ms": int(stats["min"]),
            "max_ms": int(stats["max"]),
            "config": {
                "cpus": self.cpus,
                "memory_mb": self.memory_mb,
                "kernel": self.kernel.name,
                "initrd": self.initrd.name,
                "launcher": self.launcher,
            },
        }

    def status(self) -> str:
        """Check VM status."""
        if not self.pid_file.exists():
            return "VM stopped"

        try:
            pid = int(self.pid_file.read_text().strip())
            os.kill(pid, 0)  # Check if process exists
            return f"VM running (PID {pid})"
        except (ValueError, ProcessLookupError, PermissionError):
            return "VM stopped"


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Bench command
    bench_parser = subparsers.add_parser("bench", aliases=["measure"], help="Run benchmark")
    bench_parser.add_argument("iterations", type=int, nargs="?", default=5, help="Number of iterations")

    # Start command
    start_parser = subparsers.add_parser("start", help="Start VM")

    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop VM")

    # Status command
    status_parser = subparsers.add_parser("status", help="Check VM status")

    # Common arguments
    for p in [parser, bench_parser, start_parser, stop_parser, status_parser]:
        p.add_argument("--kernel", type=Path, help="Path to kernel")
        p.add_argument("--initrd", type=Path, help="Path to initramfs")
        p.add_argument("--cpus", type=int, default=2, help="Number of CPUs")
        p.add_argument("--memory", type=int, default=512, help="Memory in MB")
        p.add_argument("--port", type=int, default=3000, help="Host port")
        p.add_argument("--host", default="127.0.0.1", help="Host address")
        p.add_argument("--timeout", type=int, default=30, help="Timeout in seconds")
        p.add_argument("--launcher", default="vfkit", help="VM launcher")
        p.add_argument("--bench-dir", type=Path, default=DEFAULT_BENCH_DIR, help="Benchmark directory")
        p.add_argument("--output", type=Path, help="Output JSON file")

    args = parser.parse_args(argv)

    # Default command is help
    if not args.command:
        parser.print_help()
        return 0

    # Resolve paths
    bench_dir = Path(args.bench_dir)
    kernel = args.kernel or (bench_dir / "vmlinux-efi-stub")
    initrd = args.initrd or (bench_dir / "initramfs-minimal.cpio.gz")

    benchmark = AppleVFBenchmark(
        kernel=kernel,
        initrd=initrd,
        cpus=args.cpus,
        memory_mb=args.memory,
        port=args.port,
        host=args.host,
        timeout=args.timeout,
        launcher=args.launcher,
        bench_dir=bench_dir,
    )

    try:
        if args.command in ("bench", "measure"):
            print("=== Apple VF Fast Boot Benchmark ===")
            print(f"Kernel: {kernel}")
            print(f"Initrd: {initrd}")
            print(f"Iterations: {args.iterations}")
            print()

            benchmark.validate_assets()
            results = benchmark.run_benchmark(args.iterations)

            print()
            print("=== Results ===")
            print(json.dumps(results, indent=2))

            # Save results
            if args.output:
                output_path = args.output
            else:
                results_dir = DEFAULT_RESULTS_DIR
                results_dir.mkdir(parents=True, exist_ok=True)
                timestamp = get_timestamp()
                output_path = results_dir / f"applevf-fastboot-{timestamp}.json"

            # Add metadata
            hw = get_hardware_info()
            results["timestamp"] = get_iso_timestamp()
            results["config"]["initrd_size_bytes"] = initrd.stat().st_size if initrd.exists() else 0
            results["config"]["kernel_size_bytes"] = kernel.stat().st_size if kernel.exists() else 0
            results["config"]["host_arch"] = hw.arch

            save_results(results, output_path)
            return 0

        elif args.command == "start":
            benchmark.validate_assets()
            benchmark.stop_vm()
            benchmark.start_vm()
            try:
                elapsed = benchmark.wait_for_healthz()
                success(f"VM started in {elapsed}ms")
                print(f"PID: {benchmark.pid_file.read_text().strip()}")
                print(f"Health: http://{args.host}:{args.port}/healthz")
                return 0
            except BenchmarkError:
                log_error("VM failed to start")
                benchmark.stop_vm()
                return 1

        elif args.command == "stop":
            benchmark.stop_vm()
            success("VM stopped")
            return 0

        elif args.command == "status":
            print(benchmark.status())
            return 0

    except BenchmarkError as err:
        log_error(str(err))
        return 1


if __name__ == "__main__":
    sys.exit(main())
