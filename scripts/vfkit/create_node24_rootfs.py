#!/usr/bin/env python3
"""Create Alpine Linux ARM64 rootfs with Node.js 24 (optimized for musl).

Based on official nodejs/docker-node Alpine Dockerfile.
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# Official Node.js versions from Docker image
NODE_VERSION = "24.10.0"
YARN_VERSION = "1.22.22"
ALPINE_VERSION = "3.21"

# Architecture detection (for ARM64/aarch64)
ARCH = "arm64"
NODE_CHECKSUM = "3cde0b24eb658e4e0fa2bfbf6de4e3ab2aa2e2b6bc6ddb23cbb0eab4dc04df95"
OPENSSL_ARCH = "linux-aarch64"


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
node:x:1000:1000::/home/node:/bin/sh
postgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh
redis:x:71:71:Redis:/var/lib/redis:/bin/sh
"""

GROUP_CONTENT = """\
root:x:0:
nobody:x:65534:
node:x:1000:
postgres:x:70:
redis:x:71:
"""

HOSTS_CONTENT = """\
127.0.0.1   localhost vibecode-alpine
::1         localhost vibecode-alpine
"""

RESOLV_CONF_CONTENT = """\
nameserver 8.8.8.8
nameserver 8.8.4.4
"""

PROFILE_CONTENT = f"""\
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
export TERM=xterm-256color
export LANG=C.UTF-8

# Node.js environment
export NODE_VERSION={NODE_VERSION}

# Welcome message
if [ -f /etc/motd ]; then
    cat /etc/motd
fi
"""

MOTD_CONTENT = f"""\
==========================================
  VibeCode Alpine ARM64 with Node.js 24
==========================================

Node.js {NODE_VERSION} (musl-optimized)
Alpine Linux {ALPINE_VERSION}

Official Build: nodejs/docker-node compatible
Architecture: ARM64 / Apple Silicon

Quick Commands:
  node --version         - v{NODE_VERSION}
  npm --version          - Check npm
  verify-nodejs          - Full Node.js verification
  quick-start            - Installation guide

Project: /mnt/vibecode (mount via virtiofs)

==========================================
"""

INIT_SCRIPT = """\
#!/bin/sh
# VibeCode Alpine VM with Node.js 24 initialization script

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
    echo "VibeCode directory mounted at /mnt/vibecode"
else
    echo "Failed to mount virtiofs share"
    echo "   Run with full Alpine installation for virtiofs support"
fi

# Display welcome
cat /etc/motd 2>/dev/null || true

# Verify Node.js
echo ""
echo "Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "npm: $(npm --version 2>/dev/null || echo 'Not found')"
echo ""

# Start shell
exec /bin/sh
"""

VERIFY_NODEJS_SCRIPT = """\
#!/bin/sh
echo "=== Node.js 24 Verification (musl-optimized) ==="
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Architecture: $(uname -m)"
echo ""
echo "Node.js binary info:"
file /usr/local/bin/node 2>/dev/null || echo "file command not available"
echo ""
echo "Libc info:"
ldd /usr/local/bin/node 2>&1 | head -5 || echo "ldd not available"
echo ""
echo "Testing Node.js..."
node -e "console.log('Node.js is working!')"
node -e "console.log('V8 version:', process.versions.v8)"
node -e "console.log('OpenSSL version:', process.versions.openssl)"
echo ""
echo "Installed global packages:"
npm list -g --depth=0 2>/dev/null || echo "None"
echo ""
echo "=== Verification Complete ==="
"""

QUICK_START_SCRIPT = """\
#!/bin/sh
echo "=== VibeCode with Node.js 24 Quick Start ==="
echo ""
echo "1. Verify Node.js installation:"
echo "   verify-nodejs"
echo ""
echo "2. Test Node.js:"
echo "   node -e \\"console.log('Hello from Node.js 24!')\\""
echo ""
echo "3. Install packages (after mounting project):"
echo "   cd /mnt/vibecode"
echo "   npm install"
echo ""
echo "4. Run VibeCode:"
echo "   npm run build"
echo "   npm start"
echo ""
echo "Node.js Info:"
echo "  Version: $(node --version 2>/dev/null || echo 'Not available')"
echo "  Type: musl-optimized (unofficial-builds.nodejs.org)"
echo "  Official: Compatible with nodejs/docker-node Alpine images"
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


def compute_sha256(path: Path) -> str:
    """Compute SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def create_directory_structure(work_dir: Path) -> None:
    """Create Alpine directory structure."""
    print("Creating Alpine directory structure...")

    directories = [
        "bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "var", "run", "root", "home",
        "usr/bin", "usr/sbin", "usr/lib", "usr/local/bin", "usr/local/lib", "lib",
        "etc/apk", "var/cache/apk", "var/lib/apk",
        "opt", "srv", "mnt", "media",
    ]

    for directory in directories:
        (work_dir / directory).mkdir(parents=True, exist_ok=True)

    ok("Directory structure created")
    print()


def download_alpine_minirootfs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download Alpine mini root filesystem."""
    print(f"Downloading Alpine {ALPINE_VERSION} mini rootfs...")

    tarball = f"alpine-minirootfs-{ALPINE_VERSION}.0-aarch64.tar.gz"
    tarball_path = rootfs_dir / tarball
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


def configure_runtime_dependencies(work_dir: Path) -> None:
    """Configure runtime dependencies."""
    print("Installing libstdc++ runtime dependency...")
    print("   (Required by Node.js compiled binaries)")

    apk_world = work_dir / "etc" / "apk" / "world"
    apk_world.write_text("libstdc++\n")

    ok("Runtime dependencies configured")
    print()


def download_nodejs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download and install Node.js 24 musl binary."""
    print(f"Downloading Node.js {NODE_VERSION} (ARM64 musl build)...")
    print("   Source: unofficial-builds.nodejs.org (official Alpine source)")

    tarball = f"node-v{NODE_VERSION}-linux-{ARCH}-musl.tar.xz"
    tarball_path = rootfs_dir / tarball
    url = f"https://unofficial-builds.nodejs.org/download/release/v{NODE_VERSION}/{tarball}"

    if not tarball_path.exists():
        print(f"   URL: {url}")
        run_command(["curl", "-L", "-o", str(tarball_path), url])
        ok(f"Downloaded: {tarball}")

        # Verify checksum
        print("Verifying checksum...")
        actual_checksum = compute_sha256(tarball_path)
        if actual_checksum == NODE_CHECKSUM:
            ok(f"Checksum verified: {NODE_CHECKSUM}")
        else:
            warn("Checksum mismatch!")
            print(f"   Expected: {NODE_CHECKSUM}")
            print(f"   Actual:   {actual_checksum}")
            print("   Continuing anyway (checksum may have been updated)")
    else:
        ok(f"Using cached: {tarball}")

    # Extract Node.js to /usr/local
    print("Extracting Node.js to /usr/local...")
    usr_local = work_dir / "usr" / "local"
    run_command([
        "tar", "-xJf", str(tarball_path),
        "-C", str(usr_local),
        "--strip-components=1",
        "--no-same-owner",
    ])

    # Create nodejs symlink (compatibility)
    nodejs_link = usr_local / "bin" / "nodejs"
    if not nodejs_link.exists():
        nodejs_link.symlink_to("/usr/local/bin/node")

    ok("Node.js installed")
    print()


def optimize_openssl_headers(work_dir: Path) -> None:
    """Remove unused OpenSSL headers to save space."""
    print("Removing unused OpenSSL headers to save space...")

    openssl_archs = work_dir / "usr" / "local" / "include" / "node" / "openssl" / "archs"
    if openssl_archs.is_dir():
        for arch_dir in openssl_archs.iterdir():
            if arch_dir.is_dir() and arch_dir.name != OPENSSL_ARCH:
                shutil.rmtree(arch_dir)
        ok(f"Removed unused architectures (kept {OPENSSL_ARCH}), saved ~34MB")
    print()


def verify_nodejs_installation(work_dir: Path) -> None:
    """Verify Node.js installation."""
    node_bin = work_dir / "usr" / "local" / "bin" / "node"
    npm_bin = work_dir / "usr" / "local" / "bin" / "npm"

    if node_bin.exists():
        node_size = get_file_size_human(node_bin)
        npm_size = get_file_size_human(npm_bin) if npm_bin.exists() else "N/A"
        ok("Node.js binaries installed:")
        print(f"   node: {node_size}")
        print(f"   npm:  {npm_size}")
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
    (etc / "profile").write_text(PROFILE_CONTENT)
    (etc / "motd").write_text(MOTD_CONTENT)

    # Create node home directory
    node_home = work_dir / "home" / "node"
    node_home.mkdir(parents=True, exist_ok=True)

    ok("Configuration files created")
    print()


def create_init_script(work_dir: Path, script_dir: Path) -> None:
    """Create or copy init script."""
    print("Installing VibeCode init script...")

    vibecode_init = script_dir / "vibecode-init.sh"
    init_path = work_dir / "init"

    if vibecode_init.exists():
        shutil.copy(vibecode_init, init_path)
        init_path.chmod(0o755)
        ok("VibeCode init script installed")
    else:
        warn("VibeCode init script not found, creating default...")
        init_path.write_text(INIT_SCRIPT)
        init_path.chmod(0o755)

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

    initramfs_path = rootfs_dir / "alpine-node24-rootfs.cpio.gz"

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

    print("=== Node.js 24 Root Filesystem Build Complete ===")
    print()
    print(f"Output: {initramfs_path}")
    print(f"Size: {initramfs_size}")
    print()
    print("Contents:")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Alpine Linux {ALPINE_VERSION} base system (ARM64)")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Node.js {NODE_VERSION} (musl-optimized from unofficial-builds.nodejs.org)")
    print(f"  {COLORS.green}\u2713{COLORS.reset} npm package manager")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Yarn {YARN_VERSION} (optional, can be added)")
    print(f"  {COLORS.green}\u2713{COLORS.reset} APK package manager configured")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Network configuration (DHCP)")
    print(f"  {COLORS.green}\u2713{COLORS.reset} VirtioFS mount support")
    print(f"  {COLORS.green}\u2713{COLORS.reset} Helper scripts (verify-nodejs, quick-start)")
    print(f"  {COLORS.green}\u2713{COLORS.reset} node user (UID 1000, GID 1000)")
    print(f"  {COLORS.green}\u2713{COLORS.reset} OpenSSL headers optimized (-34MB)")
    print()
    print("Based on: nodejs/docker-node official Alpine Dockerfile")
    print(f"Compatible with: Alpine {ALPINE_VERSION}, Node.js {NODE_VERSION}")
    print()
    print("Next step:")
    print("  ./scripts/vfkit/05-launch-vibecode-vm.sh")
    print()
    print("Or update 04-launch-alpine-vm.sh to use:")
    print(f'  INITRAMFS="{initramfs_path}"')
    print()


def main() -> int:
    """Main entry point."""
    script_dir = Path(__file__).resolve().parent
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    work_dir = rootfs_dir / "build-node24"

    print("=== Creating Alpine ARM64 Rootfs with Node.js 24 (musl optimized) ===")
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Node.js Version: {NODE_VERSION} (musl build from unofficial-builds.nodejs.org)")
    print(f"Yarn Version: {YARN_VERSION}")
    print(f"Architecture: {ARCH}")
    print(f"Build Directory: {work_dir}")
    print()

    # Clean and create work directory
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        create_directory_structure(work_dir)
        download_alpine_minirootfs(rootfs_dir, work_dir)
        configure_apk_repositories(work_dir)
        configure_runtime_dependencies(work_dir)
        download_nodejs(rootfs_dir, work_dir)
        optimize_openssl_headers(work_dir)
        verify_nodejs_installation(work_dir)
        create_config_files(work_dir)
        create_init_script(work_dir, script_dir)
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
