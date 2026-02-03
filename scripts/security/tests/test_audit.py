#!/usr/bin/env python3

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

"""Tests for security audit script."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.audit import (
    Color,
    AuditResult,
    print_status,
    check_exposed_secrets,
    check_file_permissions,
    check_gitignore_coverage,
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


class TestAuditResult(unittest.TestCase):
    """Tests for AuditResult dataclass."""

    def test_default_values(self):
        """Test default values."""
        result = AuditResult()
        self.assertEqual(result.issues_found, 0)
        self.assertEqual(result.warnings_found, 0)

    def test_custom_values(self):
        """Test setting custom values."""
        result = AuditResult(issues_found=5, warnings_found=3)
        self.assertEqual(result.issues_found, 5)
        self.assertEqual(result.warnings_found, 3)


class TestPrintStatus(unittest.TestCase):
    """Tests for print_status function."""

    @patch('builtins.print')
    def test_success_status(self, mock_print):
        """Test printing success status."""
        print_status("success", "Test passed")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Test passed", call_args)

    @patch('builtins.print')
    def test_warning_status(self, mock_print):
        """Test printing warning status."""
        print_status("warning", "Warning message")
        mock_print.assert_called_once()

    @patch('builtins.print')
    def test_error_status(self, mock_print):
        """Test printing error status."""
        print_status("error", "Error message")
        mock_print.assert_called_once()


class TestCheckExposedSecrets(unittest.TestCase):
    """Tests for check_exposed_secrets function."""

    @patch('os.walk')
    def test_no_secrets_found(self, mock_walk):
        """Test when no secrets are found."""
        mock_walk.return_value = []
        issues, warnings = check_exposed_secrets()
        self.assertEqual(issues, 0)

    @patch('os.walk')
    def test_excludes_node_modules(self, mock_walk):
        """Test that node_modules is excluded from scanning."""
        mock_walk.return_value = [
            ('.', ['node_modules', 'src'], []),
            ('./src', [], ['index.js']),
        ]
        with patch('pathlib.Path.read_text', return_value='console.log("hello")'):
            issues, warnings = check_exposed_secrets()
        # node_modules should be excluded
        self.assertEqual(issues, 0)


class TestCheckFilePermissions(unittest.TestCase):
    """Tests for check_file_permissions function."""

    @patch('os.walk')
    def test_no_sensitive_files(self, mock_walk):
        """Test when no sensitive files exist."""
        mock_walk.return_value = [('.', [], ['readme.md'])]
        issues, warnings = check_file_permissions()
        self.assertEqual(issues, 0)
        self.assertEqual(warnings, 0)


class TestCheckGitignoreCoverage(unittest.TestCase):
    """Tests for check_gitignore_coverage function."""

    def test_missing_gitignore(self):
        """Test when .gitignore doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('pathlib.Path.exists', return_value=False):
                issues, warnings = check_gitignore_coverage()
                self.assertEqual(warnings, 1)

    def test_gitignore_with_all_patterns(self):
        """Test when .gitignore has all required patterns."""
        gitignore_content = ".env\n.env.local\n*.key\n*.pem\nsecrets/\n.datadog/\n"
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.read_text', return_value=gitignore_content):
                issues, warnings = check_gitignore_coverage()
                self.assertEqual(warnings, 0)


if __name__ == '__main__':
    unittest.main()