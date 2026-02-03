#!/usr/bin/env python3
"""Tests for homebrew status module."""

import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "homebrew"))

from homebrew.status import (
    DEFAULT_PORTS,
    REDIS_PASSWORD,
    ServiceStatus,
    check_port_in_use,
    check_process_running,
    get_nodejs_info,
    get_postgresql_status,
    get_redis_status,
    run_command,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_default_ports(self):
        """Test default ports are defined."""
        self.assertIn(6379, DEFAULT_PORTS)
        self.assertIn(5432, DEFAULT_PORTS)
        self.assertIn(3000, DEFAULT_PORTS)
        self.assertIn(8080, DEFAULT_PORTS)

    def test_redis_password(self):
        """Test Redis password is defined."""
        self.assertIsInstance(REDIS_PASSWORD, str)
        self.assertTrue(len(REDIS_PASSWORD) > 0)


class TestServiceStatus(TestCase):
    """Tests for ServiceStatus dataclass."""

    def test_default_values(self):
        """Test default values."""
        status = ServiceStatus(name="Test")
        self.assertEqual(status.name, "Test")
        self.assertFalse(status.running)
        self.assertEqual(status.version, "")
        self.assertEqual(status.port, 0)
        self.assertEqual(status.details, {})

    def test_custom_values(self):
        """Test custom values."""
        status = ServiceStatus(
            name="Redis",
            running=True,
            version="7.0.0",
            port=6379,
            details={"uptime": "1000"}
        )
        self.assertEqual(status.name, "Redis")
        self.assertTrue(status.running)
        self.assertEqual(status.version, "7.0.0")
        self.assertEqual(status.port, 6379)
        self.assertEqual(status.details["uptime"], "1000")


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


class TestCheckProcessRunning(TestCase):
    """Tests for check_process_running function."""

    @mock.patch('homebrew.status.run_command')
    def test_process_running(self, mock_run):
        """Test when process is running."""
        mock_run.return_value = (0, "1234", "")

        result = check_process_running("test-process")

        self.assertTrue(result)

    @mock.patch('homebrew.status.run_command')
    def test_process_not_running(self, mock_run):
        """Test when process is not running."""
        mock_run.return_value = (1, "", "")

        result = check_process_running("test-process")

        self.assertFalse(result)


class TestCheckPortInUse(TestCase):
    """Tests for check_port_in_use function."""

    @mock.patch('homebrew.status.run_command')
    def test_port_in_use(self, mock_run):
        """Test when port is in use."""
        mock_run.return_value = (0, "process 1234 LISTEN", "")

        result = check_port_in_use(6379)

        self.assertTrue(result)

    @mock.patch('homebrew.status.run_command')
    def test_port_not_in_use(self, mock_run):
        """Test when port is not in use."""
        mock_run.return_value = (1, "", "")

        result = check_port_in_use(6379)

        self.assertFalse(result)

    @mock.patch('homebrew.status.run_command')
    def test_port_no_listen(self, mock_run):
        """Test when lsof returns but no LISTEN."""
        mock_run.return_value = (0, "some output", "")

        result = check_port_in_use(6379)

        self.assertFalse(result)


class TestGetRedisStatus(TestCase):
    """Tests for get_redis_status function."""

    @mock.patch('homebrew.status.run_command')
    @mock.patch('homebrew.status.check_process_running')
    def test_redis_running(self, mock_check, mock_run):
        """Test when Redis is running."""
        mock_check.return_value = True
        mock_run.return_value = (0, "redis_version:7.0.0\nuptime_in_seconds:1000\n", "")

        status = get_redis_status()

        self.assertEqual(status.name, "Redis")
        self.assertTrue(status.running)
        self.assertEqual(status.version, "7.0.0")
        self.assertEqual(status.port, 6379)
        self.assertEqual(status.details["uptime_seconds"], "1000")

    @mock.patch('homebrew.status.check_process_running')
    def test_redis_not_running(self, mock_check):
        """Test when Redis is not running."""
        mock_check.return_value = False

        status = get_redis_status()

        self.assertEqual(status.name, "Redis")
        self.assertFalse(status.running)
        self.assertEqual(status.port, 6379)


class TestGetPostgresqlStatus(TestCase):
    """Tests for get_postgresql_status function."""

    @mock.patch('homebrew.status.run_command')
    def test_postgresql_running(self, mock_run):
        """Test when PostgreSQL is running."""
        # First call: brew services list
        # Second call: psql version
        mock_run.side_effect = [
            (0, "postgresql@16  started  user\n", ""),
            (0, "PostgreSQL 16.0 on ...\n", "")
        ]

        status = get_postgresql_status()

        self.assertEqual(status.name, "PostgreSQL 16")
        self.assertTrue(status.running)
        self.assertEqual(status.port, 5432)

    @mock.patch('homebrew.status.run_command')
    def test_postgresql_not_running(self, mock_run):
        """Test when PostgreSQL is not running."""
        mock_run.return_value = (0, "postgresql@16  stopped  user\n", "")

        status = get_postgresql_status()

        self.assertEqual(status.name, "PostgreSQL 16")
        self.assertFalse(status.running)


class TestGetNodejsInfo(TestCase):
    """Tests for get_nodejs_info function."""

    @mock.patch('homebrew.status.run_command')
    @mock.patch('homebrew.status.shutil.which')
    def test_nodejs_installed(self, mock_which, mock_run):
        """Test when Node.js is installed."""
        mock_which.return_value = "/usr/local/bin/node"
        mock_run.side_effect = [
            (0, "v20.0.0\n", ""),
            (0, "10.0.0\n", "")
        ]

        status = get_nodejs_info()

        self.assertEqual(status.name, "Node.js")
        self.assertTrue(status.running)
        self.assertEqual(status.version, "v20.0.0")
        self.assertEqual(status.details["npm_version"], "10.0.0")
        self.assertEqual(status.details["location"], "/usr/local/bin/node")

    @mock.patch('homebrew.status.shutil.which')
    def test_nodejs_not_installed(self, mock_which):
        """Test when Node.js is not installed."""
        mock_which.return_value = None

        status = get_nodejs_info()

        self.assertEqual(status.name, "Node.js")
        self.assertFalse(status.running)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('homebrew.status.print_footer')
    @mock.patch('homebrew.status.print_port_status')
    @mock.patch('homebrew.status.print_nodejs_info')
    @mock.patch('homebrew.status.print_service_status')
    @mock.patch('homebrew.status.get_nodejs_info')
    @mock.patch('homebrew.status.get_postgresql_status')
    @mock.patch('homebrew.status.get_redis_status')
    @mock.patch('homebrew.status.print_header')
    def test_main_all_services(
        self,
        mock_header,
        mock_redis,
        mock_postgres,
        mock_node,
        mock_print_service,
        mock_print_node,
        mock_print_ports,
        mock_footer
    ):
        """Test main shows all services."""
        from homebrew.status import main

        mock_redis.return_value = ServiceStatus(name="Redis")
        mock_postgres.return_value = ServiceStatus(name="PostgreSQL")
        mock_node.return_value = ServiceStatus(name="Node.js")

        result = main()

        self.assertEqual(result, 0)
        mock_header.assert_called_once()
        mock_redis.assert_called_once()
        mock_postgres.assert_called_once()
        mock_node.assert_called_once()
        mock_print_ports.assert_called_once()
        mock_footer.assert_called_once()

    @mock.patch('homebrew.status.print_footer')
    @mock.patch('homebrew.status.print_port_status')
    @mock.patch('homebrew.status.print_nodejs_info')
    @mock.patch('homebrew.status.print_service_status')
    @mock.patch('homebrew.status.get_redis_status')
    @mock.patch('homebrew.status.print_header')
    def test_main_skip_services(
        self,
        mock_header,
        mock_redis,
        mock_print_service,
        mock_print_node,
        mock_print_ports,
        mock_footer
    ):
        """Test main with services skipped."""
        from homebrew.status import main

        mock_redis.return_value = ServiceStatus(name="Redis")

        result = main(
            show_redis=True,
            show_postgres=False,
            show_node=False,
            show_ports=False
        )

        self.assertEqual(result, 0)
        mock_redis.assert_called_once()
        mock_print_ports.assert_not_called()

    @mock.patch('homebrew.status.print_footer')
    @mock.patch('homebrew.status.print_port_status')
    @mock.patch('homebrew.status.print_header')
    def test_main_custom_ports(
        self,
        mock_header,
        mock_print_ports,
        mock_footer
    ):
        """Test main with custom ports."""
        from homebrew.status import main

        result = main(
            show_redis=False,
            show_postgres=False,
            show_node=False,
            show_ports=True,
            ports=[8000, 9000]
        )

        self.assertEqual(result, 0)
        mock_print_ports.assert_called_once_with([8000, 9000])


if __name__ == '__main__':
    import unittest
    unittest.main()
