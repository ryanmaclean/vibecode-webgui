#!/usr/bin/env python3
"""Verification script for PostgreSQL VM.

Run this after the VM has started to verify PostgreSQL and pgvector.

Tests:
1. Port connectivity
2. PostgreSQL version
3. pgvector extension
4. Vector operations
5. Database size
6. Installed extensions
7. Active connections
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
import socket
import subprocess
import sys
from dataclasses import dataclass


# ANSI color codes
class Colors:
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


def print_status(msg: str) -> None:
    print(f"{Colors.BLUE}[*]{Colors.NC} {msg}")


def print_success(msg: str) -> None:
    print(f"{Colors.GREEN}[\u2713]{Colors.NC} {msg}")


def print_error(msg: str) -> None:
    print(f"{Colors.RED}[\u2717]{Colors.NC} {msg}")


def print_warning(msg: str) -> None:
    print(f"{Colors.YELLOW}[!]{Colors.NC} {msg}")


@dataclass
class PostgresConfig:
    """PostgreSQL connection configuration."""

    host: str = "127.0.0.1"
    port: int = 5432
    user: str = "vibecode"
    database: str = "vibecode"
    password: str | None = None


@dataclass
class TestResults:
    """Track test results."""

    passed: int = 0
    failed: int = 0


def check_port(host: str, port: int, timeout: float = 5.0) -> bool:
    """Check if a port is listening."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, socket.timeout):
        return False


def run_psql(
    config: PostgresConfig,
    query: str,
    tuples_only: bool = True,
) -> tuple[bool, str]:
    """Run a psql query and return (success, output)."""
    if not shutil.which("psql"):
        return False, "psql not found"

    cmd = [
        "psql",
        "-h", config.host,
        "-p", str(config.port),
        "-U", config.user,
        "-d", config.database,
    ]

    if tuples_only:
        cmd.append("-t")

    cmd.extend(["-c", query])

    env = os.environ.copy()
    if config.password:
        env["PGPASSWORD"] = config.password

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
    )

    return result.returncode == 0, result.stdout.strip()


def test_port_listening(config: PostgresConfig, results: TestResults) -> None:
    """Test 1: Check if PostgreSQL port is listening."""
    print_status("Test 1: Checking if PostgreSQL port is listening...")

    if check_port(config.host, config.port):
        print_success(f"Port {config.port} is listening")
        results.passed += 1
    else:
        print_error(f"Port {config.port} is not listening")
        results.failed += 1
    print()


def test_postgresql_version(config: PostgresConfig, results: TestResults) -> None:
    """Test 2: Check PostgreSQL version."""
    print_status("Test 2: Checking PostgreSQL version...")

    success, output = run_psql(config, "SELECT version();")

    if success and output:
        # Extract PostgreSQL version
        import re
        match = re.search(r"PostgreSQL [0-9.]+", output)
        if match:
            print(f"           {match.group(0)}")
        print_success("PostgreSQL is running")
        results.passed += 1
    else:
        print_error("Could not connect to PostgreSQL")
        print_warning("Make sure PGPASSWORD is set or use .pgpass file")
        results.failed += 1
    print()


def test_pgvector_extension(config: PostgresConfig, results: TestResults) -> None:
    """Test 3: Check pgvector extension."""
    print_status("Test 3: Checking pgvector extension...")

    success, output = run_psql(
        config,
        "SELECT extversion FROM pg_extension WHERE extname = 'vector';",
    )

    if success:
        version = output.strip()
        if version:
            print_success(f"pgvector extension version: {version}")
            results.passed += 1
        else:
            print_error("pgvector extension not found")
            results.failed += 1
    else:
        print_error("Could not check pgvector extension")
        results.failed += 1
    print()


def test_vector_operations(config: PostgresConfig, results: TestResults) -> None:
    """Test 4: Test vector operations."""
    print_status("Test 4: Testing vector operations...")

    query = """
        CREATE TEMP TABLE vector_test (id serial PRIMARY KEY, embedding vector(3));
        INSERT INTO vector_test (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
        SELECT embedding <-> '[3,1,2]' AS distance FROM vector_test;
        DROP TABLE vector_test;
    """

    success, _ = run_psql(config, query, tuples_only=False)

    if success:
        print_success("Vector operations work correctly")
        results.passed += 1
    else:
        print_error("Vector operations failed")
        results.failed += 1
    print()


def test_database_size(config: PostgresConfig, results: TestResults) -> None:
    """Test 5: Check database size."""
    print_status("Test 5: Checking database size...")

    success, output = run_psql(
        config,
        f"SELECT pg_size_pretty(pg_database_size('{config.database}'));",
    )

    if success and output:
        print_success(f"Database size: {output.strip()}")
        results.passed += 1
    else:
        print_error("Could not check database size")
        results.failed += 1
    print()


def test_list_extensions(config: PostgresConfig, results: TestResults) -> None:
    """Test 6: List installed extensions."""
    print_status("Test 6: Listing installed extensions...")

    success, output = run_psql(
        config,
        "SELECT extname || ' (' || extversion || ')' FROM pg_extension ORDER BY extname;",
    )

    if success:
        for line in output.splitlines():
            ext = line.strip()
            if ext:
                print(f"           - {ext}")
        print_success("Extensions listed successfully")
        results.passed += 1
    else:
        print_error("Could not list extensions")
        results.failed += 1
    print()


def test_active_connections(config: PostgresConfig, results: TestResults) -> None:
    """Test 7: Check active connections."""
    print_status("Test 7: Checking active connections...")

    success, output = run_psql(
        config,
        "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';",
    )

    if success and output:
        print_success(f"Active connections: {output.strip()}")
        results.passed += 1
    else:
        print_error("Could not check connections")
        results.failed += 1
    print()


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-H", "--host",
        default=os.environ.get("PG_HOST", "127.0.0.1"),
        help="PostgreSQL host (default: $PG_HOST or 127.0.0.1)",
    )
    parser.add_argument(
        "-p", "--port",
        type=int,
        default=int(os.environ.get("PG_PORT", "5432")),
        help="PostgreSQL port (default: $PG_PORT or 5432)",
    )
    parser.add_argument(
        "-U", "--user",
        default=os.environ.get("PG_USER", "vibecode"),
        help="PostgreSQL user (default: $PG_USER or vibecode)",
    )
    parser.add_argument(
        "-d", "--database",
        default=os.environ.get("PG_DB", "vibecode"),
        help="PostgreSQL database (default: $PG_DB or vibecode)",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("PGPASSWORD"),
        help="PostgreSQL password (default: $PGPASSWORD)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    config = PostgresConfig(
        host=args.host,
        port=args.port,
        user=args.user,
        database=args.database,
        password=args.password,
    )

    print("=" * 56)
    print("PostgreSQL VM Verification")
    print("=" * 56)
    print()

    results = TestResults()

    # Run all tests
    test_port_listening(config, results)
    test_postgresql_version(config, results)
    test_pgvector_extension(config, results)
    test_vector_operations(config, results)
    test_database_size(config, results)
    test_list_extensions(config, results)
    test_active_connections(config, results)

    # Summary
    print("=" * 56)
    print("Test Results Summary")
    print("=" * 56)
    print()

    print_success(f"Tests passed: {results.passed}")
    if results.failed > 0:
        print_error(f"Tests failed: {results.failed}")
    else:
        print_success(f"Tests failed: {results.failed}")
    print()

    if results.failed == 0:
        print_success("All tests passed! PostgreSQL VM is working correctly.")
        print()
        print("You can now connect to PostgreSQL:")
        print(f"  psql -h {config.host} -p {config.port} -U {config.user} -d {config.database}")
        print()
        return 0
    else:
        print_error("Some tests failed. Please check the PostgreSQL VM logs.")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
