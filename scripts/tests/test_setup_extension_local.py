#!/usr/bin/env python3
"""Tests for setup_extension_local module."""

import stat
import sys
import tempfile
from pathlib import Path
from unittest import TestCase

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from setup_extension_local import (
    EXTENSION_ID,
    EXTENSION_NAME,
    EXTENSION_VERSION,
    EXTENSIONS_JSON,
    TEST_SCRIPT_CONTENT,
    copy_extension,
    create_extensions_json,
    create_test_script,
    get_project_root,
    get_vsix_filename,
    setup_extensions_directory,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_extension_name(self):
        """Test extension name is defined correctly."""
        self.assertEqual(EXTENSION_NAME, "vibecode-ai-assistant")

    def test_extension_version(self):
        """Test extension version is defined."""
        self.assertEqual(EXTENSION_VERSION, "1.0.0")

    def test_extension_id(self):
        """Test extension ID is defined."""
        self.assertEqual(EXTENSION_ID, "vibecode.vibecode-ai-assistant")

    def test_extensions_json_has_recommendations(self):
        """Test extensions JSON has recommendations."""
        self.assertIn("recommendations", EXTENSIONS_JSON)
        self.assertIn(EXTENSION_ID, EXTENSIONS_JSON)

    def test_test_script_has_code_server(self):
        """Test script content has code-server command."""
        self.assertIn("code-server", TEST_SCRIPT_CONTENT)
        self.assertIn("--bind-addr", TEST_SCRIPT_CONTENT)


class TestGetProjectRoot(TestCase):
    """Tests for get_project_root function."""

    def test_returns_path(self):
        """Test function returns a Path object."""
        result = get_project_root()
        self.assertIsInstance(result, Path)

    def test_path_is_parent_of_scripts(self):
        """Test path is parent of scripts directory."""
        result = get_project_root()
        scripts_dir = result / "scripts"
        self.assertTrue(scripts_dir.exists())


class TestGetVsixFilename(TestCase):
    """Tests for get_vsix_filename function."""

    def test_returns_correct_filename(self):
        """Test correct VSIX filename is returned."""
        result = get_vsix_filename()
        self.assertEqual(result, "vibecode-ai-assistant-1.0.0.vsix")

    def test_includes_version(self):
        """Test filename includes version."""
        result = get_vsix_filename()
        self.assertIn(EXTENSION_VERSION, result)


class TestSetupExtensionsDirectory(TestCase):
    """Tests for setup_extensions_directory function."""

    def test_creates_directory(self):
        """Test that extensions directory is created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            result = setup_extensions_directory(project_root)

            self.assertTrue(result.exists())
            self.assertTrue(result.is_dir())
            self.assertEqual(result, project_root / ".vscode" / "extensions")

    def test_creates_parent_directories(self):
        """Test that parent directories are created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            setup_extensions_directory(project_root)

            self.assertTrue((project_root / ".vscode").exists())

    def test_idempotent(self):
        """Test that function can be called multiple times."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            result1 = setup_extensions_directory(project_root)
            result2 = setup_extensions_directory(project_root)

            self.assertEqual(result1, result2)
            self.assertTrue(result2.exists())


class TestCopyExtension(TestCase):
    """Tests for copy_extension function."""

    def test_copies_extension(self):
        """Test that extension is copied correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            # Create source extension
            vsix_filename = get_vsix_filename()
            source_dir = project_root / "extensions" / EXTENSION_NAME
            source_dir.mkdir(parents=True)
            source_file = source_dir / vsix_filename
            source_file.write_text("vsix content")

            # Create extensions directory
            extensions_dir = setup_extensions_directory(project_root)

            result = copy_extension(project_root, extensions_dir)

            self.assertTrue(result)
            dest_file = extensions_dir / vsix_filename
            self.assertTrue(dest_file.exists())
            self.assertEqual(dest_file.read_text(), "vsix content")

    def test_missing_extension_returns_false(self):
        """Test that missing extension returns False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            extensions_dir = setup_extensions_directory(project_root)

            result = copy_extension(project_root, extensions_dir)

            self.assertFalse(result)


class TestCreateExtensionsJson(TestCase):
    """Tests for create_extensions_json function."""

    def test_creates_file(self):
        """Test that extensions.json is created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            (project_root / ".vscode").mkdir(parents=True)

            result = create_extensions_json(project_root)

            self.assertTrue(result)
            extensions_json = project_root / ".vscode" / "extensions.json"
            self.assertTrue(extensions_json.exists())

    def test_file_content(self):
        """Test that file content is correct."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            (project_root / ".vscode").mkdir(parents=True)

            create_extensions_json(project_root)

            extensions_json = project_root / ".vscode" / "extensions.json"
            content = extensions_json.read_text()
            self.assertIn("recommendations", content)
            self.assertIn(EXTENSION_ID, content)

    def test_overwrites_existing(self):
        """Test that existing file is overwritten."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            vscode_dir = project_root / ".vscode"
            vscode_dir.mkdir(parents=True)

            # Create existing file
            extensions_json = vscode_dir / "extensions.json"
            extensions_json.write_text("old content")

            result = create_extensions_json(project_root)

            self.assertTrue(result)
            self.assertIn(EXTENSION_ID, extensions_json.read_text())


class TestCreateTestScript(TestCase):
    """Tests for create_test_script function."""

    def test_creates_script(self):
        """Test that test script is created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            result = create_test_script(project_root)

            self.assertTrue(result)
            script_path = project_root / "scripts" / "test-extension.sh"
            self.assertTrue(script_path.exists())

    def test_script_is_executable(self):
        """Test that script is executable."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            create_test_script(project_root)

            script_path = project_root / "scripts" / "test-extension.sh"
            mode = script_path.stat().st_mode
            self.assertTrue(mode & stat.S_IXUSR)

    def test_script_content(self):
        """Test that script content is correct."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            create_test_script(project_root)

            script_path = project_root / "scripts" / "test-extension.sh"
            content = script_path.read_text()
            self.assertIn("code-server", content)
            self.assertIn("--bind-addr", content)
            self.assertIn("8080", content)

    def test_creates_scripts_directory(self):
        """Test that scripts directory is created if missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            create_test_script(project_root)

            self.assertTrue((project_root / "scripts").exists())


class TestMain(TestCase):
    """Tests for main function."""

    def test_successful_setup(self):
        """Test successful setup."""
        from setup_extension_local import main

        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            result = main(project_root)

            self.assertEqual(result, 0)
            self.assertTrue((project_root / ".vscode" / "extensions").exists())
            self.assertTrue((project_root / ".vscode" / "extensions.json").exists())
            self.assertTrue((project_root / "scripts" / "test-extension.sh").exists())

    def test_setup_with_extension(self):
        """Test setup with extension file present."""
        from setup_extension_local import main

        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            # Create source extension
            vsix_filename = get_vsix_filename()
            source_dir = project_root / "extensions" / EXTENSION_NAME
            source_dir.mkdir(parents=True)
            (source_dir / vsix_filename).write_text("vsix")

            result = main(project_root)

            self.assertEqual(result, 0)
            dest = project_root / ".vscode" / "extensions" / vsix_filename
            self.assertTrue(dest.exists())


if __name__ == '__main__':
    import unittest
    unittest.main()
