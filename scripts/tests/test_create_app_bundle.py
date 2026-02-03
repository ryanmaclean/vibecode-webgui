#!/usr/bin/env python3
"""Tests for create_app_bundle module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from create_app_bundle import (
    APP_BUNDLE_NAME,
    BINARY_NAME,
    VM_IMAGES,
    copy_binary,
    copy_entitlements,
    copy_info_plist,
    create_bundle_structure,
    get_vibecode_dir,
    symlink_vm_images,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_app_bundle_name(self):
        """Test app bundle name is defined correctly."""
        self.assertEqual(APP_BUNDLE_NAME, "VibeCode.app")

    def test_binary_name(self):
        """Test binary name is defined."""
        self.assertEqual(BINARY_NAME, "VibeCode")

    def test_vm_images(self):
        """Test VM images list is defined."""
        self.assertIn("vibecode-postgresql.img", VM_IMAGES)
        self.assertIn("vibecode-postgresql-efi.nvram", VM_IMAGES)


class TestGetVibecodeDir(TestCase):
    """Tests for get_vibecode_dir function."""

    def test_returns_path(self):
        """Test function returns a Path object."""
        result = get_vibecode_dir()
        self.assertIsInstance(result, Path)

    def test_path_ends_with_vibecodewift(self):
        """Test path ends with VibeCodeSwift."""
        result = get_vibecode_dir()
        self.assertEqual(result.name, "VibeCodeSwift")


class TestCreateBundleStructure(TestCase):
    """Tests for create_bundle_structure function."""

    def test_creates_directories(self):
        """Test that bundle directories are created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            app_bundle = Path(tmpdir) / "VibeCode.app"

            result = create_bundle_structure(app_bundle)

            self.assertTrue(result)
            self.assertTrue((app_bundle / "Contents" / "MacOS").exists())
            self.assertTrue((app_bundle / "Contents" / "Resources" / "vms").exists())

    def test_idempotent(self):
        """Test that function can be called multiple times."""
        with tempfile.TemporaryDirectory() as tmpdir:
            app_bundle = Path(tmpdir) / "VibeCode.app"

            result1 = create_bundle_structure(app_bundle)
            result2 = create_bundle_structure(app_bundle)

            self.assertTrue(result1)
            self.assertTrue(result2)


class TestCopyBinary(TestCase):
    """Tests for copy_binary function."""

    def test_copies_binary(self):
        """Test that binary is copied correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            # Create source binary
            source_dir = vibecode_dir / ".build" / "release"
            source_dir.mkdir(parents=True)
            source_binary = source_dir / BINARY_NAME
            source_binary.write_text("binary content")

            # Create bundle structure
            create_bundle_structure(app_bundle)

            result = copy_binary(vibecode_dir, app_bundle)

            self.assertTrue(result)
            dest_binary = app_bundle / "Contents" / "MacOS" / BINARY_NAME
            self.assertTrue(dest_binary.exists())
            self.assertEqual(dest_binary.read_text(), "binary content")

    def test_sets_executable_permission(self):
        """Test that binary is made executable."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            # Create source binary
            source_dir = vibecode_dir / ".build" / "release"
            source_dir.mkdir(parents=True)
            source_binary = source_dir / BINARY_NAME
            source_binary.write_text("binary content")

            # Create bundle structure
            create_bundle_structure(app_bundle)

            copy_binary(vibecode_dir, app_bundle)

            dest_binary = app_bundle / "Contents" / "MacOS" / BINARY_NAME
            # Check executable bit
            self.assertTrue(dest_binary.stat().st_mode & 0o111)

    def test_missing_binary_returns_false(self):
        """Test that missing binary returns False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            vibecode_dir.mkdir(parents=True)
            create_bundle_structure(app_bundle)

            result = copy_binary(vibecode_dir, app_bundle)

            self.assertFalse(result)


class TestCopyInfoPlist(TestCase):
    """Tests for copy_info_plist function."""

    def test_copies_info_plist(self):
        """Test that Info.plist is copied correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            # Create source file
            vibecode_dir.mkdir(parents=True)
            (vibecode_dir / "Info.plist").write_text("<plist>test</plist>")

            # Create bundle structure
            create_bundle_structure(app_bundle)

            result = copy_info_plist(vibecode_dir, app_bundle)

            self.assertTrue(result)
            dest = app_bundle / "Contents" / "Info.plist"
            self.assertTrue(dest.exists())
            self.assertEqual(dest.read_text(), "<plist>test</plist>")

    def test_missing_info_plist_returns_false(self):
        """Test that missing Info.plist returns False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            vibecode_dir.mkdir(parents=True)
            create_bundle_structure(app_bundle)

            result = copy_info_plist(vibecode_dir, app_bundle)

            self.assertFalse(result)


class TestCopyEntitlements(TestCase):
    """Tests for copy_entitlements function."""

    def test_copies_entitlements(self):
        """Test that entitlements are copied correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            # Create source file
            vibecode_dir.mkdir(parents=True)
            (vibecode_dir / "VibeCode.entitlements").write_text("<plist>ent</plist>")

            # Create bundle structure
            create_bundle_structure(app_bundle)

            result = copy_entitlements(vibecode_dir, app_bundle)

            self.assertTrue(result)
            dest = app_bundle / "Contents" / "VibeCode.entitlements"
            self.assertTrue(dest.exists())

    def test_missing_entitlements_returns_false(self):
        """Test that missing entitlements returns False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            vibecode_dir.mkdir(parents=True)
            create_bundle_structure(app_bundle)

            result = copy_entitlements(vibecode_dir, app_bundle)

            self.assertFalse(result)


class TestSymlinkVmImages(TestCase):
    """Tests for symlink_vm_images function."""

    def test_creates_symlinks(self):
        """Test that symlinks are created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            vibecode_dir.mkdir(parents=True)
            create_bundle_structure(app_bundle)

            result = symlink_vm_images(vibecode_dir, app_bundle)

            self.assertTrue(result)

            vms_dir = app_bundle / "Contents" / "Resources" / "vms"
            for image_name in VM_IMAGES:
                link = vms_dir / image_name
                self.assertTrue(link.is_symlink())

    def test_replaces_existing_symlinks(self):
        """Test that existing symlinks are replaced."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            app_bundle = Path(tmpdir) / "VibeCode.app"

            vibecode_dir.mkdir(parents=True)
            create_bundle_structure(app_bundle)

            # Create initial symlinks
            symlink_vm_images(vibecode_dir, app_bundle)

            # Call again - should not fail
            result = symlink_vm_images(vibecode_dir, app_bundle)

            self.assertTrue(result)


class TestMain(TestCase):
    """Tests for main function."""

    def test_missing_vibecode_dir_returns_error(self):
        """Test that missing directory returns error."""
        from create_app_bundle import main

        result = main(vibecode_dir=Path("/nonexistent/path"))

        self.assertEqual(result, 1)

    def test_successful_bundle_creation(self):
        """Test successful bundle creation."""
        from create_app_bundle import main

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            output_dir = Path(tmpdir) / "output"

            # Create required files
            vibecode_dir.mkdir(parents=True)
            (vibecode_dir / ".build" / "release").mkdir(parents=True)
            (vibecode_dir / ".build" / "release" / BINARY_NAME).write_text("bin")
            (vibecode_dir / "Info.plist").write_text("<plist/>")
            (vibecode_dir / "VibeCode.entitlements").write_text("<plist/>")

            result = main(vibecode_dir=vibecode_dir, output_dir=output_dir)

            self.assertEqual(result, 0)
            self.assertTrue((output_dir / APP_BUNDLE_NAME).exists())

    def test_missing_binary_returns_error(self):
        """Test that missing binary returns error."""
        from create_app_bundle import main

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir) / "VibeCodeSwift"
            output_dir = Path(tmpdir) / "output"

            vibecode_dir.mkdir(parents=True)

            result = main(vibecode_dir=vibecode_dir, output_dir=output_dir)

            self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
