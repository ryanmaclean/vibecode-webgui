"""Tests for scripts/macos-vm/download_kernel.py"""

from __future__ import annotations

import sys
import tarfile
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import URLError

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "macos-vm"))

from download_kernel import (
    KernelConfig,
    download_kernel,
    download_tarball,
    extract_kernel_files,
    list_kernel_files,
    log_info,
    log_success,
)


class TestKernelConfig:
    """Tests for KernelConfig dataclass."""

    def test_default_values(self) -> None:
        """Should create config with default values."""
        config = KernelConfig()
        assert config.kernel_version == "6.6.68"
        assert config.vm_dir == Path.home() / ".vibecode" / "vm"
        assert "cloud-hypervisor" in config.release_url

    def test_vmlinuz_versioned(self) -> None:
        """Should compute versioned vmlinuz filename."""
        config = KernelConfig(kernel_version="6.6.68")
        assert config.vmlinuz_versioned == "vmlinuz-6.6.68-mseries"

    def test_vmlinuz_path(self) -> None:
        """Should compute vmlinuz path."""
        config = KernelConfig()
        assert config.vmlinuz_path == config.vm_dir / "vmlinuz"

    def test_initramfs_path(self) -> None:
        """Should compute initramfs path."""
        config = KernelConfig()
        assert config.initramfs_path == config.vm_dir / "initramfs"

    def test_custom_config(self, tmp_path: Path) -> None:
        """Should accept custom values."""
        config = KernelConfig(
            vm_dir=tmp_path,
            kernel_version="6.7.0",
        )
        assert config.vm_dir == tmp_path
        assert config.kernel_version == "6.7.0"

    @patch.dict("os.environ", {"VM_DIR": "/custom/vm", "KERNEL_VERSION": "6.7.0"}, clear=True)
    def test_from_env(self) -> None:
        """Should create config from environment variables."""
        config = KernelConfig.from_env()
        assert config.vm_dir == Path("/custom/vm")
        assert config.kernel_version == "6.7.0"

    @patch.dict("os.environ", {}, clear=True)
    def test_from_env_defaults(self) -> None:
        """Should use defaults when env vars not set."""
        config = KernelConfig.from_env()
        assert config.vm_dir == Path.home() / ".vibecode" / "vm"
        assert config.kernel_version == "6.6.68"


class TestLogFunctions:
    """Tests for log functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should print info message."""
        log_info("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        log_success("Success message")
        captured = capsys.readouterr()
        assert "Success message" in captured.out


class TestDownloadTarball:
    """Tests for download_tarball function."""

    @patch("download_kernel.urlopen")
    def test_downloads_successfully(self, mock_urlopen: MagicMock) -> None:
        """Should return tarball data on success."""
        mock_response = MagicMock()
        mock_response.read.return_value = b"fake tarball data"
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = download_tarball("https://example.com/file.tar.gz")

        assert result == b"fake tarball data"

    @patch("download_kernel.urlopen")
    def test_returns_none_on_url_error(self, mock_urlopen: MagicMock) -> None:
        """Should return None on URL error."""
        mock_urlopen.side_effect = URLError("Connection failed")

        result = download_tarball("https://example.com/file.tar.gz")

        assert result is None

    @patch("download_kernel.urlopen")
    def test_returns_none_on_timeout(self, mock_urlopen: MagicMock) -> None:
        """Should return None on timeout."""
        mock_urlopen.side_effect = TimeoutError()

        result = download_tarball("https://example.com/file.tar.gz")

        assert result is None


class TestExtractKernelFiles:
    """Tests for extract_kernel_files function."""

    def test_extracts_files(self, tmp_path: Path) -> None:
        """Should extract kernel files from tarball."""
        config = KernelConfig(vm_dir=tmp_path, kernel_version="6.6.68")
        config.vm_dir.mkdir(parents=True, exist_ok=True)

        # Create a fake tarball
        tarball_buffer = BytesIO()
        with tarfile.open(fileobj=tarball_buffer, mode="w:gz") as tar:
            # Add vmlinuz
            vmlinuz_data = b"fake kernel"
            vmlinuz_info = tarfile.TarInfo(name="vmlinuz-6.6.68-mseries")
            vmlinuz_info.size = len(vmlinuz_data)
            tar.addfile(vmlinuz_info, BytesIO(vmlinuz_data))

            # Add initramfs
            initramfs_data = b"fake initramfs"
            initramfs_info = tarfile.TarInfo(name="initramfs")
            initramfs_info.size = len(initramfs_data)
            tar.addfile(initramfs_info, BytesIO(initramfs_data))

        tarball_buffer.seek(0)
        result = extract_kernel_files(tarball_buffer.read(), config)

        assert result is True
        assert config.vmlinuz_path.exists()
        assert config.initramfs_path.exists()
        assert config.vmlinuz_path.read_bytes() == b"fake kernel"
        assert config.initramfs_path.read_bytes() == b"fake initramfs"

    def test_returns_false_when_files_not_found(self, tmp_path: Path) -> None:
        """Should return False when required files not in tarball."""
        config = KernelConfig(vm_dir=tmp_path)
        config.vm_dir.mkdir(parents=True, exist_ok=True)

        # Create empty tarball
        tarball_buffer = BytesIO()
        with tarfile.open(fileobj=tarball_buffer, mode="w:gz") as tar:
            # Add unrelated file
            data = b"other file"
            info = tarfile.TarInfo(name="other.txt")
            info.size = len(data)
            tar.addfile(info, BytesIO(data))

        tarball_buffer.seek(0)
        result = extract_kernel_files(tarball_buffer.read(), config)

        assert result is False

    def test_handles_invalid_tarball(self, tmp_path: Path) -> None:
        """Should return False for invalid tarball."""
        config = KernelConfig(vm_dir=tmp_path)
        config.vm_dir.mkdir(parents=True, exist_ok=True)

        result = extract_kernel_files(b"not a tarball", config)

        assert result is False


class TestListKernelFiles:
    """Tests for list_kernel_files function."""

    def test_lists_existing_files(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should list existing kernel files."""
        config = KernelConfig(vm_dir=tmp_path)
        config.vm_dir.mkdir(parents=True, exist_ok=True)
        config.vmlinuz_path.write_bytes(b"x" * 1024)
        config.initramfs_path.write_bytes(b"y" * 2048)

        list_kernel_files(config)

        captured = capsys.readouterr()
        assert "vmlinuz" in captured.out
        assert "initramfs" in captured.out

    def test_handles_missing_files(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should handle missing files gracefully."""
        config = KernelConfig(vm_dir=tmp_path)

        list_kernel_files(config)

        captured = capsys.readouterr()
        # Should not error, just produce no output for missing files
        assert captured.out == ""


class TestDownloadKernel:
    """Tests for download_kernel function."""

    @patch("download_kernel.download_tarball")
    @patch("download_kernel.extract_kernel_files")
    def test_successful_download(
        self,
        mock_extract: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should complete successfully."""
        mock_download.return_value = b"tarball data"
        mock_extract.return_value = True
        config = KernelConfig(vm_dir=tmp_path)

        # Create the files that would be extracted
        config.vm_dir.mkdir(parents=True, exist_ok=True)
        config.vmlinuz_path.write_bytes(b"kernel")
        config.initramfs_path.write_bytes(b"initramfs")

        result = download_kernel(config)

        assert result == 0
        mock_download.assert_called_once()
        mock_extract.assert_called_once()

    @patch("download_kernel.download_tarball")
    def test_fails_on_download_error(
        self,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when download fails."""
        mock_download.return_value = None
        config = KernelConfig(vm_dir=tmp_path)

        result = download_kernel(config)

        assert result == 1

    @patch("download_kernel.download_tarball")
    @patch("download_kernel.extract_kernel_files")
    def test_fails_on_extraction_error(
        self,
        mock_extract: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when extraction fails."""
        mock_download.return_value = b"tarball data"
        mock_extract.return_value = False
        config = KernelConfig(vm_dir=tmp_path)

        result = download_kernel(config)

        assert result == 1

    @patch("download_kernel.download_tarball")
    @patch("download_kernel.extract_kernel_files")
    def test_fails_when_vmlinuz_missing(
        self,
        mock_extract: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when vmlinuz not extracted."""
        mock_download.return_value = b"tarball data"
        mock_extract.return_value = True
        config = KernelConfig(vm_dir=tmp_path)
        config.vm_dir.mkdir(parents=True, exist_ok=True)
        # Only create initramfs, not vmlinuz
        config.initramfs_path.write_bytes(b"initramfs")

        result = download_kernel(config)

        assert result == 1

    @patch("download_kernel.download_tarball")
    @patch("download_kernel.extract_kernel_files")
    def test_fails_when_initramfs_missing(
        self,
        mock_extract: MagicMock,
        mock_download: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should fail when initramfs not extracted."""
        mock_download.return_value = b"tarball data"
        mock_extract.return_value = True
        config = KernelConfig(vm_dir=tmp_path)
        config.vm_dir.mkdir(parents=True, exist_ok=True)
        # Only create vmlinuz, not initramfs
        config.vmlinuz_path.write_bytes(b"kernel")

        result = download_kernel(config)

        assert result == 1

    def test_creates_vm_directory(self, tmp_path: Path) -> None:
        """Should create VM directory if not exists."""
        vm_dir = tmp_path / "new" / "vm" / "dir"
        config = KernelConfig(vm_dir=vm_dir)

        with patch("download_kernel.download_tarball", return_value=None):
            download_kernel(config)

        assert vm_dir.exists()

    def test_uses_env_config_when_none(self) -> None:
        """Should use env config when config is None."""
        with patch("download_kernel.KernelConfig.from_env") as mock_from_env:
            mock_config = MagicMock()
            mock_config.vm_dir = Path("/tmp/test")
            mock_config.vmlinuz_path = Path("/tmp/test/vmlinuz")
            mock_config.initramfs_path = Path("/tmp/test/initramfs")
            mock_from_env.return_value = mock_config

            with patch("download_kernel.download_tarball", return_value=None):
                download_kernel(None)

            mock_from_env.assert_called_once()
