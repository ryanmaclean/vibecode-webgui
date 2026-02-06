"""Tests for scripts/launch/launch_postgresql.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "launch"))

from launch_postgresql import (
    LaunchConfig,
    check_initramfs,
    clean_console_logs,
    extract_vm_ip,
    get_latest_console_log,
    kill_running_vms,
    launch_postgresql,
    launch_vm,
    log_error,
    log_info,
    log_success,
    log_warning,
    print_access_instructions,
    print_header,
    swap_initramfs,
)


class TestLaunchConfig:
    """Tests for LaunchConfig dataclass."""

    def test_default_values(self) -> None:
        """Should create config with default values."""
        config = LaunchConfig()
        assert config.boot_wait_seconds == 30
        assert config.postgresql_port == 5432
        assert config.console_log_pattern == "/tmp/vibecode-console-*.log"

    def test_postgresql_initramfs(self) -> None:
        """Should compute postgresql_initramfs path."""
        config = LaunchConfig()
        assert config.postgresql_initramfs == config.azure_dir / "postgresql-standalone.cpio.gz"

    def test_nodejs_initramfs(self) -> None:
        """Should compute nodejs_initramfs path."""
        config = LaunchConfig()
        assert config.nodejs_initramfs == config.azure_dir / "nodejs-complete.cpio.gz"

    def test_nodejs_backup(self) -> None:
        """Should compute nodejs_backup path."""
        config = LaunchConfig()
        assert config.nodejs_backup == config.azure_dir / "nodejs-backup.cpio.gz"

    def test_vm_executable(self) -> None:
        """Should compute vm_executable path."""
        config = LaunchConfig()
        assert "NodeJS" in str(config.vm_executable)
        assert "MacOS" in str(config.vm_executable)

    def test_custom_config(self, tmp_path: Path) -> None:
        """Should accept custom values."""
        config = LaunchConfig(
            azure_dir=tmp_path,
            boot_wait_seconds=60,
            postgresql_port=5433,
        )
        assert config.azure_dir == tmp_path
        assert config.boot_wait_seconds == 60
        assert config.postgresql_port == 5433


class TestLogFunctions:
    """Tests for log functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should print info message."""
        log_info("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message with checkmark."""
        log_success("Success")
        captured = capsys.readouterr()
        assert "Success" in captured.out

    def test_log_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning message."""
        log_warning("Warning")
        captured = capsys.readouterr()
        assert "WARNING" in captured.out
        assert "Warning" in captured.out

    def test_log_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error message."""
        log_error("Error")
        captured = capsys.readouterr()
        assert "ERROR" in captured.out
        assert "Error" in captured.out


class TestPrintHeader:
    """Tests for print_header function."""

    def test_prints_header(self, capsys: pytest.CaptureFixture) -> None:
        """Should print header."""
        print_header()
        captured = capsys.readouterr()
        assert "PostgreSQL VM Quick Launch" in captured.out


class TestKillRunningVms:
    """Tests for kill_running_vms function."""

    @patch("launch_postgresql.subprocess.run")
    @patch("launch_postgresql.time.sleep")
    def test_kills_processes(
        self, mock_sleep: MagicMock, mock_run: MagicMock
    ) -> None:
        """Should attempt to kill VM processes."""
        mock_run.return_value = MagicMock(returncode=0)

        kill_running_vms()

        assert mock_run.call_count == 2
        mock_sleep.assert_called_once_with(2)

    @patch("launch_postgresql.subprocess.run")
    @patch("launch_postgresql.time.sleep")
    def test_handles_no_processes(
        self, mock_sleep: MagicMock, mock_run: MagicMock
    ) -> None:
        """Should handle when no processes to kill."""
        mock_run.side_effect = subprocess.SubprocessError("No process")

        # Should not raise
        kill_running_vms()


class TestCleanConsoleLogs:
    """Tests for clean_console_logs function."""

    def test_removes_log_files(self, tmp_path: Path) -> None:
        """Should remove matching log files."""
        log1 = tmp_path / "vibecode-console-1.log"
        log2 = tmp_path / "vibecode-console-2.log"
        log1.write_text("log1")
        log2.write_text("log2")

        clean_console_logs(str(tmp_path / "vibecode-console-*.log"))

        assert not log1.exists()
        assert not log2.exists()

    def test_handles_no_logs(self, tmp_path: Path) -> None:
        """Should handle when no logs exist."""
        # Should not raise
        clean_console_logs(str(tmp_path / "nonexistent-*.log"))


class TestCheckInitramfs:
    """Tests for check_initramfs function."""

    def test_returns_true_when_exists(self, tmp_path: Path) -> None:
        """Should return True when initramfs exists."""
        config = LaunchConfig(azure_dir=tmp_path)
        config.postgresql_initramfs.parent.mkdir(parents=True, exist_ok=True)
        config.postgresql_initramfs.write_bytes(b"fake")

        assert check_initramfs(config) is True

    def test_returns_false_when_missing(self, tmp_path: Path) -> None:
        """Should return False when initramfs missing."""
        config = LaunchConfig(azure_dir=tmp_path)

        assert check_initramfs(config) is False


class TestSwapInitramfs:
    """Tests for swap_initramfs function."""

    def test_swaps_initramfs(self, tmp_path: Path) -> None:
        """Should swap initramfs files."""
        config = LaunchConfig(azure_dir=tmp_path)
        config.postgresql_initramfs.parent.mkdir(parents=True, exist_ok=True)
        config.postgresql_initramfs.write_bytes(b"postgresql")
        config.nodejs_initramfs.write_bytes(b"nodejs")

        result = swap_initramfs(config)

        assert result is True
        assert config.nodejs_backup.exists()
        assert config.nodejs_backup.read_bytes() == b"nodejs"
        assert config.nodejs_initramfs.read_bytes() == b"postgresql"

    def test_handles_missing_nodejs(self, tmp_path: Path) -> None:
        """Should handle when nodejs initramfs doesn't exist."""
        config = LaunchConfig(azure_dir=tmp_path)
        config.postgresql_initramfs.parent.mkdir(parents=True, exist_ok=True)
        config.postgresql_initramfs.write_bytes(b"postgresql")

        result = swap_initramfs(config)

        assert result is True
        assert config.nodejs_initramfs.read_bytes() == b"postgresql"

    def test_returns_false_on_error(self, tmp_path: Path) -> None:
        """Should return False on copy error."""
        config = LaunchConfig(azure_dir=tmp_path / "nonexistent")

        result = swap_initramfs(config)

        assert result is False


class TestLaunchVm:
    """Tests for launch_vm function."""

    @patch("launch_postgresql.subprocess.Popen")
    def test_launches_vm(self, mock_popen: MagicMock, tmp_path: Path) -> None:
        """Should launch VM process."""
        mock_process = MagicMock()
        mock_process.pid = 12345
        mock_popen.return_value = mock_process

        config = LaunchConfig(azure_dir=tmp_path)
        # Create VM executable
        config.vm_executable.parent.mkdir(parents=True, exist_ok=True)
        config.vm_executable.write_text("#!/bin/bash\necho test")

        result = launch_vm(config)

        assert result == 12345

    def test_returns_none_when_executable_missing(self, tmp_path: Path) -> None:
        """Should return None when executable missing."""
        config = LaunchConfig(azure_dir=tmp_path)

        result = launch_vm(config)

        assert result is None

    @patch("launch_postgresql.subprocess.Popen")
    def test_returns_none_on_error(
        self, mock_popen: MagicMock, tmp_path: Path
    ) -> None:
        """Should return None on launch error."""
        mock_popen.side_effect = OSError("Failed to launch")

        config = LaunchConfig(azure_dir=tmp_path)
        config.vm_executable.parent.mkdir(parents=True, exist_ok=True)
        config.vm_executable.write_text("#!/bin/bash")

        result = launch_vm(config)

        assert result is None


class TestGetLatestConsoleLog:
    """Tests for get_latest_console_log function."""

    def test_returns_latest_log(self, tmp_path: Path) -> None:
        """Should return most recent log file."""
        import time

        log1 = tmp_path / "vibecode-console-1.log"
        log2 = tmp_path / "vibecode-console-2.log"
        log1.write_text("log1")
        time.sleep(0.1)
        log2.write_text("log2")

        result = get_latest_console_log(str(tmp_path / "vibecode-console-*.log"))

        assert result == log2

    def test_returns_none_when_no_logs(self, tmp_path: Path) -> None:
        """Should return None when no logs exist."""
        result = get_latest_console_log(str(tmp_path / "nonexistent-*.log"))

        assert result is None


class TestExtractVmIp:
    """Tests for extract_vm_ip function."""

    def test_extracts_ip(self, tmp_path: Path) -> None:
        """Should extract IP address from log."""
        log_file = tmp_path / "console.log"
        log_file.write_text(
            "Some log output\n"
            "inet 192.168.64.5 netmask 0xffffff00\n"
            "More output\n"
        )

        result = extract_vm_ip(log_file)

        assert result == "192.168.64.5"

    def test_returns_none_when_no_ip(self, tmp_path: Path) -> None:
        """Should return None when no IP found."""
        log_file = tmp_path / "console.log"
        log_file.write_text("No IP address here\n")

        result = extract_vm_ip(log_file)

        assert result is None

    def test_returns_none_on_read_error(self, tmp_path: Path) -> None:
        """Should return None on read error."""
        result = extract_vm_ip(tmp_path / "nonexistent.log")

        assert result is None


class TestPrintAccessInstructions:
    """Tests for print_access_instructions function."""

    def test_prints_instructions(self, capsys: pytest.CaptureFixture) -> None:
        """Should print access instructions."""
        print_access_instructions("192.168.64.5", 5432)

        captured = capsys.readouterr()
        assert "192.168.64.5" in captured.out
        assert "5432" in captured.out
        assert "psql" in captured.out
        assert "pg_isready" in captured.out


class TestLaunchPostgresql:
    """Tests for launch_postgresql function."""

    @patch("launch_postgresql.tail_log")
    @patch("launch_postgresql.extract_vm_ip")
    @patch("launch_postgresql.get_latest_console_log")
    @patch("launch_postgresql.time.sleep")
    @patch("launch_postgresql.launch_vm")
    @patch("launch_postgresql.swap_initramfs")
    @patch("launch_postgresql.check_initramfs")
    @patch("launch_postgresql.clean_console_logs")
    @patch("launch_postgresql.kill_running_vms")
    def test_successful_launch(
        self,
        mock_kill: MagicMock,
        mock_clean: MagicMock,
        mock_check: MagicMock,
        mock_swap: MagicMock,
        mock_launch: MagicMock,
        mock_sleep: MagicMock,
        mock_get_log: MagicMock,
        mock_extract: MagicMock,
        mock_tail: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should complete successfully."""
        mock_check.return_value = True
        mock_swap.return_value = True
        mock_launch.return_value = 12345
        mock_get_log.return_value = tmp_path / "console.log"
        mock_extract.return_value = "192.168.64.5"

        config = LaunchConfig(azure_dir=tmp_path)
        result = launch_postgresql(config)

        assert result == 0
        mock_kill.assert_called_once()
        mock_clean.assert_called_once()
        mock_launch.assert_called_once()

    @patch("launch_postgresql.kill_running_vms")
    @patch("launch_postgresql.clean_console_logs")
    @patch("launch_postgresql.check_initramfs")
    def test_fails_when_initramfs_missing(
        self,
        mock_check: MagicMock,
        mock_clean: MagicMock,
        mock_kill: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when initramfs missing."""
        mock_check.return_value = False

        config = LaunchConfig(azure_dir=tmp_path)
        result = launch_postgresql(config)

        assert result == 1

    @patch("launch_postgresql.kill_running_vms")
    @patch("launch_postgresql.clean_console_logs")
    @patch("launch_postgresql.check_initramfs")
    @patch("launch_postgresql.swap_initramfs")
    def test_fails_when_swap_fails(
        self,
        mock_swap: MagicMock,
        mock_check: MagicMock,
        mock_clean: MagicMock,
        mock_kill: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when swap fails."""
        mock_check.return_value = True
        mock_swap.return_value = False

        config = LaunchConfig(azure_dir=tmp_path)
        result = launch_postgresql(config)

        assert result == 1

    @patch("launch_postgresql.kill_running_vms")
    @patch("launch_postgresql.clean_console_logs")
    @patch("launch_postgresql.check_initramfs")
    @patch("launch_postgresql.swap_initramfs")
    @patch("launch_postgresql.launch_vm")
    def test_fails_when_launch_fails(
        self,
        mock_launch: MagicMock,
        mock_swap: MagicMock,
        mock_check: MagicMock,
        mock_clean: MagicMock,
        mock_kill: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when VM launch fails."""
        mock_check.return_value = True
        mock_swap.return_value = True
        mock_launch.return_value = None

        config = LaunchConfig(azure_dir=tmp_path)
        result = launch_postgresql(config)

        assert result == 1

    @patch("launch_postgresql.tail_log")
    @patch("launch_postgresql.get_latest_console_log")
    @patch("launch_postgresql.time.sleep")
    @patch("launch_postgresql.launch_vm")
    @patch("launch_postgresql.swap_initramfs")
    @patch("launch_postgresql.check_initramfs")
    @patch("launch_postgresql.clean_console_logs")
    @patch("launch_postgresql.kill_running_vms")
    def test_handles_no_console_log(
        self,
        mock_kill: MagicMock,
        mock_clean: MagicMock,
        mock_check: MagicMock,
        mock_swap: MagicMock,
        mock_launch: MagicMock,
        mock_sleep: MagicMock,
        mock_get_log: MagicMock,
        mock_tail: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should handle when no console log found."""
        mock_check.return_value = True
        mock_swap.return_value = True
        mock_launch.return_value = 12345
        mock_get_log.return_value = None

        config = LaunchConfig(azure_dir=tmp_path)
        result = launch_postgresql(config)

        assert result == 0
        mock_tail.assert_not_called()
