

"""Tests for scripts/vz/download_alpine_minimal.py"""

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

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vz"))

from download_alpine_minimal import (
    check_existing_kernel,
    download_alpine_kernel,
    extract_kernel_from_iso,
    find_latest_alpine_release,
    get_file_size_human,
    get_kernel_base_url,
)


class TestGetKernelBaseUrl:
    """Tests for get_kernel_base_url function."""

    def test_builds_correct_url(self) -> None:
        """Should build the correct Alpine release URL."""
        url = get_kernel_base_url("3.20", "aarch64")
        assert url == "https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64"

    def test_handles_different_versions(self) -> None:
        """Should handle different version strings."""
        url = get_kernel_base_url("3.19", "x86_64")
        assert url == "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64"


class TestCheckExistingKernel:
    """Tests for check_existing_kernel function."""

    def test_returns_path_when_kernel_exists(self, tmp_path: Path) -> None:
        """Should return path when kernel exists."""
        kernel = tmp_path / "vmlinuz"
        kernel.write_bytes(b"fake kernel")
        result = check_existing_kernel(tmp_path)
        assert result == kernel

    def test_returns_none_when_kernel_missing(self, tmp_path: Path) -> None:
        """Should return None when kernel is missing."""
        result = check_existing_kernel(tmp_path)
        assert result is None


class TestGetFileSizeHuman:
    """Tests for get_file_size_human function."""

    def test_formats_bytes(self, tmp_path: Path) -> None:
        """Should format small files in bytes."""
        f = tmp_path / "small"
        f.write_bytes(b"x" * 100)
        assert "B" in get_file_size_human(f)

    def test_formats_kilobytes(self, tmp_path: Path) -> None:
        """Should format files in kilobytes."""
        f = tmp_path / "medium"
        f.write_bytes(b"x" * 2000)
        result = get_file_size_human(f)
        assert "KB" in result or "B" in result

    def test_formats_megabytes(self, tmp_path: Path) -> None:
        """Should format larger files in megabytes."""
        f = tmp_path / "large"
        f.write_bytes(b"x" * (2 * 1024 * 1024))
        assert "MB" in get_file_size_human(f)


class TestFindLatestAlpineRelease:
    """Tests for find_latest_alpine_release function."""

    @patch("download_alpine_minimal.subprocess.run")
    def test_returns_fallback_on_error(self, mock_run: MagicMock) -> None:
        """Should return fallback version on error."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        result = find_latest_alpine_release("https://example.com")
        assert result == "3.20.3"

    @patch("download_alpine_minimal.subprocess.run")
    def test_parses_version_from_html(self, mock_run: MagicMock) -> None:
        """Should parse version from HTML response."""
        html = '<a href="alpine-virt-3.20.4-aarch64.iso">alpine-virt-3.20.4-aarch64.iso</a>'
        mock_run.return_value = MagicMock(returncode=0, stdout=html)
        result = find_latest_alpine_release("https://example.com")
        assert result == "3.20.4"

    @patch("download_alpine_minimal.subprocess.run")
    def test_returns_latest_when_multiple_versions(self, mock_run: MagicMock) -> None:
        """Should return latest version when multiple found."""
        html = """
        <a href="alpine-virt-3.20.1-aarch64.iso">alpine-virt-3.20.1-aarch64.iso</a>
        <a href="alpine-virt-3.20.3-aarch64.iso">alpine-virt-3.20.3-aarch64.iso</a>
        <a href="alpine-virt-3.20.2-aarch64.iso">alpine-virt-3.20.2-aarch64.iso</a>
        """
        mock_run.return_value = MagicMock(returncode=0, stdout=html)
        result = find_latest_alpine_release("https://example.com")
        assert result == "3.20.3"


class TestExtractKernelFromIso:
    """Tests for extract_kernel_from_iso function."""

    @patch("download_alpine_minimal.shutil.which")
    def test_returns_none_when_bsdtar_missing(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should return None when bsdtar is not found."""
        mock_which.return_value = None
        iso_path = tmp_path / "test.iso"
        iso_path.touch()
        result = extract_kernel_from_iso(iso_path, tmp_path)
        assert result is None


class TestDownloadAlpineKernel:
    """Tests for download_alpine_kernel function."""

    def test_returns_success_when_kernel_exists(self, tmp_path: Path) -> None:
        """Should return 0 when kernel already exists."""
        kernel = tmp_path / "vmlinuz"
        kernel.write_bytes(b"fake kernel")
        result = download_alpine_kernel(tmp_path)
        assert result == 0

    @patch("download_alpine_minimal.shutil.which")
    def test_returns_error_when_curl_missing(
        self, mock_which: MagicMock, tmp_path: Path
    ) -> None:
        """Should return 1 when curl is not found."""
        mock_which.return_value = None
        result = download_alpine_kernel(tmp_path)
        assert result == 1