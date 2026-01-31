"""Tests for scripts/vfkit/setup_alpine_services.py"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vfkit"))

from setup_alpine_services import (
    PGVECTOR_VERSION,
    POSTGRES_VERSION,
    VALKEY_CONFIG,
    VALKEY_INIT_SCRIPT,
    VALKEY_VERSION,
    SetupResult,
    check_alpine,
    compile_valkey,
    download_valkey,
    install_valkey,
    install_valkey_dependencies,
    run_command,
    setup_nodejs,
    setup_postgresql,
    setup_valkey,
)


class TestConstants:
    """Tests for module constants."""

    def test_valkey_version_is_set(self) -> None:
        """Should have a valid Valkey version."""
        assert VALKEY_VERSION
        assert "." in VALKEY_VERSION

    def test_postgres_version_is_set(self) -> None:
        """Should have a valid PostgreSQL version."""
        assert POSTGRES_VERSION
        assert POSTGRES_VERSION.isdigit()

    def test_pgvector_version_is_set(self) -> None:
        """Should have a valid pgvector version."""
        assert PGVECTOR_VERSION
        assert "." in PGVECTOR_VERSION

    def test_valkey_config_has_required_settings(self) -> None:
        """Should have required Valkey configuration settings."""
        assert "bind 127.0.0.1" in VALKEY_CONFIG
        assert "port 6379" in VALKEY_CONFIG
        assert "maxmemory" in VALKEY_CONFIG
        assert "daemonize yes" in VALKEY_CONFIG

    def test_valkey_init_script_is_openrc(self) -> None:
        """Should be a valid OpenRC init script."""
        assert "#!/sbin/openrc-run" in VALKEY_INIT_SCRIPT
        assert "depend()" in VALKEY_INIT_SCRIPT
        assert "start_pre()" in VALKEY_INIT_SCRIPT


class TestSetupResult:
    """Tests for SetupResult dataclass."""

    def test_creates_success_result(self) -> None:
        """Should create a success result."""
        result = SetupResult(True, "Installed successfully", "Valkey")
        assert result.success is True
        assert result.message == "Installed successfully"
        assert result.task_name == "Valkey"

    def test_creates_failure_result(self) -> None:
        """Should create a failure result."""
        result = SetupResult(False, "Installation failed", "PostgreSQL")
        assert result.success is False
        assert result.message == "Installation failed"
        assert result.task_name == "PostgreSQL"


class TestRunCommand:
    """Tests for run_command function."""

    @patch("setup_alpine_services.subprocess.run")
    def test_runs_command_with_defaults(self, mock_run: MagicMock) -> None:
        """Should run command with default options."""
        mock_run.return_value = MagicMock(returncode=0)
        run_command(["echo", "test"])
        mock_run.assert_called_once()

    @patch("setup_alpine_services.subprocess.run")
    def test_passes_cwd_when_provided(self, mock_run: MagicMock) -> None:
        """Should pass cwd when provided."""
        mock_run.return_value = MagicMock(returncode=0)
        test_path = Path("/tmp/test")
        run_command(["ls"], cwd=test_path)

        call_kwargs = mock_run.call_args[1]
        assert call_kwargs["cwd"] == test_path


class TestCheckAlpine:
    """Tests for check_alpine function."""

    @patch("setup_alpine_services.Path")
    def test_returns_false_when_not_alpine(self, mock_path: MagicMock) -> None:
        """Should return False when not on Alpine."""
        mock_path.return_value.exists.return_value = False
        result = check_alpine()
        assert result is False

    @patch("setup_alpine_services.subprocess.run")
    @patch("setup_alpine_services.Path")
    def test_returns_true_when_on_alpine(
        self, mock_path_class: MagicMock, mock_run: MagicMock
    ) -> None:
        """Should return True when on Alpine."""
        mock_path_instance = MagicMock()
        mock_path_instance.exists.return_value = True
        mock_path_instance.read_text.return_value = "3.20.0"
        mock_path_class.return_value = mock_path_instance

        mock_run.return_value = MagicMock(stdout="aarch64")

        result = check_alpine()
        assert result is True


class TestInstallValkeyDependencies:
    """Tests for install_valkey_dependencies function."""

    @patch("setup_alpine_services.run_command")
    def test_returns_true_on_success(self, mock_run: MagicMock) -> None:
        """Should return True when dependencies installed."""
        mock_run.return_value = MagicMock()
        result = install_valkey_dependencies()
        assert result is True

    @patch("setup_alpine_services.run_command")
    def test_returns_false_on_failure(self, mock_run: MagicMock) -> None:
        """Should return False when installation fails."""
        import subprocess
        mock_run.side_effect = subprocess.CalledProcessError(1, "apk")
        result = install_valkey_dependencies()
        assert result is False


class TestDownloadValkey:
    """Tests for download_valkey function."""

    @patch("setup_alpine_services.run_command")
    def test_returns_true_on_success(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return True when download succeeds."""
        mock_run.return_value = MagicMock()
        result = download_valkey(tmp_path, "8.1.0")
        assert result is True

    @patch("setup_alpine_services.run_command")
    def test_creates_build_directory(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should create build directory."""
        mock_run.return_value = MagicMock()
        build_dir = tmp_path / "build"
        download_valkey(build_dir, "8.1.0")
        assert build_dir.exists()

    @patch("setup_alpine_services.run_command")
    def test_returns_false_on_download_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when download fails."""
        import subprocess
        mock_run.side_effect = subprocess.CalledProcessError(1, "wget")
        result = download_valkey(tmp_path, "8.1.0")
        assert result is False


class TestCompileValkey:
    """Tests for compile_valkey function."""

    @patch("setup_alpine_services.run_command")
    @patch("setup_alpine_services.subprocess.run")
    def test_returns_true_on_success(
        self, mock_subprocess: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True when compilation succeeds."""
        mock_subprocess.return_value = MagicMock(stdout="4")
        mock_run.return_value = MagicMock()
        result = compile_valkey(tmp_path)
        assert result is True

    @patch("setup_alpine_services.run_command")
    @patch("setup_alpine_services.subprocess.run")
    def test_returns_false_on_make_failure(
        self, mock_subprocess: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when make fails."""
        import subprocess
        mock_subprocess.return_value = MagicMock(stdout="4")
        mock_run.side_effect = subprocess.CalledProcessError(1, "make")
        result = compile_valkey(tmp_path)
        assert result is False


class TestInstallValkey:
    """Tests for install_valkey function."""

    @patch("setup_alpine_services.Path.write_text")
    @patch("setup_alpine_services.Path.mkdir")
    @patch("setup_alpine_services.run_command")
    def test_returns_true_on_success(
        self,
        mock_run: MagicMock,
        mock_mkdir: MagicMock,
        mock_write: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should return True when installation succeeds."""
        mock_run.return_value = MagicMock()
        result = install_valkey(tmp_path)
        assert result is True


class TestSetupValkey:
    """Tests for setup_valkey function."""

    @patch("setup_alpine_services.shutil.rmtree")
    @patch("setup_alpine_services.run_command")
    @patch("setup_alpine_services.install_valkey")
    @patch("setup_alpine_services.compile_valkey")
    @patch("setup_alpine_services.download_valkey")
    @patch("setup_alpine_services.install_valkey_dependencies")
    def test_returns_success_when_all_steps_pass(
        self,
        mock_deps: MagicMock,
        mock_download: MagicMock,
        mock_compile: MagicMock,
        mock_install: MagicMock,
        mock_run: MagicMock,
        mock_rmtree: MagicMock,
    ) -> None:
        """Should return success when all steps pass."""
        mock_deps.return_value = True
        mock_download.return_value = True
        mock_compile.return_value = True
        mock_install.return_value = True

        result = setup_valkey()
        assert result.success is True
        assert "Valkey" in result.task_name

    @patch("setup_alpine_services.install_valkey_dependencies")
    def test_returns_failure_when_deps_fail(self, mock_deps: MagicMock) -> None:
        """Should return failure when dependencies fail."""
        mock_deps.return_value = False
        result = setup_valkey()
        assert result.success is False


class TestSetupPostgresql:
    """Tests for setup_postgresql function."""

    @patch("time.sleep")
    @patch("setup_alpine_services.shutil.rmtree")
    @patch("setup_alpine_services.open", create=True)
    @patch("setup_alpine_services.Path")
    @patch("setup_alpine_services.run_command")
    def test_returns_success_result(
        self,
        mock_run: MagicMock,
        mock_path: MagicMock,
        mock_open: MagicMock,
        mock_rmtree: MagicMock,
        mock_sleep: MagicMock,
    ) -> None:
        """Should return success when PostgreSQL setup completes."""
        mock_run.return_value = MagicMock()
        mock_path_instance = MagicMock()
        mock_path.return_value = mock_path_instance

        result = setup_postgresql()
        assert result.task_name == "PostgreSQL"


class TestSetupNodejs:
    """Tests for setup_nodejs function."""

    @patch("setup_alpine_services.shutil.which")
    @patch("setup_alpine_services.run_command")
    def test_returns_success_when_node_works(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return success when Node.js works."""
        mock_which.return_value = "/usr/bin/node"
        mock_run.return_value = MagicMock(stdout="v24.0.0")

        result = setup_nodejs()
        assert result.success is True
        assert result.task_name == "Node.js"

    @patch("setup_alpine_services.shutil.which")
    @patch("setup_alpine_services.run_command")
    def test_installs_node_when_missing(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should install Node.js when not found."""
        mock_which.return_value = None
        mock_run.return_value = MagicMock(stdout="v24.0.0")

        setup_nodejs()

        # Check that apk add was called
        calls = [str(c) for c in mock_run.call_args_list]
        assert any("apk" in c for c in calls)
