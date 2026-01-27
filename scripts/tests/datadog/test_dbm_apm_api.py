"""Python rewrite of test-dbm-apm-api.sh."""

from __future__ import annotations

from urllib import error, request

import pytest


BASE_ENDPOINTS = [
    "https://vibecode.eastus2.cloudapp.azure.com",
    "http://localhost:3000",
    "http://localhost:8080",
]

PATHS = ["/api/health", "/api/status", "/health", "/api/database/test"]
DB_PATHS = [
    "/api/database/health",
    "/api/db/test",
    "/api/health/db",
    "/api/database/status",
]


def _try_fetch(url: str) -> tuple[bool, int | None]:
    try:
        with request.urlopen(url, timeout=5) as resp:  # nosec B310
            resp.read()
            return True, resp.status
    except error.URLError:
        return False, None


def test_any_endpoint_is_reachable() -> None:
    successes = []
    for base in BASE_ENDPOINTS:
        for path in PATHS:
            ok, status = _try_fetch(f"{base}{path}")
            if ok and status and 200 <= status < 500:
                successes.append((base, path, status))
    if not successes:
        pytest.skip("No DBM/APM endpoints reachable from test environment")
    assert successes


def test_database_endpoint_probe() -> None:
    successes = []
    for base in BASE_ENDPOINTS:
        for path in DB_PATHS:
            ok, status = _try_fetch(f"{base}{path}")
            if ok and status and 200 <= status < 500:
                successes.append((base, path, status))
                break
    if not successes:
        pytest.skip("No database endpoints reachable")
    assert successes

