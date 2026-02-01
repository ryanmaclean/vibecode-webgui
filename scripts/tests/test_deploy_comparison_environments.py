#!/usr/bin/env python3
"""Tests for deploy_comparison_environments module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from deploy_comparison_environments import (
    DeploymentConfig,
    DeploymentStatus,
    command_exists,
    run_command,
)


class TestDeploymentConfig(TestCase):
    """Tests for DeploymentConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = DeploymentConfig()
        self.assertEqual(config.aks_environment, "dev")
        self.assertEqual(config.functions_environment, "staging")
        self.assertEqual(config.cluster_name, "vibecode-dev-aks")
        self.assertEqual(config.function_app_name, "vibecode-docs-search-staging")

    def test_custom_values(self):
        """Test custom configuration values."""
        config = DeploymentConfig(
            aks_environment="prod",
            cluster_name="custom-cluster",
            aks_version="2.0.0"
        )
        self.assertEqual(config.aks_environment, "prod")
        self.assertEqual(config.cluster_name, "custom-cluster")
        self.assertEqual(config.aks_version, "2.0.0")


class TestDeploymentStatus(TestCase):
    """Tests for DeploymentStatus dataclass."""

    def test_default_values(self):
        """Test default status values."""
        status = DeploymentStatus()
        self.assertFalse(status.aks_healthy)
        self.assertFalse(status.functions_healthy)
        self.assertEqual(status.aks_url, "")
        self.assertEqual(status.functions_url, "")

    def test_healthy_status(self):
        """Test healthy status."""
        status = DeploymentStatus(
            aks_healthy=True,
            functions_healthy=True,
            aks_url="http://localhost:3000",
            functions_url="https://func.azurewebsites.net"
        )
        self.assertTrue(status.aks_healthy)
        self.assertTrue(status.functions_healthy)


class TestCommandExists(TestCase):
    """Tests for command_exists function."""

    def test_existing_command(self):
        """Test existing command."""
        self.assertTrue(command_exists("python3") or command_exists("python"))

    def test_nonexistent_command(self):
        """Test non-existent command."""
        self.assertFalse(command_exists("nonexistent_command_12345"))


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

    def test_with_cwd(self):
        """Test running command with working directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            rc, stdout, stderr = run_command(["pwd"], cwd=Path(tmpdir))
            self.assertEqual(rc, 0)
            # stdout should contain the temp directory path


class TestStatusLogic(TestCase):
    """Tests for deployment status logic."""

    def test_both_healthy(self):
        """Test when both environments are healthy."""
        status = DeploymentStatus(aks_healthy=True, functions_healthy=True)
        self.assertTrue(status.aks_healthy and status.functions_healthy)

    def test_one_healthy(self):
        """Test when one environment is healthy."""
        status = DeploymentStatus(aks_healthy=True, functions_healthy=False)
        self.assertTrue(status.aks_healthy or status.functions_healthy)

    def test_none_healthy(self):
        """Test when no environment is healthy."""
        status = DeploymentStatus(aks_healthy=False, functions_healthy=False)
        self.assertFalse(status.aks_healthy or status.functions_healthy)


if __name__ == '__main__':
    import unittest
    unittest.main()
