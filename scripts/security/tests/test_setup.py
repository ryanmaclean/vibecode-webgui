#!/usr/bin/env python3
"""Tests for security setup script."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.setup import (
    Color,
    SecretsConfig,
    generate_random_secret,
    require_cmd,
    run_kubectl,
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

    def test_color_codes_are_ansi(self):
        """Test that color codes are ANSI escape sequences."""
        self.assertTrue(Color.RED.startswith('\033['))
        self.assertTrue(Color.GREEN.startswith('\033['))
        self.assertTrue(Color.YELLOW.startswith('\033['))
        self.assertTrue(Color.BLUE.startswith('\033['))


class TestSecretsConfig(unittest.TestCase):
    """Tests for SecretsConfig dataclass."""

    def test_default_values(self):
        """Test default values are empty strings."""
        config = SecretsConfig()
        self.assertEqual(config.dd_api_key, "")
        self.assertEqual(config.openrouter_api_key, "")
        self.assertEqual(config.claude_api_key, "")
        self.assertEqual(config.dd_cluster_agent_token, "")
        self.assertEqual(config.jwt_secret, "")
        self.assertEqual(config.session_secret, "")
        self.assertEqual(config.nextauth_secret, "")

    def test_custom_values(self):
        """Test setting custom values."""
        config = SecretsConfig(
            dd_api_key="test_dd_key",
            openrouter_api_key="test_or_key",
        )
        self.assertEqual(config.dd_api_key, "test_dd_key")
        self.assertEqual(config.openrouter_api_key, "test_or_key")


class TestGenerateRandomSecret(unittest.TestCase):
    """Tests for generate_random_secret function."""

    def test_generates_string(self):
        """Test that function returns a string."""
        secret = generate_random_secret()
        self.assertIsInstance(secret, str)

    def test_generates_different_secrets(self):
        """Test that function generates unique secrets."""
        secrets = [generate_random_secret() for _ in range(10)]
        self.assertEqual(len(secrets), len(set(secrets)))

    def test_default_length_produces_expected_output(self):
        """Test that default length produces reasonable output."""
        secret = generate_random_secret()
        # Base64 encoding of 32 bytes should be ~43 chars before stripping =
        self.assertGreater(len(secret), 30)

    def test_custom_length(self):
        """Test with custom length parameter."""
        short_secret = generate_random_secret(length=16)
        long_secret = generate_random_secret(length=64)
        self.assertLess(len(short_secret), len(long_secret))


class TestRequireCmd(unittest.TestCase):
    """Tests for require_cmd function."""

    @patch('shutil.which')
    def test_command_exists(self, mock_which):
        """Test when command exists."""
        mock_which.return_value = '/usr/bin/test'
        result = require_cmd('test')
        self.assertTrue(result)

    @patch('shutil.which')
    def test_command_not_found(self, mock_which):
        """Test when command doesn't exist."""
        mock_which.return_value = None
        result = require_cmd('nonexistent')
        self.assertFalse(result)


class TestRunKubectl(unittest.TestCase):
    """Tests for run_kubectl function."""

    @patch('subprocess.run')
    def test_runs_kubectl_command(self, mock_run):
        """Test that kubectl command is executed."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        run_kubectl(['get', 'pods'])
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        self.assertEqual(call_args[0], 'kubectl')
        self.assertIn('get', call_args)
        self.assertIn('pods', call_args)

    @patch('subprocess.run')
    def test_passes_check_parameter(self, mock_run):
        """Test that check parameter is passed correctly."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        run_kubectl(['get', 'pods'], check=False)
        call_kwargs = mock_run.call_args[1]
        self.assertFalse(call_kwargs['check'])


if __name__ == '__main__':
    unittest.main()
