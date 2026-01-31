#!/usr/bin/env python3
"""Create Alpine Linux ARM64 rootfs for VibeCode.

Includes Node.js and custom init script for virtiofs mounting.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Configuration
ALPINE_VERSION = "3.19"
NODE_VERSION = "20.11.1"


def run_command(
    cmd: list[str] | str,
    cwd: Path | None = None,
    check: bool = True,
    capture: bool = False,
    shell: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=capture,
        text=True,
        shell=shell,
    )


def create_directory_structure(work_dir: Path) -> None:
    """Create Alpine directory structure."""
    print("\U0001f4c1 Creating Alpine directory structure...")

    dirs = [
        "bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "var", "run", "root", "home",
        "usr/bin", "usr/sbin", "usr/lib", "usr/share", "lib",
        "etc/apk", "var/cache/apk", "var/lib/apk",
        "opt", "srv", "mnt", "media",
    ]

    for d in dirs:
        (work_dir / d).mkdir(parents=True, exist_ok=True)

    print("\u2705 Directory structure created")
    print()


def download_alpine_minirootfs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download Alpine mini root filesystem."""
    print("\U0001f4e5 Downloading Alpine mini rootfs...")

    tarball = f"alpine-minirootfs-{ALPINE_VERSION}.0-aarch64.tar.gz"
    url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/{tarball}"
    tarball_path = rootfs_dir / tarball

    if not tarball_path.exists():
        run_command(["curl", "-L", "-o", str(tarball_path), url])
        print(f"\u2705 Downloaded: {tarball}")
    else:
        print(f"\u2705 Using cached: {tarball}")

    # Extract
    print("\U0001f4e6 Extracting Alpine mini rootfs...")
    run_command(["tar", "-xzf", str(tarball_path), "-C", str(work_dir)])
    print("\u2705 Alpine mini rootfs extracted")
    print()


def configure_apk(work_dir: Path) -> None:
    """Configure APK repositories."""
    print("\u2699\ufe0f  Configuring APK repositories...")

    repos = f"""https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/main
https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/community
"""
    (work_dir / "etc" / "apk" / "repositories").write_text(repos)

    print("\u2705 APK repositories configured")
    print()


def download_nodejs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download and install Node.js."""
    print(f"\U0001f4e5 Downloading Node.js {NODE_VERSION} (musl)...")

    tarball = f"node-v{NODE_VERSION}-linux-arm64-musl.tar.xz"
    url = f"https://unofficial-builds.nodejs.org/download/release/v{NODE_VERSION}/{tarball}"
    tarball_path = rootfs_dir / tarball

    # Try musl build first
    result = run_command(
        ["curl", "-f", "-L", "-o", str(tarball_path), url],
        check=False,
    )

    if result.returncode == 0:
        print("\u2705 Downloaded Node.js musl build")
    else:
        print(f"{Colors.YELLOW}\u26a0\ufe0f  Musl build not available, using standard build{Colors.NC}")
        tarball = f"node-v{NODE_VERSION}-linux-arm64.tar.xz"
        url = f"https://nodejs.org/dist/v{NODE_VERSION}/{tarball}"
        tarball_path = rootfs_dir / tarball
        run_command(["curl", "-L", "-o", str(tarball_path), url])

    # Extract Node.js
    print("\U0001f4e6 Extracting Node.js...")
    usr_local = work_dir / "usr" / "local"
    usr_local.mkdir(parents=True, exist_ok=True)
    run_command(["tar", "-xJf", str(tarball_path), "-C", str(usr_local), "--strip-components=1"])
    print("\u2705 Node.js installed")

    # Verify
    node_bin = work_dir / "usr" / "local" / "bin" / "node"
    if node_bin.exists():
        result = run_command([str(node_bin), "--version"], check=False, capture=True)
        if result.returncode == 0:
            print(f"   Node version: {result.stdout.strip()}")

    print()


def create_config_files(work_dir: Path) -> None:
    """Create essential configuration files."""
    print("\u2699\ufe0f  Creating configuration files...")

    # /etc/passwd
    (work_dir / "etc" / "passwd").write_text("""root:x:0:0:root:/root:/bin/sh
nobody:x:65534:65534:nobody:/:/sbin/nologin
postgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh
redis:x:71:71:Redis:/var/lib/redis:/bin/sh
""")

    # /etc/group
    (work_dir / "etc" / "group").write_text("""root:x:0:
nobody:x:65534:
postgres:x:70:
redis:x:71:
""")

    # /etc/hostname
    (work_dir / "etc" / "hostname").write_text("vibecode-alpine\n")

    # /etc/hosts
    (work_dir / "etc" / "hosts").write_text("""127.0.0.1   localhost vibecode-alpine
::1         localhost vibecode-alpine
""")

    # /etc/resolv.conf
    (work_dir / "etc" / "resolv.conf").write_text("""nameserver 8.8.8.8
nameserver 8.8.4.4
""")

    # /etc/fstab
    (work_dir / "etc" / "fstab").write_text("""proc    /proc   proc    defaults        0 0
sysfs   /sys    sysfs   defaults        0 0
devpts  /dev/pts devpts  gid=5,mode=620  0 0
tmpfs   /tmp    tmpfs   defaults        0 0
""")

    # /etc/profile
    (work_dir / "etc" / "profile").write_text("""export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
export TERM=xterm-256color
export LANG=C.UTF-8

# Welcome message
if [ -f /etc/motd ]; then
    cat /etc/motd
fi
""")

    # /etc/motd
    (work_dir / "etc" / "motd").write_text("""==========================================
  VibeCode Alpine ARM64 Development VM
==========================================

Alpine Linux with Node.js
Optimized for Apple Silicon / ARM64

Quick Commands:
  node --version         - Check Node.js
  npm --version          - Check npm
  start-services         - Start PostgreSQL & Redis
  stop-services          - Stop all services

Project Directory:
  /mnt/vibecode          - Shared with host

Setup Guide:
  /mnt/vibecode/scripts/vfkit/vm-setup-services.sh

==========================================
""")

    print("\u2705 Configuration files created")
    print()


def install_init_script(script_dir: Path, work_dir: Path) -> None:
    """Install VibeCode init script."""
    print("\U0001f4dd Installing VibeCode init script...")

    vibecode_init = script_dir / "vibecode-init.sh"
    init_path = work_dir / "init"

    if vibecode_init.exists():
        shutil.copy(vibecode_init, init_path)
        init_path.chmod(0o755)
        print("\u2705 VibeCode init script installed")
    else:
        print(f"{Colors.YELLOW}\u26a0\ufe0f  VibeCode init script not found, using default init{Colors.NC}")

        default_init = """#!/bin/sh
# VibeCode Alpine VM initialization script

# Mount filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mkdir -p /dev/pts
mount -t devpts devpts /dev/pts
mount -t tmpfs tmpfs /tmp

# Set hostname
hostname -F /etc/hostname

# Configure networking (if virtio-net available)
if [ -d /sys/class/net/eth0 ]; then
    ip link set eth0 up
    udhcpc -i eth0 -f -q &
fi

# Mount VibeCode shared directory via virtiofs
echo "Mounting VibeCode shared directory..."
mkdir -p /mnt/vibecode
if mount -t virtiofs vibecode /mnt/vibecode 2>/dev/null; then
    echo "✅ VibeCode directory mounted at /mnt/vibecode"
else
    echo "⚠️  Failed to mount virtiofs share"
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
        init_path.write_text(default_init)
        init_path.chmod(0o755)

    print()


def create_helper_scripts(work_dir: Path) -> None:
    """Create helper scripts."""
    print("\U0001f4dd Creating helper scripts...")

    bin_dir = work_dir / "usr" / "local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # verify-nodejs script
    verify_script = bin_dir / "verify-nodejs"
    verify_script.write_text("""#!/bin/sh
echo "=== Node.js Verification ==="
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Architecture: $(uname -m)"
echo "Libc: $(ldd /usr/local/bin/node 2>&1 | grep -o 'musl\\|glibc' || echo 'static')"
echo ""
echo "Testing Node.js..."
node -e "console.log('✅ Node.js is working!')"
echo ""
echo "Installed global packages:"
npm list -g --depth=0 2>/dev/null || echo "None"
""")
    verify_script.chmod(0o755)

    # quick-start script
    quick_start = bin_dir / "quick-start"
    quick_start.write_text("""#!/bin/sh
echo "=== VibeCode Quick Start ==="
echo ""
echo "1. Setup services (first time only):"
echo "   /mnt/vibecode/scripts/vfkit/vm-setup-services.sh"
echo ""
echo "2. Start services:"
echo "   start-services"
echo ""
echo "3. Check services:"
echo "   supervisorctl status"
echo ""
echo "4. Setup VibeCode:"
echo "   cd /mnt/vibecode"
echo "   npm install"
echo "   cp .env.example .env"
echo "   # Edit .env with proper DATABASE_URL and REDIS_URL"
echo "   npx prisma migrate deploy"
echo "   npm run build"
echo ""
echo "5. Start VibeCode:"
echo "   npm start"
echo ""
echo "Access from host:"
echo "   http://localhost:3000"
echo ""
""")
    quick_start.chmod(0o755)

    print("\u2705 Helper scripts created")
    print()


def create_initramfs(work_dir: Path, rootfs_dir: Path) -> Path:
    """Create the initramfs (cpio.gz)."""
    print("\U0001f4e6 Creating initramfs (cpio.gz)...")

    initramfs_file = rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"

    # Use shell pipeline for cpio
    cmd = f"find . -print0 | cpio --null -o -H newc | gzip -9 > {initramfs_file}"
    run_command(cmd, cwd=work_dir, shell=True)

    # Get size
    result = run_command(["du", "-h", str(initramfs_file)], capture=True)
    size = result.stdout.split()[0]

    print(f"\u2705 Initramfs created: {size}")
    print()

    return initramfs_file


def print_summary(initramfs_file: Path) -> None:
    """Print build summary."""
    result = run_command(["du", "-h", str(initramfs_file)], capture=True)
    size = result.stdout.split()[0]

    print("=== VibeCode Root Filesystem Build Complete ===")
    print()
    print(f"Output: {initramfs_file}")
    print(f"Size: {size}")
    print()
    print("Contents:")
    print(f"  \u2705 Alpine Linux {ALPINE_VERSION} base system")
    print(f"  \u2705 Node.js {NODE_VERSION}")
    print("  \u2705 npm package manager")
    print("  \u2705 APK package manager")
    print("  \u2705 Network configuration")
    print("  \u2705 VirtioFS mount support")
    print("  \u2705 Helper scripts (verify-nodejs, quick-start)")
    print("  \u2705 User accounts (postgres, redis)")
    print()
    print("Next step:")
    print("  ./scripts/vfkit/05-launch-vibecode-vm.sh")
    print()


def main() -> int:
    """Main entry point."""
    script_dir = Path(__file__).parent.resolve()
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    work_dir = rootfs_dir / "build-vibecode"

    print("=== Creating VibeCode Alpine ARM64 Root Filesystem ===")
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Node.js Version: {NODE_VERSION}")
    print(f"Build Directory: {work_dir}")
    print()

    # Clean and create work directory
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True)

    # Change to work directory
    original_cwd = Path.cwd()
    os.chdir(work_dir)

    try:
        create_directory_structure(work_dir)
        download_alpine_minirootfs(rootfs_dir, work_dir)
        configure_apk(work_dir)
        download_nodejs(rootfs_dir, work_dir)
        create_config_files(work_dir)
        install_init_script(script_dir, work_dir)
        create_helper_scripts(work_dir)
        initramfs_file = create_initramfs(work_dir, rootfs_dir)
        print_summary(initramfs_file)
    finally:
        os.chdir(original_cwd)

    return 0


if __name__ == "__main__":
    sys.exit(main())
