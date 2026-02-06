from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "vfkit-install"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "vm-management"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation




"""VibeCode Fun Demo VM - One-Liner Installer.

Usage: python3 scripts/vfkit/install.py
Or:    curl -fsSL URL | python3
"""


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

import gzip
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from textwrap import dedent

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_warn

ALPINE_VERSION = "3.22"
ALPINE_RELEASE = "3.22.2"


def print_banner() -> None:
    """Print installation banner."""
    os.system("clear" if os.name != "nt" else "cls")
    print(dedent("""\
        ╔═══════════════════════════════════════════════════════╗
        ║                                                       ║
        ║        ⚡ VibeCode Fun Demo VM                        ║
        ║                                                       ║
        ║        One-Liner Installer                           ║
        ║        Super Quick • BusyBox • Weather Demo          ║
        ║                                                       ║
        ╚═══════════════════════════════════════════════════════╝
    """))
    print(f"{COLORS.cyan}🚀 Starting installation...{COLORS.reset}")
    print()


def check_platform() -> None:
    """Check if running on macOS."""
    if platform.system() != "Darwin":
        log_error("This installer only works on macOS (Apple Silicon)")
        raise RuntimeError("macOS required")

    arch = platform.machine()
    if arch != "arm64":
        log_warn(f"This is optimized for Apple Silicon (ARM64)")
        print(f"   Your architecture: {arch}")
        print()


def check_prerequisites() -> None:
    """Check and install prerequisites."""
    print(f"{COLORS.blue}[1/4]{COLORS.reset} Checking prerequisites...")

    if not shutil.which("vfkit"):
        print(f"{COLORS.yellow}   vfkit not found. Installing via brew...{COLORS.reset}")
        if not shutil.which("brew"):
            log_error("Homebrew not found. Please install: https://brew.sh")
            raise RuntimeError("Homebrew required")
        subprocess.run(["brew", "install", "vfkit"], check=True)
        print(f"{COLORS.green}   ✅ vfkit installed{COLORS.reset}")
    else:
        print(f"{COLORS.green}   ✅ vfkit found: {shutil.which('vfkit')}{COLORS.reset}")

    if not shutil.which("curl") and not shutil.which("wget"):
        log_error("curl or wget required")
        raise RuntimeError("curl or wget required")


def setup_directories() -> tuple[Path, Path, Path]:
    """Setup VM directories."""
    print()
    print(f"{COLORS.blue}[2/4]{COLORS.reset} Setting up VM directories...")

    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    kernel_dir = vm_dir / "kernel"
    rootfs_dir = vm_dir / "rootfs"

    kernel_dir.mkdir(parents=True, exist_ok=True)
    rootfs_dir.mkdir(parents=True, exist_ok=True)

    print(f"{COLORS.green}   ✅ Directories created{COLORS.reset}")

    return vm_dir, kernel_dir, rootfs_dir


def download_kernel(kernel_dir: Path) -> Path:
    """Download and extract Alpine kernel."""
    print()
    print(f"{COLORS.blue}[3/4]{COLORS.reset} Downloading Alpine kernel...")

    kernel_file = kernel_dir / "vmlinux"

    if kernel_file.exists():
        size = kernel_file.stat().st_size / (1024 * 1024)
        print(f"{COLORS.green}   ✅ Kernel already exists ({size:.1f}MB){COLORS.reset}")
        return kernel_file

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        iso_file = temp_path / "alpine-virt.iso"

        print(f"{COLORS.cyan}   Downloading Alpine {ALPINE_VERSION} kernel...{COLORS.reset}")
        url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/alpine-virt-{ALPINE_RELEASE}-aarch64.iso"
        subprocess.run(["curl", "-#", "-L", "-o", str(iso_file), url], check=True)

        print(f"{COLORS.cyan}   Extracting kernel...{COLORS.reset}")

        # Mount ISO on macOS
        result = subprocess.run(
            ["hdiutil", "attach", str(iso_file)],
            capture_output=True,
            text=True,
            check=True,
        )

        mount_point = None
        for line in result.stdout.splitlines():
            if "/Volumes/" in line:
                parts = line.split("\t")
                for part in parts:
                    if "/Volumes/" in part:
                        mount_point = part.strip()
                        break

        if not mount_point:
            log_error("Cannot find mount point for ISO")
            raise RuntimeError("Failed to mount ISO")

        vmlinuz_src = Path(mount_point) / "boot" / "vmlinuz-virt"
        vmlinuz_dst = temp_path / f"vmlinuz-{ALPINE_VERSION}"
        shutil.copy(vmlinuz_src, vmlinuz_dst)

        subprocess.run(["hdiutil", "detach", mount_point, "-quiet"], check=False)

        print(f"{COLORS.cyan}   Decompressing kernel...{COLORS.reset}")

        # Extract gzip from kernel
        data = vmlinuz_dst.read_bytes()
        gzip_magic = b"\x1f\x8b"
        offset = data.find(gzip_magic)

        if offset >= 0:
            vmlinuz_gz = temp_path / "vmlinuz.gz"
            vmlinuz_gz.write_bytes(data[offset:])

            with gzip.open(vmlinuz_gz, "rb") as f_in:
                kernel_file.write_bytes(f_in.read())

    size = kernel_file.stat().st_size / (1024 * 1024)
    print(f"{COLORS.green}   ✅ Kernel downloaded ({size:.1f}MB){COLORS.reset}")

    return kernel_file


def build_rootfs(rootfs_dir: Path) -> Path:
    """Build fun demo rootfs."""
    print()
    print(f"{COLORS.blue}[4/4]{COLORS.reset} Building fun demo rootfs...")

    rootfs_file = rootfs_dir / "fun-demo-rootfs.cpio.gz"

    with tempfile.TemporaryDirectory() as temp_dir:
        build_dir = Path(temp_dir)
        rootfs_path = build_dir / "rootfs"
        rootfs_path.mkdir()

        print(f"{COLORS.cyan}   Downloading Alpine minirootfs...{COLORS.reset}")
        minirootfs_url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/alpine-minirootfs-{ALPINE_RELEASE}-aarch64.tar.gz"
        minirootfs_file = build_dir / "alpine-minirootfs.tar.gz"
        subprocess.run(["curl", "-#", "-L", "-o", str(minirootfs_file), minirootfs_url], check=True)

        print(f"{COLORS.cyan}   Building rootfs with weather demo...{COLORS.reset}")
        subprocess.run(["tar", "-xzf", str(minirootfs_file), "-C", str(rootfs_path)], check=True)

        # Create weather script
        bin_dir = rootfs_path / "usr" / "local" / "bin"
        bin_dir.mkdir(parents=True, exist_ok=True)

        weather_script = dedent("""\
            #!/bin/sh
            LOC="${1:-}"
            echo ""
            echo "🌤️  Weather Report"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            if [ -z "$LOC" ]; then
                wget -qO- "wttr.in/?format=v2" 2>/dev/null || echo "❌ Network not ready"
            else
                wget -qO- "wttr.in/${LOC}?format=v2" 2>/dev/null || echo "❌ Can't fetch weather"
            fi
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Usage: weather [location]"
            echo "Try: weather Moon | weather Mars | weather Everest"
            echo ""
        """)
        weather_path = bin_dir / "weather"
        weather_path.write_text(weather_script)
        weather_path.chmod(0o755)

        # Create demo script
        demo_script = dedent("""\
            #!/bin/sh
            clear
            cat << 'BANNER'
            ╔═══════════════════════════════════════════════════════╗
            ║        ⚡ VibeCode Demo VM                            ║
            ║        Alpine 3.22 • vfkit • Apple Silicon           ║
            ╚═══════════════════════════════════════════════════════╝
            BANNER
            echo ""
            weather
            echo "💡 Try: weather Moon | weather Mars | weather Everest"
            echo ""
        """)
        demo_path = bin_dir / "demo"
        demo_path.write_text(demo_script)
        demo_path.chmod(0o755)

        # Create init script
        init_script = dedent("""\
            #!/bin/sh
            mount -t proc proc /proc 2>/dev/null
            mount -t sysfs sysfs /sys 2>/dev/null
            mount -t devtmpfs devtmpfs /dev 2>/dev/null
            mkdir -p /dev/pts /dev/shm
            mount -t devpts devpts /dev/pts 2>/dev/null
            mount -t tmpfs tmpfs /dev/shm 2>/dev/null
            ip link set lo up 2>/dev/null
            ip link set eth0 up 2>/dev/null
            udhcpc -i eth0 -s /usr/share/udhcpc/default.script -q -n -f >/dev/null 2>&1 &
            hostname vibecode-demo 2>/dev/null
            clear
            cat << 'BANNER'
            ╔═══════════════════════════════════════════════════════╗
            ║        ⚡ VibeCode Demo VM                            ║
            ║        Alpine 3.22 • BusyBox • Weather Demo          ║
            ╚═══════════════════════════════════════════════════════╝
            BANNER
            echo ""
            echo "🌤️  Today's Weather:"
            weather 2>/dev/null || echo "   (Fetching... try 'weather' in a moment)"
            echo ""
            echo "💡 Try: demo | weather Moon | weather Mars"
            echo ""
            exec /bin/sh
        """)
        init_path = rootfs_path / "init"
        init_path.write_text(init_script)
        init_path.chmod(0o755)

        # Build initramfs
        find_proc = subprocess.Popen(
            ["find", ".", "-print0"],
            cwd=rootfs_path,
            stdout=subprocess.PIPE,
        )
        cpio_proc = subprocess.Popen(
            ["cpio", "--null", "--create", "--format=newc"],
            stdin=find_proc.stdout,
            stdout=subprocess.PIPE,
            cwd=rootfs_path,
            stderr=subprocess.DEVNULL,
        )
        find_proc.stdout.close()

        compressed_data = gzip.compress(cpio_proc.communicate()[0], compresslevel=9)
        rootfs_file.write_bytes(compressed_data)

    size = rootfs_file.stat().st_size / (1024 * 1024)
    print(f"{COLORS.green}   ✅ Rootfs built ({size:.1f}MB){COLORS.reset}")

    return rootfs_file


def create_launch_script(vm_dir: Path, kernel_file: Path, rootfs_file: Path) -> Path:
    """Create launch script."""
    print()
    print(f"{COLORS.blue}[+]{COLORS.reset} Creating launch script...")

    launch_script = vm_dir / "launch-fun-demo.sh"
    script_content = dedent(f"""\
        #!/bin/bash
        KERNEL="{kernel_file}"
        ROOTFS="{rootfs_file}"
        echo "🚀 Launching VibeCode Fun Demo VM..."
        echo ""
        START=$(date +%s)
        vfkit \\
          --cpus 2 \\
          --memory 1024 \\
          --device virtio-net,nat \\
          --device virtio-rng \\
          --device virtio-serial,logFilePath=/dev/stdout \\
          --bootloader linux,kernel="$KERNEL",initrd="$ROOTFS",cmdline="console=hvc0 quiet"
        END=$(date +%s)
        echo ""
        echo "⏱️  Boot time: $((END - START))s"
    """)

    launch_script.write_text(script_content)
    launch_script.chmod(0o755)

    return launch_script


def print_completion(kernel_file: Path, rootfs_file: Path, launch_script: Path) -> None:
    """Print completion message."""
    kernel_size = kernel_file.stat().st_size / (1024 * 1024)
    rootfs_size = rootfs_file.stat().st_size / (1024 * 1024)

    print()
    print(f"{COLORS.green}═══════════════════════════════════════════════════════{COLORS.reset}")
    print(f"{COLORS.green}✅ Installation complete!{COLORS.reset}")
    print(f"{COLORS.green}═══════════════════════════════════════════════════════{COLORS.reset}")
    print()
    print(f"{COLORS.yellow}📊 Stats:{COLORS.reset}")
    print(f"  • Rootfs: {rootfs_size:.1f}MB")
    print(f"  • Kernel: {kernel_size:.1f}MB")
    print("  • Boot time: ~2 seconds 🚀")
    print("  • Memory: 1GB")
    print()
    print(f"{COLORS.yellow}🚀 Launch VM:{COLORS.reset}")
    print(f"  {COLORS.cyan}{launch_script}{COLORS.reset}")
    print()
    print(f"  {COLORS.cyan}# Or use short command:{COLORS.reset}")
    print(f"  {COLORS.cyan}~/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh{COLORS.reset}")
    print()
    print(f"{COLORS.yellow}💡 Inside VM try:{COLORS.reset}")
    print(f"  {COLORS.cyan}demo{COLORS.reset}             # Run demo")
    print(f"  {COLORS.cyan}weather{COLORS.reset}          # Your weather")
    print(f"  {COLORS.cyan}weather Moon{COLORS.reset}     # Moon weather 🌙")
    print(f"  {COLORS.cyan}weather Mars{COLORS.reset}     # Mars weather 🔴")
    print(f"  {COLORS.cyan}weather Everest{COLORS.reset}  # Mt. Everest")
    print()
    print(f"{COLORS.green}Enjoy! ⚡{COLORS.reset}")
    print()


def main() -> int:
    """Main entry point."""
    try:
        print_banner()
        check_platform()
        check_prerequisites()
        vm_dir, kernel_dir, rootfs_dir = setup_directories()
        kernel_file = download_kernel(kernel_dir)
        rootfs_file = build_rootfs(rootfs_dir)
        launch_script = create_launch_script(vm_dir, kernel_file, rootfs_file)
        print_completion(kernel_file, rootfs_file, launch_script)
        return 0
    except Exception as e:
        log_error(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())