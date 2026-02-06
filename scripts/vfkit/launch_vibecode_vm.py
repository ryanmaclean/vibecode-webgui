#!/usr/bin/env python3
"""Launch Alpine Linux ARM64 VM for VibeCode with project directory sharing.

Includes virtio-fs for sharing host project directory.
"""

import argparse
import atexit
import os
import shutil
import signal
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class VMConfig:
    """Configuration for the VibeCode VM."""

    name: str = "vibecode-alpine"
    cpus: int = field(default_factory=lambda: int(os.environ.get("VFKIT_CPUS", "4")))
    memory: int = field(
        default_factory=lambda: int(os.environ.get("VFKIT_MEMORY", "4096"))
    )
    disk_size: str = field(
        default_factory=lambda: os.environ.get("VFKIT_DISK_SIZE", "20G")
    )
    share_tag: str = "vibecode"
    mount_point: str = "/mnt/vibecode"
    mac_address: str = "52:54:00:12:34:56"
    vsock_port: int = 1024


def get_script_dir() -> Path:
    """Get the directory containing this script.

    Returns:
        Path to script directory.
    """
    return Path(__file__).parent.resolve()


def get_project_dir() -> Path:
    """Get the project root directory.

    Returns:
        Path to project root.
    """
    return get_script_dir().parent.parent


def get_vm_dir() -> Path:
    """Get the VM directory.

    Returns:
        Path to VM directory.
    """
    return Path.home() / ".vfkit" / "vms" / "vibecode-alpine"


def get_file_size(path: Path) -> str:
    """Get human-readable file size.

    Args:
        path: Path to file.

    Returns:
        Human-readable size string.
    """
    try:
        result = subprocess.run(
            ["du", "-h", str(path)],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.split()[0]
    except Exception:
        pass
    return "unknown"


def check_vfkit_installed() -> Optional[str]:
    """Check if vfkit is installed.

    Returns:
        Path to vfkit or None if not found.
    """
    vfkit_path = shutil.which("vfkit")
    if vfkit_path:
        print(f"{GREEN}vfkit found: {vfkit_path}{NC}")
        return vfkit_path
    print(f"{RED}vfkit is not installed{NC}")
    print("Run: ./scripts/vfkit/01-setup-vfkit.sh")
    return None


def verify_kernel(vm_dir: Path) -> Optional[Path]:
    """Verify kernel exists.

    Args:
        vm_dir: Path to VM directory.

    Returns:
        Path to kernel or None if not found.
    """
    kernel = vm_dir / "kernel" / "vmlinux"
    if kernel.exists():
        print(f"{GREEN}Kernel: {kernel} ({get_file_size(kernel)}){NC}")
        return kernel
    print(f"{RED}Kernel not found: {kernel}{NC}")
    print("Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
    return None


def find_initramfs(vm_dir: Path) -> Optional[Path]:
    """Find the initramfs to use.

    Args:
        vm_dir: Path to VM directory.

    Returns:
        Path to initramfs or None if not found.
    """
    custom_initramfs = vm_dir / "rootfs" / "alpine-vibecode-rootfs.cpio.gz"
    kernel_initramfs = vm_dir / "kernel" / "initramfs"

    if custom_initramfs.exists():
        print(f"{GREEN}Using custom rootfs: {custom_initramfs} "
              f"({get_file_size(custom_initramfs)}){NC}")
        return custom_initramfs

    if kernel_initramfs.exists():
        print(f"{YELLOW}Using Alpine initramfs: {kernel_initramfs} "
              f"({get_file_size(kernel_initramfs)}){NC}")
        print("   (Run 03-create-alpine-rootfs.sh for full VibeCode environment)")
        return kernel_initramfs

    print(f"{RED}No initramfs found{NC}")
    print("Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
    return None


def create_disk_image(disk_path: Path, size: str) -> bool:
    """Create a disk image if it doesn't exist.

    Args:
        disk_path: Path to disk image.
        size: Size of disk (e.g., "20G").

    Returns:
        True if disk exists or was created successfully.
    """
    disk_path.parent.mkdir(parents=True, exist_ok=True)

    if disk_path.exists():
        print(f"{GREEN}Using existing disk: {disk_path} "
              f"({get_file_size(disk_path)}){NC}")
        return True

    print(f"Creating disk image: {size}")

    # Try qemu-img first
    if shutil.which("qemu-img"):
        result = subprocess.run(
            ["qemu-img", "create", "-f", "raw", str(disk_path), size],
            capture_output=True
        )
        if result.returncode == 0:
            print(f"{GREEN}Disk image created: {disk_path}{NC}")
            return True

    # Fall back to dd for sparse file
    try:
        subprocess.run(
            ["dd", "if=/dev/zero", f"of={disk_path}",
             "bs=1", "count=0", f"seek={size}"],
            capture_output=True,
            check=True
        )
        print(f"{GREEN}Disk image created: {disk_path}{NC}")
        return True
    except subprocess.CalledProcessError:
        print(f"{RED}Failed to create disk image{NC}")
        return False


def prepare_console_log(log_dir: Path) -> Path:
    """Prepare the console log file.

    Args:
        log_dir: Path to log directory.

    Returns:
        Path to console log file.
    """
    log_dir.mkdir(parents=True, exist_ok=True)
    console_log = log_dir / "console.log"
    # Truncate log file
    console_log.write_text("")
    print(f"Console log: {console_log}")
    return console_log


def verify_project_dir(project_dir: Path, config: VMConfig) -> bool:
    """Verify the project directory exists.

    Args:
        project_dir: Path to project directory.
        config: VM configuration.

    Returns:
        True if directory exists.
    """
    print(f"VibeCode project directory: {project_dir}")

    if not project_dir.is_dir():
        print(f"{RED}Project directory not found: {project_dir}{NC}")
        return False

    print(f"   Share tag: {config.share_tag}")
    print(f"   Mount point in VM: {config.mount_point}")
    return True


def print_config_summary(config: VMConfig, project_dir: Path) -> None:
    """Print VM configuration summary.

    Args:
        config: VM configuration.
        project_dir: Path to project directory.
    """
    print()
    print("=== VM Configuration ===")
    print(f"Name:              {config.name}")
    print(f"CPUs:              {config.cpus}")
    print(f"Memory:            {config.memory} MB")
    print(f"Disk:              {config.disk_size}")
    print(f"Shared Directory:  {project_dir} -> {config.mount_point}")
    print()


def build_vfkit_command(
    config: VMConfig,
    kernel: Path,
    initramfs: Path,
    disk_image: Path,
    console_log: Path,
    project_dir: Path,
    vm_dir: Path
) -> list[str]:
    """Build the vfkit command.

    Args:
        config: VM configuration.
        kernel: Path to kernel.
        initramfs: Path to initramfs.
        disk_image: Path to disk image.
        console_log: Path to console log.
        project_dir: Path to project directory.
        vm_dir: Path to VM directory.

    Returns:
        Command as list of strings.
    """
    cmdline = "console=hvc0 root=/dev/vda rw quiet"

    cmd = [
        "vfkit",
        "--cpus", str(config.cpus),
        "--memory", str(config.memory),
        "--kernel", str(kernel),
        "--initrd", str(initramfs),
        "--kernel-cmdline", cmdline,
        # Block device (disk)
        "--device", f"virtio-blk,path={disk_image}",
        # Network device with NAT
        "--device", f"virtio-net,nat,mac={config.mac_address}",
        # Directory sharing (virtio-fs)
        "--device", f"virtio-fs,sharedDir={project_dir},mountTag={config.share_tag}",
        # Serial console for logging
        "--device", f"virtio-serial,logFilePath={console_log}",
        # Random number generator
        "--device", "virtio-rng",
        # Virtio vsock for host-guest communication
        "--device", f"virtio-vsock,port={config.vsock_port},"
                    f"socketURL=unix://{vm_dir}/vsock.sock",
    ]

    return cmd


def print_startup_info(console_log: Path) -> None:
    """Print startup information.

    Args:
        console_log: Path to console log.
    """
    print()
    print("=== Starting VM ===")
    print()
    print("Press Ctrl+C to stop the VM")
    print()
    print("Access the application:")
    print("  - VibeCode WebGUI: http://localhost:3000")
    print("  - PostgreSQL: localhost:5432")
    print("  - Redis: localhost:6379")
    print()
    print("-----------------------------------")
    print()


def cleanup(console_log: Path) -> None:
    """Cleanup function called on exit.

    Args:
        console_log: Path to console log.
    """
    print()
    print("-----------------------------------")
    print()
    print("VM stopped")
    print()
    print(f"Console log: {console_log}")
    print()
    print(f"To view logs: tail -f {console_log}")
    print()


def main(
    cpus: Optional[int] = None,
    memory: Optional[int] = None,
    disk_size: Optional[str] = None,
    dry_run: bool = False
) -> int:
    """Main entry point.

    Args:
        cpus: Number of CPUs (default: from env or 4).
        memory: Memory in MB (default: from env or 4096).
        disk_size: Disk size (default: from env or 20G).
        dry_run: If True, only print the command without executing.

    Returns:
        Exit code (0 for success).
    """
    print("=== Launching VibeCode Alpine VM with vfkit ===")
    print()

    # Create configuration
    config = VMConfig()
    if cpus:
        config.cpus = cpus
    if memory:
        config.memory = memory
    if disk_size:
        config.disk_size = disk_size

    # Get paths
    project_dir = get_project_dir()
    vm_dir = get_vm_dir()

    # Verify vfkit is installed
    if not check_vfkit_installed():
        return 1
    print()

    # Verify kernel
    kernel = verify_kernel(vm_dir)
    if not kernel:
        return 1

    # Find initramfs
    initramfs = find_initramfs(vm_dir)
    if not initramfs:
        return 1
    print()

    # Create disk image
    disk_image = vm_dir / "disk" / "root.img"
    if not create_disk_image(disk_image, config.disk_size):
        return 1
    print()

    # Prepare console log
    log_dir = vm_dir / "logs"
    console_log = prepare_console_log(log_dir)
    print()

    # Verify project directory
    if not verify_project_dir(project_dir, config):
        return 1

    # Print configuration summary
    print_config_summary(config, project_dir)

    # Build command
    cmd = build_vfkit_command(
        config, kernel, initramfs, disk_image,
        console_log, project_dir, vm_dir
    )

    print(f"Kernel cmdline: console=hvc0 root=/dev/vda rw quiet")
    print()
    print("Command:")
    print(" ".join(cmd))

    if dry_run:
        print()
        print("(Dry run - not executing)")
        return 0

    print_startup_info(console_log)

    # Register cleanup
    atexit.register(cleanup, console_log)

    # Handle signals
    def signal_handler(signum, frame):
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Launch VM
    try:
        result = subprocess.run(cmd)
        return result.returncode
    except FileNotFoundError:
        print(f"{RED}vfkit command not found{NC}")
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Launch Alpine Linux ARM64 VM for VibeCode"
    )
    parser.add_argument(
        '--cpus',
        type=int,
        help="Number of CPUs (default: VFKIT_CPUS env or 4)"
    )
    parser.add_argument(
        '--memory',
        type=int,
        help="Memory in MB (default: VFKIT_MEMORY env or 4096)"
    )
    parser.add_argument(
        '--disk-size',
        help="Disk size (default: VFKIT_DISK_SIZE env or 20G)"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Print command without executing"
    )

    args = parser.parse_args()
    sys.exit(main(args.cpus, args.memory, args.disk_size, args.dry_run))
