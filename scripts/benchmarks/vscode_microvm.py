#!/usr/bin/env python3
"""VS Code MicroVM launcher and benchmark.

Manages microVM lifecycle and measures boot performance.
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
from pathlib import Path
from typing import Optional
from urllib.request import urlopen
from urllib.error import URLError


@dataclass
class MicroVMConfig:
    """MicroVM configuration."""

    arch: str = "x86_64"
    runtime: str = "qemu"
    vm_dir: Path = Path()
    kernel: Path = Path()
    initrd: Path = Path()
    cpus: int = 4
    memory_mb: int = 2048
    port: int = 3600
    host: str = "127.0.0.1"
    ready_timeout: int = 60
    ready_poll_interval: float = 0.1
    cmdline_extra: str = ""


def ms_now() -> int:
    """Get current time in milliseconds."""
    return int(time.time() * 1000)


def get_arch_config(arch: str, root_dir: Path) -> dict:
    """Get architecture-specific configuration."""
    if arch == "x86_64":
        vm_dir = Path(os.environ.get("MICROVM_DIR", root_dir / "fast-openvscode-vm"))
        kernel = vm_dir / "vmlinux-fast"
        if not kernel.exists():
            kernel = vm_dir / "vmlinuz-host"
        return {
            "vm_dir": vm_dir,
            "kernel": kernel,
            "port": int(os.environ.get("MICROVM_PORT", "3600")),
            "cpus": 4,
            "memory_mb": 2048,
            "qemu_bin": os.environ.get("QEMU_BIN", "qemu-system-x86_64"),
            "machine_opts": ["-machine", "accel=hvf,type=pc", "-cpu", "max"],
            "net_opts_template": ["-device", "virtio-net,netdev=n0", "-netdev", "user,id=n0,hostfwd=tcp::{port}-:3000"],
            "append": "rdinit=/init console=ttyS0 quiet"
        }
    elif arch == "arm64":
        vm_dir = Path(os.environ.get("MICROVM_DIR", root_dir / "fast-openvscode-vm-arm64"))
        kernel = vm_dir / "vmlinux-fast"
        if not kernel.exists():
            kernel = vm_dir / "vmlinuz-6.1.0-40-arm64"
        return {
            "vm_dir": vm_dir,
            "kernel": kernel,
            "port": int(os.environ.get("MICROVM_PORT", "4600")),
            "cpus": 4,
            "memory_mb": 2048,
            "qemu_bin": os.environ.get("QEMU_BIN", "qemu-system-aarch64"),
            "machine_opts": ["-machine", "virt,virtualization=on,highmem=off", "-cpu", "cortex-a72"],
            "net_opts_template": ["-device", "virtio-net-pci,netdev=n0", "-netdev", "user,id=n0,hostfwd=tcp::{port}-:3000"],
            "append": "rdinit=/init console=ttyAMA0"
        }
    else:
        raise ValueError(f"Unsupported MICROVM_ARCH: {arch}")


class MicroVMManager:
    """Manages microVM lifecycle."""

    def __init__(self, config: MicroVMConfig, arch_config: dict):
        """Initialize manager."""
        self.config = config
        self.arch_config = arch_config
        self.pid_file = config.vm_dir / ".microvm.pid"
        self.serial_log = config.vm_dir / "qemu-console.log"
        self.last_ready_ms = 0

    def vm_running(self) -> bool:
        """Check if VM is running."""
        if not self.pid_file.exists():
            return False
        try:
            pid = int(self.pid_file.read_text().strip())
            os.kill(pid, 0)
            return True
        except (ValueError, OSError, ProcessLookupError):
            return False

    def require_vm_assets(self) -> bool:
        """Check if VM assets exist."""
        if not self.config.kernel.exists():
            print(f"error: kernel missing: {self.config.kernel}", file=sys.stderr)
            return False
        if not self.config.initrd.exists():
            print(f"error: initramfs missing: {self.config.initrd}", file=sys.stderr)
            return False
        return True

    def wait_for_ready(self, timeout: int = None) -> Optional[int]:
        """Wait for VM to be ready.

        Returns:
            Elapsed time in ms, or None if timeout.
        """
        if timeout is None:
            timeout = self.config.ready_timeout

        start = ms_now()
        deadline = start + timeout * 1000

        while True:
            try:
                url = f"http://{self.config.host}:{self.config.port}/healthz"
                with urlopen(url, timeout=1) as response:
                    if response.status == 200:
                        return ms_now() - start
            except (URLError, TimeoutError, Exception):
                pass

            if ms_now() >= deadline:
                return None

            time.sleep(self.config.ready_poll_interval)

    def start_qemu(self) -> None:
        """Start VM with QEMU."""
        qemu_bin = self.arch_config["qemu_bin"]
        machine_opts = self.arch_config["machine_opts"]
        net_opts = [opt.format(port=self.config.port) for opt in self.arch_config["net_opts_template"]]
        append = self.arch_config["append"]

        if self.config.cmdline_extra:
            append += f" {self.config.cmdline_extra}"

        cmd = [
            qemu_bin,
            *machine_opts,
            "-smp", str(self.config.cpus),
            "-m", str(self.config.memory_mb),
            "-kernel", str(self.config.kernel),
            "-initrd", str(self.config.initrd),
            "-append", append,
            "-display", "none",
            *net_opts,
            "-pidfile", str(self.pid_file),
            "-serial", f"file:{self.serial_log}",
            "-daemonize"
        ]

        subprocess.run(cmd, check=True)

    def resolve_applevf_launcher(self) -> Optional[str]:
        """Find Apple VF launcher."""
        # Check environment variable
        cmd = os.environ.get("MICROVM_APPLEVF_CMD")
        if cmd:
            return cmd

        # Check for known launchers
        for candidate in ["vz-run", "vzctl", "vz", "macvz", "vfkit"]:
            if shutil.which(candidate):
                return candidate

        return None

    def start_applevf(self) -> None:
        """Start VM with Apple Virtualization Framework."""
        launcher = self.resolve_applevf_launcher()
        if not launcher:
            print("""error: Apple Virtualization runtime not configured.

Set MICROVM_APPLEVF_CMD to a launcher script/binary that knows how to boot the
kernel via Virtualization.framework, or install a supported CLI (e.g. vz-run,
macvz, vfkit) and ensure it is on PATH. See docs/virtualization/openvscode-microvm.md
for wiring examples.""", file=sys.stderr)
            sys.exit(1)

        if not os.path.isfile(launcher) and not shutil.which(launcher):
            print(f"error: MICROVM_APPLEVF_CMD '{launcher}' not executable", file=sys.stderr)
            sys.exit(1)

        self.serial_log.parent.mkdir(parents=True, exist_ok=True)
        self.serial_log.write_text("")

        append = self.arch_config["append"]
        if self.config.cmdline_extra:
            append += f" {self.config.cmdline_extra}"

        env = os.environ.copy()
        env.update({
            "MICROVM_KERNEL": str(self.config.kernel),
            "MICROVM_INITRD": str(self.config.initrd),
            "MICROVM_CMDLINE": append,
            "MICROVM_CPUS": str(self.config.cpus),
            "MICROVM_MEMORY_MB": str(self.config.memory_mb),
            "MICROVM_HOST": self.config.host,
            "MICROVM_PORT": str(self.config.port),
            "MICROVM_PID_FILE": str(self.pid_file),
            "MICROVM_SERIAL_LOG": str(self.serial_log),
            "MICROVM_RUNTIME_DIR": str(self.config.vm_dir),
            "MICROVM_EXTRA_ARGS": os.environ.get("MICROVM_EXTRA_APPLEVF_ARGS", "")
        })

        foreground = bool(os.environ.get("MICROVM_APPLEVF_FOREGROUND"))
        if foreground:
            subprocess.run([launcher], env=env)
            return

        with open(self.serial_log, "a") as log_file:
            proc = subprocess.Popen(
                [launcher],
                env=env,
                stdout=log_file,
                stderr=log_file
            )

        self.pid_file.write_text(str(proc.pid))

    def start_vm(self) -> bool:
        """Start the VM."""
        if self.vm_running():
            print(f"microVM already running (pid {self.pid_file.read_text().strip()})")
            return True

        if not self.require_vm_assets():
            return False

        self.serial_log.unlink(missing_ok=True)

        if self.config.runtime == "qemu":
            self.start_qemu()
        elif self.config.runtime in ("applevf", "vf"):
            self.start_applevf()
        else:
            print(f"error: unsupported MICROVM_RUNTIME '{self.config.runtime}'", file=sys.stderr)
            return False

        elapsed = self.wait_for_ready()
        if elapsed is None:
            print("error: microVM failed readiness check", file=sys.stderr)
            self.stop_vm()
            return False

        self.last_ready_ms = elapsed
        print(f"microVM started (pid {self.pid_file.read_text().strip()}, ready {elapsed}ms)")
        return True

    def stop_vm(self) -> None:
        """Stop the VM."""
        if not self.vm_running():
            self.pid_file.unlink(missing_ok=True)
            return

        try:
            pid = int(self.pid_file.read_text().strip())
            os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            if self.vm_running():
                os.kill(pid, signal.SIGKILL)
        except (ValueError, OSError, ProcessLookupError):
            pass

        self.pid_file.unlink(missing_ok=True)
        print("microVM stopped")

    def status_vm(self) -> None:
        """Print VM status."""
        if self.vm_running():
            print(f"microVM running (pid {self.pid_file.read_text().strip()})")
        else:
            print("microVM stopped")

    def measure_latency(self, iterations: int = 5) -> dict:
        """Measure boot latency.

        Returns:
            JSON-serializable results dict.
        """
        samples = []

        for _ in range(iterations):
            self.stop_vm()
            self.last_ready_ms = 0

            if not self.start_vm():
                print("error: failed to start VM during measurement", file=sys.stderr)
                sys.exit(1)

            if self.last_ready_ms == 0:
                print("error: failed to capture readiness metric", file=sys.stderr)
                sys.exit(1)

            samples.append(self.last_ready_ms)

        self.stop_vm()
        return {"port_ready_ms": samples}


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="VS Code MicroVM launcher and benchmark"
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="help",
        choices=["start", "stop", "status", "measure", "help"],
        help="Command to run"
    )
    parser.add_argument(
        "iterations",
        nargs="?",
        type=int,
        default=5,
        help="Number of iterations for measure command"
    )

    args = parser.parse_args()

    script_dir = Path(__file__).parent.resolve()
    root_dir = script_dir.parent.parent

    # Get architecture
    arch = os.environ.get("MICROVM_ARCH", "x86_64")
    runtime = os.environ.get("MICROVM_RUNTIME", "qemu")

    try:
        arch_config = get_arch_config(arch, root_dir)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1

    # Build configuration
    vm_dir = arch_config["vm_dir"]
    kernel = Path(os.environ.get("MICROVM_KERNEL", arch_config["kernel"]))
    initrd = Path(os.environ.get("MICROVM_INITRD", vm_dir / "openvscode-initramfs.cpio.gz"))

    config = MicroVMConfig(
        arch=arch,
        runtime=runtime,
        vm_dir=vm_dir,
        kernel=kernel,
        initrd=initrd,
        cpus=int(os.environ.get("MICROVM_CPUS", arch_config["cpus"])),
        memory_mb=int(os.environ.get("MICROVM_MEMORY_MB", arch_config["memory_mb"])),
        port=arch_config["port"],
        host=os.environ.get("MICROVM_HOST", "127.0.0.1"),
        ready_timeout=int(os.environ.get("MICROVM_READY_TIMEOUT", "60")),
        ready_poll_interval=float(os.environ.get("MICROVM_READY_POLL_SEC", "0.1")),
        cmdline_extra=os.environ.get("MICROVM_CMDLINE_EXTRA", "")
    )

    manager = MicroVMManager(config, arch_config)

    if args.command == "start":
        return 0 if manager.start_vm() else 1
    elif args.command == "stop":
        manager.stop_vm()
        return 0
    elif args.command == "status":
        manager.status_vm()
        return 0
    elif args.command == "measure":
        results = manager.measure_latency(args.iterations)
        print(json.dumps(results))
        return 0
    else:
        print(f"usage: {sys.argv[0]} {{start|stop|status|measure [n]}}")
        print("environment variables: MICROVM_ARCH, MICROVM_RUNTIME (qemu|applevf), MICROVM_DIR, MICROVM_KERNEL, MICROVM_PORT")
        return 0


if __name__ == "__main__":
    sys.exit(main())
