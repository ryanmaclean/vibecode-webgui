#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-expiration"
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

"""Tests for secret expiration checker script."""

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from scripts.security.check_expiration import (
    Color,
    Severity,
    SecretStatus,
    ExpirationSummary,
    color_print,
    get_severity_color,
    determine_severity,
    get_recommendations,
    analyze_secret,
    generate_summary,
    determine_exit_code,
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


class TestSeverity(unittest.TestCase):
    """Tests for Severity enum."""

    def test_severity_values(self):
        """Test that severity values are defined."""
        self.assertEqual(Severity.CRITICAL.value, "critical")
        self.assertEqual(Severity.WARNING.value, "warning")
        self.assertEqual(Severity.INFO.value, "info")
        self.assertEqual(Severity.OK.value, "ok")

    def test_severity_enum_members(self):
        """Test that all severity levels are present."""
        severities = [s.value for s in Severity]
        self.assertIn("critical", severities)
        self.assertIn("warning", severities)
        self.assertIn("info", severities)
        self.assertIn("ok", severities)


class TestSecretStatus(unittest.TestCase):
    """Tests for SecretStatus dataclass."""

    def test_required_fields(self):
        """Test creating SecretStatus with required fields."""
        now = datetime.now(timezone.utc)
        status = SecretStatus(
            key_name="TEST_KEY",
            status="active",
            expires_at=now,
            last_rotated_at=None,
            rotation_policy="api_keys",
            created_at=now,
            days_until_expiration=30,
            severity=Severity.OK,
            message="Test message",
        )
        self.assertEqual(status.key_name, "TEST_KEY")
        self.assertEqual(status.status, "active")
        self.assertEqual(status.severity, Severity.OK)

    def test_default_recommendations(self):
        """Test that recommendations default to empty list."""
        now = datetime.now(timezone.utc)
        status = SecretStatus(
            key_name="TEST_KEY",
            status="active",
            expires_at=now,
            last_rotated_at=None,
            rotation_policy=None,
            created_at=now,
            days_until_expiration=None,
            severity=Severity.OK,
            message="Test",
        )
        self.assertIsInstance(status.recommendations, list)
        self.assertEqual(len(status.recommendations), 0)


class TestExpirationSummary(unittest.TestCase):
    """Tests for ExpirationSummary dataclass."""

    def test_summary_creation(self):
        """Test creating ExpirationSummary."""
        summary = ExpirationSummary(
            total_secrets=10,
            expired=1,
            expiring_soon=2,
            no_expiration=3,
            active=4,
            critical_alerts=1,
            warning_alerts=2,
            info_alerts=3,
            secrets=[],
        )
        self.assertEqual(summary.total_secrets, 10)
        self.assertEqual(summary.expired, 1)
        self.assertEqual(summary.critical_alerts, 1)


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


class TestGetSeverityColor(unittest.TestCase):
    """Tests for get_severity_color function."""

    def test_critical_color(self):
        """Test that critical severity returns red."""
        self.assertEqual(get_severity_color(Severity.CRITICAL), Color.RED)

    def test_warning_color(self):
        """Test that warning severity returns yellow."""
        self.assertEqual(get_severity_color(Severity.WARNING), Color.YELLOW)

    def test_info_color(self):
        """Test that info severity returns cyan."""
        self.assertEqual(get_severity_color(Severity.INFO), Color.CYAN)

    def test_ok_color(self):
        """Test that ok severity returns green."""
        self.assertEqual(get_severity_color(Severity.OK), Color.GREEN)


class TestDetermineSeverity(unittest.TestCase):
    """Tests for determine_severity function."""

    def test_expired_status(self):
        """Test that expired status returns critical."""
        self.assertEqual(determine_severity(None, "expired"), Severity.CRITICAL)

    def test_negative_days(self):
        """Test that negative days returns critical."""
        self.assertEqual(determine_severity(-1, "active"), Severity.CRITICAL)

    def test_zero_days(self):
        """Test that zero days returns critical."""
        self.assertEqual(determine_severity(0, "active"), Severity.CRITICAL)

    def test_one_day(self):
        """Test that one day returns critical."""
        self.assertEqual(determine_severity(1, "active"), Severity.CRITICAL)

    def test_seven_days(self):
        """Test that seven days returns critical."""
        self.assertEqual(determine_severity(7, "active"), Severity.CRITICAL)

    def test_fourteen_days(self):
        """Test that fourteen days returns warning."""
        self.assertEqual(determine_severity(14, "active"), Severity.WARNING)

    def test_thirty_days(self):
        """Test that thirty days returns info."""
        self.assertEqual(determine_severity(30, "active"), Severity.INFO)

    def test_more_than_thirty_days(self):
        """Test that more than thirty days returns ok."""
        self.assertEqual(determine_severity(60, "active"), Severity.OK)

    def test_no_expiration(self):
        """Test that no expiration returns ok."""
        self.assertEqual(determine_severity(None, "active"), Severity.OK)


class TestGetRecommendations(unittest.TestCase):
    """Tests for get_recommendations function."""

    def test_critical_with_policy(self):
        """Test recommendations for critical severity with policy."""
        now = datetime.now(timezone.utc)
        secret = SecretStatus(
            key_name="TEST_KEY",
            status="active",
            expires_at=now,
            last_rotated_at=None,
            rotation_policy="api_keys",
            created_at=now,
            days_until_expiration=1,
            severity=Severity.CRITICAL,
            message="Expires soon",
        )
        recommendations = get_recommendations(secret)
        self.assertTrue(any("URGENT" in rec for rec in recommendations))
        self.assertTrue(any("rotate_secrets.py" in rec for rec in recommendations))

    def test_warning_severity(self):
        """Test recommendations for warning severity."""
        now = datetime.now(timezone.utc)
        secret = SecretStatus(
            key_name="TEST_KEY",
            status="active",
            expires_at=now,
            last_rotated_at=None,
            rotation_policy="api_keys",
            created_at=now,
            days_until_expiration=10,
            severity=Severity.WARNING,
            message="Expires soon",
        )
        recommendations = get_recommendations(secret)
        self.assertTrue(any("Schedule rotation" in rec for rec in recommendations))

    def test_no_rotation_policy(self):
        """Test recommendations for secret without rotation policy."""
        now = datetime.now(timezone.utc)
        secret = SecretStatus(
            key_name="TEST_KEY",
            status="active",
            expires_at=None,
            last_rotated_at=None,
            rotation_policy=None,
            created_at=now,
            days_until_expiration=None,
            severity=Severity.OK,
            message="No expiration",
        )
        recommendations = get_recommendations(secret)
        self.assertTrue(any("rotation policy" in rec for rec in recommendations))

    def test_no_expiration_date(self):
        """Test recommendations for secret without expiration."""
        now = datetime.now(timezone.utc)
        secret = SecretStatus(
            key_name="TEST_KEY",
            status="active",
            expires_at=None,
            last_rotated_at=None,
            rotation_policy="api_keys",
            created_at=now,
            days_until_expiration=None,
            severity=Severity.OK,
            message="No expiration",
        )
        recommendations = get_recommendations(secret)
        self.assertTrue(any("expiration date" in rec for rec in recommendations))


class TestAnalyzeSecret(unittest.TestCase):
    """Tests for analyze_secret function."""

    def test_analyze_active_secret(self):
        """Test analyzing an active secret."""
        now = datetime.now(timezone.utc)
        future = now + timedelta(days=60)
        secret_data = {
            "key_name": "TEST_KEY",
            "status": "active",
            "expires_at": future,
            "last_rotated_at": now,
            "rotation_policy": "api_keys",
            "created_at": now,
        }
        result = analyze_secret(secret_data, 30)
        self.assertEqual(result.key_name, "TEST_KEY")
        self.assertEqual(result.status, "active")
        self.assertEqual(result.severity, Severity.OK)

    def test_analyze_expired_secret(self):
        """Test analyzing an expired secret."""
        now = datetime.now(timezone.utc)
        past = now - timedelta(days=10)
        secret_data = {
            "key_name": "EXPIRED_KEY",
            "status": "expired",
            "expires_at": past,
            "last_rotated_at": None,
            "rotation_policy": "api_keys",
            "created_at": now,
        }
        result = analyze_secret(secret_data, 30)
        self.assertEqual(result.severity, Severity.CRITICAL)
        self.assertTrue("EXPIRED" in result.message)

    def test_analyze_expiring_soon(self):
        """Test analyzing a secret expiring soon."""
        now = datetime.now(timezone.utc)
        soon = now + timedelta(days=5)
        secret_data = {
            "key_name": "EXPIRING_KEY",
            "status": "active",
            "expires_at": soon,
            "last_rotated_at": None,
            "rotation_policy": "api_keys",
            "created_at": now,
        }
        result = analyze_secret(secret_data, 30)
        self.assertEqual(result.severity, Severity.CRITICAL)
        self.assertIsNotNone(result.days_until_expiration)

    def test_analyze_no_expiration(self):
        """Test analyzing a secret with no expiration."""
        now = datetime.now(timezone.utc)
        secret_data = {
            "key_name": "NO_EXPIRY_KEY",
            "status": "active",
            "expires_at": None,
            "last_rotated_at": None,
            "rotation_policy": None,
            "created_at": now,
        }
        result = analyze_secret(secret_data, 30)
        self.assertIsNone(result.days_until_expiration)
        self.assertEqual(result.severity, Severity.OK)


class TestGenerateSummary(unittest.TestCase):
    """Tests for generate_summary function."""

    def test_empty_secrets_list(self):
        """Test generating summary with no secrets."""
        summary = generate_summary([])
        self.assertEqual(summary.total_secrets, 0)
        self.assertEqual(summary.expired, 0)
        self.assertEqual(summary.critical_alerts, 0)

    def test_summary_with_mixed_secrets(self):
        """Test generating summary with various secret states."""
        now = datetime.now(timezone.utc)
        secrets = [
            SecretStatus(
                key_name="EXPIRED",
                status="expired",
                expires_at=now - timedelta(days=1),
                last_rotated_at=None,
                rotation_policy="api_keys",
                created_at=now,
                days_until_expiration=-1,
                severity=Severity.CRITICAL,
                message="Expired",
            ),
            SecretStatus(
                key_name="WARNING",
                status="active",
                expires_at=now + timedelta(days=10),
                last_rotated_at=None,
                rotation_policy="api_keys",
                created_at=now,
                days_until_expiration=10,
                severity=Severity.WARNING,
                message="Expiring soon",
            ),
            SecretStatus(
                key_name="OK",
                status="active",
                expires_at=now + timedelta(days=60),
                last_rotated_at=None,
                rotation_policy="api_keys",
                created_at=now,
                days_until_expiration=60,
                severity=Severity.OK,
                message="Active",
            ),
        ]
        summary = generate_summary(secrets)
        self.assertEqual(summary.total_secrets, 3)
        self.assertEqual(summary.critical_alerts, 1)
        self.assertEqual(summary.warning_alerts, 1)
        self.assertEqual(summary.expired, 1)


class TestDetermineExitCode(unittest.TestCase):
    """Tests for determine_exit_code function."""

    def test_non_ci_mode_always_zero(self):
        """Test that non-CI mode always returns 0."""
        summary = ExpirationSummary(
            total_secrets=1,
            expired=1,
            expiring_soon=0,
            no_expiration=0,
            active=0,
            critical_alerts=1,
            warning_alerts=0,
            info_alerts=0,
            secrets=[],
        )
        self.assertEqual(determine_exit_code(summary, ci_mode=False), 0)

    def test_ci_mode_with_expired(self):
        """Test that CI mode returns 2 for expired secrets."""
        summary = ExpirationSummary(
            total_secrets=1,
            expired=1,
            expiring_soon=0,
            no_expiration=0,
            active=0,
            critical_alerts=1,
            warning_alerts=0,
            info_alerts=0,
            secrets=[],
        )
        self.assertEqual(determine_exit_code(summary, ci_mode=True), 2)

    def test_ci_mode_with_critical(self):
        """Test that CI mode returns 2 for critical alerts."""
        summary = ExpirationSummary(
            total_secrets=1,
            expired=0,
            expiring_soon=1,
            no_expiration=0,
            active=0,
            critical_alerts=1,
            warning_alerts=0,
            info_alerts=0,
            secrets=[],
        )
        self.assertEqual(determine_exit_code(summary, ci_mode=True), 2)

    def test_ci_mode_with_warning(self):
        """Test that CI mode returns 1 for warning alerts."""
        summary = ExpirationSummary(
            total_secrets=1,
            expired=0,
            expiring_soon=1,
            no_expiration=0,
            active=0,
            critical_alerts=0,
            warning_alerts=1,
            info_alerts=0,
            secrets=[],
        )
        self.assertEqual(determine_exit_code(summary, ci_mode=True), 1)

    def test_ci_mode_all_ok(self):
        """Test that CI mode returns 0 when all is ok."""
        summary = ExpirationSummary(
            total_secrets=1,
            expired=0,
            expiring_soon=0,
            no_expiration=0,
            active=1,
            critical_alerts=0,
            warning_alerts=0,
            info_alerts=0,
            secrets=[],
        )
        self.assertEqual(determine_exit_code(summary, ci_mode=True), 0)


if __name__ == '__main__':
    unittest.main()
