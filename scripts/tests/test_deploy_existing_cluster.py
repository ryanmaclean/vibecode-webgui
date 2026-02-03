#!/usr/bin/env python3
"""Tests for deploy_existing_cluster module."""

import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from deploy_existing_cluster import (
    DEPLOYMENT_MANIFEST,
    ClusterConfig,
    kubectl,
    run_command,
)


class TestClusterConfig(TestCase):
    """Tests for ClusterConfig dataclass."""

    def test_default_values(self):
        """Test default configuration."""
        config = ClusterConfig()
        self.assertEqual(config.namespace, "vibecode-platform")
        self.assertEqual(config.context, "kind-vibecode-kind-local")
        self.assertEqual(config.node_port, 30000)
        self.assertEqual(config.timeout, 300)

    def test_custom_values(self):
        """Test custom configuration."""
        config = ClusterConfig(
            namespace="custom-ns",
            context="custom-context",
            node_port=31000,
            timeout=600
        )
        self.assertEqual(config.namespace, "custom-ns")
        self.assertEqual(config.context, "custom-context")
        self.assertEqual(config.node_port, 31000)
        self.assertEqual(config.timeout, 600)


class TestDeploymentManifest(TestCase):
    """Tests for deployment manifest template."""

    def test_manifest_has_deployment(self):
        """Test manifest contains deployment."""
        self.assertIn("kind: Deployment", DEPLOYMENT_MANIFEST)

    def test_manifest_has_service(self):
        """Test manifest contains service."""
        self.assertIn("kind: Service", DEPLOYMENT_MANIFEST)

    def test_manifest_has_namespace_placeholder(self):
        """Test manifest has namespace placeholder."""
        self.assertIn("{namespace}", DEPLOYMENT_MANIFEST)

    def test_manifest_format(self):
        """Test manifest can be formatted."""
        formatted = DEPLOYMENT_MANIFEST.format(namespace="test-ns")
        self.assertIn("namespace: test-ns", formatted)
        self.assertNotIn("{namespace}", formatted)

    def test_manifest_has_node_port(self):
        """Test manifest has NodePort service type."""
        self.assertIn("type: NodePort", DEPLOYMENT_MANIFEST)
        self.assertIn("nodePort: 30000", DEPLOYMENT_MANIFEST)

    def test_manifest_has_resources(self):
        """Test manifest has resource limits."""
        self.assertIn("resources:", DEPLOYMENT_MANIFEST)
        self.assertIn("requests:", DEPLOYMENT_MANIFEST)
        self.assertIn("limits:", DEPLOYMENT_MANIFEST)


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


class TestKubectl(TestCase):
    """Tests for kubectl function."""

    @mock.patch('deploy_existing_cluster.run_command')
    def test_kubectl_calls_run_command(self, mock_run):
        """Test kubectl calls run_command with correct args."""
        mock_run.return_value = (0, "", "")

        kubectl(["get", "pods"])

        mock_run.assert_called_once_with(
            ["kubectl", "get", "pods"],
            check=False
        )

    @mock.patch('deploy_existing_cluster.run_command')
    def test_kubectl_with_check(self, mock_run):
        """Test kubectl with check=True."""
        mock_run.return_value = (0, "", "")

        kubectl(["get", "pods"], check=True)

        mock_run.assert_called_once_with(
            ["kubectl", "get", "pods"],
            check=True
        )


if __name__ == '__main__':
    import unittest
    unittest.main()
