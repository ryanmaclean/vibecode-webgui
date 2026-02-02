

"""Pytest version of the DBM-APM API validation shell script."""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

from dataclasses import dataclass
from typing import List, Mapping, Optional

import pytest

from python_helpers import env_flag, http_request_safe

ENDPOINTS = [
    "https://vibecode.eastus2.cloudapp.azure.com",
    "http://localhost:3000",
    "http://localhost:8080",
]

PATHS = [
    "/api/health",
    "/api/status",
    "/health",
    "/api/database/test",
]

DATABASE_PATHS = [
    "/api/database/health",
    "/api/db/test",
    "/api/health/db",
    "/api/database/status",
]

TRACE_PATHS = [
    "/api/health",
    "/api/status",
    "/api/trace-test",
]


@dataclass
class RequestResult:
    endpoint: str
    path: str
    status: Optional[int]
    headers: Mapping[str, str]
    body: str


def _require_live_flag():
    if not env_flag("RUN_DBM_APM_TESTS"):
        pytest.skip("Set RUN_DBM_APM_TESTS=1 to exercise live DBM-APM endpoints")


def _query(endpoint: str, path: str) -> RequestResult:
    status, headers, body = http_request_safe(
        f"{endpoint}{path}",
        headers={"User-Agent": "DBM-APM-Test/1.0", "X-Test-Source": "dbm-apm-validation"},
        timeout=6,
    )
    return RequestResult(endpoint, path, status, headers, body)


def _has_trace_headers(headers: Mapping[str, str]) -> bool:
    header_text = " ".join(f"{key}:{value}" for key, value in headers.items()).lower()
    return any(token in header_text for token in ("datadog", "trace", "span"))


@pytest.fixture(scope="module")
def dbm_apm_results() -> List[RequestResult]:
    _require_live_flag()
    results: List[RequestResult] = []
    for endpoint in ENDPOINTS:
        for path in PATHS:
            results.append(_query(endpoint, path))
    successes = [r for r in results if r.status and 200 <= r.status < 400]
    if not successes:
        pytest.fail("DBM-APM API validation could not reach any endpoints")
    return results


@pytest.mark.network
def test_dmb_apm_primary_endpoints(dbm_apm_results: List[RequestResult]):
    assert any(r.status and 200 <= r.status < 400 for r in dbm_apm_results), (
        "Expected at least one healthy API response"
    )


@pytest.mark.network
def test_dbm_apm_trace_headers_present(dbm_apm_results: List[RequestResult]):
    assert any(_has_trace_headers(r.headers) for r in dbm_apm_results if r.status), (
        "Expected Datadog trace headers in at least one response"
    )


@pytest.mark.network
def test_database_paths_reachable():
    _require_live_flag()
    successes = 0
    for endpoint in ENDPOINTS:
        for path in DATABASE_PATHS:
            result = _query(endpoint, path)
            if result.status and 200 <= result.status < 400:
                successes += 1
                break
        if successes:
            break
    assert successes, "Expected at least one database-specific endpoint to respond"


@pytest.mark.network
def test_trace_generation_paths():
    _require_live_flag()
    generated = 0
    for endpoint in ENDPOINTS:
        for path in TRACE_PATHS:
            result = _query(endpoint, path)
            if result.status and 200 <= result.status < 400:
                generated += 1
    assert generated, "Expected to generate trace traffic through at least one endpoint"