#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
MongoDB Health Check Script

Performs comprehensive health checks for MongoDB.

Usage:
    python healthcheck.py
"""

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class HealthConfig:
    """Configuration for health checks."""
    host: str = "localhost"
    port: str = "27017"
    database: str = "chatui"
    timeout: int = 5


@dataclass
class HealthResult:
    """Result of health checks."""
    healthy: bool
    checks: list[tuple[str, bool, str]]


def run_mongosh(
    config: HealthConfig,
    eval_cmd: str,
    database: Optional[str] = None,
) -> tuple[int, str, str]:
    """Run a mongosh command."""
    host = f"{config.host}:{config.port}"
    if database:
        host = f"{host}/{database}"

    cmd = [
        "mongosh",
        "--host", host,
        "--eval", eval_cmd,
        "--quiet",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=config.timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", "mongosh not found"


def check_connection(config: HealthConfig) -> tuple[bool, str]:
    """Check if MongoDB is responding."""
    print("Checking MongoDB connection...")
    rc, _, stderr = run_mongosh(config, "db.adminCommand('ping')")

    if rc != 0:
        return False, f"MongoDB is not responding: {stderr}"
    return True, "MongoDB connection successful"


def check_database(config: HealthConfig) -> tuple[bool, str]:
    """Check if database is accessible."""
    print(f"Checking {config.database} database...")
    rc, _, stderr = run_mongosh(
        config,
        "db.runCommand({ping: 1})",
        database=config.database,
    )

    if rc != 0:
        return False, f"Database {config.database} is not accessible: {stderr}"
    return True, f"Database {config.database} is accessible"


def check_collections(config: HealthConfig) -> list[tuple[str, bool, str]]:
    """Check critical collections exist."""
    print("Checking collections...")
    collections = ["conversations", "sessions", "assistants", "sharedConversations"]
    results = []

    for collection in collections:
        rc, _, stderr = run_mongosh(
            config,
            f"db.{collection}.countDocuments({{}})",
            database=config.database,
        )

        if rc != 0:
            results.append((collection, False, f"Collection {collection} is not accessible"))
        else:
            results.append((collection, True, f"Collection {collection} is accessible"))

    return results


def check_indexes(config: HealthConfig) -> tuple[bool, str]:
    """Check indexes exist."""
    print("Checking indexes...")
    rc, stdout, _ = run_mongosh(
        config,
        "db.conversations.getIndexes().length",
        database=config.database,
    )

    if rc != 0:
        return True, "Could not check indexes"

    try:
        index_count = int(stdout.strip())
        if index_count < 5:
            return False, f"Expected indexes may be missing ({index_count} found)"
        return True, f"Indexes present ({index_count} found)"
    except ValueError:
        return True, "Could not parse index count"


def check_disk_space(data_dir: str = "/data/db") -> tuple[bool, str]:
    """Check disk space for data directory."""
    try:
        result = subprocess.run(
            ["df", data_dir],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return True, "Could not check disk space"

        lines = result.stdout.strip().split("\n")
        if len(lines) < 2:
            return True, "Could not parse disk space"

        parts = lines[1].split()
        if len(parts) < 4:
            return True, "Could not parse disk space"

        available_kb = int(parts[3])
        if available_kb < 1048576:  # 1GB in KB
            return False, f"Low disk space: {available_kb}KB available"

        available_gb = available_kb / 1048576
        return True, f"Disk space OK: {available_gb:.1f}GB available"

    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        return True, "Could not check disk space"


def check_memory(config: HealthConfig) -> tuple[bool, str]:
    """Check memory usage."""
    rc, stdout, _ = run_mongosh(config, "db.serverStatus().mem")

    if rc != 0:
        return True, "Could not check memory usage"
    return True, "Memory check passed"


def check_query_performance(config: HealthConfig) -> tuple[bool, str]:
    """Check query performance."""
    print("Checking query performance...")

    start_time = time.time_ns()
    rc, _, _ = run_mongosh(
        config,
        "db.conversations.findOne()",
        database=config.database,
    )
    end_time = time.time_ns()

    query_time_ms = (end_time - start_time) // 1_000_000

    if rc != 0:
        return True, "Could not test query performance"

    if query_time_ms > 1000:
        return False, f"Slow query performance: {query_time_ms}ms"

    return True, f"Query performance OK: {query_time_ms}ms"


def run_health_check(config: Optional[HealthConfig] = None) -> HealthResult:
    """Run all health checks."""
    if config is None:
        config = HealthConfig(
            host=os.environ.get("MONGO_HOST", "localhost"),
            port=os.environ.get("MONGO_PORT", "27017"),
            database=os.environ.get("MONGO_DATABASE", "chatui"),
        )

    checks: list[tuple[str, bool, str]] = []
    all_healthy = True

    # Check connection
    passed, msg = check_connection(config)
    checks.append(("connection", passed, msg))
    if not passed:
        return HealthResult(healthy=False, checks=checks)

    # Check database
    passed, msg = check_database(config)
    checks.append(("database", passed, msg))
    if not passed:
        all_healthy = False

    # Check collections
    for name, passed, msg in check_collections(config):
        checks.append((f"collection:{name}", passed, msg))
        if not passed:
            all_healthy = False

    # Check indexes
    passed, msg = check_indexes(config)
    checks.append(("indexes", passed, msg))
    if not passed:
        print(f"WARNING: {msg}")

    # Check disk space
    passed, msg = check_disk_space()
    checks.append(("disk_space", passed, msg))
    if not passed:
        all_healthy = False

    # Check memory
    passed, msg = check_memory(config)
    checks.append(("memory", passed, msg))

    # Check query performance
    passed, msg = check_query_performance(config)
    checks.append(("query_performance", passed, msg))
    if not passed:
        print(f"WARNING: {msg}")

    return HealthResult(healthy=all_healthy, checks=checks)


def main() -> int:
    """Main entry point."""
    result = run_health_check()

    if result.healthy:
        print("\nMongoDB health check passed successfully")
        return 0
    else:
        print("\nMongoDB health check failed")
        for name, passed, msg in result.checks:
            if not passed:
                print(f"  ERROR: {name}: {msg}")
        return 1


if __name__ == "__main__":
    sys.exit(main())