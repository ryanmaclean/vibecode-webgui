#!/usr/bin/env python3
"""Tests for cleanup_utility module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from cleanup_utility import (
    BINARY_PATTERNS,
    HISTORY_PATHS_TO_REMOVE,
    IMPORTANT_BRANCHES,
    SECRET_FILES,
    CleanupConfig,
    check_git_filter_repo,
    check_working_directory_clean,
    get_large_tracked_files,
    get_repo_root,
    get_tracked_files_matching,
    is_file_tracked,
    run_command,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_important_branches(self):
        """Test important branches list."""
        self.assertIn("main", IMPORTANT_BRANCHES)
        self.assertTrue(len(IMPORTANT_BRANCHES) > 0)

    def test_binary_patterns(self):
        """Test binary patterns list."""
        self.assertIn("azure/*.cpio.gz", BINARY_PATTERNS)
        self.assertIn("artifacts/", BINARY_PATTERNS)
        self.assertTrue(len(BINARY_PATTERNS) > 0)

    def test_secret_files(self):
        """Test secret files list."""
        self.assertIn(".env.docker", SECRET_FILES)
        self.assertIn(".env.azure", SECRET_FILES)
        self.assertTrue(len(SECRET_FILES) > 0)

    def test_history_paths(self):
        """Test history paths to remove."""
        self.assertIn("azure/bun-openvscode.cpio.gz", HISTORY_PATHS_TO_REMOVE)
        self.assertIn(".env.docker", HISTORY_PATHS_TO_REMOVE)


class TestCleanupConfig(TestCase):
    """Tests for CleanupConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = CleanupConfig()
        self.assertEqual(config.repo_root, Path())
        self.assertEqual(config.backup_dir, Path())
        self.assertFalse(config.dry_run)
        self.assertFalse(config.force)
        self.assertFalse(config.verbose)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = CleanupConfig(
            repo_root=Path("/test/repo"),
            backup_dir=Path("/test/backup"),
            dry_run=True,
            force=True,
            verbose=True
        )
        self.assertEqual(config.repo_root, Path("/test/repo"))
        self.assertEqual(config.backup_dir, Path("/test/backup"))
        self.assertTrue(config.dry_run)
        self.assertTrue(config.force)
        self.assertTrue(config.verbose)


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

    @mock.patch('cleanup_utility.run_command')
    def test_returns_path(self, mock_run):
        """Test returns repository root path."""
        mock_run.return_value = (0, "/path/to/repo\n", "")

        result = get_repo_root()

        self.assertEqual(result, Path("/path/to/repo"))

    @mock.patch('cleanup_utility.run_command')
    def test_returns_none_on_failure(self, mock_run):
        """Test returns None when not in a git repo."""
        mock_run.return_value = (128, "", "fatal: not a git repository")

        result = get_repo_root()

        self.assertIsNone(result)


class TestCheckGitFilterRepo(TestCase):
    """Tests for check_git_filter_repo function."""

    @mock.patch('cleanup_utility.shutil.which')
    def test_installed(self, mock_which):
        """Test when git-filter-repo is installed."""
        mock_which.return_value = "/usr/local/bin/git-filter-repo"

        result = check_git_filter_repo()

        self.assertTrue(result)

    @mock.patch('cleanup_utility.shutil.which')
    def test_not_installed(self, mock_which):
        """Test when git-filter-repo is not installed."""
        mock_which.return_value = None

        result = check_git_filter_repo()

        self.assertFalse(result)


class TestCheckWorkingDirectoryClean(TestCase):
    """Tests for check_working_directory_clean function."""

    @mock.patch('cleanup_utility.run_command')
    def test_clean(self, mock_run):
        """Test when working directory is clean."""
        mock_run.return_value = (0, "", "")

        result = check_working_directory_clean(Path("/repo"))

        self.assertTrue(result)

    @mock.patch('cleanup_utility.run_command')
    def test_dirty(self, mock_run):
        """Test when working directory has changes."""
        mock_run.side_effect = [
            (1, "", ""),  # git diff --quiet fails
            (0, "", "")
        ]

        result = check_working_directory_clean(Path("/repo"))

        self.assertFalse(result)


class TestGetTrackedFilesMatching(TestCase):
    """Tests for get_tracked_files_matching function."""

    @mock.patch('cleanup_utility.run_command')
    def test_finds_matches(self, mock_run):
        """Test finds matching files."""
        mock_run.return_value = (0, "file1.cpio.gz\nfile2.cpio.gz\n", "")

        result = get_tracked_files_matching("*.cpio.gz", Path("/repo"))

        self.assertEqual(len(result), 2)
        self.assertIn("file1.cpio.gz", result)
        self.assertIn("file2.cpio.gz", result)

    @mock.patch('cleanup_utility.run_command')
    def test_no_matches(self, mock_run):
        """Test no matching files."""
        mock_run.return_value = (0, "", "")

        result = get_tracked_files_matching("*.nonexistent", Path("/repo"))

        self.assertEqual(result, [])


class TestIsFileTracked(TestCase):
    """Tests for is_file_tracked function."""

    @mock.patch('cleanup_utility.run_command')
    def test_tracked(self, mock_run):
        """Test when file is tracked."""
        mock_run.return_value = (0, "", "")

        result = is_file_tracked(".env.docker", Path("/repo"))

        self.assertTrue(result)

    @mock.patch('cleanup_utility.run_command')
    def test_not_tracked(self, mock_run):
        """Test when file is not tracked."""
        mock_run.return_value = (1, "", "")

        result = is_file_tracked(".env.docker", Path("/repo"))

        self.assertFalse(result)


class TestCreateBackup(TestCase):
    """Tests for create_backup function."""

    @mock.patch('cleanup_utility.run_command')
    def test_dry_run(self, mock_run):
        """Test backup in dry run mode."""
        from cleanup_utility import create_backup

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                dry_run=True
            )

            result = create_backup(config)

            self.assertEqual(result, 0)
            # No git commands should be called
            mock_run.assert_not_called()


class TestRemoveBinaries(TestCase):
    """Tests for remove_binaries function."""

    @mock.patch('cleanup_utility.get_tracked_files_matching')
    @mock.patch('cleanup_utility.get_large_tracked_files')
    def test_dry_run(self, mock_large, mock_match):
        """Test binary removal in dry run mode."""
        from cleanup_utility import remove_binaries

        mock_large.return_value = []
        mock_match.return_value = ["test.cpio.gz"]

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                dry_run=True
            )

            result = remove_binaries(config)

            self.assertEqual(result, 0)


class TestRemoveSecrets(TestCase):
    """Tests for remove_secrets function."""

    @mock.patch('cleanup_utility.is_file_tracked')
    def test_no_tracked_secrets(self, mock_tracked):
        """Test when no secrets are tracked."""
        from cleanup_utility import remove_secrets

        mock_tracked.return_value = False

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                dry_run=True
            )

            result = remove_secrets(config)

            self.assertEqual(result, 0)

    @mock.patch('cleanup_utility.is_file_tracked')
    def test_dry_run(self, mock_tracked):
        """Test secret removal in dry run mode."""
        from cleanup_utility import remove_secrets

        mock_tracked.return_value = True

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                dry_run=True
            )

            result = remove_secrets(config)

            self.assertEqual(result, 0)


class TestCleanupHistory(TestCase):
    """Tests for cleanup_history function."""

    @mock.patch('cleanup_utility.check_git_filter_repo')
    def test_missing_git_filter_repo(self, mock_check):
        """Test fails when git-filter-repo not installed."""
        from cleanup_utility import cleanup_history

        mock_check.return_value = False

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                force=True
            )

            result = cleanup_history(config)

            self.assertEqual(result, 1)

    @mock.patch('cleanup_utility.check_working_directory_clean')
    @mock.patch('cleanup_utility.check_git_filter_repo')
    def test_dirty_working_directory(self, mock_filter, mock_clean):
        """Test fails when working directory is dirty."""
        from cleanup_utility import cleanup_history

        mock_filter.return_value = True
        mock_clean.return_value = False

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                force=True
            )

            result = cleanup_history(config)

            self.assertEqual(result, 1)

    @mock.patch('cleanup_utility.confirm')
    @mock.patch('cleanup_utility.check_working_directory_clean')
    @mock.patch('cleanup_utility.check_git_filter_repo')
    def test_dry_run(self, mock_filter, mock_clean, mock_confirm):
        """Test history cleanup in dry run mode."""
        from cleanup_utility import cleanup_history

        mock_filter.return_value = True
        mock_clean.return_value = True
        mock_confirm.return_value = True

        with tempfile.TemporaryDirectory() as tmpdir:
            config = CleanupConfig(
                repo_root=Path(tmpdir),
                dry_run=True,
                force=True
            )

            result = cleanup_history(config)

            self.assertEqual(result, 0)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('cleanup_utility.create_backup')
    @mock.patch('cleanup_utility.get_repo_root')
    def test_main_backup(self, mock_root, mock_backup):
        """Test main with backup command."""
        mock_root.return_value = Path("/repo")
        mock_backup.return_value = 0

        with mock.patch('sys.argv', ['cleanup_utility.py', 'backup']):
            from cleanup_utility import main
            result = main()

        self.assertEqual(result, 0)

    @mock.patch('cleanup_utility.get_repo_root')
    def test_main_not_in_repo(self, mock_root):
        """Test main fails when not in a git repo."""
        mock_root.return_value = None

        with mock.patch('sys.argv', ['cleanup_utility.py', 'backup']):
            from cleanup_utility import main
            result = main()

        self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
