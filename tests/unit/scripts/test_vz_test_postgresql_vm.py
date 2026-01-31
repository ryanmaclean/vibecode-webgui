
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

"""Tests for scripts/vz/test_postgresql_vm.py"""

from __future__ import annotations

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
    run_test_suite,
)


class TestVMConfig:
    """Tests for VMConfig dataclass."""

    def test_creates_config_with_paths(self) -> None:
        """Should create config with provided paths."""
        vm_dir = Path("/tmp/vm")
        package_dir = Path("/tmp/pkg")
        config = VMConfig(vm_dir=vm_dir, package_dir=package_dir)

        assert config.vm_dir == vm_dir
        assert config.package_dir == package_dir


class TestGetDefaultConfig:
    """Tests for get_default_config function."""

    def test_returns_vmconfig_instance(self) -> None:
        """Should return a VMConfig instance."""
        config = get_default_config()
        assert isinstance(config, VMConfig)

    def test_vm_dir_under_home(self) -> None:
        """Should set vm_dir under home directory."""
        config = get_default_config()
        assert ".vfkit" in str(config.vm_dir)
        assert "postgresql-vz" in str(config.vm_dir)


class TestGetFileSizeHuman:
    """Tests for get_file_size_human function."""

    def test_formats_bytes(self, tmp_path: Path) -> None:
        """Should format small files in bytes."""
        f = tmp_path / "small"
        f.write_bytes(b"x" * 100)
        assert "B" in get_file_size_human(f)

    def test_formats_megabytes(self, tmp_path: Path) -> None:
        """Should format larger files in megabytes."""
        f = tmp_path / "large"
        f.write_bytes(b"x" * (2 * 1024 * 1024))
        assert "MB" in get_file_size_human(f)


class TestCheckDiskFile:
    """Tests for check_disk_file function."""

    def test_returns_true_when_file_exists(self, tmp_path: Path) -> None:
        """Should return True when disk file exists."""
        disk = tmp_path / "disk.qcow2"
        disk.write_bytes(b"fake disk")
        result = check_disk_file(disk, "Test disk")
        assert result is True

    def test_returns_false_when_file_missing(self, tmp_path: Path) -> None:
        """Should return False when disk file is missing."""
        disk = tmp_path / "missing.qcow2"
        result = check_disk_file(disk, "Test disk")
        assert result is False


class TestCheckFileExists:
    """Tests for check_file_exists function."""

    def test_returns_true_when_file_exists(self, tmp_path: Path) -> None:
        """Should return True when file exists."""
        f = tmp_path / "file"
        f.touch()
        result = check_file_exists(f, "Test file")
        assert result is True

    def test_returns_false_when_file_missing(self, tmp_path: Path) -> None:
        """Should return False when file is missing."""
        f = tmp_path / "missing"
        result = check_file_exists(f, "Test file")
        assert result is False


class TestCheckPrerequisites:
    """Tests for check_prerequisites function."""

    def test_returns_false_when_root_disk_missing(self, tmp_path: Path) -> None:
        """Should return False when root disk is missing."""
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = check_prerequisites(config)
        assert result is False

    def test_returns_true_when_all_files_exist(self, tmp_path: Path) -> None:
        """Should return True when all prerequisites exist."""
        # Create all required files
        disk_dir = tmp_path / "disk"
        disk_dir.mkdir()
        (disk_dir / "root.qcow2").write_bytes(b"x")
        (disk_dir / "data.qcow2").write_bytes(b"x")

        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        (kernel_dir / "vmlinuz").write_bytes(b"x")
        (kernel_dir / "initramfs").write_bytes(b"x")

        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = check_prerequisites(config)
        assert result is True


class TestBuildPostgresqlVm:
    """Tests for build_postgresql_vm function."""

    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_true_on_successful_build(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True on successful build."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = build_postgresql_vm(config)
        assert result is True

    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_false_on_build_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when build fails."""
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = build_postgresql_vm(config)
        assert result is False

    @patch("test_postgresql_vm.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return False on timeout."""
        import subprocess

        mock_run.side_effect = subprocess.TimeoutExpired(cmd="swift", timeout=300)
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = build_postgresql_vm(config)
        assert result is False


class TestCheckLimaPostgresqlRunning:
    """Tests for check_lima_postgresql_running function."""

    @patch("test_postgresql_vm.shutil.which")
    def test_returns_false_when_limactl_not_found(
        self, mock_which: MagicMock
    ) -> None:
        """Should return False when limactl is not found."""
        mock_which.return_value = None
        result = check_lima_postgresql_running()
        assert result is False

    @patch("test_postgresql_vm.shutil.which")
    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_true_when_vm_running(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return True when Lima VM is running."""
        mock_which.return_value = "/usr/local/bin/limactl"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="vibecode-pgvector    Running    ...",
        )
        result = check_lima_postgresql_running()
        assert result is True

    @patch("test_postgresql_vm.shutil.which")
    @patch("test_postgresql_vm.subprocess.run")
    def test_returns_false_when_vm_not_running(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return False when Lima VM is not running."""
        mock_which.return_value = "/usr/local/bin/limactl"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="vibecode-pgvector    Stopped    ...",
        )
        result = check_lima_postgresql_running()
        assert result is False


class TestRunTestSuite:
    """Tests for run_test_suite function."""

    def test_returns_error_when_prerequisites_missing(self, tmp_path: Path) -> None:
        """Should return 1 when prerequisites are missing."""
        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = run_test_suite(config, interactive=False)
        assert result == 1

    @patch("test_postgresql_vm.build_postgresql_vm")
    @patch("test_postgresql_vm.check_lima_postgresql_running")
    def test_runs_full_suite_when_prerequisites_met(
        self,
        mock_lima: MagicMock,
        mock_build: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should run full suite when prerequisites are met."""
        # Create all required files
        disk_dir = tmp_path / "disk"
        disk_dir.mkdir()
        (disk_dir / "root.qcow2").write_bytes(b"x")
        (disk_dir / "data.qcow2").write_bytes(b"x")

        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        (kernel_dir / "vmlinuz").write_bytes(b"x")
        (kernel_dir / "initramfs").write_bytes(b"x")

        mock_build.return_value = True
        mock_lima.return_value = False

        config = VMConfig(vm_dir=tmp_path, package_dir=tmp_path)
        result = run_test_suite(config, interactive=False)
        assert result == 0