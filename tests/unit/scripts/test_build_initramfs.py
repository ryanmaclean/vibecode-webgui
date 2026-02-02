
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

"""Tests for build_initramfs.py"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Import the module under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from build_initramfs import (
    check_source_directory,
    check_critical_files,
    check_dependencies,
)


class TestCheckSourceDirectory:
    """Tests for check_source_directory function."""

    def test_returns_true_when_directory_exists(self, tmp_path: Path) -> None:
        """Should return True when source directory exists."""
        assert check_source_directory(tmp_path) is True

    def test_returns_false_when_directory_missing(self, tmp_path: Path) -> None:
        """Should return False when source directory is missing."""
        missing_dir = tmp_path / "nonexistent"
        assert check_source_directory(missing_dir) is False


class TestCheckCriticalFiles:
    """Tests for check_critical_files function."""

    def test_returns_true_when_all_files_exist(self, tmp_path: Path) -> None:
        """Should return True when all critical files exist."""
        # Create required files
        (tmp_path / "init").touch()
        (tmp_path / "usr" / "bin").mkdir(parents=True)
        (tmp_path / "usr" / "bin" / "postgres").touch()
        (tmp_path / "usr" / "bin" / "psql").touch()

        assert check_critical_files(tmp_path) is True

    def test_returns_false_when_init_missing(self, tmp_path: Path) -> None:
        """Should return False when init script is missing."""
        (tmp_path / "usr" / "bin").mkdir(parents=True)
        (tmp_path / "usr" / "bin" / "postgres").touch()
        (tmp_path / "usr" / "bin" / "psql").touch()

        assert check_critical_files(tmp_path) is False

    def test_returns_false_when_postgres_missing(self, tmp_path: Path) -> None:
        """Should return False when postgres binary is missing."""
        (tmp_path / "init").touch()
        (tmp_path / "usr" / "bin").mkdir(parents=True)
        (tmp_path / "usr" / "bin" / "psql").touch()

        assert check_critical_files(tmp_path) is False

    def test_returns_false_when_psql_missing(self, tmp_path: Path) -> None:
        """Should return False when psql binary is missing."""
        (tmp_path / "init").touch()
        (tmp_path / "usr" / "bin").mkdir(parents=True)
        (tmp_path / "usr" / "bin" / "postgres").touch()

        assert check_critical_files(tmp_path) is False


class TestCheckDependencies:
    """Tests for check_dependencies function."""

    def test_does_not_fail_when_deps_missing(self, tmp_path: Path) -> None:
        """Should not raise when optional dependencies are missing."""
        # Should complete without error even with missing deps
        check_dependencies(tmp_path)

    def test_reports_found_deps(self, tmp_path: Path, capsys) -> None:
        """Should report when dependencies are found."""
        dep_dir = tmp_path / "usr" / "lib" / "aarch64-linux-gnu"
        dep_dir.mkdir(parents=True)
        (dep_dir / "libicuuc.so.74").touch()

        check_dependencies(tmp_path)

        captured = capsys.readouterr()
        assert "libicuuc.so.74 found" in captured.out