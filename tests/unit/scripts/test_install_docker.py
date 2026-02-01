"""Tests for scripts/install_docker.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from install_docker import (
    check_docker_daemon_running,
    check_docker_installed,
    check_homebrew_installed,
    get_docker_version,
    install_docker_via_homebrew,
    print_installation_options,
    print_post_install_instructions,
    prompt_install,
    run_install_docker,
)


class TestCheckDockerInstalled:
    """Tests for check_docker_installed function."""

    @patch("install_docker.shutil.which")
    def test_returns_true_when_docker_found(self, mock_which: MagicMock) -> None:
        """Should return True when docker is found."""
        mock_which.return_value = "/usr/local/bin/docker"
        assert check_docker_installed() is True
        mock_which.assert_called_once_with("docker")

    @patch("install_docker.shutil.which")
    def test_returns_false_when_docker_not_found(self, mock_which: MagicMock) -> None:
        """Should return False when docker is not found."""
        mock_which.return_value = None
        assert check_docker_installed() is False


class TestGetDockerVersion:
    """Tests for get_docker_version function."""

    @patch("install_docker.subprocess.run")
    def test_returns_version_on_success(self, mock_run: MagicMock) -> None:
        """Should return version string on success."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="Docker version 24.0.5, build ced0996\n",
        )
        result = get_docker_version()
        assert result == "Docker version 24.0.5, build ced0996"

    @patch("install_docker.subprocess.run")
    def test_returns_none_on_failure(self, mock_run: MagicMock) -> None:
        """Should return None on command failure."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        result = get_docker_version()
        assert result is None

    @patch("install_docker.subprocess.run")
    def test_returns_none_on_timeout(self, mock_run: MagicMock) -> None:
        """Should return None on timeout."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="docker", timeout=10)
        result = get_docker_version()
        assert result is None

    @patch("install_docker.subprocess.run")
    def test_returns_none_on_subprocess_error(self, mock_run: MagicMock) -> None:
        """Should return None on subprocess error."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        result = get_docker_version()
        assert result is None


class TestCheckDockerDaemonRunning:
    """Tests for check_docker_daemon_running function."""

    @patch("install_docker.subprocess.run")
    def test_returns_true_when_daemon_running(self, mock_run: MagicMock) -> None:
        """Should return True when daemon is running."""
        mock_run.return_value = MagicMock(returncode=0)
        assert check_docker_daemon_running() is True

    @patch("install_docker.subprocess.run")
    def test_returns_false_when_daemon_not_running(self, mock_run: MagicMock) -> None:
        """Should return False when daemon is not running."""
        mock_run.return_value = MagicMock(returncode=1)
        assert check_docker_daemon_running() is False

    @patch("install_docker.subprocess.run")
    def test_returns_false_on_timeout(self, mock_run: MagicMock) -> None:
        """Should return False on timeout."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="docker", timeout=30)
        assert check_docker_daemon_running() is False

    @patch("install_docker.subprocess.run")
    def test_returns_false_on_subprocess_error(self, mock_run: MagicMock) -> None:
        """Should return False on subprocess error."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        assert check_docker_daemon_running() is False


class TestCheckHomebrewInstalled:
    """Tests for check_homebrew_installed function."""

    @patch("install_docker.shutil.which")
    def test_returns_true_when_brew_found(self, mock_which: MagicMock) -> None:
        """Should return True when brew is found."""
        mock_which.return_value = "/opt/homebrew/bin/brew"
        assert check_homebrew_installed() is True
        mock_which.assert_called_once_with("brew")

    @patch("install_docker.shutil.which")
    def test_returns_false_when_brew_not_found(self, mock_which: MagicMock) -> None:
        """Should return False when brew is not found."""
        mock_which.return_value = None
        assert check_homebrew_installed() is False


class TestInstallDockerViaHomebrew:
    """Tests for install_docker_via_homebrew function."""

    @patch("install_docker.subprocess.run")
    def test_returns_zero_on_success(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return 0 on successful installation."""
        mock_run.return_value = MagicMock(returncode=0)
        result = install_docker_via_homebrew()
        assert result == 0
        mock_run.assert_called_once()
        call_args = mock_run.call_args
        assert call_args[0][0] == ["brew", "install", "--cask", "docker"]

    @patch("install_docker.subprocess.run")
    def test_returns_nonzero_on_failure(self, mock_run: MagicMock) -> None:
        """Should return non-zero on installation failure."""
        mock_run.return_value = MagicMock(returncode=1)
        result = install_docker_via_homebrew()
        assert result == 1

    @patch("install_docker.subprocess.run")
    def test_returns_one_on_timeout(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return 1 on timeout."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="brew", timeout=600)
        result = install_docker_via_homebrew()
        assert result == 1
        captured = capsys.readouterr()
        assert "timed out" in captured.out

    @patch("install_docker.subprocess.run")
    def test_returns_one_on_subprocess_error(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return 1 on subprocess error."""
        mock_run.side_effect = subprocess.SubprocessError("test error")
        result = install_docker_via_homebrew()
        assert result == 1
        captured = capsys.readouterr()
        assert "failed" in captured.out


class TestPrintInstallationOptions:
    """Tests for print_installation_options function."""

    def test_prints_homebrew_option(self, capsys: pytest.CaptureFixture) -> None:
        """Should print Homebrew installation option."""
        print_installation_options()
        captured = capsys.readouterr()
        assert "Homebrew" in captured.out
        assert "brew install --cask docker" in captured.out

    def test_prints_manual_download_option(self, capsys: pytest.CaptureFixture) -> None:
        """Should print manual download option."""
        print_installation_options()
        captured = capsys.readouterr()
        assert "docker.com" in captured.out


class TestPrintPostInstallInstructions:
    """Tests for print_post_install_instructions function."""

    def test_prints_instructions(self, capsys: pytest.CaptureFixture) -> None:
        """Should print post-installation instructions."""
        print_post_install_instructions()
        captured = capsys.readouterr()
        assert "Docker Desktop installed" in captured.out
        assert "Docker.app" in captured.out


class TestPromptInstall:
    """Tests for prompt_install function."""

    @patch("builtins.input", return_value="y")
    def test_returns_true_on_yes(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'y'."""
        assert prompt_install() is True

    @patch("builtins.input", return_value="yes")
    def test_returns_true_on_yes_full(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'yes'."""
        assert prompt_install() is True

    @patch("builtins.input", return_value="Y")
    def test_returns_true_on_uppercase_y(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'Y'."""
        assert prompt_install() is True

    @patch("builtins.input", return_value="n")
    def test_returns_false_on_no(self, mock_input: MagicMock) -> None:
        """Should return False when user enters 'n'."""
        assert prompt_install() is False

    @patch("builtins.input", return_value="")
    def test_returns_false_on_empty(self, mock_input: MagicMock) -> None:
        """Should return False on empty input (default)."""
        assert prompt_install() is False

    @patch("builtins.input", side_effect=EOFError)
    def test_returns_false_on_eof(self, mock_input: MagicMock) -> None:
        """Should return False on EOF."""
        assert prompt_install() is False

    @patch("builtins.input", side_effect=KeyboardInterrupt)
    def test_returns_false_on_keyboard_interrupt(self, mock_input: MagicMock) -> None:
        """Should return False on keyboard interrupt."""
        assert prompt_install() is False


class TestRunInstallDocker:
    """Tests for run_install_docker function."""

    @patch("install_docker.check_docker_installed")
    @patch("install_docker.get_docker_version")
    @patch("install_docker.check_docker_daemon_running")
    def test_returns_zero_when_docker_running(
        self,
        mock_daemon: MagicMock,
        mock_version: MagicMock,
        mock_installed: MagicMock,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should return 0 when Docker is installed and running."""
        mock_installed.return_value = True
        mock_version.return_value = "Docker version 24.0.5"
        mock_daemon.return_value = True

        result = run_install_docker(interactive=False)

        assert result == 0
        captured = capsys.readouterr()
        assert "already installed" in captured.out
        assert "daemon is running" in captured.out

    @patch("install_docker.check_docker_installed")
    @patch("install_docker.get_docker_version")
    @patch("install_docker.check_docker_daemon_running")
    def test_returns_one_when_daemon_not_running(
        self,
        mock_daemon: MagicMock,
        mock_version: MagicMock,
        mock_installed: MagicMock,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should return 1 when Docker is installed but daemon not running."""
        mock_installed.return_value = True
        mock_version.return_value = "Docker version 24.0.5"
        mock_daemon.return_value = False

        result = run_install_docker(interactive=False)

        assert result == 1
        captured = capsys.readouterr()
        assert "daemon is not running" in captured.out

    @patch("install_docker.check_docker_installed")
    def test_returns_one_when_not_interactive_and_not_installed(
        self,
        mock_installed: MagicMock,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should return 1 when not interactive and Docker not installed."""
        mock_installed.return_value = False

        result = run_install_docker(interactive=False)

        assert result == 1
        captured = capsys.readouterr()
        assert "not installed" in captured.out

    @patch("install_docker.check_docker_installed")
    @patch("install_docker.prompt_install")
    @patch("install_docker.check_homebrew_installed")
    @patch("install_docker.install_docker_via_homebrew")
    def test_installs_via_homebrew_on_confirmation(
        self,
        mock_install: MagicMock,
        mock_brew: MagicMock,
        mock_prompt: MagicMock,
        mock_installed: MagicMock,
    ) -> None:
        """Should install via Homebrew when user confirms."""
        mock_installed.return_value = False
        mock_prompt.return_value = True
        mock_brew.return_value = True
        mock_install.return_value = 0

        result = run_install_docker(interactive=True)

        assert result == 0
        mock_install.assert_called_once()

    @patch("install_docker.check_docker_installed")
    @patch("install_docker.prompt_install")
    @patch("install_docker.check_homebrew_installed")
    def test_shows_error_when_homebrew_not_found(
        self,
        mock_brew: MagicMock,
        mock_prompt: MagicMock,
        mock_installed: MagicMock,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should show error when Homebrew is not found."""
        mock_installed.return_value = False
        mock_prompt.return_value = True
        mock_brew.return_value = False

        result = run_install_docker(interactive=True)

        assert result == 1
        captured = capsys.readouterr()
        assert "Homebrew not found" in captured.out

    @patch("install_docker.check_docker_installed")
    @patch("install_docker.prompt_install")
    def test_shows_cancelled_message_on_decline(
        self,
        mock_prompt: MagicMock,
        mock_installed: MagicMock,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should show cancelled message when user declines."""
        mock_installed.return_value = False
        mock_prompt.return_value = False

        result = run_install_docker(interactive=True)

        assert result == 1
        captured = capsys.readouterr()
        assert "cancelled" in captured.out
