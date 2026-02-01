

"""Tests for 07-create-persistent-vm.py functionality."""

from __future__ import annotations
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

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.vfkit import create_persistent_vm


class TestGetPaths:
    """Tests for get_paths function."""

    def test_returns_dict_of_paths(self) -> None:
        """get_paths should return a dict with Path values."""
        result = create_persistent_vm.get_paths()
        assert isinstance(result, dict)
        assert all(isinstance(v, Path) for v in result.values())

    def test_contains_required_keys(self) -> None:
        """Should contain all required path keys."""
        result = create_persistent_vm.get_paths()
        required_keys = [
            "vm_dir", "kernel_dir", "disk_dir",
            "disk_image", "cloud_init_dir",
        ]
        for key in required_keys:
            assert key in result

    def test_paths_in_home(self) -> None:
        """All paths should be under home directory."""
        result = create_persistent_vm.get_paths()
        for path in result.values():
            assert str(Path.home()) in str(path)

    def test_disk_image_path(self) -> None:
        """Disk image should be alpine-system.img."""
        result = create_persistent_vm.get_paths()
        assert result["disk_image"].name == "alpine-system.img"


class TestCreateDiskImage:
    """Tests for create_disk_image function."""

    def test_creates_parent_directory(self, tmp_path: Path) -> None:
        """Should create parent directory if needed."""
        disk_dir = tmp_path / "disk" / "subdir"
        disk_image = disk_dir / "test.img"

        create_persistent_vm.create_disk_image(disk_image, "1G", force=True)
        assert disk_dir.exists()

    @patch("shutil.which")
    def test_uses_qemu_img_when_available(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should use qemu-img when available."""
        mock_which.return_value = "/usr/local/bin/qemu-img"
        disk_image = tmp_path / "test.img"

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            create_persistent_vm.create_disk_image(disk_image, "20G", force=True)

            mock_run.assert_called_once()
            args = mock_run.call_args[0][0]
            assert "qemu-img" in args
            assert "create" in args
            assert "20G" in args

    @patch("shutil.which")
    def test_creates_sparse_file_without_qemu(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should create sparse file when qemu-img not available."""
        mock_which.return_value = None
        disk_image = tmp_path / "test.img"

        result = create_persistent_vm.create_disk_image(disk_image, "1G", force=True)

        assert result is True
        assert disk_image.exists()
        assert disk_image.stat().st_size == 1024**3

    @patch("shutil.which")
    def test_parses_size_units(self, mock_which: MagicMock, tmp_path: Path) -> None:
        """Should correctly parse size units K, M, G, T."""
        mock_which.return_value = None

        # Test megabytes
        disk_mb = tmp_path / "test_mb.img"
        create_persistent_vm.create_disk_image(disk_mb, "10M", force=True)
        assert disk_mb.stat().st_size == 10 * 1024**2

        # Test gigabytes
        disk_gb = tmp_path / "test_gb.img"
        create_persistent_vm.create_disk_image(disk_gb, "2G", force=True)
        assert disk_gb.stat().st_size == 2 * 1024**3

    @patch("builtins.input")
    def test_prompts_for_existing_disk(
        self, mock_input: MagicMock, tmp_path: Path
    ) -> None:
        """Should prompt user when disk already exists."""
        disk_image = tmp_path / "existing.img"
        disk_image.write_bytes(b"existing content")

        mock_input.return_value = "n"
        result = create_persistent_vm.create_disk_image(disk_image, "1G")

        assert result is False
        mock_input.assert_called_once()

    @patch("builtins.input")
    @patch("shutil.which")
    def test_recreates_disk_on_yes(
        self, mock_which: MagicMock, mock_input: MagicMock, tmp_path: Path
    ) -> None:
        """Should recreate disk when user confirms."""
        mock_which.return_value = None
        disk_image = tmp_path / "existing.img"
        disk_image.write_bytes(b"old content")

        mock_input.return_value = "y"
        result = create_persistent_vm.create_disk_image(disk_image, "1G")

        assert result is True
        assert disk_image.stat().st_size == 1024**3

    def test_force_skips_prompt(self, tmp_path: Path) -> None:
        """Force=True should skip confirmation prompt."""
        disk_image = tmp_path / "existing.img"
        disk_image.write_bytes(b"old content")

        with patch("shutil.which", return_value=None):
            result = create_persistent_vm.create_disk_image(
                disk_image, "1G", force=True
            )

        assert result is True


class TestPrintNextSteps:
    """Tests for print_next_steps function."""

    def test_prints_instructions(self, capsys: pytest.CaptureFixture) -> None:
        """Should print setup instructions."""
        create_persistent_vm.print_next_steps()

        captured = capsys.readouterr()
        assert "setup-alpine" in captured.out
        assert "vibecode-alpine" in captured.out
        assert "/dev/vda" in captured.out


class TestCreateCloudInitConfig:
    """Tests for create_cloud_init_config function."""

    def test_creates_directory(self, tmp_path: Path) -> None:
        """Should create cloud-init directory."""
        cloud_init_dir = tmp_path / "cloud-init"
        create_persistent_vm.create_cloud_init_config(cloud_init_dir)
        assert cloud_init_dir.exists()

    def test_creates_meta_data(self, tmp_path: Path) -> None:
        """Should create meta-data file."""
        cloud_init_dir = tmp_path / "cloud-init"
        create_persistent_vm.create_cloud_init_config(cloud_init_dir)

        meta_data = cloud_init_dir / "meta-data"
        assert meta_data.exists()
        content = meta_data.read_text()
        assert "instance-id" in content
        assert "vibecode-alpine" in content

    def test_creates_user_data(self, tmp_path: Path) -> None:
        """Should create user-data file."""
        cloud_init_dir = tmp_path / "cloud-init"
        create_persistent_vm.create_cloud_init_config(cloud_init_dir)

        user_data = cloud_init_dir / "user-data"
        assert user_data.exists()
        content = user_data.read_text()
        assert "#cloud-config" in content
        assert "vibecode" in content

    def test_user_data_has_packages(self, tmp_path: Path) -> None:
        """User-data should include package list."""
        cloud_init_dir = tmp_path / "cloud-init"
        create_persistent_vm.create_cloud_init_config(cloud_init_dir)

        content = (cloud_init_dir / "user-data").read_text()
        assert "postgresql" in content
        assert "redis" in content
        assert "nodejs" in content

    def test_user_data_has_runcmd(self, tmp_path: Path) -> None:
        """User-data should include run commands."""
        cloud_init_dir = tmp_path / "cloud-init"
        create_persistent_vm.create_cloud_init_config(cloud_init_dir)

        content = (cloud_init_dir / "user-data").read_text()
        assert "runcmd:" in content
        assert "virtiofs" in content


class TestMain:
    """Tests for main function."""

    @patch("scripts.vfkit.create_persistent_vm.get_paths")
    @patch("scripts.vfkit.create_persistent_vm.create_disk_image")
    @patch("scripts.vfkit.create_persistent_vm.print_next_steps")
    @patch("builtins.input")
    def test_success_returns_zero(
        self,
        mock_input: MagicMock,
        mock_steps: MagicMock,
        mock_disk: MagicMock,
        mock_paths: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Successful execution should return 0."""
        mock_paths.return_value = {
            "disk_image": tmp_path / "disk.img",
            "cloud_init_dir": tmp_path / "cloud-init",
        }
        mock_disk.return_value = True
        mock_input.return_value = "n"  # Skip cloud-init

        result = create_persistent_vm.main()
        assert result == 0

    @patch("scripts.vfkit.create_persistent_vm.get_paths")
    @patch("scripts.vfkit.create_persistent_vm.create_disk_image")
    def test_disk_creation_failure_returns_one(
        self,
        mock_disk: MagicMock,
        mock_paths: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should return 1 when disk creation fails."""
        mock_paths.return_value = {"disk_image": tmp_path / "disk.img"}
        mock_disk.return_value = False

        result = create_persistent_vm.main()
        assert result == 1

    @patch("scripts.vfkit.create_persistent_vm.get_paths")
    @patch("scripts.vfkit.create_persistent_vm.create_disk_image")
    @patch("scripts.vfkit.create_persistent_vm.print_next_steps")
    @patch("scripts.vfkit.create_persistent_vm.create_cloud_init_config")
    @patch("builtins.input")
    def test_creates_cloud_init_when_requested(
        self,
        mock_input: MagicMock,
        mock_cloud: MagicMock,
        mock_steps: MagicMock,
        mock_disk: MagicMock,
        mock_paths: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should create cloud-init config when user confirms."""
        mock_paths.return_value = {
            "disk_image": tmp_path / "disk.img",
            "cloud_init_dir": tmp_path / "cloud-init",
        }
        mock_disk.return_value = True
        mock_input.return_value = "y"  # Yes to cloud-init

        result = create_persistent_vm.main()

        assert result == 0
        mock_cloud.assert_called_once()