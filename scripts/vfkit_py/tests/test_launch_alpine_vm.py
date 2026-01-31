"""Tests for 04-launch-alpine-vm.py functionality."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.vfkit import launch_alpine_vm


class TestGetVmPaths:
    """Tests for get_vm_paths function."""

    def test_returns_dict_of_paths(self) -> None:
        """get_vm_paths should return a dict with Path values."""
        result = launch_alpine_vm.get_vm_paths()
        assert isinstance(result, dict)
        assert all(isinstance(v, Path) for v in result.values())

    def test_contains_required_keys(self) -> None:
        """Should contain all required path keys."""
        result = launch_alpine_vm.get_vm_paths()
        required_keys = [
            "vm_dir", "kernel_dir", "rootfs_dir", "disk_dir",
            "log_dir", "kernel", "initramfs_custom", "disk_image",
            "console_log",
        ]
        for key in required_keys:
            assert key in result

    def test_paths_in_home(self) -> None:
        """All paths should be under home directory."""
        result = launch_alpine_vm.get_vm_paths()
        for path in result.values():
            assert str(Path.home()) in str(path)


class TestGetVmConfig:
    """Tests for get_vm_config function."""

    def test_returns_dict(self) -> None:
        """get_vm_config should return a dict."""
        result = launch_alpine_vm.get_vm_config()
        assert isinstance(result, dict)

    def test_contains_required_keys(self) -> None:
        """Should contain all required config keys."""
        result = launch_alpine_vm.get_vm_config()
        required_keys = ["name", "cpus", "memory", "disk_size"]
        for key in required_keys:
            assert key in result

    def test_default_values(self) -> None:
        """Should have sensible default values."""
        result = launch_alpine_vm.get_vm_config()
        assert result["name"] == "vibecode-alpine"
        assert result["cpus"] >= 1
        assert result["memory"] >= 1024  # At least 1GB
        assert "G" in str(result["disk_size"])  # Contains size unit

    @patch.dict(os.environ, {"VFKIT_CPUS": "8", "VFKIT_MEMORY": "8192"})
    def test_respects_environment_vars(self) -> None:
        """Should respect environment variable overrides."""
        result = launch_alpine_vm.get_vm_config()
        assert result["cpus"] == 8
        assert result["memory"] == 8192


class TestVerifyVfkit:
    """Tests for verify_vfkit function."""

    @patch("shutil.which")
    def test_returns_path_when_found(self, mock_which: MagicMock) -> None:
        """Should return vfkit path when found."""
        mock_which.return_value = "/usr/local/bin/vfkit"
        result = launch_alpine_vm.verify_vfkit()
        assert result == "/usr/local/bin/vfkit"

    @patch("shutil.which")
    def test_raises_when_not_found(self, mock_which: MagicMock) -> None:
        """Should raise RuntimeError when vfkit not found."""
        mock_which.return_value = None
        with pytest.raises(RuntimeError, match="vfkit not found"):
            launch_alpine_vm.verify_vfkit()


class TestVerifyKernel:
    """Tests for verify_kernel function."""

    def test_returns_kernel_path_when_exists(self, tmp_path: Path) -> None:
        """Should return kernel path when it exists."""
        kernel = tmp_path / "vmlinux"
        kernel.write_bytes(b"kernel data" * 1000)

        paths = {"kernel": kernel}
        result = launch_alpine_vm.verify_kernel(paths)
        assert result == kernel

    def test_raises_when_kernel_missing(self, tmp_path: Path) -> None:
        """Should raise RuntimeError when kernel doesn't exist."""
        paths = {"kernel": tmp_path / "nonexistent"}
        with pytest.raises(RuntimeError, match="Kernel not found"):
            launch_alpine_vm.verify_kernel(paths)


class TestGetInitramfs:
    """Tests for get_initramfs function."""

    def test_prefers_custom_initramfs(self, tmp_path: Path) -> None:
        """Should prefer custom initramfs over kernel initramfs."""
        custom = tmp_path / "custom.cpio.gz"
        kernel = tmp_path / "kernel_initramfs"
        custom.write_bytes(b"custom")
        kernel.write_bytes(b"kernel")

        paths = {"initramfs_custom": custom, "initramfs_kernel": kernel}
        result = launch_alpine_vm.get_initramfs(paths)
        assert result == custom

    def test_falls_back_to_kernel_initramfs(self, tmp_path: Path) -> None:
        """Should fall back to kernel initramfs if custom doesn't exist."""
        kernel = tmp_path / "kernel_initramfs"
        kernel.write_bytes(b"kernel")

        paths = {
            "initramfs_custom": tmp_path / "nonexistent",
            "initramfs_kernel": kernel,
        }
        result = launch_alpine_vm.get_initramfs(paths)
        assert result == kernel

    def test_raises_when_none_found(self, tmp_path: Path) -> None:
        """Should raise RuntimeError when no initramfs found."""
        paths = {
            "initramfs_custom": tmp_path / "nonexistent1",
            "initramfs_kernel": tmp_path / "nonexistent2",
        }
        with pytest.raises(RuntimeError, match="No initramfs found"):
            launch_alpine_vm.get_initramfs(paths)


class TestCreateDiskImage:
    """Tests for create_disk_image function."""

    def test_returns_existing_disk(self, tmp_path: Path) -> None:
        """Should return existing disk image without creating new one."""
        disk_dir = tmp_path / "disk"
        disk_dir.mkdir()
        disk_image = disk_dir / "root.img"
        disk_image.write_bytes(b"existing disk")

        paths = {"disk_dir": disk_dir, "disk_image": disk_image}
        config = {"disk_size": "20G"}

        result = launch_alpine_vm.create_disk_image(paths, config)
        assert result == disk_image

    @patch("shutil.which")
    def test_creates_sparse_file_without_qemu(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should create sparse file when qemu-img not available."""
        mock_which.return_value = None
        disk_dir = tmp_path / "disk"
        disk_image = disk_dir / "root.img"

        paths = {"disk_dir": disk_dir, "disk_image": disk_image}
        config = {"disk_size": "1G"}

        result = launch_alpine_vm.create_disk_image(paths, config)
        assert result.exists()
        # Check it's approximately the right size (sparse file)
        assert result.stat().st_size == 1024**3


class TestPrepareConsoleLog:
    """Tests for prepare_console_log function."""

    def test_creates_log_directory(self, tmp_path: Path) -> None:
        """Should create log directory if it doesn't exist."""
        log_dir = tmp_path / "logs"
        console_log = log_dir / "console.log"

        paths = {"log_dir": log_dir, "console_log": console_log}
        launch_alpine_vm.prepare_console_log(paths)

        assert log_dir.exists()

    def test_creates_empty_log_file(self, tmp_path: Path) -> None:
        """Should create empty console log file."""
        log_dir = tmp_path / "logs"
        log_dir.mkdir()
        console_log = log_dir / "console.log"

        paths = {"log_dir": log_dir, "console_log": console_log}
        result = launch_alpine_vm.prepare_console_log(paths)

        assert result.exists()
        assert result.read_text() == ""

    def test_truncates_existing_log(self, tmp_path: Path) -> None:
        """Should truncate existing log file."""
        log_dir = tmp_path / "logs"
        log_dir.mkdir()
        console_log = log_dir / "console.log"
        console_log.write_text("old log content")

        paths = {"log_dir": log_dir, "console_log": console_log}
        result = launch_alpine_vm.prepare_console_log(paths)

        assert result.read_text() == ""


class TestBuildVfkitCommand:
    """Tests for build_vfkit_command function."""

    def test_returns_list(self, tmp_path: Path) -> None:
        """Should return a list of strings."""
        result = launch_alpine_vm.build_vfkit_command(
            "/usr/local/bin/vfkit",
            tmp_path / "kernel",
            tmp_path / "initramfs",
            tmp_path / "disk.img",
            tmp_path / "console.log",
            tmp_path / "vsock.sock",
            {"cpus": 4, "memory": 4096, "name": "test"},
        )
        assert isinstance(result, list)
        assert all(isinstance(s, str) for s in result)

    def test_includes_vfkit_path(self, tmp_path: Path) -> None:
        """Should include vfkit binary path."""
        result = launch_alpine_vm.build_vfkit_command(
            "/usr/local/bin/vfkit",
            tmp_path / "kernel",
            tmp_path / "initramfs",
            tmp_path / "disk.img",
            tmp_path / "console.log",
            tmp_path / "vsock.sock",
            {"cpus": 4, "memory": 4096, "name": "test"},
        )
        assert result[0] == "/usr/local/bin/vfkit"

    def test_includes_cpu_and_memory(self, tmp_path: Path) -> None:
        """Should include CPU and memory configuration."""
        result = launch_alpine_vm.build_vfkit_command(
            "/usr/local/bin/vfkit",
            tmp_path / "kernel",
            tmp_path / "initramfs",
            tmp_path / "disk.img",
            tmp_path / "console.log",
            tmp_path / "vsock.sock",
            {"cpus": 8, "memory": 16384, "name": "test"},
        )
        assert "--cpus" in result
        assert "8" in result
        assert "--memory" in result
        assert "16384" in result

    def test_includes_kernel_and_initrd(self, tmp_path: Path) -> None:
        """Should include kernel and initrd paths."""
        kernel = tmp_path / "vmlinux"
        initramfs = tmp_path / "initramfs"

        result = launch_alpine_vm.build_vfkit_command(
            "/usr/local/bin/vfkit",
            kernel,
            initramfs,
            tmp_path / "disk.img",
            tmp_path / "console.log",
            tmp_path / "vsock.sock",
            {"cpus": 4, "memory": 4096, "name": "test"},
        )
        assert "--kernel" in result
        assert str(kernel) in result
        assert "--initrd" in result
        assert str(initramfs) in result


class TestCleanup:
    """Tests for cleanup function."""

    def test_prints_log_path(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print console log path."""
        console_log = tmp_path / "console.log"
        launch_alpine_vm.cleanup(console_log)

        captured = capsys.readouterr()
        assert str(console_log) in captured.out
        assert "VM stopped" in captured.out


class TestMain:
    """Tests for main function."""

    @patch("scripts.vfkit.launch_alpine_vm.get_vm_paths")
    @patch("scripts.vfkit.launch_alpine_vm.get_vm_config")
    @patch("scripts.vfkit.launch_alpine_vm.verify_vfkit")
    @patch("scripts.vfkit.launch_alpine_vm.verify_kernel")
    @patch("scripts.vfkit.launch_alpine_vm.get_initramfs")
    @patch("scripts.vfkit.launch_alpine_vm.create_disk_image")
    @patch("scripts.vfkit.launch_alpine_vm.prepare_console_log")
    @patch("scripts.vfkit.launch_alpine_vm.build_vfkit_command")
    @patch("subprocess.run")
    def test_successful_launch_returns_zero(
        self,
        mock_run: MagicMock,
        mock_build: MagicMock,
        mock_log: MagicMock,
        mock_disk: MagicMock,
        mock_initramfs: MagicMock,
        mock_kernel: MagicMock,
        mock_vfkit: MagicMock,
        mock_config: MagicMock,
        mock_paths: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Successful VM launch should return 0."""
        mock_paths.return_value = {
            "vsock": tmp_path / "vsock.sock",
            "console_log": tmp_path / "console.log",
        }
        mock_config.return_value = {"cpus": 4, "memory": 4096, "disk_size": "20G", "name": "test"}
        mock_vfkit.return_value = "/usr/local/bin/vfkit"
        mock_kernel.return_value = tmp_path / "kernel"
        mock_initramfs.return_value = tmp_path / "initramfs"
        mock_disk.return_value = tmp_path / "disk.img"
        mock_log.return_value = tmp_path / "console.log"
        mock_build.return_value = ["vfkit", "--test"]
        mock_run.return_value = MagicMock(returncode=0)

        result = launch_alpine_vm.main()
        assert result == 0

    @patch("scripts.vfkit.launch_alpine_vm.get_vm_paths")
    @patch("scripts.vfkit.launch_alpine_vm.get_vm_config")
    @patch("scripts.vfkit.launch_alpine_vm.verify_vfkit")
    def test_vfkit_not_found_returns_one(
        self,
        mock_vfkit: MagicMock,
        mock_config: MagicMock,
        mock_paths: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should return 1 when vfkit not found."""
        mock_paths.return_value = {}
        mock_config.return_value = {}
        mock_vfkit.side_effect = RuntimeError("vfkit not found")

        result = launch_alpine_vm.main()
        assert result == 1
