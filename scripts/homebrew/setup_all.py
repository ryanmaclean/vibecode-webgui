#!/usr/bin/env python3
"""Setup All Native Homebrew Services.

Installs Redis, PostgreSQL 16, and pgvector extension for VibeCode.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
        env=run_env,
    )


def check_homebrew() -> bool:
    """Check if Homebrew is installed."""
    if not shutil.which("brew"):
        print(f"{Colors.RED}[X] Homebrew is not installed{Colors.NC}")
        print("Install Homebrew from: https://brew.sh")
        return False
    print(f"{Colors.GREEN}[OK] Homebrew installed{Colors.NC}")
    return True


def is_brew_package_installed(package: str) -> bool:
    """Check if a Homebrew package is installed."""
    result = run_cmd(["brew", "list", package])
    return result.returncode == 0


def install_redis() -> bool:
    """Install Redis."""
    print(f"{Colors.YELLOW}Step 1/3: Installing Redis...{Colors.NC}")
    if is_brew_package_installed("redis"):
        print(f"{Colors.GREEN}[OK] Redis already installed{Colors.NC}")
        return True

    result = run_cmd(["brew", "install", "redis"], capture=False)
    if result.returncode == 0:
        print(f"{Colors.GREEN}[OK] Redis installed{Colors.NC}")
        return True
    print(f"{Colors.RED}[X] Failed to install Redis{Colors.NC}")
    return False


def install_postgresql() -> bool:
    """Install PostgreSQL 16."""
    print(f"{Colors.YELLOW}Step 2/3: Installing PostgreSQL 16...{Colors.NC}")
    if is_brew_package_installed("postgresql@16"):
        print(f"{Colors.GREEN}[OK] PostgreSQL 16 already installed{Colors.NC}")
        return True

    result = run_cmd(["brew", "install", "postgresql@16"], capture=False)
    if result.returncode == 0:
        print(f"{Colors.GREEN}[OK] PostgreSQL 16 installed{Colors.NC}")
        return True
    print(f"{Colors.RED}[X] Failed to install PostgreSQL 16{Colors.NC}")
    return False


def install_pgvector() -> bool:
    """Install pgvector extension."""
    print(f"{Colors.YELLOW}Step 3/3: Installing pgvector extension...{Colors.NC}")

    pg_path = "/opt/homebrew/opt/postgresql@16/bin"
    env = {"PATH": f"{pg_path}:{os.environ.get('PATH', '')}"}

    # Check if pgvector is already available
    result = run_cmd(
        ["psql", "-d", "postgres", "-c",
         "SELECT * FROM pg_available_extensions WHERE name = 'vector';"],
        env=env,
    )
    if result.returncode == 0 and "vector" in result.stdout:
        print(f"{Colors.GREEN}[OK] pgvector already installed{Colors.NC}")
        return True

    print("Cloning and building pgvector...")

    with tempfile.TemporaryDirectory() as tmpdir:
        # Clone pgvector
        result = run_cmd(
            ["git", "clone", "--depth", "1",
             "https://github.com/pgvector/pgvector.git"],
            cwd=tmpdir,
            capture=False,
        )
        if result.returncode != 0:
            print(f"{Colors.RED}[X] Failed to clone pgvector{Colors.NC}")
            return False

        pgvector_dir = Path(tmpdir) / "pgvector"

        # Build
        result = run_cmd(["make"], cwd=str(pgvector_dir), env=env, capture=False)
        if result.returncode != 0:
            print(f"{Colors.RED}[X] Failed to build pgvector{Colors.NC}")
            return False

        # Install
        result = run_cmd(
            ["make", "install",
             f"PG_CONFIG={pg_path}/pg_config"],
            cwd=str(pgvector_dir),
            env=env,
            capture=False,
        )
        if result.returncode != 0:
            print(f"{Colors.RED}[X] Failed to install pgvector{Colors.NC}")
            return False

    print(f"{Colors.GREEN}[OK] pgvector installed{Colors.NC}")
    return True


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--skip-redis",
        action="store_true",
        help="Skip Redis installation",
    )
    parser.add_argument(
        "--skip-postgresql",
        action="store_true",
        help="Skip PostgreSQL installation",
    )
    parser.add_argument(
        "--skip-pgvector",
        action="store_true",
        help="Skip pgvector installation",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print(f"{Colors.BLUE}VibeCode Native Homebrew Setup - All Services{Colors.NC}")
    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print()

    if not check_homebrew():
        return 1

    print()

    success = True

    if not args.skip_redis:
        if not install_redis():
            success = False

    if not args.skip_postgresql:
        if not install_postgresql():
            success = False

    if not args.skip_pgvector:
        if not install_pgvector():
            success = False

    print()
    if success:
        print(f"{Colors.GREEN}======================================================================{Colors.NC}")
        print(f"{Colors.GREEN}All services installed successfully!{Colors.NC}")
        print(f"{Colors.GREEN}======================================================================{Colors.NC}")
        print()
        print("Next steps:")
        print("  1. Run: ./scripts/homebrew/start-all.sh")
        print("  2. Run: ./scripts/homebrew/initialize-databases.sh")
        print("  3. Run benchmarks: ~/vibecode-benchmarks/scripts/run-all-benchmarks.sh")
        print()
        return 0
    else:
        print(f"{Colors.RED}Some installations failed.{Colors.NC}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
