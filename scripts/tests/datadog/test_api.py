"""Python rewrite of scripts/tests/datadog/test-api.sh."""

from __future__ import annotations

from urllib import error, request

import pytest

PRODUCTION_BASE = "https://vibecode.eastus2.cloudapp.azure.com"


def _fetch(url: str, method: str = "GET") -> request.addinfourl:
    req = request.Request(url, method=method)
    return request.urlopen(req, timeout=10)  # nosec B310 - intentional external hit


def test_production_health_endpoint_accessible() -> None:
    url = f"{PRODUCTION_BASE}/api/health"
    try:
        with _fetch(url) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="replace")
    except error.URLError as exc:
        pytest.skip(f"Production API unreachable: {exc}")
    assert status == 200, f"Unexpected status {status}"
    assert "status" in body.lower()


def test_trace_headers_present() -> None:
    url = f"{PRODUCTION_BASE}/api/health"
    try:
        with _fetch(url, method="HEAD") as resp:
            headers = dict(resp.getheaders())
    except error.URLError as exc:
        pytest.skip(f"Production API unreachable: {exc}")
    trace_headers = [key for key in headers if "trace" in key.lower() or "datadog" in key.lower()]
    assert trace_headers, "No trace headers found"


def test_database_health_endpoint() -> None:
    url = f"{PRODUCTION_BASE}/api/database/health"
    try:
        with _fetch(url) as resp:
            status = resp.status
    except error.URLError as exc:
        pytest.skip(f"Database health endpoint unreachable: {exc}")
    assert status == 200

