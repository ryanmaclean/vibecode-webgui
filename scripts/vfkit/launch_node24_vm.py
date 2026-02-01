#!/usr/bin/env python3
"""
Launch Alpine VM with Node.js 24.10.0 (musl-optimized).

Boots the VM with kernel, initramfs, and networking using vfkit.
"""

import argparse
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path
from typing import List, Optional


# Default VM Configuration
DEFAULT_CPUS = 4
DEFAULT_MEMORY = 4096  # MB
DEFAULT_DISK_SIZE = "20G"
VM_NAME = "vibecode-alpine"


def get_file_size(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def verify_vfkit() -> Optional[str]:
    """Verify vfkit is installed and return its path."""
    vfkit_path = shutil.which("vfkit")
    if not vfkit_path:
        print("x vfkit is not installed")
        print("Run: ./scripts/vfkit/01-setup-vfkit.sh")
        return None
    print(f"+ vfkit found: {vfkit_path}")
    return vfkit_path


def verify_kernel(kernel_path: Path) -> bool:
    """Verify kernel exists."""
    if not kernel_path.exists():
        print(f"x Kernel not found: {kernel_path}")
        print("Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
        return False
    print(f"+ Kernel: {kernel_path} ({get_file_size(kernel_path)})")
    return True


def find_initramfs(
    custom_initramfs: Path,
    kernel_initramfs: Path,
) -> Optional[Path]:
    """Find the appropriate initramfs to use."""
    if custom_initramfs.exists():
        print(f"+ Using Node.js 24 rootfs: {custom_initramfs} ({get_file_size(custom_initramfs)})")
        return custom_initramfs
    elif kernel_initramfs.exists():
        print(f"! Using Alpine initramfs: {kernel_initramfs} ({get_file_size(kernel_initramfs)})")
        print("   (Run 08-create-node24-rootfs.sh for Node.js 24 environment)")
        return kernel_initramfs
    else:
        print("x No initramfs found")
        print("Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
        return None


def create_disk_image(disk_path: Path, size: str) -> bool:
    """Create disk image if it doesn't exist."""
    disk_path.parent.mkdir(parents=True, exist_ok=True)

    if disk_path.exists():
        print(f"+ Using existing disk: {disk_path} ({get_file_size(disk_path)})")
        return True

    print(f"Creating disk image: {size}")

    if shutil.which("qemu-img"):
        try:
            subprocess.run(
                ["qemu-img", "create", "-f", "raw", str(disk_path), size],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError as e:
            print(f"x Failed to create disk image: {e}")
            return False
    else:
        # Create sparse file as fallback
        try:
            subprocess.run(
                ["dd", "if=/dev/zero", f"of={disk_path}", "bs=1", "count=0", f"seek={size}"],
                check=True,
                capture_output=True,
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError as e:
            print(f"x Failed to create disk image: {e}")
            return False

    print(f"+ Disk image created: {disk_path}")
    return True


def build_vfkit_command(
    cpus: int,
    memory: int,
    kernel: Path,
    initramfs: Path,
    disk_image: Path,
    console_log: Path,
    vsock_path: Path,
    cmdline: str,
) -> List[str]:
    """Build the vfkit command with all devices."""
    cmd = [
        "vfkit",
        "--cpus", str(cpus),
        "--memory", str(memory),
        "--kernel", str(kernel),
        "--initrd", str(initramfs),
        "--kernel-cmdline", cmdline,
        # Block device (disk)
        "--device", f"virtio-blk,path={disk_image}",
        # Network device with NAT
        "--device", "virtio-net,nat,mac=52:54:00:12:34:56",
        # Serial console for logging
        "--device", f"virtio-serial,logFilePath={console_log}",
        # Random number generator
        "--device", "virtio-rng",
        # Virtio vsock for host-guest communication
        "--device", f"virtio-vsock,port=1024,socketURL=unix://{vsock_path}",
    ]
    return cmd


def launch_vm(
    cpus: int = DEFAULT_CPUS,
    memory: int = DEFAULT_MEMORY,
    disk_size: str = DEFAULT_DISK_SIZE,
    vm_dir: Optional[Path] = None,
    debug: bool = False,
) -> int:
    """
    Launch the Alpine VM with Node.js 24 using vfkit.

    Args:
        cpus: Number of CPUs for the VM
        memory: Memory in MB for the VM
        disk_size: Disk size (e.g., "20G")
        vm_dir: Directory for VM files
        debug: Enable debug kernel output

    Returns:
        0 on success, 1 on failure
    """
    print("=== Launching VibeCode Alpine VM with Node.js 24 ===")
    print()

    # Set up paths
    if vm_dir is None:
        vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"

    kernel_dir = vm_dir / "kernel"
    rootfs_dir = vm_dir / "rootfs"
    disk_dir = vm_dir / "disk"
    log_dir = vm_dir / "logs"

    kernel = kernel_dir / "vmlinux"
    initramfs_kernel = kernel_dir / "initramfs"
    initramfs_custom = rootfs_dir / "alpine-node24-rootfs.cpio.gz"
    disk_image = disk_dir / "root.img"
    console_log = log_dir / "console.log"
    vsock_path = vm_dir / "vsock.sock"

    # Verify vfkit
    if not verify_vfkit():
        return 1

    print()

    # Verify kernel
    if not verify_kernel(kernel):
        return 1

    # Find initramfs
    initramfs = find_initramfs(initramfs_custom, initramfs_kernel)
    if initramfs is None:
        return 1

    print()

    # Create disk image
    if not create_disk_image(disk_image, disk_size):
        return 1

    print()

    # Prepare console log
    log_dir.mkdir(parents=True, exist_ok=True)
    console_log.write_text("")  # Truncate log file

    print(f"Console log: {console_log}")
    print()

    # VM Configuration Summary
    print("=== VM Configuration ===")
    print(f"Name:     {VM_NAME}")
    print(f"CPUs:     {cpus}")
    print(f"Memory:   {memory} MB")
    print(f"Disk:     {disk_size}")
    print()

    # Kernel command line
    cmdline = "console=hvc0 root=/dev/vda rw quiet"
    if debug:
        cmdline += " debug loglevel=7"

    print(f"Kernel cmdline: {cmdline}")
    print()

    # Build vfkit command
    vfkit_cmd = build_vfkit_command(
        cpus=cpus,
        memory=memory,
        kernel=kernel,
        initramfs=initramfs,
        disk_image=disk_image,
        console_log=console_log,
        vsock_path=vsock_path,
        cmdline=cmdline,
    )

    print("=== Starting VM ===")
    print()
    print("Command:")
    print(" ".join(vfkit_cmd))
    print()
    print("Press Ctrl+C to stop the VM")
    print()
    print("-----------------------------------")
    print()

    def cleanup(signum=None, frame=None):
        """Cleanup on exit."""
        print()
        print("-----------------------------------")
        print()
        print("VM stopped")
        print()
        print(f"Console log: {console_log}")
        print()
        print(f"To view logs: tail -f {console_log}")
        print()

    # Set up signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # Launch VM
    try:
        result = subprocess.run(vfkit_cmd)
        cleanup()
        return result.returncode
    except Exception as e:
        print(f"x Failed to launch VM: {e}")
        cleanup()
        return 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Launch Alpine VM with Node.js 24.10.0 (musl-optimized)"
    )
    parser.add_argument(
        "--cpus",
        type=int,
        default=int(os.environ.get("VFKIT_CPUS", DEFAULT_CPUS)),
        help=f"Number of CPUs (default: {DEFAULT_CPUS})",
    )
    parser.add_argument(
        "--memory",
        type=int,
        default=int(os.environ.get("VFKIT_MEMORY", DEFAULT_MEMORY)),
        help=f"Memory in MB (default: {DEFAULT_MEMORY})",
    )
    parser.add_argument(
        "--disk-size",
        type=str,
        default=os.environ.get("VFKIT_DISK_SIZE", DEFAULT_DISK_SIZE),
        help=f"Disk size (default: {DEFAULT_DISK_SIZE})",
    )
    parser.add_argument(
        "--vm-dir",
        type=Path,
        help="Directory for VM files (default: ~/.vfkit/vms/vibecode-alpine)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug kernel output",
    )
    args = parser.parse_args()

    return launch_vm(
        cpus=args.cpus,
        memory=args.memory,
        disk_size=args.disk_size,
        vm_dir=args.vm_dir,
        debug=args.debug,
    )


if __name__ == "__main__":
    sys.exit(main())
