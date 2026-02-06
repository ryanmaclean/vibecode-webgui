#!/usr/bin/env python3
"""Tests for upgrade_to_alpine module."""

import gzip
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "vfkit"))

from vfkit.upgrade_to_alpine import (
    GZIP_MAGIC,
    AlpineVersion,
    backup_current_kernel,
    extract_gzip_payload,
    find_extractor,
    get_vm_dir,
    replace_kernel,
)


class TestAlpineVersion(TestCase):
    """Tests for AlpineVersion dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        alpine = AlpineVersion()
        self.assertEqual(alpine.version, "3.22")
        self.assertEqual(alpine.release, "3.22.2")
        self.assertEqual(alpine.arch, "aarch64")
        self.assertEqual(alpine.kernel_version, "6.12 LTS")

    def test_custom_values(self):
        """Test custom configuration values."""
        alpine = AlpineVersion(
            version="3.21",
            release="3.21.0",
            arch="x86_64"
        )
        self.assertEqual(alpine.version, "3.21")
        self.assertEqual(alpine.release, "3.21.0")
        self.assertEqual(alpine.arch, "x86_64")

    def test_iso_name(self):
        """Test ISO name property."""
        alpine = AlpineVersion()
        self.assertEqual(alpine.iso_name, "alpine-virt-3.22.2-aarch64.iso")

    def test_base_url(self):
        """Test base URL property."""
        alpine = AlpineVersion()
        expected = "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64"
        self.assertEqual(alpine.base_url, expected)

    def test_iso_url(self):
        """Test full ISO URL property."""
        alpine = AlpineVersion()
        self.assertIn("alpine-virt-3.22.2-aarch64.iso", alpine.iso_url)
        self.assertIn("dl-cdn.alpinelinux.org", alpine.iso_url)


class TestGetVmDir(TestCase):
    """Tests for get_vm_dir function."""

    def test_returns_path(self):
        """Test returns Path object."""
        result = get_vm_dir()
        self.assertIsInstance(result, Path)

    def test_path_structure(self):
        """Test path has correct structure."""
        result = get_vm_dir()
        self.assertTrue(str(result).endswith("vibecode-alpine"))
        self.assertIn(".vfkit", str(result))


class TestGzipMagic(TestCase):
    """Tests for GZIP_MAGIC constant."""

    def test_gzip_magic_bytes(self):
        """Test gzip magic bytes are correct."""
        self.assertEqual(GZIP_MAGIC, b'\x1f\x8b')


class TestExtractGzipPayload(TestCase):
    """Tests for extract_gzip_payload function."""

    def test_finds_gzip_payload(self):
        """Test finding gzip payload in data."""
        # Create test data with gzip magic
        prefix = b'some random data before gzip'
        gzip_data = gzip.compress(b'test content')
        data = prefix + gzip_data

        result = extract_gzip_payload(data)

        self.assertIsNotNone(result)
        self.assertTrue(result.startswith(GZIP_MAGIC))

    def test_returns_none_for_no_gzip(self):
        """Test returns None when no gzip found."""
        data = b'plain data without gzip magic'

        result = extract_gzip_payload(data)

        self.assertIsNone(result)

    def test_extracts_from_offset(self):
        """Test extracts data from correct offset."""
        prefix = b'X' * 100
        payload = GZIP_MAGIC + b'rest of gzip data'
        data = prefix + payload

        result = extract_gzip_payload(data)

        self.assertEqual(result, payload)


class TestBackupCurrentKernel(TestCase):
    """Tests for backup_current_kernel function."""

    def test_no_kernel_to_backup(self):
        """Test when no kernel exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            kernel_dir = Path(tmpdir) / "kernel"
            kernel_dir.mkdir()

            result = backup_current_kernel(kernel_dir)

            self.assertTrue(result)

    def test_creates_backup(self):
        """Test backup is created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            kernel_dir = Path(tmpdir) / "kernel"
            kernel_dir.mkdir()

            # Create kernel files
            (kernel_dir / "vmlinux").write_text("kernel")
            (kernel_dir / "vmlinuz").write_text("compressed")
            (kernel_dir / "initramfs").write_text("initramfs")

            result = backup_current_kernel(kernel_dir)

            self.assertTrue(result)
            backup_dir = kernel_dir / "backup-3.19"
            self.assertTrue(backup_dir.exists())
            self.assertTrue((backup_dir / "vmlinux").exists())

    def test_custom_backup_name(self):
        """Test custom backup directory name."""
        with tempfile.TemporaryDirectory() as tmpdir:
            kernel_dir = Path(tmpdir) / "kernel"
            kernel_dir.mkdir()
            (kernel_dir / "vmlinux").write_text("kernel")

            backup_current_kernel(kernel_dir, backup_name="my-backup")

            self.assertTrue((kernel_dir / "my-backup").exists())


class TestFindExtractor(TestCase):
    """Tests for find_extractor function."""

    @mock.patch('vfkit.upgrade_to_alpine.shutil.which')
    def test_finds_bsdtar(self, mock_which):
        """Test finding bsdtar."""
        mock_which.side_effect = lambda x: "/usr/bin/bsdtar" if x == "bsdtar" else None

        result = find_extractor()

        self.assertEqual(result, "bsdtar")

    @mock.patch('vfkit.upgrade_to_alpine.shutil.which')
    def test_finds_7z(self, mock_which):
        """Test finding 7z when bsdtar not available."""
        mock_which.side_effect = lambda x: "/usr/bin/7z" if x == "7z" else None

        result = find_extractor()

        self.assertEqual(result, "7z")

    @mock.patch('vfkit.upgrade_to_alpine.shutil.which')
    def test_prefers_bsdtar(self, mock_which):
        """Test bsdtar is preferred over 7z."""
        mock_which.return_value = "/usr/bin/tool"

        result = find_extractor()

        self.assertEqual(result, "bsdtar")

    @mock.patch('vfkit.upgrade_to_alpine.shutil.which')
    def test_returns_none_when_nothing_found(self, mock_which):
        """Test returns None when no extractor found."""
        mock_which.return_value = None

        result = find_extractor()

        self.assertIsNone(result)


class TestReplaceKernel(TestCase):
    """Tests for replace_kernel function."""

    def test_creates_symlinks(self):
        """Test symlinks are created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            kernel_dir = Path(tmpdir) / "kernel"
            kernel_dir.mkdir()

            alpine = AlpineVersion(version="3.22")

            # Create new kernel files
            (kernel_dir / "vmlinux-3.22").write_text("kernel")
            (kernel_dir / "vmlinuz-3.22").write_text("compressed")
            (kernel_dir / "initramfs-3.22").write_text("initramfs")

            result = replace_kernel(kernel_dir, alpine)

            self.assertTrue(result)
            self.assertTrue((kernel_dir / "vmlinux").is_symlink())
            self.assertTrue((kernel_dir / "vmlinuz").is_symlink())
            self.assertTrue((kernel_dir / "initramfs").is_symlink())

    def test_removes_old_symlinks(self):
        """Test old symlinks are removed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            kernel_dir = Path(tmpdir) / "kernel"
            kernel_dir.mkdir()

            alpine = AlpineVersion(version="3.22")

            # Create old symlinks
            (kernel_dir / "old-kernel").write_text("old")
            (kernel_dir / "vmlinux").symlink_to("old-kernel")

            # Create new kernel files
            (kernel_dir / "vmlinux-3.22").write_text("kernel")
            (kernel_dir / "vmlinuz-3.22").write_text("compressed")
            (kernel_dir / "initramfs-3.22").write_text("initramfs")

            result = replace_kernel(kernel_dir, alpine)

            self.assertTrue(result)
            # Check symlink points to new file
            self.assertEqual(
                (kernel_dir / "vmlinux").resolve().name,
                "vmlinux-3.22"
            )

    def test_backs_up_regular_files(self):
        """Test regular files are backed up."""
        with tempfile.TemporaryDirectory() as tmpdir:
            kernel_dir = Path(tmpdir) / "kernel"
            kernel_dir.mkdir()

            alpine = AlpineVersion(version="3.22")

            # Create old regular files
            (kernel_dir / "vmlinux").write_text("old kernel")

            # Create new kernel files
            (kernel_dir / "vmlinux-3.22").write_text("kernel")
            (kernel_dir / "vmlinuz-3.22").write_text("compressed")
            (kernel_dir / "initramfs-3.22").write_text("initramfs")

            replace_kernel(kernel_dir, alpine)

            # Check backup was created
            self.assertTrue((kernel_dir / "vmlinux-backup-3.19").exists())


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('vfkit.upgrade_to_alpine.print_summary')
    @mock.patch('vfkit.upgrade_to_alpine.replace_kernel')
    @mock.patch('vfkit.upgrade_to_alpine.verify_kernel')
    @mock.patch('vfkit.upgrade_to_alpine.extract_uncompressed_kernel')
    @mock.patch('vfkit.upgrade_to_alpine.extract_from_iso')
    @mock.patch('vfkit.upgrade_to_alpine.download_iso')
    @mock.patch('vfkit.upgrade_to_alpine.backup_current_kernel')
    def test_main_success(
        self,
        mock_backup,
        mock_download,
        mock_extract_iso,
        mock_extract_kernel,
        mock_verify,
        mock_replace,
        mock_summary
    ):
        """Test successful main execution."""
        from vfkit.upgrade_to_alpine import main

        with tempfile.TemporaryDirectory() as tmpdir:
            mock_backup.return_value = True
            mock_download.return_value = Path(tmpdir) / "test.iso"
            mock_extract_iso.return_value = True
            mock_extract_kernel.return_value = True
            mock_verify.return_value = True
            mock_replace.return_value = True

            result = main()

            self.assertEqual(result, 0)

    @mock.patch('vfkit.upgrade_to_alpine.download_iso')
    @mock.patch('vfkit.upgrade_to_alpine.backup_current_kernel')
    def test_main_download_failure(self, mock_backup, mock_download):
        """Test main fails on download failure."""
        from vfkit.upgrade_to_alpine import main

        mock_backup.return_value = True
        mock_download.return_value = None

        result = main()

        self.assertEqual(result, 1)

    @mock.patch('vfkit.upgrade_to_alpine.extract_from_iso')
    @mock.patch('vfkit.upgrade_to_alpine.download_iso')
    @mock.patch('vfkit.upgrade_to_alpine.backup_current_kernel')
    def test_main_extraction_failure(
        self,
        mock_backup,
        mock_download,
        mock_extract
    ):
        """Test main fails on extraction failure."""
        from vfkit.upgrade_to_alpine import main

        with tempfile.TemporaryDirectory() as tmpdir:
            mock_backup.return_value = True
            mock_download.return_value = Path(tmpdir) / "test.iso"
            mock_extract.return_value = False

            result = main()

            self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
