#!/usr/bin/env python3


"""Verification script for PostgreSQL VM.

Run this after the VM has started to verify PostgreSQL and pgvector.
"""

from __future__ import annotations
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

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Optional


# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"  # No Color


@dataclass
class PostgreSQLConfig:
    """PostgreSQL connection configuration."""

    host: str = "127.0.0.1"
    port: int = 5432
    user: str = "vibecode"
    database: str = "vibecode"

    @classmethod
    def from_env(cls) -> "PostgreSQLConfig":
        """Create config from environment variables."""
        return cls(
            host=os.environ.get("PG_HOST", "127.0.0.1"),
            port=int(os.environ.get("PG_PORT", "5432")),
            user=os.environ.get("PG_USER", "vibecode"),
            database=os.environ.get("PG_DB", "vibecode"),
        )


@dataclass
class VerificationResults:
    """Test results tracker."""

    passed: int = 0
    failed: int = 0

    def record_pass(self) -> None:
        """Record a passed test."""
        self.passed += 1

    def record_fail(self) -> None:
        """Record a failed test."""
        self.failed += 1

    def all_passed(self) -> bool:
        """Check if all tests passed."""
        return self.failed == 0


def print_status(msg: str) -> None:
    """Print status message in blue."""
    print(f"{BLUE}[*]{NC} {msg}")


def print_success(msg: str) -> None:
    """Print success message in green."""
    print(f"{GREEN}[ok]{NC} {msg}")


def print_error(msg: str) -> None:
    """Print error message in red."""
    print(f"{RED}[x]{NC} {msg}")


def print_warning(msg: str) -> None:
    """Print warning message in yellow."""
    print(f"{YELLOW}[!]{NC} {msg}")


def run_psql(config: PostgreSQLConfig, query: str, timeout: int = 10) -> Optional[str]:
    """Run a psql query and return the output.

    Returns:
        Query output as string, or None if failed.
    """
    if not shutil.which("psql"):
        return None

    try:
        result = subprocess.run(
            [
                "psql",
                "-h", config.host,
                "-p", str(config.port),
                "-U", config.user,
                "-d", config.database,
                "-t",  # Tuples only (no headers)
                "-c", query,
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode == 0:
            return result.stdout
        return None
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return None


def run_psql_command(config: PostgreSQLConfig, query: str, timeout: int = 10) -> bool:
    """Run a psql command and check if it succeeds.

    Returns:
        True if command succeeded, False otherwise.
    """
    if not shutil.which("psql"):
        return False

    try:
        result = subprocess.run(
            [
                "psql",
                "-h", config.host,
                "-p", str(config.port),
                "-U", config.user,
                "-d", config.database,
                "-c", query,
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def check_port_connectivity(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 1: Check if PostgreSQL port is listening."""
    print_status("Test 1: Checking if PostgreSQL port is listening...")

    try:
        result = subprocess.run(
            ["nc", "-zv", config.host, str(config.port)],
            capture_output=True,
            text=True,
            timeout=5,
        )
        # nc -zv outputs to stderr
        if "succeeded" in result.stderr.lower() or result.returncode == 0:
            print_success(f"Port {config.port} is listening")
            results.record_pass()
        else:
            print_error(f"Port {config.port} is not listening")
            results.record_fail()
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        print_error(f"Port {config.port} is not listening")
        results.record_fail()
    print()


def check_postgresql_version(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 2: Check PostgreSQL version."""
    print_status("Test 2: Checking PostgreSQL version...")

    output = run_psql(config, "SELECT version();")
    if output:
        # Extract PostgreSQL version from output
        import re
        match = re.search(r"PostgreSQL [0-9.]+", output)
        if match:
            print(match.group())
        print_success("PostgreSQL is running")
        results.record_pass()
    else:
        print_error("Could not connect to PostgreSQL")
        print_warning("Make sure PGPASSWORD is set or use .pgpass file")
        results.record_fail()
    print()


def check_pgvector_extension(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 3: Check pgvector extension."""
    print_status("Test 3: Checking pgvector extension...")

    output = run_psql(config, "SELECT extversion FROM pg_extension WHERE extname = 'vector';")
    if output:
        version = output.strip()
        if version:
            print_success(f"pgvector extension version: {version}")
            results.record_pass()
        else:
            print_error("pgvector extension not found")
            results.record_fail()
    else:
        print_error("Could not check pgvector extension")
        results.record_fail()
    print()


def check_vector_operations(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 4: Check vector operations."""
    print_status("Test 4: Testing vector operations...")

    query = """
        CREATE TEMP TABLE vector_test (id serial PRIMARY KEY, embedding vector(3));
        INSERT INTO vector_test (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
        SELECT embedding <-> '[3,1,2]' AS distance FROM vector_test;
        DROP TABLE vector_test;
    """

    if run_psql_command(config, query):
        print_success("Vector operations work correctly")
        results.record_pass()
    else:
        print_error("Vector operations failed")
        results.record_fail()
    print()


def check_database_size(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 5: Check database size."""
    print_status("Test 5: Checking database size...")

    output = run_psql(config, f"SELECT pg_size_pretty(pg_database_size('{config.database}'));")
    if output:
        size = output.strip()
        print_success(f"Database size: {size}")
        results.record_pass()
    else:
        print_error("Could not check database size")
        results.record_fail()
    print()


def check_list_extensions(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 6: List installed extensions."""
    print_status("Test 6: Listing installed extensions...")

    output = run_psql(config, "SELECT extname || ' (' || extversion || ')' FROM pg_extension ORDER BY extname;")
    if output:
        for line in output.strip().split("\n"):
            ext = line.strip()
            if ext:
                print(f"           - {ext}")
        print_success("Extensions listed successfully")
        results.record_pass()
    else:
        print_error("Could not list extensions")
        results.record_fail()
    print()


def check_active_connections(config: PostgreSQLConfig, results: VerificationResults) -> None:
    """Check 7: Check active connections."""
    print_status("Test 7: Checking active connections...")

    output = run_psql(config, "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
    if output:
        count = output.strip()
        print_success(f"Active connections: {count}")
        results.record_pass()
    else:
        print_error("Could not check connections")
        results.record_fail()
    print()


def verify_postgresql(config: Optional[PostgreSQLConfig] = None) -> int:
    """Run PostgreSQL verification tests.

    Args:
        config: PostgreSQL connection config (uses env vars if None)

    Returns:
        Exit code (0 for all tests passed, 1 for failures)
    """
    if config is None:
        config = PostgreSQLConfig.from_env()

    print("=" * 56)
    print("PostgreSQL VM Verification")
    print("=" * 56)
    print()

    results = VerificationResults()

    # Run all checks
    check_port_connectivity(config, results)
    check_postgresql_version(config, results)
    check_pgvector_extension(config, results)
    check_vector_operations(config, results)
    check_database_size(config, results)
    check_list_extensions(config, results)
    check_active_connections(config, results)

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

    if results.all_passed():
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


def main() -> int:
    """Main entry point."""
    return verify_postgresql()


if __name__ == "__main__":
    sys.exit(main())