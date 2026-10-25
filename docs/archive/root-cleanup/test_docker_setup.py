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

"""Tests for docker_setup.py"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from docker_setup import (
    Colors,
    check_docker_cli,
    check_port_open,
    command_exists,
    configure_docker_host,
    detect_shell,
    print_error,
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


class TestPrintFunctions(unittest.TestCase):
    """Test print helper functions."""

    @patch('builtins.print')
    def test_print_success(self, mock_print):
        """Test print_success outputs correct format."""
        print_success("test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("✓", call_args)

    @patch('builtins.print')
    def test_print_warning(self, mock_print):
        """Test print_warning outputs correct format."""
        print_warning("warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("⚠", call_args)

    @patch('builtins.print')
    def test_print_error(self, mock_print):
        """Test print_error outputs correct format."""
        print_error("error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("✗", call_args)


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


class TestRunCommand(unittest.TestCase):
    """Test run_command function."""

    def test_successful_command(self):
        """Test running a successful command."""
        success, output = run_command(["echo", "hello"])
        self.assertTrue(success)
        self.assertEqual(output, "hello")

    def test_failed_command(self):
        """Test running a failing command."""
        success, _ = run_command(["false"])
        self.assertFalse(success)


class TestCheckPortOpen(unittest.TestCase):
    """Test check_port_open function."""

    def test_closed_port(self):
        """Test checking a closed port."""
        # Port 59999 is unlikely to be open
        result = check_port_open("localhost", 59999, timeout=0.1)
        self.assertFalse(result)

    @patch('socket.socket')
    def test_open_port_mock(self, mock_socket):
        """Test checking an open port with mock."""
        mock_sock_instance = MagicMock()
        mock_socket.return_value.__enter__.return_value = mock_sock_instance
        mock_sock_instance.connect_ex.return_value = 0

        result = check_port_open("localhost", 2375)
        self.assertTrue(result)


class TestDetectShell(unittest.TestCase):
    """Test detect_shell function."""

    @patch.dict(os.environ, {'SHELL': '/bin/bash'})
    def test_detect_bash(self):
        """Test detection of bash shell."""
        shell_name, profile, _ = detect_shell()
        self.assertEqual(shell_name, "bash")
        self.assertTrue(str(profile).endswith('.bash_profile'))

    @patch.dict(os.environ, {'SHELL': '/bin/zsh'})
    def test_detect_zsh(self):
        """Test detection of zsh shell."""
        shell_name, profile, _ = detect_shell()
        self.assertEqual(shell_name, "zsh")
        self.assertTrue(str(profile).endswith('.zshrc'))

    @patch.dict(os.environ, {'SHELL': '/bin/fish'})
    def test_detect_unknown_shell(self):
        """Test detection of unknown shell defaults to .profile."""
        shell_name, profile, _ = detect_shell()
        self.assertEqual(shell_name, "fish")
        self.assertTrue(str(profile).endswith('.profile'))


class TestCheckDockerCli(unittest.TestCase):
    """Test check_docker_cli function."""

    @patch('docker_setup.command_exists')
    @patch('docker_setup.run_command')
    def test_docker_installed(self, mock_run, mock_exists):
        """Test when Docker is installed."""
        mock_exists.return_value = True
        mock_run.return_value = (True, "Docker version 24.0.0")

        result = check_docker_cli()
        self.assertEqual(result, "Docker version 24.0.0")

    @patch('docker_setup.command_exists')
    def test_docker_not_installed(self, mock_exists):
        """Test when Docker is not installed."""
        mock_exists.return_value = False

        result = check_docker_cli()
        self.assertIsNone(result)


class TestConfigureDockerHost(unittest.TestCase):
    """Test configure_docker_host function."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.profile = Path(self.temp_dir) / ".zshrc"

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_configure_new_profile(self):
        """Test configuring DOCKER_HOST in new profile."""
        result = configure_docker_host(self.profile)
        self.assertTrue(result)
        self.assertTrue(self.profile.exists())
        content = self.profile.read_text()
        self.assertIn("DOCKER_HOST=tcp://localhost:2375", content)
        self.assertIn("VibeCode Docker Configuration", content)

    def test_configure_existing_profile(self):
        """Test configuring DOCKER_HOST in existing profile."""
        self.profile.write_text("# Existing content\n")
        result = configure_docker_host(self.profile)
        self.assertTrue(result)
        content = self.profile.read_text()
        self.assertIn("# Existing content", content)
        self.assertIn("DOCKER_HOST=tcp://localhost:2375", content)

    @patch('docker_setup.get_user_input')
    def test_skip_already_configured(self, mock_input):
        """Test skipping when already configured."""
        self.profile.write_text("export DOCKER_HOST=tcp://localhost:2375\n")
        mock_input.return_value = 'y'

        result = configure_docker_host(self.profile)
        self.assertTrue(result)


class TestIntegration(unittest.TestCase):
    """Integration tests."""

    def test_module_importable(self):
        """Test that the module can be imported."""
        import docker_setup
        self.assertTrue(hasattr(docker_setup, 'main'))
        self.assertTrue(hasattr(docker_setup, 'setup_docker'))

    def test_main_function_exists(self):
        """Test that main function is callable."""
        from docker_setup import main
        self.assertTrue(callable(main))


if __name__ == "__main__":
    unittest.main()