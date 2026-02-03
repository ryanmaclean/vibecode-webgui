"""Tests for scripts/lib/kind.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from lib.kind import (
    KindError,
    KindRunner,
    kind_run_step,
    kind_set_scripts_dir,
)


class TestKindRunner:
    """Tests for KindRunner dataclass."""

    def test_init(self, tmp_path: Path) -> None:
        """Should initialize with scripts directory."""
        runner = KindRunner(scripts_dir=tmp_path)
        assert runner.scripts_dir == tmp_path

    def test_set_scripts_dir(self, tmp_path: Path) -> None:
        """Should set scripts directory."""
        runner = KindRunner(scripts_dir=Path("/tmp"))
        runner.set_scripts_dir(tmp_path)
        assert runner.scripts_dir == tmp_path

    @patch("lib.kind.subprocess.run")
    def test_run_step_success(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should run script successfully."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\nexit 0")
        mock_run.return_value = MagicMock(returncode=0)

        runner = KindRunner(scripts_dir=tmp_path)
        result = runner.run_step("Test step", "test.sh")

        assert result is True
        mock_run.assert_called_once()

    @patch("lib.kind.subprocess.run")
    def test_run_step_failure_required(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should raise error when required script fails."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\nexit 1")
        mock_run.return_value = MagicMock(returncode=1)

        runner = KindRunner(scripts_dir=tmp_path)
        with pytest.raises(KindError, match="Script failed"):
            runner.run_step("Test step", "test.sh", requirement="required")

    @patch("lib.kind.subprocess.run")
    def test_run_step_failure_optional(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return False when optional script fails."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\nexit 1")
        mock_run.return_value = MagicMock(returncode=1)

        runner = KindRunner(scripts_dir=tmp_path)
        result = runner.run_step("Test step", "test.sh", requirement="optional")

        assert result is False

    def test_run_step_script_not_found_required(self, tmp_path: Path) -> None:
        """Should raise error when required script not found."""
        runner = KindRunner(scripts_dir=tmp_path)
        with pytest.raises(KindError, match="Script not found"):
            runner.run_step("Test step", "missing.sh", requirement="required")

    def test_run_step_script_not_found_optional(self, tmp_path: Path) -> None:
        """Should return False when optional script not found."""
        runner = KindRunner(scripts_dir=tmp_path)
        result = runner.run_step("Test step", "missing.sh", requirement="optional")

        assert result is False


class TestKindSetScriptsDir:
    """Tests for kind_set_scripts_dir function."""

    def test_sets_global_runner(self, tmp_path: Path) -> None:
        """Should set global runner."""
        runner = kind_set_scripts_dir(tmp_path)
        assert runner.scripts_dir == tmp_path

    def test_returns_runner(self, tmp_path: Path) -> None:
        """Should return KindRunner instance."""
        runner = kind_set_scripts_dir(tmp_path)
        assert isinstance(runner, KindRunner)


class TestKindRunStep:
    """Tests for kind_run_step function."""

    def test_raises_when_not_initialized(self) -> None:
        """Should raise error when scripts dir not set."""
        # Reset global state
        import lib.kind as kind_module
        kind_module._KIND_RUNNER = None

        with pytest.raises(KindError, match="KIND_SCRIPTS_DIR is not set"):
            kind_run_step("Test", "script.sh")

    @patch("lib.kind.subprocess.run")
    def test_runs_step_via_global_runner(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should run step via global runner."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\nexit 0")
        mock_run.return_value = MagicMock(returncode=0)

        kind_set_scripts_dir(tmp_path)
        result = kind_run_step("Test step", "test.sh")

        assert result is True


class TestKindError:
    """Tests for KindError exception."""

    def test_is_runtime_error(self) -> None:
        """Should be a RuntimeError."""
        error = KindError("test message")
        assert isinstance(error, RuntimeError)

    def test_message(self) -> None:
        """Should contain message."""
        error = KindError("test message")
        assert str(error) == "test message"
