#!/usr/bin/env python3
"""Tests for security updates script."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.updates import (
    Color,
    UpdateConfig,
    PatchInfo,
    SecurityUpdater,
    parse_args,
)


class TestColor(unittest.TestCase):
    """Tests for Color class."""

    def test_color_codes_defined(self):
        """Test that all color codes are defined."""
        self.assertIsNotNone(Color.RED)
        self.assertIsNotNone(Color.GREEN)
        self.assertIsNotNone(Color.YELLOW)
        self.assertIsNotNone(Color.BLUE)
        self.assertIsNotNone(Color.NC)


class TestUpdateConfig(unittest.TestCase):
    """Tests for UpdateConfig dataclass."""

    def test_default_values(self):
        """Test default values."""
        config = UpdateConfig()
        self.assertFalse(config.skip_tests)
        self.assertFalse(config.force_update)
        self.assertFalse(config.dry_run)
        self.assertFalse(config.verbose)
        self.assertFalse(config.preact_only)
        self.assertFalse(config.mcp_only)
        self.assertFalse(config.langchain_only)

    def test_custom_values(self):
        """Test setting custom values."""
        config = UpdateConfig(
            skip_tests=True,
            dry_run=True,
            preact_only=True,
        )
        self.assertTrue(config.skip_tests)
        self.assertTrue(config.dry_run)
        self.assertTrue(config.preact_only)


class TestPatchInfo(unittest.TestCase):
    """Tests for PatchInfo dataclass."""

    def test_required_fields(self):
        """Test creating PatchInfo with all fields."""
        patch = PatchInfo(
            name="preact",
            old_version="10.27.2",
            new_version="10.28.2",
            vulnerability="GHSA-36hm-qxxp-pg3m",
            risk_level="medium",
        )
        self.assertEqual(patch.name, "preact")
        self.assertEqual(patch.old_version, "10.27.2")
        self.assertEqual(patch.new_version, "10.28.2")
        self.assertEqual(patch.vulnerability, "GHSA-36hm-qxxp-pg3m")
        self.assertEqual(patch.risk_level, "medium")


class TestSecurityUpdater(unittest.TestCase):
    """Tests for SecurityUpdater class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = UpdateConfig(dry_run=True)
        self.updater = SecurityUpdater(self.config)

    def test_initialization(self):
        """Test updater initialization."""
        self.assertTrue(self.updater.config.dry_run)
        self.assertIsNotNone(self.updater.script_dir)
        self.assertIsNotNone(self.updater.timestamp)

    @patch('builtins.print')
    def test_print_info(self, mock_print):
        """Test print_info method."""
        self.updater.print_info("Test message")
        mock_print.assert_called()

    @patch('builtins.print')
    def test_print_success(self, mock_print):
        """Test print_success method."""
        self.updater.print_success("Success message")
        mock_print.assert_called()

    @patch('builtins.print')
    def test_print_warning(self, mock_print):
        """Test print_warning method."""
        self.updater.print_warning("Warning message")
        mock_print.assert_called()

    @patch('builtins.print')
    def test_print_error(self, mock_print):
        """Test print_error method."""
        self.updater.print_error("Error message")
        mock_print.assert_called()

    @patch('subprocess.run')
    @patch('builtins.print')
    def test_run_cmd_dry_run(self, mock_print, mock_run):
        """Test run_cmd in dry run mode."""
        result = self.updater.run_cmd(['npm', 'install'], 'Installing')
        self.assertTrue(result)
        mock_run.assert_not_called()

    @patch('subprocess.run')
    @patch('builtins.print')
    def test_run_cmd_success(self, mock_print, mock_run):
        """Test run_cmd with successful command."""
        self.updater.config.dry_run = False
        mock_run.return_value = MagicMock(returncode=0)
        result = self.updater.run_cmd(['echo', 'test'], 'Testing')
        self.assertTrue(result)

    @patch('subprocess.run')
    @patch('builtins.print')
    def test_run_cmd_failure(self, mock_print, mock_run):
        """Test run_cmd with failed command."""
        self.updater.config.dry_run = False
        mock_run.return_value = MagicMock(returncode=1, stderr="Error")
        result = self.updater.run_cmd(['false'], 'Failing')
        self.assertFalse(result)


class TestParseArgs(unittest.TestCase):
    """Tests for parse_args function."""

    @patch('sys.argv', ['updates.py'])
    def test_default_args(self):
        """Test parsing with default arguments."""
        config = parse_args()
        self.assertFalse(config.dry_run)
        self.assertFalse(config.skip_tests)
        self.assertFalse(config.force_update)

    @patch('sys.argv', ['updates.py', '--dry-run'])
    def test_dry_run_flag(self):
        """Test parsing with --dry-run flag."""
        config = parse_args()
        self.assertTrue(config.dry_run)

    @patch('sys.argv', ['updates.py', '--skip-tests', '--force'])
    def test_multiple_flags(self):
        """Test parsing with multiple flags."""
        config = parse_args()
        self.assertTrue(config.skip_tests)
        self.assertTrue(config.force_update)

    @patch('sys.argv', ['updates.py', '--preact-only'])
    def test_preact_only_flag(self):
        """Test parsing with --preact-only flag."""
        config = parse_args()
        self.assertTrue(config.preact_only)


if __name__ == '__main__':
    unittest.main()
