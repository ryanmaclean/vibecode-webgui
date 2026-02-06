#!/usr/bin/env python3
try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


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

"""Tests for error_tracking module."""

import os
import sys
from unittest import TestCase, mock

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

import error_tracking
from error_tracking import (
    _get_timestamp,
    _get_hostname,
    _get_username,
    log_error_to_datadog,
    track_script_start,
    track_script_completion,
    track_command_execution,
    safe_execute,
    track_performance_metric,
    check_error_tracking_availability,
    ErrorTracker,
    init_error_tracking,
    DD_SERVICE,
    DD_ENV,
    DD_VERSION,
)


class TestConfiguration(TestCase):
    """Tests for configuration defaults."""

    def test_dd_service_default(self):
        """Test default DD_SERVICE value."""
        self.assertEqual(DD_SERVICE, os.environ.get("DD_SERVICE", "vibecode-webgui"))

    def test_dd_env_default(self):
        """Test default DD_ENV value."""
        expected = os.environ.get("DD_ENV", os.environ.get("NODE_ENV", "development"))
        self.assertEqual(DD_ENV, expected)

    def test_dd_version_default(self):
        """Test default DD_VERSION value."""
        self.assertEqual(DD_VERSION, os.environ.get("DD_VERSION", "1.0.0"))


class TestGetTimestamp(TestCase):
    """Tests for _get_timestamp function."""

    def test_timestamp_format(self):
        """Test timestamp format."""
        timestamp = _get_timestamp()
        
        # Should be in ISO format with Z suffix
        self.assertTrue(timestamp.endswith("Z"))
        self.assertIn("T", timestamp)


class TestGetHostname(TestCase):
    """Tests for _get_hostname function."""

    def test_hostname_not_empty(self):
        """Test hostname is not empty."""
        hostname = _get_hostname()
        self.assertTrue(len(hostname) > 0)


class TestGetUsername(TestCase):
    """Tests for _get_username function."""

    def test_username_not_empty(self):
        """Test username is not empty."""
        username = _get_username()
        self.assertTrue(len(username) > 0)


class TestLogErrorToDatadog(TestCase):
    """Tests for log_error_to_datadog function."""

    def test_returns_false_without_api_key(self):
        """Test returns False when API key not set."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            result = error_tracking.log_error_to_datadog("Test error")
            self.assertFalse(result)


class TestTrackScriptStart(TestCase):
    """Tests for track_script_start function."""

    def test_returns_false_without_api_key(self):
        """Test returns False when API key not set."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            result = error_tracking.track_script_start()
            self.assertFalse(result)


class TestTrackScriptCompletion(TestCase):
    """Tests for track_script_completion function."""

    def test_returns_false_without_api_key(self):
        """Test returns False when API key not set."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            result = error_tracking.track_script_completion()
            self.assertFalse(result)


class TestTrackCommandExecution(TestCase):
    """Tests for track_command_execution function."""

    def test_returns_false_without_api_key(self):
        """Test returns False when API key not set."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            result = error_tracking.track_command_execution("echo hello")
            self.assertFalse(result)


class TestSafeExecute(TestCase):
    """Tests for safe_execute function."""

    @mock.patch('subprocess.run')
    def test_safe_execute_success(self, mock_run):
        """Test safe_execute with successful command."""
        mock_run.return_value = mock.Mock(returncode=0, stdout="output", stderr="")
        
        result = safe_execute("echo hello")
        
        self.assertEqual(result, 0)

    @mock.patch('subprocess.run')
    def test_safe_execute_failure(self, mock_run):
        """Test safe_execute with failed command."""
        mock_run.return_value = mock.Mock(returncode=1, stdout="", stderr="error")
        
        result = safe_execute("false")
        
        self.assertEqual(result, 1)


class TestTrackPerformanceMetric(TestCase):
    """Tests for track_performance_metric function."""

    def test_returns_false_without_api_key(self):
        """Test returns False when API key not set."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            result = error_tracking.track_performance_metric("test_metric", 100.0)
            self.assertFalse(result)


class TestCheckErrorTrackingAvailability(TestCase):
    """Tests for check_error_tracking_availability function."""

    def test_returns_false_without_api_key(self):
        """Test returns False when API key not set."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            result = error_tracking.check_error_tracking_availability()
            self.assertFalse(result)


class TestErrorTracker(TestCase):
    """Tests for ErrorTracker class."""

    def test_error_tracker_context_manager(self):
        """Test ErrorTracker as context manager."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            
            with error_tracking.ErrorTracker("test") as tracker:
                self.assertEqual(tracker.component, "test")

    def test_error_tracker_exception_handling(self):
        """Test ErrorTracker handles exceptions."""
        with mock.patch.dict(os.environ, {"DD_API_KEY": ""}, clear=False):
            import importlib
            importlib.reload(error_tracking)
            
            with self.assertRaises(ValueError):
                with error_tracking.ErrorTracker("test"):
                    raise ValueError("Test error")


class TestInitErrorTracking(TestCase):
    """Tests for init_error_tracking function."""

    def test_returns_error_tracker(self):
        """Test init_error_tracking returns ErrorTracker."""
        tracker = error_tracking.init_error_tracking("test")
        self.assertIsInstance(tracker, error_tracking.ErrorTracker)
        self.assertEqual(tracker.component, "test")


if __name__ == '__main__':
    import unittest
    unittest.main()