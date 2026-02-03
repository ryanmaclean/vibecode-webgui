"""Tests for scripts/openindiana/configure_lx_zone.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(
    0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "openindiana")
)

from configure_lx_zone import (
    ZoneConfig,
    boot_zone,
    check_root,
    configure_zone_network,
    create_snapshot,
    create_vnic,
    create_zfs_datasets,
    create_zone_config,
    detect_network,
    download_debian_image,
    install_lx_brand,
    install_zone,
    log_error,
    log_info,
    log_warn,
    run_command,
    run_configure_zone,
    show_next_steps,
    show_zone_info,
    update_system,
)


class TestZoneConfig:
    """Tests for ZoneConfig dataclass."""

    def test_creates_config_with_defaults(self) -> None:
        """Should create config with default values."""
        config = ZoneConfig()
        assert config.zone_name == "vibecode-zone"
        assert config.zone_path == "/zones/vibecode-zone"
        assert config.zone_vnic == "vibecode0"
        assert config.zone_cpus == 4
        assert config.zone_memory == "8G"

    def test_creates_config_with_custom_values(self) -> None:
        """Should create config with custom values."""
        config = ZoneConfig(
            zone_name="custom-zone",
            zone_cpus=8,
            zone_memory="16G",
        )
        assert config.zone_name == "custom-zone"
        assert config.zone_path == "/zones/custom-zone"
        assert config.zone_cpus == 8
        assert config.zone_memory == "16G"


class TestLogFunctions:
    """Tests for log helper functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should log info message."""
        log_info("Info message")
        captured = capsys.readouterr()
        assert "INFO" in captured.out
        assert "Info message" in captured.out

    def test_log_warn(self, capsys: pytest.CaptureFixture) -> None:
        """Should log warning message."""
        log_warn("Warning message")
        captured = capsys.readouterr()
        assert "WARN" in captured.out
        assert "Warning message" in captured.out

    def test_log_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should log error message."""
        log_error("Error message")
        captured = capsys.readouterr()
        assert "ERROR" in captured.out
        assert "Error message" in captured.out


class TestRunCommand:
    """Tests for run_command function."""

    @patch("configure_lx_zone.subprocess.run")
    def test_returns_result_on_success(self, mock_run: MagicMock) -> None:
        """Should return subprocess result on success."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output", stderr="")
        result = run_command(["echo", "test"])
        assert result.returncode == 0

    @patch("configure_lx_zone.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock) -> None:
        """Should handle timeout gracefully."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=30)
        result = run_command(["sleep", "100"], timeout=1)
        assert result.returncode == 1
        assert "Timeout" in result.stderr


class TestCheckRoot:
    """Tests for check_root function."""

    @patch("configure_lx_zone.os.getuid")
    def test_returns_true_when_root(self, mock_getuid: MagicMock) -> None:
        """Should return True when running as root."""
        mock_getuid.return_value = 0
        assert check_root() is True

    @patch("configure_lx_zone.os.getuid")
    def test_returns_false_when_not_root(
        self, mock_getuid: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when not running as root."""
        mock_getuid.return_value = 1000
        assert check_root() is False
        captured = capsys.readouterr()
        assert "must be run as root" in captured.out


class TestUpdateSystem:
    """Tests for update_system function."""

    @patch("configure_lx_zone.run_command")
    def test_returns_true_on_success(self, mock_run: MagicMock) -> None:
        """Should return True on successful update."""
        mock_run.return_value = MagicMock(returncode=0)
        assert update_system() is True

    @patch("configure_lx_zone.run_command")
    def test_returns_true_on_failure(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return True even on failure (with warning)."""
        mock_run.return_value = MagicMock(returncode=1)
        assert update_system() is True
        captured = capsys.readouterr()
        assert "failed" in captured.out.lower()


class TestInstallLxBrand:
    """Tests for install_lx_brand function."""

    @patch("configure_lx_zone.run_command")
    def test_returns_true_when_already_installed(self, mock_run: MagicMock) -> None:
        """Should return True when already installed."""
        mock_run.return_value = MagicMock(returncode=0)
        assert install_lx_brand() is True

    @patch("configure_lx_zone.run_command")
    def test_installs_when_missing(self, mock_run: MagicMock) -> None:
        """Should install when package is missing."""
        # First call (pkg list) returns 1 (not installed)
        # Second call (pkg install) returns 0 (success)
        # Third call (pkg list) returns 0 (verify)
        mock_run.side_effect = [
            MagicMock(returncode=1),
            MagicMock(returncode=0),
            MagicMock(returncode=0),
        ]
        assert install_lx_brand() is True


class TestDownloadDebianImage:
    """Tests for download_debian_image function."""

    def test_returns_true_when_image_exists(self, tmp_path: Path) -> None:
        """Should return True when image already exists."""
        config = ZoneConfig(debian_image=str(tmp_path / "test.zss"))
        (tmp_path / "test.zss").write_text("image")
        assert download_debian_image(config) is True

    @patch("configure_lx_zone.run_command")
    def test_downloads_and_decompresses(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should download and decompress image."""
        config = ZoneConfig(debian_image=str(tmp_path / "test.zss"))
        mock_run.return_value = MagicMock(returncode=0)

        # Create compressed file to simulate download
        (tmp_path / "test.zss.gz").write_text("compressed")

        # Mock gunzip to create uncompressed file
        def side_effect(cmd, **kwargs):
            if cmd[0] == "gunzip":
                (tmp_path / "test.zss").write_text("uncompressed")
            return MagicMock(returncode=0)

        mock_run.side_effect = side_effect
        # First call is curl, second is gunzip
        assert download_debian_image(config) is True


class TestDetectNetwork:
    """Tests for detect_network function."""

    @patch("configure_lx_zone.run_command")
    def test_detects_network(self, mock_run: MagicMock) -> None:
        """Should detect primary network interface."""
        mock_run.return_value = MagicMock(returncode=0, stdout="e1000g0\n")
        config = ZoneConfig()
        assert detect_network(config) is True
        assert config.primary_nic == "e1000g0"

    @patch("configure_lx_zone.run_command")
    def test_fails_when_no_network(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should fail when no network found."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        config = ZoneConfig()
        assert detect_network(config) is False


class TestCreateVnic:
    """Tests for create_vnic function."""

    @patch("configure_lx_zone.run_command")
    def test_creates_vnic(self, mock_run: MagicMock) -> None:
        """Should create VNIC successfully."""
        mock_run.return_value = MagicMock(returncode=0)
        config = ZoneConfig(primary_nic="e1000g0")
        assert create_vnic(config) is True


class TestCreateZfsDatasets:
    """Tests for create_zfs_datasets function."""

    @patch("configure_lx_zone.run_command")
    def test_creates_datasets(self, mock_run: MagicMock) -> None:
        """Should create ZFS datasets."""
        mock_run.return_value = MagicMock(returncode=0)
        config = ZoneConfig()
        assert create_zfs_datasets(config) is True


class TestCreateZoneConfig:
    """Tests for create_zone_config function."""

    @patch("configure_lx_zone.run_command")
    def test_creates_zone_config(self, mock_run: MagicMock) -> None:
        """Should create zone configuration."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        config = ZoneConfig()
        assert create_zone_config(config) is True


class TestInstallZone:
    """Tests for install_zone function."""

    @patch("configure_lx_zone.run_command")
    def test_installs_zone(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should install zone from image."""
        mock_run.return_value = MagicMock(returncode=0)
        config = ZoneConfig(debian_image=str(tmp_path / "test.zss"))
        (tmp_path / "test.zss").write_text("image")
        assert install_zone(config) is True

    def test_fails_when_image_missing(self, tmp_path: Path) -> None:
        """Should fail when image is missing."""
        config = ZoneConfig(debian_image=str(tmp_path / "missing.zss"))
        assert install_zone(config) is False


class TestBootZone:
    """Tests for boot_zone function."""

    @patch("configure_lx_zone.time.sleep")
    @patch("configure_lx_zone.run_command")
    def test_boots_zone(self, mock_run: MagicMock, mock_sleep: MagicMock) -> None:
        """Should boot zone successfully."""
        mock_run.side_effect = [
            MagicMock(returncode=0),  # boot
            MagicMock(returncode=0, stdout="vibecode-zone running"),  # verify
        ]
        config = ZoneConfig()
        assert boot_zone(config) is True


class TestConfigureZoneNetwork:
    """Tests for configure_zone_network function."""

    @patch("configure_lx_zone.run_command")
    def test_configures_network(self, mock_run: MagicMock) -> None:
        """Should configure zone networking."""
        mock_run.return_value = MagicMock(returncode=0)
        config = ZoneConfig()
        assert configure_zone_network(config) is True


class TestCreateSnapshot:
    """Tests for create_snapshot function."""

    @patch("configure_lx_zone.run_command")
    def test_creates_snapshot(self, mock_run: MagicMock) -> None:
        """Should create baseline snapshot."""
        mock_run.return_value = MagicMock(returncode=0)
        config = ZoneConfig()
        assert create_snapshot(config) is True

    @patch("configure_lx_zone.run_command")
    def test_returns_false_on_failure(self, mock_run: MagicMock) -> None:
        """Should return False on failure."""
        mock_run.return_value = MagicMock(returncode=1)
        config = ZoneConfig()
        assert create_snapshot(config) is False


class TestShowZoneInfo:
    """Tests for show_zone_info function."""

    @patch("configure_lx_zone.run_command")
    def test_shows_info(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should display zone information."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        config = ZoneConfig()
        show_zone_info(config)
        captured = capsys.readouterr()
        assert "Zone Name" in captured.out
        assert "vibecode-zone" in captured.out


class TestShowNextSteps:
    """Tests for show_next_steps function."""

    def test_shows_next_steps(self, capsys: pytest.CaptureFixture) -> None:
        """Should display next steps."""
        config = ZoneConfig()
        show_next_steps(config)
        captured = capsys.readouterr()
        assert "zlogin" in captured.out
        assert "Zone setup complete" in captured.out


class TestRunConfigureZone:
    """Tests for run_configure_zone function."""

    @patch("configure_lx_zone.check_root")
    def test_fails_when_not_root(self, mock_check: MagicMock) -> None:
        """Should fail when not running as root."""
        mock_check.return_value = False
        assert run_configure_zone() == 1

    @patch("configure_lx_zone.check_root")
    @patch("configure_lx_zone.update_system")
    @patch("configure_lx_zone.install_lx_brand")
    def test_fails_on_lx_brand_error(
        self,
        mock_lx: MagicMock,
        mock_update: MagicMock,
        mock_root: MagicMock,
    ) -> None:
        """Should fail when lx-brand installation fails."""
        mock_root.return_value = True
        mock_update.return_value = True
        mock_lx.return_value = False
        assert run_configure_zone() == 1
