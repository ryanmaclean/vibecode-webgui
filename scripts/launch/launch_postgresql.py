#!/usr/bin/env python3
"""Quick Launch Script for PostgreSQL VM."""

from __future__ import annotations

import glob
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"


@dataclass
class LaunchConfig:
    """PostgreSQL VM launch configuration."""

    azure_dir: Path = field(
        default_factory=lambda: Path.home() / "vibecode-webgui" / "azure"
    )
    console_log_pattern: str = "/tmp/vibecode-console-*.log"
    boot_wait_seconds: int = 30
    postgresql_port: int = 5432

    @property
    def postgresql_initramfs(self) -> Path:
        """Get PostgreSQL initramfs path."""
        return self.azure_dir / "postgresql-standalone.cpio.gz"

    @property
    def nodejs_initramfs(self) -> Path:
        """Get Node.js initramfs path."""
        return self.azure_dir / "nodejs-complete.cpio.gz"

    @property
    def nodejs_backup(self) -> Path:
        """Get Node.js backup initramfs path."""
        return self.azure_dir / "nodejs-backup.cpio.gz"

    @property
    def vm_executable(self) -> Path:
        """Get VM executable path."""
        return (
            self.azure_dir
            / "SwiftUI-Apps"
            / "NodeJSVibeCode.app"
            / "Contents"
            / "MacOS"
            / "NodeJS"
        )


def log_info(msg: str) -> None:
    """Print info message."""
    print(msg)


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}✓{NC} {msg}")


def log_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}WARNING:{NC} {msg}")


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}ERROR:{NC} {msg}")


def print_header() -> None:
    """Print launch header."""
    print(f"{BLUE}================================={NC}")
    print(f"{BLUE}  PostgreSQL VM Quick Launch{NC}")
    print(f"{BLUE}================================={NC}")
    print()


def kill_running_vms() -> None:
    """Kill any running VMs."""
    log_info("Stopping any running VMs...")

    for process_name in ["PostgreSQLVibeCode", "NodeJS"]:
        try:
            subprocess.run(
                ["killall", process_name],
                capture_output=True,
                timeout=5,
            )
        except (subprocess.TimeoutExpired, subprocess.SubprocessError):
            pass

    time.sleep(2)


def clean_console_logs(pattern: str) -> None:
    """Clean old console logs.

    Args:
        pattern: Glob pattern for log files.
    """
    log_info("Cleaning old console logs...")

    for log_file in glob.glob(pattern):
        try:
            os.remove(log_file)
        except OSError:
            pass


def check_initramfs(config: LaunchConfig) -> bool:
    """Check if PostgreSQL initramfs exists.

    Args:
        config: Launch configuration.

    Returns:
        True if initramfs exists.
    """
    if not config.postgresql_initramfs.exists():
        log_error("PostgreSQL initramfs not found!")
        return False
    return True


def swap_initramfs(config: LaunchConfig) -> bool:
    """Swap Node.js initramfs with PostgreSQL.

    Args:
        config: Launch configuration.

    Returns:
        True if swap successful.
    """
    try:
        # Backup current nodejs initramfs
        if config.nodejs_initramfs.exists():
            shutil.copy(config.nodejs_initramfs, config.nodejs_backup)

        # Copy PostgreSQL initramfs
        shutil.copy(config.postgresql_initramfs, config.nodejs_initramfs)
        return True
    except OSError as e:
        log_error(f"Failed to swap initramfs: {e}")
        return False


def launch_vm(config: LaunchConfig) -> int | None:
    """Launch the PostgreSQL VM.

    Args:
        config: Launch configuration.

    Returns:
        VM process ID or None on failure.
    """
    log_info("Launching PostgreSQL VM...")

    if not config.vm_executable.exists():
        log_error(f"VM executable not found: {config.vm_executable}")
        return None

    try:
        process = subprocess.Popen(
            [str(config.vm_executable)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(config.azure_dir),
        )
        return process.pid
    except OSError as e:
        log_error(f"Failed to launch VM: {e}")
        return None


def get_latest_console_log(pattern: str) -> Path | None:
    """Get the most recent console log file.

    Args:
        pattern: Glob pattern for log files.

    Returns:
        Path to latest log file or None.
    """
    log_files = glob.glob(pattern)
    if not log_files:
        return None

    # Sort by modification time, most recent first
    log_files.sort(key=os.path.getmtime, reverse=True)
    return Path(log_files[0])


def extract_vm_ip(log_path: Path) -> str | None:
    """Extract VM IP address from console log.

    Args:
        log_path: Path to console log.

    Returns:
        IP address or None.
    """
    try:
        # Read last 100 lines
        with open(log_path) as f:
            lines = f.readlines()[-100:]

        # Search for IP address
        ip_pattern = re.compile(r"inet\s+(\d+\.\d+\.\d+\.\d+)")
        for line in lines:
            match = ip_pattern.search(line)
            if match:
                return match.group(1)
    except OSError:
        pass

    return None


def print_access_instructions(vm_ip: str, port: int) -> None:
    """Print access instructions.

    Args:
        vm_ip: VM IP address.
        port: PostgreSQL port.
    """
    print()
    log_info(f"VM IP Address: {vm_ip}")
    log_info(f"PostgreSQL Port: {port}")
    print()
    log_info("Access Instructions:")
    log_info(f"  psql -h {vm_ip} -U postgres -d vibecode")
    print()
    log_info("Test Connection:")
    log_info(f"  pg_isready -h {vm_ip} -p {port}")
    print()


def tail_log(log_path: Path) -> None:
    """Tail the console log file.

    Args:
        log_path: Path to log file.
    """
    log_info(f"Console log: {log_path}")
    print()
    log_info("Press Ctrl+C to stop tailing log...")

    try:
        process = subprocess.Popen(
            ["tail", "-f", str(log_path)],
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        process.wait()
    except KeyboardInterrupt:
        print()
        log_info("Stopped tailing log")


def launch_postgresql(config: LaunchConfig | None = None) -> int:
    """Launch PostgreSQL VM.

    Args:
        config: Launch configuration (uses defaults if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = LaunchConfig()

    print_header()

    # Kill running VMs
    kill_running_vms()

    # Clean console logs
    clean_console_logs(config.console_log_pattern)

    # Check initramfs
    if not check_initramfs(config):
        return 1

    # Swap initramfs
    if not swap_initramfs(config):
        return 1

    # Launch VM
    vm_pid = launch_vm(config)
    if vm_pid is None:
        return 1

    log_info(f"VM PID: {vm_pid}")
    log_info("Waiting for boot...")

    # Wait for boot
    time.sleep(config.boot_wait_seconds)

    # Get console log
    console_log = get_latest_console_log(config.console_log_pattern)

    if console_log is None:
        log_warning("No console log found")
        return 0

    # Extract IP
    vm_ip = extract_vm_ip(console_log)

    if vm_ip:
        log_success("VM booted successfully")
        print_access_instructions(vm_ip, config.postgresql_port)
    else:
        log_warning("Could not determine VM IP")

    # Tail console log
    tail_log(console_log)

    return 0


def main() -> int:
    """Main entry point."""
    return launch_postgresql()


if __name__ == "__main__":
    sys.exit(main())
