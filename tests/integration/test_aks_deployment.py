#!/usr/bin/env python3
"""
Integration tests for AKS deployment script.
Tests the deployment manager functionality including error handling and rollback.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import sys

# Add the scripts directory to the path
scripts_dir = Path(__file__).parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

try:
    from deploy_aks import AKSDeploymentManager, DeploymentConfig, ValidationError
except ImportError:
    # Create a mock for when the file doesn't exist yet
    class AKSDeploymentManager:
        pass
    class DeploymentConfig:
        pass
    class ValidationError(Exception):
        pass


class AKSDeploymentIntegrationTests(unittest.TestCase):
    """Integration tests for AKS deployment functionality."""

    def setUp(self):
        """Set up test environment."""
        self.test_config = {
            "project_name": "vibecode-test",
            "environment": "dev",
            "location": "East US 2",
            "datadog_api_key": "test-key-123",
            "datadog_app_key": "test-app-key-456",
            "postgres_storage_size_gb": 20,
            "system_node_count": 1,
            "user_node_count": 1,
            "enable_datadog_monitoring": True
        }

        # Create temporary directory for test state
        self.temp_dir = tempfile.mkdtemp()
        self.state_dir = Path(self.temp_dir) / "terraform-state"
        self.state_dir.mkdir(exist_ok=True)

    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @patch('subprocess.run')
    def test_deployment_manager_initialization(self, mock_run):
        """Test that deployment manager initializes correctly."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        self.assertIsNotNone(manager)
        self.assertTrue(manager.dry_run)

    @patch('subprocess.run')
    def test_azure_cli_authentication_check(self, mock_run):
        """Test Azure CLI authentication validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock successful az account show
        mock_run.return_value = Mock(
            returncode=0,
            stdout='{"user": {"name": "test@example.com"}}',
            stderr=""
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        # Should not raise exception
        try:
            manager._validate_azure_auth()
        except Exception as e:
            self.fail(f"Azure auth validation failed unexpectedly: {e}")

    @patch('subprocess.run')
    def test_azure_cli_authentication_failure(self, mock_run):
        """Test Azure CLI authentication failure handling."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock failed az account show
        mock_run.return_value = Mock(
            returncode=1,
            stdout="",
            stderr="Please run 'az login' to authenticate"
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        with self.assertRaises(ValidationError):
            manager._validate_azure_auth()

    @patch('subprocess.run')
    def test_tofu_validation(self, mock_run):
        """Test OpenTofu configuration validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock successful tofu validate
        mock_run.return_value = Mock(
            returncode=0,
            stdout='{"valid": true}',
            stderr=""
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        # Should not raise exception
        try:
            manager._validate_tofu_config()
        except Exception as e:
            self.fail(f"Tofu validation failed unexpectedly: {e}")

    @patch('subprocess.run')
    def test_state_backup_creation(self, mock_run):
        """Test state backup functionality."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Create a mock state file
        state_file = self.state_dir / "terraform.tfstate"
        state_file.write_text('{"version": 4, "terraform_version": "1.0.0"}')

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )
        manager.state_dir = self.state_dir

        backup_path = manager._backup_state()
        self.assertTrue(backup_path.exists())
        self.assertIn("backup", backup_path.name)

    @patch('subprocess.run')
    def test_rollback_functionality(self, mock_run):
        """Test rollback mechanism."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Create backup state file
        backup_file = self.state_dir / "terraform.tfstate.backup.20240101-120000"
        backup_file.write_text('{"version": 4, "terraform_version": "1.0.0"}')

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )
        manager.state_dir = self.state_dir

        # Mock successful rollback
        mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

        try:
            manager._rollback_deployment(backup_file)
        except Exception as e:
            self.fail(f"Rollback failed unexpectedly: {e}")

    @patch('subprocess.run')
    def test_quota_validation(self, mock_run):
        """Test Azure quota validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock quota check response
        quota_response = {
            "value": [
                {
                    "name": {"value": "cores"},
                    "limit": 100,
                    "currentValue": 10
                }
            ]
        }

        mock_run.return_value = Mock(
            returncode=0,
            stdout=json.dumps(quota_response),
            stderr=""
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        # Should not raise exception for sufficient quota
        try:
            manager._check_azure_quotas()
        except Exception as e:
            self.fail(f"Quota validation failed unexpectedly: {e}")

    @patch('subprocess.run')
    def test_deployment_retry_logic(self, mock_run):
        """Test deployment retry mechanism for transient errors."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        # Test retryable error detection
        retryable_errors = [
            "timeout occurred",
            "temporary failure",
            "rate limit exceeded",
            "service unavailable",
            "network error"
        ]

        for error in retryable_errors:
            self.assertTrue(
                manager._is_retryable_error(error),
                f"Should detect '{error}' as retryable"
            )

        # Test non-retryable errors
        non_retryable_errors = [
            "invalid credentials",
            "permission denied",
            "resource already exists",
            "configuration error"
        ]

        for error in non_retryable_errors:
            self.assertFalse(
                manager._is_retryable_error(error),
                f"Should not detect '{error}' as retryable"
            )

    @patch('subprocess.run')
    def test_resource_name_collision_handling(self, mock_run):
        """Test handling of Azure resource name collisions."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock name collision error
        collision_error = (
            "The resource name 'vibecode-aks-12345' is already in use"
        )

        mock_run.return_value = Mock(
            returncode=1,
            stdout="",
            stderr=collision_error
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        # Should detect name collision
        self.assertTrue(manager._is_name_collision_error(collision_error))

    @patch('subprocess.run')
    def test_false_success_detection(self, mock_run):
        """Test detection of false success responses from Azure API."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        # Test cases that should be detected as false successes
        false_success_cases = [
            '{"status": "InternalServerError"}',
            '{"error": {"code": "DeploymentFailed"}}',
            '{"properties": {"provisioningState": "Failed"}}',
            'Warning: Resource creation succeeded but validation failed'
        ]

        for case in false_success_cases:
            mock_run.return_value = Mock(
                returncode=0,  # Appears successful
                stdout=case,
                stderr=""
            )

            self.assertTrue(
                manager._is_false_success(mock_run.return_value),
                f"Should detect false success in: {case}"
            )

    @patch('subprocess.run')
    def test_kubernetes_connectivity_validation(self, mock_run):
        """Test Kubernetes cluster connectivity validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock successful kubectl cluster-info
        mock_run.return_value = Mock(
            returncode=0,
            stdout="Kubernetes control plane is running",
            stderr=""
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        try:
            manager._validate_k8s_connectivity()
        except Exception as e:
            self.fail(f"K8s connectivity validation failed: {e}")

    @patch('subprocess.run')
    def test_datadog_agent_deployment_validation(self, mock_run):
        """Test Datadog agent deployment validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock successful Datadog agent status
        mock_run.return_value = Mock(
            returncode=0,
            stdout='{"items": [{"metadata": {"name": "datadog-agent"}}]}',
            stderr=""
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        try:
            manager._validate_datadog_deployment()
        except Exception as e:
            self.fail(f"Datadog validation failed: {e}")

    @patch('subprocess.run')
    def test_postgresql_deployment_validation(self, mock_run):
        """Test PostgreSQL deployment validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Mock successful PostgreSQL status
        mock_run.return_value = Mock(
            returncode=0,
            stdout='{"items": [{"metadata": {"name": "postgres"}}]}',
            stderr=""
        )

        manager = AKSDeploymentManager(
            tofu_dir=Path("test/tofu"),
            config=self.test_config,
            dry_run=True
        )

        try:
            manager._validate_postgres_deployment()
        except Exception as e:
            self.fail(f"PostgreSQL validation failed: {e}")


class DeploymentConfigTests(unittest.TestCase):
    """Tests for deployment configuration validation."""

    def test_config_validation(self):
        """Test configuration validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        # Valid configuration
        valid_config = {
            "project_name": "vibecode",
            "environment": "dev",
            "location": "East US 2",
            "datadog_api_key": "test-key",
            "datadog_app_key": "test-app-key"
        }

        try:
            config = DeploymentConfig(**valid_config)
            self.assertIsNotNone(config)
        except Exception as e:
            self.fail(f"Valid config validation failed: {e}")

    def test_invalid_environment(self):
        """Test invalid environment validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        invalid_config = {
            "project_name": "vibecode",
            "environment": "invalid",  # Should only be dev/staging/prod
            "location": "East US 2",
            "datadog_api_key": "test-key",
            "datadog_app_key": "test-app-key"
        }

        with self.assertRaises(ValueError):
            DeploymentConfig(**invalid_config)

    def test_missing_required_fields(self):
        """Test missing required field validation."""
        if 'deploy_aks' not in sys.modules:
            self.skipTest("deploy_aks module not available")

        incomplete_config = {
            "project_name": "vibecode",
            "environment": "dev"
            # Missing location, datadog keys
        }

        with self.assertRaises(TypeError):
            DeploymentConfig(**incomplete_config)


if __name__ == "__main__":
    unittest.main()