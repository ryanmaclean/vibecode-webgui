#!/usr/bin/env python3
"""
Start All Native Homebrew Services.

VibeCode Native Homebrew Management
Starts Redis and PostgreSQL 16 services.
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


# Default configuration
REDIS_CONFIG = Path.home() / "vibecode-benchmarks" / "redis-benchmark.conf"
REDIS_PASSWORD = "VibeCodeChangeInProduction2025"
POSTGRES_USER = "vibecode"
POSTGRES_PASSWORD = "vibecode_prod_2024"
POSTGRES_DB = "vibecode"


def is_process_running(process_name: str) -> bool:
    """Check if a process is running by name."""
    result = subprocess.run(
        ["pgrep", "-x", process_name],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


def is_brew_service_running(service_name: str) -> bool:
    """Check if a Homebrew service is running."""
    result = subprocess.run(
        ["brew", "services", "list"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return False

    for line in result.stdout.split('\n'):
        if service_name in line and "started" in line:
            return True
    return False


def start_redis(config_path: Path, password: str) -> bool:
    """
    Start Redis server.

    Args:
        config_path: Path to Redis configuration file
        password: Redis password for verification

    Returns:
        True if Redis is running, False otherwise
    """
    print(f"{Colors.YELLOW}Starting Redis...{Colors.NC}")

    if is_process_running("redis-server"):
        print(f"{Colors.GREEN}+ Redis already running{Colors.NC}")
        return True

    # Start Redis with config
    subprocess.run(
        ["redis-server", str(config_path), "--daemonize", "yes"],
        check=False,
    )

    time.sleep(2)

    # Verify Redis is responding
    result = subprocess.run(
        ["redis-cli", "-a", password, "PING"],
        capture_output=True,
        text=True,
        check=False,
    )

    if "PONG" in result.stdout:
        print(f"{Colors.GREEN}+ Redis started successfully{Colors.NC}")
        return True
    else:
        print(f"{Colors.RED}x Failed to start Redis{Colors.NC}")
        return False


def start_postgresql() -> bool:
    """
    Start PostgreSQL 16 via Homebrew services.

    Returns:
        True if PostgreSQL is running, False otherwise
    """
    print(f"{Colors.YELLOW}Starting PostgreSQL 16...{Colors.NC}")

    # Update PATH to include PostgreSQL 16 binaries
    pg_bin_path = "/opt/homebrew/opt/postgresql@16/bin"
    os.environ["PATH"] = f"{pg_bin_path}:{os.environ.get('PATH', '')}"

    if is_brew_service_running("postgresql@16"):
        print(f"{Colors.GREEN}+ PostgreSQL 16 already running{Colors.NC}")
        return True

    # Start PostgreSQL via brew services
    result = subprocess.run(
        ["brew", "services", "start", "postgresql@16"],
        check=False,
    )

    if result.returncode != 0:
        print(f"{Colors.RED}x Failed to start PostgreSQL 16{Colors.NC}")
        return False

    time.sleep(3)

    # Verify PostgreSQL is responding
    result = subprocess.run(
        ["psql", "-d", "postgres", "-c", "SELECT 1;"],
        capture_output=True,
        check=False,
    )

    if result.returncode == 0:
        print(f"{Colors.GREEN}+ PostgreSQL 16 started successfully{Colors.NC}")
        return True
    else:
        print(f"{Colors.RED}x Failed to start PostgreSQL 16{Colors.NC}")
        return False


def print_status_summary() -> None:
    """Print service status summary."""
    print()
    print(f"{Colors.GREEN}======================================================================{Colors.NC}")
    print(f"{Colors.GREEN}All services started!{Colors.NC}")
    print(f"{Colors.GREEN}======================================================================{Colors.NC}")
    print()
    print("Service Status:")
    print(f"  Redis: localhost:6379 (password: {REDIS_PASSWORD})")
    print(f"  PostgreSQL: localhost:5432 (user: {POSTGRES_USER}, password: {POSTGRES_PASSWORD})")
    print()
    print("Test connections:")
    print(f"  Redis: redis-cli -a {REDIS_PASSWORD} PING")
    print(f"  PostgreSQL: psql -h localhost -U {POSTGRES_USER} -d {POSTGRES_DB} -c 'SELECT version();'")
    print()


def start_all(
    redis_config: Path = REDIS_CONFIG,
    redis_password: str = REDIS_PASSWORD,
    skip_redis: bool = False,
    skip_postgres: bool = False,
) -> int:
    """
    Start all native Homebrew services.

    Args:
        redis_config: Path to Redis configuration file
        redis_password: Redis password
        skip_redis: Skip starting Redis
        skip_postgres: Skip starting PostgreSQL

    Returns:
        0 on success, 1 if any service failed to start
    """
    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print(f"{Colors.BLUE}Starting All Native Homebrew Services{Colors.NC}")
    print(f"{Colors.BLUE}======================================================================{Colors.NC}")
    print()

    success = True

    # Start Redis
    if not skip_redis:
        if not start_redis(redis_config, redis_password):
            success = False

    # Start PostgreSQL
    if not skip_postgres:
        if not start_postgresql():
            success = False

    # Print summary
    print_status_summary()

    return 0 if success else 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Start All Native Homebrew Services for VibeCode"
    )
    parser.add_argument(
        "--redis-config",
        type=Path,
        default=REDIS_CONFIG,
        help=f"Path to Redis config file (default: {REDIS_CONFIG})",
    )
    parser.add_argument(
        "--redis-password",
        type=str,
        default=REDIS_PASSWORD,
        help="Redis password for verification",
    )
    parser.add_argument(
        "--skip-redis",
        action="store_true",
        help="Skip starting Redis",
    )
    parser.add_argument(
        "--skip-postgres",
        action="store_true",
        help="Skip starting PostgreSQL",
    )
    args = parser.parse_args()

    return start_all(
        redis_config=args.redis_config,
        redis_password=args.redis_password,
        skip_redis=args.skip_redis,
        skip_postgres=args.skip_postgres,
    )


if __name__ == "__main__":
    sys.exit(main())
