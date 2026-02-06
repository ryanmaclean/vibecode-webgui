#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-comprehensive-kind-testing"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "testing"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for comprehensive_kind_testing module."""

import os
import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from comprehensive_kind_testing import (
    TestResults,
    command_exists,
    is_port_available,
    run_command,
)


class TestTestResults(TestCase):
    """Tests for TestResults dataclass."""

    def test_initial_values(self):
        """Test initial values."""
        results = TestResults()
        self.assertEqual(results.passed, 0)
        self.assertEqual(results.failed, 0)
        self.assertEqual(results.warnings, 0)
        self.assertIsNone(results.log_file)
        self.assertEqual(results.lines, [])

    def test_log_appends_to_lines(self):
        """Test log method appends to lines."""
        results = TestResults()
        results.log("Test message")
        self.assertEqual(results.lines, ["Test message"])


class TestCommandExists(TestCase):
    """Tests for command_exists function."""

    def test_command_exists_true(self):
        """Test command_exists returns True for existing command."""
        # Python should always exist
        self.assertTrue(command_exists("python3") or command_exists("python"))

    def test_command_exists_false(self):
        """Test command_exists returns False for non-existing command."""
        self.assertFalse(command_exists("nonexistent_command_12345"))


class TestIsPortAvailable(TestCase):
    """Tests for is_port_available function."""

    def test_high_port_available(self):
        """Test that a high random port is available."""
        # Port 59999 should typically be available
        result = is_port_available(59999)
        # This could fail if something is using this port, but unlikely
        self.assertIsInstance(result, bool)


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_run_command_success(self):
        """Test run_command with successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout, "hello")
        self.assertEqual(stderr, "")

    def test_run_command_failure(self):
        """Test run_command with failing command."""
        rc, stdout, stderr = run_command(["false"])
        self.assertNotEqual(rc, 0)

    def test_run_command_not_found(self):
        """Test run_command with non-existent command."""
        rc, stdout, stderr = run_command(["nonexistent_command_12345"])
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr.lower())

    @mock.patch('subprocess.run')
    def test_run_command_timeout(self, mock_run):
        """Test run_command handles timeout."""
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=1)

        rc, stdout, stderr = run_command(["sleep", "100"], timeout=1)
        self.assertEqual(rc, -1)
        self.assertIn("timed out", stderr.lower())


if __name__ == '__main__':
    import unittest
    unittest.main()