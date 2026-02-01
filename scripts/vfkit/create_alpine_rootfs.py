#!/usr/bin/env python3
"""Create Alpine Linux ARM64 rootfs with musl compatibility.

Includes Node.js, AI tools, and code-server.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ALPINE_VERSION = "3.19"
NODE_VERSION = "20.11.1"


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    red: str = "\033[0;31m"
    reset: str = "\033[0m"


COLORS = Colors()

# Configuration file contents
PASSWD_CONTENT = """\
root:x:0:0:root:/root:/bin/sh
nobody:x:65534:65534:nobody:/:/sbin/nologin
"""

GROUP_CONTENT = """\
root:x:0:
nobody:x:65534:
"""

HOSTS_CONTENT = """\
127.0.0.1   localhost vibecode-alpine
::1         localhost vibecode-alpine
"""

RESOLV_CONF_CONTENT = """\
nameserver 8.8.8.8
nameserver 8.8.4.4
"""

FSTAB_CONTENT = """\
proc    /proc   proc    defaults        0 0
sysfs   /sys    sysfs   defaults        0 0
devpts  /dev/pts devpts  gid=5,mode=620  0 0
tmpfs   /tmp    tmpfs   defaults        0 0
"""

PROFILE_CONTENT = """\
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
export TERM=xterm-256color
export LANG=C.UTF-8

# Welcome message
if [ -f /etc/motd ]; then
    cat /etc/motd
fi
"""

MOTD_CONTENT = """\
==========================================
  VibeCode Alpine ARM64 Development VM
==========================================

Alpine Linux with Node.js and AI Tools
Optimized for Apple Silicon / ARM64

Quick Commands:
  node --version     - Check Node.js
  npm --version      - Check npm
  code-server        - Start code-server (port 8080)
  apk add <package>  - Install packages

==========================================
"""

INIT_SCRIPT = """\
#!/bin/sh
# VibeCode Alpine VM initialization script

# Mount filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t devpts devpts /dev/pts
mount -t tmpfs tmpfs /tmp

# Set hostname
hostname -F /etc/hostname

# Configure networking (if virtio-net available)
if [ -d /sys/class/net/eth0 ]; then
    ip link set eth0 up
    udhcpc -i eth0 -f -q &
fi

# Run startup scripts if any
if [ -d /etc/init.d ]; then
    for script in /etc/init.d/S*; do
        if [ -x "$script" ]; then
            $script start
        fi
    done
fi

# Start shell
exec /bin/sh
"""

VERIFY_NODEJS_SCRIPT = """\
#!/bin/sh
echo "=== Node.js Verification ==="
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Architecture: $(uname -m)"
echo "Libc: $(ldd /usr/local/bin/node 2>&1 | grep -o 'musl\\|glibc' || echo 'static')"
echo ""
echo "Testing Node.js..."
node -e "console.log('Node.js is working!')"
echo ""
echo "Installed global packages:"
npm list -g --depth=0 2>/dev/null || echo "None"
"""

QUICK_START_SCRIPT = """\
#!/bin/sh
echo "=== VibeCode Quick Start ==="
echo ""
echo "1. Verify Node.js:"
echo "   verify-nodejs"
echo ""
echo "2. Install code-server:"
echo "   npm install -g code-server"
echo ""
echo "3. Start code-server:"
echo "   code-server --bind-addr 0.0.0.0:8080 --auth none"
echo ""
echo "4. Access from host:"
echo "   http://localhost:8080"
echo ""
"""


def ok(message: str) -> None:
    """Print success message."""
    print(f"{COLORS.green}\u2713 {message}{COLORS.reset}")


def warn(message: str) -> None:
    """Print warning message."""
    print(f"{COLORS.yellow}\u26a0 {message}{COLORS.reset}")


def err(message: str) -> None:
    """Print error message."""
    print(f"{COLORS.red}\u2717 {message}{COLORS.reset}")


def run_command(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=capture_output,
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


def create_directory_structure(work_dir: Path) -> None:
    """Create Alpine directory structure."""
    print("Creating Alpine directory structure...")

    directories = [
        "bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "var", "run", "root", "home",
        "usr/bin", "usr/sbin", "usr/lib", "usr/share", "usr/local", "lib",
        "etc/apk", "var/cache/apk", "var/lib/apk",
        "opt", "srv", "mnt", "media",
    ]

    for directory in directories:
        (work_dir / directory).mkdir(parents=True, exist_ok=True)

    ok("Directory structure created")
    print()


def download_alpine_minirootfs(vm_dir: Path, work_dir: Path) -> None:
    """Download Alpine mini root filesystem."""
    print("Downloading Alpine mini rootfs...")

    tarball = f"alpine-minirootfs-{ALPINE_VERSION}.0-aarch64.tar.gz"
    tarball_path = vm_dir / "rootfs" / tarball
    url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/{tarball}"

    if not tarball_path.exists():
        run_command(["curl", "-L", "-o", str(tarball_path), url])
        ok(f"Downloaded: {tarball}")
    else:
        ok(f"Using cached: {tarball}")

    print("Extracting Alpine mini rootfs...")
    run_command(["tar", "-xzf", str(tarball_path), "-C", str(work_dir)])
    ok("Alpine mini rootfs extracted")
    print()


def configure_apk_repositories(work_dir: Path) -> None:
    """Configure APK repositories."""
    print("Configuring APK repositories...")

    repositories = f"""\
https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/main
https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/community
"""
    (work_dir / "etc" / "apk" / "repositories").write_text(repositories)

    ok("APK repositories configured")
    print()


def download_nodejs(vm_dir: Path, work_dir: Path) -> None:
    """Download and install Node.js."""
    print(f"Downloading Node.js {NODE_VERSION} (musl)...")

    rootfs_dir = vm_dir / "rootfs"
    musl_tarball = f"node-v{NODE_VERSION}-linux-arm64-musl.tar.xz"
    musl_url = f"https://unofficial-builds.nodejs.org/download/release/v{NODE_VERSION}/{musl_tarball}"
    musl_path = rootfs_dir / musl_tarball

    usr_local = work_dir / "usr" / "local"
    usr_local.mkdir(parents=True, exist_ok=True)

    # Try musl build first
    try:
        run_command(
            ["curl", "-f", "-L", "-o", str(musl_path), musl_url],
            capture_output=True,
        )
        ok("Downloaded Node.js musl build")

        print("Extracting Node.js...")
        run_command([
            "tar", "-xJf", str(musl_path),
            "-C", str(usr_local),
            "--strip-components=1",
        ])
        ok("Node.js installed")
    except subprocess.CalledProcessError:
        warn("Musl build not available, using standard build")

        std_tarball = f"node-v{NODE_VERSION}-linux-arm64.tar.xz"
        std_url = f"https://nodejs.org/dist/v{NODE_VERSION}/{std_tarball}"
        std_path = rootfs_dir / std_tarball

        run_command(["curl", "-L", "-o", str(std_path), std_url])
        run_command([
            "tar", "-xJf", str(std_path),
            "-C", str(usr_local),
            "--strip-components=1",
        ])
        ok("Node.js installed (standard build)")

    # Verify Node.js
    node_bin = work_dir / "usr" / "local" / "bin" / "node"
    if node_bin.exists():
        try:
            result = run_command([str(node_bin), "--version"], capture_output=True)
            print(f"   Node version: {result.stdout.strip()}")
        except subprocess.CalledProcessError:
            print("   Node version: unknown")

    print()


def create_config_files(work_dir: Path) -> None:
    """Create essential configuration files."""
    print("Creating configuration files...")

    etc = work_dir / "etc"

    (etc / "passwd").write_text(PASSWD_CONTENT)
    (etc / "group").write_text(GROUP_CONTENT)
    (etc / "hostname").write_text("vibecode-alpine\n")
    (etc / "hosts").write_text(HOSTS_CONTENT)
    (etc / "resolv.conf").write_text(RESOLV_CONF_CONTENT)
    (etc / "fstab").write_text(FSTAB_CONTENT)
    (etc / "profile").write_text(PROFILE_CONTENT)
    (etc / "motd").write_text(MOTD_CONTENT)

    ok("Configuration files created")
    print()


def create_init_script(work_dir: Path) -> None:
    """Create init script."""
    print("Creating init script...")

    init_path = work_dir / "init"
    init_path.write_text(INIT_SCRIPT)
    init_path.chmod(0o755)

    ok("Init script created")
    print()


def create_helper_scripts(work_dir: Path) -> None:
    """Create helper scripts."""
    print("Creating helper scripts...")

    bin_dir = work_dir / "usr" / "local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    verify_nodejs = bin_dir / "verify-nodejs"
    verify_nodejs.write_text(VERIFY_NODEJS_SCRIPT)
    verify_nodejs.chmod(0o755)

    quick_start = bin_dir / "quick-start"
    quick_start.write_text(QUICK_START_SCRIPT)
    quick_start.chmod(0o755)

    ok("Helper scripts created")
    print()


def create_initramfs(rootfs_dir: Path, work_dir: Path) -> Path:
    """Create the initramfs (cpio.gz)."""
    print("Creating initramfs (cpio.gz)...")

    initramfs_path = rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"

    # Use find + cpio + gzip pipeline
    find_proc = subprocess.Popen(
        ["find", ".", "-print0"],
        cwd=work_dir,
        stdout=subprocess.PIPE,
    )
    cpio_proc = subprocess.Popen(
        ["cpio", "--null", "-o", "-H", "newc"],
        cwd=work_dir,
        stdin=find_proc.stdout,
        stdout=subprocess.PIPE,
    )
    with open(initramfs_path, "wb") as f:
        gzip_proc = subprocess.Popen(
            ["gzip", "-9"],
            stdin=cpio_proc.stdout,
            stdout=f,
        )
        gzip_proc.wait()

    find_proc.wait()
    cpio_proc.wait()

    initramfs_size = get_file_size_human(initramfs_path)
    ok(f"Initramfs created: {initramfs_size}")
    print()

    return initramfs_path


def print_summary(initramfs_path: Path) -> None:
    """Print build summary."""
    initramfs_size = get_file_size_human(initramfs_path)

    print("=== Root Filesystem Build Complete ===")
    print()
    print(f"Output: {initramfs_path}")
    print(f"Size: {initramfs_size}")
    print()
    print("Contents:")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Alpine Linux {ALPINE_VERSION} base system")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Node.js {NODE_VERSION}")
    print(f"  {COLORS.green}\u2713{COLORS.reset} npm package manager")
    print(f"  {COLORS.green}\u2713{COLORS.reset} APK package manager")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Network configuration")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Helper scripts (verify-nodejs, quick-start)")
    print()
    print("Next step:")
    print("  ./scripts/vfkit/04-launch-alpine-vm.sh")
    print()


def main() -> int:
    """Main entry point."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    work_dir = rootfs_dir / "build"

    print("=== Creating Alpine ARM64 Root Filesystem ===")
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Node.js Version: {NODE_VERSION}")
    print(f"Build Directory: {work_dir}")
    print()

    # Clean and create work directory
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        create_directory_structure(work_dir)
        download_alpine_minirootfs(vm_dir, work_dir)
        configure_apk_repositories(work_dir)
        download_nodejs(vm_dir, work_dir)
        create_config_files(work_dir)
        create_init_script(work_dir)
        create_helper_scripts(work_dir)
        initramfs_path = create_initramfs(rootfs_dir, work_dir)
        print_summary(initramfs_path)

        return 0
    except subprocess.CalledProcessError as e:
        err(f"Command failed: {e}")
        return 1
    except Exception as e:
        err(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
