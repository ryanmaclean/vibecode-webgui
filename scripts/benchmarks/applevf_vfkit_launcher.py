#!/usr/bin/env python3
"""Apple Virtualization Framework launcher using vfkit and gvproxy.

This module provides a Python interface for launching microVMs using
Apple's Virtualization.framework via vfkit with gvproxy networking.

Environment variables:
    MICROVM_KERNEL: Path to kernel image (required)
    MICROVM_INITRD: Path to initramfs (required)
    MICROVM_CMDLINE: Kernel command line (required)
    MICROVM_CPUS: Number of CPUs (required)
    MICROVM_MEMORY_MB: Memory in MB (required)
    MICROVM_PORT: Host port to forward (required)
    MICROVM_RUNTIME_DIR: Runtime directory for sockets (required)
    MICROVM_SERIAL_LOG: Path to serial log file
    MICROVM_VFKIT_BIN: Path to vfkit binary
    MICROVM_GVPROXY_BIN: Path to gvproxy binary
    MICROVM_APPLEVF_STDIO: Use stdio for serial output
    MICROVM_APPLEVF_FOREGROUND: Run in foreground
    MICROVM_PID_FILE: Path to PID file
    MICROVM_EXTRA_ARGS: Extra arguments for vfkit
"""
from __future__ import annotations

import atexit
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

try:
    from .benchmark_utils import (
        BenchmarkError,
        check_command,
        log,
        run_cmd,
        wait_for_condition,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        BenchmarkError,
        check_command,
        log,
        run_cmd,
        wait_for_condition,
    )


# Network configuration for gvproxy
STATIC_MAC = "5a:94:ef:e4:0c:ee"
STATIC_IP = "192.168.127.2/24"
STATIC_GATEWAY = "192.168.127.1"
GUEST_HTTP_TARGET = "192.168.127.2:3000"


class VFKitLauncher:
    """Launcher for Apple Virtualization Framework VMs via vfkit."""

    def __init__(
        self,
        kernel: Path,
        initrd: Path,
        cmdline: str,
        cpus: int,
        memory_mb: int,
        port: int,
        runtime_dir: Path,
        serial_log: Path | None = None,
        vfkit_bin: str | None = None,
        gvproxy_bin: str | None = None,
        use_stdio: bool = False,
        foreground: bool = False,
        pid_file: Path | None = None,
        extra_args: list[str] | None = None,
    ):
        self.kernel = Path(kernel)
        self.initrd = Path(initrd)
        self.cmdline = cmdline
        self.cpus = cpus
        self.memory_mb = memory_mb
        self.port = port
        self.runtime_dir = Path(runtime_dir)
        self.serial_log = Path(serial_log) if serial_log else None
        self.use_stdio = use_stdio
        self.foreground = foreground
        self.pid_file = Path(pid_file) if pid_file else None
        self.extra_args = extra_args or []

        # Find binaries
        self.vfkit_bin = vfkit_bin or self._find_vfkit()
        self.gvproxy_bin = gvproxy_bin or self._find_gvproxy()

        # Runtime paths
        self.gvproxy_socket = self.runtime_dir / "gvproxy.sock"
        self.gvproxy_api = self.runtime_dir / "gvproxy-api.sock"
        self.gvproxy_pid_file = self.runtime_dir / "gvproxy.pid"
        self.gvproxy_log = self.runtime_dir / "gvproxy.log"

        # Process handles
        self.vfkit_pid: int | None = None
        self.gvproxy_pid: int | None = None

        # Network config
        self.host_forward = f"127.0.0.1:{self.port}"

    def _find_vfkit(self) -> str:
        """Find vfkit binary."""
        if check_command("vfkit"):
            return "vfkit"
        raise BenchmarkError("vfkit not found (set MICROVM_VFKIT_BIN)")

    def _find_gvproxy(self) -> str:
        """Find gvproxy binary."""
        if check_command("gvproxy"):
            return "gvproxy"

        # Try GOPATH
        gopath = os.environ.get("GOPATH", "")
        if gopath:
            gopath_bin = Path(gopath) / "bin" / "gvproxy"
            if gopath_bin.is_file() and os.access(gopath_bin, os.X_OK):
                return str(gopath_bin)

        # Try go env GOPATH
        try:
            result = subprocess.run(
                ["go", "env", "GOPATH"],
                capture_output=True,
                text=True,
                check=True,
            )
            gopath = result.stdout.strip()
            if gopath:
                gopath_bin = Path(gopath) / "bin" / "gvproxy"
                if gopath_bin.is_file() and os.access(gopath_bin, os.X_OK):
                    return str(gopath_bin)
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass

        raise BenchmarkError(
            'gvproxy not found (install via "go install '
            'github.com/containers/gvisor-tap-vsock/cmd/gvproxy@latest" '
            "or set MICROVM_GVPROXY_BIN)"
        )

    def cleanup(self) -> None:
        """Clean up processes and sockets."""
        if self.vfkit_pid:
            try:
                os.kill(self.vfkit_pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass

        if self.gvproxy_pid_file.exists():
            try:
                pid = int(self.gvproxy_pid_file.read_text().strip())
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.5)
                os.kill(pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError, ValueError):
                pass
            finally:
                self.gvproxy_pid_file.unlink(missing_ok=True)

        self.gvproxy_socket.unlink(missing_ok=True)
        self.gvproxy_api.unlink(missing_ok=True)

    def start_gvproxy(self) -> None:
        """Start gvproxy for networking."""
        cmd = [
            self.gvproxy_bin,
            "--mtu", "1500",
            "--ssh-port", "-1",
            "--listen-vfkit", f"unixgram://{self.gvproxy_socket}",
            "--listen", f"unix://{self.gvproxy_api}",
            "--pid-file", str(self.gvproxy_pid_file),
            "--log-file", str(self.gvproxy_log),
        ]

        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait for gvproxy to start
        def check_gvproxy() -> bool:
            return (
                self.gvproxy_pid_file.exists()
                and self.gvproxy_api.exists()
                and self.gvproxy_socket.exists()
            )

        try:
            wait_for_condition(check_gvproxy, timeout_seconds=20.0, poll_interval=0.1)
        except BenchmarkError as exc:
            raise BenchmarkError("gvproxy failed to start") from exc

    def wait_gvproxy_ready(self) -> None:
        """Wait for gvproxy API to be ready."""
        import urllib.request
        import urllib.error

        def check_api() -> bool:
            try:
                # Use curl since urllib doesn't support unix sockets easily
                result = subprocess.run(
                    ["curl", "--silent", "--unix-socket", str(self.gvproxy_api),
                     "http://d/services/forwarder/all"],
                    capture_output=True,
                    timeout=5,
                )
                return result.returncode == 0
            except (subprocess.TimeoutExpired, FileNotFoundError):
                return False

        try:
            wait_for_condition(check_api, timeout_seconds=20.0, poll_interval=0.1)
        except BenchmarkError as exc:
            raise BenchmarkError("gvproxy API not responding") from exc

    def expose_port(self) -> None:
        """Configure port forwarding via gvproxy."""
        payload = json.dumps({
            "local": self.host_forward,
            "remote": GUEST_HTTP_TARGET,
            "protocol": "tcp",
        })

        result = subprocess.run(
            [
                "curl", "--silent",
                "--unix-socket", str(self.gvproxy_api),
                "-H", "Content-Type: application/json",
                "-X", "POST",
                "-d", payload,
                "http://d/services/forwarder/expose",
            ],
            capture_output=True,
        )

        if result.returncode != 0:
            raise BenchmarkError(
                f"gvproxy failed to expose {self.host_forward} -> {GUEST_HTTP_TARGET}"
            )

    def start_vfkit(self) -> None:
        """Start the VM via vfkit."""
        cmdline = f"{self.cmdline} root=/dev/ram0 vf_static_ip={STATIC_IP} vf_gateway={STATIC_GATEWAY}"

        args = [
            self.vfkit_bin,
            "--cpus", str(self.cpus),
            "--memory", str(self.memory_mb),
            "--kernel", str(self.kernel),
            "--initrd", str(self.initrd),
            "--kernel-cmdline", cmdline,
            "--device", f"virtio-net,unixSocketPath={self.gvproxy_socket},mac={STATIC_MAC}",
            "--device", "virtio-rng",
        ]

        if self.use_stdio:
            args.extend(["--device", "virtio-serial,stdio"])
        elif self.serial_log:
            args.extend(["--device", f"virtio-serial,logFilePath={self.serial_log}"])

        args.extend(["--device", "virtio-balloon"])
        args.extend(self.extra_args)

        if self.foreground:
            # Run in foreground
            os.execv(self.vfkit_bin, args)
        else:
            # Run in background
            if self.use_stdio:
                proc = subprocess.Popen(args)
            else:
                proc = subprocess.Popen(
                    args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )

            self.vfkit_pid = proc.pid

            if self.pid_file:
                self.pid_file.write_text(str(self.vfkit_pid))

            proc.wait()

    def launch(self) -> None:
        """Launch the VM with networking."""
        self.runtime_dir.mkdir(parents=True, exist_ok=True)

        atexit.register(self.cleanup)

        self.start_gvproxy()
        self.wait_gvproxy_ready()
        self.expose_port()
        self.start_vfkit()


def main() -> int:
    """Main entry point."""
    # Get configuration from environment
    required_vars = [
        "MICROVM_KERNEL",
        "MICROVM_INITRD",
        "MICROVM_CMDLINE",
        "MICROVM_CPUS",
        "MICROVM_MEMORY_MB",
        "MICROVM_PORT",
        "MICROVM_RUNTIME_DIR",
    ]

    for var in required_vars:
        if var not in os.environ:
            print(f"error: {var} environment variable is required", file=sys.stderr)
            return 1

    use_stdio = bool(os.environ.get("MICROVM_APPLEVF_STDIO"))

    if not use_stdio and "MICROVM_SERIAL_LOG" not in os.environ:
        print("error: MICROVM_SERIAL_LOG is required when not using stdio", file=sys.stderr)
        return 1

    extra_args = []
    if os.environ.get("MICROVM_EXTRA_ARGS"):
        extra_args = os.environ["MICROVM_EXTRA_ARGS"].split()

    try:
        launcher = VFKitLauncher(
            kernel=Path(os.environ["MICROVM_KERNEL"]),
            initrd=Path(os.environ["MICROVM_INITRD"]),
            cmdline=os.environ["MICROVM_CMDLINE"],
            cpus=int(os.environ["MICROVM_CPUS"]),
            memory_mb=int(os.environ["MICROVM_MEMORY_MB"]),
            port=int(os.environ["MICROVM_PORT"]),
            runtime_dir=Path(os.environ["MICROVM_RUNTIME_DIR"]),
            serial_log=os.environ.get("MICROVM_SERIAL_LOG"),
            vfkit_bin=os.environ.get("MICROVM_VFKIT_BIN"),
            gvproxy_bin=os.environ.get("MICROVM_GVPROXY_BIN"),
            use_stdio=use_stdio,
            foreground=bool(os.environ.get("MICROVM_APPLEVF_FOREGROUND")),
            pid_file=os.environ.get("MICROVM_PID_FILE"),
            extra_args=extra_args,
        )

        launcher.launch()
        return 0

    except BenchmarkError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
