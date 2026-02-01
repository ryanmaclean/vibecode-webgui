#!/usr/bin/env python3

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

"""Tests for log_aggregation module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from log_aggregation import (
    LogLevel,
    _get_timestamp,
    _get_script_name,
    init_log_aggregation,
    send_log_to_datadog,
    log_debug,
    log_info,
    log_warn,
    log_error,
    log_script_start,
    log_script_end,
    log_deployment_event,
    log_kubernetes_event,
    log_database_event,
    log_performance_metric,
    LOG_SERVICE_NAME,
    LOG_ENVIRONMENT,
    LOG_VERSION,
)


class TestLogLevel(TestCase):
    """Tests for LogLevel enum."""

    def test_log_level_values(self):
        """Test log level values."""
        self.assertEqual(LogLevel.DEBUG, 0)
        self.assertEqual(LogLevel.INFO, 1)
        self.assertEqual(LogLevel.WARN, 2)
        self.assertEqual(LogLevel.ERROR, 3)


class TestConfiguration(TestCase):
    """Tests for configuration defaults."""

    def test_log_service_name_default(self):
        """Test default LOG_SERVICE_NAME value."""
        self.assertEqual(LOG_SERVICE_NAME, os.environ.get("DD_SERVICE", "vibecode-webgui"))

    def test_log_environment_default(self):
        """Test default LOG_ENVIRONMENT value."""
        self.assertEqual(LOG_ENVIRONMENT, os.environ.get("DD_ENV", "development"))

    def test_log_version_default(self):
        """Test default LOG_VERSION value."""
        self.assertEqual(LOG_VERSION, os.environ.get("DD_VERSION", "1.0.0"))


class TestGetTimestamp(TestCase):
    """Tests for _get_timestamp function."""

    def test_timestamp_format(self):
        """Test timestamp is in ISO format."""
        timestamp = _get_timestamp()
        self.assertIn("T", timestamp)
        self.assertTrue(timestamp.endswith("Z"))


class TestGetScriptName(TestCase):
    """Tests for _get_script_name function."""

    def test_script_name_not_empty(self):
        """Test script name is not empty."""
        script_name = _get_script_name()
        self.assertTrue(len(script_name) > 0)


class TestInitLogAggregation(TestCase):
    """Tests for init_log_aggregation function."""

    def test_init_without_api_key(self):
        """Test init fails without API key."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            import log_aggregation
            importlib.reload(log_aggregation)
            
            result = log_aggregation.init_log_aggregation()
            
            self.assertFalse(result)


class TestSendLogToDatadog(TestCase):
    """Tests for send_log_to_datadog function."""

    def test_send_log_returns_false_when_disabled(self):
        """Test send_log returns False when disabled."""
        with mock.patch.dict(os.environ, {"DD_LOG_AGGREGATION_ENABLED": "false"}, clear=False):
            import importlib
            import log_aggregation
            importlib.reload(log_aggregation)
            
            result = log_aggregation.send_log_to_datadog("INFO", "Test", {})
            
            self.assertFalse(result)


class TestLogFunctions(TestCase):
    """Tests for log functions."""

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('builtins.print')
    def test_log_info(self, mock_print, mock_send):
        """Test log_info function."""
        log_info("Test message")
        mock_print.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('builtins.print')
    def test_log_warn(self, mock_print, mock_send):
        """Test log_warn function."""
        log_warn("Warning message")
        mock_print.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('builtins.print')
    def test_log_error(self, mock_print, mock_send):
        """Test log_error function."""
        log_error("Error message")
        mock_print.assert_called()


class TestStructuredLogFunctions(TestCase):
    """Tests for structured log functions."""

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_info')
    def test_log_script_start(self, mock_log_info, mock_send):
        """Test log_script_start function."""
        log_script_start("test_script.py", "--verbose")
        mock_log_info.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_info')
    def test_log_script_end_success(self, mock_log_info, mock_send):
        """Test log_script_end with success."""
        log_script_end("test_script.py", 0, 1.5)
        mock_log_info.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_error')
    def test_log_script_end_failure(self, mock_log_error, mock_send):
        """Test log_script_end with failure."""
        log_script_end("test_script.py", 1, 2.5)
        mock_log_error.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_info')
    def test_log_deployment_event(self, mock_log_info, mock_send):
        """Test log_deployment_event function."""
        log_deployment_event("deploy", "web-server", "success", "v1.0.0")
        mock_log_info.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_info')
    def test_log_kubernetes_event(self, mock_log_info, mock_send):
        """Test log_kubernetes_event function."""
        log_kubernetes_event("create", "pod", "default", "success")
        mock_log_info.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_info')
    def test_log_database_event(self, mock_log_info, mock_send):
        """Test log_database_event function."""
        log_database_event("migrate", "production", "success", "v2 schema")
        mock_log_info.assert_called()

    @mock.patch('log_aggregation.send_log_to_datadog')
    @mock.patch('log_aggregation.log_debug')
    def test_log_performance_metric(self, mock_log_debug, mock_send):
        """Test log_performance_metric function."""
        log_performance_metric("response_time", 150.0, "ms", "endpoint:api")
        mock_log_debug.assert_called()


if __name__ == '__main__':
    import unittest
    unittest.main()