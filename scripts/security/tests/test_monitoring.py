#!/usr/bin/env python3
"""Tests for security monitoring script."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.security.monitoring import (
    Color,
    MonitoringConfig,
    SecurityMonitor,
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


class TestMonitoringConfig(unittest.TestCase):
    """Tests for MonitoringConfig dataclass."""

    def test_default_values(self):
        """Test default values."""
        config = MonitoringConfig()
        self.assertEqual(config.interval, 300)
        self.assertEqual(config.log_file, "/var/log/vibecode-security-monitor.log")
        self.assertIsNone(config.alert_webhook)
        self.assertEqual(config.max_log_size, 104857600)

    def test_custom_values(self):
        """Test setting custom values."""
        config = MonitoringConfig(
            interval=60,
            log_file="/tmp/test.log",
            alert_webhook="https://example.com/webhook",
            max_log_size=1024,
        )
        self.assertEqual(config.interval, 60)
        self.assertEqual(config.log_file, "/tmp/test.log")
        self.assertEqual(config.alert_webhook, "https://example.com/webhook")
        self.assertEqual(config.max_log_size, 1024)


class TestSecurityMonitor(unittest.TestCase):
    """Tests for SecurityMonitor class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = MonitoringConfig(
            interval=10,
            log_file="/tmp/test-security.log",
        )
        self.monitor = SecurityMonitor(self.config)

    def test_initialization(self):
        """Test monitor initialization."""
        self.assertTrue(self.monitor.running)
        self.assertEqual(self.monitor.vulnerability_scan_counter, 0)
        self.assertEqual(self.monitor.config.interval, 10)

    @patch('builtins.print')
    def test_log_message(self, mock_print):
        """Test log_message method."""
        self.monitor.log_message("Test message")
        mock_print.assert_called()

    def test_stop_sets_running_false(self):
        """Test that stop() sets running to False."""
        self.monitor.running = True
        with self.assertRaises(SystemExit):
            self.monitor.stop()
        self.assertFalse(self.monitor.running)

    @patch('subprocess.run')
    def test_check_suspicious_processes(self, mock_run):
        """Test check_suspicious_processes method."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="user 1234 0.0 0.0 normal_process",
        )
        self.monitor.check_suspicious_processes()
        mock_run.assert_called()

    @patch('subprocess.run')
    def test_check_disk_usage(self, mock_run):
        """Test check_disk_usage method."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   50G   50G  50% /",
        )
        self.monitor.check_disk_usage()
        mock_run.assert_called()


class TestMonitorAlerts(unittest.TestCase):
    """Tests for SecurityMonitor alert functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = MonitoringConfig(
            interval=10,
            alert_webhook="https://example.com/webhook",
        )
        self.monitor = SecurityMonitor(self.config)

    @patch('builtins.print')
    def test_send_alert_logs_message(self, mock_print):
        """Test that send_alert logs the message."""
        self.monitor.send_alert("HIGH", "Test alert", "Details")
        mock_print.assert_called()

    @patch('scripts.security.monitoring.urlopen')
    @patch('builtins.print')
    def test_send_alert_with_webhook(self, mock_print, mock_urlopen):
        """Test send_alert with webhook configured."""
        # Setup the mock as a proper context manager
        mock_context = MagicMock()
        mock_urlopen.return_value.__enter__ = MagicMock(return_value=mock_context)
        mock_urlopen.return_value.__exit__ = MagicMock(return_value=False)
        self.monitor.send_alert("HIGH", "Test alert")
        # Should attempt to send webhook
        mock_urlopen.assert_called()


if __name__ == '__main__':
    unittest.main()
