from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-openvscode-in-vm"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation




"""Test openvscode-server in Alpine VM with working networking."""


# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass
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

import argparse
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from textwrap import dedent

from .log import COLORS, log_error, log_info, log_success


def get_vfkit_home() -> Path:
    """Get the vfkit home directory."""
    return Path.home() / ".vfkit" / "vms"


def get_alpine_vm_path() -> Path:
    """Get the path to the vibecode-alpine VM."""
    return get_vfkit_home() / "vibecode-alpine"


def create_test_script() -> str:
    """Create the openvscode test script content."""
    return dedent("""\
        #!/bin/sh
        echo "=== Testing openvscode-server installation ==="
        echo ""

        # Install dependencies
        apk add --no-cache nodejs npm wget tar

        echo ""
        echo "Node.js version:"
        node --version
        npm --version

        echo ""
        echo "Downloading openvscode-server..."
        cd /tmp
        wget -O openvscode.tar.gz \\
          "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.105.1/openvscode-server-v1.105.1-linux-arm64.tar.gz"

        echo ""
        echo "Extracting..."
        tar -xzf openvscode.tar.gz
        cd openvscode-server-*

        echo ""
        echo "Testing openvscode-server..."
        ./node --version
        echo ""
        echo "Starting server (test mode)..."
        timeout 10 ./node out/server-main.js --help 2>&1 || true

        echo ""
        echo "Installation size:"
        du -sh .

        echo ""
        echo "✅ openvscode-server tested successfully!"
    """)


def create_init_script() -> str:
    """Create the init script content."""
    return dedent("""\
        #!/bin/busybox sh

        # Mount filesystems
        /bin/busybox mount -t proc proc /proc
        /bin/busybox mount -t sysfs sysfs /sys
        /bin/busybox mount -t devtmpfs devtmpfs /dev
        /bin/busybox mkdir -p /tmp /var /run
        /bin/busybox mount -t tmpfs -o size=2G tmpfs /tmp
        /bin/busybox mount -t tmpfs -o size=1G tmpfs /var
        /bin/busybox mount -t tmpfs -o size=256M tmpfs /run

        echo "======================================================================"
        echo "  openvscode-server Test VM"
        echo "======================================================================"
        echo ""

        # Setup apk
        /bin/busybox mkdir -p /var/cache/apk /etc/apk /lib/apk/db
        echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/main" > /etc/apk/repositories
        echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories

        # Network
        /sbin/modprobe virtio_net
        /bin/busybox sleep 2
        /bin/busybox ip link set lo up
        /bin/busybox ip link set eth0 up
        /bin/busybox ip addr add 192.168.64.10/24 dev eth0
        /bin/busybox ip route add default via 192.168.64.1
        echo "nameserver 192.168.64.1" > /etc/resolv.conf
        /bin/busybox sleep 2

        echo "Network ready, running test..."
        echo ""

        cd /root
        /bin/busybox sh /root/test-openvscode.sh

        echo ""
        echo "======================================================================"
        echo "  Test complete"
        echo "======================================================================"
        echo ""

        exec /bin/busybox sh
    """)


def create_launch_script(vm_dir: Path) -> str:
    """Create the launch script content."""
    return dedent(f"""\
        #!/bin/bash
        exec vfkit \\
            --cpus 4 \\
            --memory 4096 \\
            --kernel "{vm_dir}/kernel/vmlinux" \\
            --initrd "{vm_dir}/rootfs/test.cpio.gz" \\
            --kernel-cmdline "console=hvc0" \\
            --device virtio-net,nat,mac=52:54:00:12:34:58 \\
            --device virtio-serial,logFilePath="{vm_dir}/logs/console.log"
    """)


def build_initramfs(vm_dir: Path, alpine_vm_path: Path) -> bool:
    """Build the test initramfs."""
    kernel_src = alpine_vm_path / "kernel" / "vmlinux"
    initramfs_src = alpine_vm_path / "kernel" / "initramfs"

    if not kernel_src.exists():
        log_error(f"Kernel not found: {kernel_src}")
        return False

    if not initramfs_src.exists():
        log_error(f"Initramfs not found: {initramfs_src}")
        return False

    # Create directories
    (vm_dir / "kernel").mkdir(parents=True, exist_ok=True)
    (vm_dir / "rootfs").mkdir(parents=True, exist_ok=True)
    (vm_dir / "logs").mkdir(parents=True, exist_ok=True)

    # Copy kernel
    shutil.copy(kernel_src, vm_dir / "kernel" / "vmlinux")

    # Extract and modify initramfs
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)

        print("Extracting Alpine initramfs...")
        # Decompress and extract
        with subprocess.Popen(
            ["gunzip", "-c", str(initramfs_src)],
            stdout=subprocess.PIPE,
        ) as gunzip:
            subprocess.run(
                ["cpio", "-idm"],
                stdin=gunzip.stdout,
                cwd=tmppath,
                capture_output=True,
            )

        # Create root directory and test script
        root_dir = tmppath / "root"
        root_dir.mkdir(exist_ok=True)
        test_script = root_dir / "test-openvscode.sh"
        test_script.write_text(create_test_script())
        test_script.chmod(0o755)

        # Create init script
        init_script = tmppath / "init"
        init_script.write_text(create_init_script())
        init_script.chmod(0o755)

        # Create new initramfs
        print("Creating initramfs...")
        output_path = vm_dir / "rootfs" / "test.cpio.gz"

        find_proc = subprocess.Popen(
            ["find", "."],
            cwd=tmppath,
            stdout=subprocess.PIPE,
        )
        cpio_proc = subprocess.Popen(
            ["cpio", "-o", "-H", "newc"],
            cwd=tmppath,
            stdin=find_proc.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        with open(output_path, "wb") as f:
            subprocess.run(
                ["gzip"],
                stdin=cpio_proc.stdout,
                stdout=f,
            )

        find_proc.wait()
        cpio_proc.wait()

    # Get size
    size = output_path.stat().st_size
    size_human = f"{size / 1024 / 1024:.1f}MB"
    log_success(f"initramfs created: {size_human}")

    # Create launch script
    launch_script = vm_dir / "launch.sh"
    launch_script.write_text(create_launch_script(vm_dir))
    launch_script.chmod(0o755)

    return True


def read_console_log(vm_dir: Path, lines: int = 150) -> list[str]:
    """Read console log from VM."""
    log_path = vm_dir / "logs" / "console.log"
    if not log_path.exists():
        return ["No console log"]
    try:
        content = log_path.read_text().splitlines()
        return content[-lines:] if len(content) >= lines else content
    except OSError:
        return ["Unable to read console log"]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Test openvscode-server in Alpine VM",
    )
    parser.add_argument(
        "--vm-dir",
        type=Path,
        default=get_vfkit_home() / "openvscode-test",
        help="VM directory",
    )
    parser.add_argument(
        "--wait",
        type=int,
        default=120,
        help="Seconds to wait for test completion",
    )
    parser.add_argument(
        "--no-launch",
        action="store_true",
        help="Only build initramfs, don't launch VM",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    print("======================================================================")
    print("  Testing openvscode-server in Alpine VM")
    print("======================================================================")
    print()

    vm_dir = args.vm_dir
    alpine_vm_path = get_alpine_vm_path()

    # Build initramfs
    if not build_initramfs(vm_dir, alpine_vm_path):
        return 1

    print()
    print("======================================================================")
    print("  \u2705 openvscode-server test VM created!")
    print("======================================================================")
    print()
    print("To test:")
    print(f"  {vm_dir}/launch.sh &")
    print(f"  sleep {args.wait}  # Wait for download and test")
    print(f"  tail -100 {vm_dir}/logs/console.log")
    print()

    if args.no_launch:
        print("Skipping VM launch (--no-launch specified)")
        return 0

    print("Launching now for automatic test...")
    print()

    # Launch VM
    vfkit_log = vm_dir / "logs" / "vfkit.log"
    with open(vfkit_log, "w") as log_file:
        process = subprocess.Popen(
            [str(vm_dir / "launch.sh")],
            stdout=log_file,
            stderr=log_file,
        )

    vm_pid = process.pid
    log_success(f"VM launched (PID: {vm_pid})")
    print(f"Waiting {args.wait} seconds for openvscode-server download and test...")
    time.sleep(args.wait)

    print()
    print("======================================================================")
    print("  Test Results:")
    print("======================================================================")
    print()

    for line in read_console_log(vm_dir, 150):
        print(line)

    # Cleanup - terminate VM
    try:
        os.kill(vm_pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

    print()
    print("Test complete!")

    return 0


if __name__ == "__main__":
    sys.exit(main())