#!/usr/bin/env python3
"""Create ultra-minimal initramfs for ASIF test VM.

Size target: <5MB
Contains: busybox + minimal init script
"""
from __future__ import annotations

import argparse
import gzip
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TEST_DIR = Path("/tmp/asif-test")

BUSYBOX_URL = "https://dl-cdn.alpinelinux.org/alpine/v3.20/main/aarch64/busybox-1.36.1-r29.apk"

BUSYBOX_SYMLINKS = ["sh", "mount", "umount", "poweroff", "reboot", "sleep", "echo", "cat", "ls"]

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


def run_cmd(cmd: list[str], check: bool = True, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check, cwd=cwd)


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "K", "M", "G"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}T"


def download_busybox(dest_dir: Path) -> Path | None:
    """Download and extract busybox from Alpine APK."""
    print()
    print("Getting busybox...")

    if not shutil.which("curl"):
        print("  curl not available, skipping busybox download")
        return None

    apk_path = dest_dir / "busybox.apk"

    # Download APK
    result = run_cmd(["curl", "-sL", BUSYBOX_URL, "-o", str(apk_path)], check=False)
    if result.returncode != 0:
        print("  Failed to download busybox.apk")
        return None

    print("  Downloaded busybox.apk")

    # Extract APK (it's just a tar.gz)
    if not shutil.which("tar"):
        print("  tar not available, cannot extract APK")
        apk_path.unlink(missing_ok=True)
        return None

    result = run_cmd(["tar", "-xzf", str(apk_path)], check=False, cwd=dest_dir)

    # Find busybox binary
    busybox_bin = None
    for candidate in [dest_dir / "bin" / "busybox", dest_dir / "sbin" / "busybox"]:
        if candidate.exists():
            busybox_bin = candidate
            break

    if busybox_bin:
        # Move to a temp location
        final_path = dest_dir / "busybox-bin"
        shutil.copy2(busybox_bin, final_path)
        final_path.chmod(0o755)
        print("  Extracted busybox")
    else:
        print("  Could not find busybox in APK")

    # Cleanup extracted files
    apk_path.unlink(missing_ok=True)
    for subdir in ["bin", "sbin", "usr", "lib", "etc"]:
        subdir_path = dest_dir / subdir
        if subdir_path.exists() and subdir_path.is_dir():
            shutil.rmtree(subdir_path, ignore_errors=True)

    return dest_dir / "busybox-bin" if busybox_bin else None


def create_stub_commands(bin_dir: Path) -> None:
    """Create minimal shell stubs when busybox is unavailable."""
    print("  Could not download busybox")
    print("  Creating minimal shell-only initramfs")

    stubs = {
        "sh": '#!/bin/sh\necho "Minimal shell stub"\n',
        "mount": "#!/bin/sh\n# Stub mount command\n",
        "poweroff": "#!/bin/sh\n# Stub poweroff\n",
    }

    for name, content in stubs.items():
        stub_path = bin_dir / name
        stub_path.write_text(content)
        stub_path.chmod(0o755)


def create_device_nodes(dev_dir: Path) -> None:
    """Create device nodes if running as root."""
    if os.getuid() != 0:
        print("  Skipping device nodes (will use devtmpfs)")
        return

    if not shutil.which("mknod"):
        print("  mknod not available, skipping device nodes")
        return

    devices = [
        ("console", "c", 5, 1),
        ("null", "c", 1, 3),
        ("zero", "c", 1, 5),
    ]

    for name, dtype, major, minor in devices:
        dev_path = dev_dir / name
        result = run_cmd(["mknod", str(dev_path), dtype, str(major), str(minor)], check=False)
        if result.returncode != 0:
            print(f"  Failed to create {name}")
            return

    print("  Created device nodes")


def create_cpio_archive(source_dir: Path, output_path: Path) -> bool:
    """Create a gzipped cpio archive."""
    print()
    print("Creating initramfs archive...")

    if not shutil.which("cpio"):
        print("  cpio not available")
        return False

    # Get list of all files
    result = run_cmd(["find", "."], cwd=source_dir)
    if result.returncode != 0:
        print("  Failed to list files")
        return False

    # Create cpio archive
    find_proc = subprocess.Popen(
        ["find", "."],
        cwd=source_dir,
        stdout=subprocess.PIPE,
    )

    cpio_proc = subprocess.Popen(
        ["cpio", "-o", "-H", "newc"],
        cwd=source_dir,
        stdin=find_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )

    find_proc.stdout.close()
    cpio_output, _ = cpio_proc.communicate()

    if cpio_proc.returncode != 0:
        print("  cpio failed")
        return False

    # Compress with gzip
    with gzip.open(output_path, "wb", compresslevel=9) as f:
        f.write(cpio_output)

    return True


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=DEFAULT_TEST_DIR,
        help=f"Output directory (default: {DEFAULT_TEST_DIR})",
    )
    parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="Overwrite existing initramfs",
    )

    args = parser.parse_args(argv)

    test_dir = args.output_dir
    initramfs_path = test_dir / "initramfs"

    print("=== Creating Minimal Initramfs ===")
    print()
    print(f"Target: {initramfs_path}")
    print()

    # Check if initramfs already exists
    if initramfs_path.exists() and not args.force:
        size = get_file_size_human(initramfs_path)
        print(f"Initramfs already exists: {initramfs_path} ({size})")
        print()
        return 0

    print("Building initramfs structure...")

    # Create temporary build directory
    build_dir = test_dir / "initramfs-build"
    build_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Create directory structure
        for subdir in ["bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "run"]:
            (build_dir / subdir).mkdir(exist_ok=True)

        # Create init script
        init_path = build_dir / "init"
        init_path.write_text(INIT_SCRIPT)
        init_path.chmod(0o755)

        # Get busybox
        bin_dir = build_dir / "bin"
        busybox_path = download_busybox(build_dir)

        if busybox_path and busybox_path.exists():
            # Install busybox and create symlinks
            final_busybox = bin_dir / "busybox"
            shutil.move(str(busybox_path), str(final_busybox))
            final_busybox.chmod(0o755)

            # Create symlinks
            for cmd in BUSYBOX_SYMLINKS:
                link_path = bin_dir / cmd
                if link_path.exists():
                    link_path.unlink()
                link_path.symlink_to("busybox")

            print("  Installed busybox with symlinks")
        else:
            create_stub_commands(bin_dir)

        # Create device nodes
        create_device_nodes(build_dir / "dev")

        # Create the initramfs archive
        test_dir.mkdir(parents=True, exist_ok=True)
        if not create_cpio_archive(build_dir, initramfs_path):
            print("Failed to create initramfs archive")
            return 1

        # Check size
        size = get_file_size_human(initramfs_path)

        print()
        print("=== Initramfs Complete ===")
        print()
        print(f"Initramfs: {initramfs_path} ({size})")
        print()

    finally:
        # Cleanup build directory
        if build_dir.exists():
            shutil.rmtree(build_dir, ignore_errors=True)

    print("Next steps:")
    print("  1. ./scripts/vz/create-asif-disk.sh")
    print("  2. ./scripts/vz/asif-test-vm.swift")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
