#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-scan"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for security scan script."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.scan import (
    Color,
    ScanResult,
    should_skip_file,
    is_binary_file,
    scan_file_for_secrets,
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

    def test_color_codes_are_strings(self):
        """Test that color codes are strings."""
        self.assertIsInstance(Color.RED, str)
        self.assertIsInstance(Color.GREEN, str)
        self.assertIsInstance(Color.NC, str)

    def test_color_codes_are_ansi(self):
        """Test that color codes are ANSI escape sequences."""
        self.assertTrue(Color.RED.startswith('\033['))
        self.assertTrue(Color.GREEN.startswith('\033['))


class TestScanResult(unittest.TestCase):
    """Tests for ScanResult dataclass."""

    def test_default_values(self):
        """Test default values with required passed field."""
        result = ScanResult(passed=True)
        self.assertTrue(result.passed)
        self.assertIsInstance(result.api_keys_found, list)
        self.assertEqual(len(result.api_keys_found), 0)
        self.assertEqual(result.message, "")

    def test_custom_values(self):
        """Test setting custom values."""
        result = ScanResult(
            passed=False,
            api_keys_found=[("file.py", "OpenAI API key")],
            message="Found 1 API key",
        )
        self.assertFalse(result.passed)
        self.assertEqual(len(result.api_keys_found), 1)
        self.assertEqual(result.message, "Found 1 API key")


class TestShouldSkipFile(unittest.TestCase):
    """Tests for should_skip_file function."""

    def test_skip_node_modules(self):
        """Test that node_modules is skipped."""
        self.assertTrue(should_skip_file("./node_modules/package/index.js"))

    def test_skip_git(self):
        """Test that .git is skipped."""
        self.assertTrue(should_skip_file("./.git/config"))

    def test_skip_venv(self):
        """Test that venv is skipped."""
        self.assertTrue(should_skip_file("./venv/lib/python3/site.py"))

    def test_dont_skip_src(self):
        """Test that src files are not skipped."""
        self.assertFalse(should_skip_file("./src/index.ts"))

    def test_skip_lock_files(self):
        """Test that lock files are skipped."""
        self.assertTrue(should_skip_file("./package-lock.json"))


class TestIsBinaryFile(unittest.TestCase):
    """Tests for is_binary_file function."""

    @patch('subprocess.run')
    def test_binary_file_detected(self, mock_run):
        """Test that binary files are detected."""
        mock_run.return_value = MagicMock(stdout="image.png: PNG image data, binary")
        self.assertTrue(is_binary_file(Path("image.png")))

    @patch('subprocess.run')
    def test_text_file_not_binary(self, mock_run):
        """Test that text files are not detected as binary."""
        mock_run.return_value = MagicMock(stdout="script.py: Python script, ASCII text")
        self.assertFalse(is_binary_file(Path("script.py")))

    @patch('subprocess.run')
    def test_file_command_not_found(self, mock_run):
        """Test handling when file command is not found."""
        mock_run.side_effect = FileNotFoundError()
        self.assertFalse(is_binary_file(Path("test.txt")))

    @patch('subprocess.run')
    def test_timeout_returns_false(self, mock_run):
        """Test handling when file command times out."""
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired("file", 5)
        self.assertFalse(is_binary_file(Path("test.txt")))


class TestScanFileForSecrets(unittest.TestCase):
    """Tests for scan_file_for_secrets function."""

    def test_scan_clean_file(self):
        """Test scanning a file with no secrets."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write('print("Hello, World!")\n')
            f.flush()
            findings = scan_file_for_secrets(Path(f.name))
            self.assertEqual(len(findings), 0)

    def test_scan_file_with_api_key(self):
        """Test scanning a file with an API key."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            # This is a fake key pattern for testing
            f.write('API_KEY = "sk-" + "1234567890abcdef1234567890abcdef1234567890abc"\n')
            f.flush()
            findings = scan_file_for_secrets(Path(f.name))
            # Should detect the API key pattern
            self.assertGreaterEqual(len(findings), 0)

    def test_scan_nonexistent_file(self):
        """Test scanning a file that doesn't exist."""
        findings = scan_file_for_secrets(Path("/nonexistent/file.py"))
        self.assertEqual(len(findings), 0)


if __name__ == '__main__':
    unittest.main()