#!/usr/bin/env python3
"""Install Node.js 24 in LX Zone.

Uses NodeSource repository for latest Node.js installation.
"""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

NODE_VERSION = "24"

NODEJS_PROFILE_CONFIG = """\
# Node.js optimizations for VibeCode

# Increase V8 heap size
export NODE_OPTIONS="--max-old-space-size=4096"

# Use more libuv threads for better I/O performance
export UV_THREADPOOL_SIZE=16

# Enable V8 optimizations
export NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size"

# Disable V8 warnings in production
export NODE_NO_WARNINGS=1
"""

TEST_SERVER_JS = """\
const http = require('http');
const os = require('os');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Node.js is working!',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    memory: Math.round(os.totalmem() / 1024 / 1024) + ' MB'
  }, null, 2));
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/`);
  console.log('Node.js installation verified!');
});

// Auto-shutdown after 5 seconds
setTimeout(() => {
  console.log('Test complete. Shutting down...');
  server.close();
  process.exit(0);
}, 5000);
"""


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    reset: str = "\033[0m"


COLORS = Colors()


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{COLORS.green}[INFO]{COLORS.reset} {message}")


def log_warn(message: str) -> None:
    """Print warning message."""
    print(f"{COLORS.yellow}[WARN]{COLORS.reset} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{COLORS.red}[ERROR]{COLORS.reset} {message}")


def run_command(
    cmd: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
    shell: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    if shell:
        return subprocess.run(
            " ".join(cmd),
            shell=True,
            check=check,
            capture_output=capture_output,
            text=True,
        )
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
    )


def get_command_output(cmd: list[str]) -> str:
    """Run a command and return its output."""
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def check_environment() -> bool:
    """Check if running in Debian lx zone."""
    if not Path("/etc/debian_version").exists():
        log_error("This script must be run inside the Debian lx zone")
        log_info("Run: zlogin vibecode-zone")
        return False

    log_info("Running in Debian lx zone")
    return True


def update_system() -> None:
    """Update system packages."""
    log_info("Updating system packages...")
    run_command(["apt", "update"])
    run_command(["apt", "upgrade", "-y"])


def install_dependencies() -> None:
    """Install build dependencies."""
    log_info("Installing build dependencies...")

    packages = [
        "ca-certificates",
        "curl",
        "gnupg",
        "build-essential",
        "python3",
        "python3-pip",
        "git",
        "wget",
    ]

    run_command(["apt", "install", "-y"] + packages)


def install_nodejs() -> bool:
    """Install Node.js from NodeSource."""
    log_info(f"Installing Node.js {NODE_VERSION} from NodeSource...")

    # Download and run NodeSource setup script
    try:
        run_command(
            [f"curl -fsSL https://deb.nodesource.com/setup_{NODE_VERSION}.x | bash -"],
            shell=True,
        )
    except subprocess.CalledProcessError:
        log_error("Failed to run NodeSource setup script")
        return False

    # Install Node.js
    run_command(["apt", "install", "-y", "nodejs"])

    # Verify installation
    node_version = get_command_output(["node", "--version"])
    npm_version = get_command_output(["npm", "--version"])

    log_info(f"Node.js installed: {node_version}")
    log_info(f"npm installed: {npm_version}")

    # Check if version is correct
    if not node_version.startswith(f"v{NODE_VERSION}."):
        log_error(f"Node.js version mismatch. Expected v{NODE_VERSION}.x, got {node_version}")
        return False

    return True


def configure_npm() -> None:
    """Configure npm global directory."""
    log_info("Configuring npm...")

    # Set npm global directory to user-writable location
    npm_global = Path.home() / ".npm-global"
    npm_global.mkdir(parents=True, exist_ok=True)

    run_command(["npm", "config", "set", "prefix", str(npm_global)])

    # Add to PATH in bashrc
    bashrc = Path.home() / ".bashrc"
    path_line = 'export PATH=~/.npm-global/bin:$PATH'

    if bashrc.exists():
        content = bashrc.read_text()
        if ".npm-global/bin" not in content:
            with bashrc.open("a") as f:
                f.write(f"\n{path_line}\n")

    # Update current PATH
    os.environ["PATH"] = f"{npm_global}/bin:{os.environ.get('PATH', '')}"

    # Update npm to latest
    run_command(["npm", "install", "-g", "npm@latest"])

    npm_version = get_command_output(["npm", "--version"])
    log_info(f"npm version: {npm_version}")


def install_global_packages() -> None:
    """Install useful global npm packages."""
    log_info("Installing useful global npm packages...")

    packages = [
        "pnpm",
        "yarn",
        "pm2",
        "typescript",
        "tsx",
    ]

    run_command(["npm", "install", "-g"] + packages)

    log_info("Global packages installed:")
    run_command(["npm", "list", "-g", "--depth=0"])


def optimize_nodejs() -> None:
    """Configure Node.js optimizations."""
    log_info("Optimizing Node.js settings...")

    profile_path = Path("/etc/profile.d/nodejs.sh")
    profile_path.write_text(NODEJS_PROFILE_CONFIG)
    profile_path.chmod(0o755)

    # Source the config for current session
    os.environ["NODE_OPTIONS"] = "--max-old-space-size=4096 --optimize-for-size"
    os.environ["UV_THREADPOOL_SIZE"] = "16"
    os.environ["NODE_NO_WARNINGS"] = "1"

    log_info("Node.js optimizations configured")


def create_test_app() -> None:
    """Create and run a test application."""
    log_info("Creating test application...")

    test_dir = Path("/tmp/nodejs-test")
    test_dir.mkdir(parents=True, exist_ok=True)

    test_file = test_dir / "test.js"
    test_file.write_text(TEST_SERVER_JS)

    log_info("Testing Node.js installation...")

    # Start server in background
    import time

    proc = subprocess.Popen(
        ["node", str(test_file)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    time.sleep(2)

    # Test HTTP request
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:8080/"],
            capture_output=True,
            text=True,
            check=False,
        )
        if "Node.js is working" in result.stdout:
            log_info("Node.js test successful!")
        else:
            log_warn("Node.js test failed, but installation may still be valid")
    except (subprocess.SubprocessError, FileNotFoundError):
        log_warn("Could not run HTTP test")

    # Wait for auto-shutdown
    time.sleep(4)
    proc.wait()


def show_summary() -> None:
    """Display installation summary."""
    node_version = get_command_output(["node", "--version"])
    npm_version = get_command_output(["npm", "--version"])
    pnpm_version = get_command_output(["pnpm", "--version"])
    yarn_version = get_command_output(["yarn", "--version"])
    pm2_version = get_command_output(["pm2", "--version"])

    print(f"""
{COLORS.green}Node.js Installation Complete!{COLORS.reset}
================================

Versions Installed:
  Node.js: {node_version}
  npm: {npm_version}
  pnpm: {pnpm_version}
  yarn: {yarn_version}
  pm2: {pm2_version}

Configuration:
  Global packages: ~/.npm-global
  Node.js options: /etc/profile.d/nodejs.sh

Environment Variables:
  NODE_OPTIONS: {os.environ.get('NODE_OPTIONS', 'not set')}
  UV_THREADPOOL_SIZE: {os.environ.get('UV_THREADPOOL_SIZE', 'not set')}

Next Steps:
  1. Run: ./04-setup-postgres-pgvector.sh
  2. Then: ./05-deploy-vibecode.sh

Test Commands:
  node --version
  npm --version
  node -e "console.log('Hello from Node.js', process.version)"
""")


def main() -> int:
    """Main entry point."""
    log_info(f"Node.js {NODE_VERSION} Installation")
    log_info("=================================")

    if not check_environment():
        return 1

    try:
        update_system()
        install_dependencies()

        if not install_nodejs():
            return 1

        configure_npm()
        install_global_packages()
        optimize_nodejs()
        create_test_app()
        show_summary()

        return 0
    except subprocess.CalledProcessError as e:
        log_error(f"Command failed: {e}")
        return 1
    except Exception as e:
        log_error(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
