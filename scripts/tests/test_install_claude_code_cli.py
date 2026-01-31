#!/usr/bin/env python3
"""Tests for install_claude_code_cli module."""

import os
import subprocess
import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from install_claude_code_cli import (
    Colors,
    InstallConfig,
    check_python_version_compatible,
    command_exists,
    get_claude_cli_content,
    get_config_content,
    get_python_version,
    get_uninstall_script_content,
    is_root,
    run_command,
    timestamp,
)


class TestColors(TestCase):
    """Tests for Colors class."""

    def test_color_constants(self):
        """Test that color constants are defined."""
        self.assertTrue(hasattr(Colors, 'RED'))
        self.assertTrue(hasattr(Colors, 'GREEN'))
        self.assertTrue(hasattr(Colors, 'YELLOW'))
        self.assertTrue(hasattr(Colors, 'BLUE'))
        self.assertTrue(hasattr(Colors, 'NC'))

    def test_color_values_are_ansi(self):
        """Test that color values are ANSI escape sequences."""
        self.assertTrue(Colors.RED.startswith('\033['))
        self.assertTrue(Colors.GREEN.startswith('\033['))
        self.assertTrue(Colors.YELLOW.startswith('\033['))
        self.assertTrue(Colors.BLUE.startswith('\033['))


class TestInstallConfig(TestCase):
    """Tests for InstallConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = InstallConfig()
        self.assertEqual(config.cli_version, "1.0.0")
        self.assertEqual(config.install_dir, Path("/opt/vibecode/ai-cli-tools/claude-code"))
        self.assertEqual(config.config_dir, Path("/etc/vibecode/claude-code"))
        self.assertEqual(config.log_file, Path("/var/log/vibecode/claude-code-cli-install.log"))


class TestTimestamp(TestCase):
    """Tests for timestamp function."""

    def test_timestamp_format(self):
        """Test that timestamp returns expected format."""
        ts = timestamp()
        # Format: YYYY-MM-DD HH:MM:SS
        self.assertEqual(len(ts), 19)
        self.assertEqual(ts[4], '-')
        self.assertEqual(ts[7], '-')
        self.assertEqual(ts[10], ' ')
        self.assertEqual(ts[13], ':')
        self.assertEqual(ts[16], ':')


class TestIsRoot(TestCase):
    """Tests for is_root function."""

    def test_is_root_returns_bool(self):
        """Test that is_root returns a boolean."""
        result = is_root()
        self.assertIsInstance(result, bool)

    @mock.patch('os.geteuid')
    def test_is_root_true(self, mock_geteuid):
        """Test is_root returns True when euid is 0."""
        mock_geteuid.return_value = 0
        self.assertTrue(is_root())

    @mock.patch('os.geteuid')
    def test_is_root_false(self, mock_geteuid):
        """Test is_root returns False when euid is not 0."""
        mock_geteuid.return_value = 1000
        self.assertFalse(is_root())


class TestCommandExists(TestCase):
    """Tests for command_exists function."""

    def test_command_exists_true(self):
        """Test command_exists returns True for existing command."""
        self.assertTrue(command_exists("python3") or command_exists("python"))

    def test_command_exists_false(self):
        """Test command_exists returns False for non-existing command."""
        self.assertFalse(command_exists("nonexistent_command_12345"))


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_run_command_success(self):
        """Test run_command with successful command."""
        result = run_command(["echo", "hello"], check=False)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "hello")

    def test_run_command_failure(self):
        """Test run_command with failing command."""
        result = run_command(["false"], check=False)
        self.assertNotEqual(result.returncode, 0)


class TestGetPythonVersion(TestCase):
    """Tests for get_python_version function."""

    def test_get_python_version(self):
        """Test get_python_version returns a version string."""
        version = get_python_version()
        self.assertIsNotNone(version)
        # Version should start with a digit
        self.assertTrue(version[0].isdigit())

    @mock.patch('install_claude_code_cli.run_command')
    def test_get_python_version_error(self, mock_run):
        """Test get_python_version returns None on error."""
        mock_run.side_effect = Exception("Command failed")
        version = get_python_version()
        self.assertIsNone(version)


class TestCheckPythonVersionCompatible(TestCase):
    """Tests for check_python_version_compatible function."""

    def test_current_version_compatible(self):
        """Test that current Python version is compatible."""
        # We're running on Python 3.8+, so this should be True
        if sys.version_info >= (3, 8):
            self.assertTrue(check_python_version_compatible())


class TestGetClaudeCliContent(TestCase):
    """Tests for get_claude_cli_content function."""

    def test_returns_valid_python(self):
        """Test that CLI content is valid Python."""
        content = get_claude_cli_content()
        # Should be valid Python code (no syntax errors)
        compile(content, '<string>', 'exec')

    def test_contains_shebang(self):
        """Test that CLI content has Python shebang."""
        content = get_claude_cli_content()
        self.assertTrue(content.startswith('#!/usr/bin/env python3'))

    def test_contains_main(self):
        """Test that CLI content has main function."""
        content = get_claude_cli_content()
        self.assertIn('def main()', content)

    def test_contains_claude_cli_class(self):
        """Test that CLI content has ClaudeCodeCLI class."""
        content = get_claude_cli_content()
        self.assertIn('class ClaudeCodeCLI', content)


class TestGetConfigContent(TestCase):
    """Tests for get_config_content function."""

    def test_returns_dict(self):
        """Test that config content is a dictionary."""
        config = get_config_content()
        self.assertIsInstance(config, dict)

    def test_has_required_keys(self):
        """Test that config has required keys."""
        config = get_config_content()
        self.assertIn('default_model', config)
        self.assertIn('available_models', config)
        self.assertIn('default_language', config)
        self.assertIn('supported_languages', config)
        self.assertIn('max_tokens', config)
        self.assertIn('temperature', config)

    def test_default_model(self):
        """Test default model value."""
        config = get_config_content()
        self.assertEqual(config['default_model'], 'claude-3-sonnet')

    def test_supported_languages(self):
        """Test supported languages list."""
        config = get_config_content()
        languages = config['supported_languages']
        self.assertIn('python', languages)
        self.assertIn('javascript', languages)
        self.assertIn('typescript', languages)


class TestGetUninstallScriptContent(TestCase):
    """Tests for get_uninstall_script_content function."""

    def test_returns_string(self):
        """Test that uninstall script is a string."""
        config = InstallConfig()
        content = get_uninstall_script_content(config)
        self.assertIsInstance(content, str)

    def test_contains_shebang(self):
        """Test that uninstall script has bash shebang."""
        config = InstallConfig()
        content = get_uninstall_script_content(config)
        self.assertTrue(content.startswith('#!/bin/bash'))

    def test_contains_install_dir(self):
        """Test that uninstall script contains install directory."""
        config = InstallConfig()
        content = get_uninstall_script_content(config)
        self.assertIn(str(config.install_dir), content)

    def test_contains_cleanup_commands(self):
        """Test that uninstall script contains cleanup commands."""
        config = InstallConfig()
        content = get_uninstall_script_content(config)
        self.assertIn('rm -f /usr/local/bin/claude-code', content)
        self.assertIn('pip3 uninstall', content)


if __name__ == '__main__':
    import unittest
    unittest.main()
