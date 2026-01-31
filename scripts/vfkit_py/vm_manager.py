from __future__ import annotations

import argparse
import os
import shutil
import signal
import socket
import subprocess
import textwrap
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from .log import log_error, log_info, log_section, log_success, log_warn
from .paths import VFKitPaths


@dataclass(frozen=True)
class VMDefinition:
    name: str
    config_file: str
    port: int
    dependencies: tuple[str, ...] = ()
    description: str = ""


VM_DEFINITIONS: dict[str, VMDefinition] = {
    "valkey": VMDefinition(
        name="valkey",
        config_file="valkey-vm.yaml",
        port=6379,
        description="In-memory cache (Redis-compatible)",
    ),
    "postgresql": VMDefinition(
        name="postgresql",
        config_file="postgresql-vm.yaml",
        port=5432,
        description="PostgreSQL + pgvector",
    ),
    "nodejs-dev": VMDefinition(
        name="nodejs-dev",
        config_file="nodejs-dev-vm.yaml",
        port=3000,
        dependencies=("valkey", "postgresql"),
        description="Node.js dev env (3000/5173/8080)",
    ),
}

START_ORDER = ["valkey", "postgresql", "nodejs-dev"]
STOP_ORDER = list(reversed(START_ORDER))


class VMManager:
    def __init__(self, paths: VFKitPaths, definitions: dict[str, VMDefinition] | None = None):
        self.paths = paths
        self.paths.ensure_runtime_dirs()
        self.definitions = definitions or VM_DEFINITIONS

    def ensure_prereqs(self) -> None:
        binary = self.paths.vfkit_binary
        if not binary.exists():
            raise FileNotFoundError(f"vfkit binary not found: {binary}")
        if not os.access(binary, os.X_OK):
            raise PermissionError(f"vfkit binary is not executable: {binary}")

    # ------------------------------------------------------------------
    # path helpers
    def _vm(self, name: str) -> VMDefinition:
        try:
            return self.definitions[name]
        except KeyError:  # pragma: no cover - defensive path
            raise ValueError(f"Unknown VM: {name}")

    def _config_path(self, vm: VMDefinition) -> Path:
        return self.paths.config_dir / vm.config_file

    def _log_file(self, vm: VMDefinition) -> Path:
        return self.paths.vm_logs_dir / f"{vm.name}.log"

    def _pid_file(self, vm: VMDefinition) -> Path:
        return self.paths.vm_pids_dir / f"{vm.name}.pid"

    def _state_file(self, vm: VMDefinition) -> Path:
        return self.paths.vm_state_dir / f"{vm.name}.state"

    # ------------------------------------------------------------------
    # state helpers
    def _read_pid(self, vm: VMDefinition) -> int | None:
        pid_path = self._pid_file(vm)
        if not pid_path.exists():
            return None
        content = pid_path.read_text().strip()
        if not content:
            return None
        try:
            return int(content)
        except ValueError:
            return None

    def _write_pid(self, vm: VMDefinition, pid: int) -> None:
        self._pid_file(vm).write_text(f"{pid}\n")

    def _append_state(self, vm: VMDefinition, label: str) -> None:
        ts = int(time.time())
        self._state_file(vm).parent.mkdir(parents=True, exist_ok=True)
        with self._state_file(vm).open("a", encoding="utf-8") as fh:
            fh.write(f"{label}:{ts}\n")

    def is_running(self, vm: VMDefinition) -> bool:
        pid = self._read_pid(vm)
        if not pid:
            return False
        try:
            os.kill(pid, 0)
        except OSError:
            self._pid_file(vm).unlink(missing_ok=True)
            return False
        return True

    def _port_owner(self, port: int) -> str | None:
        try:
            result = subprocess.run(
                ["lsof", "-Pi", f":{port}", "-sTCP:LISTEN", "-t"],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            return None
        output = result.stdout.strip()
        return output or None

    def _port_available(self, port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            result = sock.connect_ex(("127.0.0.1", port))
            return result != 0

    def _wait_for_port(self, port: int, timeout: float = 60.0) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not self._port_available(port):
                return True
            time.sleep(1.0)
        return False

    def _tail_file(self, path: Path, lines: int = 20) -> list[str]:
        if not path.exists():
            return []
        dq: deque[str] = deque(maxlen=lines)
        with path.open("r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                dq.append(line.rstrip())
        return list(dq)

    # ------------------------------------------------------------------
    # VM lifecycle
    def start_vm(self, name: str) -> None:
        vm = self._vm(name)
        log_section(f"Starting VM: {vm.name}")

        if self.is_running(vm):
            log_warn(f"{vm.name} is already running (PID {self._read_pid(vm)})")
            return

        config_path = self._config_path(vm)
        if not config_path.exists():
            raise FileNotFoundError(f"Missing config: {config_path}")

        if not self._port_available(vm.port):
            owner = self._port_owner(vm.port) or "unknown"
            raise RuntimeError(f"Port {vm.port} already in use by {owner}")

        # start dependencies
        for dep in vm.dependencies:
            self.start_vm(dep)

        log_info(f"Config: {config_path}")
        log_info(f"Logs: {self._log_file(vm)}")

        log_file = self._log_file(vm)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        with log_file.open("ab") as log_handle:
            process = subprocess.Popen(
                [str(self.paths.vfkit_binary), "--config", str(config_path)],
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )

        self._write_pid(vm, process.pid)
        self._append_state(vm, "started")
        log_info(f"VM process started (PID: {process.pid})")

        log_info(f"Waiting for port {vm.port} to become available...")
        if self._wait_for_port(vm.port, timeout=60.0):
            log_success(f"{vm.name} is ready and listening on {vm.port}")
            self._append_state(vm, "ready")
            return

        log_error(f"{vm.name} failed to start (port {vm.port} not available)")
        for line in self._tail_file(log_file):
            log_error(f"  {line}")
        self.stop_vm(name)
        raise RuntimeError(f"VM {vm.name} failed to start")

    def stop_vm(self, name: str) -> None:
        vm = self._vm(name)
        log_section(f"Stopping VM: {vm.name}")

        if not self.is_running(vm):
            log_warn(f"{vm.name} is not running")
            return

        pid = self._read_pid(vm)
        assert pid is not None

        log_info(f"Sending SIGTERM to PID {pid}")
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass

        deadline = time.time() + 15
        while time.time() < deadline:
            if not self.is_running(vm):
                break
            time.sleep(1)
        else:
            log_warn("Process did not exit gracefully, sending SIGKILL")
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
            time.sleep(1)

        self._pid_file(vm).unlink(missing_ok=True)
        self._append_state(vm, "stopped")
        log_success(f"{vm.name} stopped")

    def restart_vm(self, name: str) -> None:
        log_section(f"Restarting VM: {name}")
        self.stop_vm(name)
        time.sleep(2)
        self.start_vm(name)

    # ------------------------------------------------------------------
    # Bulk operations
    def start_all(self) -> None:
        log_section("Starting all VMs")
        for vm_name in START_ORDER:
            try:
                self.start_vm(vm_name)
            except Exception as exc:
                log_error(f"Failed to start {vm_name}: {exc}")
            print()
        self.list_vms()

    def stop_all(self) -> None:
        log_section("Stopping all VMs")
        for vm_name in STOP_ORDER:
            try:
                self.stop_vm(vm_name)
            except Exception as exc:
                log_error(f"Failed to stop {vm_name}: {exc}")
            print()
        log_success("All VMs stopped")

    def restart_all(self) -> None:
        log_section("Restarting all VMs")
        self.stop_all()
        time.sleep(3)
        self.start_all()

    # ------------------------------------------------------------------
    # status + logs
    def list_vms(self) -> None:
        log_section("VibeCode VMs Status")
        for vm_name in self.definitions:
            self.status_vm(vm_name)
            print()

    def status_vm(self, name: str) -> None:
        vm = self._vm(name)
        running = self.is_running(vm)
        status = "RUNNING" if running else "STOPPED"
        color = "\033[0;32m" if running else "\033[0;31m"
        pid = self._read_pid(vm)
        uptime = self._compute_uptime(vm)
        port_state = "LISTENING" if not self._port_available(vm.port) else "NOT LISTENING"

        print(f"  \033[0;35m{vm.name}\033[0m")
        print(f"    Status: {color}{status}\033[0m")
        if pid:
            print(f"    PID: {pid}")
        if uptime:
            print(f"    Uptime: {uptime}")
        port_color = "\033[0;32m" if port_state == "LISTENING" else "\033[0;31m"
        print(f"    Port {vm.port}: {port_color}{port_state}\033[0m")
        print(f"    Config: {vm.config_file}")
        print(f"    Logs: {self._log_file(vm)}")

    def _compute_uptime(self, vm: VMDefinition) -> str | None:
        state_file = self._state_file(vm)
        if not state_file.exists():
            return None
        started = None
        for line in state_file.read_text().splitlines():
            if line.startswith("started:"):
                _, ts = line.split(":", 1)
                try:
                    started = int(ts)
                except ValueError:
                    continue
        if not started:
            return None
        seconds = max(0, int(time.time()) - started)
        days, rem = divmod(seconds, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, secs = divmod(rem, 60)
        return f"{days}d {hours}h {minutes}m {secs}s"

    def show_logs(self, name: str, lines: int = 50) -> None:
        vm = self._vm(name)
        log_file = self._log_file(vm)
        if not log_file.exists():
            raise FileNotFoundError(f"Log file not found: {log_file}")
        log_section(f"Logs for {vm.name} (last {lines} lines)")
        for line in self._tail_file(log_file, lines):
            print(line)

    def follow_logs(self, name: str) -> None:
        vm = self._vm(name)
        log_file = self._log_file(vm)
        log_section(f"Following logs for {vm.name}")
        subprocess.run(["tail", "-f", str(log_file)])

    # ------------------------------------------------------------------
    # health + monitoring
    def health_check(self) -> None:
        log_section("VM Health Check")
        healthy = True
        for vm_name in self.definitions:
            vm = self._vm(vm_name)
            print(f"\033[0;35m{vm.name}\033[0m")
            if not self.is_running(vm):
                print("  Status: \033[0;31mNOT RUNNING\033[0m")
                healthy = False
                print()
                continue
            if self._port_available(vm.port):
                print(f"  Port {vm.port}: \033[0;31mFAILED\033[0m")
                healthy = False
            else:
                print(f"  Port {vm.port}: \033[0;32mOK\033[0m")
            self._service_specific_checks(vm)
            print()
        if healthy:
            log_success("All VMs are healthy")
        else:
            log_error("Some VMs are unhealthy")

    def _service_specific_checks(self, vm: VMDefinition) -> None:
        if vm.name == "valkey":
            if shutil.which("redis-cli") and self._redis_ping():
                print("  Ping: \033[0;32mPONG\033[0m")
            else:
                print("  Ping: \033[0;31mFAILED\033[0m")
        elif vm.name == "postgresql":
            if shutil.which("psql") and self._psql_ping():
                print("  Connection: \033[0;32mOK\033[0m")
            else:
                print("  Connection: \033[0;33mAUTH REQUIRED\033[0m")
        elif vm.name == "nodejs-dev":
            if shutil.which("curl") and self._http_health():
                print("  HTTP: \033[0;32mOK\033[0m")
            else:
                print("  HTTP: \033[0;33mNOT RESPONDING\033[0m")

    def _redis_ping(self) -> bool:
        result = subprocess.run(
            ["redis-cli", "-h", "localhost", "-p", "6379", "ping"],
            capture_output=True,
            text=True,
            check=False,
        )
        return "PONG" in result.stdout

    def _psql_ping(self) -> bool:
        result = subprocess.run(
            ["psql", "-h", "localhost", "-U", "vibecode", "-d", "vibecode", "-c", "SELECT 1"],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0

    def _http_health(self) -> bool:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:3000/health"],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0

    def monitor(self) -> None:
        log_section("VM Resource Usage")
        for vm_name in self.definitions:
            vm = self._vm(vm_name)
            if not self.is_running(vm):
                continue
            pid = self._read_pid(vm)
            if not pid:
                continue
            print(f"{vm.name} (PID: {pid})")
            result = subprocess.run(
                ["ps", "-p", str(pid), "-o", "%cpu,%mem,rss,vsz"],
                capture_output=True,
                text=True,
                check=False,
            )
            lines = result.stdout.strip().splitlines()
            if len(lines) >= 2:
                cpu, mem, rss, vsz = lines[1].split()
                print(f"  CPU: {cpu}%")
                print(f"  Memory: {mem}%")
                print(f"  RSS: {int(int(rss) / 1024)} MB")
                print(f"  VSZ: {int(int(vsz) / 1024)} MB")
            print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vm-manager.py",
        description="VibeCode vfkit VM Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Commands mirror the legacy vm-manager.sh script:
              start <vm>    Start VM (valkey, postgresql, nodejs-dev)
              stop <vm>     Stop VM
              restart <vm>  Restart VM
              status <vm>   Show VM status
              logs <vm>     Show tail of log file
              follow <vm>   Follow log file (tail -f)
              start-all     Start all VMs
              stop-all      Stop all VMs
              restart-all   Restart all VMs
              list          List VM status
              health        Run health checks
              monitor       Show resource usage
            """
        ),
    )
    parser.add_argument("command", help="Command to run")
    parser.add_argument("args", nargs=argparse.REMAINDER, help="Command arguments")
    return parser


def dispatch(manager: VMManager, command: str, args: list[str]) -> None:
    if command == "start":
        _require_arg(args, "vm name")
        manager.start_vm(args[0])
    elif command == "stop":
        _require_arg(args, "vm name")
        manager.stop_vm(args[0])
    elif command == "restart":
        _require_arg(args, "vm name")
        manager.restart_vm(args[0])
    elif command == "status":
        _require_arg(args, "vm name")
        manager.status_vm(args[0])
    elif command == "logs":
        _require_arg(args, "vm name")
        lines = int(args[1]) if len(args) > 1 else 50
        manager.show_logs(args[0], lines)
    elif command == "follow":
        _require_arg(args, "vm name")
        manager.follow_logs(args[0])
    elif command in {"start-all", "start_all"}:
        manager.start_all()
    elif command in {"stop-all", "stop_all"}:
        manager.stop_all()
    elif command in {"restart-all", "restart_all"}:
        manager.restart_all()
    elif command in {"list", "ls"}:
        manager.list_vms()
    elif command == "health":
        manager.health_check()
    elif command in {"monitor", "top"}:
        manager.monitor()
    else:
        raise SystemExit(f"Unknown command: {command}")


def _require_arg(args: list[str], label: str) -> None:
    if not args:
        raise SystemExit(f"Missing {label}")


def cli(argv: list[str] | None = None) -> None:
    parser = build_parser()
    parsed = parser.parse_args(argv)
    manager = VMManager(VFKitPaths.discover())
    manager.ensure_prereqs()
    dispatch(manager, parsed.command, parsed.args)


__all__ = ["VMManager", "cli"]
