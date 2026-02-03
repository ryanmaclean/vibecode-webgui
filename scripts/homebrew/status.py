#!/usr/bin/env python3
"""Check Status of All Native Homebrew Services.

VibeCode Native Homebrew Management
"""

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Optional

# ANSI colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'

# Default ports to check
DEFAULT_PORTS = [6379, 5432, 3000, 8080]

# Redis password (should be changed in production)
REDIS_PASSWORD = "VibeCodeChangeInProduction2025"


@dataclass
class ServiceStatus:
    """Status of a service."""

    name: str
    running: bool = False
    version: str = ""
    port: int = 0
    details: dict = field(default_factory=dict)


def run_command(
    cmd: list[str],
    check: bool = False,
    capture: bool = True,
    env: Optional[dict] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, raise on failure.
        capture: If True, capture output.
        env: Optional environment variables.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        merged_env = os.environ.copy()
        if env:
            merged_env.update(env)

        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            env=merged_env
        )
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def check_process_running(process_name: str) -> bool:
    """Check if a process is running.

    Args:
        process_name: Name of the process.

    Returns:
        True if process is running.
    """
    rc, _, _ = run_command(["pgrep", "-x", process_name], check=False)
    return rc == 0


def check_port_in_use(port: int) -> bool:
    """Check if a port is in use.

    Args:
        port: Port number.

    Returns:
        True if port is in use.
    """
    rc, stdout, _ = run_command(
        ["lsof", "-nP", f"-iTCP:{port}"],
        check=False
    )
    return rc == 0 and "LISTEN" in stdout


def get_redis_status() -> ServiceStatus:
    """Get Redis service status.

    Returns:
        ServiceStatus for Redis.
    """
    status = ServiceStatus(name="Redis", port=6379)

    if check_process_running("redis-server"):
        status.running = True

        # Get Redis info
        rc, stdout, _ = run_command([
            "redis-cli", "-a", REDIS_PASSWORD, "INFO", "server"
        ], check=False)

        if rc == 0:
            for line in stdout.splitlines():
                if "redis_version:" in line:
                    status.version = line.split(":")[1].strip()
                elif "uptime_in_seconds:" in line:
                    status.details["uptime_seconds"] = line.split(":")[1].strip()

    return status


def get_postgresql_status() -> ServiceStatus:
    """Get PostgreSQL service status.

    Returns:
        ServiceStatus for PostgreSQL.
    """
    status = ServiceStatus(name="PostgreSQL 16", port=5432)
    status.details["user"] = "vibecode"
    status.details["database"] = "vibecode"

    # Check if running via brew services
    rc, stdout, _ = run_command(["brew", "services", "list"], check=False)

    if rc == 0 and "postgresql@16" in stdout:
        for line in stdout.splitlines():
            if "postgresql@16" in line and "started" in line:
                status.running = True
                break

    if status.running:
        # Get PostgreSQL version
        env = {"PATH": f"/opt/homebrew/opt/postgresql@16/bin:{os.environ.get('PATH', '')}"}
        rc, stdout, _ = run_command(
            ["psql", "-d", "postgres", "-t", "-c", "SELECT version();"],
            check=False,
            env=env
        )
        if rc == 0 and stdout.strip():
            status.version = stdout.strip().split()[0:2]
            status.version = " ".join(stdout.strip().split()[0:2])

    return status


def get_nodejs_info() -> ServiceStatus:
    """Get Node.js information.

    Returns:
        ServiceStatus with Node.js info.
    """
    status = ServiceStatus(name="Node.js")

    # Get node version
    node_path = shutil.which("node")
    if node_path:
        status.running = True
        status.details["location"] = node_path

        rc, stdout, _ = run_command(["node", "--version"], check=False)
        if rc == 0:
            status.version = stdout.strip()

        rc, stdout, _ = run_command(["npm", "--version"], check=False)
        if rc == 0:
            status.details["npm_version"] = stdout.strip()

    return status


def print_header() -> None:
    """Print the status header."""
    print(f"{BLUE}======================================================================{NC}")
    print(f"{BLUE}Native Homebrew Services Status{NC}")
    print(f"{BLUE}======================================================================{NC}")
    print()


def print_service_status(status: ServiceStatus) -> None:
    """Print status for a service.

    Args:
        status: Service status to print.
    """
    print(f"{YELLOW}{status.name} Status:{NC}")

    if status.running:
        print(f"  {GREEN}✓ Running{NC}")
        if status.version:
            print(f"    Version: {status.version}")
        if status.port:
            print(f"    Port: {status.port}")
        for key, value in status.details.items():
            # Format key nicely
            display_key = key.replace("_", " ").title()
            print(f"    {display_key}: {value}")
    else:
        print(f"  {RED}✗ Not running{NC}")

    print()


def print_nodejs_info(status: ServiceStatus) -> None:
    """Print Node.js information.

    Args:
        status: Node.js status.
    """
    print(f"{YELLOW}Node.js:{NC}")

    if status.running:
        print(f"    Version: {status.version}")
        if "npm_version" in status.details:
            print(f"    npm: {status.details['npm_version']}")
        if "location" in status.details:
            print(f"    Location: {status.details['location']}")
    else:
        print(f"    {RED}Not installed{NC}")

    print()


def print_port_status(ports: list[int]) -> None:
    """Print port status.

    Args:
        ports: List of ports to check.
    """
    print(f"{YELLOW}Port Status:{NC}")

    for port in ports:
        if check_port_in_use(port):
            print(f"    Port {port}: {GREEN}✓ In use{NC}")
        else:
            print(f"    Port {port}: {BLUE}Available{NC}")

    print()


def print_footer() -> None:
    """Print the status footer."""
    print(f"{BLUE}======================================================================{NC}")


def main(
    show_redis: bool = True,
    show_postgres: bool = True,
    show_node: bool = True,
    show_ports: bool = True,
    ports: Optional[list[int]] = None
) -> int:
    """Main entry point.

    Args:
        show_redis: Show Redis status.
        show_postgres: Show PostgreSQL status.
        show_node: Show Node.js info.
        show_ports: Show port status.
        ports: Custom ports to check.

    Returns:
        Exit code (0 for success).
    """
    print_header()

    if show_redis:
        redis_status = get_redis_status()
        print_service_status(redis_status)

    if show_postgres:
        postgres_status = get_postgresql_status()
        print_service_status(postgres_status)

    if show_node:
        node_status = get_nodejs_info()
        print_nodejs_info(node_status)

    if show_ports:
        check_ports = ports if ports else DEFAULT_PORTS
        print_port_status(check_ports)

    print_footer()

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Check Status of All Native Homebrew Services"
    )
    parser.add_argument(
        '--no-redis',
        action='store_true',
        help="Skip Redis status"
    )
    parser.add_argument(
        '--no-postgres',
        action='store_true',
        help="Skip PostgreSQL status"
    )
    parser.add_argument(
        '--no-node',
        action='store_true',
        help="Skip Node.js info"
    )
    parser.add_argument(
        '--no-ports',
        action='store_true',
        help="Skip port status"
    )
    parser.add_argument(
        '--ports',
        type=int,
        nargs='+',
        help="Custom ports to check (default: 6379 5432 3000 8080)"
    )

    args = parser.parse_args()
    sys.exit(main(
        show_redis=not args.no_redis,
        show_postgres=not args.no_postgres,
        show_node=not args.no_node,
        show_ports=not args.no_ports,
        ports=args.ports
    ))
