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

"""Unit tests for scripts/cloud/aws/user_data.py."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

sys.path.insert(0, "scripts/cloud/aws")
from user_data import (
    DEFAULT_IMAGE,
    DEFAULT_PASSWORD,
    DEFAULT_PORT,
    DEFAULT_WORKSPACE_DIR,
    bootstrap_instance,
    create_workspace_directory,
    install_docker,
    main,
    run_command,
    start_code_server,
)


class TestConstants:
    """Tests for module constants."""

    def test_default_values(self) -> None:
        """Test default constant values."""
        assert DEFAULT_PASSWORD == "changeme"
        assert DEFAULT_PORT == 8765
        assert DEFAULT_WORKSPACE_DIR == "/home/ubuntu/workspace"
        assert DEFAULT_IMAGE == "ghcr.io/ryanmaclean/vibecode-codeserver:latest"


class TestRunCommand:
    """Tests for run_command function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful command execution."""
        mock_run.return_value = MagicMock(returncode=0)

        result = run_command(["echo", "test"])

        mock_run.assert_called_once_with(["echo", "test"], check=True)

    @patch("subprocess.run")
    def test_check_false(self, mock_run: MagicMock) -> None:
        """Test command execution with check=False."""
        mock_run.return_value = MagicMock(returncode=1)

        result = run_command(["false"], check=False)

        mock_run.assert_called_once_with(["false"], check=False)


class TestInstallDocker:
    """Tests for install_docker function."""

    @patch("user_data.run_command")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful Docker installation."""
        mock_run.return_value = MagicMock(returncode=0)

        result = install_docker()

        assert result is True
        assert mock_run.call_count == 3
        mock_run.assert_any_call(["apt-get", "update"])
        mock_run.assert_any_call(["apt-get", "install", "-y", "docker.io"])
        mock_run.assert_any_call(["systemctl", "enable", "--now", "docker"])

    @patch("user_data.run_command")
    def test_apt_update_failure(self, mock_run: MagicMock) -> None:
        """Test failure during apt-get update."""
        mock_run.side_effect = subprocess.CalledProcessError(1, "apt-get")

        result = install_docker()

        assert result is False

    @patch("user_data.run_command")
    def test_docker_install_failure(self, mock_run: MagicMock) -> None:
        """Test failure during Docker installation."""
        mock_run.side_effect = [MagicMock(), subprocess.CalledProcessError(1, "apt-get")]

        result = install_docker()

        assert result is False

    @patch("user_data.run_command")
    def test_systemctl_failure(self, mock_run: MagicMock) -> None:
        """Test failure during systemctl enable."""
        mock_run.side_effect = [
            MagicMock(),
            MagicMock(),
            subprocess.CalledProcessError(1, "systemctl"),
        ]

        result = install_docker()

        assert result is False


class TestCreateWorkspaceDirectory:
    """Tests for create_workspace_directory function."""

    @patch("user_data.run_command")
    @patch("pathlib.Path.mkdir")
    def test_success(self, mock_mkdir: MagicMock, mock_run: MagicMock) -> None:
        """Test successful directory creation."""
        mock_run.return_value = MagicMock(returncode=0)

        result = create_workspace_directory()

        assert result is True
        mock_mkdir.assert_called_once_with(parents=True, exist_ok=True)
        mock_run.assert_called_once()

    @patch("user_data.run_command")
    @patch("pathlib.Path.mkdir")
    def test_custom_directory(self, mock_mkdir: MagicMock, mock_run: MagicMock) -> None:
        """Test with custom directory path."""
        mock_run.return_value = MagicMock(returncode=0)

        result = create_workspace_directory("/custom/workspace")

        assert result is True
        mock_run.assert_called_once_with(["chown", "ubuntu:ubuntu", "/custom/workspace"])

    @patch("pathlib.Path.mkdir")
    def test_mkdir_oserror(self, mock_mkdir: MagicMock) -> None:
        """Test OSError during mkdir."""
        mock_mkdir.side_effect = OSError("Permission denied")

        result = create_workspace_directory()

        assert result is False

    @patch("user_data.run_command")
    @patch("pathlib.Path.mkdir")
    def test_chown_failure(self, mock_mkdir: MagicMock, mock_run: MagicMock) -> None:
        """Test failure during chown."""
        mock_run.side_effect = subprocess.CalledProcessError(1, "chown")

        result = create_workspace_directory()

        assert result is False


class TestStartCodeServer:
    """Tests for start_code_server function."""

    @patch("user_data.run_command")
    def test_success_defaults(self, mock_run: MagicMock) -> None:
        """Test successful code-server start with defaults."""
        mock_run.return_value = MagicMock(returncode=0)

        result = start_code_server()

        assert result is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "docker" in call_args
        assert "run" in call_args
        assert "-d" in call_args
        assert f"PASSWORD={DEFAULT_PASSWORD}" in call_args[call_args.index("-e") + 1]

    @patch("user_data.run_command")
    def test_success_custom_values(self, mock_run: MagicMock) -> None:
        """Test with custom values."""
        mock_run.return_value = MagicMock(returncode=0)

        result = start_code_server(
            password="secret",
            port=9000,
            workspace_dir="/my/workspace",
            image="myimage:latest",
        )

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "PASSWORD=secret" in call_args[call_args.index("-e") + 1]
        assert "9000:9000" in call_args[call_args.index("-p") + 1]
        assert "/my/workspace:/home/coder/project" in call_args[call_args.index("-v") + 1]
        assert "myimage:latest" in call_args

    @patch("user_data.run_command")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failure during docker run."""
        mock_run.side_effect = subprocess.CalledProcessError(1, "docker")

        result = start_code_server()

        assert result is False


class TestBootstrapInstance:
    """Tests for bootstrap_instance function."""

    @patch("user_data.start_code_server")
    @patch("user_data.create_workspace_directory")
    @patch("user_data.install_docker")
    def test_success_defaults(
        self,
        mock_docker: MagicMock,
        mock_workspace: MagicMock,
        mock_start: MagicMock,
    ) -> None:
        """Test successful bootstrap with defaults."""
        mock_docker.return_value = True
        mock_workspace.return_value = True
        mock_start.return_value = True

        with patch.dict("os.environ", {}, clear=True):
            result = bootstrap_instance()

        assert result == 0
        mock_docker.assert_called_once()
        mock_workspace.assert_called_once_with(DEFAULT_WORKSPACE_DIR)
        mock_start.assert_called_once_with(
            DEFAULT_PASSWORD, DEFAULT_PORT, DEFAULT_WORKSPACE_DIR, DEFAULT_IMAGE
        )

    @patch("user_data.start_code_server")
    @patch("user_data.create_workspace_directory")
    @patch("user_data.install_docker")
    def test_success_custom_password(
        self,
        mock_docker: MagicMock,
        mock_workspace: MagicMock,
        mock_start: MagicMock,
    ) -> None:
        """Test bootstrap with custom password."""
        mock_docker.return_value = True
        mock_workspace.return_value = True
        mock_start.return_value = True

        result = bootstrap_instance(password="mysecret")

        assert result == 0
        mock_start.assert_called_once_with(
            "mysecret", DEFAULT_PORT, DEFAULT_WORKSPACE_DIR, DEFAULT_IMAGE
        )

    @patch("user_data.start_code_server")
    @patch("user_data.create_workspace_directory")
    @patch("user_data.install_docker")
    def test_password_from_env(
        self,
        mock_docker: MagicMock,
        mock_workspace: MagicMock,
        mock_start: MagicMock,
    ) -> None:
        """Test password from environment variable."""
        mock_docker.return_value = True
        mock_workspace.return_value = True
        mock_start.return_value = True

        with patch.dict("os.environ", {"PASSWORD": "envpassword"}, clear=True):
            result = bootstrap_instance()

        assert result == 0
        mock_start.assert_called_once_with(
            "envpassword", DEFAULT_PORT, DEFAULT_WORKSPACE_DIR, DEFAULT_IMAGE
        )

    @patch("user_data.install_docker")
    def test_docker_failure(self, mock_docker: MagicMock) -> None:
        """Test failure during Docker installation."""
        mock_docker.return_value = False

        result = bootstrap_instance()

        assert result == 1

    @patch("user_data.create_workspace_directory")
    @patch("user_data.install_docker")
    def test_workspace_failure(
        self, mock_docker: MagicMock, mock_workspace: MagicMock
    ) -> None:
        """Test failure during workspace creation."""
        mock_docker.return_value = True
        mock_workspace.return_value = False

        result = bootstrap_instance()

        assert result == 1

    @patch("user_data.start_code_server")
    @patch("user_data.create_workspace_directory")
    @patch("user_data.install_docker")
    def test_code_server_failure(
        self,
        mock_docker: MagicMock,
        mock_workspace: MagicMock,
        mock_start: MagicMock,
    ) -> None:
        """Test failure during code-server start."""
        mock_docker.return_value = True
        mock_workspace.return_value = True
        mock_start.return_value = False

        result = bootstrap_instance()

        assert result == 1

    @patch("user_data.start_code_server")
    @patch("user_data.create_workspace_directory")
    @patch("user_data.install_docker")
    def test_all_custom_values(
        self,
        mock_docker: MagicMock,
        mock_workspace: MagicMock,
        mock_start: MagicMock,
    ) -> None:
        """Test with all custom values."""
        mock_docker.return_value = True
        mock_workspace.return_value = True
        mock_start.return_value = True

        result = bootstrap_instance(
            password="secret",
            port=9000,
            workspace_dir="/custom/workspace",
            image="custom:latest",
        )

        assert result == 0
        mock_workspace.assert_called_once_with("/custom/workspace")
        mock_start.assert_called_once_with("secret", 9000, "/custom/workspace", "custom:latest")


class TestMain:
    """Tests for main function."""

    @patch("user_data.bootstrap_instance")
    def test_main(self, mock_bootstrap: MagicMock) -> None:
        """Test main function."""
        mock_bootstrap.return_value = 0

        result = main()

        assert result == 0
        mock_bootstrap.assert_called_once()