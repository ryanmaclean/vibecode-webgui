"""Tests for scripts/vfkit/launch_vscode_server_vm.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vfkit"))

from launch_vscode_server_vm import (
    VMConfig,
    build_vfkit_command,
    check_kernel,
    check_rootfs,
    check_vfkit_installed,
    get_file_size_human,
    launch_vm,
    log_error,
    log_info,
    log_success,
    log_warning,
    print_cleanup_message,
    print_vfkit_command,
    print_vm_config,
    run_launch_vm,
)


class TestVMConfig:
    """Tests for VMConfig dataclass."""

    def test_default_config(self) -> None:
        """Should create config with default values."""
        config = VMConfig()
        assert config.cpus == 4
        assert config.memory == 4096
        assert config.disk_size == "20G"
        assert config.vm_name == "vibecode-alpine-vscode"

    def test_kernel_dir(self) -> None:
        """Should compute kernel_dir correctly."""
        config = VMConfig()
        assert config.kernel_dir == config.vm_dir / "kernel"

    def test_rootfs_dir(self) -> None:
        """Should compute rootfs_dir correctly."""
        config = VMConfig()
        assert config.rootfs_dir == config.vm_dir / "rootfs"

    def test_disk_dir(self) -> None:
        """Should compute disk_dir correctly."""
        config = VMConfig()
        assert config.disk_dir == config.vm_dir / "disk"

    def test_logs_dir(self) -> None:
        """Should compute logs_dir correctly."""
        config = VMConfig()
        assert config.logs_dir == config.vm_dir / "logs"

    def test_kernel_path(self) -> None:
        """Should compute kernel_path correctly."""
        config = VMConfig()
        assert config.kernel_path == config.kernel_dir / "vmlinux"

    def test_rootfs_path(self) -> None:
        """Should compute rootfs_path correctly."""
        config = VMConfig()
        assert config.rootfs_path == config.rootfs_dir / "alpine-vscode-server-rootfs.cpio.gz"

    def test_console_log(self) -> None:
        """Should compute console_log correctly."""
        config = VMConfig()
        assert config.console_log == config.logs_dir / "console.log"

    def test_vsock_path(self) -> None:
        """Should compute vsock_path correctly."""
        config = VMConfig()
        assert config.vsock_path == config.vm_dir / "vsock.sock"

    def test_kernel_cmdline(self) -> None:
        """Should have correct kernel cmdline."""
        config = VMConfig()
        assert "console=hvc0" in config.kernel_cmdline
        assert "init=/sbin/init" in config.kernel_cmdline

    def test_custom_config(self, tmp_path: Path) -> None:
        """Should accept custom values."""
        config = VMConfig(vm_dir=tmp_path, cpus=8, memory=8192, disk_size="40G")
        assert config.vm_dir == tmp_path
        assert config.cpus == 8
        assert config.memory == 8192
        assert config.disk_size == "40G"

    @patch.dict("os.environ", {"VFKIT_CPUS": "2", "VFKIT_MEMORY": "2048"})
    def test_env_config(self, tmp_path: Path) -> None:
        """Should read from environment variables."""
        config = VMConfig(vm_dir=tmp_path)
        assert config.cpus == 2
        assert config.memory == 2048


class TestLogFunctions:
    """Tests for log helper functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should print info message."""
        log_info("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        log_success("Success")
        captured = capsys.readouterr()
        assert "Success" in captured.out

    def test_log_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning message."""
        log_warning("Warning")
        captured = capsys.readouterr()
        assert "Warning" in captured.out

    def test_log_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error message."""
        log_error("Error")
        captured = capsys.readouterr()
        assert "Error" in captured.out


class TestGetFileSizeHuman:
    """Tests for get_file_size_human function."""

    def test_bytes(self, tmp_path: Path) -> None:
        """Should format small files in bytes."""
        f = tmp_path / "small"
        f.write_bytes(b"x" * 100)
        result = get_file_size_human(f)
        assert "B" in result

    def test_megabytes(self, tmp_path: Path) -> None:
        """Should format larger files in MB."""
        f = tmp_path / "large"
        f.write_bytes(b"x" * (2 * 1024 * 1024))
        result = get_file_size_human(f)
        assert "MB" in result

    def test_nonexistent_file(self, tmp_path: Path) -> None:
        """Should return 0B for nonexistent files."""
        f = tmp_path / "missing"
        result = get_file_size_human(f)
        assert result == "0B"


class TestCheckVfkitInstalled:
    """Tests for check_vfkit_installed function."""

    @patch("launch_vscode_server_vm.shutil.which")
    def test_returns_true_when_installed(
        self, mock_which: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return True when vfkit is installed."""
        mock_which.return_value = "/opt/homebrew/bin/vfkit"
        assert check_vfkit_installed() is True
        captured = capsys.readouterr()
        assert "vfkit found" in captured.out

    @patch("launch_vscode_server_vm.shutil.which")
    def test_returns_false_when_not_installed(
        self, mock_which: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when vfkit is not installed."""
        mock_which.return_value = None
        assert check_vfkit_installed() is False
        captured = capsys.readouterr()
        assert "vfkit not found" in captured.out
        assert "brew install vfkit" in captured.out


class TestCheckKernel:
    """Tests for check_kernel function."""

    def test_returns_true_when_exists(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return True when kernel exists."""
        config = VMConfig(vm_dir=tmp_path)
        config.kernel_dir.mkdir(parents=True)
        config.kernel_path.write_bytes(b"fake kernel")

        assert check_kernel(config) is True
        captured = capsys.readouterr()
        assert "Kernel:" in captured.out

    def test_returns_false_when_missing(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when kernel is missing."""
        config = VMConfig(vm_dir=tmp_path)

        assert check_kernel(config) is False
        captured = capsys.readouterr()
        assert "Kernel not found" in captured.out


class TestCheckRootfs:
    """Tests for check_rootfs function."""

    def test_returns_true_when_exists(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return True when rootfs exists."""
        config = VMConfig(vm_dir=tmp_path)
        config.rootfs_dir.mkdir(parents=True)
        config.rootfs_path.write_bytes(b"fake rootfs")

        assert check_rootfs(config) is True
        captured = capsys.readouterr()
        assert "rootfs with VS Code Server" in captured.out

    def test_returns_false_when_missing(
        self, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when rootfs is missing."""
        config = VMConfig(vm_dir=tmp_path)

        assert check_rootfs(config) is False
        captured = capsys.readouterr()
        assert "Rootfs not found" in captured.out


class TestPrintVmConfig:
    """Tests for print_vm_config function."""

    def test_prints_config(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print VM configuration."""
        config = VMConfig(vm_dir=tmp_path, cpus=4, memory=4096)
        print_vm_config(config)
        captured = capsys.readouterr()
        assert "VM Configuration" in captured.out
        assert "CPUs:" in captured.out
        assert "Memory:" in captured.out
        assert "4096" in captured.out


class TestPrintVfkitCommand:
    """Tests for print_vfkit_command function."""

    def test_prints_command(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print vfkit command."""
        config = VMConfig(vm_dir=tmp_path)
        print_vfkit_command(config)
        captured = capsys.readouterr()
        assert "Starting VM" in captured.out
        assert "vfkit" in captured.out
        assert "--cpus" in captured.out
        assert "--memory" in captured.out
        assert "--kernel" in captured.out
        assert "--initrd" in captured.out
        assert "virtio-net" in captured.out
        assert "virtio-serial" in captured.out
        assert "virtio-rng" in captured.out
        assert "virtio-vsock" in captured.out


class TestPrintCleanupMessage:
    """Tests for print_cleanup_message function."""

    def test_prints_message(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print cleanup message."""
        config = VMConfig(vm_dir=tmp_path)
        print_cleanup_message(config)
        captured = capsys.readouterr()
        assert "VM stopped" in captured.out
        assert "Console log" in captured.out
        assert "OpenVSCode Server" in captured.out
        assert "http://localhost:3000" in captured.out


class TestBuildVfkitCommand:
    """Tests for build_vfkit_command function."""

    def test_builds_command(self, tmp_path: Path) -> None:
        """Should build correct vfkit command."""
        config = VMConfig(vm_dir=tmp_path, cpus=4, memory=4096)
        cmd = build_vfkit_command(config)

        assert cmd[0] == "vfkit"
        assert "--cpus" in cmd
        assert "4" in cmd
        assert "--memory" in cmd
        assert "4096" in cmd
        assert "--kernel" in cmd
        assert "--initrd" in cmd
        assert "--kernel-cmdline" in cmd

    def test_includes_devices(self, tmp_path: Path) -> None:
        """Should include virtio devices."""
        config = VMConfig(vm_dir=tmp_path)
        cmd = build_vfkit_command(config)

        # Check for device specifications
        device_indices = [i for i, x in enumerate(cmd) if x == "--device"]
        assert len(device_indices) == 4  # net, serial, rng, vsock

        # Verify device types
        cmd_str = " ".join(cmd)
        assert "virtio-net" in cmd_str
        assert "virtio-serial" in cmd_str
        assert "virtio-rng" in cmd_str
        assert "virtio-vsock" in cmd_str


class TestLaunchVm:
    """Tests for launch_vm function."""

    @patch("launch_vscode_server_vm.subprocess.Popen")
    def test_launches_vm(self, mock_popen: MagicMock, tmp_path: Path) -> None:
        """Should launch VM with vfkit."""
        mock_process = MagicMock()
        mock_process.wait.return_value = 0
        mock_popen.return_value = mock_process

        config = VMConfig(vm_dir=tmp_path)
        result = launch_vm(config)

        assert result == 0
        mock_popen.assert_called_once()

    @patch("launch_vscode_server_vm.subprocess.Popen")
    def test_handles_keyboard_interrupt(
        self, mock_popen: MagicMock, tmp_path: Path
    ) -> None:
        """Should handle Ctrl+C gracefully."""
        mock_popen.side_effect = KeyboardInterrupt()

        config = VMConfig(vm_dir=tmp_path)
        result = launch_vm(config)

        assert result == 0

    @patch("launch_vscode_server_vm.subprocess.Popen")
    def test_handles_subprocess_error(
        self, mock_popen: MagicMock, tmp_path: Path
    ) -> None:
        """Should handle subprocess errors."""
        mock_popen.side_effect = subprocess.SubprocessError("error")

        config = VMConfig(vm_dir=tmp_path)
        result = launch_vm(config)

        assert result == 1


class TestRunLaunchVm:
    """Tests for run_launch_vm function."""

    @patch("launch_vscode_server_vm.check_vfkit_installed")
    def test_fails_when_vfkit_not_installed(
        self, mock_check: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when vfkit is not installed."""
        mock_check.return_value = False
        config = VMConfig(vm_dir=tmp_path)

        result = run_launch_vm(config)

        assert result == 1

    @patch("launch_vscode_server_vm.check_vfkit_installed")
    @patch("launch_vscode_server_vm.check_kernel")
    def test_fails_when_kernel_missing(
        self, mock_kernel: MagicMock, mock_vfkit: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when kernel is missing."""
        mock_vfkit.return_value = True
        mock_kernel.return_value = False
        config = VMConfig(vm_dir=tmp_path)

        result = run_launch_vm(config)

        assert result == 1

    @patch("launch_vscode_server_vm.check_vfkit_installed")
    @patch("launch_vscode_server_vm.check_kernel")
    @patch("launch_vscode_server_vm.check_rootfs")
    def test_fails_when_rootfs_missing(
        self,
        mock_rootfs: MagicMock,
        mock_kernel: MagicMock,
        mock_vfkit: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when rootfs is missing."""
        mock_vfkit.return_value = True
        mock_kernel.return_value = True
        mock_rootfs.return_value = False
        config = VMConfig(vm_dir=tmp_path)

        result = run_launch_vm(config)

        assert result == 1

    @patch("launch_vscode_server_vm.check_vfkit_installed")
    @patch("launch_vscode_server_vm.check_kernel")
    @patch("launch_vscode_server_vm.check_rootfs")
    @patch("launch_vscode_server_vm.launch_vm")
    @patch("launch_vscode_server_vm.atexit.register")
    def test_launches_when_all_checks_pass(
        self,
        mock_atexit: MagicMock,
        mock_launch: MagicMock,
        mock_rootfs: MagicMock,
        mock_kernel: MagicMock,
        mock_vfkit: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should launch VM when all checks pass."""
        mock_vfkit.return_value = True
        mock_kernel.return_value = True
        mock_rootfs.return_value = True
        mock_launch.return_value = 0
        config = VMConfig(vm_dir=tmp_path)

        result = run_launch_vm(config)

        assert result == 0
        mock_launch.assert_called_once()
        mock_atexit.assert_called_once()
