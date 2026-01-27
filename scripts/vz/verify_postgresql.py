"""Verification utility for PostgreSQL virtual machines."""

from __future__ import annotations

import argparse
import os
import subprocess
from dataclasses import dataclass
from typing import Callable, Iterable, Sequence


Color = str


@dataclass
class Colors:
    red: Color = "\033[0;31m"
    green: Color = "\033[0;32m"
    yellow: Color = "\033[1;33m"
    blue: Color = "\033[0;34m"
    reset: Color = "\033[0m"


COLORS = Colors()


@dataclass(frozen=True)
class PostgresConfig:
    host: str
    port: int
    user: str
    database: str

    @classmethod
    def from_env(cls, args: argparse.Namespace) -> "PostgresConfig":
        return cls(
            host=args.host or os.getenv("PG_HOST", "127.0.0.1"),
            port=int(args.port or os.getenv("PG_PORT", "5432")),
            user=args.user or os.getenv("PG_USER", "vibecode"),
            database=args.database or os.getenv("PG_DB", "vibecode"),
        )


def colorize(color: Color, message: str) -> str:
    return f"{color}{message}{COLORS.reset}"


def run_command(cmd: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


def run_psql(config: PostgresConfig, query: str, quiet: bool = True) -> subprocess.CompletedProcess[str]:
    args = [
        "psql",
        "-h",
        config.host,
        "-p",
        str(config.port),
        "-U",
        config.user,
        "-d",
        config.database,
        "-t",
        "-c",
        query,
    ]
    if not quiet:
        args.remove("-t")
    return run_command(args)


def check_port_listening(config: PostgresConfig) -> tuple[bool, str]:
    result = run_command(["nc", "-zv", config.host, str(config.port)])
    if "succeeded" in (result.stdout + result.stderr):
        return True, f"Port {config.port} is listening"
    return False, f"Port {config.port} is not listening"


def check_version(config: PostgresConfig) -> tuple[bool, str]:
    result = run_psql(config, "SELECT version();")
    if result.returncode == 0 and result.stdout.strip():
        version_line = next((line.strip() for line in result.stdout.splitlines() if line.strip()), "PostgreSQL")
        return True, version_line
    warning = "Ensure PGPASSWORD is set or configure a .pgpass file"
    return False, warning


def check_pgvector(config: PostgresConfig) -> tuple[bool, str]:
    result = run_psql(
        config,
        "SELECT extversion FROM pg_extension WHERE extname = 'vector';",
    )
    version = result.stdout.strip()
    if result.returncode == 0 and version:
        return True, f"pgvector extension version: {version}"
    if result.returncode == 0:
        return False, "pgvector extension not found"
    return False, "Unable to query pgvector extension"


def check_vector_operations(config: PostgresConfig) -> tuple[bool, str]:
    query = """
    CREATE TEMP TABLE vector_test (id serial PRIMARY KEY, embedding vector(3));
    INSERT INTO vector_test (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
    SELECT embedding <-> '[3,1,2]' AS distance FROM vector_test;
    DROP TABLE vector_test;
    """
    result = run_psql(config, query)
    if result.returncode == 0:
        return True, "Vector operations completed"
    return False, "Vector operations failed"


def check_database_size(config: PostgresConfig) -> tuple[bool, str]:
    result = run_psql(config, f"SELECT pg_size_pretty(pg_database_size('{config.database}'));")
    size = result.stdout.strip()
    if result.returncode == 0 and size:
        return True, f"Database size: {size}"
    return False, "Unable to determine database size"


def list_extensions(config: PostgresConfig) -> tuple[bool, str]:
    query = "SELECT extname || ' (' || extversion || ')' FROM pg_extension ORDER BY extname;"
    result = run_psql(config, query)
    if result.returncode != 0:
        return False, "Unable to list extensions"
    extensions = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not extensions:
        return False, "No extensions reported"
    formatted = "\n".join(f"           - {ext}" for ext in extensions)
    return True, formatted


def check_active_connections(config: PostgresConfig) -> tuple[bool, str]:
    query = "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
    result = run_psql(config, query)
    value = result.stdout.strip()
    if result.returncode == 0 and value:
        return True, f"Active connections: {value}"
    return False, "Unable to query active connections"


TestFunc = Callable[[PostgresConfig], tuple[bool, str]]


TESTS: list[tuple[str, TestFunc]] = [
    ("Checking if PostgreSQL port is listening", check_port_listening),
    ("Checking PostgreSQL version", check_version),
    ("Checking pgvector extension", check_pgvector),
    ("Testing vector operations", check_vector_operations),
    ("Checking database size", check_database_size),
    ("Listing installed extensions", list_extensions),
    ("Checking active connections", check_active_connections),
]


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", help="PostgreSQL host")
    parser.add_argument("--port", help="PostgreSQL port")
    parser.add_argument("--user", help="PostgreSQL user")
    parser.add_argument("--database", help="PostgreSQL database name")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    config = PostgresConfig.from_env(args)

    print("=" * 56)
    print("PostgreSQL VM Verification")
    print("=" * 56)
    print()

    passed = 0
    failed = 0
    for description, test in TESTS:
        print(colorize(COLORS.blue, "[*]"), description)
        success, message = test(config)
        if success:
            print(colorize(COLORS.green, "[✓]"), message)
            passed += 1
        else:
            print(colorize(COLORS.red, "[✗]"), message)
            failed += 1
        print()

    print("=" * 56)
    print("Test Results Summary")
    print("=" * 56)
    print(colorize(COLORS.green, "[✓]"), f"Tests passed: {passed}")
    fail_color = COLORS.red if failed else COLORS.green
    print(colorize(fail_color, "[✗]" if failed else "[✓]"), f"Tests failed: {failed}")
    print()

    if failed == 0:
        print(colorize(COLORS.green, "[✓]"), "All tests passed! PostgreSQL VM is working correctly.")
        print()
        print("Connect with:")
        print(f"  psql -h {config.host} -p {config.port} -U {config.user} -d {config.database}")
        return 0
    print(colorize(COLORS.red, "[✗]"), "Some tests failed. Please check the PostgreSQL VM logs.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

