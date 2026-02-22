#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-generate-claude-permissions"
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
try:
    from scripts.lib.log_aggregation import get_log_aggregation
except ImportError:
    get_log_aggregation = None


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation() if get_log_aggregation else None

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for Claude Code permission generation script."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.generate_claude_permissions import (
    Color,
    GenerationResult,
    generate_permissions,
    load_claude_settings,
    load_security_config,
    print_status,
    update_claude_settings,
    write_settings_file,
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


class TestGenerationResult(unittest.TestCase):
    """Tests for GenerationResult dataclass."""

    def test_successful_result(self):
        """Test creating successful GenerationResult."""
        result = GenerationResult(
            success=True,
            total_permissions=10,
            base_commands=5,
            stack_commands=5,
            permissions=["Bash(ls)", "Bash(pwd)"]
        )
        self.assertTrue(result.success)
        self.assertEqual(result.total_permissions, 10)
        self.assertEqual(result.base_commands, 5)
        self.assertEqual(result.stack_commands, 5)
        self.assertEqual(len(result.permissions), 2)
        self.assertIsNone(result.error)

    def test_failed_result(self):
        """Test creating failed GenerationResult."""
        result = GenerationResult(
            success=False,
            error="Test error message"
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error, "Test error message")
        self.assertEqual(result.total_permissions, 0)


class TestLoadSecurityConfig(unittest.TestCase):
    """Tests for load_security_config function."""

    def test_load_valid_config(self):
        """Test loading valid security configuration."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            config = {
                "base_commands": ["ls", "pwd"],
                "stack_commands": ["docker", "kubectl"]
            }
            json.dump(config, f)
            temp_path = Path(f.name)

        try:
            result = load_security_config(temp_path)
            self.assertIsNotNone(result)
            self.assertEqual(result["base_commands"], ["ls", "pwd"])
            self.assertEqual(result["stack_commands"], ["docker", "kubectl"])
        finally:
            temp_path.unlink()

    def test_file_not_found(self):
        """Test loading non-existent file."""
        result = load_security_config(Path("/nonexistent/file.json"))
        self.assertIsNone(result)

    def test_invalid_json(self):
        """Test loading invalid JSON file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write("{ invalid json }")
            temp_path = Path(f.name)

        try:
            result = load_security_config(temp_path)
            self.assertIsNone(result)
        finally:
            temp_path.unlink()


class TestGeneratePermissions(unittest.TestCase):
    """Tests for generate_permissions function."""

    def test_generate_from_base_commands(self):
        """Test generating permissions from base commands only."""
        config = {
            "base_commands": ["ls", "pwd", "echo"],
            "stack_commands": []
        }
        result = generate_permissions(config)
        self.assertTrue(result.success)
        self.assertEqual(result.total_permissions, 3)
        self.assertEqual(result.base_commands, 3)
        self.assertEqual(result.stack_commands, 0)
        self.assertIn("Bash(ls)", result.permissions)
        self.assertIn("Bash(pwd)", result.permissions)
        self.assertIn("Bash(echo)", result.permissions)

    def test_generate_from_stack_commands(self):
        """Test generating permissions from stack commands only."""
        config = {
            "base_commands": [],
            "stack_commands": ["docker", "kubectl"]
        }
        result = generate_permissions(config)
        self.assertTrue(result.success)
        self.assertEqual(result.total_permissions, 2)
        self.assertEqual(result.base_commands, 0)
        self.assertEqual(result.stack_commands, 2)
        self.assertIn("Bash(docker)", result.permissions)
        self.assertIn("Bash(kubectl)", result.permissions)

    def test_generate_from_both_command_types(self):
        """Test generating permissions from both command types."""
        config = {
            "base_commands": ["ls", "pwd"],
            "stack_commands": ["docker", "kubectl"]
        }
        result = generate_permissions(config)
        self.assertTrue(result.success)
        self.assertEqual(result.total_permissions, 4)
        self.assertEqual(result.base_commands, 2)
        self.assertEqual(result.stack_commands, 2)
        self.assertEqual(len(result.permissions), 4)

    def test_no_commands_fails(self):
        """Test that empty command lists result in failure."""
        config = {
            "base_commands": [],
            "stack_commands": []
        }
        result = generate_permissions(config)
        self.assertFalse(result.success)
        self.assertIsNotNone(result.error)
        self.assertIn("No commands", result.error)


class TestLoadClaudeSettings(unittest.TestCase):
    """Tests for load_claude_settings function."""

    def test_load_valid_settings(self):
        """Test loading valid Claude settings."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            settings = {
                "permissions": {
                    "allow": ["Bash(*)"]
                }
            }
            json.dump(settings, f)
            temp_path = Path(f.name)

        try:
            result = load_claude_settings(temp_path)
            self.assertIsNotNone(result)
            self.assertIn("permissions", result)
            self.assertEqual(result["permissions"]["allow"], ["Bash(*)"])
        finally:
            temp_path.unlink()

    def test_file_not_found(self):
        """Test loading non-existent settings file."""
        result = load_claude_settings(Path("/nonexistent/settings.json"))
        self.assertIsNone(result)

    def test_invalid_json(self):
        """Test loading invalid JSON settings file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write("{ invalid json }")
            temp_path = Path(f.name)

        try:
            result = load_claude_settings(temp_path)
            self.assertIsNone(result)
        finally:
            temp_path.unlink()


class TestUpdateClaudeSettings(unittest.TestCase):
    """Tests for update_claude_settings function."""

    def test_replace_wildcard_permission(self):
        """Test replacing Bash(*) with granular permissions."""
        settings = {
            "permissions": {
                "allow": ["Bash(*)"]
            }
        }
        new_permissions = ["Bash(ls)", "Bash(pwd)"]
        result = update_claude_settings(settings, new_permissions)

        self.assertNotIn("Bash(*)", result["permissions"]["allow"])
        self.assertIn("Bash(ls)", result["permissions"]["allow"])
        self.assertIn("Bash(pwd)", result["permissions"]["allow"])

    def test_remove_existing_bash_permissions(self):
        """Test that existing Bash() permissions are removed."""
        settings = {
            "permissions": {
                "allow": ["Bash(old_cmd)", "Read(*)", "Bash(*)"]
            }
        }
        new_permissions = ["Bash(new_cmd)"]
        result = update_claude_settings(settings, new_permissions)

        self.assertNotIn("Bash(old_cmd)", result["permissions"]["allow"])
        self.assertNotIn("Bash(*)", result["permissions"]["allow"])
        self.assertIn("Bash(new_cmd)", result["permissions"]["allow"])
        self.assertIn("Read(*)", result["permissions"]["allow"])

    def test_preserve_non_bash_permissions(self):
        """Test that non-Bash permissions are preserved."""
        settings = {
            "permissions": {
                "allow": ["Read(*)", "Write(*)", "Bash(*)"]
            }
        }
        new_permissions = ["Bash(ls)"]
        result = update_claude_settings(settings, new_permissions)

        self.assertIn("Read(*)", result["permissions"]["allow"])
        self.assertIn("Write(*)", result["permissions"]["allow"])
        self.assertIn("Bash(ls)", result["permissions"]["allow"])

    def test_create_permissions_structure(self):
        """Test creating permissions structure if missing."""
        settings = {}
        new_permissions = ["Bash(ls)", "Bash(pwd)"]
        result = update_claude_settings(settings, new_permissions)

        self.assertIn("permissions", result)
        self.assertIn("allow", result["permissions"])
        self.assertEqual(len(result["permissions"]["allow"]), 2)


class TestWriteSettingsFile(unittest.TestCase):
    """Tests for write_settings_file function."""

    def test_write_valid_settings(self):
        """Test writing valid settings to file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = Path(f.name)

        try:
            settings = {
                "permissions": {
                    "allow": ["Bash(ls)", "Bash(pwd)"]
                }
            }
            result = write_settings_file(settings, temp_path)
            self.assertTrue(result)

            # Verify file contents
            with temp_path.open('r') as f:
                written_data = json.load(f)
                self.assertEqual(written_data["permissions"]["allow"], ["Bash(ls)", "Bash(pwd)"])
        finally:
            temp_path.unlink()

    def test_write_with_trailing_newline(self):
        """Test that written file has trailing newline."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = Path(f.name)

        try:
            settings = {"test": "data"}
            write_settings_file(settings, temp_path)

            with temp_path.open('r') as f:
                content = f.read()
                self.assertTrue(content.endswith('\n'))
        finally:
            temp_path.unlink()

    def test_write_to_invalid_path(self):
        """Test writing to invalid path."""
        invalid_path = Path("/nonexistent/directory/file.json")
        settings = {"test": "data"}
        result = write_settings_file(settings, invalid_path)
        self.assertFalse(result)


class TestPrintStatus(unittest.TestCase):
    """Tests for print_status function."""

    @patch('builtins.print')
    def test_success_status(self, mock_print):
        """Test printing success status."""
        print_status("success", "Test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Test message", call_args)
        self.assertIn("✅", call_args)

    @patch('builtins.print')
    def test_error_status(self, mock_print):
        """Test printing error status."""
        print_status("error", "Error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Error message", call_args)
        self.assertIn("❌", call_args)

    @patch('builtins.print')
    def test_warning_status(self, mock_print):
        """Test printing warning status."""
        print_status("warning", "Warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Warning message", call_args)
        self.assertIn("⚠️", call_args)

    @patch('builtins.print')
    def test_info_status(self, mock_print):
        """Test printing info status."""
        print_status("info", "Info message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("Info message", call_args)
        self.assertIn("ℹ️", call_args)


if __name__ == '__main__':
    unittest.main()
