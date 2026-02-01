#!/usr/bin/env python3


"""Create Alpine Linux ARM64 rootfs with musl compatibility.

Includes Node.js, AI tools, and code-server.
"""

from __future__ import annotations
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

import os
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn

# Version configuration
ALPINE_VERSION = "3.19"
NODE_VERSION = "20.11.1"


def get_vm_dirs() -> tuple[Path, Path]:
    """Get VM and work directories."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    return rootfs_dir, rootfs_dir / "build"


def create_directory_structure(work_dir: Path) -> None:
    """Create Alpine directory structure."""
    print("📁 Creating Alpine directory structure...")

    directories = [
        "bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "var", "run", "root", "home",
        "usr/bin", "usr/sbin", "usr/lib", "usr/share", "lib",
        "etc/apk", "var/cache/apk", "var/lib/apk",
        "opt", "srv", "mnt", "media",
    ]

    for d in directories:
        (work_dir / d).mkdir(parents=True, exist_ok=True)

    print("✅ Directory structure created")
    print()


def download_alpine_minirootfs(rootfs_dir: Path, work_dir: Path) -> Path:
    """Download Alpine mini rootfs."""
    print("📥 Downloading Alpine mini rootfs...")

    tarball = f"alpine-minirootfs-{ALPINE_VERSION}.0-aarch64.tar.gz"
    tarball_path = rootfs_dir / tarball
    url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/{tarball}"

    if not tarball_path.exists():
        result = subprocess.run(["curl", "-L", "-o", str(tarball_path), url], check=False)
        if result.returncode != 0 or not tarball_path.exists():
            log_error(f"Failed to download {tarball}")
            raise RuntimeError("Download failed")
        print(f"✅ Downloaded: {tarball}")
    else:
        print(f"✅ Using cached: {tarball}")

    return tarball_path


def extract_minirootfs(tarball_path: Path, work_dir: Path) -> None:
    """Extract Alpine mini rootfs."""
    print("📦 Extracting Alpine mini rootfs...")
    subprocess.run(["tar", "-xzf", str(tarball_path), "-C", str(work_dir)], check=True)
    print("✅ Alpine mini rootfs extracted")
    print()


def configure_apk(work_dir: Path) -> None:
    """Configure APK repositories."""
    print("⚙️  Configuring APK repositories...")

    repos = f"""\
https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/main
https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/community
"""
    (work_dir / "etc" / "apk" / "repositories").write_text(repos)

    print("✅ APK repositories configured")
    print()


def download_nodejs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download and install Node.js."""
    print(f"📥 Downloading Node.js {NODE_VERSION} (musl)...")

    tarball_musl = f"node-v{NODE_VERSION}-linux-arm64-musl.tar.xz"
    tarball_std = f"node-v{NODE_VERSION}-linux-arm64.tar.xz"
    tarball_path = rootfs_dir / tarball_musl

    url_musl = f"https://unofficial-builds.nodejs.org/download/release/v{NODE_VERSION}/{tarball_musl}"
    url_std = f"https://nodejs.org/dist/v{NODE_VERSION}/{tarball_std}"

    usr_local = work_dir / "usr" / "local"
    usr_local.mkdir(parents=True, exist_ok=True)

    # Try musl build first
    result = subprocess.run(
        ["curl", "-f", "-L", "-o", str(tarball_path), url_musl],
        capture_output=True,
        check=False,
    )

    if result.returncode == 0 and tarball_path.exists():
        print("✅ Downloaded Node.js musl build")
    else:
        log_warn("Musl build not available, using standard build")
        tarball_path = rootfs_dir / tarball_std
        result = subprocess.run(["curl", "-L", "-o", str(tarball_path), url_std], check=False)
        if result.returncode != 0:
            log_error("Failed to download Node.js")
            raise RuntimeError("Node.js download failed")

    print("📦 Extracting Node.js...")
    subprocess.run(
        ["tar", "-xJf", str(tarball_path), "-C", str(usr_local), "--strip-components=1"],
        check=True,
    )
    print("✅ Node.js installed")

    # Verify Node.js
    node_bin = work_dir / "usr" / "local" / "bin" / "node"
    if node_bin.exists():
        result = subprocess.run([str(node_bin), "--version"], capture_output=True, text=True, check=False)
        if result.returncode == 0:
            print(f"   Node version: {result.stdout.strip()}")

    print()


def create_config_files(work_dir: Path) -> None:
    """Create essential configuration files."""
    print("⚙️  Creating configuration files...")

    # /etc/passwd
    (work_dir / "etc" / "passwd").write_text(dedent("""\
        root:x:0:0:root:/root:/bin/sh
        nobody:x:65534:65534:nobody:/:/sbin/nologin
    """))

    # /etc/group
    (work_dir / "etc" / "group").write_text(dedent("""\
        root:x:0:
        nobody:x:65534:
    """))

    # /etc/hostname
    (work_dir / "etc" / "hostname").write_text("vibecode-alpine\n")

    # /etc/hosts
    (work_dir / "etc" / "hosts").write_text(dedent("""\
        127.0.0.1   localhost vibecode-alpine
        ::1         localhost vibecode-alpine
    """))

    # /etc/resolv.conf
    (work_dir / "etc" / "resolv.conf").write_text(dedent("""\
        nameserver 8.8.8.8
        nameserver 8.8.4.4
    """))

    # /etc/fstab
    (work_dir / "etc" / "fstab").write_text(dedent("""\
        proc    /proc   proc    defaults        0 0
        sysfs   /sys    sysfs   defaults        0 0
        devpts  /dev/pts devpts  gid=5,mode=620  0 0
        tmpfs   /tmp    tmpfs   defaults        0 0
    """))

    # /etc/profile
    (work_dir / "etc" / "profile").write_text(dedent("""\
        export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
        export HOME=/root
        export TERM=xterm-256color
        export LANG=C.UTF-8

        # Welcome message
        if [ -f /etc/motd ]; then
            cat /etc/motd
        fi
    """))

    # /etc/motd
    (work_dir / "etc" / "motd").write_text(dedent("""\
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
    """))

    print("✅ Configuration files created")
    print()


def create_init_script(work_dir: Path) -> None:
    """Create startup script."""
    print("📝 Creating init script...")

    init_script = dedent("""\
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
    """)

    init_path = work_dir / "init"
    init_path.write_text(init_script)
    init_path.chmod(0o755)

    print("✅ Init script created")
    print()


def create_helper_scripts(work_dir: Path) -> None:
    """Create helper scripts."""
    print("📝 Creating helper scripts...")

    bin_dir = work_dir / "usr" / "local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # verify-nodejs script
    verify_nodejs = dedent("""\
        #!/bin/sh
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

    verify_path = bin_dir / "verify-nodejs"
    verify_path.write_text(verify_nodejs)
    verify_path.chmod(0o755)

    # quick-start script
    quick_start = dedent("""\
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
    """)

    quick_start_path = bin_dir / "quick-start"
    quick_start_path.write_text(quick_start)
    quick_start_path.chmod(0o755)

    print("✅ Helper scripts created")
    print()


def create_initramfs(rootfs_dir: Path, work_dir: Path) -> Path:
    """Create the initramfs (cpio.gz)."""
    print("📦 Creating initramfs (cpio.gz)...")

    initramfs_file = rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"

    # Use cpio to create archive
    find_proc = subprocess.Popen(
        ["find", ".", "-print0"],
        cwd=work_dir,
        stdout=subprocess.PIPE,
    )
    cpio_proc = subprocess.Popen(
        ["cpio", "--null", "-o", "-H", "newc"],
        stdin=find_proc.stdout,
        stdout=subprocess.PIPE,
        cwd=work_dir,
    )
    find_proc.stdout.close()

    gzip_proc = subprocess.Popen(
        ["gzip", "-9"],
        stdin=cpio_proc.stdout,
        stdout=subprocess.PIPE,
    )
    cpio_proc.stdout.close()

    compressed_data, _ = gzip_proc.communicate()
    initramfs_file.write_bytes(compressed_data)

    size = initramfs_file.stat().st_size / (1024 * 1024)
    print(f"✅ Initramfs created: {size:.1f}MB")
    print()

    return initramfs_file


def print_summary(initramfs_file: Path) -> None:
    """Print build summary."""
    log_section("Root Filesystem Build Complete")
    print()

    size = initramfs_file.stat().st_size / (1024 * 1024)
    print(f"Output: {initramfs_file}")
    print(f"Size: {size:.1f}MB")
    print()
    print("Contents:")
    print(f"  ✅ Alpine Linux {ALPINE_VERSION} base system")
    print(f"  ✅ Node.js {NODE_VERSION}")
    print("  ✅ npm package manager")
    print("  ✅ APK package manager")
    print("  ✅ Network configuration")
    print("  ✅ Helper scripts (verify-nodejs, quick-start)")
    print()
    print("Next step:")
    print("  ./scripts/vfkit/04-launch-alpine-vm.sh")
    print()


def main() -> int:
    """Main entry point."""
    log_section("Creating Alpine ARM64 Root Filesystem")
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Node.js Version: {NODE_VERSION}")

    rootfs_dir, work_dir = get_vm_dirs()
    print(f"Build Directory: {work_dir}")
    print()

    try:
        # Clean and create work directory
        if work_dir.exists():
            shutil.rmtree(work_dir)
        work_dir.mkdir(parents=True, exist_ok=True)

        create_directory_structure(work_dir)
        tarball_path = download_alpine_minirootfs(rootfs_dir, work_dir)
        extract_minirootfs(tarball_path, work_dir)
        configure_apk(work_dir)
        download_nodejs(rootfs_dir, work_dir)
        create_config_files(work_dir)
        create_init_script(work_dir)
        create_helper_scripts(work_dir)
        initramfs_file = create_initramfs(rootfs_dir, work_dir)
        print_summary(initramfs_file)

        return 0

    except Exception as e:
        log_error(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())