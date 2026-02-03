#!/usr/bin/env python3
"""Tests for deploy_vibecode module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "openindiana"))

from openindiana.deploy_vibecode import (
    HEALTH_SCRIPT,
    LOGROTATE_TEMPLATE,
    RESTART_SCRIPT,
    SYSTEMD_SERVICE_TEMPLATE,
    UPDATE_SCRIPT,
    DeployConfig,
    generate_env_content,
    log_error,
    log_info,
    log_warn,
    read_database_url,
    run_command,
)


class TestDeployConfig(TestCase):
    """Tests for DeployConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = DeployConfig()
        self.assertEqual(config.app_user, "vibecode")
        self.assertEqual(config.app_port, 3000)
        self.assertEqual(config.install_dir, Path("/opt/vibecode-webgui"))

    def test_custom_values(self):
        """Test custom configuration values."""
        config = DeployConfig(
            app_user="custom",
            app_port=8080,
            install_dir=Path("/custom/path")
        )
        self.assertEqual(config.app_user, "custom")
        self.assertEqual(config.app_port, 8080)
        self.assertEqual(config.install_dir, Path("/custom/path"))


class TestTemplates(TestCase):
    """Tests for template strings."""

    def test_systemd_template_has_placeholders(self):
        """Test systemd template has required placeholders."""
        self.assertIn("{app_user}", SYSTEMD_SERVICE_TEMPLATE)
        self.assertIn("{install_dir}", SYSTEMD_SERVICE_TEMPLATE)
        self.assertIn("{app_port}", SYSTEMD_SERVICE_TEMPLATE)

    def test_systemd_template_format(self):
        """Test systemd template can be formatted."""
        result = SYSTEMD_SERVICE_TEMPLATE.format(
            app_user="vibecode",
            install_dir="/opt/vibecode",
            app_port=3000
        )
        self.assertIn("User=vibecode", result)
        self.assertIn("PORT=3000", result)

    def test_logrotate_template_has_placeholder(self):
        """Test logrotate template has app_user placeholder."""
        self.assertIn("{app_user}", LOGROTATE_TEMPLATE)

    def test_health_script_has_curl(self):
        """Test health script uses curl."""
        self.assertIn("curl", HEALTH_SCRIPT)
        self.assertIn("localhost:3000", HEALTH_SCRIPT)

    def test_restart_script_has_systemctl(self):
        """Test restart script uses systemctl."""
        self.assertIn("systemctl restart vibecode", RESTART_SCRIPT)

    def test_update_script_has_npm(self):
        """Test update script has npm commands."""
        self.assertIn("npm install", UPDATE_SCRIPT)
        self.assertIn("npm run build", UPDATE_SCRIPT)


class TestLogFunctions(TestCase):
    """Tests for logging functions."""

    @mock.patch('builtins.print')
    def test_log_info(self, mock_print):
        """Test log_info outputs correctly."""
        log_info("Test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[INFO]", call_args)
        self.assertIn("Test message", call_args)

    @mock.patch('builtins.print')
    def test_log_warn(self, mock_print):
        """Test log_warn outputs correctly."""
        log_warn("Warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[WARN]", call_args)

    @mock.patch('builtins.print')
    def test_log_error(self, mock_print):
        """Test log_error outputs correctly."""
        log_error("Error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[ERROR]", call_args)


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

    def test_with_working_directory(self):
        """Test command with working directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            rc, stdout, stderr = run_command(
                ["pwd"],
                cwd=Path(tmpdir)
            )
            self.assertEqual(rc, 0)
            self.assertIn(tmpdir, stdout)


class TestReadDatabaseUrl(TestCase):
    """Tests for read_database_url function."""

    def test_reads_database_url(self):
        """Test reading DATABASE_URL from file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write('DATABASE_URL="postgresql://user:pass@localhost/db"\n')
            f.write('OTHER_VAR="value"\n')
            f.flush()

            config = DeployConfig(credentials_file=Path(f.name))
            result = read_database_url(config)

            self.assertEqual(result, "postgresql://user:pass@localhost/db")

        Path(f.name).unlink()

    def test_returns_none_for_missing_file(self):
        """Test returns None for missing file."""
        config = DeployConfig(credentials_file=Path("/nonexistent/file"))
        result = read_database_url(config)
        self.assertIsNone(result)

    def test_returns_none_for_missing_var(self):
        """Test returns None when DATABASE_URL not in file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write('OTHER_VAR="value"\n')
            f.flush()

            config = DeployConfig(credentials_file=Path(f.name))
            result = read_database_url(config)

            self.assertIsNone(result)

        Path(f.name).unlink()


class TestGenerateEnvContent(TestCase):
    """Tests for generate_env_content function."""

    def test_generates_env_content(self):
        """Test generating .env content."""
        config = DeployConfig(app_port=3000)
        db_url = "postgresql://user:pass@localhost/db"

        result = generate_env_content(config, db_url)

        self.assertIn('DATABASE_URL="postgresql://user:pass@localhost/db"', result)
        self.assertIn('PORT="3000"', result)
        self.assertIn('NODE_ENV="production"', result)

    def test_includes_secrets(self):
        """Test env content includes generated secrets."""
        config = DeployConfig()
        result = generate_env_content(config, "postgres://localhost/db")

        self.assertIn('NEXTAUTH_SECRET="', result)
        self.assertIn('API_KEY="', result)

    def test_secrets_are_unique(self):
        """Test secrets are different each time."""
        config = DeployConfig()

        result1 = generate_env_content(config, "postgres://localhost/db")
        result2 = generate_env_content(config, "postgres://localhost/db")

        # Extract NEXTAUTH_SECRET values
        secret1 = [l for l in result1.split('\n') if 'NEXTAUTH_SECRET' in l][0]
        secret2 = [l for l in result2.split('\n') if 'NEXTAUTH_SECRET' in l][0]

        self.assertNotEqual(secret1, secret2)


class TestCheckEnvironment(TestCase):
    """Tests for check_environment function."""

    @mock.patch('openindiana.deploy_vibecode.os.geteuid')
    @mock.patch('openindiana.deploy_vibecode.Path.exists')
    def test_not_debian(self, mock_exists, mock_geteuid):
        """Test fails when not Debian."""
        from openindiana.deploy_vibecode import check_environment

        mock_exists.return_value = False

        result = check_environment()

        self.assertFalse(result)

    @mock.patch('openindiana.deploy_vibecode.os.geteuid')
    @mock.patch('openindiana.deploy_vibecode.Path.exists')
    def test_not_root(self, mock_exists, mock_geteuid):
        """Test fails when not root."""
        from openindiana.deploy_vibecode import check_environment

        mock_exists.return_value = True
        mock_geteuid.return_value = 1000

        result = check_environment()

        self.assertFalse(result)

    @mock.patch('openindiana.deploy_vibecode.os.geteuid')
    @mock.patch('openindiana.deploy_vibecode.Path.exists')
    def test_valid_environment(self, mock_exists, mock_geteuid):
        """Test passes with valid environment."""
        from openindiana.deploy_vibecode import check_environment

        mock_exists.return_value = True
        mock_geteuid.return_value = 0

        result = check_environment()

        self.assertTrue(result)


class TestCreateAppUser(TestCase):
    """Tests for create_app_user function."""

    @mock.patch('openindiana.deploy_vibecode.run_command')
    def test_user_exists(self, mock_run):
        """Test when user already exists."""
        from openindiana.deploy_vibecode import create_app_user

        mock_run.return_value = (0, "", "")
        config = DeployConfig()

        result = create_app_user(config)

        self.assertTrue(result)
        # Should only call 'id' to check, not 'useradd'
        self.assertEqual(mock_run.call_count, 1)

    @mock.patch('openindiana.deploy_vibecode.run_command')
    def test_creates_user(self, mock_run):
        """Test creating new user."""
        from openindiana.deploy_vibecode import create_app_user

        # First call (id) fails, second (useradd) succeeds
        mock_run.side_effect = [(1, "", ""), (0, "", "")]
        config = DeployConfig()

        result = create_app_user(config)

        self.assertTrue(result)
        self.assertEqual(mock_run.call_count, 2)


class TestSetupLogRotation(TestCase):
    """Tests for setup_log_rotation function."""

    @mock.patch('openindiana.deploy_vibecode.Path.write_text')
    def test_creates_logrotate_config(self, mock_write):
        """Test creates logrotate config file."""
        from openindiana.deploy_vibecode import setup_log_rotation

        config = DeployConfig(app_user="testuser")

        result = setup_log_rotation(config)

        self.assertTrue(result)
        mock_write.assert_called_once()
        written_content = mock_write.call_args[0][0]
        self.assertIn("testuser", written_content)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('openindiana.deploy_vibecode.show_summary')
    @mock.patch('openindiana.deploy_vibecode.test_application')
    @mock.patch('openindiana.deploy_vibecode.start_application')
    @mock.patch('openindiana.deploy_vibecode.create_maintenance_scripts')
    @mock.patch('openindiana.deploy_vibecode.setup_log_rotation')
    @mock.patch('openindiana.deploy_vibecode.configure_firewall')
    @mock.patch('openindiana.deploy_vibecode.create_systemd_service')
    @mock.patch('openindiana.deploy_vibecode.build_application')
    @mock.patch('openindiana.deploy_vibecode.configure_environment')
    @mock.patch('openindiana.deploy_vibecode.install_dependencies')
    @mock.patch('openindiana.deploy_vibecode.clone_repository')
    @mock.patch('openindiana.deploy_vibecode.create_app_user')
    def test_main_skip_checks(
        self,
        mock_user,
        mock_clone,
        mock_deps,
        mock_env,
        mock_build,
        mock_service,
        mock_firewall,
        mock_logrotate,
        mock_maintenance,
        mock_start,
        mock_test,
        mock_summary
    ):
        """Test main with skip_checks flag."""
        from openindiana.deploy_vibecode import main

        mock_user.return_value = True
        mock_clone.return_value = True
        mock_deps.return_value = True
        mock_env.return_value = True
        mock_build.return_value = True
        mock_service.return_value = True
        mock_firewall.return_value = True
        mock_logrotate.return_value = True
        mock_maintenance.return_value = True
        mock_start.return_value = True
        mock_test.return_value = True

        result = main(skip_checks=True)

        self.assertEqual(result, 0)
        mock_user.assert_called_once()

    @mock.patch('openindiana.deploy_vibecode.create_app_user')
    @mock.patch('openindiana.deploy_vibecode.check_prerequisites')
    @mock.patch('openindiana.deploy_vibecode.check_environment')
    def test_main_fails_on_env_check(
        self,
        mock_env_check,
        mock_prereq,
        mock_user
    ):
        """Test main fails on environment check."""
        from openindiana.deploy_vibecode import main

        mock_env_check.return_value = False

        result = main()

        self.assertEqual(result, 1)
        mock_user.assert_not_called()


if __name__ == '__main__':
    import unittest
    unittest.main()
