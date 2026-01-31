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

"""Tests for AgentAPI deployment scripts."""

import unittest
from unittest.mock import MagicMock, patch

from platforms.kubernetes.scripts.agentapi.deploy import (
    Color,
    DeployConfig,
    check_prerequisites,
    info,
    warn,
    error,
)
from platforms.kubernetes.scripts.agentapi.test import (
    TestConfig,
    DeploymentTester,
)


class TestColor(unittest.TestCase):
    """Tests for Color class."""

    def test_color_codes_defined(self):
        """Test that color codes are defined."""
        self.assertIsNotNone(Color.RED)
        self.assertIsNotNone(Color.GREEN)
        self.assertIsNotNone(Color.YELLOW)
        self.assertIsNotNone(Color.NC)

    def test_color_codes_are_ansi(self):
        """Test that color codes are ANSI sequences."""
        self.assertTrue(Color.RED.startswith('\033['))
        self.assertTrue(Color.GREEN.startswith('\033['))


class TestDeployConfig(unittest.TestCase):
    """Tests for DeployConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = DeployConfig()
        self.assertEqual(config.namespace, "vibecode-platform")
        self.assertEqual(config.deployment, "code-server-workspace")
        self.assertEqual(config.timeout, 300)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = DeployConfig(
            namespace="custom-ns",
            deployment="custom-deploy",
            timeout=600,
        )
        self.assertEqual(config.namespace, "custom-ns")
        self.assertEqual(config.deployment, "custom-deploy")
        self.assertEqual(config.timeout, 600)


class TestLoggingFunctions(unittest.TestCase):
    """Tests for logging functions."""

    @patch('builtins.print')
    def test_info_prints_message(self, mock_print):
        """Test info function prints message."""
        info("Test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Test message", call_args)
        self.assertIn("[INFO]", call_args)

    @patch('builtins.print')
    def test_warn_prints_message(self, mock_print):
        """Test warn function prints message."""
        warn("Warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Warning message", call_args)
        self.assertIn("[WARN]", call_args)


class TestCheckPrerequisites(unittest.TestCase):
    """Tests for check_prerequisites function."""

    @patch('shutil.which')
    def test_kubectl_not_found(self, mock_which):
        """Test when kubectl is not found."""
        mock_which.return_value = None
        with self.assertRaises(SystemExit):
            check_prerequisites()

    @patch('subprocess.run')
    @patch('shutil.which')
    def test_cluster_not_accessible(self, mock_which, mock_run):
        """Test when cluster is not accessible."""
        mock_which.return_value = '/usr/bin/kubectl'
        mock_run.return_value = MagicMock(returncode=1)
        with self.assertRaises(SystemExit):
            check_prerequisites()


class TestTestConfig(unittest.TestCase):
    """Tests for TestConfig dataclass."""

    def test_default_values(self):
        """Test default test configuration values."""
        config = TestConfig()
        self.assertEqual(config.namespace, "vibecode-platform")
        self.assertEqual(config.deployment, "code-server-workspace")


class TestDeploymentTester(unittest.TestCase):
    """Tests for DeploymentTester class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = TestConfig()
        self.tester = DeploymentTester(self.config)

    def test_initialization(self):
        """Test tester initialization."""
        self.assertEqual(self.tester.pass_count, 0)
        self.assertEqual(self.tester.fail_count, 0)

    @patch('builtins.print')
    def test_pass_test_increments_count(self, mock_print):
        """Test pass_test increments counter."""
        self.tester.pass_test("Test passed")
        self.assertEqual(self.tester.pass_count, 1)

    @patch('builtins.print')
    def test_fail_test_increments_count(self, mock_print):
        """Test fail_test increments counter."""
        self.tester.fail_test("Test failed")
        self.assertEqual(self.tester.fail_count, 1)

    @patch('subprocess.run')
    def test_run_kubectl(self, mock_run):
        """Test run_kubectl method."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output")
        result = self.tester.run_kubectl(["get", "pods"])
        mock_run.assert_called_once()
        self.assertEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()