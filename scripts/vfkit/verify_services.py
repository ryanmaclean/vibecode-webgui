#!/usr/bin/env python3

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

"""Verify VM services are running and accessible."""

from __future__ import annotations

import socket
import subprocess
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn


def check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a port is accessible."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            return result == 0
    except (socket.error, OSError):
        return False


def check_redis(host: str = "localhost", port: int = 6379) -> bool:
    """Check if Redis is responding."""
    if not check_port(host, port):
        return False

    result = subprocess.run(
        ["redis-cli", "-h", host, "-p", str(port), "ping"],
        capture_output=True,
        text=True,
        check=False,
    )
    return "PONG" in result.stdout


def check_postgresql(host: str = "localhost", port: int = 5432) -> bool:
    """Check if PostgreSQL is responding."""
    if not check_port(host, port):
        return False

    result = subprocess.run(
        ["psql", "-h", host, "-U", "postgres", "-c", "SELECT 1"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0


def check_http(host: str, port: int, path: str = "/") -> bool:
    """Check if HTTP endpoint is responding."""
    if not check_port(host, port):
        return False

    result = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"http://{host}:{port}{path}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.startswith("2") or result.stdout.startswith("3")


def main() -> int:
    """Main entry point."""
    log_section("Service Verification")
    print()

    all_ok = True

    # Check Valkey/Redis
    print("Checking Valkey (Redis)...")
    if check_redis():
        log_success("Valkey is running on port 6379")
    else:
        log_error("Valkey is not responding on port 6379")
        all_ok = False

    print()

    # Check PostgreSQL
    print("Checking PostgreSQL...")
    if check_postgresql():
        log_success("PostgreSQL is running on port 5432")
    else:
        log_warn("PostgreSQL is not responding on port 5432")
        print("  (May require authentication)")
        # Don't fail on PostgreSQL auth issues
        if check_port("localhost", 5432):
            log_info("Port 5432 is open")
        else:
            all_ok = False

    print()

    # Check Node.js app
    print("Checking Node.js application...")
    if check_http("localhost", 3000):
        log_success("Node.js app is running on port 3000")
    else:
        log_warn("Node.js app is not responding on port 3000")
        if check_port("localhost", 3000):
            log_info("Port 3000 is open")

    print()

    # Summary
    log_section("Summary")
    if all_ok:
        log_success("All critical services are running")
        return 0
    else:
        log_warn("Some services are not responding")
        print("Check VM logs for details")
        return 1


if __name__ == "__main__":
    sys.exit(main())