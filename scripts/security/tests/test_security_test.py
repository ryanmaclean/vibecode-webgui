#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-security-test"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
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
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for security testing script."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.test import (
    Color,
    TestResult,
    check_dependencies,
    print_status,
)


class TestColor(unittest.TestCase):
    """Tests for Color class."""

    def test_color_codes_defined(self):
        """Test that all color codes are defined."""
        self.assertIsNotNone(Color.RED)
        self.assertIsNotNone(Color.GREEN)
        self.assertIsNotNone(Color.YELLOW)
        self.assertIsNotNone(Color.BLUE)
        self.assertIsNotNone(Color.NC)


class TestTestResult(unittest.TestCase):
    """Tests for TestResult dataclass."""

    def test_required_fields(self):
        """Test creating TestResult with required fields."""
        result = TestResult(name="test", passed=True, message="success")
        self.assertEqual(result.name, "test")
        self.assertTrue(result.passed)
        self.assertEqual(result.message, "success")
        self.assertIsNone(result.details)

    def test_optional_details(self):
        """Test TestResult with optional details."""
        result = TestResult(
            name="test",
            passed=False,
            message="failed",
            details="error details"
        )
        self.assertEqual(result.details, "error details")


class TestCheckDependencies(unittest.TestCase):
    """Tests for check_dependencies function."""

    @patch('shutil.which')
    def test_npm_not_found(self, mock_which):
        """Test when npm is not found."""
        mock_which.return_value = None
        result = check_dependencies()
        self.assertEqual(result.name, "dependencies")
        self.assertFalse(result.passed)

    @patch('shutil.which')
    def test_npm_found(self, mock_which):
        """Test when npm is found."""
        def which_side_effect(cmd):
            if cmd == "npm":
                return "/usr/bin/npm"
            return None
        mock_which.side_effect = which_side_effect
        result = check_dependencies()
        self.assertEqual(result.name, "dependencies")
        self.assertTrue(result.passed)


class TestPrintStatus(unittest.TestCase):
    """Tests for print_status function."""

    @patch('builtins.print')
    def test_success_status(self, mock_print):
        """Test printing success status."""
        print_status("success", "Test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Test message", call_args)

    @patch('builtins.print')
    def test_error_status(self, mock_print):
        """Test printing error status."""
        print_status("error", "Error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Error message", call_args)


if __name__ == '__main__':
    unittest.main()