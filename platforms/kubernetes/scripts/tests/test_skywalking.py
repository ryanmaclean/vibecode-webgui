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

"""Tests for SkyWalking deployment scripts."""

import unittest
from unittest.mock import MagicMock, patch

from platforms.kubernetes.scripts.skywalking.deploy import (
    Color,
    SkyWalkingConfig,
    log_info,
    log_success,
    log_warning,
    log_error,
    check_prerequisites,
)
from platforms.kubernetes.scripts.skywalking.verify import (
    VerifyConfig,
    SkyWalkingVerifier,
)


class TestColor(unittest.TestCase):
    """Tests for Color class."""

    def test_color_codes_defined(self):
        """Test that color codes are defined."""
        self.assertIsNotNone(Color.RED)
        self.assertIsNotNone(Color.GREEN)
        self.assertIsNotNone(Color.YELLOW)
        self.assertIsNotNone(Color.BLUE)
        self.assertIsNotNone(Color.NC)


class TestSkyWalkingConfig(unittest.TestCase):
    """Tests for SkyWalkingConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = SkyWalkingConfig()
        self.assertEqual(config.namespace_skywalking, "skywalking")
        self.assertEqual(config.namespace_vibecode, "vibecode-platform")
        self.assertEqual(config.helm_release, "skywalking")
        self.assertEqual(config.chart_version, "10.3.0")

    def test_custom_values(self):
        """Test custom configuration values."""
        config = SkyWalkingConfig(
            namespace_skywalking="custom-skywalking",
            chart_version="11.0.0",
        )
        self.assertEqual(config.namespace_skywalking, "custom-skywalking")
        self.assertEqual(config.chart_version, "11.0.0")


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
    def test_log_success(self, mock_print):
        """Test log_success function."""
        log_success("Success message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Success message", call_args)
        self.assertIn("[SUCCESS]", call_args)

    @patch('builtins.print')
    def test_log_warning(self, mock_print):
        """Test log_warning function."""
        log_warning("Warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Warning message", call_args)
        self.assertIn("[WARNING]", call_args)

    @patch('builtins.print')
    def test_log_error(self, mock_print):
        """Test log_error function."""
        log_error("Error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Error message", call_args)
        self.assertIn("[ERROR]", call_args)


class TestCheckPrerequisites(unittest.TestCase):
    """Tests for check_prerequisites function."""

    @patch('shutil.which')
    def test_kubectl_not_found(self, mock_which):
        """Test when kubectl is not found."""
        mock_which.return_value = None
        result = check_prerequisites()
        self.assertFalse(result)

    @patch('subprocess.run')
    @patch('shutil.which')
    def test_helm_not_found(self, mock_which, mock_run):
        """Test when helm is not found."""
        def which_side_effect(cmd):
            if cmd == "kubectl":
                return "/usr/bin/kubectl"
            return None
        mock_which.side_effect = which_side_effect
        result = check_prerequisites()
        self.assertFalse(result)


class TestVerifyConfig(unittest.TestCase):
    """Tests for VerifyConfig dataclass."""

    def test_default_values(self):
        """Test default verify configuration values."""
        config = VerifyConfig()
        self.assertEqual(config.namespace_skywalking, "skywalking")
        self.assertEqual(config.namespace_vibecode, "vibecode-platform")


class TestSkyWalkingVerifier(unittest.TestCase):
    """Tests for SkyWalkingVerifier class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = VerifyConfig()
        self.verifier = SkyWalkingVerifier(self.config)

    def test_initialization(self):
        """Test verifier initialization."""
        self.assertEqual(self.verifier.passed, 0)
        self.assertEqual(self.verifier.failed, 0)
        self.assertEqual(self.verifier.warnings, 0)

    @patch('builtins.print')
    def test_log_pass_increments_counter(self, mock_print):
        """Test log_pass increments passed counter."""
        self.verifier.log_pass("Test passed")
        self.assertEqual(self.verifier.passed, 1)

    @patch('builtins.print')
    def test_log_fail_increments_counter(self, mock_print):
        """Test log_fail increments failed counter."""
        self.verifier.log_fail("Test failed")
        self.assertEqual(self.verifier.failed, 1)

    @patch('builtins.print')
    def test_log_warn_increments_counter(self, mock_print):
        """Test log_warn increments warnings counter."""
        self.verifier.log_warn("Warning")
        self.assertEqual(self.verifier.warnings, 1)

    @patch('subprocess.run')
    def test_run_kubectl(self, mock_run):
        """Test run_kubectl method."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output")
        result = self.verifier.run_kubectl(["get", "pods"])
        mock_run.assert_called_once()


if __name__ == '__main__':
    unittest.main()