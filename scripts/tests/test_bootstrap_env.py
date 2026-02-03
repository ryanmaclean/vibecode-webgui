#!/usr/bin/env python3
"""Tests for bootstrap_env module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts/tests directory to path for bootstrap module
sys.path.insert(0, str(Path(__file__).parent))

from bootstrap.bootstrap_env import (
    BOOTSTRAP_TEST_DIR,
    BOOTSTRAP_TEST_ENV_EXAMPLE,
    BOOTSTRAP_TEST_ENV_FILE,
    BOOTSTRAP_TEST_REPO_ROOT,
    BOOTSTRAP_TEST_SCRIPTS_DIR,
    export_to_environ,
    get_bootstrap_paths,
    is_initialized,
    load_test_env,
    parse_shell_env_file,
    reset,
)


class TestBootstrapPaths(TestCase):
    """Tests for bootstrap path constants."""

    def test_bootstrap_test_dir_exists(self):
        """Test BOOTSTRAP_TEST_DIR points to bootstrap directory."""
        self.assertTrue(BOOTSTRAP_TEST_DIR.exists())
        self.assertEqual(BOOTSTRAP_TEST_DIR.name, "bootstrap")

    def test_bootstrap_test_repo_root_exists(self):
        """Test BOOTSTRAP_TEST_REPO_ROOT points to repo root."""
        self.assertTrue(BOOTSTRAP_TEST_REPO_ROOT.exists())
        # Should contain package.json or similar root marker
        self.assertTrue(
            (BOOTSTRAP_TEST_REPO_ROOT / "package.json").exists() or
            (BOOTSTRAP_TEST_REPO_ROOT / "scripts").exists()
        )

    def test_bootstrap_test_scripts_dir(self):
        """Test BOOTSTRAP_TEST_SCRIPTS_DIR points to scripts directory."""
        self.assertEqual(
            BOOTSTRAP_TEST_SCRIPTS_DIR,
            BOOTSTRAP_TEST_REPO_ROOT / "scripts"
        )

    def test_env_file_paths(self):
        """Test environment file paths are in bootstrap dir."""
        self.assertEqual(
            BOOTSTRAP_TEST_ENV_FILE,
            BOOTSTRAP_TEST_DIR / "test-env.sh"
        )
        self.assertEqual(
            BOOTSTRAP_TEST_ENV_EXAMPLE,
            BOOTSTRAP_TEST_DIR / "test-env.example.sh"
        )


class TestParseShellEnvFile(TestCase):
    """Tests for parse_shell_env_file function."""

    def test_simple_assignment(self):
        """Test parsing simple variable assignment."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("FOO=bar\n")
            f.write("BAZ=qux\n")
            f.flush()

            result = parse_shell_env_file(Path(f.name))

            self.assertEqual(result["FOO"], "bar")
            self.assertEqual(result["BAZ"], "qux")

            os.unlink(f.name)

    def test_export_statement(self):
        """Test parsing export statements."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("export FOO=bar\n")
            f.write("export BAZ=qux\n")
            f.flush()

            result = parse_shell_env_file(Path(f.name))

            self.assertEqual(result["FOO"], "bar")
            self.assertEqual(result["BAZ"], "qux")

            os.unlink(f.name)

    def test_quoted_values(self):
        """Test parsing quoted values."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write('DOUBLE="hello world"\n')
            f.write("SINGLE='hello world'\n")
            f.flush()

            result = parse_shell_env_file(Path(f.name))

            self.assertEqual(result["DOUBLE"], "hello world")
            self.assertEqual(result["SINGLE"], "hello world")

            os.unlink(f.name)

    def test_comments_ignored(self):
        """Test comments are ignored."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("# This is a comment\n")
            f.write("FOO=bar\n")
            f.write("# Another comment\n")
            f.flush()

            result = parse_shell_env_file(Path(f.name))

            self.assertEqual(len(result), 1)
            self.assertEqual(result["FOO"], "bar")

            os.unlink(f.name)

    def test_empty_lines_ignored(self):
        """Test empty lines are ignored."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("FOO=bar\n")
            f.write("\n")
            f.write("\n")
            f.write("BAZ=qux\n")
            f.flush()

            result = parse_shell_env_file(Path(f.name))

            self.assertEqual(len(result), 2)

            os.unlink(f.name)

    def test_nonexistent_file(self):
        """Test nonexistent file returns empty dict."""
        result = parse_shell_env_file(Path("/nonexistent/file.sh"))
        self.assertEqual(result, {})

    def test_inline_comments(self):
        """Test inline comments are stripped."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("FOO=bar # this is a comment\n")
            f.flush()

            result = parse_shell_env_file(Path(f.name))

            self.assertEqual(result["FOO"], "bar")

            os.unlink(f.name)


class TestLoadTestEnv(TestCase):
    """Tests for load_test_env function."""

    def setUp(self):
        """Reset initialization state before each test."""
        reset()

    def tearDown(self):
        """Clean up after each test."""
        reset()

    @mock.patch('bootstrap.bootstrap_env.BOOTSTRAP_TEST_ENV_FILE')
    @mock.patch('bootstrap.bootstrap_env.BOOTSTRAP_TEST_ENV_EXAMPLE')
    def test_no_env_files(self, mock_example, mock_file):
        """Test warning when no env files exist."""
        mock_file.exists.return_value = False
        mock_example.exists.return_value = False

        with mock.patch('sys.stderr'):
            result = load_test_env()

        self.assertEqual(result, {})

    def test_sets_initialized_flag(self):
        """Test sets initialized flag."""
        self.assertFalse(is_initialized())
        load_test_env()
        self.assertTrue(is_initialized())

    def test_force_reload(self):
        """Test force reload works."""
        load_test_env()
        self.assertTrue(is_initialized())

        # Without force, returns empty
        result = load_test_env(force=False)
        self.assertEqual(result, {})

        # With force, reloads
        with mock.patch('bootstrap.bootstrap_env.parse_shell_env_file') as mock_parse:
            mock_parse.return_value = {"TEST": "value"}
            result = load_test_env(force=True)
            # Should have called parse


class TestGetBootstrapPaths(TestCase):
    """Tests for get_bootstrap_paths function."""

    def test_returns_all_paths(self):
        """Test returns all expected paths."""
        result = get_bootstrap_paths()

        self.assertIn("BOOTSTRAP_TEST_DIR", result)
        self.assertIn("BOOTSTRAP_TEST_REPO_ROOT", result)
        self.assertIn("BOOTSTRAP_TEST_SCRIPTS_DIR", result)
        self.assertIn("BOOTSTRAP_TEST_ENV_FILE", result)
        self.assertIn("BOOTSTRAP_TEST_ENV_EXAMPLE", result)

    def test_paths_are_path_objects(self):
        """Test all values are Path objects."""
        result = get_bootstrap_paths()

        for name, path in result.items():
            self.assertIsInstance(path, Path, f"{name} should be a Path")


class TestExportToEnviron(TestCase):
    """Tests for export_to_environ function."""

    def test_exports_paths(self):
        """Test exports paths to environment."""
        # Clear any existing values
        for key in ["BOOTSTRAP_TEST_DIR", "BOOTSTRAP_TEST_REPO_ROOT", "BOOTSTRAP_TEST_SCRIPTS_DIR"]:
            os.environ.pop(key, None)

        export_to_environ()

        self.assertEqual(
            os.environ.get("BOOTSTRAP_TEST_DIR"),
            str(BOOTSTRAP_TEST_DIR)
        )
        self.assertEqual(
            os.environ.get("BOOTSTRAP_TEST_REPO_ROOT"),
            str(BOOTSTRAP_TEST_REPO_ROOT)
        )
        self.assertEqual(
            os.environ.get("BOOTSTRAP_TEST_SCRIPTS_DIR"),
            str(BOOTSTRAP_TEST_SCRIPTS_DIR)
        )


class TestIsInitialized(TestCase):
    """Tests for is_initialized function."""

    def setUp(self):
        """Reset before each test."""
        reset()

    def tearDown(self):
        """Reset after each test."""
        reset()

    def test_false_before_init(self):
        """Test returns False before initialization."""
        self.assertFalse(is_initialized())

    def test_true_after_init(self):
        """Test returns True after initialization."""
        load_test_env()
        self.assertTrue(is_initialized())


class TestReset(TestCase):
    """Tests for reset function."""

    def test_resets_initialized_flag(self):
        """Test resets the initialized flag."""
        load_test_env()
        self.assertTrue(is_initialized())

        reset()

        self.assertFalse(is_initialized())


class TestInit(TestCase):
    """Tests for init function."""

    def setUp(self):
        """Reset before each test."""
        reset()

    def tearDown(self):
        """Reset after each test."""
        reset()

    def test_exports_and_loads(self):
        """Test init exports paths and loads env."""
        from bootstrap.bootstrap_env import init

        # Clear environment
        for key in ["BOOTSTRAP_TEST_DIR", "BOOTSTRAP_TEST_REPO_ROOT", "BOOTSTRAP_TEST_SCRIPTS_DIR"]:
            os.environ.pop(key, None)

        init()

        # Should have exported paths
        self.assertIn("BOOTSTRAP_TEST_DIR", os.environ)
        self.assertIn("BOOTSTRAP_TEST_REPO_ROOT", os.environ)
        self.assertIn("BOOTSTRAP_TEST_SCRIPTS_DIR", os.environ)

        # Should be initialized
        self.assertTrue(is_initialized())


if __name__ == '__main__':
    import unittest
    unittest.main()
