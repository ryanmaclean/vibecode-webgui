
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

import sys

import pytest

from scripts.lib import datadog_logging


class StubTransport(datadog_logging.HTTPTransport):
    def __init__(self):
        self.calls = []

    def post(self, url, payload, headers, timeout=5):
        self.calls.append({
            "url": url,
            "payload": payload,
            "headers": headers,
            "timeout": timeout,
        })


@pytest.fixture(autouse=True)
def _argv(monkeypatch):
    monkeypatch.setenv("DD_SERVICE", "svc")
    monkeypatch.setenv("DD_ENV", "test")
    monkeypatch.setenv("DD_VERSION", "v1")
    monkeypatch.delenv("DD_API_KEY", raising=False)
    monkeypatch.delenv("DATADOG_API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["script.py"])


def test_log_sends_payload_when_api_key(monkeypatch):
    stub = StubTransport()
    logger = datadog_logging.DatadogLogger(api_key="abc123", transport=stub, site="example.com")

    logger.info("hello", tags=["foo:bar"])

    assert stub.calls
    call = stub.calls[0]
    assert call["url"] == "https://http-intake.logs.example.com/v1/input/abc123"
    assert call["payload"]["message"] == "hello"
    assert "foo:bar" in call["payload"]["ddtags"]


def test_log_falls_back_to_stdout_when_api_key_missing(capsys):
    logger = datadog_logging.DatadogLogger()
    logger.info("local-message")
    captured = capsys.readouterr()
    assert "local-message" in captured.out


def test_metric_sends_series(monkeypatch):
    stub = StubTransport()
    logger = datadog_logging.DatadogLogger(api_key="xyz", transport=stub, site="datadoghq.eu")

    logger.metric("test.metric", 42, metric_type="count", tags=["foo:bar"])

    assert stub.calls
    call = stub.calls[0]
    assert call["url"] == "https://api.datadoghq.eu/api/v1/series"
    series = call["payload"]["series"][0]
    assert series["metric"] == "test.metric"
    assert "foo:bar" in series["tags"]