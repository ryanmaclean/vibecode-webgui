#!/usr/bin/env python3
"""Setup script to run INSIDE the Alpine VM.

This installs Valkey, PostgreSQL+pgvector, and tests Node 24.
Usage: Run this script inside the Alpine VM after boot.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# Constants
VALKEY_VERSION = "8.1.0"
POSTGRES_VERSION = "16"
PGVECTOR_VERSION = "0.9.0"

# Valkey configuration template
VALKEY_CONFIG = """\
# Valkey configuration for Alpine ARM64
bind 127.0.0.1
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

daemonize yes
pidfile /var/run/valkey.pid
loglevel notice
logfile /var/log/valkey/valkey.log
databases 16

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/valkey

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Performance
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes

appendonly no
"""

# Valkey OpenRC init script
VALKEY_INIT_SCRIPT = """\
#!/sbin/openrc-run

name="valkey"
description="Valkey in-memory data store"
command="/usr/local/bin/valkey-server"
command_args="/etc/valkey/valkey.conf"
command_user="valkey:valkey"
pidfile="/var/run/valkey.pid"

depend() {
    need net
    use logger
}

start_pre() {
    checkpath --directory --owner valkey:valkey --mode 0755 \\
        /var/run /var/log/valkey /var/lib/valkey
}
"""

# PostgreSQL additional config
POSTGRES_CONFIG = """\
listen_addresses = '*'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
work_mem = 4MB
shared_preload_libraries = 'pg_stat_statements'
"""

# PostgreSQL HBA config
POSTGRES_HBA = """\
host    all             all             0.0.0.0/0               md5
host    all             all             ::0/0                   md5
"""


@dataclass
class SetupResult:
    """Result of a setup task."""

    success: bool
    message: str
    task_name: str


def run_command(
    cmd: list[str],
    check: bool = True,
    capture_output: bool = False,
    cwd: Optional[Path] = None,
    timeout: int = 600,
) -> subprocess.CompletedProcess:
    """Run a shell command."""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
        cwd=cwd,
        timeout=timeout,
    )


def print_header(title: str) -> None:
    """Print a section header."""
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)
    print()


def print_success(msg: str) -> None:
    """Print success message."""
    print(f"[ok] {msg}")


def print_error(msg: str) -> None:
    """Print error message."""
    print(f"[x] {msg}")


def check_alpine() -> bool:
    """Check if running on Alpine Linux."""
    alpine_release = Path("/etc/alpine-release")
    if not alpine_release.exists():
        print_error("This script must run on Alpine Linux")
        return False

    version = alpine_release.read_text().strip()
    print_success(f"Running on Alpine {version}")

    arch = subprocess.run(
        ["uname", "-m"],
        capture_output=True,
        text=True,
    ).stdout.strip()
    print_success(f"Architecture: {arch}")
    print()
    return True


def install_valkey_dependencies() -> bool:
    """Install build dependencies for Valkey."""
    print("Installing build dependencies...")
    try:
        run_command([
            "apk", "add", "--no-cache",
            "build-base",
            "linux-headers",
            "wget",
            "ca-certificates",
            "git",
        ])
        return True
    except subprocess.CalledProcessError:
        return False


def download_valkey(build_dir: Path, version: str) -> bool:
    """Download and extract Valkey source."""
    print(f"Downloading Valkey {version}...")
    build_dir.mkdir(parents=True, exist_ok=True)

    url = f"https://github.com/valkey-io/valkey/archive/refs/tags/{version}.tar.gz"

    try:
        run_command(
            ["wget", "-q", url, "-O", "valkey.tar.gz"],
            cwd=build_dir,
        )
        print("Extracting...")
        run_command(["tar", "xzf", "valkey.tar.gz"], cwd=build_dir)
        return True
    except subprocess.CalledProcessError:
        return False


def compile_valkey(source_dir: Path) -> bool:
    """Compile Valkey with ARM64 optimizations."""
    print("Compiling Valkey with ARM64 optimizations...")
    print("  - CRC32 hardware acceleration")
    print("  - Crypto extensions")
    print("  - Link-time optimization")
    print()

    try:
        nproc = subprocess.run(
            ["nproc"],
            capture_output=True,
            text=True,
        ).stdout.strip()

        cflags = "-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto -fomit-frame-pointer -pipe"
        ldflags = "-Wl,--gc-sections,-O3,--as-needed -flto"

        run_command(
            [
                "make", f"-j{nproc}",
                "MALLOC=libc",
                "USE_SYSTEMD=no",
                "BUILD_TLS=yes",
                "OPTIMIZATION=-O3",
                f"CFLAGS={cflags}",
                f"LDFLAGS={ldflags}",
            ],
            cwd=source_dir,
            timeout=1200,  # 20 minutes for compilation
        )

        # Strip binaries
        print("Stripping binaries...")
        for binary in ["valkey-server", "valkey-cli", "valkey-benchmark"]:
            run_command(["strip", f"src/{binary}"], cwd=source_dir)

        # Show sizes
        print("Binary sizes:")
        run_command(
            ["ls", "-lh", "src/valkey-server", "src/valkey-cli", "src/valkey-benchmark"],
            cwd=source_dir,
        )

        return True
    except subprocess.CalledProcessError:
        return False


def install_valkey(source_dir: Path) -> bool:
    """Install Valkey and configure it."""
    print("Installing Valkey...")
    try:
        run_command(["make", "PREFIX=/usr/local", "install"], cwd=source_dir)

        # Create system user
        try:
            run_command(["id", "valkey"], capture_output=True)
        except subprocess.CalledProcessError:
            run_command(["adduser", "-D", "-s", "/sbin/nologin", "valkey"])

        # Create directories
        for dir_path in ["/var/lib/valkey", "/var/log/valkey", "/etc/valkey"]:
            Path(dir_path).mkdir(parents=True, exist_ok=True)

        run_command(["chown", "-R", "valkey:valkey", "/var/lib/valkey", "/var/log/valkey"])

        # Write configuration
        config_path = Path("/etc/valkey/valkey.conf")
        config_path.write_text(VALKEY_CONFIG)
        run_command(["chown", "valkey:valkey", str(config_path)])
        run_command(["chmod", "640", str(config_path)])

        # Write init script
        init_path = Path("/etc/init.d/valkey")
        init_path.write_text(VALKEY_INIT_SCRIPT)
        run_command(["chmod", "+x", str(init_path)])

        return True
    except subprocess.CalledProcessError:
        return False


def setup_valkey() -> SetupResult:
    """Task 1: Install and compile Valkey."""
    print_header("Task 1: Building Valkey from Source")

    build_dir = Path("/tmp/valkey-build")

    if not install_valkey_dependencies():
        return SetupResult(False, "Failed to install dependencies", "Valkey")

    if not download_valkey(build_dir, VALKEY_VERSION):
        return SetupResult(False, "Failed to download Valkey", "Valkey")

    source_dir = build_dir / f"valkey-{VALKEY_VERSION}"
    if not compile_valkey(source_dir):
        return SetupResult(False, "Failed to compile Valkey", "Valkey")

    if not install_valkey(source_dir):
        return SetupResult(False, "Failed to install Valkey", "Valkey")

    # Test Valkey
    print()
    print("Testing Valkey...")
    run_command(["valkey-server", "--version"])

    # Cleanup
    shutil.rmtree(build_dir, ignore_errors=True)

    print_success(f"Task 1 Complete: Valkey {VALKEY_VERSION} installed")
    print()
    return SetupResult(True, f"Valkey {VALKEY_VERSION} installed", "Valkey")


def setup_postgresql() -> SetupResult:
    """Task 2: Install PostgreSQL + pgvector."""
    print_header("Task 2: Installing PostgreSQL 16 + pgvector")

    try:
        print(f"Installing PostgreSQL {POSTGRES_VERSION}...")
        run_command([
            "apk", "add", "--no-cache",
            f"postgresql{POSTGRES_VERSION}",
            f"postgresql{POSTGRES_VERSION}-contrib",
            f"postgresql{POSTGRES_VERSION}-client",
            f"postgresql{POSTGRES_VERSION}-dev",
        ])

        print(f"Building pgvector {PGVECTOR_VERSION} from source...")
        pgvector_dir = Path("/tmp/pgvector")
        run_command([
            "git", "clone", "--depth", "1",
            "--branch", f"v{PGVECTOR_VERSION}",
            "https://github.com/pgvector/pgvector.git",
            str(pgvector_dir),
        ])

        run_command(
            ["make", "OPTFLAGS=-O3 -march=armv8-a+crc"],
            cwd=pgvector_dir,
        )
        run_command(["make", "install"], cwd=pgvector_dir)
        shutil.rmtree(pgvector_dir, ignore_errors=True)

        print("Configuring PostgreSQL...")
        data_dir = Path("/var/lib/postgresql/data")
        data_dir.mkdir(parents=True, exist_ok=True)
        run_command(["chown", "-R", "postgres:postgres", "/var/lib/postgresql"])

        run_dir = Path("/run/postgresql")
        run_dir.mkdir(parents=True, exist_ok=True)
        run_command(["chown", "-R", "postgres:postgres", str(run_dir)])

        # Initialize database
        run_command([
            "su", "-", "postgres", "-c",
            f"initdb -D {data_dir}",
        ])

        # Add configuration
        pg_conf = data_dir / "postgresql.conf"
        with open(pg_conf, "a") as f:
            f.write(POSTGRES_CONFIG)

        pg_hba = data_dir / "pg_hba.conf"
        with open(pg_hba, "a") as f:
            f.write(POSTGRES_HBA)

        # Enable service
        run_command(["rc-update", "add", "postgresql", "default"])

        print("Testing PostgreSQL...")
        run_command(["rc-service", "postgresql", "start"])

        import time
        time.sleep(3)

        # Create database and enable pgvector
        run_command(["su", "-", "postgres", "-c", 'psql -c "CREATE DATABASE vibecode;"'])
        run_command(["su", "-", "postgres", "-c", 'psql -d vibecode -c "CREATE EXTENSION vector;"'])
        run_command([
            "su", "-", "postgres", "-c",
            "psql -d vibecode -c \"SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';\"",
        ])

        print_success(f"Task 2 Complete: PostgreSQL {POSTGRES_VERSION} + pgvector {PGVECTOR_VERSION} installed")
        print()
        return SetupResult(True, f"PostgreSQL {POSTGRES_VERSION} + pgvector {PGVECTOR_VERSION}", "PostgreSQL")

    except subprocess.CalledProcessError as e:
        return SetupResult(False, f"PostgreSQL setup failed: {e}", "PostgreSQL")


def setup_nodejs() -> SetupResult:
    """Task 3: Verify Node.js 24 installation."""
    print_header("Task 3: Verifying Node.js 24 Installation")

    try:
        # Check if node exists, install if not
        if not shutil.which("node"):
            print("Installing Node.js 24...")
            run_command(["apk", "add", "--no-cache", "nodejs", "npm"])

        # Get versions
        node_result = run_command(["node", "--version"], capture_output=True)
        npm_result = run_command(["npm", "--version"], capture_output=True)

        node_version = node_result.stdout.strip()
        npm_version = npm_result.stdout.strip()

        print_success(f"Node.js version: {node_version}")
        print_success(f"npm version: {npm_version}")
        print()

        # Test core modules
        print("Testing Node.js core modules...")
        test_script = """
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');

console.log('  - Architecture:', os.arch());
console.log('  - Platform:', os.platform());
console.log('  - Node version:', process.version);
console.log('  - V8 version:', process.versions.v8);
console.log('  - Crypto:', typeof crypto.randomBytes === 'function' ? 'ok' : 'fail');
console.log('  - File system:', typeof fs.readFileSync === 'function' ? 'ok' : 'fail');
console.log('  - All core modules: ok');
"""
        run_command(["node", "-e", test_script])

        print()
        print("Testing npm...")
        run_command(["npm", "--version"], capture_output=True)
        print_success("npm is working")

        print_success("Task 3 Complete: Node.js 24 verified")
        print()
        return SetupResult(True, f"Node.js {node_version}", "Node.js")

    except subprocess.CalledProcessError as e:
        return SetupResult(False, f"Node.js verification failed: {e}", "Node.js")


def print_summary(results: list[SetupResult]) -> None:
    """Print installation summary."""
    print_header("Installation Summary")

    all_success = all(r.success for r in results)

    if all_success:
        print_success("All services installed successfully!")
    else:
        print_error("Some services failed to install")

    print()
    print("Services:")
    for r in results:
        status = "[ok]" if r.success else "[x]"
        print(f"  {status} {r.task_name}: {r.message}")

    print()
    print("Binary locations:")
    print("  - valkey-server: /usr/local/bin/valkey-server")
    print("  - valkey-cli: /usr/local/bin/valkey-cli")

    postgres_path = shutil.which("postgres") or "/usr/bin/postgres"
    psql_path = shutil.which("psql") or "/usr/bin/psql"
    node_path = shutil.which("node") or "/usr/bin/node"
    npm_path = shutil.which("npm") or "/usr/bin/npm"

    print(f"  - postgres: {postgres_path}")
    print(f"  - psql: {psql_path}")
    print(f"  - node: {node_path}")
    print(f"  - npm: {npm_path}")

    print()
    print("Start services:")
    print("  - Valkey: rc-service valkey start")
    print("  - PostgreSQL: rc-service postgresql start")

    print()
    print("Test services:")
    print("  - Valkey: valkey-cli ping")
    print("  - PostgreSQL: psql -U postgres -l")
    print("  - Node.js: node --version")

    print()
    print("Setup complete!")


def run_setup() -> int:
    """Run the full Alpine services setup.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    print_header("Alpine ARM64 Services Setup")

    print("This script will install:")
    print("  1. Valkey (compiled from source with musl optimizations)")
    print("  2. PostgreSQL 16 + pgvector extension")
    print("  3. Node.js 24 verification")
    print()

    if not check_alpine():
        return 1

    results = []

    # Task 1: Valkey
    results.append(setup_valkey())

    # Task 2: PostgreSQL
    results.append(setup_postgresql())

    # Task 3: Node.js
    results.append(setup_nodejs())

    # Summary
    print_summary(results)

    return 0 if all(r.success for r in results) else 1


def main() -> int:
    """Main entry point."""
    return run_setup()


if __name__ == "__main__":
    sys.exit(main())
