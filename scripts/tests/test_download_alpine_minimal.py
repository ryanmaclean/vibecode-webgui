#!/usr/bin/env python3
"""Tests for download_alpine_minimal module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts/vz directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "vz"))

from download_alpine_minimal import (
    DEFAULT_ALPINE_ARCH,
    DEFAULT_ALPINE_VERSION,
    download_file,
    fetch_url,
    find_latest_release,
    get_file_size,
    run_command,
)


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"])
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(["nonexistent_command_12345"])
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)


class TestGetFileSize(TestCase):
    """Tests for get_file_size function."""

    def test_small_file(self):
        """Test size of small file."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 100)
            f.flush()
            size = get_file_size(Path(f.name))
            self.assertIn("B", size)
            Path(f.name).unlink()

    def test_larger_file(self):
        """Test size of larger file."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 2048)
            f.flush()
            size = get_file_size(Path(f.name))
            self.assertTrue("KB" in size or "B" in size)
            Path(f.name).unlink()


class TestFetchUrl(TestCase):
    """Tests for fetch_url function."""

    def test_invalid_url(self):
        """Test fetching invalid URL."""
        result = fetch_url("http://invalid.invalid.invalid/", timeout=2)
        self.assertIsNone(result)

    @mock.patch('download_alpine_minimal.urlopen')
    def test_successful_fetch(self, mock_urlopen):
        """Test successful URL fetch."""
        mock_response = mock.MagicMock()
        mock_response.read.return_value = b"test content"
        mock_response.__enter__ = mock.MagicMock(return_value=mock_response)
        mock_response.__exit__ = mock.MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = fetch_url("http://example.com/test")
        self.assertEqual(result, b"test content")


class TestFindLatestRelease(TestCase):
    """Tests for find_latest_release function."""

    @mock.patch('download_alpine_minimal.fetch_url')
    def test_fallback_on_error(self, mock_fetch):
        """Test fallback when fetch fails."""
        mock_fetch.return_value = None

        result = find_latest_release("3.20", "aarch64")
        self.assertEqual(result, "3.20.3")

    @mock.patch('download_alpine_minimal.fetch_url')
    def test_parse_releases(self, mock_fetch):
        """Test parsing release HTML."""
        html = b'''
        <a href="alpine-virt-3.20.1-aarch64.iso">alpine-virt-3.20.1</a>
        <a href="alpine-virt-3.20.2-aarch64.iso">alpine-virt-3.20.2</a>
        <a href="alpine-virt-3.20.3-aarch64.iso">alpine-virt-3.20.3</a>
        '''
        mock_fetch.return_value = html

        result = find_latest_release("3.20", "aarch64")
        self.assertEqual(result, "3.20.3")

    @mock.patch('download_alpine_minimal.fetch_url')
    def test_empty_html(self, mock_fetch):
        """Test fallback with empty HTML."""
        mock_fetch.return_value = b"<html></html>"

        result = find_latest_release("3.20", "aarch64")
        self.assertEqual(result, "3.20.3")


class TestDownloadFile(TestCase):
    """Tests for download_file function."""

    def test_download_invalid_url(self):
        """Test downloading from invalid URL."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / "test.txt"
            result = download_file("http://invalid.invalid/file.txt", dest)
            self.assertFalse(result)


class TestDefaults(TestCase):
    """Tests for default values."""

    def test_default_version(self):
        """Test default Alpine version."""
        self.assertEqual(DEFAULT_ALPINE_VERSION, "3.20")

    def test_default_arch(self):
        """Test default architecture."""
        self.assertEqual(DEFAULT_ALPINE_ARCH, "aarch64")


if __name__ == '__main__':
    import unittest
    unittest.main()
