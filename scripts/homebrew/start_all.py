#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "start-all"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Start All Native Homebrew Services.

Starts Redis and PostgreSQL 16 services for VibeCode.
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import subprocess
import sys
import time
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


# Service configuration
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD')
if not REDIS_PASSWORD:
    raise ValueError("REDIS_PASSWORD environment variable is required")
REDIS_CONFIG = Path.home() / "vibecode-benchmarks" / "redis-benchmark.conf"


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


def start_redis() -> bool:
    """Start Redis server."""
    print(f"{Colors.YELLOW}Starting Redis...{Colors.NC}")

    if is_process_running("redis-server"):
        print(f"{Colors.GREEN}[OK] Redis already running{Colors.NC}")
        return True

    if not REDIS_CONFIG.exists():
        print(f"{Colors.RED}[X] Redis config not found: {REDIS_CONFIG}{Colors.NC}")
        return False

    result = run_cmd(
        ["redis-server", str(REDIS_CONFIG), "--daemonize", "yes"],
        capture=False,
    )
    if result.returncode != 0:
        print(f"{Colors.RED}[X] Failed to start Redis{Colors.NC}")
        return False

    time.sleep(2)

    # Verify Redis is responding
    result = run_cmd(
        ["redis-cli", "-a", REDIS_PASSWORD, "PING"],
    )
    if result.returncode == 0 and "PONG" in result.stdout:
        print(f"{Colors.GREEN}[OK] Redis started successfully{Colors.NC}")
        return True

    print(f"{Colors.RED}[X] Failed to start Redis{Colors.NC}")
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


def start_postgresql() -> bool:
    """Start PostgreSQL 16."""
    print(f"{Colors.YELLOW}Starting PostgreSQL 16...{Colors.NC}")

    pg_path = "/opt/homebrew/opt/postgresql@16/bin"
    env = {"PATH": f"{pg_path}:{os.environ.get('PATH', '')}"}

    if is_postgresql_running():
        print(f"{Colors.GREEN}[OK] PostgreSQL 16 already running{Colors.NC}")
        return True

    result = run_cmd(["brew", "services", "start", "postgresql@16"], capture=False)
    if result.returncode != 0:
        print(f"{Colors.RED}[X] Failed to start PostgreSQL 16{Colors.NC}")
        return False

    time.sleep(3)

    # Verify PostgreSQL is responding
    result = run_cmd(["psql", "-d", "postgres", "-c", "SELECT 1;"], env=env)
    if result.returncode == 0:
        print(f"{Colors.GREEN}[OK] PostgreSQL 16 started successfully{Colors.NC}")
        return True

    print(f"{Colors.RED}[X] Failed to start PostgreSQL 16{Colors.NC}")
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
        help="Skip starting Redis",
    )
    parser.add_argument(
        "--skip-postgresql",
        action="store_true",
        help="Skip starting PostgreSQL",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print(f"{Colors.BLUE}Starting All Native Homebrew Services{Colors.NC}")
    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print()

    success = True

    if not args.skip_redis:
        if not start_redis():
            success = False

    if not args.skip_postgresql:
        if not start_postgresql():
            success = False

    print()
    print(f"{Colors.GREEN}======================================================================{Colors.NC}")
    print(f"{Colors.GREEN}All services started!{Colors.NC}")
    print(f"{Colors.GREEN}======================================================================{Colors.NC}")
    print()
    print("Service Status:")
    print(f"  Redis: localhost:6379 (password: {REDIS_PASSWORD})")
    print("  PostgreSQL: localhost:5432 (user: vibecode, password: vibecode_prod_2024)")
    print()
    print("Test connections:")
    print(f"  Redis: redis-cli -a {REDIS_PASSWORD} PING")
    print("  PostgreSQL: psql -h localhost -U vibecode -d vibecode -c 'SELECT version();'")
    print()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())