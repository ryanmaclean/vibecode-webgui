"""Tests for scripts/vz/test_postgresql_vm.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vz"))

from test_postgresql_vm import (
    VMConfig,
    build_postgresql_vm,
    check_disk_file,
    check_file_exists,
    check_lima_postgresql_running,
    check_prerequisites,
    get_default_config,
    get_file_size_human,
    print_error,
    print_status,
    print_success,
    print_warning,
    prompt_continue,
    prompt_start_vm,
    run_test_suite,
    show_instructions,
    show_vm_info,
)


class TestVMConfig:
    """Tests for VMConfig dataclass."""

    def test_creates_config(self) -> None:
        """Should create a VM config."""
        config = VMConfig(
            vm_dir=Path("/test/vm"),
            package_dir=Path("/test/package"),
        )
        assert config.vm_dir == Path("/test/vm")
        assert config.package_dir == Path("/test/package")


class TestGetDefaultConfig:
    """Tests for get_default_config function."""

    def test_returns_config(self) -> None:
        """Should return a VMConfig."""
        config = get_default_config()
        assert isinstance(config, VMConfig)
        assert isinstance(config.vm_dir, Path)
        assert isinstance(config.package_dir, Path)

    def test_vm_dir_in_home(self) -> None:
        """Should have vm_dir under home directory."""
        config = get_default_config()
        assert ".vfkit" in str(config.vm_dir)


class TestPrintFunctions:
    """Tests for print helper functions."""

    def test_print_status(self, capsys: pytest.CaptureFixture) -> None:
        """Should print status message."""
        print_status("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_print_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        print_success("Success")
        captured = capsys.readouterr()
        assert "Success" in captured.out
        assert "ok" in captured.out

    def test_print_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error message."""
        print_error("Error")
        captured = capsys.readouterr()
        assert "Error" in captured.out

    def test_print_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning message."""
        print_warning("Warning")
        captured = capsys.readouterr()
        assert "Warning" in captured.out


class TestGetFileSizeHuman:
    """Tests for get_file_size_human function."""

    def test_bytes(self, tmp_path: Path) -> None:
        """Should format small files in bytes."""
        f = tmp_path / "small"
        f.write_bytes(b"x" * 100)
        result = get_file_size_human(f)
        assert "B" in result

    def test_kilobytes(self, tmp_path: Path) -> None:
        """Should format files in kilobytes."""
        f = tmp_path / "medium"
        f.write_bytes(b"x" * 2000)
        result = get_file_size_human(f)
        assert "KB" in result or "B" in result

    def test_megabytes(self, tmp_path: Path) -> None:
        """Should format larger files in megabytes."""
        f = tmp_path / "large"
        f.write_bytes(b"x" * (2 * 1024 * 1024))
        result = get_file_size_human(f)
        assert "MB" in result


class TestCheckDiskFile:
    """Tests for check_disk_file function."""

    def test_returns_true_when_exists(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return True when file exists."""
        f = tmp_path / "disk.qcow2"
        f.write_bytes(b"test")
        assert check_disk_file(f, "Test disk") is True
        captured = capsys.readouterr()
        assert "found" in captured.out

    def test_returns_false_when_missing(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when file is missing."""
        f = tmp_path / "missing.qcow2"
        assert check_disk_file(f, "Test disk") is False
        captured = capsys.readouterr()
        assert "not found" in captured.out


class TestCheckFileExists:
    """Tests for check_file_exists function."""

    def test_returns_true_when_exists(self, tmp_path: Path) -> None:
        """Should return True when file exists."""
        f = tmp_path / "test"
        f.write_text("test")
        assert check_file_exists(f, "Test file") is True

    def test_returns_false_when_missing(self, tmp_path: Path) -> None:
        """Should return False when file is missing."""
        f = tmp_path / "missing"
        assert check_file_exists(f, "Test file") is False


class TestCheckPrerequisites:
    """Tests for check_prerequisites function."""

    def test_returns_true_when_all_exist(self, tmp_path: Path) -> None:
        """Should return True when all prerequisites exist."""
        # Create directory structure
        disk_dir = tmp_path / "disk"
        disk_dir.mkdir()
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()

        (disk_dir / "root.qcow2").write_bytes(b"root")
        (disk_dir / "data.qcow2").write_bytes(b"data")
        (kernel_dir / "vmlinuz").write_bytes(b"kernel")
        (kernel_dir / "initramfs").write_bytes(b"initramfs")

        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert check_prerequisites(config) is True

    def test_returns_false_when_missing(self, tmp_path: Path) -> None:
        """Should return False when prerequisites are missing."""
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert check_prerequisites(config) is False


class TestBuildPostgresqlVm:
    """Tests for build_postgresql_vm function."""

    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_true_on_success(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True on successful build."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert build_postgresql_vm(config) is True

    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_false_on_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False on build failure."""
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert build_postgresql_vm(config) is False

    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_false_on_timeout(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False on timeout."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="swift", timeout=300)
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert build_postgresql_vm(config) is False


class TestCheckLimaPostgresqlRunning:
    """Tests for check_lima_postgresql_running function."""

    @patch("test_postgresql_vm.shutil.which")
    def test_returns_false_when_limactl_not_found(
        self, mock_which: MagicMock
    ) -> None:
        """Should return False when limactl is not found."""
        mock_which.return_value = None
        assert check_lima_postgresql_running() is False

    @patch("test_postgresql_vm.shutil.which")
    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_true_when_running(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return True when Lima VM is running."""
        mock_which.return_value = "/usr/local/bin/limactl"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="vibecode-pgvector Running",
        )
        assert check_lima_postgresql_running() is True

    @patch("test_postgresql_vm.shutil.which")
    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_false_when_not_running(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return False when Lima VM is not running."""
        mock_which.return_value = "/usr/local/bin/limactl"
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        assert check_lima_postgresql_running() is False


class TestPromptContinue:
    """Tests for prompt_continue function."""

    @patch("builtins.input", return_value="y")
    def test_returns_true_on_yes(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'y'."""
        assert prompt_continue() is True

    @patch("builtins.input", return_value="n")
    def test_returns_false_on_no(self, mock_input: MagicMock) -> None:
        """Should return False when user enters 'n'."""
        assert prompt_continue() is False

    @patch("builtins.input", side_effect=EOFError)
    def test_returns_false_on_eof(self, mock_input: MagicMock) -> None:
        """Should return False on EOF."""
        assert prompt_continue() is False


class TestPromptStartVm:
    """Tests for prompt_start_vm function."""

    @patch("builtins.input", return_value="y")
    def test_returns_true_on_yes(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'y'."""
        assert prompt_start_vm() is True

    @patch("builtins.input", return_value="n")
    def test_returns_false_on_no(self, mock_input: MagicMock) -> None:
        """Should return False when user enters 'n'."""
        assert prompt_start_vm() is False


class TestShowVmInfo:
    """Tests for show_vm_info function."""

    def test_prints_info(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print VM information."""
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        show_vm_info(config)
        captured = capsys.readouterr()
        assert "VM Path" in captured.out
        assert "Package" in captured.out


class TestShowInstructions:
    """Tests for show_instructions function."""

    def test_prints_instructions(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should print instructions."""
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        show_instructions(config)
        captured = capsys.readouterr()
        assert "swift run" in captured.out
        assert "psql" in captured.out


class TestRunTestSuite:
    """Tests for run_test_suite function."""

    @patch("test_postgresql_vm.check_prerequisites")
    def test_fails_on_missing_prerequisites(
        self, mock_check: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when prerequisites are missing."""
        mock_check.return_value = False
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert run_test_suite(config, interactive=False) == 1

    @patch("test_postgresql_vm.check_prerequisites")
    @patch("test_postgresql_vm.build_postgresql_vm")
    def test_fails_on_build_failure(
        self, mock_build: MagicMock, mock_check: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when build fails."""
        mock_check.return_value = True
        mock_build.return_value = False
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert run_test_suite(config, interactive=False) == 1

    @patch("test_postgresql_vm.check_prerequisites")
    @patch("test_postgresql_vm.build_postgresql_vm")
    @patch("test_postgresql_vm.check_lima_postgresql_running")
    def test_succeeds_non_interactive(
        self,
        mock_lima: MagicMock,
        mock_build: MagicMock,
        mock_check: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should succeed in non-interactive mode."""
        mock_check.return_value = True
        mock_build.return_value = True
        mock_lima.return_value = False
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        assert run_test_suite(config, interactive=False) == 0
