
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

"""Tests for scripts/vfkit/setup_demo_environment.py"""

from __future__ import annotations

import stat
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vfkit"))

from setup_demo_environment import (
    DB_VM_SCRIPT,
    DEV_VM_SCRIPT,
    SERVICES_VM_SCRIPT,
    START_DEMO_SCRIPT,
    DiskConfig,
    VMConfig,
    create_directory_structure,
    create_disk_image,
    create_disk_images,
    create_start_script,
    create_vm_launcher_scripts,
    get_vfkit_base,
    setup_demo_environment,
    write_executable_script,
)


class TestConstants:
    """Tests for module constants."""

    def test_dev_vm_script_has_vfkit_command(self) -> None:
        """Should have vfkit command in dev VM script."""
        assert "vfkit" in DEV_VM_SCRIPT
        assert "--cpus 4" in DEV_VM_SCRIPT
        assert "--memory 4096" in DEV_VM_SCRIPT

    def test_db_vm_script_has_vfkit_command(self) -> None:
        """Should have vfkit command in db VM script."""
        assert "vfkit" in DB_VM_SCRIPT
        assert "--cpus 2" in DB_VM_SCRIPT
        assert "--memory 2048" in DB_VM_SCRIPT

    def test_services_vm_script_has_vfkit_command(self) -> None:
        """Should have vfkit command in services VM script."""
        assert "vfkit" in SERVICES_VM_SCRIPT
        assert "--cpus 2" in SERVICES_VM_SCRIPT
        assert "--memory 1024" in SERVICES_VM_SCRIPT

    def test_start_demo_script_launches_all_vms(self) -> None:
        """Should launch all VMs in start script."""
        assert "db-vm.sh" in START_DEMO_SCRIPT
        assert "services-vm.sh" in START_DEMO_SCRIPT
        assert "dev-vm.sh" in START_DEMO_SCRIPT


class TestVMConfig:
    """Tests for VMConfig dataclass."""

    def test_creates_config(self) -> None:
        """Should create VM config with all fields."""
        config = VMConfig(
            name="test-vm",
            cpus=4,
            memory_mb=4096,
            disk_size="20G",
            script_content="#!/bin/bash",
        )
        assert config.name == "test-vm"
        assert config.cpus == 4
        assert config.memory_mb == 4096
        assert config.disk_size == "20G"


class TestDiskConfig:
    """Tests for DiskConfig dataclass."""

    def test_creates_config(self) -> None:
        """Should create disk config."""
        config = DiskConfig(name="test.img", size="50G")
        assert config.name == "test.img"
        assert config.size == "50G"


class TestGetVfkitBase:
    """Tests for get_vfkit_base function."""

    def test_returns_path_under_home(self) -> None:
        """Should return path under home directory."""
        result = get_vfkit_base()
        assert ".vfkit" in str(result)
        assert str(Path.home()) in str(result)


class TestCreateDirectoryStructure:
    """Tests for create_directory_structure function."""

    def test_creates_required_directories(self, tmp_path: Path) -> None:
        """Should create all required directories."""
        result = create_directory_structure(tmp_path)
        assert result is True
        assert (tmp_path / "vms").is_dir()
        assert (tmp_path / "kernels").is_dir()
        assert (tmp_path / "disks").is_dir()

    def test_handles_existing_directories(self, tmp_path: Path) -> None:
        """Should handle existing directories gracefully."""
        (tmp_path / "vms").mkdir()
        result = create_directory_structure(tmp_path)
        assert result is True


class TestWriteExecutableScript:
    """Tests for write_executable_script function."""

    def test_creates_script_file(self, tmp_path: Path) -> None:
        """Should create script file."""
        script_path = tmp_path / "test.sh"
        result = write_executable_script(script_path, "#!/bin/bash\necho test")
        assert result is True
        assert script_path.exists()

    def test_makes_script_executable(self, tmp_path: Path) -> None:
        """Should make script executable."""
        script_path = tmp_path / "test.sh"
        write_executable_script(script_path, "#!/bin/bash")
        assert script_path.stat().st_mode & stat.S_IXUSR

    def test_writes_correct_content(self, tmp_path: Path) -> None:
        """Should write correct content."""
        script_path = tmp_path / "test.sh"
        content = "#!/bin/bash\necho hello"
        write_executable_script(script_path, content)
        assert script_path.read_text() == content


class TestCreateVmLauncherScripts:
    """Tests for create_vm_launcher_scripts function."""

    def test_creates_all_scripts(self, tmp_path: Path) -> None:
        """Should create all VM launcher scripts."""
        vms_dir = tmp_path / "vms"
        vms_dir.mkdir()
        result = create_vm_launcher_scripts(tmp_path)

        assert result is True
        assert (vms_dir / "dev-vm.sh").exists()
        assert (vms_dir / "db-vm.sh").exists()
        assert (vms_dir / "services-vm.sh").exists()

    def test_all_scripts_are_executable(self, tmp_path: Path) -> None:
        """Should make all scripts executable."""
        vms_dir = tmp_path / "vms"
        vms_dir.mkdir()
        create_vm_launcher_scripts(tmp_path)

        for script_name in ["dev-vm.sh", "db-vm.sh", "services-vm.sh"]:
            script_path = vms_dir / script_name
            assert script_path.stat().st_mode & stat.S_IXUSR


class TestCreateDiskImage:
    """Tests for create_disk_image function."""

    @patch("setup_demo_environment.shutil.which")
    def test_returns_false_when_qemu_img_missing(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when qemu-img is not found."""
        mock_which.return_value = None
        result = create_disk_image(tmp_path / "test.img", "10G")
        assert result is False

    @patch("setup_demo_environment.subprocess.run")
    @patch("setup_demo_environment.shutil.which")
    def test_returns_true_on_success(
        self, mock_which: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True when disk creation succeeds."""
        mock_which.return_value = "/usr/bin/qemu-img"
        mock_run.return_value = MagicMock(returncode=0)

        result = create_disk_image(tmp_path / "test.img", "10G")
        assert result is True

    @patch("setup_demo_environment.subprocess.run")
    @patch("setup_demo_environment.shutil.which")
    def test_passes_correct_args_to_qemu_img(
        self, mock_which: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should pass correct arguments to qemu-img."""
        mock_which.return_value = "/usr/bin/qemu-img"
        mock_run.return_value = MagicMock()

        disk_path = tmp_path / "test.img"
        create_disk_image(disk_path, "50G")

        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "qemu-img" in call_args
        assert "create" in call_args
        assert "-f" in call_args
        assert "raw" in call_args
        assert str(disk_path) in call_args
        assert "50G" in call_args


class TestCreateDiskImages:
    """Tests for create_disk_images function."""

    @patch("setup_demo_environment.create_disk_image")
    def test_creates_all_disks(self, mock_create: MagicMock, tmp_path: Path) -> None:
        """Should attempt to create all disk images."""
        disks_dir = tmp_path / "disks"
        disks_dir.mkdir()
        mock_create.return_value = True

        create_disk_images(tmp_path)

        assert mock_create.call_count == 4

    def test_skips_existing_disks(self, tmp_path: Path) -> None:
        """Should skip existing disk images."""
        disks_dir = tmp_path / "disks"
        disks_dir.mkdir()

        # Create existing disk
        (disks_dir / "dev-vm.img").touch()

        with patch("setup_demo_environment.create_disk_image") as mock_create:
            mock_create.return_value = True
            create_disk_images(tmp_path)

            # Should not be called for existing disk
            disk_names = [str(call[0][0]) for call in mock_create.call_args_list]
            assert not any("dev-vm.img" in name for name in disk_names)


class TestCreateStartScript:
    """Tests for create_start_script function."""

    def test_creates_script(self, tmp_path: Path) -> None:
        """Should create start-demo.sh script."""
        result = create_start_script(tmp_path)
        assert result is True
        assert (tmp_path / "start-demo.sh").exists()

    def test_script_is_executable(self, tmp_path: Path) -> None:
        """Should make script executable."""
        create_start_script(tmp_path)
        script = tmp_path / "start-demo.sh"
        assert script.stat().st_mode & stat.S_IXUSR


class TestSetupDemoEnvironment:
    """Tests for setup_demo_environment function."""

    @patch("setup_demo_environment.create_disk_images")
    def test_creates_complete_environment(
        self, mock_disks: MagicMock, tmp_path: Path
    ) -> None:
        """Should create complete demo environment."""
        result = setup_demo_environment(tmp_path)
        assert result == 0

        # Check directories created
        assert (tmp_path / "vms").is_dir()
        assert (tmp_path / "kernels").is_dir()
        assert (tmp_path / "disks").is_dir()

        # Check scripts created
        assert (tmp_path / "vms" / "dev-vm.sh").exists()
        assert (tmp_path / "vms" / "db-vm.sh").exists()
        assert (tmp_path / "vms" / "services-vm.sh").exists()
        assert (tmp_path / "start-demo.sh").exists()

    @patch("setup_demo_environment.create_directory_structure")
    def test_returns_error_on_dir_failure(
        self, mock_create_dirs: MagicMock, tmp_path: Path
    ) -> None:
        """Should return 1 when directory creation fails."""
        mock_create_dirs.return_value = False
        result = setup_demo_environment(tmp_path)
        assert result == 1

    @patch("setup_demo_environment.create_disk_images")
    @patch("setup_demo_environment.create_vm_launcher_scripts")
    @patch("setup_demo_environment.create_directory_structure")
    def test_returns_error_on_script_failure(
        self,
        mock_dirs: MagicMock,
        mock_scripts: MagicMock,
        mock_disks: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should return 1 when script creation fails."""
        mock_dirs.return_value = True
        mock_scripts.return_value = False
        result = setup_demo_environment(tmp_path)
        assert result == 1

    def test_uses_default_vfkit_base_when_none(self) -> None:
        """Should use default vfkit base when none provided."""
        with patch("setup_demo_environment.get_vfkit_base") as mock_base:
            mock_base.return_value = Path("/tmp/test-vfkit")
            with patch("setup_demo_environment.create_directory_structure") as mock_dirs:
                mock_dirs.return_value = False
                setup_demo_environment(None)
                mock_base.assert_called_once()