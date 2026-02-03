#!/usr/bin/env python3
"""Launch VibeCode Alpine VM with Node.js 24 + OpenVSCode Server using vfkit."""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

import atexit
import os
import shutil
import signal
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"


@dataclass
class VMConfig:
    """VM configuration."""

    vm_dir: Path = field(default_factory=lambda: Path.home() / ".vfkit" / "vms" / "vibecode-alpine")
    cpus: int = field(default_factory=lambda: int(os.getenv("VFKIT_CPUS", "4")))
    memory: int = field(default_factory=lambda: int(os.getenv("VFKIT_MEMORY", "4096")))
    disk_size: str = field(default_factory=lambda: os.getenv("VFKIT_DISK_SIZE", "20G"))
    vm_name: str = "vibecode-alpine-vscode"
    mac_address: str = "52:54:00:12:34:56"
    vsock_port: int = 1024

    @property
    def kernel_dir(self) -> Path:
        """Get kernel directory path."""
        return self.vm_dir / "kernel"

    @property
    def rootfs_dir(self) -> Path:
        """Get rootfs directory path."""
        return self.vm_dir / "rootfs"

    @property
    def disk_dir(self) -> Path:
        """Get disk directory path."""
        return self.vm_dir / "disk"

    @property
    def logs_dir(self) -> Path:
        """Get logs directory path."""
        return self.vm_dir / "logs"

    @property
    def kernel_path(self) -> Path:
        """Get kernel file path."""
        return self.kernel_dir / "vmlinux"

    @property
    def rootfs_path(self) -> Path:
        """Get rootfs file path."""
        return self.rootfs_dir / "alpine-vscode-server-rootfs.cpio.gz"

    @property
    def console_log(self) -> Path:
        """Get console log file path."""
        return self.logs_dir / "console.log"

    @property
    def vsock_path(self) -> Path:
        """Get vsock socket path."""
        return self.vm_dir / "vsock.sock"

    @property
    def kernel_cmdline(self) -> str:
        """Get kernel command line."""
        return "console=hvc0 rw init=/sbin/init"


def log_info(msg: str) -> None:
    """Print info message."""
    print(msg)


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}✅ {msg}{NC}")


def log_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}⚠️  {msg}{NC}")


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}❌ {msg}{NC}")


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    if not path.exists():
        return "0B"
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def check_vfkit_installed() -> bool:
    """Check if vfkit is installed.

    Returns:
        True if vfkit is available.
    """
    vfkit_path = shutil.which("vfkit")
    if not vfkit_path:
        log_error("vfkit not found")
        print()
        log_info("Install it:")
        log_info("  brew install vfkit")
        print()
        return False

    log_success(f"vfkit found: {vfkit_path}")
    print()
    return True


def check_kernel(config: VMConfig) -> bool:
    """Check if kernel file exists.

    Args:
        config: VM configuration.

    Returns:
        True if kernel exists.
    """
    if not config.kernel_path.exists():
        log_error(f"Kernel not found: {config.kernel_path}")
        print()
        log_info("Run setup first:")
        log_info("  ./scripts/vfkit/10-upgrade-to-alpine-3.22.sh")
        print()
        return False

    kernel_size = get_file_size_human(config.kernel_path)
    log_success(f"Kernel: {config.kernel_path} ({kernel_size})")
    return True


def check_rootfs(config: VMConfig) -> bool:
    """Check if rootfs file exists.

    Args:
        config: VM configuration.

    Returns:
        True if rootfs exists.
    """
    if not config.rootfs_path.exists():
        log_error(f"Rootfs not found: {config.rootfs_path}")
        print()
        log_info("Create it first:")
        log_info("  ./scripts/vfkit/12-create-vscode-server-rootfs.sh")
        print()
        return False

    rootfs_size = get_file_size_human(config.rootfs_path)
    log_success(f"Using rootfs with VS Code Server: {config.rootfs_path} ({rootfs_size})")
    print()
    return True


def print_vm_config(config: VMConfig) -> None:
    """Print VM configuration summary.

    Args:
        config: VM configuration.
    """
    log_info("=== VM Configuration ===")
    log_info(f"Name:     {config.vm_name}")
    log_info(f"CPUs:     {config.cpus}")
    log_info(f"Memory:   {config.memory} MB")
    log_info(f"Disk:     {config.disk_size}")
    print()
    log_info(f"Kernel cmdline: {config.kernel_cmdline}")
    print()


def print_vfkit_command(config: VMConfig) -> None:
    """Print vfkit command that will be executed.

    Args:
        config: VM configuration.
    """
    log_info("=== Starting VM ===")
    print()
    log_info("Command:")
    log_info("vfkit \\")
    log_info(f"  --cpus {config.cpus} \\")
    log_info(f"  --memory {config.memory} \\")
    log_info(f"  --kernel {config.kernel_path} \\")
    log_info(f"  --initrd {config.rootfs_path} \\")
    log_info(f'  --kernel-cmdline "{config.kernel_cmdline}" \\')
    log_info(f"  --device virtio-net,nat,mac={config.mac_address} \\")
    log_info(f"  --device virtio-serial,logFilePath={config.console_log} \\")
    log_info("  --device virtio-rng \\")
    log_info(f"  --device virtio-vsock,port={config.vsock_port},socketURL=unix://{config.vsock_path}")
    print()
    log_info("Press Ctrl+C to stop the VM")
    print()
    log_info("-----------------------------------")
    print()


def print_cleanup_message(config: VMConfig) -> None:
    """Print cleanup message when VM stops.

    Args:
        config: VM configuration.
    """
    print()
    print()
    log_info("-----------------------------------")
    print()
    log_info("VM stopped")
    print()
    log_info(f"Console log: {config.console_log}")
    print()
    log_info(f"To view logs: tail -f {config.console_log}")
    print()
    log_info("To start OpenVSCode Server:")
    log_info("  1. Boot VM again with this script")
    log_info("  2. Login as root (no password)")
    log_info("  3. Run: start-vscode")
    log_info("  4. Access: http://localhost:3000")
    print()


def build_vfkit_command(config: VMConfig) -> list[str]:
    """Build vfkit command arguments.

    Args:
        config: VM configuration.

    Returns:
        List of command arguments.
    """
    return [
        "vfkit",
        "--cpus", str(config.cpus),
        "--memory", str(config.memory),
        "--kernel", str(config.kernel_path),
        "--initrd", str(config.rootfs_path),
        "--kernel-cmdline", config.kernel_cmdline,
        "--device", f"virtio-net,nat,mac={config.mac_address}",
        "--device", f"virtio-serial,logFilePath={config.console_log}",
        "--device", "virtio-rng",
        "--device", f"virtio-vsock,port={config.vsock_port},socketURL=unix://{config.vsock_path}",
    ]


def launch_vm(config: VMConfig) -> int:
    """Launch the VM using vfkit.

    Args:
        config: VM configuration.

    Returns:
        Exit code from vfkit process.
    """
    cmd = build_vfkit_command(config)

    try:
        # Run vfkit, passing through signals
        process = subprocess.Popen(cmd)

        # Wait for process to complete
        return process.wait()

    except KeyboardInterrupt:
        # Handle Ctrl+C gracefully
        return 0
    except subprocess.SubprocessError as e:
        log_error(f"Failed to launch VM: {e}")
        return 1


def run_launch_vm(config: VMConfig | None = None) -> int:
    """Run the VM launch process.

    Args:
        config: VM configuration (uses defaults if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = VMConfig()

    log_info("=== Launching VibeCode Alpine VM with VS Code Server ===")
    print()

    # Check prerequisites
    if not check_vfkit_installed():
        return 1

    if not check_kernel(config):
        return 1

    if not check_rootfs(config):
        return 1

    # Note about boot mode
    log_info("ℹ️  Booting from initramfs (no persistent disk)")
    print()

    # Create logs directory
    config.logs_dir.mkdir(parents=True, exist_ok=True)
    log_info(f"📋 Console log: {config.console_log}")
    print()

    # Print configuration
    print_vm_config(config)
    print_vfkit_command(config)

    # Register cleanup handler
    atexit.register(print_cleanup_message, config)

    # Launch VM
    return launch_vm(config)


def main() -> int:
    """Main entry point."""
    return run_launch_vm()


if __name__ == "__main__":
    sys.exit(main())
