#!/usr/bin/env python3
"""Build minimal BusyBox initramfs for Apple VF fast boot experiments.

Target: Sub-2MB initramfs with /healthz endpoint.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import stat
import subprocess
import sys
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        file_size_human,
        log,
        run_cmd,
        success,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        file_size_human,
        log,
        run_cmd,
        success,
    )


INIT_SCRIPT = '''#!/bin/sh
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
# BusyBox httpd serves /www on port 80
httpd -p 3000 -h /www &

# Signal boot complete
echo "Boot complete - /healthz ready on port 3000"

# Keep init running
exec /bin/sh
'''


def create_rootfs(rootfs_dir: Path) -> None:
    """Create the rootfs directory structure."""
    log("Creating minimal rootfs...")

    # Create directory structure
    dirs = [
        "bin", "sbin", "etc", "proc", "sys", "dev",
        "tmp", "var/run", "www",
    ]
    for d in dirs:
        (rootfs_dir / d).mkdir(parents=True, exist_ok=True)


def copy_busybox(rootfs_dir: Path, busybox_src: Path) -> None:
    """Copy BusyBox binary and create symlinks."""
    busybox_dst = rootfs_dir / "bin" / "busybox"

    log(f"Copying BusyBox from {busybox_src}...")
    run_cmd(["cp", str(busybox_src), str(busybox_dst)])
    busybox_dst.chmod(0o755)

    # Create essential symlinks
    essential_cmds = [
        "sh", "ash", "init", "mount", "umount", "mkdir", "cat", "echo",
        "ls", "ps", "kill", "sleep", "ip", "ifconfig", "route", "ping",
        "wget", "httpd", "nc",
    ]

    for cmd in essential_cmds:
        link_path = rootfs_dir / "bin" / cmd
        if not link_path.exists():
            link_path.symlink_to("busybox")

    # Sbin symlinks
    sbin_cmds = ["init", "halt", "reboot", "poweroff"]
    for cmd in sbin_cmds:
        link_path = rootfs_dir / "sbin" / cmd
        if not link_path.exists():
            link_path.symlink_to("../bin/busybox")


def create_init_script(rootfs_dir: Path) -> None:
    """Create the /init script."""
    init_path = rootfs_dir / "init"
    init_path.write_text(INIT_SCRIPT)
    init_path.chmod(0o755)


def create_etc_files(rootfs_dir: Path) -> None:
    """Create minimal /etc files."""
    (rootfs_dir / "etc" / "passwd").write_text("root:x:0:0:root:/:/bin/sh\n")
    (rootfs_dir / "etc" / "group").write_text("root:x:0:\n")
    (rootfs_dir / "etc" / "hostname").write_text("localhost\n")


def create_initramfs(rootfs_dir: Path, output_path: Path) -> None:
    """Create the initramfs archive."""
    log("Creating initramfs archive...")

    # Use cpio to create archive
    find_proc = subprocess.Popen(
        ["find", "."],
        cwd=rootfs_dir,
        stdout=subprocess.PIPE,
    )
    cpio_proc = subprocess.Popen(
        ["cpio", "-o", "-H", "newc"],
        cwd=rootfs_dir,
        stdin=find_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    gzip_proc = subprocess.Popen(
        ["gzip", "-9"],
        stdin=cpio_proc.stdout,
        stdout=subprocess.PIPE,
    )

    output, _ = gzip_proc.communicate()
    output_path.write_bytes(output)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "arch",
        nargs="?",
        default="arm64",
        choices=["x86_64", "arm64", "armv7"],
        help="Target architecture (default: arm64)",
    )
    parser.add_argument(
        "--busybox-version",
        default=os.environ.get("BUSYBOX_VERSION", "1.36.1"),
        help="BusyBox version",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "bench-images" / "apple-vf-fastboot",
        help="Output directory",
    )

    args = parser.parse_args(argv)

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find BusyBox binary
    busybox_src = REPO_ROOT / "bench-images" / "busybox" / f"busybox-{args.busybox_version}" / "busybox"

    if not busybox_src.exists():
        log(f"BusyBox not found at {busybox_src}")
        log("Building BusyBox...")
        try:
            from .build_busybox_musl import main as build_busybox
        except ImportError:
            from build_busybox_musl import main as build_busybox

        result = build_busybox([args.arch])
        if result != 0:
            return result

    if not busybox_src.exists():
        # Try alternative location
        busybox_src = REPO_ROOT / "bench-images" / "busybox" / "rootfs" / "bin" / "busybox"

    if not busybox_src.exists():
        print(f"error: BusyBox binary not found", file=sys.stderr)
        return 1

    print(f"=== Building Minimal Initramfs for Apple VF Fast Boot ===")
    print(f"Architecture: {args.arch}")
    print(f"Output: {output_dir}")
    print()

    try:
        rootfs_dir = output_dir / "rootfs"

        # Clean and create rootfs
        if rootfs_dir.exists():
            run_cmd(["rm", "-rf", str(rootfs_dir)])

        create_rootfs(rootfs_dir)
        copy_busybox(rootfs_dir, busybox_src)
        create_init_script(rootfs_dir)
        create_etc_files(rootfs_dir)

        # Create initramfs
        initramfs_path = output_dir / "initramfs-minimal.cpio.gz"
        create_initramfs(rootfs_dir, initramfs_path)

        # Report sizes
        rootfs_size = sum(f.stat().st_size for f in rootfs_dir.rglob("*") if f.is_file())
        initramfs_size = initramfs_path.stat().st_size

        print()
        print("=== Build Complete ===")
        print(f"Rootfs size: {file_size_human(rootfs_size)}")
        print(f"Initramfs size: {file_size_human(initramfs_size)}")
        print(f"Output: {initramfs_path}")
        print()
        print("To test:")
        print(f"  MICROVM_INITRD={initramfs_path} \\")
        print("  scripts/benchmarks/vscode_microvm.sh measure")

        return 0

    except BenchmarkError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
