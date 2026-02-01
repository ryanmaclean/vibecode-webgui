#!/usr/bin/env python3
"""Tests for run_vibecode module."""

import sys
import tempfile
import time
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from run_vibecode import (
    BINARY_PATH,
    ENTITLEMENTS_FILE,
    SOURCES_DIR,
    get_vibecode_dir,
    needs_build,
    run_command,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_binary_path(self):
        """Test binary path is defined correctly."""
        self.assertEqual(BINARY_PATH, ".build/arm64-apple-macosx/release/VibeCode")

    def test_sources_dir(self):
        """Test sources directory is defined."""
        self.assertEqual(SOURCES_DIR, "Sources")

    def test_entitlements_file(self):
        """Test entitlements file is defined."""
        self.assertEqual(ENTITLEMENTS_FILE, "VibeCode.entitlements")


class TestGetVibecodeDir(TestCase):
    """Tests for get_vibecode_dir function."""

    def test_returns_path(self):
        """Test function returns a Path object."""
        result = get_vibecode_dir()
        self.assertIsInstance(result, Path)

    def test_path_ends_with_vibecodewift(self):
        """Test path ends with VibeCodeSwift."""
        result = get_vibecode_dir()
        self.assertEqual(result.name, "VibeCodeSwift")


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"], check=False)
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command_no_check(self):
        """Test running failed command without check."""
        rc, stdout, stderr = run_command(["false"], check=False)
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(["nonexistent_cmd_12345"], check=False)
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)

    def test_with_working_directory(self):
        """Test command with working directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            rc, stdout, stderr = run_command(
                ["pwd"],
                cwd=Path(tmpdir),
                check=False
            )
            self.assertEqual(rc, 0)
            self.assertIn(tmpdir, stdout)


class TestNeedsBuild(TestCase):
    """Tests for needs_build function."""

    def test_no_binary_needs_build(self):
        """Test that missing binary requires build."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)
            result = needs_build(vibecode_dir)
            self.assertTrue(result)

    def test_binary_exists_no_sources(self):
        """Test that existing binary with no sources doesn't need build."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)

            # Create binary path
            binary_path = vibecode_dir / BINARY_PATH
            binary_path.parent.mkdir(parents=True)
            binary_path.touch()

            result = needs_build(vibecode_dir)
            self.assertFalse(result)

    def test_binary_newer_than_sources(self):
        """Test that newer binary doesn't need rebuild."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)

            # Create sources first
            sources_dir = vibecode_dir / SOURCES_DIR
            sources_dir.mkdir(parents=True)
            source_file = sources_dir / "main.swift"
            source_file.touch()

            # Small delay to ensure different timestamps
            time.sleep(0.01)

            # Create binary after sources
            binary_path = vibecode_dir / BINARY_PATH
            binary_path.parent.mkdir(parents=True)
            binary_path.touch()

            result = needs_build(vibecode_dir)
            self.assertFalse(result)

    def test_source_newer_than_binary(self):
        """Test that newer source file requires rebuild."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)

            # Create binary first
            binary_path = vibecode_dir / BINARY_PATH
            binary_path.parent.mkdir(parents=True)
            binary_path.touch()

            # Small delay to ensure different timestamps
            time.sleep(0.01)

            # Create sources after binary
            sources_dir = vibecode_dir / SOURCES_DIR
            sources_dir.mkdir(parents=True)
            source_file = sources_dir / "main.swift"
            source_file.touch()

            result = needs_build(vibecode_dir)
            self.assertTrue(result)


class TestBuildVibecode(TestCase):
    """Tests for build_vibecode function."""

    @mock.patch('run_vibecode.run_command')
    def test_calls_swift_build(self, mock_run):
        """Test that swift build is called correctly."""
        from run_vibecode import build_vibecode

        mock_run.return_value = (0, "", "")

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)
            result = build_vibecode(vibecode_dir)

            self.assertTrue(result)
            mock_run.assert_called_once_with(
                ["swift", "build", "-c", "release"],
                cwd=vibecode_dir,
                check=True
            )

    @mock.patch('run_vibecode.run_command')
    def test_returns_false_on_failure(self, mock_run):
        """Test that build failure returns False."""
        from run_vibecode import build_vibecode

        mock_run.return_value = (1, "", "Build failed")

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)
            result = build_vibecode(vibecode_dir)

            self.assertFalse(result)


class TestKillExistingInstances(TestCase):
    """Tests for kill_existing_instances function."""

    @mock.patch('run_vibecode.subprocess.run')
    @mock.patch('run_vibecode.time.sleep')
    def test_calls_pkill(self, mock_sleep, mock_run):
        """Test that pkill is called."""
        from run_vibecode import kill_existing_instances

        kill_existing_instances()

        mock_run.assert_called_once()
        call_args = mock_run.call_args
        self.assertEqual(call_args[0][0], ["pkill", "VibeCode"])
        mock_sleep.assert_called_once_with(0.5)


class TestSignBinary(TestCase):
    """Tests for sign_binary function."""

    @mock.patch('run_vibecode.run_command')
    def test_calls_codesign(self, mock_run):
        """Test that codesign is called correctly."""
        from run_vibecode import sign_binary

        mock_run.return_value = (0, "", "")

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)
            result = sign_binary(vibecode_dir)

            self.assertTrue(result)
            mock_run.assert_called_once()

            call_args = mock_run.call_args[0][0]
            self.assertEqual(call_args[0], "codesign")
            self.assertIn("--force", call_args)
            self.assertIn("--sign", call_args)
            self.assertIn("--entitlements", call_args)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('run_vibecode.launch_vibecode')
    @mock.patch('run_vibecode.sign_binary')
    @mock.patch('run_vibecode.kill_existing_instances')
    @mock.patch('run_vibecode.build_vibecode')
    @mock.patch('run_vibecode.needs_build')
    @mock.patch('run_vibecode.get_vibecode_dir')
    def test_main_skip_build(
        self,
        mock_get_dir,
        mock_needs_build,
        mock_build,
        mock_kill,
        mock_sign,
        mock_launch
    ):
        """Test main with skip_build flag."""
        from run_vibecode import main

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)
            mock_get_dir.return_value = vibecode_dir

            # Create binary
            binary_path = vibecode_dir / BINARY_PATH
            binary_path.parent.mkdir(parents=True)
            binary_path.touch()

            mock_sign.return_value = True
            mock_launch.return_value = 0

            result = main(skip_build=True)

            self.assertEqual(result, 0)
            mock_build.assert_not_called()

    @mock.patch('run_vibecode.launch_vibecode')
    @mock.patch('run_vibecode.sign_binary')
    @mock.patch('run_vibecode.kill_existing_instances')
    @mock.patch('run_vibecode.build_vibecode')
    @mock.patch('run_vibecode.needs_build')
    @mock.patch('run_vibecode.get_vibecode_dir')
    def test_main_skip_sign(
        self,
        mock_get_dir,
        mock_needs_build,
        mock_build,
        mock_kill,
        mock_sign,
        mock_launch
    ):
        """Test main with skip_sign flag."""
        from run_vibecode import main

        with tempfile.TemporaryDirectory() as tmpdir:
            vibecode_dir = Path(tmpdir)
            mock_get_dir.return_value = vibecode_dir

            # Create binary
            binary_path = vibecode_dir / BINARY_PATH
            binary_path.parent.mkdir(parents=True)
            binary_path.touch()

            mock_needs_build.return_value = False
            mock_launch.return_value = 0

            result = main(skip_build=False, skip_sign=True)

            self.assertEqual(result, 0)
            mock_sign.assert_not_called()

    @mock.patch('run_vibecode.get_vibecode_dir')
    def test_main_missing_directory(self, mock_get_dir):
        """Test main with missing VibeCodeSwift directory."""
        from run_vibecode import main

        mock_get_dir.return_value = Path("/nonexistent/path")

        result = main()

        self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
