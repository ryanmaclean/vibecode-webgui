"""Tests for scripts/openindiana/deploy_vibecode_oi.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "openindiana"))

from deploy_vibecode_oi import (
    HEALTH_SCRIPT,
    RESTART_SCRIPT,
    UPDATE_SCRIPT,
    DeployConfig,
    build_application,
    check_environment,
    check_prerequisites,
    clone_repository,
    configure_environment,
    configure_firewall,
    create_app_user,
    create_maintenance_scripts,
    create_systemd_service,
    generate_env_content,
    generate_logrotate_config,
    generate_systemd_service,
    get_zone_ip,
    install_dependencies,
    log_error,
    log_info,
    log_success,
    log_warning,
    read_database_url,
    run_command,
    run_deploy,
    setup_log_rotation,
    show_summary,
    start_application,
    check_application_endpoint,
)


class TestDeployConfig:
    """Tests for DeployConfig dataclass."""

    def test_default_config(self) -> None:
        """Should create config with default values."""
        config = DeployConfig()
        assert config.repo_url == "https://github.com/your-org/vibecode-webgui.git"
        assert config.install_dir == Path("/opt/vibecode-webgui")
        assert config.app_user == "vibecode"
        assert config.app_port == 3000

    def test_env_file(self) -> None:
        """Should compute env_file correctly."""
        config = DeployConfig()
        assert config.env_file == config.install_dir / ".env"

    def test_service_file(self) -> None:
        """Should compute service_file correctly."""
        config = DeployConfig()
        assert config.service_file == Path("/etc/systemd/system/vibecode.service")

    def test_logrotate_file(self) -> None:
        """Should compute logrotate_file correctly."""
        config = DeployConfig()
        assert config.logrotate_file == Path("/etc/logrotate.d/vibecode")

    def test_custom_config(self, tmp_path: Path) -> None:
        """Should accept custom values."""
        config = DeployConfig(
            install_dir=tmp_path,
            app_user="testuser",
            app_port=8080,
        )
        assert config.install_dir == tmp_path
        assert config.app_user == "testuser"
        assert config.app_port == 8080


class TestLogFunctions:
    """Tests for log helper functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should print info message."""
        log_info("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        log_success("Success")
        captured = capsys.readouterr()
        assert "Success" in captured.out

    def test_log_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning message."""
        log_warning("Warning")
        captured = capsys.readouterr()
        assert "Warning" in captured.out

    def test_log_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error message."""
        log_error("Error")
        captured = capsys.readouterr()
        assert "Error" in captured.out


class TestRunCommand:
    """Tests for run_command function."""

    @patch("deploy_vibecode_oi.subprocess.run")
    def test_returns_result_on_success(self, mock_run: MagicMock) -> None:
        """Should return subprocess result on success."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output", stderr="")
        result = run_command(["echo", "test"])
        assert result.returncode == 0

    @patch("deploy_vibecode_oi.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock) -> None:
        """Should handle timeout gracefully."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=30)
        result = run_command(["sleep", "100"], timeout=1)
        assert result.returncode == 1
        assert "Timeout" in result.stderr

    @patch("deploy_vibecode_oi.subprocess.run")
    def test_handles_subprocess_error(self, mock_run: MagicMock) -> None:
        """Should handle subprocess errors gracefully."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        result = run_command(["bad", "command"])
        assert result.returncode == 1


class TestCheckEnvironment:
    """Tests for check_environment function."""

    @patch("deploy_vibecode_oi.os.geteuid")
    @patch("deploy_vibecode_oi.Path.exists")
    def test_returns_true_in_debian_as_root(
        self, mock_exists: MagicMock, mock_geteuid: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return True when in Debian as root."""
        mock_exists.return_value = True
        mock_geteuid.return_value = 0

        assert check_environment() is True
        captured = capsys.readouterr()
        assert "Debian lx zone as root" in captured.out

    @patch("deploy_vibecode_oi.Path.exists")
    def test_returns_false_when_not_debian(
        self, mock_exists: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when not Debian."""
        mock_exists.return_value = False

        assert check_environment() is False
        captured = capsys.readouterr()
        assert "Debian lx zone" in captured.out

    @patch("deploy_vibecode_oi.os.geteuid")
    @patch("deploy_vibecode_oi.Path.exists")
    def test_returns_false_when_not_root(
        self, mock_exists: MagicMock, mock_geteuid: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when not root."""
        mock_exists.return_value = True
        mock_geteuid.return_value = 1000

        assert check_environment() is False
        captured = capsys.readouterr()
        assert "root" in captured.out


class TestCheckPrerequisites:
    """Tests for check_prerequisites function."""

    @patch("deploy_vibecode_oi.shutil.which")
    def test_returns_false_when_node_missing(
        self, mock_which: MagicMock, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when Node.js not found."""
        mock_which.return_value = None
        config = DeployConfig(install_dir=tmp_path)

        assert check_prerequisites(config) is False
        captured = capsys.readouterr()
        assert "Node.js not found" in captured.out

    @patch("deploy_vibecode_oi.run_command")
    @patch("deploy_vibecode_oi.shutil.which")
    def test_returns_false_when_postgres_not_running(
        self, mock_which: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when PostgreSQL not running."""
        mock_which.return_value = "/usr/bin/node"
        mock_run.side_effect = [
            MagicMock(returncode=0, stdout="v24.0.0"),  # node --version
            MagicMock(returncode=1),  # systemctl is-active postgresql
        ]
        config = DeployConfig(install_dir=tmp_path)

        assert check_prerequisites(config) is False

    @patch("deploy_vibecode_oi.run_command")
    @patch("deploy_vibecode_oi.shutil.which")
    def test_returns_true_when_all_pass(
        self, mock_which: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True when all prerequisites pass."""
        mock_which.return_value = "/usr/bin/node"
        mock_run.side_effect = [
            MagicMock(returncode=0, stdout="v24.0.0"),  # node --version
            MagicMock(returncode=0),  # systemctl is-active postgresql
        ]
        config = DeployConfig(install_dir=tmp_path, credentials_file=tmp_path / "creds.txt")
        (tmp_path / "creds.txt").write_text("DATABASE_URL=test")

        assert check_prerequisites(config) is True


class TestCreateAppUser:
    """Tests for create_app_user function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_returns_true_when_user_exists(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True when user already exists."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(install_dir=tmp_path)

        assert create_app_user(config) is True

    @patch("deploy_vibecode_oi.run_command")
    def test_creates_user_when_not_exists(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should create user when not exists."""
        mock_run.side_effect = [
            MagicMock(returncode=1),  # id fails - user doesn't exist
            MagicMock(returncode=0),  # useradd succeeds
        ]
        config = DeployConfig(install_dir=tmp_path)

        assert create_app_user(config) is True


class TestCloneRepository:
    """Tests for clone_repository function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_pulls_when_dir_exists(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should pull when directory exists."""
        install_dir = tmp_path / "app"
        install_dir.mkdir()
        mock_run.side_effect = [
            MagicMock(returncode=0),  # git pull
            MagicMock(returncode=0, stdout="main"),  # git branch
            MagicMock(returncode=0, stdout="abc1234 Initial commit"),  # git log
        ]
        config = DeployConfig(install_dir=install_dir)

        assert clone_repository(config) is True

    @patch("deploy_vibecode_oi.run_command")
    def test_clones_when_dir_not_exists(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should clone when directory doesn't exist."""
        mock_run.side_effect = [
            MagicMock(returncode=0),  # git clone
            MagicMock(returncode=0, stdout="main"),  # git branch
            MagicMock(returncode=0, stdout="abc1234 Initial commit"),  # git log
        ]
        config = DeployConfig(install_dir=tmp_path / "app")

        assert clone_repository(config) is True


class TestInstallDependencies:
    """Tests for install_dependencies function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_runs_npm_install(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should run npm install."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(install_dir=tmp_path)

        assert install_dependencies(config) is True
        call_args = mock_run.call_args[0][0]
        assert "npm" in call_args
        assert "install" in call_args

    @patch("deploy_vibecode_oi.run_command")
    def test_returns_false_on_failure(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return False on npm install failure."""
        mock_run.return_value = MagicMock(returncode=1, stderr="error")
        config = DeployConfig(install_dir=tmp_path)

        assert install_dependencies(config) is False


class TestReadDatabaseUrl:
    """Tests for read_database_url function."""

    def test_reads_url_from_file(self, tmp_path: Path) -> None:
        """Should read DATABASE_URL from credentials file."""
        creds = tmp_path / "creds.txt"
        creds.write_text('DATABASE_URL="postgresql://localhost/test"')
        config = DeployConfig(credentials_file=creds)

        result = read_database_url(config)
        assert result == "postgresql://localhost/test"

    def test_returns_none_when_not_found(self, tmp_path: Path) -> None:
        """Should return None when DATABASE_URL not found."""
        creds = tmp_path / "creds.txt"
        creds.write_text("OTHER_VAR=value")
        config = DeployConfig(credentials_file=creds)

        result = read_database_url(config)
        assert result is None

    def test_returns_none_when_file_missing(self, tmp_path: Path) -> None:
        """Should return None when file doesn't exist."""
        config = DeployConfig(credentials_file=tmp_path / "missing.txt")

        result = read_database_url(config)
        assert result is None


class TestGenerateEnvContent:
    """Tests for generate_env_content function."""

    def test_generates_content(self, tmp_path: Path) -> None:
        """Should generate .env content."""
        config = DeployConfig(install_dir=tmp_path, app_port=3000)
        content = generate_env_content(config, "postgresql://localhost/test")

        assert "DATABASE_URL" in content
        assert "NEXTAUTH_SECRET" in content
        assert "API_KEY" in content
        assert "3000" in content

    def test_includes_db_url(self, tmp_path: Path) -> None:
        """Should include database URL."""
        config = DeployConfig(install_dir=tmp_path)
        content = generate_env_content(config, "postgresql://custom/db")

        assert "postgresql://custom/db" in content


class TestConfigureEnvironment:
    """Tests for configure_environment function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_creates_env_file(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should create .env file."""
        mock_run.return_value = MagicMock(returncode=0)
        creds = tmp_path / "creds.txt"
        creds.write_text('DATABASE_URL="postgresql://localhost/test"')
        install_dir = tmp_path / "app"
        install_dir.mkdir()
        config = DeployConfig(install_dir=install_dir, credentials_file=creds)

        assert configure_environment(config) is True
        assert config.env_file.exists()

    def test_returns_false_when_no_db_url(self, tmp_path: Path) -> None:
        """Should return False when DATABASE_URL not found."""
        creds = tmp_path / "creds.txt"
        creds.write_text("OTHER=value")
        config = DeployConfig(install_dir=tmp_path, credentials_file=creds)

        assert configure_environment(config) is False


class TestBuildApplication:
    """Tests for build_application function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_runs_build_steps(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should run prisma and npm build."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(install_dir=tmp_path)

        assert build_application(config) is True
        assert mock_run.call_count >= 3  # migrate, generate, build

    @patch("deploy_vibecode_oi.run_command")
    def test_returns_false_on_build_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when build fails."""
        mock_run.side_effect = [
            MagicMock(returncode=0),  # migrate
            MagicMock(returncode=0),  # generate
            MagicMock(returncode=1, stderr="build error"),  # build fails
        ]
        config = DeployConfig(install_dir=tmp_path)

        assert build_application(config) is False


class TestGenerateSystemdService:
    """Tests for generate_systemd_service function."""

    def test_generates_service(self, tmp_path: Path) -> None:
        """Should generate systemd service content."""
        config = DeployConfig(install_dir=tmp_path, app_user="testuser", app_port=8080)
        content = generate_systemd_service(config)

        assert "[Unit]" in content
        assert "[Service]" in content
        assert "[Install]" in content
        assert "testuser" in content
        assert "8080" in content
        assert str(tmp_path) in content


class TestCreateSystemdService:
    """Tests for create_systemd_service function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_creates_service(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should create systemd service file."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(
            install_dir=tmp_path,
            log_dir=tmp_path / "logs",
        )
        # Mock service_file to use temp path
        with patch.object(
            DeployConfig, "service_file",
            property(lambda self: tmp_path / "vibecode.service")
        ):
            assert create_systemd_service(config) is True


class TestConfigureFirewall:
    """Tests for configure_firewall function."""

    @patch("deploy_vibecode_oi.run_command")
    @patch("deploy_vibecode_oi.shutil.which")
    def test_configures_ufw(
        self, mock_which: MagicMock, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should configure ufw rules."""
        mock_which.return_value = "/usr/sbin/ufw"
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(install_dir=tmp_path, app_port=3000)

        assert configure_firewall(config) is True


class TestGenerateLogrotateConfig:
    """Tests for generate_logrotate_config function."""

    def test_generates_config(self, tmp_path: Path) -> None:
        """Should generate logrotate configuration."""
        config = DeployConfig(
            install_dir=tmp_path,
            app_user="testuser",
            log_dir=tmp_path / "logs",
        )
        content = generate_logrotate_config(config)

        assert "daily" in content
        assert "rotate 14" in content
        assert "compress" in content
        assert "testuser" in content


class TestSetupLogRotation:
    """Tests for setup_log_rotation function."""

    def test_creates_config(self, tmp_path: Path) -> None:
        """Should create logrotate config file."""
        config = DeployConfig(install_dir=tmp_path)
        logrotate_path = tmp_path / "logrotate.d" / "vibecode"
        logrotate_path.parent.mkdir(parents=True)

        with patch.object(
            DeployConfig, "logrotate_file",
            property(lambda self: logrotate_path)
        ):
            assert setup_log_rotation(config) is True
            assert logrotate_path.exists()


class TestCreateMaintenanceScripts:
    """Tests for create_maintenance_scripts function."""

    @patch("deploy_vibecode_oi.Path.write_text")
    @patch("deploy_vibecode_oi.Path.chmod")
    def test_creates_scripts(
        self, mock_chmod: MagicMock, mock_write: MagicMock
    ) -> None:
        """Should create all maintenance scripts."""
        assert create_maintenance_scripts() is True
        assert mock_write.call_count == 3
        assert mock_chmod.call_count == 3


class TestStartApplication:
    """Tests for start_application function."""

    @patch("deploy_vibecode_oi.time.sleep")
    @patch("deploy_vibecode_oi.run_command")
    def test_starts_service(
        self, mock_run: MagicMock, mock_sleep: MagicMock, tmp_path: Path
    ) -> None:
        """Should start systemd service."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(install_dir=tmp_path)

        assert start_application(config) is True

    @patch("deploy_vibecode_oi.time.sleep")
    @patch("deploy_vibecode_oi.run_command")
    def test_returns_false_on_failure(
        self, mock_run: MagicMock, mock_sleep: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when service fails to start."""
        mock_run.side_effect = [
            MagicMock(returncode=0),  # enable
            MagicMock(returncode=0),  # start
            MagicMock(returncode=1),  # is-active fails
        ]
        config = DeployConfig(install_dir=tmp_path)

        assert start_application(config) is False


class TestCheckApplicationEndpoint:
    """Tests for check_application_endpoint function."""

    @patch("deploy_vibecode_oi.time.sleep")
    @patch("deploy_vibecode_oi.run_command")
    def test_checks_endpoint(
        self, mock_run: MagicMock, mock_sleep: MagicMock, tmp_path: Path
    ) -> None:
        """Should check HTTP endpoint."""
        mock_run.return_value = MagicMock(returncode=0)
        config = DeployConfig(install_dir=tmp_path, app_port=3000)

        assert check_application_endpoint(config) is True


class TestGetZoneIp:
    """Tests for get_zone_ip function."""

    @patch("deploy_vibecode_oi.run_command")
    def test_extracts_ip(self, mock_run: MagicMock) -> None:
        """Should extract IP from ip addr output."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="    inet 192.168.1.100/24 brd 192.168.1.255 scope global net0\n"
        )

        result = get_zone_ip()
        assert result == "192.168.1.100"

    @patch("deploy_vibecode_oi.run_command")
    def test_returns_na_on_failure(self, mock_run: MagicMock) -> None:
        """Should return N/A on failure."""
        mock_run.return_value = MagicMock(returncode=1)

        result = get_zone_ip()
        assert result == "N/A"


class TestShowSummary:
    """Tests for show_summary function."""

    @patch("deploy_vibecode_oi.get_zone_ip")
    def test_prints_summary(
        self, mock_ip: MagicMock, tmp_path: Path, capsys: pytest.CaptureFixture
    ) -> None:
        """Should print deployment summary."""
        mock_ip.return_value = "192.168.1.100"
        config = DeployConfig(install_dir=tmp_path, app_port=3000)

        show_summary(config)
        captured = capsys.readouterr()

        assert "VibeCode Deployment Complete" in captured.out
        assert "192.168.1.100" in captured.out
        assert "3000" in captured.out
        assert "vibecode-health" in captured.out


class TestRunDeploy:
    """Tests for run_deploy function."""

    @patch("deploy_vibecode_oi.show_summary")
    @patch("deploy_vibecode_oi.check_application_endpoint")
    @patch("deploy_vibecode_oi.start_application")
    @patch("deploy_vibecode_oi.create_maintenance_scripts")
    @patch("deploy_vibecode_oi.setup_log_rotation")
    @patch("deploy_vibecode_oi.configure_firewall")
    @patch("deploy_vibecode_oi.create_systemd_service")
    @patch("deploy_vibecode_oi.build_application")
    @patch("deploy_vibecode_oi.configure_environment")
    @patch("deploy_vibecode_oi.install_dependencies")
    @patch("deploy_vibecode_oi.clone_repository")
    @patch("deploy_vibecode_oi.create_app_user")
    def test_runs_all_steps(
        self,
        mock_user: MagicMock,
        mock_clone: MagicMock,
        mock_deps: MagicMock,
        mock_env: MagicMock,
        mock_build: MagicMock,
        mock_service: MagicMock,
        mock_firewall: MagicMock,
        mock_logrotate: MagicMock,
        mock_maintenance: MagicMock,
        mock_start: MagicMock,
        mock_test: MagicMock,
        mock_summary: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should run all deployment steps."""
        # All steps succeed
        for mock in [
            mock_user, mock_clone, mock_deps, mock_env, mock_build,
            mock_service, mock_firewall, mock_logrotate, mock_maintenance,
            mock_start, mock_test,
        ]:
            mock.return_value = True

        config = DeployConfig(install_dir=tmp_path)
        result = run_deploy(config, skip_checks=True)

        assert result == 0
        mock_user.assert_called_once()
        mock_clone.assert_called_once()
        mock_summary.assert_called_once()

    @patch("deploy_vibecode_oi.create_app_user")
    def test_fails_on_user_creation_error(
        self, mock_user: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when user creation fails."""
        mock_user.return_value = False
        config = DeployConfig(install_dir=tmp_path)

        result = run_deploy(config, skip_checks=True)

        assert result == 1

    @patch("deploy_vibecode_oi.clone_repository")
    @patch("deploy_vibecode_oi.create_app_user")
    def test_fails_on_clone_error(
        self, mock_user: MagicMock, mock_clone: MagicMock, tmp_path: Path
    ) -> None:
        """Should fail when clone fails."""
        mock_user.return_value = True
        mock_clone.return_value = False
        config = DeployConfig(install_dir=tmp_path)

        result = run_deploy(config, skip_checks=True)

        assert result == 1


class TestScriptConstants:
    """Tests for script constants."""

    def test_health_script_valid(self) -> None:
        """Should have valid health check script."""
        assert "#!/bin/bash" in HEALTH_SCRIPT
        assert "curl" in HEALTH_SCRIPT
        assert "localhost:3000" in HEALTH_SCRIPT

    def test_restart_script_valid(self) -> None:
        """Should have valid restart script."""
        assert "#!/bin/bash" in RESTART_SCRIPT
        assert "systemctl restart vibecode" in RESTART_SCRIPT

    def test_update_script_valid(self) -> None:
        """Should have valid update script."""
        assert "#!/bin/bash" in UPDATE_SCRIPT
        assert "git pull" in UPDATE_SCRIPT
        assert "npm install" in UPDATE_SCRIPT
        assert "npm run build" in UPDATE_SCRIPT
