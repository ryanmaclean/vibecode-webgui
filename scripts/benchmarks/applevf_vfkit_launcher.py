#!/usr/bin/env python3
"""Apple Virtualization Framework vfkit launcher.

Launches a microVM using vfkit and gvproxy for networking.
"""

import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
NC = '\033[0m'


@dataclass
class LauncherConfig:
    """Launcher configuration from environment."""

    kernel: str
    initrd: str
    cmdline: str
    cpus: int
    memory_mb: int
    port: int
    runtime_dir: Path
    serial_log: Optional[Path] = None
    pid_file: Optional[Path] = None
    vfkit_bin: Optional[str] = None
    gvproxy_bin: Optional[str] = None
    use_stdio: bool = False
    foreground: bool = False
    extra_args: str = ""


# Network configuration for gvproxy
STATIC_MAC = "5a:94:ef:e4:0c:ee"
STATIC_IP = "192.168.127.2/24"
STATIC_GATEWAY = "192.168.127.1"
GUEST_HTTP_TARGET = "192.168.127.2:3000"


def error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}error:{NC} {msg}", file=sys.stderr)


def command_exists(cmd: str) -> bool:
    """Check if a command exists."""
    return shutil.which(cmd) is not None


def find_binary(name: str, env_var: str) -> Optional[str]:
    """Find a binary from environment or PATH."""
    # Check environment variable first
    env_path = os.environ.get(env_var)
    if env_path and os.path.isfile(env_path):
        return env_path

    # Check PATH
    path = shutil.which(name)
    if path:
        return path

    # Check GOPATH for gvproxy
    if name == "gvproxy":
        try:
            result = subprocess.run(
                ["go", "env", "GOPATH"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                gopath = result.stdout.strip()
                gopath_bin = Path(gopath) / "bin" / "gvproxy"
                if gopath_bin.is_file() and os.access(gopath_bin, os.X_OK):
                    return str(gopath_bin)
        except FileNotFoundError:
            pass

    return None


def get_config_from_env() -> LauncherConfig:
    """Get configuration from environment variables."""
    required_vars = [
        "MICROVM_KERNEL",
        "MICROVM_INITRD",
        "MICROVM_CMDLINE",
        "MICROVM_CPUS",
        "MICROVM_MEMORY_MB",
        "MICROVM_PORT",
        "MICROVM_RUNTIME_DIR"
    ]

    for var in required_vars:
        if var not in os.environ:
            error(f"need {var}")
            sys.exit(1)

    use_stdio = bool(os.environ.get("MICROVM_APPLEVF_STDIO"))

    serial_log = None
    if not use_stdio:
        if "MICROVM_SERIAL_LOG" not in os.environ:
            error("need MICROVM_SERIAL_LOG")
            sys.exit(1)
        serial_log = Path(os.environ["MICROVM_SERIAL_LOG"])

    return LauncherConfig(
        kernel=os.environ["MICROVM_KERNEL"],
        initrd=os.environ["MICROVM_INITRD"],
        cmdline=os.environ["MICROVM_CMDLINE"],
        cpus=int(os.environ["MICROVM_CPUS"]),
        memory_mb=int(os.environ["MICROVM_MEMORY_MB"]),
        port=int(os.environ["MICROVM_PORT"]),
        runtime_dir=Path(os.environ["MICROVM_RUNTIME_DIR"]),
        serial_log=serial_log,
        pid_file=Path(os.environ.get("MICROVM_PID_FILE", "")) if os.environ.get("MICROVM_PID_FILE") else None,
        use_stdio=use_stdio,
        foreground=bool(os.environ.get("MICROVM_APPLEVF_FOREGROUND")),
        extra_args=os.environ.get("MICROVM_EXTRA_ARGS", "")
    )


class VMLauncher:
    """VM launcher with cleanup handling."""

    def __init__(self, config: LauncherConfig):
        """Initialize launcher."""
        self.config = config
        self.vfkit_pid: Optional[int] = None
        self.gvproxy_pid_file: Path = config.runtime_dir / "gvproxy.pid"
        self.gvproxy_socket: Path = config.runtime_dir / "gvproxy.sock"
        self.gvproxy_api: Path = config.runtime_dir / "gvproxy-api.sock"
        self.gvproxy_log: Path = config.runtime_dir / "gvproxy.log"
        self.host_forward = f"127.0.0.1:{config.port}"

        # Find binaries
        self.vfkit_bin = find_binary("vfkit", "MICROVM_VFKIT_BIN")
        self.gvproxy_bin = find_binary("gvproxy", "MICROVM_GVPROXY_BIN")

        if not self.vfkit_bin:
            error("vfkit not found (set MICROVM_VFKIT_BIN)")
            sys.exit(1)

        if not self.gvproxy_bin:
            error('gvproxy not found (install via "go install github.com/containers/gvisor-tap-vsock/cmd/gvproxy@latest" or set MICROVM_GVPROXY_BIN)')
            sys.exit(1)

        # Set up signal handlers
        signal.signal(signal.SIGTERM, self._cleanup_handler)
        signal.signal(signal.SIGINT, self._cleanup_handler)

    def _cleanup_handler(self, signum: int, frame: object) -> None:
        """Handle cleanup on signal."""
        self.cleanup()
        sys.exit(0)

    def cleanup(self) -> None:
        """Clean up processes and files."""
        # Kill vfkit
        if self.vfkit_pid:
            try:
                os.kill(self.vfkit_pid, signal.SIGTERM)
            except (OSError, ProcessLookupError):
                pass

        # Kill gvproxy
        if self.gvproxy_pid_file.exists():
            try:
                pid = int(self.gvproxy_pid_file.read_text().strip())
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.1)
                try:
                    os.kill(pid, signal.SIGKILL)
                except (OSError, ProcessLookupError):
                    pass
            except (ValueError, OSError, ProcessLookupError):
                pass
            self.gvproxy_pid_file.unlink(missing_ok=True)

        # Clean up sockets
        self.gvproxy_socket.unlink(missing_ok=True)
        self.gvproxy_api.unlink(missing_ok=True)

    def start_gvproxy(self) -> bool:
        """Start gvproxy."""
        cmd = [
            self.gvproxy_bin,
            "--mtu", "1500",
            "--ssh-port", "-1",
            "--listen-vfkit", f"unixgram://{self.gvproxy_socket}",
            "--listen", f"unix://{self.gvproxy_api}",
            "--pid-file", str(self.gvproxy_pid_file),
            "--log-file", str(self.gvproxy_log)
        ]

        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        # Wait for gvproxy to start
        for _ in range(200):
            if (self.gvproxy_pid_file.exists() and
                self.gvproxy_api.exists() and
                self.gvproxy_socket.exists()):
                return True
            time.sleep(0.1)

        error("gvproxy failed to start")
        return False

    def wait_gvproxy_ready(self) -> bool:
        """Wait for gvproxy API to be ready."""
        for _ in range(200):
            try:
                result = subprocess.run(
                    ["curl", "--silent", "--unix-socket", str(self.gvproxy_api),
                     "http://d/services/forwarder/all"],
                    capture_output=True
                )
                if result.returncode == 0:
                    return True
            except Exception:
                pass
            time.sleep(0.1)

        error("gvproxy API not responding")
        return False

    def expose_port(self) -> bool:
        """Expose port via gvproxy."""
        import json as json_module

        payload = json_module.dumps({
            "local": self.host_forward,
            "remote": GUEST_HTTP_TARGET,
            "protocol": "tcp"
        })

        result = subprocess.run(
            ["curl", "--silent", "--unix-socket", str(self.gvproxy_api),
             "-H", "Content-Type: application/json",
             "-X", "POST",
             "-d", payload,
             "http://d/services/forwarder/expose"],
            capture_output=True
        )

        if result.returncode != 0:
            error(f"gvproxy failed to expose {self.host_forward} -> {GUEST_HTTP_TARGET}")
            return False

        return True

    def start_vfkit(self) -> None:
        """Start vfkit."""
        cmdline = f"{self.config.cmdline} root=/dev/ram0 vf_static_ip={STATIC_IP} vf_gateway={STATIC_GATEWAY}"

        cmd = [
            self.vfkit_bin,
            "--cpus", str(self.config.cpus),
            "--memory", str(self.config.memory_mb),
            "--kernel", self.config.kernel,
            "--initrd", self.config.initrd,
            "--kernel-cmdline", cmdline,
            "--device", f"virtio-net,unixSocketPath={self.gvproxy_socket},mac={STATIC_MAC}",
            "--device", "virtio-rng"
        ]

        if self.config.use_stdio:
            cmd.extend(["--device", "virtio-serial,stdio"])
        else:
            cmd.extend(["--device", f"virtio-serial,logFilePath={self.config.serial_log}"])

        cmd.extend(["--device", "virtio-balloon"])

        if self.config.extra_args:
            cmd.extend(self.config.extra_args.split())

        if self.config.foreground:
            # Run in foreground
            subprocess.run(cmd)
        else:
            # Run in background
            if self.config.use_stdio:
                proc = subprocess.Popen(cmd)
            else:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            self.vfkit_pid = proc.pid

            if self.config.pid_file:
                self.config.pid_file.write_text(str(proc.pid))

            proc.wait()

    def run(self) -> int:
        """Run the launcher."""
        self.config.runtime_dir.mkdir(parents=True, exist_ok=True)

        if not self.start_gvproxy():
            return 1

        if not self.wait_gvproxy_ready():
            return 1

        if not self.expose_port():
            return 1

        self.start_vfkit()
        return 0


def main() -> int:
    """Main entry point."""
    config = get_config_from_env()
    launcher = VMLauncher(config)

    try:
        return launcher.run()
    finally:
        launcher.cleanup()


if __name__ == "__main__":
    sys.exit(main())
