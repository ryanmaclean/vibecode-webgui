#!/usr/bin/env python3
"""Helpers for working with pgvector containers in tests."""

from __future__ import annotations

import subprocess
import time

# Datadog APM tracing
try:
    from ddtrace import tracer
except ImportError:
    tracer = None  # type: ignore


class PgVectorError(RuntimeError):
    pass


def start_container(
    container_name: str,
    host_port: int,
    database: str,
    user: str,
    password: str,
    image: str = "ankane/pgvector",
    docker_bin: str = "docker",
) -> None:
    subprocess.run([docker_bin, "rm", "-f", container_name], check=False, stdout=subprocess.DEVNULL)
    cmd = [
        docker_bin,
        "run",
        "--name",
        container_name,
        "-e",
        f"POSTGRES_DB={database}",
        "-e",
        f"POSTGRES_USER={user}",
        "-e",
        f"POSTGRES_PASSWORD={password}",
        "-p",
        f"{host_port}:5432",
        "-d",
        image,
    ]
    subprocess.run(cmd, check=True)


def wait_for_start(
    container_name: str,
    user: str,
    database: str,
    retries: int = 10,
    delay_seconds: int = 2,
    docker_bin: str = "docker",
) -> bool:
    for _ in range(retries):
        result = subprocess.run(
            [docker_bin, "exec", container_name, "psql", "-U", user, "-d", database, "-c", "SELECT 1"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode == 0:
            return True
        time.sleep(delay_seconds)
    raise PgVectorError(f"Timed out waiting for container {container_name} to start")


def exec_sql(
    container_name: str,
    user: str,
    database: str,
    sql: str,
    docker_bin: str = "docker",
) -> subprocess.CompletedProcess:
    return subprocess.run(
        [docker_bin, "exec", container_name, "psql", "-U", user, "-d", database, "-c", sql],
        check=True,
    )


__all__ = ["PgVectorError", "start_container", "wait_for_start", "exec_sql"]
