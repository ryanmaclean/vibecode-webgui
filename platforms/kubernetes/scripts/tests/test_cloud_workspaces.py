#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for Cloud Workspace smoke test scripts."""

import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from platforms.kubernetes.scripts.cloud_workspaces.smoke_test import (
    Color,
    SmokeTestConfig,
    SmokeTestRunner,
    log_info,
    log_warn,
    log_error,
    parse_args,
)


class TestColor(unittest.TestCase):
    """Tests for Color class."""

    def test_color_codes_defined(self):
        """Test that color codes are defined."""
        self.assertIsNotNone(Color.RED)
        self.assertIsNotNone(Color.GREEN)
        self.assertIsNotNone(Color.YELLOW)
        self.assertIsNotNone(Color.NC)


class TestSmokeTestConfig(unittest.TestCase):
    """Tests for SmokeTestConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = SmokeTestConfig()
        self.assertEqual(config.test_namespace, "vibecode-test")
        self.assertEqual(config.cluster_name, "vibecode-smoke-test")
        self.assertFalse(config.keep_cluster)
        self.assertTrue(config.cleanup)
        self.assertIsNone(config.script_dir)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = SmokeTestConfig(
            test_namespace="custom-test",
            cluster_name="custom-cluster",
            keep_cluster=True,
            cleanup=False,
        )
        self.assertEqual(config.test_namespace, "custom-test")
        self.assertEqual(config.cluster_name, "custom-cluster")
        self.assertTrue(config.keep_cluster)
        self.assertFalse(config.cleanup)


class TestLoggingFunctions(unittest.TestCase):
    """Tests for logging functions."""

    @patch('builtins.print')
    def test_log_info(self, mock_print):
        """Test log_info function."""
        log_info("Test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Test message", call_args)
        self.assertIn("[INFO]", call_args)

    @patch('builtins.print')
    def test_log_warn(self, mock_print):
        """Test log_warn function."""
        log_warn("Warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Warning message", call_args)
        self.assertIn("[WARN]", call_args)

    @patch('builtins.print')
    def test_log_error(self, mock_print):
        """Test log_error function."""
        log_error("Error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Error message", call_args)
        self.assertIn("[ERROR]", call_args)


class TestSmokeTestRunner(unittest.TestCase):
    """Tests for SmokeTestRunner class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = SmokeTestConfig()
        self.runner = SmokeTestRunner(self.config)

    def test_initialization(self):
        """Test runner initialization."""
        self.assertEqual(self.runner.failed_tests, 0)
        self.assertEqual(self.runner.config.test_namespace, "vibecode-test")

    @patch('shutil.which')
    def test_check_prerequisites_all_found(self, mock_which):
        """Test check_prerequisites when all tools are found."""
        mock_which.return_value = "/usr/bin/tool"
        result = self.runner.check_prerequisites()
        self.assertTrue(result)

    @patch('shutil.which')
    def test_check_prerequisites_missing_tools(self, mock_which):
        """Test check_prerequisites when tools are missing."""
        mock_which.return_value = None
        result = self.runner.check_prerequisites()
        self.assertFalse(result)

    @patch('subprocess.run')
    def test_cleanup_cluster(self, mock_run):
        """Test cleanup_cluster method."""
        mock_run.return_value = MagicMock(returncode=0)
        self.runner.cleanup_cluster()
        mock_run.assert_called()

    @patch('subprocess.run')
    def test_get_pod_name(self, mock_run):
        """Test get_pod_name method."""
        mock_run.return_value = MagicMock(returncode=0, stdout="test-pod-123")
        pod_name = self.runner.get_pod_name()
        self.assertEqual(pod_name, "test-pod-123")


class TestParseArgs(unittest.TestCase):
    """Tests for parse_args function."""

    @patch('sys.argv', ['smoke_test.py'])
    def test_default_args(self):
        """Test parsing with default arguments."""
        config = parse_args()
        self.assertFalse(config.keep_cluster)
        self.assertTrue(config.cleanup)

    @patch('sys.argv', ['smoke_test.py', '--keep'])
    def test_keep_flag(self):
        """Test parsing with --keep flag."""
        config = parse_args()
        self.assertTrue(config.keep_cluster)

    @patch('sys.argv', ['smoke_test.py', '--no-cleanup'])
    def test_no_cleanup_flag(self):
        """Test parsing with --no-cleanup flag."""
        config = parse_args()
        self.assertFalse(config.cleanup)


if __name__ == '__main__':
    unittest.main()