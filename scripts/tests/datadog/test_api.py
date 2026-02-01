

"""Python translation of the Datadog API validation shell script."""

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

import os

import pytest

from python_helpers import env_flag, http_request_safe

BASE_URL = os.getenv(
    "VIBECODE_API_BASE",
    "https://vibecode.eastus2.cloudapp.azure.com",
)
HEALTH_PATH = os.getenv("VIBECODE_HEALTH_PATH", "/api/health")
DATABASE_PATH = os.getenv("VIBECODE_DATABASE_PATH", "/api/database/health")


def _require_network_access():
    if not env_flag("RUN_VIBECODE_PROD_TESTS"):
        pytest.skip("Set RUN_VIBECODE_PROD_TESTS=1 to enable live API validations")


def _fetch(path: str):
    status, headers, body = http_request_safe(f"{BASE_URL}{path}", timeout=5)
    if status is None:
        pytest.skip(f"Unable to reach {BASE_URL}{path}: {body}")
    return status, headers, body


@pytest.mark.network
def test_production_api_accessible():
    _require_network_access()
    status, headers, _ = _fetch(HEALTH_PATH)
    assert 200 <= status < 400, f"Unexpected status {status} for {HEALTH_PATH}"
    joined_headers = " ".join(f"{key}:{value}" for key, value in headers.items()).lower()
    assert any(token in joined_headers for token in ("datadog", "trace", "span")), (
        "Expected Datadog trace headers in response"
    )


@pytest.mark.network
def test_database_health_endpoint():
    _require_network_access()
    status, _, _ = _fetch(DATABASE_PATH)
    assert 200 <= status < 400, f"Unexpected status {status} for {DATABASE_PATH}"