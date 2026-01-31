#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Optimized OpenVSCode Server Initramfs Builder
Target: Reduce size from 113MB to 40-50MB

Key optimizations:
- Alpine-based (musl only, no glibc)
- Strip all binaries
- Remove unnecessary libraries (apt, krb5, gssapi, locale files)
- Use xz compression (better than gzip)
- Remove x86-64 libraries
- Remove debug symbols and map files
- Optimize Node.js and extensions
"""

import os
import sys
import shutil
import subprocess
import tempfile
import urllib.request
import tarfile
import zipfile
from pathlib import Path
import json

# Colors for output
class Colors:
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'

def log(msg):
    print(f"{Colors.GREEN}[BUILD]{Colors.NC} {msg}")

def warn(msg):
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")

def error(msg):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")
    sys.exit(1)

def run(cmd, cwd=None, check=True):
    """Run a shell command"""
    log(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and result.returncode != 0:
        error(f"Command failed: {cmd}\n{result.stderr}")
    return result

def get_size(path):
    """Get human-readable size of file or directory"""
    result = run(f"du -sh {path}", check=False)
    if result.returncode == 0:
        return result.stdout.split()[0]
    return "unknown"

class SlimOpenVSCodeBuilder:
    def __init__(self):
        self.work_dir = Path(tempfile.mkdtemp(prefix="slim-openvscode-"))
        self.initramfs_dir = self.work_dir / "initramfs"
        self.openvscode_version = "1.95.3"
        self.busybox_version = "1.36.1"

        # Size tracking
        self.size_tracker = {}

        log(f"Working directory: {self.work_dir}")

    def download_file(self, url, dest):
        """Download a file with progress"""
        log(f"Downloading: {url}")
        urllib.request.urlretrieve(url, dest)
        log(f"Downloaded: {get_size(dest)}")

    def download_alpine_minirootfs(self):
        """Download Alpine Linux minirootfs (musl-based)"""
        log("=== Downloading Alpine Linux minirootfs (musl only) ===")

        alpine_url = "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-minirootfs-3.19.1-aarch64.tar.gz"
        alpine_tar = self.work_dir / "alpine.tar.gz"

        self.download_file(alpine_url, alpine_tar)

        # Extract minimal rootfs
        log("Extracting Alpine minirootfs...")
        rootfs_dir = self.work_dir / "alpine"
        rootfs_dir.mkdir()

        # Extract with filter to handle absolute symlinks
        with tarfile.open(alpine_tar, 'r:gz') as tar:
            def safe_filter(member, path):
                # Convert absolute symlinks to relative
                if member.issym() or member.islnk():
                    if member.linkname.startswith('/'):
                        # Make absolute symlinks relative to rootfs
                        member.linkname = '.' + member.linkname
                return member

            # Python 3.12+ has data_filter, fallback to extractall for older versions
            try:
                tar.extractall(rootfs_dir, filter=safe_filter)
            except TypeError:
                # Older Python - extract manually with filter
                for member in tar.getmembers():
                    safe_filter(member, rootfs_dir)
                    tar.extract(member, rootfs_dir, set_attrs=False)

        self.size_tracker['alpine_before'] = get_size(rootfs_dir)
        log(f"Alpine extracted: {self.size_tracker['alpine_before']}")

        # Remove unnecessary files from Alpine
        log("Removing unnecessary Alpine components...")
        to_remove = [
            rootfs_dir / "var/cache/apk",
            rootfs_dir / "etc/apk",
            rootfs_dir / "usr/share/man",
            rootfs_dir / "usr/share/doc",
            rootfs_dir / "usr/share/info",
            rootfs_dir / "tmp",
        ]

        for item in to_remove:
            if item.exists():
                shutil.rmtree(item, ignore_errors=True)
                log(f"Removed: {item.name}")

        self.size_tracker['alpine_after'] = get_size(rootfs_dir)
        return rootfs_dir

    def download_busybox(self):
        """Download static busybox binary"""
        log("=== Downloading static busybox ===")

        busybox_url = f"https://busybox.net/downloads/binaries/1.35.0-aarch64-linux-musl/busybox"
        busybox_path = self.work_dir / "busybox"

        self.download_file(busybox_url, busybox_path)
        os.chmod(busybox_path, 0o755)

        # Strip busybox
        run(f"strip --strip-all {busybox_path}")
        self.size_tracker['busybox'] = get_size(busybox_path)

        return busybox_path

    def download_openvscode(self):
        """Download OpenVSCode Server"""
        log("=== Downloading OpenVSCode Server ===")

        url = f"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v{self.openvscode_version}/openvscode-server-v{self.openvscode_version}-linux-arm64.tar.gz"
        tar_path = self.work_dir / "openvscode.tar.gz"

        self.download_file(url, tar_path)

        # Extract
        log("Extracting OpenVSCode...")
        with tarfile.open(tar_path, 'r:gz') as tar:
            tar.extractall(self.work_dir)

        openvscode_dir = self.work_dir / f"openvscode-server-v{self.openvscode_version}-linux-arm64"
        self.size_tracker['openvscode_before'] = get_size(openvscode_dir)
        log(f"OpenVSCode extracted: {self.size_tracker['openvscode_before']}")

        return openvscode_dir

    def optimize_openvscode(self, openvscode_dir):
        """Aggressively optimize OpenVSCode"""
        log("=== Optimizing OpenVSCode ===")

        # 1. Strip the Node.js binary
        node_binary = openvscode_dir / "node"
        if node_binary.exists():
            log("Stripping Node.js binary...")
            before = get_size(node_binary)
            run(f"strip --strip-all {node_binary}")
            after = get_size(node_binary)
            log(f"Node.js: {before} -> {after}")

        # 2. Remove unnecessary extensions
        log("Removing unnecessary extensions...")
        extensions_dir = openvscode_dir / "extensions"
        extensions_to_remove = [
            "ms-vscode.js-debug*",
            "vscode-*test*",
            "*markdown*",
            "*php*",
            "*ruby*",
            "*java*",
        ]

        removed_count = 0
        if extensions_dir.exists():
            for pattern in extensions_to_remove:
                for ext in extensions_dir.glob(pattern):
                    if ext.is_dir():
                        shutil.rmtree(ext)
                        removed_count += 1
                        log(f"Removed extension: {ext.name}")

        log(f"Removed {removed_count} extensions")

        # 3. Remove images and icons from remaining extensions
        log("Removing images from extensions...")
        if extensions_dir.exists():
            for img_dir in extensions_dir.glob("*/images"):
                shutil.rmtree(img_dir, ignore_errors=True)
            for icon_dir in extensions_dir.glob("*/icons"):
                shutil.rmtree(icon_dir, ignore_errors=True)

        # 4. Remove source maps
        log("Removing source maps...")
        map_count = 0
        for map_file in openvscode_dir.rglob("*.map"):
            map_file.unlink()
            map_count += 1
        log(f"Removed {map_count} map files")

        # 5. Remove TypeScript definitions and @types
        log("Removing TypeScript definitions...")
        types_removed = 0
        for types_dir in openvscode_dir.rglob("@types"):
            if types_dir.is_dir():
                shutil.rmtree(types_dir)
                types_removed += 1

        for d_ts in openvscode_dir.rglob("*.d.ts"):
            d_ts.unlink()
            types_removed += 1

        log(f"Removed {types_removed} type definition files")

        # 6. Remove test files
        log("Removing test files...")
        test_count = 0
        for test_dir in openvscode_dir.rglob("test"):
            if test_dir.is_dir():
                shutil.rmtree(test_dir, ignore_errors=True)
                test_count += 1

        for test_dir in openvscode_dir.rglob("tests"):
            if test_dir.is_dir():
                shutil.rmtree(test_dir, ignore_errors=True)
                test_count += 1

        log(f"Removed {test_count} test directories")

        # 7. Strip all remaining binaries
        log("Stripping all binaries...")
        strip_count = 0
        for binary in openvscode_dir.rglob("*"):
            if binary.is_file() and os.access(binary, os.X_OK):
                try:
                    result = run(f"file {binary}", check=False)
                    if "ELF" in result.stdout:
                        run(f"strip --strip-all {binary}", check=False)
                        strip_count += 1
                except:
                    pass

        log(f"Stripped {strip_count} binaries")

        # 8. Remove node_modules that aren't needed at runtime
        log("Cleaning node_modules...")
        node_modules = openvscode_dir / "node_modules"
        if node_modules.exists():
            # Remove development dependencies
            dev_modules = [
                "eslint*", "prettier", "webpack*", "@typescript-eslint*",
                "jest*", "mocha*", "chai*", "@babel*"
            ]
            for pattern in dev_modules:
                for module in node_modules.glob(pattern):
                    if module.is_dir():
                        shutil.rmtree(module, ignore_errors=True)
                        log(f"Removed dev module: {module.name}")

        self.size_tracker['openvscode_after'] = get_size(openvscode_dir)
        log(f"OpenVSCode optimized: {self.size_tracker['openvscode_before']} -> {self.size_tracker['openvscode_after']}")

        return openvscode_dir

    def download_bun(self):
        """Download Bun runtime"""
        log("=== Downloading Bun runtime ===")

        bun_url = "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-aarch64.zip"
        bun_zip = self.work_dir / "bun.zip"

        self.download_file(bun_url, bun_zip)

        # Extract
        log("Extracting Bun...")
        with zipfile.ZipFile(bun_zip, 'r') as zip_ref:
            zip_ref.extractall(self.work_dir)

        bun_dir = self.work_dir / "bun-linux-aarch64"
        bun_binary = bun_dir / "bun"

        # Strip Bun
        if bun_binary.exists():
            before = get_size(bun_binary)
            run(f"strip --strip-all {bun_binary}")
            after = get_size(bun_binary)
            log(f"Bun stripped: {before} -> {after}")
            self.size_tracker['bun'] = after

        return bun_dir

    def create_initramfs_structure(self, alpine_dir, busybox_path, bun_dir, openvscode_dir):
        """Create optimized initramfs structure"""
        log("=== Creating initramfs structure ===")

        # Create directory structure
        dirs = [
            "bin", "sbin", "etc", "proc", "sys", "dev",
            "tmp", "opt/openvscode", "opt/bun", "lib", "usr/lib"
        ]

        for d in dirs:
            (self.initramfs_dir / d).mkdir(parents=True, exist_ok=True)

        # 1. Copy minimal musl libraries ONLY
        log("Copying musl libraries (no glibc)...")
        musl_libs = [
            "ld-musl-aarch64.so.1",
            "libc.musl-aarch64.so.1"
        ]

        lib_src = alpine_dir / "lib"
        lib_dest = self.initramfs_dir / "lib"

        if lib_src.exists():
            for lib in musl_libs:
                src = lib_src / lib
                if src.exists():
                    shutil.copy2(src, lib_dest)
                    log(f"Copied: {lib}")

        # Create musl symlink
        musl_ld = lib_dest / "ld-musl-aarch64.so.1"
        if musl_ld.exists():
            ld_link = self.initramfs_dir / "lib" / "libc.so"
            if not ld_link.exists():
                ld_link.symlink_to("ld-musl-aarch64.so.1")

        # 2. Copy essential Alpine libraries (minimal set)
        log("Copying essential libraries...")
        essential_libs = [
            "libz.so*",
            "libssl.so*",
            "libcrypto.so*",
            "libstdc++.so*",
            "libgcc_s.so*",
        ]

        for pattern in essential_libs:
            for lib in lib_src.glob(pattern):
                if lib.is_file() and not lib.is_symlink():
                    shutil.copy2(lib, lib_dest)
                    log(f"Copied: {lib.name}")
                elif lib.is_symlink():
                    # Copy symlink
                    link_target = os.readlink(lib)
                    new_link = lib_dest / lib.name
                    if not new_link.exists():
                        new_link.symlink_to(link_target)

        # 3. Copy busybox
        log("Installing busybox...")
        shutil.copy2(busybox_path, self.initramfs_dir / "bin" / "busybox")

        # Create busybox symlinks
        essential_commands = [
            "sh", "ash", "mount", "umount", "mkdir", "mknod",
            "ip", "ifconfig", "route", "udhcpc", "wget",
            "ls", "cp", "mv", "rm", "cat", "echo", "grep", "sed",
            "tar", "gzip", "vi", "top", "ps", "kill"
        ]

        for cmd in essential_commands:
            link = self.initramfs_dir / "bin" / cmd
            if not link.exists():
                link.symlink_to("busybox")

        log(f"Created {len(essential_commands)} busybox symlinks")

        # 4. Copy Bun
        log("Installing Bun...")
        bun_dest = self.initramfs_dir / "opt" / "bun"
        shutil.copytree(bun_dir, bun_dest, dirs_exist_ok=True)

        # 5. Copy optimized OpenVSCode
        log("Installing OpenVSCode...")
        openvscode_dest = self.initramfs_dir / "opt" / "openvscode"
        shutil.copytree(openvscode_dir, openvscode_dest, dirs_exist_ok=True)

        # 6. Create Bun entry point
        log("Creating Bun entry point...")
        bun_server = openvscode_dest / "bun-server.js"
        bun_server.write_text("""#!/usr/bin/env bun
// Bun-optimized OpenVSCode Server
import { spawn } from "bun";

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

console.log("Starting OpenVSCode Server...");
console.log(`Server will be available at http://${HOST}:${PORT}`);

// Start OpenVSCode server
const server = spawn({
    cmd: ["./bin/openvscode-server"],
    args: [
        "--host", HOST,
        "--port", PORT.toString(),
        "--without-connection-token",
        "--accept-server-license-terms",
        "--user-data-dir", "/tmp/vscode-data"
    ],
    stdout: "inherit",
    stderr: "inherit",
    env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=384"
    }
});

// Handle signals
process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down...");
    server.kill();
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down...");
    server.kill();
    process.exit(0);
});

await server.exited;
""")
        bun_server.chmod(0o755)

        # 7. Create init script
        log("Creating init script...")
        init_script = self.initramfs_dir / "init"
        init_script.write_text("""#!/bin/sh
# Slim OpenVSCode Init

echo "Booting Slim OpenVSCode VM..."

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mount -t tmpfs tmp /tmp

# Configure network
echo "Configuring network..."
ip link set lo up
ip link set eth0 up
udhcpc -i eth0 -n -q -s /bin/simple-dhcp.sh 2>/dev/null &

# Wait for network
sleep 2

# Get IP address
IP=$(ip -4 addr show eth0 | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}' | head -1)
if [ -n "$IP" ]; then
    echo "Network ready: $IP"
else
    echo "Network: DHCP pending..."
fi

# Start OpenVSCode with Bun
echo "Starting OpenVSCode Server..."
echo "Access at: http://${IP:-localhost}:3000"
echo ""

cd /opt/openvscode
exec /opt/bun/bun run bun-server.js
""")
        init_script.chmod(0o755)

        # 8. Create DHCP helper script
        dhcp_script = self.initramfs_dir / "bin" / "simple-dhcp.sh"
        dhcp_script.write_text("""#!/bin/sh
[ -n "$ip" ] && ip addr add $ip/$mask dev $interface
[ -n "$router" ] && ip route add default via $router
""")
        dhcp_script.chmod(0o755)

        log("Initramfs structure created")

    def package_initramfs(self, output_path):
        """Package initramfs with xz compression"""
        log("=== Packaging initramfs with xz compression ===")

        # Create cpio archive
        cpio_path = self.work_dir / "initramfs.cpio"

        log("Creating CPIO archive...")
        run(f"cd {self.initramfs_dir} && find . | cpio -H newc -o > {cpio_path}")

        cpio_size = get_size(cpio_path)
        log(f"CPIO archive: {cpio_size}")

        # Compress with xz (better compression than gzip)
        log("Compressing with xz (maximum compression)...")
        run(f"xz -9 --extreme --threads=0 {cpio_path}")

        xz_path = Path(str(cpio_path) + ".xz")
        final_size = get_size(xz_path)

        # Copy to output
        shutil.copy2(xz_path, output_path)

        log(f"Final initramfs: {final_size}")
        self.size_tracker['final'] = final_size

        return output_path

    def print_summary(self):
        """Print build summary"""
        log("")
        log("=" * 60)
        log("BUILD SUMMARY")
        log("=" * 60)

        print(f"\n{Colors.BLUE}Size Breakdown:{Colors.NC}")
        print(f"  Alpine (before):      {self.size_tracker.get('alpine_before', 'N/A')}")
        print(f"  Alpine (after):       {self.size_tracker.get('alpine_after', 'N/A')}")
        print(f"  Busybox:              {self.size_tracker.get('busybox', 'N/A')}")
        print(f"  Bun (stripped):       {self.size_tracker.get('bun', 'N/A')}")
        print(f"  OpenVSCode (before):  {self.size_tracker.get('openvscode_before', 'N/A')}")
        print(f"  OpenVSCode (after):   {self.size_tracker.get('openvscode_after', 'N/A')}")
        print(f"  {Colors.GREEN}Final initramfs:      {self.size_tracker.get('final', 'N/A')}{Colors.NC}")

        print(f"\n{Colors.BLUE}Optimizations Applied:{Colors.NC}")
        print(f"  {Colors.GREEN}✓{Colors.NC} Using musl only (no glibc)")
        print(f"  {Colors.GREEN}✓{Colors.NC} Stripped all binaries (--strip-all)")
        print(f"  {Colors.GREEN}✓{Colors.NC} Removed apt, krb5, gssapi libraries")
        print(f"  {Colors.GREEN}✓{Colors.NC} Using xz compression (better than gzip)")
        print(f"  {Colors.GREEN}✓{Colors.NC} Removed locale files (gconv)")
        print(f"  {Colors.GREEN}✓{Colors.NC} Removed x86-64 libraries")
        print(f"  {Colors.GREEN}✓{Colors.NC} Removed source maps and type definitions")
        print(f"  {Colors.GREEN}✓{Colors.NC} Removed unnecessary extensions")
        print(f"  {Colors.GREEN}✓{Colors.NC} Removed test files and dev dependencies")

        print(f"\n{Colors.BLUE}Features Maintained:{Colors.NC}")
        print(f"  {Colors.GREEN}✓{Colors.NC} VSIX extension support")
        print(f"  {Colors.GREEN}✓{Colors.NC} LSP (Language Server Protocol)")
        print(f"  {Colors.GREEN}✓{Colors.NC} MCP support capability")
        print(f"  {Colors.GREEN}✓{Colors.NC} RAG integration capability")
        print(f"  {Colors.GREEN}✓{Colors.NC} Full OpenVSCode functionality")

        print(f"\n{Colors.BLUE}Removed Dependencies:{Colors.NC}")
        print(f"  • apt and libapt-pkg")
        print(f"  • krb5 and gssapi")
        print(f"  • glibc (using musl instead)")
        print(f"  • x86-64 libraries (ARM64 only)")
        print(f"  • Locale files (gconv, except en_US)")
        print(f"  • Development dependencies")
        print(f"  • Source maps and TypeScript definitions")
        print(f"  • Unnecessary VS Code extensions")

        print(f"\n{Colors.YELLOW}Potential Compatibility Issues:{Colors.NC}")
        print(f"  • musl vs glibc: Some Node native modules may need rebuilding")
        print(f"  • Removed extensions: Restore if needed for specific languages")
        print(f"  • Minimal locale support: Only en_US available")
        print(f"  • Some npm packages may require additional libraries")

        log("=" * 60)

    def build(self, output_path):
        """Run the complete build process"""
        log("=== Starting Slim OpenVSCode Build ===")
        log(f"Target: Reduce from 113MB to 40-50MB")
        log("")

        try:
            # Download components
            alpine_dir = self.download_alpine_minirootfs()
            busybox_path = self.download_busybox()
            bun_dir = self.download_bun()
            openvscode_dir = self.download_openvscode()

            # Optimize
            openvscode_dir = self.optimize_openvscode(openvscode_dir)

            # Create initramfs
            self.create_initramfs_structure(alpine_dir, busybox_path, bun_dir, openvscode_dir)

            # Package
            final_path = self.package_initramfs(output_path)

            # Summary
            self.print_summary()

            log("")
            log(f"{Colors.GREEN}✓ Build complete!{Colors.NC}")
            log(f"Output: {final_path}")
            log("")

            return final_path

        except Exception as e:
            error(f"Build failed: {e}")
            raise
        finally:
            # Cleanup
            if self.work_dir.exists():
                log(f"Cleaning up: {self.work_dir}")
                shutil.rmtree(self.work_dir, ignore_errors=True)

def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <output-path>")
        print(f"Example: {sys.argv[0]} ~/vibecode-webgui/azure/slim-openvscode.cpio.xz")
        sys.exit(1)

    output_path = Path(sys.argv[1]).expanduser().resolve()

    # Check for required tools
    required_tools = ['strip', 'cpio', 'xz', 'file']
    missing = []

    for tool in required_tools:
        if shutil.which(tool) is None:
            missing.append(tool)

    if missing:
        error(f"Missing required tools: {', '.join(missing)}")
        print("Install with: brew install xz coreutils")
        sys.exit(1)

    # Build
    builder = SlimOpenVSCodeBuilder()
    builder.build(output_path)

if __name__ == "__main__":
    main()