#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Create ultra-minimal initramfs for ASIF test VM.

Size target: <5MB
Contains: busybox + minimal init script
"""

from __future__ import annotations

import gzip
import os
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Optional


# Constants
DEFAULT_TEST_DIR = Path("/tmp/asif-test")
BUSYBOX_URL = "https://dl-cdn.alpinelinux.org/alpine/v3.20/main/aarch64/busybox-1.36.1-r29.apk"

# Minimal init script
INIT_SCRIPT = """\
#!/bin/sh
# Minimal init script for test VM

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /run

# Print boot message
echo ""
echo "==================================="
echo "  ASIF Test VM - Boot Successful"
echo "==================================="
echo ""
echo "Kernel: $(uname -r)"
echo "System: $(uname -a)"
echo ""

# Test disk device
if [ -e /dev/vda ]; then
    echo "Disk device detected: /dev/vda"
    echo "   Size: $(blockdev --getsize64 /dev/vda 2>/dev/null || echo 'unknown')"
else
    echo "Disk device not found"
fi

echo ""
echo "VM boot complete. Running for 5 seconds..."
echo ""

# Keep running for test duration
sleep 5

echo "Shutting down..."
poweroff -f
"""


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def check_existing_initramfs(test_dir: Path) -> Optional[Path]:
    """Check if initramfs already exists.

    Returns:
        Path to initramfs if exists, None otherwise.
    """
    initramfs_path = test_dir / "initramfs"
    if initramfs_path.exists():
        return initramfs_path
    return None


def create_directory_structure(build_dir: Path) -> None:
    """Create the initramfs directory structure."""
    dirs = ["bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "run"]
    for d in dirs:
        (build_dir / d).mkdir(parents=True, exist_ok=True)


def create_init_script(build_dir: Path) -> None:
    """Create the init script."""
    init_path = build_dir / "init"
    init_path.write_text(INIT_SCRIPT)
    init_path.chmod(init_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def download_and_extract_busybox(build_dir: Path) -> bool:
    """Download busybox APK and extract binary.

    Returns:
        True if successful, False otherwise.
    """
    if not shutil.which("curl"):
        return False

    try:
        # Download APK
        apk_path = build_dir / "busybox.apk"
        result = subprocess.run(
            ["curl", "-sL", BUSYBOX_URL, "-o", str(apk_path)],
            timeout=60,
        )
        if result.returncode != 0:
            return False

        print("Downloaded busybox.apk")

        # Extract APK (it's a tar.gz)
        with tarfile.open(apk_path, "r:gz") as tar:
            tar.extractall(build_dir)

        # Find and move busybox binary
        busybox_bin = None
        for path in [build_dir / "bin" / "busybox", build_dir / "sbin" / "busybox"]:
            if path.exists():
                busybox_bin = path
                break

        if busybox_bin:
            dest = build_dir / "busybox-bin"
            shutil.copy(busybox_bin, dest)
            dest.chmod(dest.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            print("Extracted busybox")

            # Cleanup extracted files
            apk_path.unlink(missing_ok=True)
            for subdir in ["bin", "sbin", "usr", "lib", "etc"]:
                shutil.rmtree(build_dir / subdir, ignore_errors=True)
            (build_dir / "bin").mkdir(exist_ok=True)

            return True

        return False

    except (subprocess.TimeoutExpired, subprocess.SubprocessError, tarfile.TarError):
        return False


def install_busybox(build_dir: Path) -> bool:
    """Install busybox and create symlinks.

    Returns:
        True if successful, False otherwise.
    """
    busybox_bin = build_dir / "busybox-bin"
    if not busybox_bin.exists():
        return False

    bin_dir = build_dir / "bin"
    bin_dir.mkdir(exist_ok=True)

    # Move busybox to bin
    dest_busybox = bin_dir / "busybox"
    shutil.move(busybox_bin, dest_busybox)

    # Create symlinks for essential commands
    commands = ["sh", "mount", "umount", "poweroff", "reboot", "sleep", "echo", "cat", "ls"]
    for cmd in commands:
        link = bin_dir / cmd
        if link.exists() or link.is_symlink():
            link.unlink()
        link.symlink_to("busybox")

    print("Installed busybox with symlinks")
    return True


def create_stub_scripts(build_dir: Path) -> None:
    """Create minimal shell stubs when busybox is not available."""
    print("Could not download busybox")
    print("   Creating minimal shell-only initramfs")

    bin_dir = build_dir / "bin"
    bin_dir.mkdir(exist_ok=True)

    stubs = {
        "sh": "#!/bin/sh\necho \"Minimal shell stub\"\n",
        "mount": "#!/bin/sh\n# Stub mount command\n",
        "poweroff": "#!/bin/sh\n# Stub poweroff\n",
    }

    for name, content in stubs.items():
        stub = bin_dir / name
        stub.write_text(content)
        stub.chmod(stub.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def create_device_nodes(build_dir: Path) -> None:
    """Create device nodes if running as root."""
    dev_dir = build_dir / "dev"
    dev_dir.mkdir(exist_ok=True)

    if os.geteuid() == 0:
        try:
            os.mknod(dev_dir / "console", stat.S_IFCHR | 0o600, os.makedev(5, 1))
            os.mknod(dev_dir / "null", stat.S_IFCHR | 0o666, os.makedev(1, 3))
            os.mknod(dev_dir / "zero", stat.S_IFCHR | 0o666, os.makedev(1, 5))
            print("Created device nodes")
        except OSError:
            print("Skipping device nodes (will use devtmpfs)")
    else:
        print("Skipping device nodes (will use devtmpfs)")


def create_cpio_archive(build_dir: Path, output_path: Path) -> bool:
    """Create gzip-compressed cpio archive.

    Returns:
        True if successful, False otherwise.
    """
    try:
        # Use cpio to create archive
        find_proc = subprocess.Popen(
            ["find", "."],
            cwd=build_dir,
            stdout=subprocess.PIPE,
        )
        cpio_proc = subprocess.Popen(
            ["cpio", "-o", "-H", "newc"],
            cwd=build_dir,
            stdin=find_proc.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        # Compress with gzip
        cpio_data, _ = cpio_proc.communicate()
        compressed = gzip.compress(cpio_data, compresslevel=9)

        output_path.write_bytes(compressed)
        return True

    except (subprocess.SubprocessError, OSError):
        return False


def create_minimal_initramfs(test_dir: Path = DEFAULT_TEST_DIR) -> int:
    """Create ultra-minimal initramfs.

    Args:
        test_dir: Directory to store initramfs

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    print("=== Creating Minimal Initramfs ===")
    print()
    print(f"Target: {test_dir}/initramfs")
    print()

    test_dir.mkdir(parents=True, exist_ok=True)

    # Check if initramfs already exists
    existing = check_existing_initramfs(test_dir)
    if existing:
        size = get_file_size_human(existing)
        print(f"Initramfs already exists: {existing} ({size})")
        print()
        return 0

    print("Building initramfs structure...")

    # Create build directory
    build_dir = test_dir / "initramfs-build"
    build_dir.mkdir(parents=True, exist_ok=True)

    # Create directory structure
    create_directory_structure(build_dir)

    # Create init script
    create_init_script(build_dir)

    # Try to get busybox
    print()
    print("Getting busybox...")

    if download_and_extract_busybox(build_dir):
        install_busybox(build_dir)
    else:
        create_stub_scripts(build_dir)

    # Create device nodes
    create_device_nodes(build_dir)

    # Create the initramfs archive
    print()
    print("Creating initramfs archive...")

    output_path = test_dir / "initramfs"
    if not create_cpio_archive(build_dir, output_path):
        print("Error: Failed to create initramfs archive")
        shutil.rmtree(build_dir, ignore_errors=True)
        return 1

    # Cleanup build directory
    shutil.rmtree(build_dir, ignore_errors=True)

    size = get_file_size_human(output_path)
    print()
    print("=== Initramfs Complete ===")
    print()
    print(f"Initramfs: {output_path} ({size})")
    print()
    print("Next steps:")
    print("  1. ./scripts/vz/create-asif-disk.sh")
    print("  2. ./scripts/vz/asif-test-vm.swift")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    return create_minimal_initramfs()


if __name__ == "__main__":
    sys.exit(main())