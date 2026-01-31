"""Start the VibeCode WebGUI development environment."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Sequence


DATABASE_URL = "postgresql://test:test@localhost:5432/testdb"
NEXTAUTH_SECRET = "test-secret-key-for-local-development"
NEXTAUTH_URL = "http://localhost:3000"


def run_command(
    command: Sequence[str],
    *,
    check: bool = True,
    silent: bool = False,
) -> subprocess.CompletedProcess:
    """Run *command* while optionally suppressing stdio output."""

    kwargs: dict[str, object] = {}
    if silent:
        kwargs["stdout"] = subprocess.DEVNULL
        kwargs["stderr"] = subprocess.DEVNULL
    return subprocess.run(list(command), check=check, **kwargs)  # noqa: S603, S607


def ensure_postgres_ready() -> bool:
    """Return True when PostgreSQL appears to be running locally."""

    result = run_command(
        ["pg_isready", "-h", "localhost", "-p", "5432"],
        check=False,
        silent=True,
    )
    if result.returncode == 0:
        return True

    print("PostgreSQL is not running. Please start PostgreSQL first.")
    print("  macOS: brew services start postgresql@16")
    print("  Ubuntu: sudo systemctl start postgresql")
    return False


def ensure_test_database() -> None:
    """Create the local test database when it is missing."""

    result = run_command(
        [
            "psql",
            "-h",
            "localhost",
            "-U",
            "test",
            "-d",
            "testdb",
            "-c",
            "SELECT 1;",
        ],
        check=False,
        silent=True,
    )
    if result.returncode == 0:
        return

    print("Creating test database ...")
    run_command([
        "createdb",
        "-h",
        "localhost",
        "-U",
        "test",
        "testdb",
    ], check=False)


def configure_environment() -> None:
    """Populate environment variables used by the runtime."""

    os.environ["DATABASE_URL"] = DATABASE_URL
    os.environ["NEXTAUTH_SECRET"] = NEXTAUTH_SECRET
    os.environ["NEXTAUTH_URL"] = NEXTAUTH_URL
    os.environ["NODE_ENV"] = "development"

    print("Environment variables set:")
    print(f"  DATABASE_URL: {os.environ['DATABASE_URL']}")
    print(f"  NEXTAUTH_URL: {os.environ['NEXTAUTH_URL']}")


def ensure_dependencies() -> None:
    """Install npm dependencies when node_modules is missing."""

    if not Path("node_modules").is_dir():
        print("Installing npm dependencies ...")
        run_command(["npm", "install"])


def sync_database_schema() -> None:
    """Force push the Prisma schema to the development database."""

    print("Syncing Prisma schema with database ...")
    run_command(["npx", "prisma", "db", "push", "--force-reset"])


def start_dev_server() -> int:
    """Start the Next.js development server."""

    print("Starting development server at http://localhost:3000")
    print("Login with developer@vibecode.dev / dev123")
    result = run_command(["npm", "run", "dev:simple"])
    return result.returncode


def main() -> int:
    print("🚀 Starting VibeCode WebGUI Development Environment...")

    if not ensure_postgres_ready():
        return 1

    ensure_test_database()
    configure_environment()
    ensure_dependencies()
    sync_database_schema()
    return start_dev_server()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as exc:  # pragma: no cover - passthrough
        print(f"Command failed: {' '.join(str(part) for part in exc.cmd)}")
        sys.exit(exc.returncode)
    except KeyboardInterrupt:  # pragma: no cover - user initiated
        print("Interrupted")
        sys.exit(130)
