#!/usr/bin/env python3
"""Setup All Native Homebrew Services.

VibeCode Native Homebrew Setup for Redis, PostgreSQL 16, and pgvector.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()

PG_BIN_PATH = "/opt/homebrew/opt/postgresql@16/bin"
PG_CONFIG = f"{PG_BIN_PATH}/pg_config"


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}\u2713 {message}{COLORS.reset}")


def err(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}\u2717 {message}{COLORS.reset}")


def step(message: str) -> None:
    """Print yellow step message."""
    print(f"{COLORS.yellow}{message}{COLORS.reset}")


def info(message: str) -> None:
    """Print blue info message."""
    print(f"{COLORS.blue}{message}{COLORS.reset}")


def run_command(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    capture_output: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=capture_output,
        text=True,
        env=full_env,
    )


def run_silent(cmd: list[str]) -> bool:
    """Run a command silently, return True if successful."""
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def check_homebrew() -> bool:
    """Check if Homebrew is installed."""
    if not shutil.which("brew"):
        err("Homebrew is not installed")
        print("Install Homebrew from: https://brew.sh")
        return False

    ok("Homebrew installed")
    print()
    return True


def is_brew_package_installed(package: str) -> bool:
    """Check if a Homebrew package is installed."""
    return run_silent(["brew", "list", package])


def install_redis() -> bool:
    """Install Redis."""
    step("Step 1/3: Installing Redis...")

    if is_brew_package_installed("redis"):
        ok("Redis already installed")
        return True

    try:
        run_command(["brew", "install", "redis"])
        ok("Redis installed")
        return True
    except subprocess.CalledProcessError:
        err("Failed to install Redis")
        return False


def install_postgresql() -> bool:
    """Install PostgreSQL 16."""
    step("Step 2/3: Installing PostgreSQL 16...")

    if is_brew_package_installed("postgresql@16"):
        ok("PostgreSQL 16 already installed")
        return True

    try:
        run_command(["brew", "install", "postgresql@16"])
        ok("PostgreSQL 16 installed")
        return True
    except subprocess.CalledProcessError:
        err("Failed to install PostgreSQL 16")
        return False


def is_pgvector_installed() -> bool:
    """Check if pgvector extension is available."""
    psql_path = f"{PG_BIN_PATH}/psql"
    if not Path(psql_path).exists():
        return False

    try:
        result = run_command(
            [psql_path, "-d", "postgres", "-c",
             "SELECT * FROM pg_available_extensions WHERE name = 'vector';"],
            capture_output=True,
            check=False,
        )
        return "vector" in result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_pgvector() -> bool:
    """Install pgvector extension."""
    step("Step 3/3: Installing pgvector extension...")

    # Add PostgreSQL bin to PATH for this process
    os.environ["PATH"] = f"{PG_BIN_PATH}:{os.environ.get('PATH', '')}"

    if is_pgvector_installed():
        ok("pgvector already installed")
        return True

    print("Cloning and building pgvector...")

    try:
        # Create temp directory for build
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)

            # Clone pgvector
            run_command(
                ["git", "clone", "--depth", "1", "https://github.com/pgvector/pgvector.git"],
                cwd=tmppath,
            )

            pgvector_dir = tmppath / "pgvector"

            # Build
            run_command(["make"], cwd=pgvector_dir)

            # Install
            run_command(
                ["make", "install", f"PG_CONFIG={PG_CONFIG}"],
                cwd=pgvector_dir,
            )

        ok("pgvector installed")
        return True
    except subprocess.CalledProcessError as e:
        err(f"Failed to install pgvector: {e}")
        return False


def print_summary() -> None:
    """Print installation summary."""
    print()
    info("=" * 70)
    ok("All services installed successfully!")
    info("=" * 70)
    print()
    print("Next steps:")
    print("  1. Run: ./scripts/homebrew/start-all.sh")
    print("  2. Run: ./scripts/homebrew/initialize-databases.sh")
    print("  3. Run benchmarks: ~/vibecode-benchmarks/scripts/run-all-benchmarks.sh")
    print()


def main() -> int:
    """Main entry point."""
    info("=" * 70)
    info("VibeCode Native Homebrew Setup - All Services")
    info("=" * 70)
    print()

    if not check_homebrew():
        return 1

    if not install_redis():
        return 1

    if not install_postgresql():
        return 1

    if not install_pgvector():
        return 1

    print_summary()
    return 0


if __name__ == "__main__":
    sys.exit(main())
