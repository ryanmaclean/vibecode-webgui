
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

"""Tests for deploy.py"""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deploy import (
    Environment,
    DeployConfig,
    get_compose_file,
    check_compose_file_exists,
    command_exists,
    confirm_deployment,
)


class TestEnvironment:
    """Tests for Environment enum."""

    def test_environment_values(self):
        """Test that all expected environments exist."""
        assert Environment.DEV.value == "dev"
        assert Environment.PROD.value == "prod"
        assert Environment.TEST.value == "test"
        assert Environment.AKS.value == "aks"

    def test_environment_from_string(self):
        """Test creating Environment from string."""
        assert Environment("dev") == Environment.DEV
        assert Environment("prod") == Environment.PROD


class TestDeployConfig:
    """Tests for DeployConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = DeployConfig(environment=Environment.DEV)
        assert config.registry is None
        assert config.namespace == "vibecode-platform"
        assert config.force is False

    def test_custom_values(self):
        """Test custom configuration values."""
        config = DeployConfig(
            environment=Environment.PROD,
            registry="ghcr.io/example",
            namespace="production",
            force=True,
        )
        assert config.environment == Environment.PROD
        assert config.registry == "ghcr.io/example"
        assert config.namespace == "production"
        assert config.force is True


class TestGetComposeFile:
    """Tests for get_compose_file function."""

    def test_dev_compose_file(self):
        """Test development compose file."""
        assert get_compose_file(Environment.DEV) == "docker-compose.dev.yml"

    def test_prod_compose_file(self):
        """Test production compose file."""
        assert get_compose_file(Environment.PROD) == "docker-compose.prod.yml"

    def test_test_compose_file(self):
        """Test testing compose file."""
        assert get_compose_file(Environment.TEST) == "docker-compose.test.yml"

    def test_aks_compose_file(self):
        """Test AKS compose file."""
        assert get_compose_file(Environment.AKS) == "docker-compose.aks.yml"


class TestCheckComposeFileExists:
    """Tests for check_compose_file_exists function."""

    def test_existing_file(self):
        """Test with existing file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create docker directory and compose file
            docker_dir = Path(tmpdir) / "docker"
            docker_dir.mkdir()
            compose_file = docker_dir / "docker-compose.dev.yml"
            compose_file.write_text("version: '3'")

            # Change to temp directory
            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                assert check_compose_file_exists("docker-compose.dev.yml") is True
            finally:
                os.chdir(original_cwd)

    def test_missing_file(self):
        """Test with missing file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                assert check_compose_file_exists("docker-compose.dev.yml") is False
            finally:
                os.chdir(original_cwd)


class TestCommandExists:
    """Tests for command_exists function."""

    def test_existing_command(self):
        """Test with existing command."""
        # 'python' should exist on most systems
        assert command_exists("python") or command_exists("python3")

    def test_missing_command(self):
        """Test with missing command."""
        assert command_exists("nonexistent_command_12345") is False


class TestConfirmDeployment:
    """Tests for confirm_deployment function."""

    def test_force_mode(self):
        """Test that force mode skips confirmation."""
        config = DeployConfig(environment=Environment.DEV, force=True)
        assert confirm_deployment(config) is True

    @patch('builtins.input', return_value='y')
    def test_user_confirms(self, mock_input):
        """Test user confirming deployment."""
        config = DeployConfig(environment=Environment.DEV, force=False)
        assert confirm_deployment(config) is True

    @patch('builtins.input', return_value='n')
    def test_user_denies(self, mock_input):
        """Test user denying deployment."""
        config = DeployConfig(environment=Environment.DEV, force=False)
        assert confirm_deployment(config) is False

    @patch('builtins.input', return_value='')
    def test_empty_input(self, mock_input):
        """Test empty input defaults to no."""
        config = DeployConfig(environment=Environment.DEV, force=False)
        assert confirm_deployment(config) is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])