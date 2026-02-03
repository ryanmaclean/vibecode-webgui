#!/usr/bin/env python3
"""Tests for build_codeserver_local module."""

import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from build_codeserver_local import (
    DEFAULT_VERSION,
    DOCKERFILE_PATH,
    IMAGE_NAME,
    build_image,
    get_build_date,
    get_git_commit,
    get_native_arch,
    run_command,
    tag_native_architecture,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_image_name(self):
        """Test image name is defined correctly."""
        self.assertEqual(IMAGE_NAME, "vibecode-codeserver")

    def test_dockerfile_path(self):
        """Test Dockerfile path is defined."""
        self.assertEqual(DOCKERFILE_PATH, "docker/code-server/Dockerfile")

    def test_default_version(self):
        """Test default version is defined."""
        self.assertEqual(DEFAULT_VERSION, "1.0.0")


class TestGetGitCommit(TestCase):
    """Tests for get_git_commit function."""

    def test_returns_string(self):
        """Test function returns a string."""
        result = get_git_commit()
        self.assertIsInstance(result, str)

    def test_returns_short_hash_or_unknown(self):
        """Test returns short hash or unknown."""
        result = get_git_commit()
        # Either a short hash or 'unknown'
        self.assertTrue(len(result) <= 12 or result == "unknown")


class TestGetBuildDate(TestCase):
    """Tests for get_build_date function."""

    def test_returns_iso_format(self):
        """Test returns ISO format date."""
        result = get_build_date()
        self.assertRegex(result, r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z')

    def test_ends_with_z(self):
        """Test date ends with Z (UTC)."""
        result = get_build_date()
        self.assertTrue(result.endswith('Z'))


class TestGetNativeArch(TestCase):
    """Tests for get_native_arch function."""

    def test_returns_valid_arch(self):
        """Test returns arm64 or amd64."""
        result = get_native_arch()
        self.assertIn(result, ["arm64", "amd64"])


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"], capture=True)
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"], check=False, capture=True)
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(
            ["nonexistent_cmd_12345"],
            check=False,
            capture=True
        )
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)


class TestBuildImage(TestCase):
    """Tests for build_image function."""

    @mock.patch('build_codeserver_local.run_command')
    def test_builds_amd64(self, mock_run):
        """Test building AMD64 image."""
        mock_run.return_value = (0, "", "")

        result = build_image(
            "linux/amd64",
            IMAGE_NAME,
            "1.0.0",
            "2024-01-01T00:00:00Z",
            "abc123"
        )

        self.assertTrue(result)
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        self.assertIn("--platform", call_args)
        self.assertIn("linux/amd64", call_args)

    @mock.patch('build_codeserver_local.run_command')
    def test_builds_arm64(self, mock_run):
        """Test building ARM64 image."""
        mock_run.return_value = (0, "", "")

        result = build_image(
            "linux/arm64",
            IMAGE_NAME,
            "1.0.0",
            "2024-01-01T00:00:00Z",
            "abc123"
        )

        self.assertTrue(result)
        call_args = mock_run.call_args[0][0]
        self.assertIn("linux/arm64", call_args)

    @mock.patch('build_codeserver_local.run_command')
    def test_returns_false_on_failure(self, mock_run):
        """Test returns False on build failure."""
        mock_run.return_value = (1, "", "Build failed")

        result = build_image(
            "linux/amd64",
            IMAGE_NAME,
            "1.0.0",
            "2024-01-01T00:00:00Z",
            "abc123"
        )

        self.assertFalse(result)

    @mock.patch('build_codeserver_local.run_command')
    def test_includes_build_args(self, mock_run):
        """Test build includes build args."""
        mock_run.return_value = (0, "", "")

        build_image(
            "linux/amd64",
            IMAGE_NAME,
            "2.0.0",
            "2024-01-01T00:00:00Z",
            "def456"
        )

        call_args = mock_run.call_args[0][0]
        self.assertIn("--build-arg", call_args)
        self.assertIn("VERSION=2.0.0", call_args)
        self.assertIn("GIT_COMMIT=def456", call_args)


class TestTagNativeArchitecture(TestCase):
    """Tests for tag_native_architecture function."""

    @mock.patch('build_codeserver_local.run_command')
    @mock.patch('build_codeserver_local.get_native_arch')
    def test_tags_arm64_on_arm(self, mock_arch, mock_run):
        """Test tags ARM64 on ARM machine."""
        mock_arch.return_value = "arm64"
        mock_run.return_value = (0, "", "")

        result = tag_native_architecture(IMAGE_NAME, "1.0.0")

        self.assertTrue(result)
        # Should be called twice (version and latest)
        self.assertEqual(mock_run.call_count, 2)

    @mock.patch('build_codeserver_local.run_command')
    @mock.patch('build_codeserver_local.get_native_arch')
    def test_tags_amd64_on_x86(self, mock_arch, mock_run):
        """Test tags AMD64 on x86 machine."""
        mock_arch.return_value = "amd64"
        mock_run.return_value = (0, "", "")

        result = tag_native_architecture(IMAGE_NAME, "1.0.0")

        self.assertTrue(result)
        call_args = mock_run.call_args_list[0][0][0]
        # Check that source image includes amd64
        self.assertIn("amd64", call_args[2])

    @mock.patch('build_codeserver_local.run_command')
    @mock.patch('build_codeserver_local.get_native_arch')
    def test_returns_false_on_failure(self, mock_arch, mock_run):
        """Test returns False on tagging failure."""
        mock_arch.return_value = "arm64"
        mock_run.return_value = (1, "", "Tag failed")

        result = tag_native_architecture(IMAGE_NAME, "1.0.0")

        self.assertFalse(result)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('build_codeserver_local.print_summary')
    @mock.patch('build_codeserver_local.tag_native_architecture')
    @mock.patch('build_codeserver_local.build_image')
    @mock.patch('build_codeserver_local.cleanup_old_images')
    def test_main_success(
        self,
        mock_cleanup,
        mock_build,
        mock_tag,
        mock_summary
    ):
        """Test successful main execution."""
        from build_codeserver_local import main

        mock_build.return_value = True
        mock_tag.return_value = True

        result = main(version="1.0.0")

        self.assertEqual(result, 0)
        self.assertEqual(mock_build.call_count, 2)  # AMD64 and ARM64
        mock_tag.assert_called_once()

    @mock.patch('build_codeserver_local.build_image')
    @mock.patch('build_codeserver_local.cleanup_old_images')
    def test_main_amd64_only(self, mock_cleanup, mock_build):
        """Test main with amd64_only flag."""
        from build_codeserver_local import main

        mock_build.return_value = True

        with mock.patch('build_codeserver_local.tag_native_architecture') as mock_tag:
            mock_tag.return_value = True
            result = main(version="1.0.0", amd64_only=True)

        self.assertEqual(result, 0)
        self.assertEqual(mock_build.call_count, 1)
        call_args = mock_build.call_args[0]
        self.assertEqual(call_args[0], "linux/amd64")

    @mock.patch('build_codeserver_local.build_image')
    @mock.patch('build_codeserver_local.cleanup_old_images')
    def test_main_arm64_only(self, mock_cleanup, mock_build):
        """Test main with arm64_only flag."""
        from build_codeserver_local import main

        mock_build.return_value = True

        with mock.patch('build_codeserver_local.tag_native_architecture') as mock_tag:
            mock_tag.return_value = True
            result = main(version="1.0.0", arm64_only=True)

        self.assertEqual(result, 0)
        self.assertEqual(mock_build.call_count, 1)
        call_args = mock_build.call_args[0]
        self.assertEqual(call_args[0], "linux/arm64")

    @mock.patch('build_codeserver_local.build_image')
    @mock.patch('build_codeserver_local.cleanup_old_images')
    def test_main_build_failure(self, mock_cleanup, mock_build):
        """Test main with build failure."""
        from build_codeserver_local import main

        mock_build.return_value = False

        result = main(version="1.0.0")

        self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
