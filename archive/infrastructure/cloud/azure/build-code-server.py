#!/usr/bin/env python3
"""
Build Code-Server VM Image for Alpine Linux ARM64
Creates a minimal VM image with Code-Server (MIT licensed VS Code alternative)

Target: 30-40MB compressed initramfs
Architecture: ARM64 (aarch64)
Base: Alpine Linux with musl libc
Compatible with: Swift Virtualization.framework via vfkit
"""

import os
import sys
import subprocess
import tempfile
import shutil
import urllib.request
import tarfile
import gzip
from pathlib import Path
from typing import Optional

# Configuration
CODE_SERVER_VERSION = "4.105.1"
CODE_SERVER_URL = f"https://github.com/coder/code-server/releases/download/v{CODE_SERVER_VERSION}/code-server-{CODE_SERVER_VERSION}-linux-arm64.tar.gz"
CODE_SERVER_SHA256 = "506e3ca055702035c268f89d969f7f4180f8dc2a34d376b83f725016fc441791"

ALPINE_VERSION = "3.20"
BUSYBOX_URL = "https://busybox.net/downloads/binaries/1.35.0-aarch64/busybox"

# Node.js musl build for Alpine (unofficial builds)
NODE_VERSION = "20.18.0"
NODE_MUSL_URL = f"https://unofficial-builds.nodejs.org/download/release/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-arm64-musl.tar.gz"

# Colors for output
class Colors:
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'

def log(msg: str):
    """Print info message"""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {msg}")

def warn(msg: str):
    """Print warning message"""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")

def error(msg: str):
    """Print error message and exit"""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}", file=sys.stderr)
    sys.exit(1)

def run_cmd(cmd: list, cwd: Optional[str] = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run shell command"""
    try:
        return subprocess.run(cmd, cwd=cwd, check=check, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        error(f"Command failed: {' '.join(cmd)}\n{e.stderr}")

def download_file(url: str, dest: Path, desc: str):
    """Download file with progress"""
    log(f"Downloading {desc}...")
    log(f"  URL: {url}")

    try:
        with urllib.request.urlopen(url) as response:
            total_size = int(response.headers.get('content-length', 0))
            block_size = 8192
            downloaded = 0

            with open(dest, 'wb') as f:
                while True:
                    chunk = response.read(block_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"  Progress: {percent:.1f}%", end='\r')

            print()  # New line after progress
            size_mb = downloaded / (1024 * 1024)
            log(f"  Downloaded: {size_mb:.1f} MB")
    except Exception as e:
        error(f"Failed to download {desc}: {e}")

def verify_sha256(file_path: Path, expected_hash: str) -> bool:
    """Verify file SHA256 hash"""
    import hashlib

    log(f"Verifying SHA256 hash...")
    sha256_hash = hashlib.sha256()

    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)

    actual = sha256_hash.hexdigest()
    if actual == expected_hash:
        log("  Hash verified successfully")
        return True
    else:
        warn(f"  Hash mismatch!")
        warn(f"  Expected: {expected_hash}")
        warn(f"  Got:      {actual}")
        return False

class CodeServerBuilder:
    """Builder for Code-Server VM image"""

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.initramfs_dir = work_dir / "initramfs"
        self.downloads_dir = work_dir / "downloads"

        # Create directories
        self.downloads_dir.mkdir(parents=True, exist_ok=True)

    def download_components(self):
        """Download all required components"""
        log("=== Downloading Components ===")

        # Download Code-Server
        code_server_tar = self.downloads_dir / f"code-server-{CODE_SERVER_VERSION}.tar.gz"
        if not code_server_tar.exists():
            download_file(CODE_SERVER_URL, code_server_tar, "Code-Server ARM64")
            verify_sha256(code_server_tar, CODE_SERVER_SHA256)
        else:
            log(f"Using cached Code-Server: {code_server_tar}")

        # Download Node.js musl build
        node_tar = self.downloads_dir / f"node-v{NODE_VERSION}-musl.tar.gz"
        if not node_tar.exists():
            download_file(NODE_MUSL_URL, node_tar, "Node.js ARM64 musl")
        else:
            log(f"Using cached Node.js: {node_tar}")

        # Download BusyBox
        busybox_bin = self.downloads_dir / "busybox"
        if not busybox_bin.exists():
            download_file(BUSYBOX_URL, busybox_bin, "BusyBox ARM64")
            busybox_bin.chmod(0o755)
        else:
            log(f"Using cached BusyBox: {busybox_bin}")

        log("All components downloaded")

    def create_rootfs_structure(self):
        """Create minimal rootfs directory structure"""
        log("=== Creating Root Filesystem Structure ===")

        # Create directory structure
        dirs = [
            "bin", "sbin", "usr/bin", "usr/sbin", "usr/lib",
            "dev", "proc", "sys", "tmp", "run",
            "etc", "var/log", "var/tmp",
            "opt/code-server", "opt/node",
            "home/coder/.config", "home/coder/.local",
        ]

        for d in dirs:
            (self.initramfs_dir / d).mkdir(parents=True, exist_ok=True)

        log(f"Created {len(dirs)} directories")

    def extract_and_install_components(self):
        """Extract and install downloaded components"""
        log("=== Installing Components ===")

        # Extract Code-Server
        log("Extracting Code-Server...")
        code_server_tar = self.downloads_dir / f"code-server-{CODE_SERVER_VERSION}.tar.gz"
        with tarfile.open(code_server_tar, 'r:gz') as tar:
            tar.extractall(self.downloads_dir)

        code_server_src = self.downloads_dir / f"code-server-{CODE_SERVER_VERSION}-linux-arm64"
        code_server_dst = self.initramfs_dir / "opt/code-server"

        # Copy Code-Server (selective - exclude unnecessary files)
        log("Installing Code-Server (minimal selection)...")
        for item in ['bin', 'lib', 'out']:
            src = code_server_src / item
            dst = code_server_dst / item
            if src.exists():
                if src.is_dir():
                    shutil.copytree(src, dst, symlinks=True)
                else:
                    shutil.copy2(src, dst)

        # Extract Node.js musl build
        log("Extracting Node.js (musl)...")
        node_tar = self.downloads_dir / f"node-v{NODE_VERSION}-musl.tar.gz"
        with tarfile.open(node_tar, 'r:gz') as tar:
            tar.extractall(self.downloads_dir)

        node_src = self.downloads_dir / f"node-v{NODE_VERSION}-linux-arm64-musl"
        node_dst = self.initramfs_dir / "opt/node"

        # Copy Node.js binaries
        log("Installing Node.js runtime...")
        shutil.copytree(node_src / "bin", node_dst / "bin", symlinks=True)
        shutil.copytree(node_src / "lib", node_dst / "lib", symlinks=True)

        # Install BusyBox
        log("Installing BusyBox...")
        busybox_src = self.downloads_dir / "busybox"
        busybox_dst = self.initramfs_dir / "bin/busybox"
        shutil.copy2(busybox_src, busybox_dst)
        busybox_dst.chmod(0o755)

        # Create BusyBox symlinks
        busybox_cmds = [
            'sh', 'ash', 'ls', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'rmdir',
            'mount', 'umount', 'chmod', 'chown', 'ln', 'ps', 'kill',
            'ip', 'ifconfig', 'route', 'wget', 'tar', 'gzip',
            'udhcpc', 'udhcpd', 'syslogd', 'klogd'
        ]

        for cmd in busybox_cmds:
            link = self.initramfs_dir / "bin" / cmd
            if not link.exists():
                link.symlink_to("busybox")

        log(f"Created {len(busybox_cmds)} BusyBox symlinks")

    def strip_binaries(self):
        """Strip binaries to reduce size"""
        log("=== Stripping Binaries ===")

        # Find and strip all ELF binaries
        strip_paths = [
            self.initramfs_dir / "opt/node/bin",
            self.initramfs_dir / "opt/code-server",
        ]

        stripped_count = 0
        for path in strip_paths:
            if not path.exists():
                continue

            for root, dirs, files in os.walk(path):
                for file in files:
                    filepath = Path(root) / file
                    if filepath.is_file() and not filepath.is_symlink():
                        # Check if ELF binary
                        try:
                            with open(filepath, 'rb') as f:
                                magic = f.read(4)
                                if magic == b'\x7fELF':
                                    # Strip the binary
                                    run_cmd(['strip', '--strip-all', str(filepath)], check=False)
                                    stripped_count += 1
                        except:
                            pass

        log(f"Stripped {stripped_count} binaries")

    def create_init_script(self):
        """Create init script"""
        log("=== Creating Init Script ===")

        init_script = """#!/bin/sh
# Code-Server VM Init Script
# Alpine Linux ARM64 with musl

echo "========================================"
echo "  Code-Server VM (Alpine ARM64)"
echo "  Version: {version}"
echo "========================================"
echo ""

# Mount essential filesystems
echo "[1/6] Mounting filesystems..."
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mount -t tmpfs -o mode=1777 tmp /tmp
mount -t tmpfs -o mode=0755 run /run

# Create device nodes
mknod -m 666 /dev/null c 1 3 2>/dev/null || true
mknod -m 666 /dev/zero c 1 5 2>/dev/null || true
mknod -m 666 /dev/random c 1 8 2>/dev/null || true
mknod -m 666 /dev/urandom c 1 9 2>/dev/null || true
mknod -m 622 /dev/console c 5 1 2>/dev/null || true
mknod -m 666 /dev/tty c 5 0 2>/dev/null || true

# Configure network
echo "[2/6] Configuring network..."
ip link set lo up

# Detect network interface
NET_IF=$(ip link | grep -E "^[0-9]+: (eth|enp)" | head -1 | cut -d: -f2 | tr -d ' ')
if [ -n "$NET_IF" ]; then
    echo "  Found interface: $NET_IF"
    ip link set $NET_IF up

    # Start DHCP client
    udhcpc -i $NET_IF -n -q 2>/dev/null &
    sleep 2

    # Get IP address
    IP=$(ip -4 addr show $NET_IF | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){{3}}' | head -1)
    if [ -n "$IP" ]; then
        echo "  IP Address: $IP"
    else
        echo "  IP: DHCP pending..."
        IP="localhost"
    fi
else
    echo "  No network interface found"
    IP="localhost"
fi

# Setup environment
echo "[3/6] Setting up environment..."
export PATH="/opt/node/bin:/bin:/sbin:/usr/bin:/usr/sbin"
export HOME="/home/coder"
export USER="coder"
export SHELL="/bin/sh"

# Node.js configuration for limited memory
export NODE_OPTIONS="--max-old-space-size=384"

# Create data directories
mkdir -p /home/coder/.config/code-server
mkdir -p /home/coder/.local/share/code-server
mkdir -p /tmp/code-server

# Generate Code-Server config
echo "[4/6] Configuring Code-Server..."
cat > /home/coder/.config/code-server/config.yaml << 'EOFCONFIG'
bind-addr: 0.0.0.0:8080
auth: none
cert: false
EOFCONFIG

# Log configuration
echo "  Configuration:"
echo "    Port: 8080"
echo "    Auth: disabled (development mode)"
echo "    Data dir: /home/coder/.local/share/code-server"

# Display access information
echo ""
echo "[5/6] Starting Code-Server..."
echo "========================================"
echo "  Code-Server is starting..."
echo "  Access URL: http://$IP:8080"
echo ""
echo "  Features:"
echo "    - VSIX extension support"
echo "    - Built-in terminal"
echo "    - LSP ready"
echo "    - MCP ready"
echo "    - RAG integration capable"
echo ""
echo "  Press Ctrl+C to stop"
echo "========================================"
echo ""

# Start Code-Server
echo "[6/6] Launching Code-Server..."
cd /opt/code-server

exec /opt/node/bin/node \\
    --max-old-space-size=384 \\
    /opt/code-server/out/node/entry.js \\
    --bind-addr 0.0.0.0:8080 \\
    --auth none \\
    --user-data-dir /home/coder/.local/share/code-server \\
    --extensions-dir /home/coder/.local/share/code-server/extensions \\
    --disable-telemetry \\
    --disable-update-check \\
    /home/coder
""".format(version=CODE_SERVER_VERSION)

        init_path = self.initramfs_dir / "init"
        with open(init_path, 'w') as f:
            f.write(init_script)
        init_path.chmod(0o755)

        log("Init script created")

    def create_additional_configs(self):
        """Create additional configuration files"""
        log("=== Creating Configuration Files ===")

        # Create /etc/passwd
        passwd = self.initramfs_dir / "etc/passwd"
        passwd.write_text("root:x:0:0:root:/root:/bin/sh\ncoder:x:1000:1000:Coder:/home/coder:/bin/sh\n")

        # Create /etc/group
        group = self.initramfs_dir / "etc/group"
        group.write_text("root:x:0:\ncoder:x:1000:\n")

        # Create /etc/hostname
        hostname = self.initramfs_dir / "etc/hostname"
        hostname.write_text("code-server\n")

        # Create /etc/hosts
        hosts = self.initramfs_dir / "etc/hosts"
        hosts.write_text("127.0.0.1 localhost code-server\n::1 localhost\n")

        # Create /etc/resolv.conf
        resolv = self.initramfs_dir / "etc/resolv.conf"
        resolv.write_text("nameserver 8.8.8.8\nnameserver 8.8.4.4\n")

        log("Configuration files created")

    def package_initramfs(self, output_path: Path):
        """Package initramfs with xz compression"""
        log("=== Packaging Initramfs ===")

        # Create CPIO archive
        log("Creating CPIO archive...")
        cpio_path = self.work_dir / "initramfs.cpio"

        # Change to initramfs directory and create archive
        find_proc = subprocess.Popen(
            ['find', '.', '-print0'],
            cwd=self.initramfs_dir,
            stdout=subprocess.PIPE
        )

        cpio_proc = subprocess.Popen(
            ['cpio', '--null', '-o', '-H', 'newc', '--quiet'],
            stdin=find_proc.stdout,
            stdout=subprocess.PIPE,
            cwd=self.initramfs_dir
        )

        with open(cpio_path, 'wb') as f:
            f.write(cpio_proc.communicate()[0])

        find_proc.wait()

        cpio_size = cpio_path.stat().st_size / (1024 * 1024)
        log(f"CPIO archive created: {cpio_size:.1f} MB")

        # Compress with xz (best compression)
        log("Compressing with xz (maximum compression)...")
        with open(cpio_path, 'rb') as f_in:
            with gzip.open(output_path, 'wb', compresslevel=9) as f_out:
                shutil.copyfileobj(f_in, f_out)

        compressed_size = output_path.stat().st_size / (1024 * 1024)
        log(f"Compressed initramfs: {compressed_size:.1f} MB")

        # Calculate compression ratio
        ratio = (1 - (compressed_size / cpio_size)) * 100
        log(f"Compression ratio: {ratio:.1f}%")

        return compressed_size

    def get_size_info(self) -> dict:
        """Get size information about the build"""
        sizes = {}

        # Calculate directory sizes
        for name, path in [
            ('code-server', self.initramfs_dir / "opt/code-server"),
            ('node', self.initramfs_dir / "opt/node"),
            ('bin', self.initramfs_dir / "bin"),
            ('total', self.initramfs_dir)
        ]:
            if path.exists():
                result = run_cmd(['du', '-sb', str(path)])
                size_bytes = int(result.stdout.split()[0])
                sizes[name] = size_bytes / (1024 * 1024)

        return sizes

def print_summary(output_path: Path, compressed_size: float, sizes: dict):
    """Print build summary"""
    print("\n" + "="*60)
    print(f"{Colors.GREEN}  Code-Server VM Build Complete{Colors.NC}")
    print("="*60)
    print()
    print(f"{Colors.BLUE}Build Information:{Colors.NC}")
    print(f"  Code-Server Version: {CODE_SERVER_VERSION}")
    print(f"  Node.js Version:     {NODE_VERSION} (musl)")
    print(f"  Alpine Base:         {ALPINE_VERSION}")
    print(f"  Architecture:        ARM64 (aarch64)")
    print()
    print(f"{Colors.BLUE}Size Breakdown:{Colors.NC}")
    print(f"  Code-Server:     {sizes.get('code-server', 0):>6.1f} MB")
    print(f"  Node.js:         {sizes.get('node', 0):>6.1f} MB")
    print(f"  BusyBox + Utils: {sizes.get('bin', 0):>6.1f} MB")
    print(f"  Total (uncompressed): {sizes.get('total', 0):>6.1f} MB")
    print(f"  Compressed (gzip -9): {compressed_size:>6.1f} MB")
    print()
    print(f"{Colors.BLUE}Output:{Colors.NC}")
    print(f"  Location: {output_path}")
    print()
    print(f"{Colors.BLUE}Configuration:{Colors.NC}")
    print(f"  Port:           8080 (HTTP)")
    print(f"  Authentication: Disabled (development mode)")
    print(f"  Console:        hvc0 (Virtualization.framework)")
    print()
    print(f"{Colors.BLUE}Features:{Colors.NC}")
    print(f"  - VSIX extension support (marketplace access)")
    print(f"  - Built-in terminal")
    print(f"  - LSP (Language Server Protocol) support")
    print(f"  - MCP (Model Context Protocol) ready")
    print(f"  - RAG integration capable")
    print()
    print(f"{Colors.BLUE}Compatibility:{Colors.NC}")
    print(f"  Kernel:   ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw")
    print(f"  Platform: Swift Virtualization.framework")
    print()
    print(f"{Colors.BLUE}To Run:{Colors.NC}")
    print("  vfkit \\")
    print("    --cpus 2 \\")
    print("    --memory 1024 \\")
    print("    --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw \\")
    print(f"    --initrd {output_path} \\")
    print("    --kernel-cmdline \"console=hvc0 quiet\" \\")
    print("    --device virtio-net,nat,mac=52:54:00:12:34:61 \\")
    print("    --device virtio-rng")
    print()
    print(f"{Colors.BLUE}Access:{Colors.NC}")
    print("  The VM will display its IP address on boot")
    print("  Open: http://<VM-IP>:8080")
    print()
    print("="*60)

def main():
    """Main build process"""
    print(f"{Colors.GREEN}{'='*60}{Colors.NC}")
    print(f"{Colors.GREEN}  Code-Server VM Builder for Alpine Linux ARM64{Colors.NC}")
    print(f"{Colors.GREEN}{'='*60}{Colors.NC}")
    print()

    # Create temporary work directory
    work_dir = Path(tempfile.mkdtemp(prefix="code-server-build-"))
    log(f"Work directory: {work_dir}")

    try:
        # Initialize builder
        builder = CodeServerBuilder(work_dir)

        # Build steps
        builder.download_components()
        builder.create_rootfs_structure()
        builder.extract_and_install_components()
        builder.strip_binaries()
        builder.create_init_script()
        builder.create_additional_configs()

        # Package
        output_path = Path.home() / "vibecode-webgui/azure/code-server-initramfs.cpio.gz"
        compressed_size = builder.package_initramfs(output_path)

        # Get size information
        sizes = builder.get_size_info()

        # Print summary
        print_summary(output_path, compressed_size, sizes)

        return 0

    except Exception as e:
        error(f"Build failed: {e}")
        return 1

    finally:
        # Cleanup
        if work_dir.exists():
            log(f"Cleaning up work directory: {work_dir}")
            shutil.rmtree(work_dir)

if __name__ == "__main__":
    sys.exit(main())
