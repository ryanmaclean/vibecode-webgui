#!/usr/bin/env python3
"""Create super-simple Alpine VM with fun weather demo.

One-liner ready: curl -fsSL https://... | python3
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

# Configuration
ALPINE_VERSION = "3.22"
ALPINE_RELEASE = "3.22.2"
ALPINE_ARCH = "aarch64"


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    blue: str = "\033[0;34m"
    yellow: str = "\033[1;33m"
    reset: str = "\033[0m"


COLORS = Colors()

WEATHER_SCRIPT = """\
#!/bin/sh
# Fun weather script using wttr.in

LOC="${1:-}"
echo ""
echo "Weather Report"
echo "---------------------------------------------------"
echo ""

if [ -z "$LOC" ]; then
    # Auto-detect
    wget -qO- "wttr.in/?format=v2" 2>/dev/null || echo "Can't fetch weather (no network?)"
else
    wget -qO- "wttr.in/${LOC}?format=v2" 2>/dev/null || echo "Can't fetch weather for $LOC"
fi

echo ""
echo "---------------------------------------------------"
echo ""
echo "Usage: weather [location]"
echo ""
echo "Examples:"
echo "  weather              # Auto-detect location"
echo "  weather Tokyo        # Weather in Tokyo"
echo "  weather London       # Weather in London"
echo "  weather Moon         # Try this!"
echo "  weather Everest      # Weather on Everest"
echo ""
"""

DEMO_SCRIPT = """\
#!/bin/sh
# Quick demo script

clear
cat << 'BANNER'
+-------------------------------------------------------+
|                                                       |
|        VibeCode Demo VM                               |
|                                                       |
|        Alpine 3.22 - vfkit - Apple Silicon            |
|        Boot time: ~2 seconds                          |
|                                                       |
+-------------------------------------------------------+
BANNER

echo ""
echo "Let's check the weather..."
echo ""
weather

echo ""
echo "Try these commands:"
echo "  weather Moon       # Fun!"
echo "  weather Everest    # Mt. Everest weather"
echo "  weather Mars       # Yes, Mars weather!"
echo "  uname -a           # System info"
echo "  free -h            # Memory usage"
echo ""
"""

INIT_SCRIPT = """\
#!/bin/sh
# Minimal init script

# Mount essential filesystems
mount -t proc proc /proc 2>/dev/null
mount -t sysfs sysfs /sys 2>/dev/null
mount -t devtmpfs devtmpfs /dev 2>/dev/null
mkdir -p /dev/pts /dev/shm
mount -t devpts devpts /dev/pts 2>/dev/null
mount -t tmpfs tmpfs /dev/shm 2>/dev/null

# Setup networking
ip link set lo up 2>/dev/null
ip link set eth0 up 2>/dev/null
udhcpc -i eth0 -s /usr/share/udhcpc/default.script -q -n -f >/dev/null 2>&1 &

# Setup hostname
hostname vibecode-demo 2>/dev/null

# Clear screen and show welcome
clear
cat << 'BANNER'
+-------------------------------------------------------+
|                                                       |
|        VibeCode Demo VM                               |
|                                                       |
|        Alpine 3.22 - BusyBox - vfkit                  |
|        Boot time: ~2 seconds                          |
|                                                       |
+-------------------------------------------------------+

BANNER

echo "Today's Weather:"
weather 2>/dev/null || echo "   (Network not ready yet - try 'weather' in a moment)"
echo ""

echo "Fun commands to try:"
echo "  demo             # Run full demo"
echo "  weather Moon     # Weather on the Moon!"
echo "  weather Mars     # Weather on Mars!"
echo "  weather Everest  # Mt. Everest weather"
echo ""

# Start shell
exec /bin/sh
"""

LAUNCH_SCRIPT = """\
#!/bin/bash
# Launch VibeCode Fun Demo VM

KERNEL="$HOME/.vfkit/vms/vibecode-alpine/kernel/vmlinux"
ROOTFS="$HOME/.vfkit/vms/vibecode-alpine/rootfs/fun-demo-rootfs.cpio.gz"

echo "Launching VibeCode Fun Demo VM..."
echo ""

# Start time
START=$(date +%s.%N)

vfkit \\
  --cpus 2 \\
  --memory 1024 \\
  --device virtio-net,nat \\
  --device virtio-rng \\
  --device virtio-serial,logFilePath=/dev/stdout \\
  --bootloader linux,kernel="$KERNEL",initrd="$ROOTFS",cmdline="console=hvc0 quiet"

END=$(date +%s.%N)
DURATION=$(echo "$END - $START" | bc)
echo ""
echo "VM ran for ${DURATION}s"
"""


def info(message: str) -> None:
    """Print blue info message."""
    print(f"{COLORS.blue}{message}{COLORS.reset}")


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}{message}{COLORS.reset}")


def hint(message: str) -> None:
    """Print yellow hint message."""
    print(f"{COLORS.yellow}{message}{COLORS.reset}")


def run_command(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        text=True,
    )


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def download_alpine(build_dir: Path) -> None:
    """Download Alpine minirootfs."""
    ok("Downloading Alpine minirootfs...")

    url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/{ALPINE_ARCH}/alpine-minirootfs-{ALPINE_RELEASE}-{ALPINE_ARCH}.tar.gz"
    tarball = build_dir / "alpine-minirootfs.tar.gz"

    run_command(["curl", "-#", "-L", "-o", str(tarball), url])


def extract_rootfs(build_dir: Path) -> Path:
    """Extract rootfs."""
    ok("Extracting rootfs...")

    rootfs = build_dir / "rootfs"
    rootfs.mkdir(parents=True, exist_ok=True)

    tarball = build_dir / "alpine-minirootfs.tar.gz"
    run_command(["tar", "-xzf", str(tarball), "-C", str(rootfs)])

    return rootfs


def create_weather_script(rootfs: Path) -> None:
    """Create weather script for BusyBox."""
    ok("Creating weather script...")

    bin_dir = rootfs / "usr" / "local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    weather_path = bin_dir / "weather"
    weather_path.write_text(WEATHER_SCRIPT)
    weather_path.chmod(0o755)


def create_demo_script(rootfs: Path) -> None:
    """Create demo script."""
    ok("Creating demo script...")

    bin_dir = rootfs / "usr" / "local" / "bin"
    demo_path = bin_dir / "demo"
    demo_path.write_text(DEMO_SCRIPT)
    demo_path.chmod(0o755)


def create_init_script(rootfs: Path) -> None:
    """Create welcome banner and init script."""
    ok("Creating welcome banner...")

    init_path = rootfs / "init"
    init_path.write_text(INIT_SCRIPT)
    init_path.chmod(0o755)


def build_initramfs(rootfs: Path, output_path: Path) -> None:
    """Build the cpio archive."""
    ok("Building initramfs...")

    # Use find + cpio + gzip pipeline
    find_proc = subprocess.Popen(
        ["find", ".", "-print0"],
        cwd=rootfs,
        stdout=subprocess.PIPE,
    )
    cpio_proc = subprocess.Popen(
        ["cpio", "--null", "--create", "--format=newc"],
        cwd=rootfs,
        stdin=find_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    with open(output_path, "wb") as f:
        gzip_proc = subprocess.Popen(
            ["gzip", "-9"],
            stdin=cpio_proc.stdout,
            stdout=f,
        )
        gzip_proc.wait()

    find_proc.wait()
    cpio_proc.wait()


def create_launch_script(vm_dir: Path) -> Path:
    """Create launch script."""
    ok("Creating launch script...")

    launch_path = vm_dir / "launch-fun-demo.sh"
    launch_path.write_text(LAUNCH_SCRIPT)
    launch_path.chmod(0o755)

    return launch_path


def print_summary(rootfs_path: Path, launch_path: Path) -> None:
    """Print summary."""
    rootfs_size = get_file_size_human(rootfs_path)

    print()
    info("=" * 55)
    ok("Fun Demo VM ready!")
    info("=" * 55)
    print()

    hint("What you got:")
    print(f"  - Ultra-minimal Alpine {ALPINE_VERSION} ({rootfs_size})")
    print("  - Fun weather command (try: weather Moon)")
    print("  - ~2 second boot time")
    print("  - BusyBox utilities")
    print()

    hint("To launch:")
    print(f"  {launch_path}")
    print()

    hint("Or use the short command:")
    print("  ~/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh")
    print()

    hint("Inside VM try:")
    print("  demo             # Run full demo")
    print("  weather          # Your weather")
    print("  weather Moon     # Moon weather!")
    print("  weather Mars     # Mars weather!")
    print()


def main() -> int:
    """Main entry point."""
    info("=" * 55)
    info("  VibeCode Fun Demo VM - Super Quick Setup")
    info("=" * 55)
    print()

    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    rootfs_dir.mkdir(parents=True, exist_ok=True)

    # Create temp build directory
    build_dir = Path(tempfile.mkdtemp(prefix="vibecode-fun-demo-build-"))

    try:
        download_alpine(build_dir)
        rootfs = extract_rootfs(build_dir)

        create_weather_script(rootfs)
        create_demo_script(rootfs)
        create_init_script(rootfs)

        output_path = rootfs_dir / "fun-demo-rootfs.cpio.gz"
        build_initramfs(rootfs, output_path)

        rootfs_size = get_file_size_human(output_path)
        print()
        ok("Fun demo rootfs created!")
        print(f"   Size: {rootfs_size}")
        print(f"   Location: {output_path}")
        print()

        launch_path = create_launch_script(vm_dir)

        print_summary(output_path, launch_path)

        return 0

    except subprocess.CalledProcessError as e:
        print(f"{COLORS.green}Error: Command failed: {e}{COLORS.reset}")
        return 1
    except Exception as e:
        print(f"{COLORS.green}Error: {e}{COLORS.reset}")
        return 1
    finally:
        # Cleanup
        if build_dir.exists():
            shutil.rmtree(build_dir)


if __name__ == "__main__":
    sys.exit(main())
