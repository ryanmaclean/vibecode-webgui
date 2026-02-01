#!/usr/bin/env python3
"""Stop All Native Homebrew Services.

Stops Redis and PostgreSQL 16 services.
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
import subprocess
import sys
import time


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


def kill_process(name: str) -> bool:
    """Kill a process by name."""
    result = run_cmd(["pkill", "-9", name])
    return result.returncode == 0


def stop_redis() -> bool:
    """Stop Redis server."""
    print(f"{Colors.YELLOW}Stopping Redis...{Colors.NC}")

    if not is_process_running("redis-server"):
        print(f"{Colors.GREEN}[OK] Redis not running{Colors.NC}")
        return True

    # Try graceful shutdown
    result = run_cmd(["redis-cli", "-a", REDIS_PASSWORD, "shutdown"])
    time.sleep(1)

    if not is_process_running("redis-server"):
        print(f"{Colors.GREEN}[OK] Redis stopped{Colors.NC}")
        return True

    # Force kill if needed
    print(f"{Colors.RED}[X] Failed to stop Redis gracefully, forcing...{Colors.NC}")
    kill_process("redis-server")
    time.sleep(1)

    if not is_process_running("redis-server"):
        print(f"{Colors.GREEN}[OK] Redis stopped (forced){Colors.NC}")
        return True

    print(f"{Colors.RED}[X] Failed to stop Redis{Colors.NC}")
    return False


def is_postgresql_running() -> bool:
    """Check if PostgreSQL is running via brew services."""
    result = run_cmd(["brew", "services", "list"])
    if result.returncode != 0:
        return False
    for line in result.stdout.splitlines():
        if "postgresql@16" in line and "started" in line:
            return True
    return False


def stop_postgresql() -> bool:
    """Stop PostgreSQL 16."""
    print(f"{Colors.YELLOW}Stopping PostgreSQL 16...{Colors.NC}")

    if not is_postgresql_running():
        print(f"{Colors.GREEN}[OK] PostgreSQL 16 not running{Colors.NC}")
        return True

    result = run_cmd(["brew", "services", "stop", "postgresql@16"])
    time.sleep(2)

    if result.returncode == 0:
        print(f"{Colors.GREEN}[OK] PostgreSQL 16 stopped{Colors.NC}")
        return True

    print(f"{Colors.RED}[X] Failed to stop PostgreSQL 16{Colors.NC}")
    return False


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
        help="Skip stopping Redis",
    )
    parser.add_argument(
        "--skip-postgresql",
        action="store_true",
        help="Skip stopping PostgreSQL",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print(f"{Colors.BLUE}Stopping All Native Homebrew Services{Colors.NC}")
    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print()

    success = True

    if not args.skip_redis:
        if not stop_redis():
            success = False

    if not args.skip_postgresql:
        if not stop_postgresql():
            success = False

    print()
    print(f"{Colors.GREEN}======================================================================{Colors.NC}")
    print(f"{Colors.GREEN}All services stopped!{Colors.NC}")
    print(f"{Colors.GREEN}======================================================================{Colors.NC}")
    print()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
