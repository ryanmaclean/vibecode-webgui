#!/usr/bin/env python3
"""Tests for full_history_cleanup module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "cleanup"))

from cleanup.full_history_cleanup import (
    PATHS_TO_REMOVE,
    CleanupConfig,
    check_git_filter_repo,
    check_working_directory_clean,
    create_paths_file,
    get_paths_list,
    get_repo_root,
    get_repo_stats,
    run_command,
)


class TestPathsToRemove(TestCase):
    """Tests for PATHS_TO_REMOVE constant."""

    def test_contains_azure_files(self):
        """Test contains azure binary files."""
        self.assertIn("azure/bun-openvscode.cpio.gz", PATHS_TO_REMOVE)
        self.assertIn("azure/linux-kernel-arm64", PATHS_TO_REMOVE)

    def test_contains_vm_images(self):
        """Test contains VM images."""
        self.assertIn("VibeCodeSwift/Resources/vms/vibecode-postgresql.img", PATHS_TO_REMOVE)

    def test_contains_build_directories(self):
        """Test contains build artifact directories."""
        self.assertIn("artifacts/", PATHS_TO_REMOVE)
        self.assertIn("src-tauri/target/", PATHS_TO_REMOVE)

    def test_contains_secret_files(self):
        """Test contains secret/env files."""
        self.assertIn(".env.docker", PATHS_TO_REMOVE)
        self.assertIn(".env.azure", PATHS_TO_REMOVE)


class TestCleanupConfig(TestCase):
    """Tests for CleanupConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = CleanupConfig()
        self.assertEqual(config.repo_root, Path())
        self.assertEqual(config.paths_file, Path())
        self.assertFalse(config.force)
        self.assertFalse(config.dry_run)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = CleanupConfig(
            repo_root=Path("/test/repo"),
            paths_file=Path("/tmp/paths.txt"),
            force=True,
            dry_run=True
        )
        self.assertEqual(config.repo_root, Path("/test/repo"))
        self.assertEqual(config.paths_file, Path("/tmp/paths.txt"))
        self.assertTrue(config.force)
        self.assertTrue(config.dry_run)


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


class TestGetRepoRoot(TestCase):
    """Tests for get_repo_root function."""

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_returns_path(self, mock_run):
        """Test returns repository root path."""
        mock_run.return_value = (0, "/path/to/repo\n", "")

        result = get_repo_root()

        self.assertEqual(result, Path("/path/to/repo"))

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_returns_none_on_failure(self, mock_run):
        """Test returns None when not in a git repo."""
        mock_run.return_value = (128, "", "fatal: not a git repository")

        result = get_repo_root()

        self.assertIsNone(result)


class TestCheckGitFilterRepo(TestCase):
    """Tests for check_git_filter_repo function."""

    @mock.patch('cleanup.full_history_cleanup.shutil.which')
    def test_installed(self, mock_which):
        """Test when git-filter-repo is installed."""
        mock_which.return_value = "/usr/local/bin/git-filter-repo"

        result = check_git_filter_repo()

        self.assertTrue(result)

    @mock.patch('cleanup.full_history_cleanup.shutil.which')
    def test_not_installed(self, mock_which):
        """Test when git-filter-repo is not installed."""
        mock_which.return_value = None

        result = check_git_filter_repo()

        self.assertFalse(result)


class TestCheckWorkingDirectoryClean(TestCase):
    """Tests for check_working_directory_clean function."""

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_clean(self, mock_run):
        """Test when working directory is clean."""
        mock_run.return_value = (0, "", "")

        result = check_working_directory_clean(Path("/repo"))

        self.assertTrue(result)

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_unstaged_changes(self, mock_run):
        """Test when there are unstaged changes."""
        mock_run.side_effect = [
            (1, "", ""),  # git diff --quiet fails
            (0, "", "")   # git diff --cached --quiet succeeds
        ]

        result = check_working_directory_clean(Path("/repo"))

        self.assertFalse(result)

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_staged_changes(self, mock_run):
        """Test when there are staged changes."""
        mock_run.side_effect = [
            (0, "", ""),  # git diff --quiet succeeds
            (1, "", "")   # git diff --cached --quiet fails
        ]

        result = check_working_directory_clean(Path("/repo"))

        self.assertFalse(result)


class TestCreatePathsFile(TestCase):
    """Tests for create_paths_file function."""

    def test_creates_file(self):
        """Test creates temporary file with paths."""
        result = create_paths_file()

        self.assertTrue(result.exists())
        content = result.read_text()
        self.assertIn("azure/bun-openvscode.cpio.gz", content)
        self.assertIn(".env.docker", content)

        # Cleanup
        result.unlink()

    def test_file_is_readable(self):
        """Test file is readable."""
        result = create_paths_file()

        self.assertTrue(result.is_file())
        self.assertTrue(os.access(result, os.R_OK))

        # Cleanup
        result.unlink()


class TestGetPathsList(TestCase):
    """Tests for get_paths_list function."""

    def test_excludes_comments(self):
        """Test excludes comment lines."""
        result = get_paths_list()

        for path in result:
            self.assertFalse(path.startswith('#'))

    def test_excludes_empty_lines(self):
        """Test excludes empty lines."""
        result = get_paths_list()

        for path in result:
            self.assertNotEqual(path.strip(), "")

    def test_contains_expected_paths(self):
        """Test contains expected paths."""
        result = get_paths_list()

        self.assertIn("azure/bun-openvscode.cpio.gz", result)
        self.assertIn(".env.docker", result)
        self.assertIn("artifacts/", result)


class TestGetRepoStats(TestCase):
    """Tests for get_repo_stats function."""

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_returns_stats(self, mock_run):
        """Test returns repository stats."""
        mock_run.return_value = (0, "count: 1000\nsize: 10.00 MiB\n", "")

        result = get_repo_stats(Path("/repo"))

        self.assertIn("count: 1000", result)
        self.assertIn("size: 10.00 MiB", result)

    @mock.patch('cleanup.full_history_cleanup.run_command')
    def test_returns_error_message(self, mock_run):
        """Test returns error message on failure."""
        mock_run.return_value = (1, "", "error")

        result = get_repo_stats(Path("/repo"))

        self.assertEqual(result, "Unable to get stats")


class TestCleanup(TestCase):
    """Tests for cleanup function."""

    @mock.patch('cleanup.full_history_cleanup.print_success')
    @mock.patch('cleanup.full_history_cleanup.run_filter_repo')
    @mock.patch('cleanup.full_history_cleanup.check_working_directory_clean')
    @mock.patch('cleanup.full_history_cleanup.check_git_filter_repo')
    def test_dry_run(self, mock_filter_repo, mock_clean, mock_run_filter, mock_success):
        """Test dry run mode."""
        from cleanup.full_history_cleanup import cleanup

        mock_filter_repo.return_value = True
        mock_clean.return_value = True

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                force=True,
                dry_run=True
            )

            result = cleanup(config)

            self.assertEqual(result, 0)
            mock_run_filter.assert_not_called()

    @mock.patch('cleanup.full_history_cleanup.check_git_filter_repo')
    def test_missing_git_filter_repo(self, mock_check):
        """Test fails when git-filter-repo not installed."""
        from cleanup.full_history_cleanup import cleanup

        mock_check.return_value = False

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                force=True
            )

            result = cleanup(config)

            self.assertEqual(result, 1)

    @mock.patch('cleanup.full_history_cleanup.check_working_directory_clean')
    @mock.patch('cleanup.full_history_cleanup.check_git_filter_repo')
    def test_dirty_working_directory(self, mock_filter, mock_clean):
        """Test fails when working directory is dirty."""
        from cleanup.full_history_cleanup import cleanup

        mock_filter.return_value = True
        mock_clean.return_value = False

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                force=True
            )

            result = cleanup(config)

            self.assertEqual(result, 1)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('cleanup.full_history_cleanup.cleanup')
    @mock.patch('cleanup.full_history_cleanup.get_repo_root')
    def test_main_calls_cleanup(self, mock_root, mock_cleanup):
        """Test main calls cleanup function."""
        from cleanup.full_history_cleanup import main

        mock_root.return_value = Path("/repo")
        mock_cleanup.return_value = 0

        result = main(force=True, dry_run=True)

        self.assertEqual(result, 0)
        mock_cleanup.assert_called_once()
        config = mock_cleanup.call_args[0][0]
        self.assertTrue(config.force)
        self.assertTrue(config.dry_run)

    @mock.patch('cleanup.full_history_cleanup.get_repo_root')
    def test_main_not_in_repo(self, mock_root):
        """Test main fails when not in a git repo."""
        from cleanup.full_history_cleanup import main

        mock_root.return_value = None

        result = main()

        self.assertEqual(result, 1)

    @mock.patch('cleanup.full_history_cleanup.cleanup')
    def test_main_with_repo_root(self, mock_cleanup):
        """Test main with explicit repo root."""
        from cleanup.full_history_cleanup import main

        mock_cleanup.return_value = 0

        with tempfile.TemporaryDirectory() as tmpdir:
            result = main(repo_root=Path(tmpdir))

            self.assertEqual(result, 0)
            config = mock_cleanup.call_args[0][0]
            self.assertEqual(config.repo_root, Path(tmpdir))


if __name__ == '__main__':
    import unittest
    unittest.main()
