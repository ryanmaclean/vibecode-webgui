from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "vfkit-06-create-vibecode-rootfs"
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




"""Create Alpine Linux ARM64 rootfs for VibeCode.

Includes Node.js and custom init script for virtiofs mounting.
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

import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import log_error, log_section, log_warn

ALPINE_VERSION = "3.19"
NODE_VERSION = "20.11.1"


def get_vm_dirs() -> tuple[Path, Path, Path]:
    """Get VM directories."""
    script_dir = Path(__file__).resolve().parent
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    work_dir = rootfs_dir / "build-vibecode"
    return script_dir, rootfs_dir, work_dir


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


def download_and_extract_minirootfs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download and extract Alpine mini rootfs."""
    print("📥 Downloading Alpine mini rootfs...")

    tarball = f"alpine-minirootfs-{ALPINE_VERSION}.0-aarch64.tar.gz"
    tarball_path = rootfs_dir / tarball
    url = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/aarch64/{tarball}"

    if not tarball_path.exists():
        subprocess.run(["curl", "-L", "-o", str(tarball_path), url], check=True)
        print(f"✅ Downloaded: {tarball}")
    else:
        print(f"✅ Using cached: {tarball}")

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
        subprocess.run(["curl", "-L", "-o", str(tarball_path), url_std], check=True)

    print("📦 Extracting Node.js...")
    subprocess.run(
        ["tar", "-xJf", str(tarball_path), "-C", str(usr_local), "--strip-components=1"],
        check=True,
    )
    print("✅ Node.js installed")

    node_bin = work_dir / "usr" / "local" / "bin" / "node"
    if node_bin.exists():
        result = subprocess.run([str(node_bin), "--version"], capture_output=True, text=True, check=False)
        if result.returncode == 0:
            print(f"   Node version: {result.stdout.strip()}")
    print()


def create_config_files(work_dir: Path) -> None:
    """Create essential configuration files."""
    print("⚙️  Creating configuration files...")

    (work_dir / "etc" / "passwd").write_text(dedent("""\
        root:x:0:0:root:/root:/bin/sh
        nobody:x:65534:65534:nobody:/:/sbin/nologin
        postgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh
        redis:x:71:71:Redis:/var/lib/redis:/bin/sh
    """))

    (work_dir / "etc" / "group").write_text(dedent("""\
        root:x:0:
        nobody:x:65534:
        postgres:x:70:
        redis:x:71:
    """))

    (work_dir / "etc" / "hostname").write_text("vibecode-alpine\n")

    (work_dir / "etc" / "hosts").write_text(dedent("""\
        127.0.0.1   localhost vibecode-alpine
        ::1         localhost vibecode-alpine
    """))

    (work_dir / "etc" / "resolv.conf").write_text(dedent("""\
        nameserver 8.8.8.8
        nameserver 8.8.4.4
    """))

    (work_dir / "etc" / "fstab").write_text(dedent("""\
        proc    /proc   proc    defaults        0 0
        sysfs   /sys    sysfs   defaults        0 0
        devpts  /dev/pts devpts  gid=5,mode=620  0 0
        tmpfs   /tmp    tmpfs   defaults        0 0
    """))

    (work_dir / "etc" / "profile").write_text(dedent("""\
        export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
        export HOME=/root
        export TERM=xterm-256color
        export LANG=C.UTF-8

        if [ -f /etc/motd ]; then
            cat /etc/motd
        fi
    """))

    (work_dir / "etc" / "motd").write_text(dedent("""\
        ==========================================
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
    """))

    print("✅ Configuration files created")
    print()


def create_init_script(script_dir: Path, work_dir: Path) -> None:
    """Create or copy init script."""
    print("📝 Installing VibeCode init script...")

    init_src = script_dir / "vibecode-init.sh"
    init_dst = work_dir / "init"

    if init_src.exists():
        shutil.copy(init_src, init_dst)
        init_dst.chmod(0o755)
        print("✅ VibeCode init script installed")
    else:
        log_warn("VibeCode init script not found, using default init")
        init_script = dedent("""\
            #!/bin/sh
            # VibeCode Alpine VM initialization script

            mount -t proc none /proc
            mount -t sysfs none /sys
            mount -t devtmpfs none /dev
            mkdir -p /dev/pts
            mount -t devpts devpts /dev/pts
            mount -t tmpfs tmpfs /tmp

            hostname -F /etc/hostname

            if [ -d /sys/class/net/eth0 ]; then
                ip link set eth0 up
                udhcpc -i eth0 -f -q &
            fi

            echo "Mounting VibeCode shared directory..."
            mkdir -p /mnt/vibecode
            if mount -t virtiofs vibecode /mnt/vibecode 2>/dev/null; then
                echo "✅ VibeCode directory mounted at /mnt/vibecode"
            else
                echo "⚠️  Failed to mount virtiofs share"
            fi

            if [ -d /etc/init.d ]; then
                for script in /etc/init.d/S*; do
                    if [ -x "$script" ]; then
                        $script start
                    fi
                done
            fi

            exec /bin/sh
        """)
        init_dst.write_text(init_script)
        init_dst.chmod(0o755)
    print()


def create_helper_scripts(work_dir: Path) -> None:
    """Create helper scripts."""
    print("📝 Creating helper scripts...")

    bin_dir = work_dir / "usr" / "local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

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

    quick_start = dedent("""\
        #!/bin/sh
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
    quick_start_path = bin_dir / "quick-start"
    quick_start_path.write_text(quick_start)
    quick_start_path.chmod(0o755)

    print("✅ Helper scripts created")
    print()


def create_initramfs(rootfs_dir: Path, work_dir: Path) -> Path:
    """Create the initramfs (cpio.gz)."""
    print("📦 Creating initramfs (cpio.gz)...")

    initramfs_file = rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"

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

    import gzip
    compressed_data = gzip.compress(cpio_proc.communicate()[0], compresslevel=9)
    initramfs_file.write_bytes(compressed_data)

    size = initramfs_file.stat().st_size / (1024 * 1024)
    print(f"✅ Initramfs created: {size:.1f}MB")
    print()

    return initramfs_file


def print_summary(initramfs_file: Path) -> None:
    """Print build summary."""
    log_section("VibeCode Root Filesystem Build Complete")
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
    print("  ✅ VirtioFS mount support")
    print("  ✅ Helper scripts (verify-nodejs, quick-start)")
    print("  ✅ User accounts (postgres, redis)")
    print()
    print("Next step:")
    print("  ./scripts/vfkit/05-launch-vibecode-vm.sh")
    print()


def main() -> int:
    """Main entry point."""
    log_section("Creating VibeCode Alpine ARM64 Root Filesystem")
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Node.js Version: {NODE_VERSION}")

    script_dir, rootfs_dir, work_dir = get_vm_dirs()
    print(f"Build Directory: {work_dir}")
    print()

    try:
        if work_dir.exists():
            shutil.rmtree(work_dir)
        work_dir.mkdir(parents=True, exist_ok=True)

        create_directory_structure(work_dir)
        download_and_extract_minirootfs(rootfs_dir, work_dir)
        configure_apk(work_dir)
        download_nodejs(rootfs_dir, work_dir)
        create_config_files(work_dir)
        create_init_script(script_dir, work_dir)
        create_helper_scripts(work_dir)
        initramfs_file = create_initramfs(rootfs_dir, work_dir)
        print_summary(initramfs_file)

        return 0
    except Exception as e:
        log_error(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())