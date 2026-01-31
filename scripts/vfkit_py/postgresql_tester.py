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

"""Test PostgreSQL VM - Comprehensive database connectivity and feature tests.

Tests: Connection, Queries, pgvector (if available), Performance.
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
from dataclasses import dataclass
from typing import Callable, Sequence

from .log import COLORS, log_error, log_info, log_success, log_warn


@dataclass(frozen=True)
class PostgreSQLConfig:
    """PostgreSQL connection configuration."""

    host: str = "localhost"
    port: int = 5432
    user: str = "vibecode"
    password: str = "vibecode"
    database: str = "vibecode"


class PostgreSQLCLI:
    """PostgreSQL CLI wrapper."""

    def __init__(self, binary: str):
        self.binary = binary

    @classmethod
    def detect(cls) -> "PostgreSQLCLI":
        """Detect psql binary."""
        path = shutil.which("psql")
        if path:
            return cls(path)
        raise FileNotFoundError("psql not found. Install with: brew install postgresql")

    def exec_sql(
        self,
        config: PostgreSQLConfig,
        query: str,
        *,
        capture_output: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        """Execute a SQL query."""
        env = os.environ.copy()
        env["PGPASSWORD"] = config.password

        return subprocess.run(
            [
                self.binary,
                "-h", config.host,
                "-p", str(config.port),
                "-U", config.user,
                "-d", config.database,
                "-t",  # Tuples only
                "-A",  # Unaligned output
                "-c", query,
            ],
            capture_output=capture_output,
            text=True,
            env=env,
        )


class PostgreSQLTester:
    """PostgreSQL test runner."""

    def __init__(self, config: PostgreSQLConfig, cli: PostgreSQLCLI):
        self.config = config
        self.cli = cli

    def _exec(self, query: str) -> str:
        """Execute query and return output."""
        result = self.cli.exec_sql(self.config, query)
        return result.stdout.strip() if result.returncode == 0 else ""

    def _exec_silent(self, query: str) -> bool:
        """Execute query silently, return success."""
        result = self.cli.exec_sql(self.config, query)
        return result.returncode == 0

    def test_port_connectivity(self) -> bool:
        """Test port connectivity."""
        try:
            with socket.create_connection((self.config.host, self.config.port), timeout=2):
                return True
        except OSError:
            return False

    def test_connection(self) -> bool:
        """Test basic connection."""
        return self._exec_silent("SELECT 1;")

    def test_version(self) -> bool:
        """Test database version."""
        version = self._exec("SELECT version();")
        return bool(version)

    def test_create_table(self) -> bool:
        """Test table creation."""
        return self._exec_silent("""
            DROP TABLE IF EXISTS test_vibecode_table;
            CREATE TABLE test_vibecode_table (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)

    def test_insert_data(self) -> bool:
        """Test data insertion."""
        return self._exec_silent("""
            INSERT INTO test_vibecode_table (name) VALUES
            ('Test 1'),
            ('Test 2'),
            ('Test 3');
        """)

    def test_query_data(self) -> bool:
        """Test data query."""
        count = self._exec("SELECT COUNT(*) FROM test_vibecode_table;")
        try:
            return int(count) == 3
        except ValueError:
            return False

    def test_update_data(self) -> bool:
        """Test data update."""
        self._exec_silent("UPDATE test_vibecode_table SET name = 'Updated' WHERE id = 1;")
        name = self._exec("SELECT name FROM test_vibecode_table WHERE id = 1;")
        return name == "Updated"

    def test_delete_data(self) -> bool:
        """Test data deletion."""
        self._exec_silent("DELETE FROM test_vibecode_table WHERE id = 1;")
        count = self._exec("SELECT COUNT(*) FROM test_vibecode_table;")
        try:
            return int(count) == 2
        except ValueError:
            return False

    def test_transaction(self) -> bool:
        """Test transaction support."""
        self._exec_silent("""
            BEGIN;
            INSERT INTO test_vibecode_table (name) VALUES ('Transaction Test');
            ROLLBACK;
        """)
        count = self._exec("SELECT COUNT(*) FROM test_vibecode_table WHERE name = 'Transaction Test';")
        try:
            return int(count) == 0
        except ValueError:
            return False

    def test_json_support(self) -> bool:
        """Test JSON/JSONB support."""
        self._exec_silent("""
            CREATE TEMP TABLE test_json (
                id SERIAL PRIMARY KEY,
                data JSONB
            );
            INSERT INTO test_json (data) VALUES ('{"key": "value"}');
        """)
        value = self._exec("SELECT data->>'key' FROM test_json;")
        return value == "value"

    def test_fulltext_search(self) -> bool:
        """Test full-text search."""
        self._exec_silent("""
            CREATE TEMP TABLE test_fts (
                id SERIAL PRIMARY KEY,
                content TEXT,
                tsv TSVECTOR
            );
            INSERT INTO test_fts (content, tsv) VALUES
            ('VibeCode is awesome', to_tsvector('english', 'VibeCode is awesome'));
        """)
        count = self._exec("SELECT COUNT(*) FROM test_fts WHERE tsv @@ to_tsquery('english', 'awesome');")
        try:
            return int(count) == 1
        except ValueError:
            return False

    def test_pgvector(self) -> bool:
        """Test pgvector extension (if available)."""
        result = self.cli.exec_sql(self.config, "CREATE EXTENSION IF NOT EXISTS vector;")
        if result.returncode != 0:
            log_warn("pgvector extension not available (expected in Alpine)")
            return True  # Don't fail if not available

        success = self._exec_silent("""
            CREATE TEMP TABLE test_vectors (
                id SERIAL PRIMARY KEY,
                embedding vector(3)
            );
            INSERT INTO test_vectors (embedding) VALUES
            ('[1,2,3]'),
            ('[4,5,6]');
        """)
        return success

    def test_index(self) -> bool:
        """Test index performance."""
        self._exec_silent("""
            DROP TABLE IF EXISTS test_index;
            CREATE TABLE test_index (
                id SERIAL PRIMARY KEY,
                value INTEGER
            );
            INSERT INTO test_index (value)
            SELECT generate_series(1, 1000);
            CREATE INDEX idx_test_value ON test_index(value);
        """)
        count = self._exec("SELECT COUNT(*) FROM test_index WHERE value > 500;")
        try:
            return int(count) == 500
        except ValueError:
            return False

    def cleanup_tests(self) -> None:
        """Cleanup test tables."""
        self._exec_silent("DROP TABLE IF EXISTS test_vibecode_table;")
        self._exec_silent("DROP TABLE IF EXISTS test_index;")

    def show_info(self) -> None:
        """Show PostgreSQL server information."""
        print(f"\n{COLORS.blue}=== PostgreSQL Server Information ==={COLORS.reset}")

        print(f"\n{COLORS.yellow}Version:{COLORS.reset}")
        version = self._exec("SELECT version();")
        if version:
            print(f"  {version[:80]}...")

        print(f"\n{COLORS.yellow}Database Size:{COLORS.reset}")
        size = self._exec(f"SELECT pg_size_pretty(pg_database_size('{self.config.database}'));")
        print(f"  {size}")

        print(f"\n{COLORS.yellow}Active Connections:{COLORS.reset}")
        connections = self._exec("SELECT count(*) FROM pg_stat_activity;")
        print(f"  {connections}")

        print(f"\n{COLORS.yellow}Extensions:{COLORS.reset}")
        extensions = self._exec("SELECT extname || ' ' || extversion FROM pg_extension ORDER BY extname;")
        for ext in extensions.splitlines():
            print(f"  {ext}")

        print(f"\n{COLORS.yellow}Cache Hit Ratio:{COLORS.reset}")
        ratio = self._exec("""
            SELECT round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)
            FROM pg_stat_database
            WHERE datname = current_database();
        """)
        print(f"  {ratio}%")


class PostgreSQLTestSuite:
    """PostgreSQL test suite."""

    def __init__(
        self,
        tester: PostgreSQLTester,
        tests: Sequence[tuple[str, Callable[[], bool]]] | None = None,
    ):
        self.tester = tester
        self.tests = list(tests) if tests is not None else self._default_tests()
        self.passed = 0
        self.failed = 0

    def _default_tests(self) -> list[tuple[str, Callable[[], bool]]]:
        return [
            ("Port Connectivity", self.tester.test_port_connectivity),
            ("Basic Connection", self.tester.test_connection),
            ("Database Version", self.tester.test_version),
            ("Create Table", self.tester.test_create_table),
            ("Insert Data", self.tester.test_insert_data),
            ("Query Data", self.tester.test_query_data),
            ("Update Data", self.tester.test_update_data),
            ("Delete Data", self.tester.test_delete_data),
            ("Transaction Support", self.tester.test_transaction),
            ("JSON/JSONB Support", self.tester.test_json_support),
            ("Full-Text Search", self.tester.test_fulltext_search),
            ("pgvector Extension", self.tester.test_pgvector),
            ("Index Performance", self.tester.test_index),
        ]

    def run(self) -> bool:
        """Run all tests."""
        self._print_banner()
        log_info(f"Configuration:")
        print(f"  Host: {self.tester.config.host}")
        print(f"  Port: {self.tester.config.port}")
        print(f"  Database: {self.tester.config.database}")
        print(f"  User: {self.tester.config.user}")
        print(f"  Password: [REDACTED]")

        for name, func in self.tests:
            print(f"\n{COLORS.blue}Test:{COLORS.reset} {name}")
            try:
                if func():
                    log_success(name)
                    self.passed += 1
                else:
                    log_error(name)
                    self.failed += 1
            except Exception as exc:
                log_error(f"{name} - {exc}")
                self.failed += 1

        # Cleanup
        self.tester.cleanup_tests()

        # Show info
        self.tester.show_info()

        self._print_summary()
        return self.failed == 0

    def _print_banner(self) -> None:
        """Print banner."""
        banner = [
            "TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW",
            "Q  PostgreSQL VM Comprehensive Tests    Q",
            "ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]",
        ]
        for line in banner:
            print(f"{COLORS.blue}{line}{COLORS.reset}")

    def _print_summary(self) -> None:
        """Print test summary."""
        total = self.passed + self.failed
        print(f"\n{COLORS.blue}=== Test Summary ==={COLORS.reset}")
        print(f"  {COLORS.green}Passed:{COLORS.reset} {self.passed}")
        print(f"  {COLORS.red}Failed:{COLORS.reset} {self.failed}")
        print(f"  {COLORS.yellow}Total:{COLORS.reset} {total}")

        if self.failed == 0:
            print(f"\n{COLORS.green}\u2713 All tests passed! PostgreSQL is working correctly.{COLORS.reset}")
        else:
            print(f"\n{COLORS.red}\u2717 Some tests failed. Check the PostgreSQL VM logs.{COLORS.reset}")


def build_arg_parser() -> argparse.ArgumentParser:
    """Build argument parser."""
    parser = argparse.ArgumentParser(description="PostgreSQL VM functional tests")
    parser.add_argument("--host", default="localhost", help="PostgreSQL host")
    parser.add_argument("--port", type=int, default=5432, help="PostgreSQL port")
    parser.add_argument("--user", default="vibecode", help="PostgreSQL user")
    parser.add_argument("--password", default="vibecode", help="PostgreSQL password")
    parser.add_argument("--database", default="vibecode", help="PostgreSQL database")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Main entry point."""
    args = build_arg_parser().parse_args(argv)
    config = PostgreSQLConfig(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
    )

    try:
        cli = PostgreSQLCLI.detect()
    except FileNotFoundError as exc:
        log_error(str(exc))
        return 1

    tester = PostgreSQLTester(config, cli)
    suite = PostgreSQLTestSuite(tester)
    success = suite.run()
    return 0 if success else 1


__all__ = [
    "PostgreSQLCLI",
    "PostgreSQLConfig",
    "PostgreSQLTestSuite",
    "PostgreSQLTester",
    "main",
]


if __name__ == "__main__":
    sys.exit(main())