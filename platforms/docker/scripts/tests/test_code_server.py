"""Tests for code_server scripts."""

import pytest
from unittest.mock import patch, MagicMock
import json
import os
import sys
import tempfile
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from code_server.benchmark_builds import (
    BuildResult,
    get_image_size,
)

from code_server.configure_ai_extensions import (
    get_ai_settings,
    ensure_directory,
)

from code_server.configure_datadog import (
    write_agent_config,
    write_ci_config,
    write_vector_config,
    write_readme,
)

from code_server.download_extensions import (
    get_latest_version,
)


class TestBuildResult:
    """Tests for BuildResult dataclass."""

    def test_successful_build(self):
        """Test successful build result."""
        result = BuildResult(
            description="Test build",
            dockerfile="Dockerfile",
            profile="minimal",
            build_time_seconds=120,
            image_size="500MB",
            success=True,
        )
        assert result.success is True
        assert result.build_time_seconds == 120

    def test_failed_build(self):
        """Test failed build result."""
        result = BuildResult(
            description="Test build",
            dockerfile="Dockerfile",
            profile="minimal",
            build_time_seconds=None,
            image_size=None,
            success=False,
        )
        assert result.success is False


class TestGetImageSize:
    """Tests for get_image_size function."""

    @patch('subprocess.run')
    def test_returns_size(self, mock_run):
        """Test that function returns image size."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="500MB\n",
            stderr="",
        )

        size = get_image_size("test:latest")
        assert size == "500MB"

    @patch('subprocess.run')
    def test_returns_none_on_error(self, mock_run):
        """Test that function returns None on error."""
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="error",
        )

        size = get_image_size("nonexistent:latest")
        assert size is None


class TestGetAiSettings:
    """Tests for get_ai_settings function."""

    def test_returns_dict(self):
        """Test that function returns a dictionary."""
        settings = get_ai_settings()
        assert isinstance(settings, dict)

    def test_copilot_settings(self):
        """Test that Copilot settings are included."""
        settings = get_ai_settings()
        assert "github.copilot.enable" in settings

    def test_codeium_settings(self):
        """Test that Codeium settings are included."""
        settings = get_ai_settings()
        assert "codeium.enableSearch" in settings

    def test_cody_settings(self):
        """Test that Cody settings are included."""
        settings = get_ai_settings()
        assert "cody.serverEndpoint" in settings


class TestEnsureDirectory:
    """Tests for ensure_directory function."""

    def test_creates_directory(self):
        """Test that directory is created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            new_dir = Path(tmpdir) / "test" / "nested" / "dir"
            ensure_directory(new_dir)
            assert new_dir.exists()
            assert new_dir.is_dir()

    def test_existing_directory(self):
        """Test with existing directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Should not raise an error
            ensure_directory(Path(tmpdir))


class TestDatadogConfig:
    """Tests for Datadog configuration functions."""

    def test_write_agent_config(self):
        """Test writing agent config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            templates_dir = Path(tmpdir)
            write_agent_config(templates_dir)

            config_file = templates_dir / "agent-config.yaml"
            assert config_file.exists()

            content = config_file.read_text()
            assert "api_key" in content
            assert "apm_config" in content

    def test_write_ci_config(self):
        """Test writing CI config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            templates_dir = Path(tmpdir)
            write_ci_config(templates_dir)

            config_file = templates_dir / "datadog-ci.json"
            assert config_file.exists()

            content = config_file.read_text()
            assert "apiKey" in content

    def test_write_vector_config(self):
        """Test writing Vector config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            templates_dir = Path(tmpdir)
            write_vector_config(templates_dir)

            config_file = templates_dir / "vector.toml"
            assert config_file.exists()

            content = config_file.read_text()
            assert "sources.logs" in content

    def test_write_readme(self):
        """Test writing README."""
        with tempfile.TemporaryDirectory() as tmpdir:
            datadog_dir = Path(tmpdir)
            write_readme(datadog_dir)

            readme_file = datadog_dir / "README.md"
            assert readme_file.exists()

            content = readme_file.read_text()
            assert "Datadog" in content


class TestDownloadExtensions:
    """Tests for download_extensions functions."""

    @patch('urllib.request.urlopen')
    def test_get_latest_version(self, mock_urlopen):
        """Test getting latest version."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"version": "1.2.3"}).encode()
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        version = get_latest_version("test", "extension")
        assert version == "1.2.3"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
