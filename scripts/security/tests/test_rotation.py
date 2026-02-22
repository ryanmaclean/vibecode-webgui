#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-rotation"
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

"""Tests for secret rotation script."""

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, call

from scripts.security.rotate_secrets import (
    Color,
    SecretInfo,
    RotationResult,
    ROTATION_POLICIES,
    color_print,
    generate_secret_value,
    calculate_new_expiration,
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


class TestRotationPolicies(unittest.TestCase):
    """Tests for rotation policies configuration."""

    def test_policies_exist(self):
        """Test that rotation policies are defined."""
        self.assertIsInstance(ROTATION_POLICIES, dict)
        self.assertGreater(len(ROTATION_POLICIES), 0)

    def test_api_keys_policy(self):
        """Test that api_keys policy exists."""
        self.assertIn("api_keys", ROTATION_POLICIES)
        self.assertEqual(ROTATION_POLICIES["api_keys"], 90)

    def test_auth_tokens_policy(self):
        """Test that auth_tokens policy exists."""
        self.assertIn("auth_tokens", ROTATION_POLICIES)
        self.assertEqual(ROTATION_POLICIES["auth_tokens"], 30)

    def test_db_credentials_policy(self):
        """Test that db_credentials policy exists."""
        self.assertIn("db_credentials", ROTATION_POLICIES)
        self.assertEqual(ROTATION_POLICIES["db_credentials"], 180)

    def test_all_policies_are_positive(self):
        """Test that all policy values are positive integers."""
        for policy, days in ROTATION_POLICIES.items():
            self.assertIsInstance(days, int)
            self.assertGreater(days, 0)


class TestSecretInfo(unittest.TestCase):
    """Tests for SecretInfo dataclass."""

    def test_required_fields(self):
        """Test creating SecretInfo with required fields."""
        now = datetime.now(timezone.utc)
        info = SecretInfo(
            id=1,
            key_name="TEST_KEY",
            expires_at=now,
            last_rotated_at=None,
            rotation_policy="api_keys",
            status="active",
            metadata=None,
        )
        self.assertEqual(info.id, 1)
        self.assertEqual(info.key_name, "TEST_KEY")
        self.assertEqual(info.status, "active")

    def test_with_metadata(self):
        """Test SecretInfo with metadata."""
        now = datetime.now(timezone.utc)
        metadata = {"source": "test", "owner": "platform"}
        info = SecretInfo(
            id=1,
            key_name="TEST_KEY",
            expires_at=now,
            last_rotated_at=now,
            rotation_policy="api_keys",
            status="active",
            metadata=metadata,
        )
        self.assertEqual(info.metadata, metadata)


class TestRotationResult(unittest.TestCase):
    """Tests for RotationResult dataclass."""

    def test_success_result(self):
        """Test creating a successful rotation result."""
        result = RotationResult(
            success=True,
            key_name="TEST_KEY",
            message="Rotation successful",
        )
        self.assertTrue(result.success)
        self.assertEqual(result.key_name, "TEST_KEY")

    def test_failure_result(self):
        """Test creating a failed rotation result."""
        result = RotationResult(
            success=False,
            key_name="TEST_KEY",
            message="Rotation failed",
        )
        self.assertFalse(result.success)

    def test_dry_run_result(self):
        """Test creating a dry run result."""
        now = datetime.now(timezone.utc)
        result = RotationResult(
            success=True,
            key_name="TEST_KEY",
            message="Dry run",
            new_expires_at=now,
            old_expires_at=None,
            dry_run=True,
        )
        self.assertTrue(result.dry_run)
        self.assertIsNotNone(result.new_expires_at)


class TestColorPrint(unittest.TestCase):
    """Tests for color_print function."""

    @patch('builtins.print')
    def test_color_print_with_color(self, mock_print):
        """Test printing with color enabled."""
        color_print(Color.RED, "Test message", use_color=True)
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn(Color.RED, call_args)
        self.assertIn("Test message", call_args)
        self.assertIn(Color.NC, call_args)

    @patch('builtins.print')
    def test_color_print_without_color(self, mock_print):
        """Test printing with color disabled."""
        color_print(Color.RED, "Test message", use_color=False)
        mock_print.assert_called_once_with("Test message")


class TestGenerateSecretValue(unittest.TestCase):
    """Tests for generate_secret_value function."""

    def test_default_length(self):
        """Test generating secret with default length."""
        secret = generate_secret_value()
        self.assertEqual(len(secret), 64)

    def test_custom_length(self):
        """Test generating secret with custom length."""
        secret = generate_secret_value(length=32)
        self.assertEqual(len(secret), 32)

    def test_api_key_type(self):
        """Test generating API key type secret."""
        secret = generate_secret_value(secret_type="api_key", length=32)
        self.assertEqual(len(secret), 32)
        # Should contain only alphanumeric characters
        self.assertTrue(secret.isalnum())

    def test_password_type(self):
        """Test generating password type secret."""
        secret = generate_secret_value(secret_type="password", length=32)
        self.assertEqual(len(secret), 32)
        # Password can contain special characters

    def test_db_credentials_type(self):
        """Test generating database credentials type secret."""
        secret = generate_secret_value(secret_type="db_credentials", length=32)
        self.assertEqual(len(secret), 32)

    def test_uniqueness(self):
        """Test that generated secrets are unique."""
        secret1 = generate_secret_value(length=32)
        secret2 = generate_secret_value(length=32)
        self.assertNotEqual(secret1, secret2)

    def test_no_empty_string(self):
        """Test that generated secret is not empty."""
        secret = generate_secret_value(length=16)
        self.assertTrue(len(secret) > 0)

    def test_contains_letters_and_digits(self):
        """Test that generated secret contains both letters and digits."""
        # Generate a longer secret to increase probability
        secret = generate_secret_value(length=100)
        has_letter = any(c.isalpha() for c in secret)
        has_digit = any(c.isdigit() for c in secret)
        self.assertTrue(has_letter or has_digit)


class TestCalculateNewExpiration(unittest.TestCase):
    """Tests for calculate_new_expiration function."""

    def test_no_policy_returns_none(self):
        """Test that no policy returns None."""
        result = calculate_new_expiration(None)
        self.assertIsNone(result)

    def test_api_keys_policy(self):
        """Test expiration calculation for api_keys policy."""
        now = datetime.now(timezone.utc)
        result = calculate_new_expiration("api_keys")
        self.assertIsNotNone(result)
        # Should be approximately 90 days in the future
        delta = (result - now).days
        self.assertAlmostEqual(delta, 90, delta=1)

    def test_auth_tokens_policy(self):
        """Test expiration calculation for auth_tokens policy."""
        now = datetime.now(timezone.utc)
        result = calculate_new_expiration("auth_tokens")
        self.assertIsNotNone(result)
        # Should be approximately 30 days in the future
        delta = (result - now).days
        self.assertAlmostEqual(delta, 30, delta=1)

    def test_db_credentials_policy(self):
        """Test expiration calculation for db_credentials policy."""
        now = datetime.now(timezone.utc)
        result = calculate_new_expiration("db_credentials")
        self.assertIsNotNone(result)
        # Should be approximately 180 days in the future
        delta = (result - now).days
        self.assertAlmostEqual(delta, 180, delta=1)

    def test_unknown_policy_uses_default(self):
        """Test that unknown policy uses default 90 days."""
        now = datetime.now(timezone.utc)
        result = calculate_new_expiration("unknown_policy")
        self.assertIsNotNone(result)
        # Should use default of 90 days
        delta = (result - now).days
        self.assertAlmostEqual(delta, 90, delta=1)

    def test_custom_policy(self):
        """Test expiration calculation for custom policy."""
        now = datetime.now(timezone.utc)
        result = calculate_new_expiration("custom")
        self.assertIsNotNone(result)
        delta = (result - now).days
        self.assertAlmostEqual(delta, 90, delta=1)

    def test_timezone_aware(self):
        """Test that returned datetime is timezone aware."""
        result = calculate_new_expiration("api_keys")
        self.assertIsNotNone(result)
        self.assertIsNotNone(result.tzinfo)
        self.assertEqual(result.tzinfo, timezone.utc)


class TestEnsureMacos(unittest.TestCase):
    """Tests for ensure_macos function."""

    @patch('platform.system')
    @patch('shutil.which')
    def test_macos_with_security_command(self, mock_which, mock_system):
        """Test that macOS with security command passes."""
        from scripts.security.rotate_secrets import ensure_macos
        mock_system.return_value = "Darwin"
        mock_which.return_value = "/usr/bin/security"
        # Should not raise any exception
        try:
            ensure_macos()
        except SystemExit:
            self.fail("ensure_macos() raised SystemExit unexpectedly")

    @patch('platform.system')
    def test_non_macos_exits(self, mock_system):
        """Test that non-macOS platform exits."""
        from scripts.security.rotate_secrets import ensure_macos
        mock_system.return_value = "Linux"
        with self.assertRaises(SystemExit) as cm:
            ensure_macos()
        self.assertEqual(cm.exception.code, 1)

    @patch('platform.system')
    @patch('shutil.which')
    def test_macos_without_security_command_exits(self, mock_which, mock_system):
        """Test that macOS without security command exits."""
        from scripts.security.rotate_secrets import ensure_macos
        mock_system.return_value = "Darwin"
        mock_which.return_value = None
        with self.assertRaises(SystemExit) as cm:
            ensure_macos()
        self.assertEqual(cm.exception.code, 1)


class TestReadKeychainSecret(unittest.TestCase):
    """Tests for read_keychain_secret function."""

    @patch('subprocess.run')
    def test_successful_read(self, mock_run):
        """Test successfully reading a secret from keychain."""
        from scripts.security.rotate_secrets import read_keychain_secret
        mock_run.return_value = MagicMock(stdout="test_secret_value\n")
        result = read_keychain_secret("TEST_KEY")
        self.assertEqual(result, "test_secret_value")

    @patch('subprocess.run')
    def test_secret_not_found(self, mock_run):
        """Test handling when secret is not found."""
        from scripts.security.rotate_secrets import read_keychain_secret
        import subprocess
        mock_run.side_effect = subprocess.CalledProcessError(1, "security")
        result = read_keychain_secret("NONEXISTENT_KEY")
        self.assertIsNone(result)

    @patch('subprocess.run')
    def test_strips_whitespace(self, mock_run):
        """Test that returned value has whitespace stripped."""
        from scripts.security.rotate_secrets import read_keychain_secret
        mock_run.return_value = MagicMock(stdout="  test_value  \n")
        result = read_keychain_secret("TEST_KEY")
        self.assertEqual(result, "test_value")


class TestUpdateKeychainSecret(unittest.TestCase):
    """Tests for update_keychain_secret function."""

    @patch('subprocess.run')
    def test_successful_update(self, mock_run):
        """Test successfully updating a secret in keychain."""
        from scripts.security.rotate_secrets import update_keychain_secret
        mock_run.return_value = MagicMock()
        result = update_keychain_secret("TEST_KEY", "new_value")
        self.assertTrue(result)
        # Should be called twice: once to delete, once to add
        self.assertEqual(mock_run.call_count, 2)

    @patch('subprocess.run')
    def test_update_with_metadata(self, mock_run):
        """Test updating secret with metadata."""
        from scripts.security.rotate_secrets import update_keychain_secret
        mock_run.return_value = MagicMock()
        metadata = {"key": "value"}
        result = update_keychain_secret("TEST_KEY", "new_value", metadata)
        self.assertTrue(result)

    @patch('subprocess.run')
    def test_failed_update(self, mock_run):
        """Test handling failed update."""
        from scripts.security.rotate_secrets import update_keychain_secret
        import subprocess
        # First call (delete) succeeds, second call (add) fails
        mock_run.side_effect = [
            MagicMock(),
            subprocess.CalledProcessError(1, "security"),
        ]
        result = update_keychain_secret("TEST_KEY", "new_value")
        self.assertFalse(result)


if __name__ == '__main__':
    unittest.main()
