"""Tests for scripts/vibecode-cli/uninstall.py"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(
    0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vibecode-cli")
)

from uninstall import (
    BUILD_TARGETS,
    ENV_FILES,
    get_project_root,
    log_rm,
    main,
    parse_args,
    run_cleanup,
)


class TestParseArgs:
    """Tests for parse_args function."""

    def test_defaults(self) -> None:
        """Should have all flags off by default."""
        args = parse_args([])
        assert args.dry_run is False
        assert args.keep_env is False
        assert args.keep_node_modules is False

    def test_dry_run_flag(self) -> None:
        """Should parse --dry-run flag."""
        args = parse_args(["--dry-run"])
        assert args.dry_run is True

    def test_keep_env_flag(self) -> None:
        """Should parse --keep-env flag."""
        args = parse_args(["--keep-env"])
        assert args.keep_env is True

    def test_keep_node_modules_flag(self) -> None:
        """Should parse --keep-node-modules flag."""
        args = parse_args(["--keep-node-modules"])
        assert args.keep_node_modules is True

    def test_all_flags_combined(self) -> None:
        """Should parse all flags together."""
        args = parse_args(["--dry-run", "--keep-env", "--keep-node-modules"])
        assert args.dry_run is True
        assert args.keep_env is True
        assert args.keep_node_modules is True


class TestGetProjectRoot:
    """Tests for get_project_root function."""

    def test_returns_path(self) -> None:
        """Should return a Path object."""
        result = get_project_root()
        assert isinstance(result, Path)

    def test_returns_parent_of_scripts_dir(self) -> None:
        """Should return the project root (parent of scripts)."""
        result = get_project_root()
        # The project root should contain a scripts directory
        assert (result / "scripts").exists()


class TestLogRm:
    """Tests for log_rm function."""

    def test_dry_run_does_not_remove(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should not remove files in dry-run mode."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("content")

        log_rm(test_file, dry_run=True)

        assert test_file.exists()
        captured = capsys.readouterr()
        assert "DRY RUN" in captured.out
        assert "would remove" in captured.out

    def test_removes_file(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should remove files when not in dry-run mode."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("content")

        log_rm(test_file, dry_run=False)

        assert not test_file.exists()
        captured = capsys.readouterr()
        assert "Removed" in captured.out

    def test_removes_directory(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should remove directories when not in dry-run mode."""
        test_dir = tmp_path / "test_dir"
        test_dir.mkdir()
        (test_dir / "file.txt").write_text("content")

        log_rm(test_dir, dry_run=False)

        assert not test_dir.exists()
        captured = capsys.readouterr()
        assert "Removed" in captured.out

    def test_handles_nonexistent_path(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should handle non-existent paths silently."""
        nonexistent = tmp_path / "does_not_exist"

        log_rm(nonexistent, dry_run=False)

        captured = capsys.readouterr()
        assert "Removed" not in captured.out


class TestRunCleanup:
    """Tests for run_cleanup function."""

    @patch("uninstall.os.getuid")
    def test_aborts_when_root(self, mock_getuid: MagicMock, capsys: pytest.CaptureFixture) -> None:
        """Should abort when running as root."""
        mock_getuid.return_value = 0

        result = run_cleanup()

        assert result == 1
        captured = capsys.readouterr()
        assert "should run without sudo" in captured.err

    @patch("uninstall.os.getuid")
    @patch("uninstall.get_project_root")
    @patch("uninstall.os.chdir")
    @patch("uninstall.log_rm")
    def test_removes_build_targets(
        self,
        mock_log_rm: MagicMock,
        mock_chdir: MagicMock,
        mock_get_root: MagicMock,
        mock_getuid: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should attempt to remove all build targets."""
        mock_getuid.return_value = 1000
        mock_get_root.return_value = tmp_path

        run_cleanup(dry_run=True)

        # Check that all build targets were passed to log_rm
        calls = [call[0][0] for call in mock_log_rm.call_args_list]
        for target in BUILD_TARGETS:
            assert tmp_path / target in calls

    @patch("uninstall.os.getuid")
    @patch("uninstall.get_project_root")
    @patch("uninstall.os.chdir")
    @patch("uninstall.log_rm")
    def test_removes_node_modules_by_default(
        self,
        mock_log_rm: MagicMock,
        mock_chdir: MagicMock,
        mock_get_root: MagicMock,
        mock_getuid: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should remove node_modules by default."""
        mock_getuid.return_value = 1000
        mock_get_root.return_value = tmp_path

        run_cleanup()

        calls = [call[0][0] for call in mock_log_rm.call_args_list]
        assert tmp_path / "node_modules" in calls

    @patch("uninstall.os.getuid")
    @patch("uninstall.get_project_root")
    @patch("uninstall.os.chdir")
    @patch("uninstall.log_rm")
    def test_keeps_node_modules_when_flag_set(
        self,
        mock_log_rm: MagicMock,
        mock_chdir: MagicMock,
        mock_get_root: MagicMock,
        mock_getuid: MagicMock,
        tmp_path: Path,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should preserve node_modules when --keep-node-modules is set."""
        mock_getuid.return_value = 1000
        mock_get_root.return_value = tmp_path

        run_cleanup(keep_node_modules=True)

        calls = [call[0][0] for call in mock_log_rm.call_args_list]
        assert tmp_path / "node_modules" not in calls
        captured = capsys.readouterr()
        assert "Preserving node_modules" in captured.out

    @patch("uninstall.os.getuid")
    @patch("uninstall.get_project_root")
    @patch("uninstall.os.chdir")
    @patch("uninstall.log_rm")
    def test_removes_env_files_by_default(
        self,
        mock_log_rm: MagicMock,
        mock_chdir: MagicMock,
        mock_get_root: MagicMock,
        mock_getuid: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should remove env files by default."""
        mock_getuid.return_value = 1000
        mock_get_root.return_value = tmp_path

        run_cleanup()

        calls = [call[0][0] for call in mock_log_rm.call_args_list]
        for env_file in ENV_FILES:
            assert tmp_path / env_file in calls

    @patch("uninstall.os.getuid")
    @patch("uninstall.get_project_root")
    @patch("uninstall.os.chdir")
    @patch("uninstall.log_rm")
    def test_keeps_env_files_when_flag_set(
        self,
        mock_log_rm: MagicMock,
        mock_chdir: MagicMock,
        mock_get_root: MagicMock,
        mock_getuid: MagicMock,
        tmp_path: Path,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should preserve env files when --keep-env is set."""
        mock_getuid.return_value = 1000
        mock_get_root.return_value = tmp_path

        run_cleanup(keep_env=True)

        calls = [call[0][0] for call in mock_log_rm.call_args_list]
        for env_file in ENV_FILES:
            assert tmp_path / env_file not in calls
        captured = capsys.readouterr()
        assert "Preserving environment files" in captured.out

    @patch("uninstall.os.getuid")
    @patch("uninstall.get_project_root")
    @patch("uninstall.os.chdir")
    @patch("uninstall.log_rm")
    def test_dry_run_shows_message(
        self,
        mock_log_rm: MagicMock,
        mock_chdir: MagicMock,
        mock_get_root: MagicMock,
        mock_getuid: MagicMock,
        tmp_path: Path,
        capsys: pytest.CaptureFixture,
    ) -> None:
        """Should show dry-run message at the end."""
        mock_getuid.return_value = 1000
        mock_get_root.return_value = tmp_path

        run_cleanup(dry_run=True)

        captured = capsys.readouterr()
        assert "No files were deleted (dry-run mode)" in captured.out


class TestMain:
    """Tests for main function."""

    @patch("uninstall.run_cleanup")
    def test_passes_args_to_run_cleanup(self, mock_run_cleanup: MagicMock) -> None:
        """Should pass parsed args to run_cleanup."""
        mock_run_cleanup.return_value = 0

        main(["--dry-run", "--keep-env", "--keep-node-modules"])

        mock_run_cleanup.assert_called_once_with(
            dry_run=True,
            keep_env=True,
            keep_node_modules=True,
        )

    @patch("uninstall.run_cleanup")
    def test_returns_exit_code(self, mock_run_cleanup: MagicMock) -> None:
        """Should return exit code from run_cleanup."""
        mock_run_cleanup.return_value = 42

        result = main([])

        assert result == 42


class TestConstants:
    """Tests for module constants."""

    def test_build_targets_contains_expected_dirs(self) -> None:
        """Should contain standard build artifact directories."""
        assert ".next" in BUILD_TARGETS
        assert "dist" in BUILD_TARGETS
        assert ".turbo" in BUILD_TARGETS
        assert "coverage" in BUILD_TARGETS
        assert ".cache" in BUILD_TARGETS

    def test_env_files_contains_expected_files(self) -> None:
        """Should contain standard env files."""
        assert ".env.local" in ENV_FILES
        assert ".env.development" in ENV_FILES
        assert ".env.test" in ENV_FILES
