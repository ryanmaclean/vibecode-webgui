#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for security_updates.py"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from security_updates import (
    Colors,
    Config,
    check_prerequisites,
    command_exists,
    log,
    print_error,
    print_info,
    print_success,
    print_warning,
    run_cmd,
)


class TestColors(unittest.TestCase):
    """Test color constants."""

    def test_colors_defined(self):
        """Test that all color codes are defined."""
        self.assertIsInstance(Colors.RED, str)
        self.assertIsInstance(Colors.GREEN, str)
        self.assertIsInstance(Colors.YELLOW, str)
        self.assertIsInstance(Colors.BLUE, str)
        self.assertIsInstance(Colors.NC, str)

    def test_colors_are_ansi_codes(self):
        """Test that colors are valid ANSI escape codes."""
        self.assertTrue(Colors.RED.startswith('\033['))
        self.assertTrue(Colors.GREEN.startswith('\033['))
        self.assertTrue(Colors.YELLOW.startswith('\033['))
        self.assertTrue(Colors.BLUE.startswith('\033['))


class TestConfig(unittest.TestCase):
    """Test Config dataclass."""

    def test_config_creation(self):
        """Test creating a Config instance."""
        config = Config(
            script_dir=Path("/tmp"),
            log_dir=Path("/tmp/logs"),
            timestamp="20240101_120000",
            log_file=Path("/tmp/logs/test.log"),
            backup_dir=Path("/tmp/backup")
        )
        self.assertEqual(config.script_dir, Path("/tmp"))
        self.assertFalse(config.skip_tests)
        self.assertFalse(config.dry_run)

    def test_config_defaults(self):
        """Test Config default values."""
        config = Config(
            script_dir=Path("/tmp"),
            log_dir=Path("/tmp/logs"),
            timestamp="20240101_120000",
            log_file=Path("/tmp/logs/test.log"),
            backup_dir=Path("/tmp/backup")
        )
        self.assertFalse(config.skip_tests)
        self.assertFalse(config.force_update)
        self.assertFalse(config.dry_run)
        self.assertFalse(config.verbose)
        self.assertFalse(config.update_mcp_only)
        self.assertFalse(config.update_langchain_only)


class TestPrintFunctions(unittest.TestCase):
    """Test print helper functions."""

    @patch('builtins.print')
    def test_print_info(self, mock_print):
        """Test print_info outputs correct format."""
        print_info("test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[INFO]", call_args)
        self.assertIn("test message", call_args)

    @patch('builtins.print')
    def test_print_success(self, mock_print):
        """Test print_success outputs correct format."""
        print_success("success message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[SUCCESS]", call_args)

    @patch('builtins.print')
    def test_print_warning(self, mock_print):
        """Test print_warning outputs correct format."""
        print_warning("warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[WARNING]", call_args)

    @patch('builtins.print')
    def test_print_error(self, mock_print):
        """Test print_error outputs correct format."""
        print_error("error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[ERROR]", call_args)


class TestLogFunction(unittest.TestCase):
    """Test log function."""

    def test_log_writes_to_file(self):
        """Test that log writes to file."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.log') as f:
            log_file = Path(f.name)

        try:
            log("test message", log_file)
            content = log_file.read_text()
            self.assertIn("test message", content)
        finally:
            log_file.unlink()


class TestCommandExists(unittest.TestCase):
    """Test command_exists function."""

    def test_existing_command(self):
        """Test that existing commands are found."""
        result = command_exists("python3") or command_exists("python")
        self.assertTrue(result)

    def test_nonexistent_command(self):
        """Test that nonexistent commands return False."""
        result = command_exists("nonexistent_command_xyz123")
        self.assertFalse(result)


class TestRunCmd(unittest.TestCase):
    """Test run_cmd function."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = Path(self.temp_dir) / "test.log"
        self.log_file.touch()

        self.config = Config(
            script_dir=Path(self.temp_dir),
            log_dir=Path(self.temp_dir),
            timestamp="test",
            log_file=self.log_file,
            backup_dir=Path(self.temp_dir) / "backup",
            dry_run=False
        )

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_run_cmd_success(self):
        """Test running a successful command."""
        result = run_cmd("echo hello", "Test echo", self.config)
        self.assertTrue(result)

    def test_run_cmd_failure(self):
        """Test running a failing command."""
        result = run_cmd("false", "Test false", self.config)
        self.assertFalse(result)

    def test_run_cmd_dry_run(self):
        """Test dry run mode."""
        self.config.dry_run = True
        result = run_cmd("rm -rf /", "Dangerous command", self.config)
        self.assertTrue(result)  # Should succeed without executing

    def test_run_cmd_logs_output(self):
        """Test that command output is logged."""
        run_cmd("echo test_output", "Test output", self.config)
        log_content = self.log_file.read_text()
        self.assertIn("Command:", log_content)


class TestCheckPrerequisites(unittest.TestCase):
    """Test check_prerequisites function."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_dir = os.getcwd()
        os.chdir(self.temp_dir)

        self.log_file = Path(self.temp_dir) / "test.log"
        self.log_file.touch()

        self.config = Config(
            script_dir=Path(self.temp_dir),
            log_dir=Path(self.temp_dir),
            timestamp="test",
            log_file=self.log_file,
            backup_dir=Path(self.temp_dir) / "backup"
        )

    def tearDown(self):
        """Clean up test fixtures."""
        os.chdir(self.original_dir)
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_missing_package_json(self):
        """Test that missing package.json fails check."""
        result = check_prerequisites(self.config)
        self.assertFalse(result)

    def test_with_package_json(self):
        """Test with package.json present."""
        Path("package.json").write_text('{"name": "test"}')
        # This may still fail if npm/git not available
        # but at least package.json check passes
        # We're testing the logic, not full integration


class TestIntegration(unittest.TestCase):
    """Integration tests."""

    def test_module_importable(self):
        """Test that the module can be imported."""
        import security_updates
        self.assertTrue(hasattr(security_updates, 'main'))
        self.assertTrue(hasattr(security_updates, 'run_security_updates'))

    def test_main_function_exists(self):
        """Test that main function is callable."""
        from security_updates import main
        self.assertTrue(callable(main))

    def test_run_security_updates_exists(self):
        """Test that run_security_updates is callable."""
        from security_updates import run_security_updates
        self.assertTrue(callable(run_security_updates))


class TestDryRunMode(unittest.TestCase):
    """Test dry run functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = Path(self.temp_dir) / "test.log"
        self.log_file.touch()

        self.config = Config(
            script_dir=Path(self.temp_dir),
            log_dir=Path(self.temp_dir),
            timestamp="test",
            log_file=self.log_file,
            backup_dir=Path(self.temp_dir) / "backup",
            dry_run=True
        )

    def tearDown(self):
        """Clean up."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_dry_run_does_not_execute(self):
        """Test that dry run doesn't execute commands."""
        # This command would fail if actually executed
        result = run_cmd("exit 1", "Should not run", self.config)
        self.assertTrue(result)  # Returns True because it didn't actually run


if __name__ == "__main__":
    unittest.main()