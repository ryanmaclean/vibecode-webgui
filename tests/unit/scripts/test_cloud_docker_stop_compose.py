#!/usr/bin/env python3
"""Unit tests for scripts/cloud/docker/stop_compose.py."""

from __future__ import annotations

import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "scripts/cloud/docker")
from stop_compose import (
    DockerComposeStopConfig,
    main,
    stop_compose,
    stop_docker_compose,
)


class TestDockerComposeStopConfig:
    """Tests for DockerComposeStopConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = DockerComposeStopConfig()
        assert config.compose_file == "docker/code-server/docker-compose.cloud.yml"
        assert config.project_name == "codeserver"
        assert config.remove_volumes is False

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = DockerComposeStopConfig.from_env()
            assert config.compose_file == "docker/code-server/docker-compose.cloud.yml"
            assert config.project_name == "codeserver"
            assert config.remove_volumes is False

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "COMPOSE_FILE": "custom/docker-compose.yml",
            "PROJECT_NAME": "myproject",
            "REMOVE_VOLUMES": "true",
        }
        with patch.dict("os.environ", env, clear=True):
            config = DockerComposeStopConfig.from_env()
            assert config.compose_file == "custom/docker-compose.yml"
            assert config.project_name == "myproject"
            assert config.remove_volumes is True

    def test_remove_volumes_false_variants(self) -> None:
        """Test various false values for REMOVE_VOLUMES."""
        for value in ["false", "False", "FALSE", "no", "0", ""]:
            with patch.dict("os.environ", {"REMOVE_VOLUMES": value}, clear=True):
                config = DockerComposeStopConfig.from_env()
                assert config.remove_volumes is False


class TestStopCompose:
    """Tests for stop_compose function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful compose stop."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DockerComposeStopConfig()

        result = stop_compose(config)

        assert result is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "docker" in call_args
        assert "compose" in call_args
        assert "-f" in call_args
        assert "down" in call_args
        assert "-v" not in call_args

    @patch("subprocess.run")
    def test_with_remove_volumes(self, mock_run: MagicMock) -> None:
        """Test compose stop with volume removal."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DockerComposeStopConfig(remove_volumes=True)

        result = stop_compose(config)

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "-v" in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed compose stop."""
        mock_run.return_value = MagicMock(returncode=1)
        config = DockerComposeStopConfig()

        result = stop_compose(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = DockerComposeStopConfig()

        result = stop_compose(config)

        assert result is False

    @patch("subprocess.run")
    def test_subprocess_error(self, mock_run: MagicMock) -> None:
        """Test subprocess error handling."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        config = DockerComposeStopConfig()

        result = stop_compose(config)

        assert result is False

    @patch("subprocess.run")
    def test_custom_config(self, mock_run: MagicMock) -> None:
        """Test with custom configuration."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DockerComposeStopConfig(
            compose_file="custom.yml",
            project_name="myproject",
        )

        stop_compose(config)

        call_args = mock_run.call_args[0][0]
        assert "custom.yml" in call_args
        assert "myproject" in call_args


class TestStopDockerCompose:
    """Tests for stop_docker_compose function."""

    @patch("shutil.which")
    def test_no_docker(self, mock_which: MagicMock) -> None:
        """Test when docker is not installed."""
        mock_which.return_value = None

        result = stop_docker_compose()

        assert result == 1

    @patch("shutil.which")
    @patch("stop_compose.stop_compose")
    def test_compose_stop_failure(
        self, mock_compose: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when compose stop fails."""
        mock_which.return_value = "/usr/bin/docker"
        mock_compose.return_value = False

        result = stop_docker_compose()

        assert result == 1

    @patch("shutil.which")
    @patch("stop_compose.stop_compose")
    def test_success(self, mock_compose: MagicMock, mock_which: MagicMock) -> None:
        """Test successful docker compose stop."""
        mock_which.return_value = "/usr/bin/docker"
        mock_compose.return_value = True

        result = stop_docker_compose()

        assert result == 0

    @patch("shutil.which")
    @patch("stop_compose.stop_compose")
    def test_success_with_volumes(
        self, mock_compose: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test successful stop with volume removal."""
        mock_which.return_value = "/usr/bin/docker"
        mock_compose.return_value = True

        config = DockerComposeStopConfig(remove_volumes=True)
        result = stop_docker_compose(config)

        assert result == 0

    def test_with_custom_config(self) -> None:
        """Test with custom configuration."""
        config = DockerComposeStopConfig(project_name="custom")

        with patch("shutil.which", return_value=None):
            result = stop_docker_compose(config)

        assert result == 1


class TestMain:
    """Tests for main function."""

    @patch("stop_compose.stop_docker_compose")
    def test_main(self, mock_stop: MagicMock) -> None:
        """Test main function."""
        mock_stop.return_value = 0

        result = main()

        assert result == 0
        mock_stop.assert_called_once()
