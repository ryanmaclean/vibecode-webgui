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

# Datadog Unified Service Tagging
_dd_service = "pgvector"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "library"})
    _dd_patch()
except ImportError:
    pass


"""Helpers for working with temporary pgvector containers in tests."""

# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import time


def pgvector_start_container(
    container_name: str,
    host_port: int,
    database: str,
    user: str,
    password: str,
    image: str = "ankane/pgvector"
) -> bool:
    """Start a pgvector container.

    Args:
        container_name: The name for the container.
        host_port: The host port to map to container port 5432.
        database: The PostgreSQL database name.
        user: The PostgreSQL username.
        password: The PostgreSQL password.
        image: The Docker image to use.

    Returns:
        True if successful, False otherwise.
    """
    # Remove any existing container with the same name
    subprocess.run(
        ["docker", "rm", "-f", container_name],
        capture_output=True
    )

    # Start the new container
    result = subprocess.run(
        [
            "docker", "run", "--name", container_name,
            "-e", f"POSTGRES_DB={database}",
            "-e", f"POSTGRES_USER={user}",
            "-e", f"POSTGRES_PASSWORD={password}",
            "-p", f"{host_port}:5432",
            "-d", image
        ],
        capture_output=True
    )

    return result.returncode == 0


def pgvector_wait_for_start(
    container_name: str,
    user: str,
    database: str,
    retries: int = 10,
    delay_seconds: int = 2
) -> bool:
    """Wait for the pgvector container to be ready.

    Args:
        container_name: The container name.
        user: The PostgreSQL username.
        database: The PostgreSQL database name.
        retries: Number of retry attempts.
        delay_seconds: Delay between retries in seconds.

    Returns:
        True if container is ready, False if timeout.
    """
    for attempt in range(1, retries + 1):
        result = subprocess.run(
            [
                "docker", "exec", container_name,
                "psql", "-U", user, "-d", database, "-c", "SELECT 1"
            ],
            capture_output=True
        )

        if result.returncode == 0:
            return True

        time.sleep(delay_seconds)

    return False


def pgvector_exec_sql(
    container_name: str,
    user: str,
    database: str,
    sql: str
) -> subprocess.CompletedProcess:
    """Execute SQL in the pgvector container.

    Args:
        container_name: The container name.
        user: The PostgreSQL username.
        database: The PostgreSQL database name.
        sql: The SQL command to execute.

    Returns:
        The completed process result.
    """
    return subprocess.run(
        [
            "docker", "exec", container_name,
            "psql", "-U", user, "-d", database, "-c", sql
        ],
        capture_output=True,
        text=True
    )


def pgvector_stop_container(container_name: str) -> bool:
    """Stop and remove a pgvector container.

    Args:
        container_name: The container name.

    Returns:
        True if successful, False otherwise.
    """
    result = subprocess.run(
        ["docker", "rm", "-f", container_name],
        capture_output=True
    )
    return result.returncode == 0