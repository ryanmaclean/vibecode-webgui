"""Tests for scripts/vfkit/create_persistent_vm.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vfkit"))

from create_persistent_vm import (
    META_DATA_TEMPLATE,
    USER_DATA_TEMPLATE,
    VMConfig,
    check_disk_exists,
    create_cloud_init_config,
    create_disk_image,
    create_disk_with_dd,
    create_disk_with_qemu,
    delete_disk,
    log_error,
    log_info,
    log_success,
    log_warning,
    print_next_steps,
    prompt_yes_no,
    run_command,
    run_create_persistent_vm,
)


class TestVMConfig:
    """Tests for VMConfig dataclass."""

    def test_default_config(self) -> None:
        """Should create config with default values."""
        config = VMConfig()
        assert config.disk_size == "20G"
        assert config.disk_size_mb == 20480

    def test_kernel_dir(self) -> None:
        """Should compute kernel_dir correctly."""
        config = VMConfig()
        assert config.kernel_dir == config.vm_dir / "kernel"

    def test_disk_dir(self) -> None:
        """Should compute disk_dir correctly."""
        config = VMConfig()
        assert config.disk_dir == config.vm_dir / "disk"

    def test_disk_image(self) -> None:
        """Should compute disk_image correctly."""
        config = VMConfig()
        assert config.disk_image == config.disk_dir / "alpine-system.img"

    def test_cloud_init_dir(self) -> None:
        """Should compute cloud_init_dir correctly."""
        config = VMConfig()
        assert config.cloud_init_dir == config.vm_dir / "cloud-init"

    def test_custom_config(self, tmp_path: Path) -> None:
        """Should accept custom values."""
        config = VMConfig(vm_dir=tmp_path, disk_size="10G", disk_size_mb=10240)
        assert config.vm_dir == tmp_path
        assert config.disk_size == "10G"
        assert config.disk_size_mb == 10240


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


class TestRunCommand:
    """Tests for run_command function."""

    @patch("create_persistent_vm.subprocess.run")
    def test_returns_result_on_success(self, mock_run: MagicMock) -> None:
        """Should return subprocess result on success."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output", stderr="")
        result = run_command(["echo", "test"])
        assert result.returncode == 0

    @patch("create_persistent_vm.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock) -> None:
        """Should handle timeout gracefully."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=30)
        result = run_command(["sleep", "100"], timeout=1)
        assert result.returncode == 1
        assert "Timeout" in result.stderr

    @patch("create_persistent_vm.subprocess.run")
    def test_handles_subprocess_error(self, mock_run: MagicMock) -> None:
        """Should handle subprocess errors gracefully."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        result = run_command(["bad", "command"])
        assert result.returncode == 1


class TestPromptYesNo:
    """Tests for prompt_yes_no function."""

    @patch("builtins.input", return_value="y")
    def test_returns_true_on_yes(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'y'."""
        assert prompt_yes_no("Test?") is True

    @patch("builtins.input", return_value="yes")
    def test_returns_true_on_yes_full(self, mock_input: MagicMock) -> None:
        """Should return True when user enters 'yes'."""
        assert prompt_yes_no("Test?") is True

    @patch("builtins.input", return_value="n")
    def test_returns_false_on_no(self, mock_input: MagicMock) -> None:
        """Should return False when user enters 'n'."""
        assert prompt_yes_no("Test?") is False

    @patch("builtins.input", return_value="")
    def test_returns_default_on_empty(self, mock_input: MagicMock) -> None:
        """Should return default on empty input."""
        assert prompt_yes_no("Test?", default=False) is False
        assert prompt_yes_no("Test?", default=True) is True

    @patch("builtins.input", side_effect=EOFError)
    def test_returns_false_on_eof(self, mock_input: MagicMock) -> None:
        """Should return False on EOF."""
        assert prompt_yes_no("Test?") is False

    @patch("builtins.input", side_effect=KeyboardInterrupt)
    def test_returns_false_on_keyboard_interrupt(self, mock_input: MagicMock) -> None:
        """Should return False on keyboard interrupt."""
        assert prompt_yes_no("Test?") is False


class TestCheckDiskExists:
    """Tests for check_disk_exists function."""

    def test_returns_true_when_exists(self, tmp_path: Path) -> None:
        """Should return True when disk exists."""
        config = VMConfig(vm_dir=tmp_path)
        config.disk_dir.mkdir(parents=True)
        config.disk_image.write_bytes(b"fake disk")
        assert check_disk_exists(config) is True

    def test_returns_false_when_not_exists(self, tmp_path: Path) -> None:
        """Should return False when disk doesn't exist."""
        config = VMConfig(vm_dir=tmp_path)
        assert check_disk_exists(config) is False


class TestDeleteDisk:
    """Tests for delete_disk function."""

    def test_deletes_existing_disk(self, tmp_path: Path) -> None:
        """Should delete existing disk."""
        config = VMConfig(vm_dir=tmp_path)
        config.disk_dir.mkdir(parents=True)
        config.disk_image.write_bytes(b"fake disk")

        assert delete_disk(config) is True
        assert not config.disk_image.exists()

    def test_returns_false_when_no_disk(self, tmp_path: Path) -> None:
        """Should return False when disk doesn't exist."""
        config = VMConfig(vm_dir=tmp_path)
        assert delete_disk(config) is False


class TestCreateDiskWithQemu:
    """Tests for create_disk_with_qemu function."""

    @patch("create_persistent_vm.run_command")
    def test_creates_disk(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should create disk with qemu-img."""
        mock_run.return_value = MagicMock(returncode=0)
        config = VMConfig(vm_dir=tmp_path)

        assert create_disk_with_qemu(config) is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "qemu-img" in call_args
        assert "create" in call_args

    @patch("create_persistent_vm.run_command")
    def test_returns_false_on_failure(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return False on failure."""
        mock_run.return_value = MagicMock(returncode=1)
        config = VMConfig(vm_dir=tmp_path)

        assert create_disk_with_qemu(config) is False


class TestCreateDiskWithDd:
    """Tests for create_disk_with_dd function."""

    @patch("create_persistent_vm.run_command")
    def test_creates_disk(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should create disk with dd."""
        mock_run.return_value = MagicMock(returncode=0)
        config = VMConfig(vm_dir=tmp_path)

        assert create_disk_with_dd(config) is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "dd" in call_args

    @patch("create_persistent_vm.run_command")
    def test_returns_false_on_failure(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return False on failure."""
        mock_run.return_value = MagicMock(returncode=1)
        config = VMConfig(vm_dir=tmp_path)

        assert create_disk_with_dd(config) is False


class TestCreateDiskImage:
    """Tests for create_disk_image function."""

    @patch("create_persistent_vm.shutil.which")
    @patch("create_persistent_vm.create_disk_with_qemu")
    def test_uses_qemu_when_available(
        self, mock_qemu: MagicMock, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should use qemu-img when available."""
        mock_which.return_value = "/usr/bin/qemu-img"
        mock_qemu.return_value = True
        config = VMConfig(vm_dir=tmp_path)

        # Create the disk image to simulate success
        config.disk_dir.mkdir(parents=True)
        config.disk_image.write_bytes(b"fake")

        assert create_disk_image(config) is True
        mock_qemu.assert_called_once()

    @patch("create_persistent_vm.shutil.which")
    @patch("create_persistent_vm.create_disk_with_dd")
    def test_falls_back_to_dd(
        self, mock_dd: MagicMock, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should fall back to dd when qemu-img not available."""
        mock_which.return_value = None
        mock_dd.return_value = True
        config = VMConfig(vm_dir=tmp_path)

        # Create the disk image to simulate success
        config.disk_dir.mkdir(parents=True)
        config.disk_image.write_bytes(b"fake")

        assert create_disk_image(config) is True
        mock_dd.assert_called_once()


class TestPrintNextSteps:
    """Tests for print_next_steps function."""

    def test_prints_steps(self, capsys: pytest.CaptureFixture) -> None:
        """Should print next steps."""
        print_next_steps()
        captured = capsys.readouterr()
        assert "Next Steps" in captured.out
        assert "setup-alpine" in captured.out
        assert "virtiofs" in captured.out


class TestCreateCloudInitConfig:
    """Tests for create_cloud_init_config function."""

    def test_creates_config_files(self, tmp_path: Path) -> None:
        """Should create cloud-init configuration files."""
        config = VMConfig(vm_dir=tmp_path)

        assert create_cloud_init_config(config) is True
        assert (config.cloud_init_dir / "meta-data").exists()
        assert (config.cloud_init_dir / "user-data").exists()

    def test_meta_data_content(self, tmp_path: Path) -> None:
        """Should write correct meta-data content."""
        config = VMConfig(vm_dir=tmp_path)
        create_cloud_init_config(config)

        content = (config.cloud_init_dir / "meta-data").read_text()
        assert "vibecode-alpine" in content
        assert "instance-id" in content

    def test_user_data_content(self, tmp_path: Path) -> None:
        """Should write correct user-data content."""
        config = VMConfig(vm_dir=tmp_path)
        create_cloud_init_config(config)

        content = (config.cloud_init_dir / "user-data").read_text()
        assert "#cloud-config" in content
        assert "vibecode" in content
        assert "postgresql" in content
        assert "redis" in content


class TestRunCreatePersistentVm:
    """Tests for run_create_persistent_vm function."""

    @patch("create_persistent_vm.create_disk_image")
    @patch("create_persistent_vm.create_cloud_init_config")
    def test_creates_disk_non_interactive(
        self, mock_cloud: MagicMock, mock_disk: MagicMock, tmp_path: Path
    ) -> None:
        """Should create disk in non-interactive mode."""
        mock_disk.return_value = True
        mock_cloud.return_value = True
        config = VMConfig(vm_dir=tmp_path)

        result = run_create_persistent_vm(
            config, interactive=False, skip_cloud_init=True
        )

        assert result == 0
        mock_disk.assert_called_once()

    @patch("create_persistent_vm.check_disk_exists")
    @patch("create_persistent_vm.delete_disk")
    @patch("create_persistent_vm.create_disk_image")
    def test_handles_existing_disk_with_force(
        self,
        mock_create: MagicMock,
        mock_delete: MagicMock,
        mock_exists: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should handle existing disk with force_recreate."""
        mock_exists.return_value = True
        mock_delete.return_value = True
        mock_create.return_value = True
        config = VMConfig(vm_dir=tmp_path)

        result = run_create_persistent_vm(
            config, interactive=False, force_recreate=True, skip_cloud_init=True
        )

        assert result == 0
        mock_delete.assert_called_once()

    @patch("create_persistent_vm.check_disk_exists")
    @patch("create_persistent_vm.prompt_yes_no")
    def test_aborts_when_user_declines_recreate(
        self, mock_prompt: MagicMock, mock_exists: MagicMock, tmp_path: Path
    ) -> None:
        """Should abort when user declines to recreate."""
        mock_exists.return_value = True
        mock_prompt.return_value = False
        config = VMConfig(vm_dir=tmp_path)

        result = run_create_persistent_vm(config, interactive=True)

        assert result == 1

    @patch("create_persistent_vm.create_disk_image")
    def test_fails_on_disk_creation_error(
        self, mock_disk: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when disk creation fails."""
        mock_disk.return_value = False
        config = VMConfig(vm_dir=tmp_path)

        result = run_create_persistent_vm(
            config, interactive=False, skip_cloud_init=True
        )

        assert result == 1


class TestTemplates:
    """Tests for template constants."""

    def test_meta_data_template_valid(self) -> None:
        """Should have valid meta-data template."""
        assert "instance-id" in META_DATA_TEMPLATE
        assert "local-hostname" in META_DATA_TEMPLATE

    def test_user_data_template_valid(self) -> None:
        """Should have valid user-data template."""
        assert "#cloud-config" in USER_DATA_TEMPLATE
        assert "hostname" in USER_DATA_TEMPLATE
        assert "users" in USER_DATA_TEMPLATE
        assert "packages" in USER_DATA_TEMPLATE
        assert "runcmd" in USER_DATA_TEMPLATE
