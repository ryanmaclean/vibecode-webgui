
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

"""Tests for scripts/vz/create_minimal_initramfs.py"""

from __future__ import annotations

import stat
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vz"))

from create_minimal_initramfs import (
    INIT_SCRIPT,
    check_existing_initramfs,
    create_cpio_archive,
    create_directory_structure,
    create_init_script,
    create_minimal_initramfs,
    create_stub_scripts,
    get_file_size_human,
    install_busybox,
)


class TestCheckExistingInitramfs:
    """Tests for check_existing_initramfs function."""

    def test_returns_path_when_initramfs_exists(self, tmp_path: Path) -> None:
        """Should return path when initramfs exists."""
        initramfs = tmp_path / "initramfs"
        initramfs.write_bytes(b"fake initramfs")
        result = check_existing_initramfs(tmp_path)
        assert result == initramfs

    def test_returns_none_when_initramfs_missing(self, tmp_path: Path) -> None:
        """Should return None when initramfs is missing."""
        result = check_existing_initramfs(tmp_path)
        assert result is None


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


class TestCreateDirectoryStructure:
    """Tests for create_directory_structure function."""

    def test_creates_all_required_directories(self, tmp_path: Path) -> None:
        """Should create all required directories."""
        create_directory_structure(tmp_path)

        expected_dirs = ["bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "run"]
        for d in expected_dirs:
            assert (tmp_path / d).is_dir()

    def test_handles_existing_directories(self, tmp_path: Path) -> None:
        """Should not fail if directories already exist."""
        (tmp_path / "bin").mkdir()
        create_directory_structure(tmp_path)
        assert (tmp_path / "bin").is_dir()


class TestCreateInitScript:
    """Tests for create_init_script function."""

    def test_creates_init_file(self, tmp_path: Path) -> None:
        """Should create init file."""
        create_init_script(tmp_path)
        init_path = tmp_path / "init"
        assert init_path.exists()

    def test_init_is_executable(self, tmp_path: Path) -> None:
        """Should make init file executable."""
        create_init_script(tmp_path)
        init_path = tmp_path / "init"
        assert init_path.stat().st_mode & stat.S_IXUSR

    def test_init_contains_expected_content(self, tmp_path: Path) -> None:
        """Should contain expected init script content."""
        create_init_script(tmp_path)
        init_path = tmp_path / "init"
        content = init_path.read_text()
        assert "#!/bin/sh" in content
        assert "mount -t proc proc /proc" in content
        assert "ASIF Test VM" in content


class TestCreateStubScripts:
    """Tests for create_stub_scripts function."""

    def test_creates_sh_stub(self, tmp_path: Path) -> None:
        """Should create sh stub script."""
        create_stub_scripts(tmp_path)
        sh_path = tmp_path / "bin" / "sh"
        assert sh_path.exists()

    def test_creates_mount_stub(self, tmp_path: Path) -> None:
        """Should create mount stub script."""
        create_stub_scripts(tmp_path)
        mount_path = tmp_path / "bin" / "mount"
        assert mount_path.exists()

    def test_creates_poweroff_stub(self, tmp_path: Path) -> None:
        """Should create poweroff stub script."""
        create_stub_scripts(tmp_path)
        poweroff_path = tmp_path / "bin" / "poweroff"
        assert poweroff_path.exists()

    def test_stubs_are_executable(self, tmp_path: Path) -> None:
        """Should make stub scripts executable."""
        create_stub_scripts(tmp_path)
        sh_path = tmp_path / "bin" / "sh"
        assert sh_path.stat().st_mode & stat.S_IXUSR


class TestInstallBusybox:
    """Tests for install_busybox function."""

    def test_returns_false_when_busybox_bin_missing(self, tmp_path: Path) -> None:
        """Should return False when busybox-bin is missing."""
        result = install_busybox(tmp_path)
        assert result is False

    def test_creates_symlinks_when_busybox_exists(self, tmp_path: Path) -> None:
        """Should create symlinks when busybox exists."""
        # Create fake busybox-bin
        busybox_bin = tmp_path / "busybox-bin"
        busybox_bin.write_bytes(b"fake busybox")
        busybox_bin.chmod(busybox_bin.stat().st_mode | stat.S_IXUSR)

        result = install_busybox(tmp_path)
        assert result is True

        # Check symlinks
        bin_dir = tmp_path / "bin"
        assert (bin_dir / "sh").is_symlink()
        assert (bin_dir / "mount").is_symlink()
        assert (bin_dir / "poweroff").is_symlink()


class TestCreateCpioArchive:
    """Tests for create_cpio_archive function."""

    @patch("create_minimal_initramfs.subprocess.Popen")
    def test_creates_compressed_archive(
        self, mock_popen: MagicMock, tmp_path: Path
    ) -> None:
        """Should create a gzip-compressed cpio archive."""
        # Setup mock
        mock_find = MagicMock()
        mock_find.stdout = b".\n./bin\n"

        mock_cpio = MagicMock()
        mock_cpio.communicate.return_value = (b"cpio data", b"")

        mock_popen.side_effect = [mock_find, mock_cpio]

        build_dir = tmp_path / "build"
        build_dir.mkdir()
        output_path = tmp_path / "initramfs"

        result = create_cpio_archive(build_dir, output_path)
        assert result is True
        assert output_path.exists()


class TestCreateMinimalInitramfs:
    """Tests for create_minimal_initramfs function."""

    def test_returns_success_when_initramfs_exists(self, tmp_path: Path) -> None:
        """Should return 0 when initramfs already exists."""
        initramfs = tmp_path / "initramfs"
        initramfs.write_bytes(b"fake initramfs")
        result = create_minimal_initramfs(tmp_path)
        assert result == 0

    @patch("create_minimal_initramfs.download_and_extract_busybox")
    @patch("create_minimal_initramfs.create_cpio_archive")
    def test_creates_initramfs_with_stubs(
        self,
        mock_cpio: MagicMock,
        mock_busybox: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should create initramfs with stubs when busybox unavailable."""
        mock_busybox.return_value = False

        # Mock cpio to create the file
        def create_file(build_dir: Path, output_path: Path) -> bool:
            output_path.write_bytes(b"fake initramfs")
            return True

        mock_cpio.side_effect = create_file

        result = create_minimal_initramfs(tmp_path)
        assert result == 0
        mock_cpio.assert_called_once()