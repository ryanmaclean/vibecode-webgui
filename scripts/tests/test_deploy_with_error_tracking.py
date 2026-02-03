#!/usr/bin/env python3
"""Tests for deploy_with_error_tracking module."""

import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from deploy_with_error_tracking import (
    DeploymentConfig,
    DeploymentMetrics,
    DeploymentType,
    command_exists,
    run_command,
    safe_execute,
)


class TestDeploymentType(TestCase):
    """Tests for DeploymentType enum."""

    def test_auto_value(self):
        """Test auto deployment type."""
        self.assertEqual(DeploymentType.AUTO.value, "auto")

    def test_kubernetes_values(self):
        """Test kubernetes deployment types."""
        self.assertEqual(DeploymentType.KUBERNETES.value, "kubernetes")
        self.assertEqual(DeploymentType.K8S.value, "k8s")

    def test_azure_values(self):
        """Test Azure deployment types."""
        self.assertEqual(DeploymentType.AKS.value, "aks")
        self.assertEqual(DeploymentType.AZURE.value, "azure")

    def test_local_values(self):
        """Test local deployment types."""
        self.assertEqual(DeploymentType.LOCAL.value, "local")
        self.assertEqual(DeploymentType.DOCKER.value, "docker")


class TestDeploymentConfig(TestCase):
    """Tests for DeploymentConfig dataclass."""

    def test_default_values(self):
        """Test default configuration."""
        config = DeploymentConfig()
        self.assertEqual(config.deployment_type, DeploymentType.AUTO)
        self.assertEqual(config.environment, "development")
        self.assertFalse(config.verbose)
        self.assertFalse(config.dry_run)

    def test_custom_values(self):
        """Test custom configuration."""
        config = DeploymentConfig(
            deployment_type=DeploymentType.KUBERNETES,
            environment="production",
            dry_run=True
        )
        self.assertEqual(config.deployment_type, DeploymentType.KUBERNETES)
        self.assertEqual(config.environment, "production")
        self.assertTrue(config.dry_run)


class TestDeploymentMetrics(TestCase):
    """Tests for DeploymentMetrics dataclass."""

    def test_default_values(self):
        """Test default metrics."""
        metrics = DeploymentMetrics()
        self.assertEqual(metrics.start_time, 0.0)
        self.assertEqual(metrics.build_duration, 0.0)
        self.assertEqual(metrics.total_duration, 0.0)

    def test_set_values(self):
        """Test setting metric values."""
        metrics = DeploymentMetrics()
        metrics.build_duration = 60.5
        metrics.test_duration = 30.2
        self.assertEqual(metrics.build_duration, 60.5)
        self.assertEqual(metrics.test_duration, 30.2)


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"])
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(["nonexistent_12345"])
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)


class TestCommandExists(TestCase):
    """Tests for command_exists function."""

    def test_existing_command(self):
        """Test existing command."""
        self.assertTrue(command_exists("python3") or command_exists("python"))

    def test_nonexistent_command(self):
        """Test non-existent command."""
        self.assertFalse(command_exists("nonexistent_command_12345"))


class TestSafeExecute(TestCase):
    """Tests for safe_execute function."""

    def test_dry_run_mode(self):
        """Test dry run mode."""
        result = safe_execute("echo test", "test", "test", dry_run=True)
        self.assertTrue(result)

    def test_successful_execution(self):
        """Test successful command execution."""
        result = safe_execute("echo hello", "test", "test", dry_run=False)
        self.assertTrue(result)

    def test_failed_execution(self):
        """Test failed command execution."""
        result = safe_execute("false", "test", "test", dry_run=False)
        self.assertFalse(result)


if __name__ == '__main__':
    import unittest
    unittest.main()
