#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Unit tests for scripts/cloud/docker/start_compose.py."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "scripts/cloud/docker")
from start_compose import (
    DockerComposeConfig,
    create_directories,
    main,
    start_compose,
    start_docker_compose,
)


class TestDockerComposeConfig:
    """Tests for DockerComposeConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = DockerComposeConfig()
        assert config.compose_file == "docker/code-server/docker-compose.cloud.yml"
        assert config.project_name == "codeserver"
        assert config.password == "changeme"

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = DockerComposeConfig.from_env()
            assert config.compose_file == "docker/code-server/docker-compose.cloud.yml"
            assert config.project_name == "codeserver"
            assert config.password == "changeme"

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "COMPOSE_FILE": "custom/docker-compose.yml",
            "PROJECT_NAME": "myproject",
            "CODE_SERVER_PASSWORD": "secretpass",
        }
        with patch.dict("os.environ", env, clear=True):
            config = DockerComposeConfig.from_env()
            assert config.compose_file == "custom/docker-compose.yml"
            assert config.project_name == "myproject"
            assert config.password == "secretpass"


class TestCreateDirectories:
    """Tests for create_directories function."""

    @patch("pathlib.Path.mkdir")
    def test_success(self, mock_mkdir: MagicMock) -> None:
        """Test successful directory creation."""
        result = create_directories()

        assert result is True
        assert mock_mkdir.call_count == 2

    @patch("pathlib.Path.mkdir")
    def test_oserror(self, mock_mkdir: MagicMock) -> None:
        """Test OSError during directory creation."""
        mock_mkdir.side_effect = OSError("Permission denied")

        result = create_directories()

        assert result is False


class TestStartCompose:
    """Tests for start_compose function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful compose start."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DockerComposeConfig()

        result = start_compose(config)

        assert result is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "docker" in call_args
        assert "compose" in call_args
        assert "-f" in call_args
        assert "up" in call_args
        assert "-d" in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed compose start."""
        mock_run.return_value = MagicMock(returncode=1)
        config = DockerComposeConfig()

        result = start_compose(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = DockerComposeConfig()

        result = start_compose(config)

        assert result is False

    @patch("subprocess.run")
    def test_subprocess_error(self, mock_run: MagicMock) -> None:
        """Test subprocess error handling."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        config = DockerComposeConfig()

        result = start_compose(config)

        assert result is False

    @patch("subprocess.run")
    def test_custom_config(self, mock_run: MagicMock) -> None:
        """Test with custom configuration."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DockerComposeConfig(
            compose_file="custom.yml",
            project_name="myproject",
        )

        start_compose(config)

        call_args = mock_run.call_args[0][0]
        assert "custom.yml" in call_args
        assert "myproject" in call_args


class TestStartDockerCompose:
    """Tests for start_docker_compose function."""

    @patch("shutil.which")
    def test_no_docker(self, mock_which: MagicMock) -> None:
        """Test when docker is not installed."""
        mock_which.return_value = None

        result = start_docker_compose()

        assert result == 1

    @patch("shutil.which")
    @patch("start_compose.create_directories")
    def test_directory_creation_failure(
        self, mock_dirs: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when directory creation fails."""
        mock_which.return_value = "/usr/bin/docker"
        mock_dirs.return_value = False

        result = start_docker_compose()

        assert result == 1

    @patch("shutil.which")
    @patch("start_compose.create_directories")
    @patch("start_compose.start_compose")
    def test_compose_start_failure(
        self, mock_compose: MagicMock, mock_dirs: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when compose start fails."""
        mock_which.return_value = "/usr/bin/docker"
        mock_dirs.return_value = True
        mock_compose.return_value = False

        result = start_docker_compose()

        assert result == 1

    @patch("shutil.which")
    @patch("start_compose.create_directories")
    @patch("start_compose.start_compose")
    def test_success(
        self, mock_compose: MagicMock, mock_dirs: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test successful docker compose start."""
        mock_which.return_value = "/usr/bin/docker"
        mock_dirs.return_value = True
        mock_compose.return_value = True

        result = start_docker_compose()

        assert result == 0

    def test_with_custom_config(self) -> None:
        """Test with custom configuration."""
        config = DockerComposeConfig(password="secret")

        with patch("shutil.which", return_value=None):
            result = start_docker_compose(config)

        assert result == 1


class TestMain:
    """Tests for main function."""

    @patch("start_compose.start_docker_compose")
    def test_main(self, mock_start: MagicMock) -> None:
        """Test main function."""
        mock_start.return_value = 0

        result = main()

        assert result == 0
        mock_start.assert_called_once()