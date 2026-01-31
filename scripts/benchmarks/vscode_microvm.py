#!/usr/bin/env python3
"""VSCode MicroVM benchmark runner.

Manages MicroVM lifecycle and measures boot latency for OpenVSCode workloads.
Supports both QEMU and Apple Virtualization Framework runtimes.
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
        check_command,
        log,
        ms_now,
        run_cmd,
        success,
        wait_for_http,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        log,
        ms_now,
        run_cmd,
        success,
        wait_for_http,
    )


class MicroVMConfig:
    """Configuration for MicroVM."""

    def __init__(
        self,
        arch: str = "x86_64",
        runtime: str = "qemu",
        vm_dir: Path | None = None,
        kernel: Path | None = None,
        initrd: Path | None = None,
        cpus: int = 4,
        memory_mb: int = 2048,
        port: int = 3600,
        host: str = "127.0.0.1",
        cmdline_extra: str = "",
        ready_timeout: int = 60,
        ready_poll_interval: float = 0.1,
    ):
        self.arch = arch
        self.runtime = runtime

        # Set defaults based on architecture
        if arch == "x86_64":
            default_vm_dir = REPO_ROOT / "fast-openvscode-vm"
            default_port = 3600
            self.qemu_bin = os.environ.get("QEMU_BIN", "qemu-system-x86_64")
            self.machine_opts = ["-machine", "accel=hvf,type=pc", "-cpu", "max"]
            self.net_opts_template = ["-device", "virtio-net,netdev=n0", "-netdev", "user,id=n0,hostfwd=tcp::{port}-:3000"]
            self.append = "rdinit=/init console=ttyS0 quiet"
        elif arch == "arm64":
            default_vm_dir = REPO_ROOT / "fast-openvscode-vm-arm64"
            default_port = 4600
            self.qemu_bin = os.environ.get("QEMU_BIN", "qemu-system-aarch64")
            self.machine_opts = ["-machine", "virt,virtualization=on,highmem=off", "-cpu", "cortex-a72"]
            self.net_opts_template = ["-device", "virtio-net-pci,netdev=n0", "-netdev", "user,id=n0,hostfwd=tcp::{port}-:3000"]
            self.append = "rdinit=/init console=ttyAMA0"
        else:
            raise BenchmarkError(f"Unsupported architecture: {arch}")

        self.vm_dir = Path(vm_dir or os.environ.get("MICROVM_DIR", default_vm_dir))
        self.port = int(os.environ.get("MICROVM_PORT", port))
        self.host = os.environ.get("MICROVM_HOST", host)
        self.cpus = int(os.environ.get("MICROVM_CPUS", cpus))
        self.memory_mb = int(os.environ.get("MICROVM_MEMORY_MB", memory_mb))

        # Kernel and initrd
        if kernel:
            self.kernel = Path(kernel)
        else:
            kernel_path = os.environ.get("MICROVM_KERNEL")
            if kernel_path:
                self.kernel = Path(kernel_path)
            else:
                # Try default paths
                candidates = [
                    self.vm_dir / "vmlinux-fast",
                    self.vm_dir / "vmlinuz-host",
                    self.vm_dir / "vmlinuz-6.1.0-40-arm64",
                ]
                self.kernel = next((p for p in candidates if p.exists()), candidates[0])

        if initrd:
            self.initrd = Path(initrd)
        else:
            initrd_path = os.environ.get("MICROVM_INITRD")
            if initrd_path:
                self.initrd = Path(initrd_path)
            else:
                self.initrd = self.vm_dir / "openvscode-initramfs.cpio.gz"

        # Append extra cmdline
        if cmdline_extra or os.environ.get("MICROVM_CMDLINE_EXTRA"):
            self.append += " " + (cmdline_extra or os.environ.get("MICROVM_CMDLINE_EXTRA", ""))

        self.ready_timeout = int(os.environ.get("MICROVM_READY_TIMEOUT", ready_timeout))
        self.ready_poll_interval = float(os.environ.get("MICROVM_READY_POLL_SEC", ready_poll_interval))

        # Derived paths
        self.pid_file = self.vm_dir / ".microvm.pid"
        self.serial_log = self.vm_dir / "qemu-console.log"

    @property
    def net_opts(self) -> list[str]:
        """Get network options with port substituted."""
        return [opt.format(port=self.port) for opt in self.net_opts_template]


class MicroVM:
    """MicroVM manager for boot benchmarks."""

    def __init__(self, config: MicroVMConfig):
        self.config = config
        self._last_ready_ms = 0

    def require_assets(self) -> None:
        """Verify required VM assets exist."""
        if not self.config.kernel.exists():
            raise BenchmarkError(f"Kernel not found: {self.config.kernel}")
        if not self.config.initrd.exists():
            raise BenchmarkError(f"Initramfs not found: {self.config.initrd}")

    def is_running(self) -> bool:
        """Check if VM is running."""
        if not self.config.pid_file.exists():
            return False
        try:
            pid = int(self.config.pid_file.read_text().strip())
            os.kill(pid, 0)
            return True
        except (ValueError, ProcessLookupError, PermissionError):
            return False

    def start_qemu(self) -> None:
        """Start VM using QEMU."""
        cmd = [
            self.config.qemu_bin,
            *self.config.machine_opts,
            "-smp", str(self.config.cpus),
            "-m", str(self.config.memory_mb),
            "-kernel", str(self.config.kernel),
            "-initrd", str(self.config.initrd),
            "-append", self.config.append,
            "-display", "none",
            *self.config.net_opts,
            "-pidfile", str(self.config.pid_file),
            "-serial", f"file:{self.config.serial_log}",
            "-daemonize",
        ]

        run_cmd(cmd)

    def start_applevf(self) -> None:
        """Start VM using Apple Virtualization Framework."""
        # Find launcher
        launcher = os.environ.get("MICROVM_APPLEVF_CMD")
        if not launcher:
            for candidate in ["vz-run", "vzctl", "vz", "macvz", "vfkit"]:
                if check_command(candidate):
                    launcher = candidate
                    break

        if not launcher:
            raise BenchmarkError(
                "Apple Virtualization runtime not configured.\n\n"
                "Set MICROVM_APPLEVF_CMD to a launcher script/binary that knows how to boot\n"
                "the kernel via Virtualization.framework, or install a supported CLI\n"
                "(e.g. vz-run, macvz, vfkit) and ensure it is on PATH."
            )

        # Set up environment
        env = os.environ.copy()
        env.update({
            "MICROVM_KERNEL": str(self.config.kernel),
            "MICROVM_INITRD": str(self.config.initrd),
            "MICROVM_CMDLINE": self.config.append,
            "MICROVM_CPUS": str(self.config.cpus),
            "MICROVM_MEMORY_MB": str(self.config.memory_mb),
            "MICROVM_HOST": self.config.host,
            "MICROVM_PORT": str(self.config.port),
            "MICROVM_PID_FILE": str(self.config.pid_file),
            "MICROVM_SERIAL_LOG": str(self.config.serial_log),
            "MICROVM_RUNTIME_DIR": str(self.config.vm_dir),
            "MICROVM_EXTRA_ARGS": os.environ.get("MICROVM_EXTRA_APPLEVF_ARGS", ""),
        })

        self.config.serial_log.parent.mkdir(parents=True, exist_ok=True)
        self.config.serial_log.write_text("")

        if os.environ.get("MICROVM_APPLEVF_FOREGROUND"):
            # Run in foreground
            run_cmd([launcher], env=env)
        else:
            # Run in background
            with open(self.config.serial_log, "a") as log_file:
                proc = subprocess.Popen(
                    [launcher],
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    env=env,
                )
                self.config.pid_file.write_text(str(proc.pid))

    def start(self) -> None:
        """Start the VM."""
        if self.is_running():
            log(f"MicroVM already running (pid {self.config.pid_file.read_text().strip()})")
            return

        self.require_assets()
        self.config.serial_log.unlink(missing_ok=True)

        if self.config.runtime == "qemu":
            self.start_qemu()
        elif self.config.runtime in ("applevf", "vf"):
            self.start_applevf()
        else:
            raise BenchmarkError(f"Unsupported runtime: {self.config.runtime}")

        # Wait for ready
        try:
            url = f"http://{self.config.host}:{self.config.port}/healthz"
            elapsed = wait_for_http(url, self.config.ready_timeout, self.config.ready_poll_interval)
            self._last_ready_ms = elapsed
            log(f"MicroVM started (pid {self.config.pid_file.read_text().strip()}, ready {elapsed}ms)")
        except BenchmarkError:
            log("MicroVM failed readiness check")
            self.stop()
            raise

    def stop(self) -> None:
        """Stop the VM."""
        if not self.is_running():
            self.config.pid_file.unlink(missing_ok=True)
            return

        try:
            pid = int(self.config.pid_file.read_text().strip())
            os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            if self.is_running():
                os.kill(pid, signal.SIGKILL)
        except (ValueError, ProcessLookupError, PermissionError):
            pass
        finally:
            self.config.pid_file.unlink(missing_ok=True)

        log("MicroVM stopped")

    def status(self) -> str:
        """Get VM status."""
        if self.is_running():
            pid = self.config.pid_file.read_text().strip()
            return f"MicroVM running (pid {pid})"
        return "MicroVM stopped"

    def measure_latency(self, iterations: int = 5) -> dict:
        """Measure boot latency.

        Args:
            iterations: Number of iterations

        Returns:
            Dictionary with measurements
        """
        samples = []

        for i in range(iterations):
            try:
                self.stop()
            except Exception:
                pass

            self._last_ready_ms = 0
            self.start()

            if self._last_ready_ms == 0:
                raise BenchmarkError("Failed to capture readiness metric")

            samples.append(self._last_ready_ms)

        try:
            self.stop()
        except Exception:
            pass

        return {"port_ready_ms": samples}


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command")

    # Start command
    start_parser = subparsers.add_parser("start", help="Start MicroVM")

    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop MicroVM")

    # Status command
    status_parser = subparsers.add_parser("status", help="Check MicroVM status")

    # Measure command
    measure_parser = subparsers.add_parser("measure", help="Measure boot latency")
    measure_parser.add_argument("iterations", type=int, nargs="?", default=5, help="Number of iterations")

    # Common arguments
    for p in [parser, start_parser, stop_parser, status_parser, measure_parser]:
        p.add_argument("--arch", default=os.environ.get("MICROVM_ARCH", "x86_64"), choices=["x86_64", "arm64"])
        p.add_argument("--runtime", default=os.environ.get("MICROVM_RUNTIME", "qemu"), choices=["qemu", "applevf", "vf"])
        p.add_argument("--kernel", type=Path, help="Kernel path")
        p.add_argument("--initrd", type=Path, help="Initramfs path")
        p.add_argument("--port", type=int, help="Host port")

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        print()
        print("Environment variables: MICROVM_ARCH, MICROVM_RUNTIME (qemu|applevf), MICROVM_DIR, MICROVM_KERNEL, MICROVM_PORT")
        return 0

    try:
        config = MicroVMConfig(
            arch=args.arch,
            runtime=args.runtime,
            kernel=args.kernel,
            initrd=args.initrd,
            port=args.port if hasattr(args, 'port') and args.port else None,
        )
        vm = MicroVM(config)

        if args.command == "start":
            vm.start()
            return 0

        elif args.command == "stop":
            vm.stop()
            return 0

        elif args.command == "status":
            print(vm.status())
            return 0

        elif args.command == "measure":
            results = vm.measure_latency(args.iterations)
            print(json.dumps(results))
            return 0

    except BenchmarkError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
