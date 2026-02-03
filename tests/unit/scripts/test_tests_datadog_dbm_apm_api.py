"""Tests for scripts/tests/datadog/test_dbm_apm_api.py"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "tests" / "datadog"))

from test_dbm_apm_api import (
    EndpointResult,
    ApiTestConfig,
    ApiTestSummary,
    generate_traces,
    log_error,
    log_info,
    log_success,
    log_warning,
    run_tests,
    check_database,
    check_endpoint,
)


class TestApiTestConfig:
    """Tests for ApiTestConfig dataclass."""

    def test_default_endpoints(self) -> None:
        """Should have default endpoints."""
        config = ApiTestConfig()
        assert len(config.endpoints) == 3
        assert "localhost" in config.endpoints[1]

    def test_default_paths(self) -> None:
        """Should have default paths."""
        config = ApiTestConfig()
        assert "/api/health" in config.paths
        assert "/api/status" in config.paths

    def test_default_db_paths(self) -> None:
        """Should have default database paths."""
        config = ApiTestConfig()
        assert "/api/database/health" in config.db_paths

    def test_default_trace_paths(self) -> None:
        """Should have default trace paths."""
        config = ApiTestConfig()
        assert "/api/health" in config.trace_paths

    def test_default_timeout(self) -> None:
        """Should have default timeout."""
        config = ApiTestConfig()
        assert config.timeout == 10

    def test_default_user_agent(self) -> None:
        """Should have default user agent."""
        config = ApiTestConfig()
        assert "DBM-APM" in config.user_agent

    def test_custom_config(self) -> None:
        """Should accept custom values."""
        config = ApiTestConfig(
            endpoints=["http://custom:8080"],
            timeout=30,
        )
        assert config.endpoints == ["http://custom:8080"]
        assert config.timeout == 30


class TestEndpointResult:
    """Tests for EndpointResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create endpoint result."""
        result = EndpointResult(url="http://test", success=True)
        assert result.url == "http://test"
        assert result.success is True

    def test_default_values(self) -> None:
        """Should have default values."""
        result = EndpointResult(url="http://test", success=False)
        assert result.status_code is None
        assert result.response_time == 0.0
        assert result.response_body == ""
        assert result.error is None
        assert result.has_trace_headers is False
        assert result.has_database_content is False
        assert result.has_trace_content is False


class TestApiTestSummary:
    """Tests for ApiTestSummary dataclass."""

    def test_default_values(self) -> None:
        """Should have default values."""
        summary = ApiTestSummary()
        assert summary.successful_tests == 0
        assert summary.total_tests == 0
        assert summary.db_connected is False
        assert summary.traces_generated == 0


class TestLogFunctions:
    """Tests for log functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should print info message."""
        log_info("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        log_success("Success")
        captured = capsys.readouterr()
        assert "Success" in captured.out

    def test_log_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning message."""
        log_warning("Warning")
        captured = capsys.readouterr()
        assert "Warning" in captured.out

    def test_log_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error message."""
        log_error("Error")
        captured = capsys.readouterr()
        assert "Error" in captured.out


class TestTestEndpoint:
    """Tests for check_endpoint function."""

    @patch("test_dbm_apm_api.urlopen")
    def test_successful_request(self, mock_urlopen: MagicMock) -> None:
        """Should handle successful request."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b"OK"
        mock_response.headers = {}
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        config = ApiTestConfig(timeout=5)
        result = check_endpoint("http://localhost", "/health", config)

        assert result.success is True
        assert result.status_code == 200

    @patch("test_dbm_apm_api.urlopen")
    def test_detects_database_content(self, mock_urlopen: MagicMock) -> None:
        """Should detect database-related content."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b'{"database": "connected"}'
        mock_response.headers = {}
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        config = ApiTestConfig()
        result = check_endpoint("http://localhost", "/health", config)

        assert result.has_database_content is True

    @patch("test_dbm_apm_api.urlopen")
    def test_detects_trace_content(self, mock_urlopen: MagicMock) -> None:
        """Should detect trace-related content."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b'{"trace_id": "123"}'
        mock_response.headers = {}
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        config = ApiTestConfig()
        result = check_endpoint("http://localhost", "/health", config)

        assert result.has_trace_content is True

    @patch("test_dbm_apm_api.urlopen")
    def test_handles_connection_error(self, mock_urlopen: MagicMock) -> None:
        """Should handle connection error."""
        from urllib.error import URLError
        mock_urlopen.side_effect = URLError("Connection refused")

        config = ApiTestConfig()
        result = check_endpoint("http://localhost", "/health", config)

        assert result.success is False
        assert result.error is not None

    @patch("test_dbm_apm_api.urlopen")
    def test_handles_timeout(self, mock_urlopen: MagicMock) -> None:
        """Should handle timeout."""
        mock_urlopen.side_effect = TimeoutError()

        config = ApiTestConfig()
        result = check_endpoint("http://localhost", "/health", config)

        assert result.success is False
        assert result.error == "Timeout"


class TestTestDatabase:
    """Tests for check_database function."""

    @patch("test_dbm_apm_api.check_endpoint")
    def test_returns_true_on_success(self, mock_test: MagicMock) -> None:
        """Should return True when database endpoint found."""
        mock_test.return_value = EndpointResult(url="test", success=True)

        config = ApiTestConfig()
        result = check_database("http://localhost", config)

        assert result is True

    @patch("test_dbm_apm_api.check_endpoint")
    def test_returns_false_on_all_failures(self, mock_test: MagicMock) -> None:
        """Should return False when all endpoints fail."""
        mock_test.return_value = EndpointResult(url="test", success=False)

        config = ApiTestConfig()
        result = check_database("http://localhost", config)

        assert result is False

    @patch("test_dbm_apm_api.check_endpoint")
    def test_tries_all_db_paths(self, mock_test: MagicMock) -> None:
        """Should try all database paths."""
        mock_test.return_value = EndpointResult(url="test", success=False)

        config = ApiTestConfig(db_paths=["/db1", "/db2", "/db3"])
        check_database("http://localhost", config)

        assert mock_test.call_count == 3


class TestGenerateTraces:
    """Tests for generate_traces function."""

    @patch("test_dbm_apm_api.check_endpoint")
    def test_counts_successful_traces(self, mock_test: MagicMock) -> None:
        """Should count successful trace requests."""
        mock_test.return_value = EndpointResult(url="test", success=True)

        config = ApiTestConfig(trace_paths=["/t1", "/t2", "/t3"])
        count = generate_traces("http://localhost", config)

        assert count == 3

    @patch("test_dbm_apm_api.check_endpoint")
    def test_counts_partial_success(self, mock_test: MagicMock) -> None:
        """Should count only successful traces."""
        mock_test.side_effect = [
            EndpointResult(url="test", success=True),
            EndpointResult(url="test", success=False),
            EndpointResult(url="test", success=True),
        ]

        config = ApiTestConfig(trace_paths=["/t1", "/t2", "/t3"])
        count = generate_traces("http://localhost", config)

        assert count == 2


class TestRunTests:
    """Tests for run_tests function."""

    @patch("test_dbm_apm_api.generate_traces")
    @patch("test_dbm_apm_api.check_database")
    @patch("test_dbm_apm_api.check_endpoint")
    def test_returns_summary(
        self,
        mock_endpoint: MagicMock,
        mock_db: MagicMock,
        mock_traces: MagicMock,
    ) -> None:
        """Should return test summary."""
        mock_endpoint.return_value = EndpointResult(url="test", success=True)
        mock_db.return_value = True
        mock_traces.return_value = 3

        config = ApiTestConfig(
            endpoints=["http://localhost"],
            paths=["/health"],
        )
        summary = run_tests(config)

        assert isinstance(summary, ApiTestSummary)
        assert summary.successful_tests > 0
        assert summary.db_connected is True

    @patch("test_dbm_apm_api.generate_traces")
    @patch("test_dbm_apm_api.check_database")
    @patch("test_dbm_apm_api.check_endpoint")
    def test_handles_all_failures(
        self,
        mock_endpoint: MagicMock,
        mock_db: MagicMock,
        mock_traces: MagicMock,
    ) -> None:
        """Should handle all endpoint failures."""
        mock_endpoint.return_value = EndpointResult(url="test", success=False)
        mock_db.return_value = False
        mock_traces.return_value = 0

        config = ApiTestConfig(
            endpoints=["http://localhost"],
            paths=["/health"],
        )
        summary = run_tests(config)

        assert summary.successful_tests == 0
        assert summary.db_connected is False

    def test_uses_default_config(self) -> None:
        """Should use default config when None."""
        with patch("test_dbm_apm_api.check_endpoint") as mock_endpoint:
            with patch("test_dbm_apm_api.check_database") as mock_db:
                with patch("test_dbm_apm_api.generate_traces") as mock_traces:
                    mock_endpoint.return_value = EndpointResult(url="test", success=False)
                    mock_db.return_value = False
                    mock_traces.return_value = 0

                    summary = run_tests(None)

                    assert isinstance(summary, ApiTestSummary)
