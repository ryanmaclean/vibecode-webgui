
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for boot_all_vms.py"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Import the module under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from boot_all_vms import (
    EXPECTED_VMS,
    count_booted_vms,
    get_booted_vm_lines,
    check_vm_network,
    is_app_running,
)


class TestExpectedVMs:
    """Tests for VM configuration."""

    def test_has_six_vms(self) -> None:
        """Should have 6 expected VMs."""
        assert len(EXPECTED_VMS) == 6

    def test_all_vms_have_name_and_description(self) -> None:
        """All VMs should have name and description."""
        for name, description in EXPECTED_VMS:
            assert name, "VM name should not be empty"
            assert description, "VM description should not be empty"
            assert name.startswith("vibecode-"), f"VM {name} should start with vibecode-"


class TestCountBootedVms:
    """Tests for count_booted_vms function."""

    def test_returns_zero_for_missing_file(self, tmp_path: Path) -> None:
        """Should return 0 when log file doesn't exist."""
        missing_file = tmp_path / "missing.log"
        assert count_booted_vms(missing_file) == 0

    def test_returns_zero_for_empty_file(self, tmp_path: Path) -> None:
        """Should return 0 for empty log file."""
        log_file = tmp_path / "vibecode.log"
        log_file.touch()
        assert count_booted_vms(log_file) == 0

    def test_counts_boot_successes(self, tmp_path: Path) -> None:
        """Should count VM started successfully messages."""
        log_file = tmp_path / "vibecode.log"
        log_file.write_text(
            "VM started successfully: postgresql\n"
            "Some other log\n"
            "VM started successfully: valkey\n"
            "VM started successfully: nodejs\n"
        )
        assert count_booted_vms(log_file) == 3


class TestGetBootedVmLines:
    """Tests for get_booted_vm_lines function."""

    def test_returns_empty_for_missing_file(self, tmp_path: Path) -> None:
        """Should return empty list when log file doesn't exist."""
        missing_file = tmp_path / "missing.log"
        assert get_booted_vm_lines(missing_file) == []

    def test_returns_boot_lines(self, tmp_path: Path) -> None:
        """Should return lines containing boot success."""
        log_file = tmp_path / "vibecode.log"
        log_file.write_text(
            "VM started successfully: postgresql\n"
            "Some other log\n"
            "VM started successfully: valkey\n"
        )
        lines = get_booted_vm_lines(log_file)
        assert len(lines) == 2
        assert "postgresql" in lines[0]
        assert "valkey" in lines[1]

    def test_respects_limit(self, tmp_path: Path) -> None:
        """Should limit the number of returned lines."""
        log_file = tmp_path / "vibecode.log"
        log_file.write_text(
            "VM started successfully: vm1\n"
            "VM started successfully: vm2\n"
            "VM started successfully: vm3\n"
            "VM started successfully: vm4\n"
            "VM started successfully: vm5\n"
        )
        lines = get_booted_vm_lines(log_file, limit=2)
        assert len(lines) == 2
        # Should return the last 2 (most recent)
        assert "vm4" in lines[0]
        assert "vm5" in lines[1]


class TestCheckVmNetwork:
    """Tests for check_vm_network function."""

    @patch("subprocess.run")
    def test_returns_vm_entries(self, mock_run: MagicMock) -> None:
        """Should return entries with 192.168.64 subnet."""
        mock_run.return_value = MagicMock(
            stdout="? (192.168.64.2) at aa:bb:cc:dd:ee:ff\n"
                   "? (10.0.0.1) at 11:22:33:44:55:66\n"
                   "? (192.168.64.3) at ff:ee:dd:cc:bb:aa\n"
        )
        entries = check_vm_network()
        assert len(entries) == 2
        assert "192.168.64.2" in entries[0]
        assert "192.168.64.3" in entries[1]

    @patch("subprocess.run")
    def test_returns_empty_on_no_match(self, mock_run: MagicMock) -> None:
        """Should return empty list when no VMs on network."""
        mock_run.return_value = MagicMock(
            stdout="? (10.0.0.1) at 11:22:33:44:55:66\n"
        )
        entries = check_vm_network()
        assert entries == []


class TestIsAppRunning:
    """Tests for is_app_running function."""

    @patch("subprocess.run")
    def test_returns_true_when_running(self, mock_run: MagicMock) -> None:
        """Should return True when app process is found."""
        mock_run.return_value = MagicMock(returncode=0)
        assert is_app_running() is True

    @patch("subprocess.run")
    def test_returns_false_when_not_running(self, mock_run: MagicMock) -> None:
        """Should return False when app process not found."""
        mock_run.return_value = MagicMock(returncode=1)
        assert is_app_running() is False