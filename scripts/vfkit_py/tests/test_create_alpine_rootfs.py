
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

"""Tests for 03-create-alpine-rootfs.py functionality."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from textwrap import dedent
from unittest.mock import MagicMock, patch

import pytest

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.vfkit import create_alpine_rootfs


class TestConstants:
    """Test module constants."""

    def test_alpine_version_format(self) -> None:
        """Alpine version should be a valid version string."""
        assert create_alpine_rootfs.ALPINE_VERSION
        parts = create_alpine_rootfs.ALPINE_VERSION.split(".")
        assert len(parts) >= 2
        assert all(p.isdigit() for p in parts)

    def test_node_version_format(self) -> None:
        """Node version should be a valid semver string."""
        assert create_alpine_rootfs.NODE_VERSION
        parts = create_alpine_rootfs.NODE_VERSION.split(".")
        assert len(parts) >= 3
        assert all(p.isdigit() for p in parts)


class TestGetVmDirs:
    """Tests for get_vm_dirs function."""

    def test_returns_tuple_of_paths(self) -> None:
        """get_vm_dirs should return a tuple of two Path objects."""
        rootfs_dir, work_dir = create_alpine_rootfs.get_vm_dirs()
        assert isinstance(rootfs_dir, Path)
        assert isinstance(work_dir, Path)

    def test_work_dir_is_inside_rootfs_dir(self) -> None:
        """Work dir should be inside rootfs dir."""
        rootfs_dir, work_dir = create_alpine_rootfs.get_vm_dirs()
        assert str(work_dir).startswith(str(rootfs_dir))

    def test_paths_in_home(self) -> None:
        """Paths should be under home directory."""
        rootfs_dir, work_dir = create_alpine_rootfs.get_vm_dirs()
        assert str(Path.home()) in str(rootfs_dir)

    def test_paths_contain_vfkit(self) -> None:
        """Paths should contain .vfkit directory."""
        rootfs_dir, work_dir = create_alpine_rootfs.get_vm_dirs()
        assert ".vfkit" in str(rootfs_dir)


class TestCreateDirectoryStructure:
    """Tests for create_directory_structure function."""

    def test_creates_required_directories(self, tmp_path: Path) -> None:
        """Should create all required directories."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_directory_structure(work_dir)

        # Check essential directories
        assert (work_dir / "bin").exists()
        assert (work_dir / "sbin").exists()
        assert (work_dir / "etc").exists()
        assert (work_dir / "proc").exists()
        assert (work_dir / "sys").exists()
        assert (work_dir / "usr" / "bin").exists()
        assert (work_dir / "etc" / "apk").exists()

    def test_directories_are_directories(self, tmp_path: Path) -> None:
        """Created paths should be directories, not files."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_directory_structure(work_dir)

        for path in work_dir.rglob("*"):
            assert path.is_dir()


class TestConfigureApk:
    """Tests for configure_apk function."""

    def test_creates_repositories_file(self, tmp_path: Path) -> None:
        """Should create APK repositories file."""
        work_dir = tmp_path / "build"
        (work_dir / "etc" / "apk").mkdir(parents=True)

        create_alpine_rootfs.configure_apk(work_dir)

        repos_file = work_dir / "etc" / "apk" / "repositories"
        assert repos_file.exists()

    def test_repositories_content(self, tmp_path: Path) -> None:
        """Repositories file should contain Alpine URLs."""
        work_dir = tmp_path / "build"
        (work_dir / "etc" / "apk").mkdir(parents=True)

        create_alpine_rootfs.configure_apk(work_dir)

        content = (work_dir / "etc" / "apk" / "repositories").read_text()
        assert "alpinelinux.org" in content
        assert "main" in content
        assert "community" in content


class TestCreateConfigFiles:
    """Tests for create_config_files function."""

    def test_creates_passwd(self, tmp_path: Path) -> None:
        """Should create /etc/passwd."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        passwd = work_dir / "etc" / "passwd"
        assert passwd.exists()
        content = passwd.read_text()
        assert "root" in content

    def test_creates_group(self, tmp_path: Path) -> None:
        """Should create /etc/group."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        group = work_dir / "etc" / "group"
        assert group.exists()
        content = group.read_text()
        assert "root" in content

    def test_creates_hostname(self, tmp_path: Path) -> None:
        """Should create /etc/hostname."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        hostname = work_dir / "etc" / "hostname"
        assert hostname.exists()
        assert "vibecode" in hostname.read_text().lower()

    def test_creates_hosts(self, tmp_path: Path) -> None:
        """Should create /etc/hosts."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        hosts = work_dir / "etc" / "hosts"
        assert hosts.exists()
        assert "localhost" in hosts.read_text()

    def test_creates_resolv_conf(self, tmp_path: Path) -> None:
        """Should create /etc/resolv.conf with DNS servers."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        resolv = work_dir / "etc" / "resolv.conf"
        assert resolv.exists()
        assert "nameserver" in resolv.read_text()

    def test_creates_fstab(self, tmp_path: Path) -> None:
        """Should create /etc/fstab."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        fstab = work_dir / "etc" / "fstab"
        assert fstab.exists()
        assert "proc" in fstab.read_text()

    def test_creates_profile(self, tmp_path: Path) -> None:
        """Should create /etc/profile."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        profile = work_dir / "etc" / "profile"
        assert profile.exists()
        assert "PATH" in profile.read_text()

    def test_creates_motd(self, tmp_path: Path) -> None:
        """Should create /etc/motd."""
        work_dir = tmp_path / "build"
        (work_dir / "etc").mkdir(parents=True)

        create_alpine_rootfs.create_config_files(work_dir)

        motd = work_dir / "etc" / "motd"
        assert motd.exists()
        assert "VibeCode" in motd.read_text()


class TestCreateInitScript:
    """Tests for create_init_script function."""

    def test_creates_init_file(self, tmp_path: Path) -> None:
        """Should create init script."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_init_script(work_dir)

        init = work_dir / "init"
        assert init.exists()

    def test_init_is_executable(self, tmp_path: Path) -> None:
        """Init script should be executable."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_init_script(work_dir)

        init = work_dir / "init"
        # Check execute permissions
        assert init.stat().st_mode & 0o100  # Owner execute bit

    def test_init_has_shebang(self, tmp_path: Path) -> None:
        """Init script should have shebang."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_init_script(work_dir)

        content = (work_dir / "init").read_text()
        assert content.startswith("#!/bin/sh")

    def test_init_mounts_filesystems(self, tmp_path: Path) -> None:
        """Init script should mount filesystems."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_init_script(work_dir)

        content = (work_dir / "init").read_text()
        assert "mount" in content
        assert "/proc" in content
        assert "/sys" in content


class TestCreateHelperScripts:
    """Tests for create_helper_scripts function."""

    def test_creates_verify_nodejs(self, tmp_path: Path) -> None:
        """Should create verify-nodejs script."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_helper_scripts(work_dir)

        script = work_dir / "usr" / "local" / "bin" / "verify-nodejs"
        assert script.exists()

    def test_creates_quick_start(self, tmp_path: Path) -> None:
        """Should create quick-start script."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_helper_scripts(work_dir)

        script = work_dir / "usr" / "local" / "bin" / "quick-start"
        assert script.exists()

    def test_scripts_are_executable(self, tmp_path: Path) -> None:
        """Helper scripts should be executable."""
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        create_alpine_rootfs.create_helper_scripts(work_dir)

        bin_dir = work_dir / "usr" / "local" / "bin"
        for script in bin_dir.iterdir():
            assert script.stat().st_mode & 0o100  # Owner execute bit


class TestDownloadAlpineMinirootfs:
    """Tests for download_alpine_minirootfs function."""

    def test_uses_cached_tarball(self, tmp_path: Path) -> None:
        """Should use cached tarball if present."""
        rootfs_dir = tmp_path / "rootfs"
        rootfs_dir.mkdir()
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        tarball = f"alpine-minirootfs-{create_alpine_rootfs.ALPINE_VERSION}.0-aarch64.tar.gz"
        (rootfs_dir / tarball).write_bytes(b"cached content")

        result = create_alpine_rootfs.download_alpine_minirootfs(rootfs_dir, work_dir)
        assert result == rootfs_dir / tarball

    @patch("subprocess.run")
    def test_downloads_if_missing(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should download tarball if not present."""
        rootfs_dir = tmp_path / "rootfs"
        rootfs_dir.mkdir()
        work_dir = tmp_path / "build"
        work_dir.mkdir()

        tarball = f"alpine-minirootfs-{create_alpine_rootfs.ALPINE_VERSION}.0-aarch64.tar.gz"

        def create_tarball(*args, **kwargs):
            (rootfs_dir / tarball).write_bytes(b"downloaded content")
            return MagicMock(returncode=0)

        mock_run.side_effect = create_tarball

        result = create_alpine_rootfs.download_alpine_minirootfs(rootfs_dir, work_dir)
        assert result == rootfs_dir / tarball
        mock_run.assert_called_once()


class TestCreateInitramfs:
    """Tests for create_initramfs function."""

    @patch("subprocess.Popen")
    def test_creates_cpio_gz_file(self, mock_popen: MagicMock, tmp_path: Path) -> None:
        """Should create a cpio.gz file."""
        rootfs_dir = tmp_path / "rootfs"
        rootfs_dir.mkdir()
        work_dir = tmp_path / "build"
        work_dir.mkdir()
        (work_dir / "test_file").write_text("test")

        # Mock the pipeline
        mock_find = MagicMock()
        mock_find.stdout = MagicMock()
        mock_find.stdout.close = MagicMock()

        mock_cpio = MagicMock()
        mock_cpio.stdout = MagicMock()
        mock_cpio.stdout.close = MagicMock()

        mock_gzip = MagicMock()
        mock_gzip.communicate.return_value = (b"compressed data", None)

        mock_popen.side_effect = [mock_find, mock_cpio, mock_gzip]

        result = create_alpine_rootfs.create_initramfs(rootfs_dir, work_dir)

        assert result == rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"
        assert result.exists()


class TestPrintSummary:
    """Tests for print_summary function."""

    def test_prints_output_path(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print the output path."""
        initramfs = tmp_path / "test.cpio.gz"
        initramfs.write_bytes(b"x" * 1024 * 1024)  # 1MB

        create_alpine_rootfs.print_summary(initramfs)

        captured = capsys.readouterr()
        assert str(initramfs) in captured.out
        assert "MB" in captured.out

    def test_prints_contents_list(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print contents list."""
        initramfs = tmp_path / "test.cpio.gz"
        initramfs.write_bytes(b"x" * 1024)

        create_alpine_rootfs.print_summary(initramfs)

        captured = capsys.readouterr()
        assert "Alpine Linux" in captured.out
        assert "Node.js" in captured.out
        assert "npm" in captured.out


class TestMain:
    """Tests for main function."""

    @patch("scripts.vfkit.create_alpine_rootfs.print_summary")
    @patch("scripts.vfkit.create_alpine_rootfs.create_initramfs")
    @patch("scripts.vfkit.create_alpine_rootfs.create_helper_scripts")
    @patch("scripts.vfkit.create_alpine_rootfs.create_init_script")
    @patch("scripts.vfkit.create_alpine_rootfs.create_config_files")
    @patch("scripts.vfkit.create_alpine_rootfs.download_nodejs")
    @patch("scripts.vfkit.create_alpine_rootfs.configure_apk")
    @patch("scripts.vfkit.create_alpine_rootfs.extract_minirootfs")
    @patch("scripts.vfkit.create_alpine_rootfs.download_alpine_minirootfs")
    @patch("scripts.vfkit.create_alpine_rootfs.create_directory_structure")
    @patch("scripts.vfkit.create_alpine_rootfs.get_vm_dirs")
    def test_success_returns_zero(
        self,
        mock_get_vm_dirs: MagicMock,
        mock_create_dir_structure: MagicMock,
        mock_download_minirootfs: MagicMock,
        mock_extract: MagicMock,
        mock_apk: MagicMock,
        mock_nodejs: MagicMock,
        mock_config: MagicMock,
        mock_init: MagicMock,
        mock_helpers: MagicMock,
        mock_initramfs: MagicMock,
        mock_summary: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Successful execution should return 0."""
        rootfs_dir = tmp_path / "rootfs"
        work_dir = tmp_path / "build"
        mock_get_vm_dirs.return_value = (rootfs_dir, work_dir)
        mock_download_minirootfs.return_value = tmp_path / "tarball.tar.gz"
        mock_initramfs.return_value = tmp_path / "output.cpio.gz"

        result = create_alpine_rootfs.main()
        assert result == 0

    @patch("scripts.vfkit.create_alpine_rootfs.create_directory_structure")
    @patch("scripts.vfkit.create_alpine_rootfs.get_vm_dirs")
    def test_failure_returns_one(
        self,
        mock_get_vm_dirs: MagicMock,
        mock_create_dir_structure: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Failure should return 1."""
        rootfs_dir = tmp_path / "rootfs"
        work_dir = tmp_path / "build"
        mock_get_vm_dirs.return_value = (rootfs_dir, work_dir)
        mock_create_dir_structure.side_effect = RuntimeError("Test error")

        result = create_alpine_rootfs.main()
        assert result == 1