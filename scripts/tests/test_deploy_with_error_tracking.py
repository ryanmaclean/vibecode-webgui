#!/usr/bin/env python3
"""Tests for deploy_with_error_tracking script."""

import unittest
from unittest.mock import MagicMock, patch

from scripts.deploy_with_error_tracking import (
    Color,
    DeployConfig,
    DeploymentType,
    Environment,
    PerformanceMetric,
    ErrorTracker,
    DeploymentRunner,
    parse_args,
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


class TestDeploymentType(unittest.TestCase):
    """Tests for DeploymentType enum."""

    def test_auto_value(self):
        """Test AUTO deployment type."""
        self.assertEqual(DeploymentType.AUTO.value, "auto")

    def test_kubernetes_value(self):
        """Test KUBERNETES deployment type."""
        self.assertEqual(DeploymentType.KUBERNETES.value, "kubernetes")

    def test_aks_value(self):
        """Test AKS deployment type."""
        self.assertEqual(DeploymentType.AKS.value, "aks")

    def test_local_value(self):
        """Test LOCAL deployment type."""
        self.assertEqual(DeploymentType.LOCAL.value, "local")


class TestEnvironment(unittest.TestCase):
    """Tests for Environment enum."""

    def test_development_value(self):
        """Test DEVELOPMENT environment."""
        self.assertEqual(Environment.DEVELOPMENT.value, "development")

    def test_staging_value(self):
        """Test STAGING environment."""
        self.assertEqual(Environment.STAGING.value, "staging")

    def test_production_value(self):
        """Test PRODUCTION environment."""
        self.assertEqual(Environment.PRODUCTION.value, "production")


class TestDeployConfig(unittest.TestCase):
    """Tests for DeployConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = DeployConfig()
        self.assertEqual(config.deployment_type, "auto")
        self.assertEqual(config.environment, "development")
        self.assertFalse(config.dry_run)
        self.assertFalse(config.verbose)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = DeployConfig(
            deployment_type="kubernetes",
            environment="production",
            dry_run=True,
            verbose=True,
        )
        self.assertEqual(config.deployment_type, "kubernetes")
        self.assertEqual(config.environment, "production")
        self.assertTrue(config.dry_run)
        self.assertTrue(config.verbose)


class TestPerformanceMetric(unittest.TestCase):
    """Tests for PerformanceMetric dataclass."""

    def test_metric_creation(self):
        """Test creating a performance metric."""
        metric = PerformanceMetric(
            name="build_duration",
            value=120.5,
            category="deployment",
            unit="seconds",
        )
        self.assertEqual(metric.name, "build_duration")
        self.assertEqual(metric.value, 120.5)
        self.assertEqual(metric.category, "deployment")
        self.assertEqual(metric.unit, "seconds")


class TestErrorTracker(unittest.TestCase):
    """Tests for ErrorTracker class."""

    def test_initialization(self):
        """Test tracker initialization."""
        tracker = ErrorTracker("deployment", "test_operation")
        self.assertEqual(tracker.service, "deployment")
        self.assertEqual(tracker.operation, "test_operation")

    @patch('builtins.print')
    @patch.dict('os.environ', {'DD_API_KEY': 'test_key'})
    def test_log_error_with_api_key(self, mock_print):
        """Test log_error with API key set."""
        tracker = ErrorTracker("deployment", "test")
        tracker.log_error("Test error", 1, "deployment", "test_op")
        mock_print.assert_called()

    @patch('builtins.print')
    @patch.dict('os.environ', {'DD_API_KEY': 'test_key'})
    def test_track_metric_with_api_key(self, mock_print):
        """Test track_metric with API key set."""
        tracker = ErrorTracker("deployment", "test")
        metric = PerformanceMetric("test", 1.0, "cat", "unit")
        tracker.track_metric(metric)
        mock_print.assert_called()


class TestDeploymentRunner(unittest.TestCase):
    """Tests for DeploymentRunner class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = DeployConfig(dry_run=True)
        self.runner = DeploymentRunner(self.config)

    def test_initialization(self):
        """Test runner initialization."""
        self.assertTrue(self.runner.config.dry_run)
        self.assertEqual(self.runner.deployment_start, 0.0)

    @patch('builtins.print')
    def test_log_info(self, mock_print):
        """Test log_info method."""
        self.runner.log_info("Test message")
        mock_print.assert_called()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Test message", call_args)
        self.assertIn("[INFO]", call_args)

    @patch('builtins.print')
    def test_log_success(self, mock_print):
        """Test log_success method."""
        self.runner.log_success("Success message")
        mock_print.assert_called()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Success message", call_args)
        self.assertIn("[SUCCESS]", call_args)

    @patch('builtins.print')
    def test_run_cmd_dry_run(self, mock_print):
        """Test run_cmd in dry run mode."""
        result = self.runner.run_cmd(["echo", "test"], "Testing")
        self.assertTrue(result)

    @patch('shutil.which')
    def test_validate_prerequisites_missing_tools(self, mock_which):
        """Test validate_prerequisites with missing tools."""
        mock_which.return_value = None
        result = self.runner.validate_prerequisites()
        self.assertFalse(result)

    @patch('shutil.which')
    def test_validate_prerequisites_all_found(self, mock_which):
        """Test validate_prerequisites with all tools found."""
        mock_which.return_value = "/usr/bin/tool"
        result = self.runner.validate_prerequisites()
        self.assertTrue(result)

    @patch('builtins.print')
    def test_build_application_dry_run(self, mock_print):
        """Test build_application in dry run mode."""
        result = self.runner.build_application()
        self.assertTrue(result)

    @patch('builtins.print')
    def test_run_tests_dry_run(self, mock_print):
        """Test run_tests in dry run mode."""
        result = self.runner.run_tests()
        self.assertTrue(result)

    @patch('builtins.print')
    def test_health_check_dry_run(self, mock_print):
        """Test health_check in dry run mode."""
        result = self.runner.health_check()
        self.assertTrue(result)


class TestParseArgs(unittest.TestCase):
    """Tests for parse_args function."""

    @patch('sys.argv', ['deploy.py'])
    def test_default_args(self):
        """Test parsing with default arguments."""
        config = parse_args()
        self.assertEqual(config.deployment_type, "auto")
        self.assertEqual(config.environment, "development")
        self.assertFalse(config.dry_run)

    @patch('sys.argv', ['deploy.py', 'kubernetes', 'production'])
    def test_positional_args(self):
        """Test parsing with positional arguments."""
        config = parse_args()
        self.assertEqual(config.deployment_type, "kubernetes")
        self.assertEqual(config.environment, "production")

    @patch('sys.argv', ['deploy.py', '--dry-run'])
    def test_dry_run_flag(self):
        """Test parsing with --dry-run flag."""
        config = parse_args()
        self.assertTrue(config.dry_run)

    @patch('sys.argv', ['deploy.py', '-v'])
    def test_verbose_flag(self):
        """Test parsing with -v flag."""
        config = parse_args()
        self.assertTrue(config.verbose)


if __name__ == '__main__':
    unittest.main()
