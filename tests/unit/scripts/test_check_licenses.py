"""Tests for check_licenses.py"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from check_licenses import (
    ALLOWED_LICENSES,
    check_license_checker_installed,
    check_licenses,
)


class TestAllowedLicenses:
    """Tests for allowed license configuration."""

    def test_has_mit_license(self) -> None:
        """Should include MIT license."""
        assert "MIT" in ALLOWED_LICENSES

    def test_has_bsd_licenses(self) -> None:
        """Should include BSD variants."""
        assert "BSD" in ALLOWED_LICENSES
        assert "BSD-2-Clause" in ALLOWED_LICENSES
        assert "BSD-3-Clause" in ALLOWED_LICENSES

    def test_has_apache_license(self) -> None:
        """Should include Apache license."""
        assert "Apache-2.0" in ALLOWED_LICENSES

    def test_no_gpl_licenses(self) -> None:
        """Should NOT include GPL licenses."""
        for license_name in ALLOWED_LICENSES:
            assert "GPL" not in license_name.upper()
            assert "LGPL" not in license_name.upper()
            assert "AGPL" not in license_name.upper()


class TestCheckLicenseCheckerInstalled:
    """Tests for check_license_checker_installed function."""

    @patch("shutil.which")
    def test_returns_true_when_installed(self, mock_which: MagicMock) -> None:
        """Should return True when license-checker is found."""
        mock_which.return_value = "/usr/local/bin/license-checker"
        assert check_license_checker_installed() is True

    @patch("shutil.which")
    def test_returns_false_when_not_installed(self, mock_which: MagicMock) -> None:
        """Should return False when license-checker not found."""
        mock_which.return_value = None
        assert check_license_checker_installed() is False


class TestCheckLicenses:
    """Tests for check_licenses function."""

    @patch("subprocess.run")
    def test_returns_success_on_clean_check(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return success when all licenses pass."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        success, message = check_licenses(tmp_path)
        assert success is True
        assert "compatible" in message

    @patch("subprocess.run")
    def test_returns_failure_on_incompatible(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return failure on incompatible licenses."""
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="Found incompatible: GPL-3.0",
        )
        success, message = check_licenses(tmp_path)
        assert success is False
        assert "GPL" in message
