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

"""Tests for script_logging module."""

import io
import sys
from unittest import TestCase, mock

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from script_logging import (
    log_info,
    log_success,
    log_warn,
    log_warning,
    log_error,
    log_step,
    disable_colors,
    enable_colors,
    LOG_COLOR_BLUE,
    LOG_COLOR_GREEN,
    LOG_COLOR_YELLOW,
    LOG_COLOR_RED,
    LOG_COLOR_RESET,
)


class TestColorCodes(TestCase):
    """Tests for color codes."""

    def test_color_codes_defined(self):
        """Test that color codes are defined."""
        self.assertEqual(LOG_COLOR_RED, '\033[0;31m')
        self.assertEqual(LOG_COLOR_GREEN, '\033[0;32m')
        self.assertEqual(LOG_COLOR_YELLOW, '\033[0;33m')
        self.assertEqual(LOG_COLOR_BLUE, '\033[0;34m')
        self.assertEqual(LOG_COLOR_RESET, '\033[0m')


class TestLogInfo(TestCase):
    """Tests for log_info function."""

    def setUp(self):
        """Set up test fixtures."""
        enable_colors()

    def test_log_info_with_colors(self):
        """Test log_info with colors enabled."""
        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_info("Test message")
            output = mock_stdout.getvalue()

        self.assertIn("INFO:", output)
        self.assertIn("Test message", output)
        self.assertIn(LOG_COLOR_BLUE, output)

    def test_log_info_without_colors(self):
        """Test log_info with colors disabled."""
        disable_colors()
        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_info("Test message")
            output = mock_stdout.getvalue()

        self.assertIn("INFO:", output)
        self.assertIn("Test message", output)
        self.assertNotIn('\033[', output)
        enable_colors()


class TestLogSuccess(TestCase):
    """Tests for log_success function."""

    def setUp(self):
        """Set up test fixtures."""
        enable_colors()

    def test_log_success_with_colors(self):
        """Test log_success with colors enabled."""
        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_success("Operation completed")
            output = mock_stdout.getvalue()

        self.assertIn("SUCCESS:", output)
        self.assertIn("Operation completed", output)
        self.assertIn(LOG_COLOR_GREEN, output)


class TestLogWarn(TestCase):
    """Tests for log_warn function."""

    def setUp(self):
        """Set up test fixtures."""
        enable_colors()

    def test_log_warn_with_colors(self):
        """Test log_warn with colors enabled."""
        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_warn("Warning message")
            output = mock_stdout.getvalue()

        self.assertIn("WARNING:", output)
        self.assertIn("Warning message", output)
        self.assertIn(LOG_COLOR_YELLOW, output)

    def test_log_warning_alias(self):
        """Test log_warning is alias for log_warn."""
        self.assertEqual(log_warning, log_warn)


class TestLogError(TestCase):
    """Tests for log_error function."""

    def setUp(self):
        """Set up test fixtures."""
        enable_colors()

    def test_log_error_with_colors(self):
        """Test log_error with colors enabled."""
        with mock.patch('sys.stderr', new_callable=io.StringIO) as mock_stderr:
            log_error("Error message")
            output = mock_stderr.getvalue()

        self.assertIn("ERROR:", output)
        self.assertIn("Error message", output)
        self.assertIn(LOG_COLOR_RED, output)

    def test_log_error_to_stderr(self):
        """Test log_error outputs to stderr."""
        with mock.patch('sys.stderr', new_callable=io.StringIO) as mock_stderr:
            with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
                log_error("Error message")
                stderr_output = mock_stderr.getvalue()
                stdout_output = mock_stdout.getvalue()

        self.assertIn("Error message", stderr_output)
        self.assertEqual(stdout_output, "")


class TestLogStep(TestCase):
    """Tests for log_step function."""

    def setUp(self):
        """Set up test fixtures."""
        enable_colors()

    def test_log_step_with_colors(self):
        """Test log_step with colors enabled."""
        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_step("Step description")
            output = mock_stdout.getvalue()

        self.assertIn("==>", output)
        self.assertIn("Step description", output)
        self.assertIn(LOG_COLOR_GREEN, output)


class TestColorToggle(TestCase):
    """Tests for color toggle functions."""

    def test_disable_colors(self):
        """Test disabling colors."""
        enable_colors()
        disable_colors()
        
        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_info("Test")
            output = mock_stdout.getvalue()

        self.assertNotIn('\033[', output)

    def test_enable_colors(self):
        """Test enabling colors."""
        disable_colors()
        enable_colors()

        with mock.patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            log_info("Test")
            output = mock_stdout.getvalue()

        self.assertIn('\033[', output)


if __name__ == '__main__':
    import unittest
    unittest.main()