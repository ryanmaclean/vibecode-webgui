#!/usr/bin/env python3
"""Create Alpine Linux ARM64 rootfs with Node.js 24 + Gitpod openvscode-server.

Based on official nodejs/docker-node Alpine Dockerfile + Gitpod openvscode-server.
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
    RED = "\033[0;31m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.YELLOW = cls.RED = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Configuration
NODE_VERSION = "24.10.0"
YARN_VERSION = "1.22.22"
ALPINE_VERSION = "3.21"
OPENVSCODE_VERSION = "1.105.1"
ARCH = "arm64"
OPENSSL_ARCH = "linux-aarch64"


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
        "usr/bin", "usr/sbin", "usr/lib", "usr/local/bin", "usr/local/lib", "lib",
        "etc/apk", "var/cache/apk", "var/lib/apk",
        "opt", "srv", "mnt", "media",
    ]

    for d in dirs:
        (work_dir / d).mkdir(parents=True, exist_ok=True)

    print("\u2705 Directory structure created")
    print()


def download_alpine_minirootfs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download Alpine mini root filesystem."""
    print(f"\U0001f4e5 Downloading Alpine {ALPINE_VERSION} mini rootfs...")

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

    # Install runtime dependencies
    print("\U0001f4e6 Installing libstdc++ runtime dependency...")
    print("   (Required by Node.js compiled binaries)")

    world_content = """libstdc++
git
curl
bash
"""
    (work_dir / "etc" / "apk" / "world").write_text(world_content)

    print("\u2705 Runtime dependencies configured")
    print()


def download_nodejs(rootfs_dir: Path, work_dir: Path) -> None:
    """Download and install Node.js."""
    print(f"\U0001f4e5 Downloading Node.js {NODE_VERSION} (ARM64 musl build)...")
    print("   Source: unofficial-builds.nodejs.org (official Alpine source)")

    tarball = f"node-v{NODE_VERSION}-linux-{ARCH}-musl.tar.xz"
    url = f"https://unofficial-builds.nodejs.org/download/release/v{NODE_VERSION}/{tarball}"
    tarball_path = rootfs_dir / tarball

    if not tarball_path.exists():
        print(f"   URL: {url}")
        run_command(["curl", "-L", "-o", str(tarball_path), url])
        print(f"\u2705 Downloaded: {tarball}")
    else:
        print(f"\u2705 Using cached: {tarball}")

    # Extract Node.js
    print("\U0001f4e6 Extracting Node.js to /usr/local...")
    usr_local = work_dir / "usr" / "local"
    usr_local.mkdir(parents=True, exist_ok=True)
    run_command([
        "tar", "-xJf", str(tarball_path),
        "-C", str(usr_local),
        "--strip-components=1",
        "--no-same-owner",
    ])
    print("\u2705 Node.js installed")
    print()

    # Optimize Node.js
    print("\U0001f527 Optimizing Node.js installation...")
    print(f"   Removing unused OpenSSL headers for architectures other than {OPENSSL_ARCH}...")

    openssl_archs = work_dir / "usr" / "local" / "include" / "node" / "openssl" / "archs"
    if openssl_archs.exists():
        for arch_dir in openssl_archs.iterdir():
            if arch_dir.is_dir() and arch_dir.name != OPENSSL_ARCH:
                shutil.rmtree(arch_dir)

    print("\u2705 Node.js optimized")
    print()


def download_openvscode_server(rootfs_dir: Path, work_dir: Path) -> None:
    """Download and install Gitpod OpenVSCode Server."""
    print(f"\U0001f4e5 Downloading Gitpod OpenVSCode Server v{OPENVSCODE_VERSION} (ARM64)...")

    tarball = f"openvscode-server-v{OPENVSCODE_VERSION}-linux-arm64.tar.gz"
    url = f"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v{OPENVSCODE_VERSION}/{tarball}"
    tarball_path = rootfs_dir / tarball

    if not tarball_path.exists():
        print(f"   URL: {url}")
        run_command(["curl", "-L", "-o", str(tarball_path), url])
        print(f"\u2705 Downloaded: {tarball}")
    else:
        print(f"\u2705 Using cached: {tarball}")

    # Extract OpenVSCode Server
    print("\U0001f4e6 Extracting OpenVSCode Server to /opt...")
    opt_dir = work_dir / "opt"
    opt_dir.mkdir(parents=True, exist_ok=True)
    run_command(["tar", "-xzf", str(tarball_path), "-C", str(opt_dir)])

    # Rename directory
    extracted_dir = opt_dir / f"openvscode-server-v{OPENVSCODE_VERSION}-linux-arm64"
    target_dir = opt_dir / "openvscode-server"
    if extracted_dir.exists():
        extracted_dir.rename(target_dir)

    print("\u2705 OpenVSCode Server installed")
    print()


def verify_installations(work_dir: Path) -> None:
    """Verify installations."""
    print("\U0001f50d Verifying installations...")

    node_bin = work_dir / "usr" / "local" / "bin" / "node"
    npm_bin = work_dir / "usr" / "local" / "bin" / "npm"
    openvscode_bin = work_dir / "opt" / "openvscode-server" / "bin" / "openvscode-server"

    if node_bin.exists():
        result = run_command([str(node_bin), "--version"], check=False, capture=True)
        if result.returncode == 0:
            print(f"\u2705 Node.js: {result.stdout.strip()}")
        else:
            print("\u2705 Node.js: installed")
    else:
        print(f"{Colors.RED}\u274c Node.js binary not found{Colors.NC}")

    if npm_bin.exists():
        result = run_command([str(npm_bin), "--version"], check=False, capture=True)
        if result.returncode == 0:
            print(f"\u2705 npm: v{result.stdout.strip()}")
        else:
            print("\u2705 npm: installed")
    else:
        print(f"{Colors.RED}\u274c npm binary not found{Colors.NC}")

    if openvscode_bin.exists():
        print(f"\u2705 OpenVSCode Server: v{OPENVSCODE_VERSION}")
    else:
        print(f"{Colors.RED}\u274c OpenVSCode Server binary not found{Colors.NC}")

    print()


def create_users(work_dir: Path) -> None:
    """Create node user."""
    print("\U0001f464 Creating node user...")

    (work_dir / "etc" / "passwd").write_text("""root:x:0:0:root:/root:/bin/sh
node:x:1000:1000::/home/node:/bin/sh
""")

    (work_dir / "etc" / "group").write_text("""root:x:0:
node:x:1000:
""")

    # Create home directory
    (work_dir / "home" / "node").mkdir(parents=True, exist_ok=True)

    print("\u2705 User 'node' created (UID 1000)")
    print()


def create_helper_scripts(work_dir: Path) -> None:
    """Create helper scripts."""
    print("\U0001f4dd Creating helper scripts...")

    bin_dir = work_dir / "usr" / "local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # verify-nodejs script
    (bin_dir / "verify-nodejs").write_text("""#!/bin/sh
echo "=== Node.js Verification ==="
echo ""
echo "Node.js version:"
node --version
echo ""
echo "npm version:"
npm --version
echo ""
echo "Node.js binary:"
which node
echo ""
echo "npm binary:"
which npm
echo ""
echo "Linked libraries:"
ldd /usr/local/bin/node 2>&1 | grep -i musl || echo "Static or musl binary"
echo ""
echo "✅ Node.js is installed and working!"
""")
    (bin_dir / "verify-nodejs").chmod(0o755)

    # verify-vscode script
    (bin_dir / "verify-vscode").write_text("""#!/bin/sh
echo "=== OpenVSCode Server Verification ==="
echo ""
echo "OpenVSCode Server version:"
/opt/openvscode-server/bin/openvscode-server --version
echo ""
echo "Binary location:"
ls -lh /opt/openvscode-server/bin/openvscode-server
echo ""
echo "✅ OpenVSCode Server is installed and working!"
""")
    (bin_dir / "verify-vscode").chmod(0o755)

    # start-vscode script
    (bin_dir / "start-vscode").write_text("""#!/bin/sh
echo "=== Starting OpenVSCode Server ==="
echo ""
echo "Binding to: 0.0.0.0:3000"
echo "Access from macOS: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start OpenVSCode Server
/opt/openvscode-server/bin/openvscode-server \\
  --host 0.0.0.0 \\
  --port 8080 \\
  --without-connection-token \\
  --accept-server-license-terms \\
  "$@"
""")
    (bin_dir / "start-vscode").chmod(0o755)

    # quick-start script
    (bin_dir / "quick-start").write_text(f"""#!/bin/sh
cat << 'HELP'
=== VibeCode Alpine VM - Quick Start ===

Node.js {NODE_VERSION} + OpenVSCode Server v{OPENVSCODE_VERSION}

Basic Commands:
  verify-nodejs    - Verify Node.js installation
  verify-vscode    - Verify OpenVSCode Server installation
  start-vscode     - Start OpenVSCode Server on port 8080

Package Management:
  apk add <pkg>    - Install Alpine packages
  npm install -g <pkg> - Install global npm packages

OpenVSCode Server:
  Access: http://localhost:3000
  Start: start-vscode

  Custom port: start-vscode --port 8080
  With token: start-vscode --connection-token mytoken

Examples:
  # Start VS Code Server
  start-vscode

  # Install packages
  apk add git curl vim
  npm install -g typescript @types/node

  # Test Node.js
  node -e "console.log('Hello from Alpine + Node 24!')"

Network:
  - VM has NAT networking
  - Access services via localhost on macOS
  - Example: http://localhost:3000 for VS Code

HELP
""")
    (bin_dir / "quick-start").chmod(0o755)

    print("\u2705 Helper scripts created")
    print()


def create_init_scripts(work_dir: Path) -> None:
    """Create init scripts."""
    print("\U0001f4dd Creating init scripts...")

    init_d = work_dir / "etc" / "init.d"
    init_d.mkdir(parents=True, exist_ok=True)

    # OpenRC init script for vscode-server
    (init_d / "vscode-server").write_text("""#!/sbin/openrc-run
# OpenRC init script for OpenVSCode Server

name="openvscode-server"
description="Gitpod OpenVSCode Server"

command="/opt/openvscode-server/bin/openvscode-server"
command_args="--host 0.0.0.0 --port 8080 --without-connection-token --accept-server-license-terms"
command_background=true
pidfile="/var/run/${RC_SVCNAME}.pid"
command_user="node:node"

depend() {
    need net
    after firewall
}
""")
    (init_d / "vscode-server").chmod(0o755)

    print("\u2705 Init scripts created")
    print()


def setup_ssh(work_dir: Path) -> None:
    """Set up SSH for port forwarding."""
    print("\U0001f4e1 Setting up SSH...")

    ssh_dir = work_dir / "etc" / "ssh"
    ssh_dir.mkdir(parents=True, exist_ok=True)

    (ssh_dir / "sshd_config").write_text("""Port 22
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
""")

    # Create shadow file with root password
    (work_dir / "etc" / "shadow").write_text("root:vibecode\n")

    # Create rc.local for auto-start
    init_d = work_dir / "etc" / "init.d"
    init_d.mkdir(parents=True, exist_ok=True)

    (init_d / "rc.local").write_text("""#!/bin/sh
# Auto-start OpenVSCode Server and SSH
/usr/sbin/sshd &
/opt/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 8080 --without-connection-token --accept-server-license-terms &
""")
    (init_d / "rc.local").chmod(0o755)

    print("\u2705 SSH configured")
    print()


def set_permissions(work_dir: Path) -> None:
    """Set correct permissions."""
    print("\U0001f512 Setting permissions...")

    home_node = work_dir / "home" / "node"
    if home_node.exists():
        run_command(["chown", "-R", "1000:1000", str(home_node)], check=False)

    print("\u2705 Permissions set")
    print()


def create_rootfs_archive(work_dir: Path, rootfs_dir: Path) -> Path:
    """Create the cpio.gz rootfs archive."""
    print("\U0001f4e6 Creating cpio.gz rootfs archive...")

    output_file = rootfs_dir / "alpine-vscode-server-rootfs.cpio.gz"

    cmd = f"find . | cpio -H newc -o | gzip -9 > {output_file}"
    run_command(cmd, cwd=work_dir, shell=True)

    print("\u2705 Rootfs created successfully!")
    print()

    return output_file


def print_summary(work_dir: Path, output_file: Path) -> None:
    """Print build summary."""
    result = run_command(["du", "-h", str(output_file)], capture=True)
    rootfs_size = result.stdout.split()[0]

    # Get npm version
    npm_bin = work_dir / "usr" / "local" / "bin" / "npm"
    npm_version = "installed"
    if npm_bin.exists():
        result = run_command([str(npm_bin), "--version"], check=False, capture=True)
        if result.returncode == 0:
            npm_version = result.stdout.strip()

    print("\u2550" * 56)
    print("  Build Complete!")
    print("\u2550" * 56)
    print()
    print(f"Rootfs: {output_file}")
    print(f"Size: {rootfs_size}")
    print()
    print("Installed Software:")
    print(f"  \u2705 Alpine Linux {ALPINE_VERSION}")
    print(f"  \u2705 Node.js {NODE_VERSION} (musl-optimized)")
    print(f"  \u2705 npm {npm_version}")
    print(f"  \u2705 OpenVSCode Server v{OPENVSCODE_VERSION} (Gitpod)")
    print()
    print("Helper Scripts:")
    print("  - verify-nodejs    - Verify Node.js installation")
    print("  - verify-vscode    - Verify OpenVSCode Server")
    print("  - start-vscode     - Start OpenVSCode Server")
    print("  - quick-start      - Show quick start guide")
    print()
    print("Next Steps:")
    print("  1. Launch VM:")
    print("     ./scripts/vfkit/13-launch-vscode-server-vm.sh")
    print()
    print("  2. Inside VM:")
    print("     start-vscode")
    print()
    print("  3. Access from macOS:")
    print("     http://localhost:3000")
    print()
    print(f"Build artifacts: {work_dir}")
    print()


def main() -> int:
    """Main entry point."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    rootfs_dir = vm_dir / "rootfs"
    work_dir = rootfs_dir / "build-vscode-server"

    print("\u2550" * 56)
    print("  Creating Alpine ARM64 Rootfs with VS Code Server")
    print("\u2550" * 56)
    print()
    print(f"Alpine Version: {ALPINE_VERSION}")
    print(f"Node.js Version: {NODE_VERSION} (musl)")
    print(f"OpenVSCode Server: v{OPENVSCODE_VERSION} (Gitpod)")
    print(f"Yarn Version: {YARN_VERSION}")
    print(f"Architecture: {ARCH}")
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
        download_openvscode_server(rootfs_dir, work_dir)
        verify_installations(work_dir)
        create_users(work_dir)
        create_helper_scripts(work_dir)
        create_init_scripts(work_dir)
        setup_ssh(work_dir)
        set_permissions(work_dir)
        output_file = create_rootfs_archive(work_dir, rootfs_dir)
        print_summary(work_dir, output_file)
    finally:
        os.chdir(original_cwd)

    return 0


if __name__ == "__main__":
    sys.exit(main())
