#!/usr/bin/env python3
"""Verification script for PostgreSQL VM.

Run this after the VM has started to verify PostgreSQL and pgvector.
"""

import os
import socket
import subprocess
import sys
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

# Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color


@dataclass
class TestResults:
    """Track test results."""

    passed: int = 0
    failed: int = 0


def print_status(message: str) -> None:
    """Print a status message."""
    print(f"{BLUE}[*]{NC} {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{GREEN}[✓]{NC} {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{RED}[✗]{NC} {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{YELLOW}[!]{NC} {message}")


def run_psql(
    host: str,
    port: int,
    user: str,
    database: str,
    query: str,
    timeout: int = 10
) -> Tuple[bool, str]:
    """Run a psql query and return (success, output).

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        query: SQL query to execute.
        timeout: Command timeout in seconds.

    Returns:
        Tuple of (success, output).
    """
    try:
        result = subprocess.run(
            [
                "psql",
                "-h", host,
                "-p", str(port),
                "-U", user,
                "-d", database,
                "-t",
                "-c", query
            ],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout.strip()
    except subprocess.TimeoutExpired:
        return False, "Query timed out"
    except FileNotFoundError:
        return False, "psql command not found"
    except Exception as e:
        return False, str(e)


def check_port_listening(host: str, port: int, timeout: float = 5.0) -> bool:
    """Check if a port is listening.

    Args:
        host: Host to check.
        port: Port to check.
        timeout: Connection timeout.

    Returns:
        True if port is listening, False otherwise.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            return result == 0
    except socket.error:
        return False


def test_port_listening(
    host: str,
    port: int,
    results: TestResults
) -> bool:
    """Test 1: Check if PostgreSQL port is listening.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 1: Checking if PostgreSQL port is listening...")

    if check_port_listening(host, port):
        print_success(f"Port {port} is listening")
        results.passed += 1
        print()
        return True
    else:
        print_error(f"Port {port} is not listening")
        results.failed += 1
        print()
        return False


def test_postgresql_version(
    host: str,
    port: int,
    user: str,
    database: str,
    results: TestResults
) -> bool:
    """Test 2: Check PostgreSQL version.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 2: Checking PostgreSQL version...")

    success, output = run_psql(host, port, user, database, "SELECT version();")

    if success and output:
        # Extract PostgreSQL version
        import re
        match = re.search(r"PostgreSQL [0-9.]+", output)
        if match:
            print(f"           {match.group()}")
        print_success("PostgreSQL is running")
        results.passed += 1
        print()
        return True
    else:
        print_error("Could not connect to PostgreSQL")
        print_warning("Make sure PGPASSWORD is set or use .pgpass file")
        results.failed += 1
        print()
        return False


def test_pgvector_extension(
    host: str,
    port: int,
    user: str,
    database: str,
    results: TestResults
) -> bool:
    """Test 3: Check pgvector extension.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 3: Checking pgvector extension...")

    success, output = run_psql(
        host, port, user, database,
        "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
    )

    if success:
        version = output.strip()
        if version:
            print_success(f"pgvector extension version: {version}")
            results.passed += 1
            print()
            return True
        else:
            print_error("pgvector extension not found")
            results.failed += 1
            print()
            return False
    else:
        print_error("Could not check pgvector extension")
        results.failed += 1
        print()
        return False


def test_vector_operations(
    host: str,
    port: int,
    user: str,
    database: str,
    results: TestResults
) -> bool:
    """Test 4: Test vector operations.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 4: Testing vector operations...")

    query = """
        CREATE TEMP TABLE vector_test (id serial PRIMARY KEY, embedding vector(3));
        INSERT INTO vector_test (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
        SELECT embedding <-> '[3,1,2]' AS distance FROM vector_test;
        DROP TABLE vector_test;
    """

    try:
        result = subprocess.run(
            [
                "psql",
                "-h", host,
                "-p", str(port),
                "-U", user,
                "-d", database,
                "-c", query
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            print_success("Vector operations work correctly")
            results.passed += 1
            print()
            return True
        else:
            print_error("Vector operations failed")
            results.failed += 1
            print()
            return False
    except Exception:
        print_error("Vector operations failed")
        results.failed += 1
        print()
        return False


def test_database_size(
    host: str,
    port: int,
    user: str,
    database: str,
    results: TestResults
) -> bool:
    """Test 5: Check database size.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 5: Checking database size...")

    success, output = run_psql(
        host, port, user, database,
        f"SELECT pg_size_pretty(pg_database_size('{database}'));"
    )

    if success and output:
        print_success(f"Database size: {output.strip()}")
        results.passed += 1
        print()
        return True
    else:
        print_error("Could not check database size")
        results.failed += 1
        print()
        return False


def test_list_extensions(
    host: str,
    port: int,
    user: str,
    database: str,
    results: TestResults
) -> bool:
    """Test 6: List installed extensions.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 6: Listing installed extensions...")

    success, output = run_psql(
        host, port, user, database,
        "SELECT extname || ' (' || extversion || ')' FROM pg_extension ORDER BY extname;"
    )

    if success:
        for line in output.split('\n'):
            ext = line.strip()
            if ext:
                print(f"           - {ext}")
        print_success("Extensions listed successfully")
        results.passed += 1
        print()
        return True
    else:
        print_error("Could not list extensions")
        results.failed += 1
        print()
        return False


def test_active_connections(
    host: str,
    port: int,
    user: str,
    database: str,
    results: TestResults
) -> bool:
    """Test 7: Check active connections.

    Args:
        host: PostgreSQL host.
        port: PostgreSQL port.
        user: PostgreSQL user.
        database: PostgreSQL database.
        results: TestResults to update.

    Returns:
        True if test passed.
    """
    print_status("Test 7: Checking active connections...")

    success, output = run_psql(
        host, port, user, database,
        "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
    )

    if success:
        print_success(f"Active connections: {output.strip()}")
        results.passed += 1
        print()
        return True
    else:
        print_error("Could not check connections")
        results.failed += 1
        print()
        return False


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    print("========================================================")
    print("PostgreSQL VM Verification")
    print("========================================================")
    print()

    # PostgreSQL connection details from environment
    pg_host: str = os.environ.get("PG_HOST", "127.0.0.1")
    pg_port: int = int(os.environ.get("PG_PORT", "5432"))
    pg_user: str = os.environ.get("PG_USER", "vibecode")
    pg_db: str = os.environ.get("PG_DB", "vibecode")

    results = TestResults()

    # Run all tests
    test_port_listening(pg_host, pg_port, results)
    test_postgresql_version(pg_host, pg_port, pg_user, pg_db, results)
    test_pgvector_extension(pg_host, pg_port, pg_user, pg_db, results)
    test_vector_operations(pg_host, pg_port, pg_user, pg_db, results)
    test_database_size(pg_host, pg_port, pg_user, pg_db, results)
    test_list_extensions(pg_host, pg_port, pg_user, pg_db, results)
    test_active_connections(pg_host, pg_port, pg_user, pg_db, results)

    # Summary
    print("========================================================")
    print("Test Results Summary")
    print("========================================================")
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
        print(f"  psql -h {pg_host} -p {pg_port} -U {pg_user} -d {pg_db}")
        print()
        return 0
    else:
        print_error("Some tests failed. Please check the PostgreSQL VM logs.")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
