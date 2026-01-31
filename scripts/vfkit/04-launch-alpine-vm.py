#!/usr/bin/env python3
"""Launch Alpine Linux ARM64 VM with vfkit.

Boots the VM with kernel, initramfs, and networking.
"""

from __future__ import annotations

import atexit
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn


def get_vm_paths() -> dict[str, Path]:
    """Get all VM-related paths."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    return {
        "vm_dir": vm_dir,
        "kernel_dir": vm_dir / "kernel",
        "rootfs_dir": vm_dir / "rootfs",
        "disk_dir": vm_dir / "disk",
        "log_dir": vm_dir / "logs",
        "kernel": vm_dir / "kernel" / "vmlinux",
        "kernel_compressed": vm_dir / "kernel" / "vmlinuz",
        "initramfs_kernel": vm_dir / "kernel" / "initramfs",
        "initramfs_custom": vm_dir / "rootfs" / "alpine-vibecode-rootfs.cpio.gz",
        "disk_image": vm_dir / "disk" / "root.img",
        "console_log": vm_dir / "logs" / "console.log",
        "vsock": vm_dir / "vsock.sock",
    }


def get_vm_config() -> dict[str, str | int]:
    """Get VM configuration from environment or defaults."""
    return {
        "name": "vibecode-alpine",
        "cpus": int(os.environ.get("VFKIT_CPUS", "4")),
        "memory": int(os.environ.get("VFKIT_MEMORY", "4096")),  # MB
        "disk_size": os.environ.get("VFKIT_DISK_SIZE", "20G"),
    }


def verify_vfkit() -> str:
    """Verify vfkit is installed and return its path."""
    vfkit_path = shutil.which("vfkit")
    if not vfkit_path:
        log_error("vfkit is not installed")
        print("Run: ./scripts/vfkit/01-setup-vfkit.sh")
        raise RuntimeError("vfkit not found")

    print(f"✅ vfkit found: {vfkit_path}")
    print()
    return vfkit_path


def verify_kernel(paths: dict[str, Path]) -> Path:
    """Verify kernel exists and return its path."""
    kernel = paths["kernel"]
    if not kernel.exists():
        log_error(f"Kernel not found: {kernel}")
        print("Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
        raise RuntimeError("Kernel not found")

    size = kernel.stat().st_size / (1024 * 1024)
    print(f"✅ Kernel: {kernel} ({size:.1f}MB)")
    return kernel


def get_initramfs(paths: dict[str, Path]) -> Path:
    """Determine which initramfs to use."""
    custom = paths["initramfs_custom"]
    kernel_initramfs = paths["initramfs_kernel"]

    if custom.exists():
        size = custom.stat().st_size / (1024 * 1024)
        print(f"✅ Using custom rootfs: {custom} ({size:.1f}MB)")
        return custom
    elif kernel_initramfs.exists():
        size = kernel_initramfs.stat().st_size / (1024 * 1024)
        log_warn(f"Using Alpine initramfs: {kernel_initramfs} ({size:.1f}MB)")
        print("   (Run 03-create-alpine-rootfs.sh for full VibeCode environment)")
        return kernel_initramfs
    else:
        log_error("No initramfs found")
        print("Run: ./scripts/vfkit/02-download-alpine-kernel.sh")
        raise RuntimeError("No initramfs found")


def create_disk_image(paths: dict[str, Path], config: dict[str, str | int]) -> Path:
    """Create disk image if it doesn't exist."""
    disk_dir = paths["disk_dir"]
    disk_image = paths["disk_image"]
    disk_size = str(config["disk_size"])

    disk_dir.mkdir(parents=True, exist_ok=True)

    if not disk_image.exists():
        print(f"📀 Creating disk image: {disk_size}")
        if shutil.which("qemu-img"):
            subprocess.run(
                ["qemu-img", "create", "-f", "raw", str(disk_image), disk_size],
                check=True,
            )
        else:
            # Create sparse file as fallback
            # Parse size string (e.g., "20G" -> bytes)
            size_map = {"K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4}
            if disk_size[-1].upper() in size_map:
                size_bytes = int(disk_size[:-1]) * size_map[disk_size[-1].upper()]
            else:
                size_bytes = int(disk_size)

            # Create sparse file
            with open(disk_image, "wb") as f:
                f.seek(size_bytes - 1)
                f.write(b"\0")

        print(f"✅ Disk image created: {disk_image}")
    else:
        size = disk_image.stat().st_size / (1024 * 1024 * 1024)
        print(f"✅ Using existing disk: {disk_image} ({size:.1f}GB)")

    return disk_image


def prepare_console_log(paths: dict[str, Path]) -> Path:
    """Prepare console log file."""
    log_dir = paths["log_dir"]
    console_log = paths["console_log"]

    log_dir.mkdir(parents=True, exist_ok=True)
    console_log.write_text("")  # Truncate

    print(f"📋 Console log: {console_log}")
    return console_log


def build_vfkit_command(
    vfkit_path: str,
    kernel: Path,
    initramfs: Path,
    disk_image: Path,
    console_log: Path,
    vsock: Path,
    config: dict[str, str | int],
) -> list[str]:
    """Build the vfkit command line."""
    cmdline = "console=hvc0 root=/dev/vda rw quiet"

    cmd = [
        vfkit_path,
        "--cpus", str(config["cpus"]),
        "--memory", str(config["memory"]),
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
        "--device", f"virtio-vsock,port=1024,socketURL=unix://{vsock}",
    ]

    return cmd


def print_config(config: dict[str, str | int], cmdline: str) -> None:
    """Print VM configuration."""
    log_section("VM Configuration")
    print(f"Name:     {config['name']}")
    print(f"CPUs:     {config['cpus']}")
    print(f"Memory:   {config['memory']} MB")
    print(f"Disk:     {config['disk_size']}")
    print()
    print(f"Kernel cmdline: {cmdline}")
    print()


def cleanup(console_log: Path) -> None:
    """Cleanup handler for VM shutdown."""
    print()
    print("-----------------------------------")
    print()
    print("VM stopped")
    print()
    print(f"Console log: {console_log}")
    print()
    print(f"To view logs: tail -f {console_log}")
    print()


def main() -> int:
    """Main entry point."""
    log_section("Launching VibeCode Alpine VM with vfkit")
    print()

    try:
        paths = get_vm_paths()
        config = get_vm_config()

        vfkit_path = verify_vfkit()
        kernel = verify_kernel(paths)
        initramfs = get_initramfs(paths)
        print()

        disk_image = create_disk_image(paths, config)
        print()

        console_log = prepare_console_log(paths)
        print()

        print_config(config, "console=hvc0 root=/dev/vda rw quiet")

        cmd = build_vfkit_command(
            vfkit_path,
            kernel,
            initramfs,
            disk_image,
            console_log,
            paths["vsock"],
            config,
        )

        log_section("Starting VM")
        print()
        print("Command:")
        print(" ".join(cmd))
        print()
        print("Press Ctrl+C to stop the VM")
        print()
        print("-----------------------------------")
        print()

        # Register cleanup handler
        atexit.register(cleanup, console_log)

        # Launch VM
        process = subprocess.run(cmd, check=False)
        return process.returncode

    except Exception as e:
        log_error(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
