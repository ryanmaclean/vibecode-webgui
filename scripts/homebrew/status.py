#!/usr/bin/env python3
"""Check Status of All Native Homebrew Services.

Displays the status of Redis, PostgreSQL, Node.js, and port usage.
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


REDIS_PASSWORD = "VibeCodeChangeInProduction2025"


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


def is_process_running(name: str) -> bool:
    """Check if a process is running by name."""
    result = run_cmd(["pgrep", "-x", name])
    return result.returncode == 0


def check_redis_status() -> None:
    """Check and display Redis status."""
    print(f"{Colors.YELLOW}Redis Status:{Colors.NC}")

    if is_process_running("redis-server"):
        print(f"  {Colors.GREEN}[OK] Running{Colors.NC}")

        # Get Redis info
        result = run_cmd(["redis-cli", "-a", REDIS_PASSWORD, "INFO", "server"])
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if line.startswith("redis_version:") or line.startswith("uptime_in_seconds:"):
                    print(f"    {line}")

        print("    Port: 6379")
        print(f"    Password: {REDIS_PASSWORD}")
    else:
        print(f"  {Colors.RED}[X] Not running{Colors.NC}")


def check_postgresql_status() -> None:
    """Check and display PostgreSQL status."""
    pg_path = "/opt/homebrew/opt/postgresql@16/bin"
    env = {"PATH": f"{pg_path}:{os.environ.get('PATH', '')}"}

    print(f"{Colors.YELLOW}PostgreSQL 16 Status:{Colors.NC}")

    result = run_cmd(["brew", "services", "list"])
    is_running = False
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if "postgresql@16" in line and "started" in line:
                is_running = True
                break

    if is_running:
        print(f"  {Colors.GREEN}[OK] Running{Colors.NC}")

        # Get PostgreSQL version
        result = run_cmd(["psql", "-d", "postgres", "-t", "-c", "SELECT version();"], env=env)
        if result.returncode == 0:
            version = result.stdout.strip().split("\n")[0].strip()
            print(f"    {version[:60]}...")

        print("    Port: 5432")
        print("    User: vibecode")
        print("    Database: vibecode")
    else:
        print(f"  {Colors.RED}[X] Not running{Colors.NC}")


def check_nodejs_status() -> None:
    """Check and display Node.js status."""
    print(f"{Colors.YELLOW}Node.js:{Colors.NC}")

    node_path = shutil.which("node")
    if node_path:
        result = run_cmd(["node", "--version"])
        node_version = result.stdout.strip() if result.returncode == 0 else "unknown"

        result = run_cmd(["npm", "--version"])
        npm_version = result.stdout.strip() if result.returncode == 0 else "unknown"

        print(f"    Version: {node_version}")
        print(f"    npm: {npm_version}")
        print(f"    Location: {node_path}")
    else:
        print(f"  {Colors.RED}[X] Node.js not found{Colors.NC}")


def is_port_in_use(port: int) -> bool:
    """Check if a port is in use."""
    result = run_cmd(["lsof", "-nP", f"-iTCP:{port}"])
    return result.returncode == 0 and "LISTEN" in result.stdout


def check_port_status() -> None:
    """Check and display port status."""
    print(f"{Colors.YELLOW}Port Status:{Colors.NC}")

    ports = [6379, 5432, 3000, 8080]
    for port in ports:
        if is_port_in_use(port):
            print(f"    Port {port}: {Colors.GREEN}[OK] In use{Colors.NC}")
        else:
            print(f"    Port {port}: {Colors.BLUE}Available{Colors.NC}")


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

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print(f"{Colors.BLUE}Native Homebrew Services Status{Colors.NC}")
    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print()

    check_redis_status()
    print()

    check_postgresql_status()
    print()

    check_nodejs_status()
    print()

    check_port_status()
    print()

    print(f"{Colors.BLUE}======================================================================{Colors.NC}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
