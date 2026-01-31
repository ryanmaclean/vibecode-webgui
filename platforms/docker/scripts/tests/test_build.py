"""Tests for build.py"""

import pytest
from unittest.mock import patch, MagicMock

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from build import (
    Target,
    BuildConfig,
    TargetConfig,
    get_target_config,
    build_docker_command,
    print_status,
    print_success,
    print_warning,
    print_error,
)


class TestTarget:
    """Tests for Target enum."""

    def test_target_values(self):
        """Test that all expected targets exist."""
        assert Target.DEV.value == "dev"
        assert Target.PROD.value == "prod"
        assert Target.TEST.value == "test"
        assert Target.AKS.value == "aks"
        assert Target.INGESTION.value == "ingestion"

    def test_target_from_string(self):
        """Test creating Target from string."""
        assert Target("dev") == Target.DEV
        assert Target("prod") == Target.PROD


class TestBuildConfig:
    """Tests for BuildConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = BuildConfig(target=Target.PROD)
        assert config.tag == "vibecode-webgui"
        assert config.push is False
        assert config.platform == "linux/amd64"
        assert config.cache_from is None
        assert config.cache_to is None

    def test_custom_values(self):
        """Test custom configuration values."""
        config = BuildConfig(
            target=Target.DEV,
            tag="custom:latest",
            push=True,
            platform="linux/arm64",
            cache_from="registry/cache",
            cache_to="registry/cache",
        )
        assert config.target == Target.DEV
        assert config.tag == "custom:latest"
        assert config.push is True
        assert config.platform == "linux/arm64"


class TestGetTargetConfig:
    """Tests for get_target_config function."""

    def test_dev_config(self):
        """Test development target configuration."""
        config = get_target_config(Target.DEV)
        assert config.dockerfile_target == "development"
        assert config.build_args["INCLUDE_DEV_DEPS"] == "true"
        assert config.build_args["NODE_VERSION"] == "24"

    def test_prod_config(self):
        """Test production target configuration."""
        config = get_target_config(Target.PROD)
        assert config.dockerfile_target == "production"
        assert config.build_args["INCLUDE_DEV_DEPS"] == "false"
        assert config.build_args["ENABLE_DATADOG"] == "true"
        assert config.build_args["ENABLE_HEALTH_CHECK"] == "true"

    def test_test_config(self):
        """Test testing target configuration."""
        config = get_target_config(Target.TEST)
        assert config.dockerfile_target == "testing"
        assert config.build_args["INCLUDE_DEV_DEPS"] == "true"

    def test_aks_config(self):
        """Test AKS target configuration."""
        config = get_target_config(Target.AKS)
        assert config.dockerfile_target == "production"
        assert config.build_args["ENABLE_DATADOG"] == "true"

    def test_ingestion_config(self):
        """Test ingestion target configuration."""
        config = get_target_config(Target.INGESTION)
        assert config.dockerfile_target == "ingestion"


class TestBuildDockerCommand:
    """Tests for build_docker_command function."""

    def test_basic_command(self):
        """Test basic docker command generation."""
        config = BuildConfig(target=Target.PROD)
        cmd = build_docker_command(config)

        assert "docker" in cmd
        assert "buildx" in cmd
        assert "build" in cmd
        assert "--platform" in cmd
        assert "linux/amd64" in cmd
        assert "--target" in cmd
        assert "production" in cmd

    def test_push_flag(self):
        """Test push flag in command."""
        config = BuildConfig(target=Target.PROD, push=True)
        cmd = build_docker_command(config)

        assert "--push" in cmd

    def test_no_push_flag(self):
        """Test no push flag when disabled."""
        config = BuildConfig(target=Target.PROD, push=False)
        cmd = build_docker_command(config)

        assert "--push" not in cmd

    def test_cache_options(self):
        """Test cache options in command."""
        config = BuildConfig(
            target=Target.PROD,
            cache_from="registry/cache:latest",
            cache_to="registry/cache:latest",
        )
        cmd = build_docker_command(config)

        assert "--cache-from" in cmd
        assert "--cache-to" in cmd

    def test_build_args_included(self):
        """Test that build args are included."""
        config = BuildConfig(target=Target.PROD)
        cmd = build_docker_command(config)

        assert "--build-arg" in cmd
        # Check for at least one build arg
        assert any("NODE_VERSION" in arg for arg in cmd)


class TestPrintFunctions:
    """Tests for print helper functions."""

    def test_print_status(self, capsys):
        """Test print_status output."""
        print_status("Test message")
        captured = capsys.readouterr()
        assert "[INFO]" in captured.out
        assert "Test message" in captured.out

    def test_print_success(self, capsys):
        """Test print_success output."""
        print_success("Success message")
        captured = capsys.readouterr()
        assert "[SUCCESS]" in captured.out
        assert "Success message" in captured.out

    def test_print_warning(self, capsys):
        """Test print_warning output."""
        print_warning("Warning message")
        captured = capsys.readouterr()
        assert "[WARNING]" in captured.out
        assert "Warning message" in captured.out

    def test_print_error(self, capsys):
        """Test print_error output."""
        print_error("Error message")
        captured = capsys.readouterr()
        assert "[ERROR]" in captured.out
        assert "Error message" in captured.out


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
