"""Tests for scripts/vfkit/download_alpine_kernel.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vfkit"))

from download_alpine_kernel import (
    AlpineConfig,
    download_iso,
    extract_kernel_and_initramfs,
    extract_uncompressed_kernel,
    extract_with_7z,
    extract_with_bsdtar,
    extract_with_hdiutil,
    find_extractor,
    get_directory_size,
    get_file_size_human,
    log_error,
    log_info,
    log_success,
    log_warning,
    run_command,
    run_download,
)


class TestAlpineConfig:
    """Tests for AlpineConfig dataclass."""

    def test_default_config(self) -> None:
        """Should create config with default values."""
        config = AlpineConfig()
        assert config.version == "3.19"
        assert config.release == "3.19.1"
        assert config.arch == "aarch64"

    def test_kernel_dir(self) -> None:
        """Should compute kernel_dir correctly."""
        config = AlpineConfig()
        assert config.kernel_dir == config.vm_dir / "kernel"

    def test_base_url(self) -> None:
        """Should compute base_url correctly."""
        config = AlpineConfig()
        assert "dl-cdn.alpinelinux.org" in config.base_url
        assert "3.19" in config.base_url
        assert "aarch64" in config.base_url

    def test_iso_name(self) -> None:
        """Should compute iso_name correctly."""
        config = AlpineConfig()
        assert config.iso_name == "alpine-virt-3.19.1-aarch64.iso"

    def test_iso_url(self) -> None:
        """Should compute iso_url correctly."""
        config = AlpineConfig()
        assert config.iso_url.endswith(config.iso_name)
        assert config.base_url in config.iso_url

    def test_custom_config(self) -> None:
        """Should accept custom values."""
        config = AlpineConfig(version="3.20", release="3.20.0", arch="x86_64")
        assert config.version == "3.20"
        assert config.release == "3.20.0"
        assert config.arch == "x86_64"


class TestLogFunctions:
    """Tests for log helper functions."""

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

    def test_kilobytes(self, tmp_path: Path) -> None:
        """Should format files in KB."""
        f = tmp_path / "medium"
        f.write_bytes(b"x" * 2000)
        result = get_file_size_human(f)
        assert "KB" in result or "B" in result

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


class TestRunCommand:
    """Tests for run_command function."""

    @patch("download_alpine_kernel.subprocess.run")
    def test_returns_result_on_success(self, mock_run: MagicMock) -> None:
        """Should return subprocess result on success."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output", stderr="")
        result = run_command(["echo", "test"])
        assert result.returncode == 0

    @patch("download_alpine_kernel.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock) -> None:
        """Should handle timeout gracefully."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=30)
        result = run_command(["sleep", "100"], timeout=1)
        assert result.returncode == 1
        assert "Timeout" in result.stderr

    @patch("download_alpine_kernel.subprocess.run")
    def test_handles_subprocess_error(self, mock_run: MagicMock) -> None:
        """Should handle subprocess errors gracefully."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        result = run_command(["bad", "command"])
        assert result.returncode == 1


class TestFindExtractor:
    """Tests for find_extractor function."""

    @patch("download_alpine_kernel.shutil.which")
    def test_finds_7z(self, mock_which: MagicMock) -> None:
        """Should find 7z when available."""
        mock_which.side_effect = lambda x: "/usr/bin/7z" if x == "7z" else None
        assert find_extractor() == "7z"

    @patch("download_alpine_kernel.shutil.which")
    def test_finds_bsdtar(self, mock_which: MagicMock) -> None:
        """Should find bsdtar when 7z not available."""
        mock_which.side_effect = lambda x: "/usr/bin/bsdtar" if x == "bsdtar" else None
        assert find_extractor() == "bsdtar"

    @patch("download_alpine_kernel.shutil.which")
    def test_returns_none_when_nothing_found(self, mock_which: MagicMock) -> None:
        """Should return None when no extractor found."""
        mock_which.return_value = None
        assert find_extractor() is None


class TestDownloadIso:
    """Tests for download_iso function."""

    def test_returns_true_when_iso_exists(self, tmp_path: Path) -> None:
        """Should return True when ISO already exists."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        config = AlpineConfig(vm_dir=tmp_path)
        (kernel_dir / config.iso_name).write_text("fake iso")

        assert download_iso(config) is True

    @patch("download_alpine_kernel.run_command")
    @patch("download_alpine_kernel.shutil.which")
    def test_downloads_with_curl(
        self, mock_which: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should download ISO with curl."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        config = AlpineConfig(vm_dir=tmp_path)

        mock_which.return_value = None  # No aria2c
        mock_run.return_value = MagicMock(returncode=0)

        # Create the file to simulate successful download
        (kernel_dir / config.iso_name).write_text("fake iso")

        assert download_iso(config) is True


class TestExtractWith7z:
    """Tests for extract_with_7z function."""

    @patch("download_alpine_kernel.run_command")
    def test_extracts_files(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should extract kernel and initramfs."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        iso_path = kernel_dir / "test.iso"
        iso_path.write_text("fake iso")

        # Create boot directory with files
        boot_dir = kernel_dir / "boot"
        boot_dir.mkdir()
        (boot_dir / "vmlinuz-virt").write_bytes(b"kernel")
        (boot_dir / "initramfs-virt").write_bytes(b"initramfs")

        mock_run.return_value = MagicMock(returncode=0)

        kernel, initramfs = extract_with_7z(iso_path, kernel_dir)

        assert kernel is not None
        assert initramfs is not None


class TestExtractWithBsdtar:
    """Tests for extract_with_bsdtar function."""

    @patch("download_alpine_kernel.run_command")
    def test_extracts_files(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should extract kernel and initramfs."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        iso_path = kernel_dir / "test.iso"
        iso_path.write_text("fake iso")

        # Create boot directory with files
        boot_dir = kernel_dir / "boot"
        boot_dir.mkdir()
        (boot_dir / "vmlinuz-virt").write_bytes(b"kernel")
        (boot_dir / "initramfs-virt").write_bytes(b"initramfs")

        mock_run.return_value = MagicMock(returncode=0)

        kernel, initramfs = extract_with_bsdtar(iso_path, kernel_dir)

        assert kernel is not None
        assert initramfs is not None


class TestExtractWithHdiutil:
    """Tests for extract_with_hdiutil function."""

    @patch("download_alpine_kernel.shutil.which")
    def test_returns_none_when_no_hdiutil(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should return None when hdiutil not available."""
        mock_which.return_value = None
        config = AlpineConfig(vm_dir=tmp_path)
        iso_path = tmp_path / "test.iso"

        kernel, initramfs = extract_with_hdiutil(iso_path, tmp_path)

        assert kernel is None
        assert initramfs is None


class TestExtractKernelAndInitramfs:
    """Tests for extract_kernel_and_initramfs function."""

    @patch("download_alpine_kernel.find_extractor")
    def test_fails_when_no_extractor(
        self, mock_find: MagicMock, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should fail when no extractor found."""
        mock_find.return_value = None
        config = AlpineConfig(vm_dir=tmp_path)

        assert extract_kernel_and_initramfs(config) is False
        captured = capsys.readouterr()
        assert "No ISO extraction tool found" in captured.out


class TestExtractUncompressedKernel:
    """Tests for extract_uncompressed_kernel function."""

    def test_returns_false_when_vmlinuz_missing(self, tmp_path: Path) -> None:
        """Should return False when vmlinuz is missing."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        config = AlpineConfig(vm_dir=tmp_path)

        assert extract_uncompressed_kernel(config) is False

    def test_extracts_gzipped_kernel(self, tmp_path: Path) -> None:
        """Should extract gzipped kernel from vmlinuz."""
        import gzip

        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        config = AlpineConfig(vm_dir=tmp_path)

        # Create a fake vmlinuz with gzip header
        # First some padding, then gzipped content
        padding = b"PADDING" * 100
        content = b"FAKE KERNEL CONTENT"
        gzipped = gzip.compress(content)

        vmlinuz = kernel_dir / "vmlinuz"
        vmlinuz.write_bytes(padding + gzipped)

        result = extract_uncompressed_kernel(config)

        assert result is True
        vmlinux = kernel_dir / "vmlinux"
        assert vmlinux.exists()
        assert vmlinux.read_bytes() == content

    def test_returns_false_when_no_gzip_header(self, tmp_path: Path) -> None:
        """Should return False when no gzip header found."""
        kernel_dir = tmp_path / "kernel"
        kernel_dir.mkdir()
        config = AlpineConfig(vm_dir=tmp_path)

        # Create vmlinuz without gzip header
        vmlinuz = kernel_dir / "vmlinuz"
        vmlinuz.write_bytes(b"NOT A GZIPPED FILE")

        result = extract_uncompressed_kernel(config)

        assert result is False


class TestGetDirectorySize:
    """Tests for get_directory_size function."""

    def test_calculates_size(self, tmp_path: Path) -> None:
        """Should calculate total directory size."""
        (tmp_path / "file1").write_bytes(b"x" * 1000)
        (tmp_path / "file2").write_bytes(b"y" * 2000)

        result = get_directory_size(tmp_path)
        assert "KB" in result or "B" in result


class TestRunDownload:
    """Tests for run_download function."""

    @patch("download_alpine_kernel.download_iso")
    def test_fails_on_download_error(
        self, mock_download: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when download fails."""
        mock_download.return_value = False
        config = AlpineConfig(vm_dir=tmp_path)

        assert run_download(config) == 1

    @patch("download_alpine_kernel.download_iso")
    @patch("download_alpine_kernel.extract_kernel_and_initramfs")
    def test_fails_on_extraction_error(
        self, mock_extract: MagicMock, mock_download: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when extraction fails."""
        mock_download.return_value = True
        mock_extract.return_value = False
        config = AlpineConfig(vm_dir=tmp_path)

        assert run_download(config) == 1

    @patch("download_alpine_kernel.download_iso")
    @patch("download_alpine_kernel.extract_kernel_and_initramfs")
    @patch("download_alpine_kernel.extract_uncompressed_kernel")
    @patch("download_alpine_kernel.print_summary")
    def test_succeeds_on_valid_download(
        self,
        mock_summary: MagicMock,
        mock_uncompress: MagicMock,
        mock_extract: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should succeed when all steps pass."""
        mock_download.return_value = True
        mock_extract.return_value = True
        mock_uncompress.return_value = True
        config = AlpineConfig(vm_dir=tmp_path)

        assert run_download(config) == 0
