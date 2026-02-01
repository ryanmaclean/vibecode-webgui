#!/usr/bin/env python3
"""
Build minimal BusyBox initramfs for Apple VF fast boot experiments.

Target: Sub-2MB initramfs with /healthz endpoint.
"""

import argparse
import gzip
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path
from typing import Optional


# Default BusyBox version
DEFAULT_BUSYBOX_VERSION = "1.36.1"

# Essential BusyBox commands to symlink
BIN_COMMANDS = [
    "sh", "ash", "init", "mount", "umount", "mkdir", "cat", "echo",
    "ls", "ps", "kill", "sleep", "ip", "ifconfig", "route", "ping",
    "wget", "httpd", "nc",
]

SBIN_COMMANDS = ["init", "halt", "reboot", "poweroff"]

# Minimal init script for fast boot
INIT_SCRIPT = """\
#!/bin/sh
# Minimal init for Apple VF fast boot benchmark
# Target: Boot to /healthz in < 3s

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /var/run

# Configure network (static IP for deterministic boot)
ip link set lo up
ip link set eth0 up 2>/dev/null || true

# Try DHCP first, fall back to static
if ! ip addr show eth0 | grep -q "inet "; then
  # Use static IP for Apple VF NAT (10.0.2.x range)
  ip addr add 10.0.2.15/24 dev eth0
  ip route add default via 10.0.2.2
fi

# Create /healthz response file
mkdir -p /www
echo "ok" > /www/healthz
cat > /www/index.html << 'HTML'
<!DOCTYPE html>
<html><head><title>Apple VF Fast Boot</title></head>
<body><h1>VM Ready</h1><p>Boot complete.</p></body>
</html>
HTML

# Start HTTP server for /healthz endpoint
# BusyBox httpd serves /www on port 3000
httpd -p 3000 -h /www &

# Signal boot complete
echo "Boot complete - /healthz ready on port 3000"

# Keep init running
exec /bin/sh
"""


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ['B', 'K', 'M', 'G']:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}T"


def get_dir_size_human(path: Path) -> str:
    """Get human-readable directory size."""
    total = 0
    for entry in path.rglob('*'):
        if entry.is_file():
            total += entry.stat().st_size
    for unit in ['B', 'K', 'M', 'G']:
        if total < 1024:
            return f"{total:.1f}{unit}"
        total /= 1024
    return f"{total:.1f}T"


def build_busybox_if_needed(
    root_dir: Path,
    arch: str,
    busybox_version: str,
) -> Path:
    """Build BusyBox if not already available."""
    busybox_src = root_dir / "bench-images" / "busybox" / f"busybox-{busybox_version}"
    busybox_bin = busybox_src / "busybox"

    if busybox_bin.exists():
        return busybox_bin

    print("Building BusyBox...")
    build_script = root_dir / "scripts" / "benchmarks" / "build-busybox-musl.sh"

    if not build_script.exists():
        print(f"Error: Build script not found: {build_script}")
        sys.exit(1)

    subprocess.run([str(build_script), arch], check=True)

    if not busybox_bin.exists():
        print(f"Error: BusyBox binary not found after build: {busybox_bin}")
        sys.exit(1)

    return busybox_bin


def create_rootfs(rootfs_dir: Path, busybox_bin: Path) -> None:
    """Create the minimal rootfs structure."""
    print("Creating minimal rootfs...")

    # Remove existing rootfs
    if rootfs_dir.exists():
        shutil.rmtree(rootfs_dir)

    # Create directory structure
    dirs = ["bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "var/run"]
    for d in dirs:
        (rootfs_dir / d).mkdir(parents=True, exist_ok=True)

    # Copy BusyBox
    dest_busybox = rootfs_dir / "bin" / "busybox"
    shutil.copy2(busybox_bin, dest_busybox)
    dest_busybox.chmod(0o755)

    # Create essential symlinks in /bin
    for cmd in BIN_COMMANDS:
        link_path = rootfs_dir / "bin" / cmd
        if not link_path.exists():
            link_path.symlink_to("busybox")

    # Create essential symlinks in /sbin
    for cmd in SBIN_COMMANDS:
        link_path = rootfs_dir / "sbin" / cmd
        if not link_path.exists():
            link_path.symlink_to("../bin/busybox")

    # Create /init script
    init_path = rootfs_dir / "init"
    init_path.write_text(INIT_SCRIPT)
    init_path.chmod(0o755)

    # Create minimal /etc files
    (rootfs_dir / "etc" / "passwd").write_text("root:x:0:0:root:/:/bin/sh\n")
    (rootfs_dir / "etc" / "group").write_text("root:x:0:\n")
    (rootfs_dir / "etc" / "hostname").write_text("localhost\n")


def create_initramfs(rootfs_dir: Path, output_path: Path) -> None:
    """Create the initramfs cpio.gz archive."""
    print()
    print("Creating initramfs...")

    # Use cpio to create the archive
    cpio_proc = subprocess.Popen(
        ["cpio", "-o", "-H", "newc"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        cwd=rootfs_dir,
    )

    # Get list of all files
    find_proc = subprocess.Popen(
        ["find", "."],
        stdout=subprocess.PIPE,
        cwd=rootfs_dir,
    )

    cpio_data, _ = cpio_proc.communicate(input=find_proc.stdout.read())
    find_proc.wait()

    if cpio_proc.returncode != 0:
        print("Error: cpio failed")
        sys.exit(1)

    # Compress with gzip
    with gzip.open(output_path, 'wb', compresslevel=9) as f:
        f.write(cpio_data)


def build_minimal_initramfs(
    arch: str = "arm64",
    output_dir: Optional[Path] = None,
    root_dir: Optional[Path] = None,
    busybox_version: str = DEFAULT_BUSYBOX_VERSION,
) -> int:
    """
    Build minimal BusyBox initramfs for Apple VF fast boot.

    Args:
        arch: Target architecture (arm64 or x86_64)
        output_dir: Output directory for initramfs
        root_dir: Project root directory
        busybox_version: BusyBox version to use

    Returns:
        0 on success, 1 on failure
    """
    print("=== Building Minimal Initramfs for Apple VF Fast Boot ===")
    print(f"Architecture: {arch}")

    # Determine directories
    if root_dir is None:
        root_dir = Path(__file__).parent.parent.parent.resolve()

    if output_dir is None:
        output_dir = root_dir / "bench-images" / "apple-vf-fastboot"

    print(f"Output: {output_dir}")
    print()

    output_dir.mkdir(parents=True, exist_ok=True)

    # Build BusyBox if needed
    busybox_bin = build_busybox_if_needed(root_dir, arch, busybox_version)

    # Create rootfs
    rootfs_dir = output_dir / "rootfs"
    create_rootfs(rootfs_dir, busybox_bin)

    # Create initramfs
    initramfs_path = output_dir / "initramfs-minimal.cpio.gz"
    create_initramfs(rootfs_dir, initramfs_path)

    # Calculate and display sizes
    rootfs_size = get_dir_size_human(rootfs_dir)
    initramfs_size = get_file_size_human(initramfs_path)

    print()
    print("=== Build Complete ===")
    print(f"Rootfs size: {rootfs_size}")
    print(f"Initramfs size: {initramfs_size}")
    print(f"Output: {initramfs_path}")
    print()
    print("To test:")
    print(f"  MICROVM_INITRD={initramfs_path} \\")
    print("  scripts/benchmarks/vscode_microvm.sh measure")

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Build minimal BusyBox initramfs for Apple VF fast boot experiments"
    )
    parser.add_argument(
        "arch",
        nargs="?",
        default="arm64",
        choices=["arm64", "x86_64"],
        help="Target architecture (default: arm64)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory for initramfs",
    )
    parser.add_argument(
        "--root-dir",
        type=Path,
        help="Project root directory",
    )
    parser.add_argument(
        "--busybox-version",
        type=str,
        default=os.environ.get("BUSYBOX_VERSION", DEFAULT_BUSYBOX_VERSION),
        help=f"BusyBox version (default: {DEFAULT_BUSYBOX_VERSION})",
    )
    args = parser.parse_args()

    return build_minimal_initramfs(
        arch=args.arch,
        output_dir=args.output_dir,
        root_dir=args.root_dir,
        busybox_version=args.busybox_version,
    )


if __name__ == "__main__":
    sys.exit(main())
