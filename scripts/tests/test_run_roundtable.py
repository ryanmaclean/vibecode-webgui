#!/usr/bin/env python3
"""Tests for run_roundtable module."""

import os
import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "roundtable"))

from roundtable.run_roundtable import (
    DEFAULT_AGENTS,
    DEFAULT_PYTHON_CMD,
    DEFAULT_WORKING_DIR,
    RoundtableConfig,
    check_uvx_installed,
    get_results_path,
    run_command,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_default_agents(self):
        """Test default agents value."""
        self.assertIn("codex", DEFAULT_AGENTS)
        self.assertIn("cursor", DEFAULT_AGENTS)
        self.assertIn("gemini", DEFAULT_AGENTS)

    def test_default_working_dir(self):
        """Test default working directory."""
        self.assertEqual(DEFAULT_WORKING_DIR, Path.home() / "vibecode-webgui")

    def test_default_python_cmd(self):
        """Test default Python command."""
        self.assertEqual(DEFAULT_PYTHON_CMD, "python3.13")


class TestRoundtableConfig(TestCase):
    """Tests for RoundtableConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = RoundtableConfig()
        self.assertEqual(config.agents, DEFAULT_AGENTS)
        self.assertEqual(config.working_dir, DEFAULT_WORKING_DIR)
        self.assertEqual(config.python_cmd, DEFAULT_PYTHON_CMD)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = RoundtableConfig(
            agents="codex",
            working_dir=Path("/custom/path"),
            python_cmd="python3.12"
        )
        self.assertEqual(config.agents, "codex")
        self.assertEqual(config.working_dir, Path("/custom/path"))
        self.assertEqual(config.python_cmd, "python3.12")


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"], check=False)
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(
            ["nonexistent_cmd_12345"],
            check=False
        )
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)

    def test_with_env(self):
        """Test command with environment variables."""
        rc, stdout, stderr = run_command(
            ["bash", "-c", "echo $TEST_VAR"],
            env={"TEST_VAR": "test_value"}
        )
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "test_value")


class TestCheckUvxInstalled(TestCase):
    """Tests for check_uvx_installed function."""

    @mock.patch('roundtable.run_roundtable.shutil.which')
    def test_installed(self, mock_which):
        """Test when uvx is installed."""
        mock_which.return_value = "/usr/local/bin/uvx"

        result = check_uvx_installed()

        self.assertTrue(result)

    @mock.patch('roundtable.run_roundtable.shutil.which')
    def test_not_installed(self, mock_which):
        """Test when uvx is not installed."""
        mock_which.return_value = None

        result = check_uvx_installed()

        self.assertFalse(result)


class TestGetResultsPath(TestCase):
    """Tests for get_results_path function."""

    def test_returns_correct_path(self):
        """Test returns correct results path."""
        result = get_results_path()

        self.assertEqual(
            result,
            Path.home() / ".roundtable" / "availability_check.json"
        )


class TestRunRoundtable(TestCase):
    """Tests for run_roundtable function."""

    @mock.patch('roundtable.run_roundtable.check_uvx_installed')
    def test_fails_without_uvx(self, mock_check):
        """Test fails when uvx not installed."""
        from roundtable.run_roundtable import run_roundtable

        mock_check.return_value = False
        config = RoundtableConfig()

        result = run_roundtable(config)

        self.assertEqual(result, 1)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('roundtable.run_roundtable.run_roundtable')
    def test_main_with_defaults(self, mock_run):
        """Test main with default values."""
        from roundtable.run_roundtable import main

        mock_run.return_value = 0

        result = main()

        self.assertEqual(result, 0)
        mock_run.assert_called_once()

    @mock.patch('roundtable.run_roundtable.run_roundtable')
    def test_main_with_args(self, mock_run):
        """Test main with arguments."""
        from roundtable.run_roundtable import main

        mock_run.return_value = 0

        result = main(
            agents="codex",
            working_dir=Path("/custom"),
            python_cmd="python3.11"
        )

        self.assertEqual(result, 0)
        call_config = mock_run.call_args[0][0]
        self.assertEqual(call_config.agents, "codex")
        self.assertEqual(call_config.working_dir, Path("/custom"))
        self.assertEqual(call_config.python_cmd, "python3.11")

    @mock.patch('roundtable.run_roundtable.run_roundtable')
    @mock.patch.dict(os.environ, {
        "CLI_MCP_SUBAGENTS": "cursor",
        "CLI_MCP_WORKING_DIR": "/env/path",
        "PYTHON_CMD": "python3.10"
    })
    def test_main_uses_env(self, mock_run):
        """Test main uses environment variables."""
        from roundtable.run_roundtable import main

        mock_run.return_value = 0

        result = main()

        self.assertEqual(result, 0)
        call_config = mock_run.call_args[0][0]
        self.assertEqual(call_config.agents, "cursor")
        self.assertEqual(call_config.working_dir, Path("/env/path"))
        self.assertEqual(call_config.python_cmd, "python3.10")


if __name__ == '__main__':
    import unittest
    unittest.main()
