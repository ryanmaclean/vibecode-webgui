
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

"""Tests for 02-download-alpine-kernel.py functionality."""

from __future__ import annotations

import gzip
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.vfkit import download_alpine_kernel


class TestConstants:
    """Test module constants."""

    def test_alpine_version_format(self) -> None:
        """Alpine version should be a valid version string."""
        assert download_alpine_kernel.ALPINE_VERSION
        parts = download_alpine_kernel.ALPINE_VERSION.split(".")
        assert len(parts) >= 2
        assert all(p.isdigit() for p in parts)

    def test_alpine_release_format(self) -> None:
        """Alpine release should be a valid release string."""
        assert download_alpine_kernel.ALPINE_RELEASE
        parts = download_alpine_kernel.ALPINE_RELEASE.split(".")
        assert len(parts) >= 3
        assert all(p.isdigit() for p in parts)

    def test_alpine_arch(self) -> None:
        """Architecture should be aarch64."""
        assert download_alpine_kernel.ALPINE_ARCH == "aarch64"

    def test_iso_url_format(self) -> None:
        """ISO URL should be a valid HTTPS URL."""
        url = download_alpine_kernel.ALPINE_ISO_URL
        assert url.startswith("https://")
        assert "alpinelinux.org" in url
        assert "aarch64" in url


class TestGetKernelDir:
    """Tests for get_kernel_dir function."""

    def test_returns_path(self) -> None:
        """get_kernel_dir should return a Path object."""
        result = download_alpine_kernel.get_kernel_dir()
        assert isinstance(result, Path)

    def test_path_in_home(self) -> None:
        """Kernel dir should be under home directory."""
        result = download_alpine_kernel.get_kernel_dir()
        assert str(Path.home()) in str(result)

    def test_path_contains_vfkit(self) -> None:
        """Path should contain .vfkit directory."""
        result = download_alpine_kernel.get_kernel_dir()
        assert ".vfkit" in str(result)

    def test_path_ends_with_kernel(self) -> None:
        """Path should end with kernel directory."""
        result = download_alpine_kernel.get_kernel_dir()
        assert result.name == "kernel"


class TestDownloadAlpineIso:
    """Tests for download_alpine_iso function."""

    def test_existing_iso_returns_immediately(self, tmp_path: Path) -> None:
        """If ISO already exists, should return its path without downloading."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)
        iso_path = kernel_dir / download_alpine_kernel.ALPINE_ISO
        iso_path.write_bytes(b"fake iso content")

        result = download_alpine_kernel.download_alpine_iso(kernel_dir)
        assert result == iso_path

    @patch("scripts.vfkit.download_alpine_kernel.fast_download")
    def test_uses_fast_download_when_available(
        self, mock_fast_download: MagicMock, tmp_path: Path
    ) -> None:
        """Should use fast_download when available."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)
        iso_path = kernel_dir / download_alpine_kernel.ALPINE_ISO

        # Simulate successful download
        def create_iso(*args, **kwargs):
            iso_path.write_bytes(b"downloaded iso content")
            return True

        mock_fast_download.side_effect = create_iso

        result = download_alpine_kernel.download_alpine_iso(kernel_dir)
        assert result == iso_path
        mock_fast_download.assert_called_once()


class TestExtractWithBsdtar:
    """Tests for extract_with_bsdtar function."""

    @patch("subprocess.run")
    def test_extracts_boot_files(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should attempt to extract boot files with bsdtar."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)
        iso_path = kernel_dir / "test.iso"
        iso_path.write_bytes(b"fake iso")

        # Create boot directory with files
        boot_dir = kernel_dir / "boot"
        boot_dir.mkdir()
        (boot_dir / "vmlinuz-virt").write_bytes(b"kernel")
        (boot_dir / "initramfs-virt").write_bytes(b"initramfs")

        mock_run.return_value = MagicMock(returncode=0)

        vmlinuz, initramfs = download_alpine_kernel.extract_with_bsdtar(
            iso_path, kernel_dir
        )

        assert vmlinuz is not None
        assert initramfs is not None
        assert vmlinuz.exists()
        assert initramfs.exists()


class TestExtractWithHdiutil:
    """Tests for extract_with_hdiutil function."""

    @patch("subprocess.run")
    @patch("tempfile.mkdtemp")
    def test_mounts_and_unmounts_iso(
        self, mock_mkdtemp: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should mount ISO, copy files, and unmount."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)
        iso_path = kernel_dir / "test.iso"
        iso_path.write_bytes(b"fake iso")

        mount_point = tmp_path / "mount"
        mount_point.mkdir()
        boot_dir = mount_point / "boot"
        boot_dir.mkdir()
        (boot_dir / "vmlinuz-virt").write_bytes(b"kernel")
        (boot_dir / "initramfs-virt").write_bytes(b"initramfs")

        mock_mkdtemp.return_value = str(mount_point)
        mock_run.return_value = MagicMock(returncode=0)

        vmlinuz, initramfs = download_alpine_kernel.extract_with_hdiutil(
            iso_path, kernel_dir
        )

        # Should have called hdiutil attach and detach
        assert mock_run.call_count >= 2


class TestExtractUncompressedKernel:
    """Tests for extract_uncompressed_kernel function."""

    def test_returns_none_if_vmlinuz_missing(self, tmp_path: Path) -> None:
        """Should return None if vmlinuz doesn't exist."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)

        result = download_alpine_kernel.extract_uncompressed_kernel(kernel_dir)
        assert result is None

    def test_extracts_gzip_compressed_kernel(self, tmp_path: Path) -> None:
        """Should extract kernel from gzip-compressed vmlinuz."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)

        # Create a fake compressed kernel
        kernel_data = b"fake kernel content"
        compressed = gzip.compress(kernel_data)

        # Prepend some header bytes before gzip magic
        vmlinuz_content = b"\x00" * 100 + compressed
        (kernel_dir / "vmlinuz").write_bytes(vmlinuz_content)

        result = download_alpine_kernel.extract_uncompressed_kernel(kernel_dir)

        assert result is not None
        assert result.exists()
        assert result.name == "vmlinux"
        assert result.read_bytes() == kernel_data

    def test_returns_none_if_no_gzip_header(self, tmp_path: Path) -> None:
        """Should return None if no gzip header found."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)

        # Create vmlinuz without gzip magic
        (kernel_dir / "vmlinuz").write_bytes(b"not compressed")

        result = download_alpine_kernel.extract_uncompressed_kernel(kernel_dir)
        assert result is None


class TestPrintSummary:
    """Tests for print_summary function."""

    def test_prints_file_sizes(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should print sizes of extracted files."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir(parents=True)

        vmlinuz = kernel_dir / "vmlinuz"
        initramfs = kernel_dir / "initramfs"
        iso = kernel_dir / download_alpine_kernel.ALPINE_ISO

        vmlinuz.write_bytes(b"k" * 1024)  # 1KB
        initramfs.write_bytes(b"i" * 1024 * 1024)  # 1MB
        iso.write_bytes(b"iso" * 100)

        download_alpine_kernel.print_summary(kernel_dir, vmlinuz, initramfs, None)

        captured = capsys.readouterr()
        assert "vmlinuz" in captured.out
        assert "initramfs" in captured.out
        assert "Next step" in captured.out


class TestMain:
    """Tests for main function."""

    @patch("scripts.vfkit.download_alpine_kernel.download_alpine_iso")
    @patch("scripts.vfkit.download_alpine_kernel.extract_kernel_initramfs")
    @patch("scripts.vfkit.download_alpine_kernel.extract_uncompressed_kernel")
    @patch("scripts.vfkit.download_alpine_kernel.print_summary")
    @patch("scripts.vfkit.download_alpine_kernel.test_connectivity")
    def test_success_returns_zero(
        self,
        mock_connectivity: MagicMock,
        mock_summary: MagicMock,
        mock_extract_uncomp: MagicMock,
        mock_extract: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Successful execution should return 0."""
        with patch.object(download_alpine_kernel, "get_kernel_dir", return_value=tmp_path):
            mock_download.return_value = tmp_path / "test.iso"
            mock_extract.return_value = (tmp_path / "vmlinuz", tmp_path / "initramfs")
            mock_extract_uncomp.return_value = tmp_path / "vmlinux"

            result = download_alpine_kernel.main()
            assert result == 0

    @patch("scripts.vfkit.download_alpine_kernel.download_alpine_iso")
    @patch("scripts.vfkit.download_alpine_kernel.test_connectivity")
    def test_download_failure_returns_one(
        self,
        mock_connectivity: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Download failure should return 1."""
        with patch.object(download_alpine_kernel, "get_kernel_dir", return_value=tmp_path):
            mock_download.side_effect = RuntimeError("Download failed")

            result = download_alpine_kernel.main()
            assert result == 1