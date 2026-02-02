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

"""Tests for datadog_logging module."""

import io
import os
import sys
from unittest import TestCase, mock

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from datadog_logging import (
    LogLevel,
    dd_log,
    dd_debug,
    dd_info,
    dd_warn,
    dd_error,
    dd_metric,
    set_log_level,
    _get_hostname,
    _get_script_name,
    _get_timestamp_iso,
    _get_timestamp_unix,
    DD_API_KEY,
    DD_SITE,
    DD_SERVICE,
    DD_ENV,
    DD_VERSION,
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

    def test_dd_site_default(self):
        """Test default DD_SITE value."""
        self.assertEqual(DD_SITE, os.environ.get("DD_SITE", "datadoghq.com"))

    def test_dd_service_default(self):
        """Test default DD_SERVICE value."""
        self.assertEqual(DD_SERVICE, os.environ.get("DD_SERVICE", "vibecode-bash-scripts"))


class TestHelperFunctions(TestCase):
    """Tests for helper functions."""

    def test_get_hostname(self):
        """Test _get_hostname returns a string."""
        hostname = _get_hostname()
        self.assertIsInstance(hostname, str)
        self.assertTrue(len(hostname) > 0)

    def test_get_script_name(self):
        """Test _get_script_name returns a string."""
        script_name = _get_script_name()
        self.assertIsInstance(script_name, str)

    def test_get_timestamp_iso_format(self):
        """Test _get_timestamp_iso returns ISO format."""
        timestamp = _get_timestamp_iso()
        self.assertIn("T", timestamp)
        self.assertTrue(timestamp.endswith("Z"))

    def test_get_timestamp_unix(self):
        """Test _get_timestamp_unix returns an integer."""
        timestamp = _get_timestamp_unix()
        self.assertIsInstance(timestamp, int)
        self.assertGreater(timestamp, 0)


class TestDdLog(TestCase):
    """Tests for dd_log function."""

    def test_dd_log_without_api_key(self):
        """Test dd_log prints to stderr without API key."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            import datadog_logging
            importlib.reload(datadog_logging)
            
            with mock.patch('sys.stderr', new_callable=io.StringIO) as mock_stderr:
                datadog_logging.dd_log("info", "Test message")
                output = mock_stderr.getvalue()
            
            self.assertIn("[DD-BASH] info: Test message", output)


class TestDdDebug(TestCase):
    """Tests for dd_debug function."""

    def test_dd_debug_at_debug_level(self):
        """Test dd_debug logs at DEBUG level."""
        with mock.patch('datadog_logging.DD_CURRENT_LOG_LEVEL', LogLevel.DEBUG):
            with mock.patch('datadog_logging.dd_log') as mock_log:
                dd_debug("Debug message")
                mock_log.assert_called_once()


class TestDdInfo(TestCase):
    """Tests for dd_info function."""

    def test_dd_info_at_info_level(self):
        """Test dd_info logs at INFO level."""
        with mock.patch('datadog_logging.DD_CURRENT_LOG_LEVEL', LogLevel.INFO):
            with mock.patch('datadog_logging.dd_log') as mock_log:
                dd_info("Info message")
                mock_log.assert_called_once()

    def test_dd_info_skipped_at_error_level(self):
        """Test dd_info is skipped at ERROR level."""
        with mock.patch('datadog_logging.DD_CURRENT_LOG_LEVEL', LogLevel.ERROR):
            with mock.patch('datadog_logging.dd_log') as mock_log:
                dd_info("Info message")
                mock_log.assert_not_called()


class TestDdWarn(TestCase):
    """Tests for dd_warn function."""

    def test_dd_warn_at_warn_level(self):
        """Test dd_warn logs at WARN level."""
        with mock.patch('datadog_logging.DD_CURRENT_LOG_LEVEL', LogLevel.WARN):
            with mock.patch('datadog_logging.dd_log') as mock_log:
                dd_warn("Warning message")
                mock_log.assert_called_once()


class TestDdError(TestCase):
    """Tests for dd_error function."""

    def test_dd_error_at_error_level(self):
        """Test dd_error logs at ERROR level."""
        with mock.patch('datadog_logging.DD_CURRENT_LOG_LEVEL', LogLevel.ERROR):
            with mock.patch('datadog_logging.dd_log') as mock_log:
                dd_error("Error message")
                mock_log.assert_called_once()


class TestDdMetric(TestCase):
    """Tests for dd_metric function."""

    def test_dd_metric_without_api_key(self):
        """Test dd_metric prints to stderr without API key."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            import datadog_logging
            importlib.reload(datadog_logging)
            
            with mock.patch('sys.stderr', new_callable=io.StringIO) as mock_stderr:
                datadog_logging.dd_metric("test.metric", 42.0)
                output = mock_stderr.getvalue()
            
            self.assertIn("[DD-METRIC] test.metric = 42.0", output)


class TestSetLogLevel(TestCase):
    """Tests for set_log_level function."""

    def test_set_log_level(self):
        """Test set_log_level updates the log level."""
        import datadog_logging
        
        original = datadog_logging.DD_CURRENT_LOG_LEVEL
        set_log_level(LogLevel.ERROR)
        self.assertEqual(datadog_logging.DD_CURRENT_LOG_LEVEL, LogLevel.ERROR)
        
        # Restore original
        set_log_level(original)


if __name__ == '__main__':
    import unittest
    unittest.main()