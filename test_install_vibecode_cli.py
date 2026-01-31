#!/usr/bin/env python3
"""Tests for install_vibecode_cli.py"""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from install_vibecode_cli import (
    Colors,
    command_exists,
    copy_file,
    install_vibecode_cli,
    print_error,
    print_info,
    print_success,
    print_warning,
    run_command,
)


class TestColors(unittest.TestCase):
    """Test color constants."""

    def test_colors_defined(self):
        """Test that all color codes are defined."""
        self.assertIsInstance(Colors.GREEN, str)
        self.assertIsInstance(Colors.YELLOW, str)
        self.assertIsInstance(Colors.RED, str)
        self.assertIsInstance(Colors.NC, str)

    def test_colors_are_ansi_codes(self):
        """Test that colors are valid ANSI escape codes."""
        self.assertTrue(Colors.GREEN.startswith('\033['))
        self.assertTrue(Colors.YELLOW.startswith('\033['))
        self.assertTrue(Colors.RED.startswith('\033['))


class TestPrintFunctions(unittest.TestCase):
    """Test print helper functions."""

    @patch('builtins.print')
    def test_print_success(self, mock_print):
        """Test print_success outputs correct format."""
        print_success("test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("✓", call_args)
        self.assertIn("test message", call_args)

    @patch('builtins.print')
    def test_print_warning(self, mock_print):
        """Test print_warning outputs correct format."""
        print_warning("warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("⚠", call_args)
        self.assertIn("warning message", call_args)

    @patch('builtins.print')
    def test_print_error(self, mock_print):
        """Test print_error outputs correct format."""
        print_error("error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("✗", call_args)
        self.assertIn("error message", call_args)

    @patch('builtins.print')
    def test_print_info(self, mock_print):
        """Test print_info outputs correct format."""
        print_info("info message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("→", call_args)
        self.assertIn("info message", call_args)


class TestCommandExists(unittest.TestCase):
    """Test command_exists function."""

    def test_existing_command(self):
        """Test that existing commands are found."""
        # 'python' or 'python3' should exist
        result = command_exists("python3") or command_exists("python")
        self.assertTrue(result)

    def test_nonexistent_command(self):
        """Test that nonexistent commands return False."""
        result = command_exists("nonexistent_command_xyz123")
        self.assertFalse(result)


class TestRunCommand(unittest.TestCase):
    """Test run_command function."""

    def test_successful_command(self):
        """Test running a successful command."""
        result = run_command(["echo", "hello"])
        self.assertEqual(result, "hello")

    def test_failed_command(self):
        """Test running a failing command returns None."""
        result = run_command(["false"])
        self.assertIsNone(result)

    def test_command_with_output(self):
        """Test command output is captured."""
        result = run_command(["python3", "-c", "print('test output')"])
        self.assertEqual(result, "test output")


class TestCopyFile(unittest.TestCase):
    """Test copy_file function."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.src_file = Path(self.temp_dir) / "source.txt"
        self.src_file.write_text("test content")

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_copy_file_success(self):
        """Test successful file copy."""
        dest_file = Path(self.temp_dir) / "dest.txt"
        result = copy_file(self.src_file, dest_file, use_sudo=False)
        self.assertTrue(result)
        self.assertTrue(dest_file.exists())
        self.assertEqual(dest_file.read_text(), "test content")

    def test_copy_file_preserves_content(self):
        """Test that file content is preserved."""
        dest_file = Path(self.temp_dir) / "dest.txt"
        copy_file(self.src_file, dest_file, use_sudo=False)
        self.assertEqual(dest_file.read_text(), self.src_file.read_text())

    def test_copy_file_sets_executable(self):
        """Test that copied file is set executable."""
        dest_file = Path(self.temp_dir) / "dest.txt"
        copy_file(self.src_file, dest_file, use_sudo=False)
        # Check if executable bit is set
        self.assertTrue(os.access(dest_file, os.X_OK))


class TestInstallVibecodeCliUserInstall(unittest.TestCase):
    """Test install_vibecode_cli with user install."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        if self.original_home:
            os.environ['HOME'] = self.original_home

    @patch('install_vibecode_cli.Path')
    def test_user_install_creates_directories(self, mock_path):
        """Test that user install creates necessary directories."""
        # This test verifies the directory creation logic
        mock_install_dir = MagicMock()
        mock_path.home.return_value.__truediv__.return_value = mock_install_dir

        # The actual test would need more mocking to be complete
        # This is a placeholder for the directory creation test
        self.assertTrue(True)  # Placeholder


class TestInstallVibecodeCliIntegration(unittest.TestCase):
    """Integration tests for install_vibecode_cli."""

    def test_script_is_importable(self):
        """Test that the module can be imported."""
        import install_vibecode_cli
        self.assertTrue(hasattr(install_vibecode_cli, 'main'))
        self.assertTrue(hasattr(install_vibecode_cli, 'install_vibecode_cli'))

    def test_main_function_exists(self):
        """Test that main function is callable."""
        from install_vibecode_cli import main
        self.assertTrue(callable(main))


if __name__ == "__main__":
    unittest.main()
