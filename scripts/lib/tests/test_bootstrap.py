#!/usr/bin/env python3

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

"""Tests for bootstrap module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from bootstrap import (
    bootstrap_init,
    get_scripts_root,
    get_lib_dir,
    reset,
)


class TestBootstrapInit(TestCase):
    """Tests for bootstrap_init function."""

    def setUp(self):
        """Set up test fixtures."""
        reset()

    def tearDown(self):
        """Clean up after tests."""
        reset()
        # Clean up environment variables
        if "SCRIPTS_ROOT" in os.environ:
            del os.environ["SCRIPTS_ROOT"]
        if "LIB_DIR" in os.environ:
            del os.environ["LIB_DIR"]

    def test_bootstrap_init_requires_caller_dir(self):
        """Test bootstrap_init requires caller directory."""
        with self.assertRaises(ValueError) as ctx:
            bootstrap_init("")

        self.assertIn("requires the calling script directory", str(ctx.exception))

    def test_bootstrap_init_requires_valid_directory(self):
        """Test bootstrap_init requires valid directory."""
        with self.assertRaises(ValueError) as ctx:
            bootstrap_init("/nonexistent/path")

        self.assertIn("directory not found", str(ctx.exception))

    def test_bootstrap_init_with_scripts_dir(self):
        """Test bootstrap_init with 'scripts' as directory name."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir).resolve() / "scripts"
            lib_dir = scripts_dir / "lib"
            scripts_dir.mkdir()
            lib_dir.mkdir()

            result_scripts, result_lib = bootstrap_init(str(scripts_dir))

            self.assertEqual(result_scripts, scripts_dir)
            self.assertEqual(result_lib, lib_dir)

    def test_bootstrap_init_with_subdirectory(self):
        """Test bootstrap_init with subdirectory of scripts."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir).resolve()
            scripts_dir = base_dir / "scripts"
            lib_dir = scripts_dir / "lib"
            ops_dir = scripts_dir / "ops"
            scripts_dir.mkdir()
            lib_dir.mkdir()
            ops_dir.mkdir()

            result_scripts, result_lib = bootstrap_init(str(ops_dir))

            # Use resolve() to normalize paths for comparison
            self.assertEqual(result_scripts.resolve(), scripts_dir.resolve())
            self.assertEqual(result_lib.resolve(), lib_dir.resolve())

    def test_bootstrap_init_missing_lib_dir(self):
        """Test bootstrap_init when lib directory doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir).resolve() / "scripts"
            scripts_dir.mkdir()

            with self.assertRaises(FileNotFoundError) as ctx:
                bootstrap_init(str(scripts_dir))

            self.assertIn("Unable to locate scripts/lib", str(ctx.exception))

    def test_bootstrap_init_sets_env_vars(self):
        """Test bootstrap_init sets environment variables."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir).resolve() / "scripts"
            lib_dir = scripts_dir / "lib"
            scripts_dir.mkdir()
            lib_dir.mkdir()

            bootstrap_init(str(scripts_dir))

            self.assertEqual(os.environ["SCRIPTS_ROOT"], str(scripts_dir))
            self.assertEqual(os.environ["LIB_DIR"], str(lib_dir))


class TestGetScriptsRoot(TestCase):
    """Tests for get_scripts_root function."""

    def setUp(self):
        """Set up test fixtures."""
        reset()

    def tearDown(self):
        """Clean up after tests."""
        reset()

    def test_get_scripts_root_before_init(self):
        """Test get_scripts_root returns None before init."""
        self.assertIsNone(get_scripts_root())

    def test_get_scripts_root_after_init(self):
        """Test get_scripts_root returns path after init."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir).resolve() / "scripts"
            lib_dir = scripts_dir / "lib"
            scripts_dir.mkdir()
            lib_dir.mkdir()

            bootstrap_init(str(scripts_dir))

            self.assertEqual(get_scripts_root(), scripts_dir)


class TestGetLibDir(TestCase):
    """Tests for get_lib_dir function."""

    def setUp(self):
        """Set up test fixtures."""
        reset()

    def tearDown(self):
        """Clean up after tests."""
        reset()

    def test_get_lib_dir_before_init(self):
        """Test get_lib_dir returns None before init."""
        self.assertIsNone(get_lib_dir())

    def test_get_lib_dir_after_init(self):
        """Test get_lib_dir returns path after init."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir).resolve() / "scripts"
            lib_dir = scripts_dir / "lib"
            scripts_dir.mkdir()
            lib_dir.mkdir()

            bootstrap_init(str(scripts_dir))

            self.assertEqual(get_lib_dir(), lib_dir)


class TestReset(TestCase):
    """Tests for reset function."""

    def test_reset_clears_state(self):
        """Test reset clears global state."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir).resolve() / "scripts"
            lib_dir = scripts_dir / "lib"
            scripts_dir.mkdir()
            lib_dir.mkdir()

            bootstrap_init(str(scripts_dir))
            self.assertIsNotNone(get_scripts_root())
            self.assertIsNotNone(get_lib_dir())

            reset()

            self.assertIsNone(get_scripts_root())
            self.assertIsNone(get_lib_dir())


if __name__ == '__main__':
    import unittest
    unittest.main()