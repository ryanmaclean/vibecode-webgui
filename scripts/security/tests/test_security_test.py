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