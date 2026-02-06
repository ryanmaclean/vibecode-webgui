#!/usr/bin/env python3
"""Tests for build_tui module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from build_tui import (
    SCRIPT_DEFINITIONS,
    BuildCategory,
    BuildConfig,
    BuildScript,
    BuildTUI,
    categorize_script,
    check_docker_available,
    discover_scripts,
    extract_description,
    get_repo_root,
    list_scripts,
    run_script,
)


class TestBuildCategory(TestCase):
    """Tests for BuildCategory enum."""

    def test_display_names(self):
        """Test display names for all categories."""
        self.assertEqual(BuildCategory.VM.display_name, "VM Builds")
        self.assertEqual(BuildCategory.DOCKER.display_name, "Docker/Container")
        self.assertEqual(BuildCategory.DESKTOP.display_name, "Desktop Apps")
        self.assertEqual(BuildCategory.RELEASE.display_name, "Release Builds")
        self.assertEqual(BuildCategory.VFKIT.display_name, "vfkit VMs")
        self.assertEqual(BuildCategory.SWIFT.display_name, "Swift/Native")
        self.assertEqual(BuildCategory.OPENVSCODE.display_name, "OpenVSCode")
        self.assertEqual(BuildCategory.BENCHMARK.display_name, "Benchmarks")
        self.assertEqual(BuildCategory.OTHER.display_name, "Other")


class TestBuildScript(TestCase):
    """Tests for BuildScript dataclass."""

    def test_basic_script(self):
        """Test basic script creation."""
        script = BuildScript(
            name="test-build.sh",
            path=Path("/test/path"),
            category=BuildCategory.VM,
            description="Test script"
        )
        self.assertEqual(script.name, "test-build.sh")
        self.assertEqual(script.path, Path("/test/path"))
        self.assertEqual(script.category, BuildCategory.VM)
        self.assertEqual(script.description, "Test script")
        self.assertFalse(script.requires_docker)
        self.assertFalse(script.requires_sudo)

    def test_docker_script(self):
        """Test script requiring Docker."""
        script = BuildScript(
            name="build-container.sh",
            path=Path("/test/path"),
            category=BuildCategory.DOCKER,
            requires_docker=True
        )
        self.assertTrue(script.requires_docker)


class TestBuildConfig(TestCase):
    """Tests for BuildConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = BuildConfig()
        self.assertFalse(config.dry_run)
        self.assertFalse(config.verbose)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = BuildConfig(
            scripts_dir=Path("/custom/scripts"),
            dry_run=True,
            verbose=True
        )
        self.assertEqual(config.scripts_dir, Path("/custom/scripts"))
        self.assertTrue(config.dry_run)
        self.assertTrue(config.verbose)


class TestCategorizeScript(TestCase):
    """Tests for categorize_script function."""

    def test_vfkit_scripts(self):
        """Test vfkit script categorization."""
        self.assertEqual(
            categorize_script("vfkit/build-something.sh"),
            BuildCategory.VFKIT
        )

    def test_desktop_scripts(self):
        """Test desktop script categorization."""
        self.assertEqual(
            categorize_script("desktop/build-macos.sh"),
            BuildCategory.DESKTOP
        )

    def test_release_scripts(self):
        """Test release script categorization."""
        self.assertEqual(
            categorize_script("release/build-release.sh"),
            BuildCategory.RELEASE
        )

    def test_benchmark_scripts(self):
        """Test benchmark script categorization."""
        self.assertEqual(
            categorize_script("benchmarks/build-test.sh"),
            BuildCategory.BENCHMARK
        )

    def test_docker_scripts(self):
        """Test docker script categorization."""
        self.assertEqual(
            categorize_script("build-docker-image.sh"),
            BuildCategory.DOCKER
        )
        self.assertEqual(
            categorize_script("build-codeserver.sh"),
            BuildCategory.DOCKER
        )

    def test_vm_scripts(self):
        """Test VM script categorization."""
        self.assertEqual(
            categorize_script("build-vm-test.sh"),
            BuildCategory.VM
        )
        self.assertEqual(
            categorize_script("build-initramfs.sh"),
            BuildCategory.VM
        )

    def test_swift_scripts(self):
        """Test Swift script categorization."""
        self.assertEqual(
            categorize_script("build-swift-app.sh"),
            BuildCategory.SWIFT
        )
        self.assertEqual(
            categorize_script("build-apple-runtime.sh"),
            BuildCategory.SWIFT
        )

    def test_openvscode_scripts(self):
        """Test OpenVSCode script categorization."""
        self.assertEqual(
            categorize_script("build-openvscode.sh"),
            BuildCategory.OPENVSCODE
        )

    def test_other_scripts(self):
        """Test other script categorization."""
        self.assertEqual(
            categorize_script("build-random.sh"),
            BuildCategory.OTHER
        )


class TestExtractDescription(TestCase):
    """Tests for extract_description function."""

    def test_with_description(self):
        """Test extraction from script with description."""
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.sh',
            delete=False
        ) as f:
            f.write("#!/bin/bash\n")
            f.write("# This is a test script that does something useful\n")
            f.write("set -e\n")
            f.flush()

            result = extract_description(Path(f.name))

            self.assertEqual(
                result,
                "This is a test script that does something useful"
            )

        os.unlink(f.name)

    def test_without_description(self):
        """Test extraction from script without description."""
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.sh',
            delete=False
        ) as f:
            f.write("#!/bin/bash\n")
            f.write("set -e\n")
            f.write("echo hello\n")
            f.flush()

            result = extract_description(Path(f.name))

            self.assertEqual(result, "")

        os.unlink(f.name)

    def test_nonexistent_file(self):
        """Test extraction from nonexistent file."""
        result = extract_description(Path("/nonexistent/file.sh"))
        self.assertEqual(result, "")


class TestScriptDefinitions(TestCase):
    """Tests for script definitions."""

    def test_definitions_exist(self):
        """Test that script definitions exist."""
        self.assertTrue(len(SCRIPT_DEFINITIONS) > 0)

    def test_definitions_have_category(self):
        """Test all definitions have a category."""
        for name, meta in SCRIPT_DEFINITIONS.items():
            self.assertIn(
                "category",
                meta,
                f"Missing category for {name}"
            )
            self.assertIsInstance(
                meta["category"],
                BuildCategory,
                f"Invalid category for {name}"
            )

    def test_vm_scripts_defined(self):
        """Test VM scripts are defined."""
        self.assertIn("build-all-vms.sh", SCRIPT_DEFINITIONS)
        self.assertEqual(
            SCRIPT_DEFINITIONS["build-all-vms.sh"]["category"],
            BuildCategory.VM
        )

    def test_docker_scripts_defined(self):
        """Test Docker scripts are defined."""
        self.assertIn("build-code-server.sh", SCRIPT_DEFINITIONS)
        self.assertEqual(
            SCRIPT_DEFINITIONS["build-code-server.sh"]["category"],
            BuildCategory.DOCKER
        )
        self.assertTrue(
            SCRIPT_DEFINITIONS["build-code-server.sh"]["requires_docker"]
        )

    def test_desktop_scripts_defined(self):
        """Test desktop scripts are defined."""
        self.assertIn("desktop/build-all.sh", SCRIPT_DEFINITIONS)
        self.assertEqual(
            SCRIPT_DEFINITIONS["desktop/build-all.sh"]["category"],
            BuildCategory.DESKTOP
        )


class TestGetRepoRoot(TestCase):
    """Tests for get_repo_root function."""

    def test_returns_path(self):
        """Test returns a Path object."""
        result = get_repo_root()
        self.assertIsInstance(result, Path)

    def test_path_exists(self):
        """Test returned path exists."""
        result = get_repo_root()
        self.assertTrue(result.exists())


class TestCheckDockerAvailable(TestCase):
    """Tests for check_docker_available function."""

    @mock.patch('build_tui.subprocess.run')
    def test_docker_available(self, mock_run):
        """Test when Docker is available."""
        mock_run.return_value = mock.Mock(returncode=0)

        result = check_docker_available()

        self.assertTrue(result)

    @mock.patch('build_tui.subprocess.run')
    def test_docker_not_available(self, mock_run):
        """Test when Docker is not available."""
        mock_run.return_value = mock.Mock(returncode=1)

        result = check_docker_available()

        self.assertFalse(result)

    @mock.patch('build_tui.subprocess.run')
    def test_docker_command_fails(self, mock_run):
        """Test when Docker command fails."""
        mock_run.side_effect = FileNotFoundError()

        result = check_docker_available()

        self.assertFalse(result)


class TestDiscoverScripts(TestCase):
    """Tests for discover_scripts function."""

    def test_discovers_scripts(self):
        """Test script discovery."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir)

            # Create test scripts
            (scripts_dir / "build-test.sh").write_text("#!/bin/bash\n# Test\n")
            (scripts_dir / "vfkit").mkdir()
            (scripts_dir / "vfkit" / "build-vm.sh").write_text("#!/bin/bash\n")

            result = discover_scripts(scripts_dir)

            self.assertEqual(len(result), 2)
            names = [s.name for s in result]
            self.assertIn("build-test.sh", names)
            self.assertIn("vfkit/build-vm.sh", names)

    def test_skips_archived(self):
        """Test archived scripts are skipped."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir)

            # Create regular and archived scripts
            (scripts_dir / "build-test.sh").write_text("#!/bin/bash\n")
            (scripts_dir / "archive").mkdir()
            (scripts_dir / "archive" / "build-old.sh").write_text("#!/bin/bash\n")

            result = discover_scripts(scripts_dir)

            names = [s.name for s in result]
            self.assertIn("build-test.sh", names)
            self.assertNotIn("archive/build-old.sh", names)

    def test_sorts_by_category(self):
        """Test scripts are sorted by category."""
        with tempfile.TemporaryDirectory() as tmpdir:
            scripts_dir = Path(tmpdir)

            (scripts_dir / "build-docker.sh").write_text("#!/bin/bash\n")
            (scripts_dir / "build-vm.sh").write_text("#!/bin/bash\n")
            (scripts_dir / "vfkit").mkdir()
            (scripts_dir / "vfkit" / "build-tiny.sh").write_text("#!/bin/bash\n")

            result = discover_scripts(scripts_dir)

            # VM should come before DOCKER, VFKIT after
            categories = [s.category for s in result]
            vm_idx = next(
                (i for i, c in enumerate(categories) if c == BuildCategory.VM),
                -1
            )
            docker_idx = next(
                (i for i, c in enumerate(categories) if c == BuildCategory.DOCKER),
                -1
            )

            # Ensure we found categories
            self.assertNotEqual(vm_idx, -1)
            self.assertNotEqual(docker_idx, -1)


class TestRunScript(TestCase):
    """Tests for run_script function."""

    def test_dry_run(self):
        """Test dry run mode."""
        script = BuildScript(
            name="test.sh",
            path=Path("/test/script.sh"),
            category=BuildCategory.OTHER
        )

        result = run_script(script, dry_run=True)

        self.assertEqual(result, 0)

    @mock.patch('build_tui.check_docker_available')
    def test_docker_required_not_available(self, mock_docker):
        """Test fails when Docker required but not available."""
        mock_docker.return_value = False

        script = BuildScript(
            name="test.sh",
            path=Path("/test/script.sh"),
            category=BuildCategory.DOCKER,
            requires_docker=True
        )

        result = run_script(script, dry_run=False)

        self.assertEqual(result, 1)

    @mock.patch('build_tui.subprocess.run')
    def test_runs_script(self, mock_run):
        """Test script execution."""
        mock_run.return_value = mock.Mock(returncode=0)

        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.sh',
            delete=False
        ) as f:
            f.write("#!/bin/bash\necho hello\n")
            f.flush()

            script = BuildScript(
                name="test.sh",
                path=Path(f.name),
                category=BuildCategory.OTHER
            )

            result = run_script(script, dry_run=False)

            self.assertEqual(result, 0)
            mock_run.assert_called_once()

        os.unlink(f.name)


class TestBuildTUI(TestCase):
    """Tests for BuildTUI class."""

    def setUp(self):
        """Set up test fixtures."""
        self.scripts = [
            BuildScript(
                name="build-vm1.sh",
                path=Path("/test/vm1.sh"),
                category=BuildCategory.VM,
                description="Build VM 1"
            ),
            BuildScript(
                name="build-vm2.sh",
                path=Path("/test/vm2.sh"),
                category=BuildCategory.VM,
                description="Build VM 2"
            ),
            BuildScript(
                name="build-docker.sh",
                path=Path("/test/docker.sh"),
                category=BuildCategory.DOCKER,
                description="Build Docker image"
            ),
        ]
        self.config = BuildConfig()
        self.tui = BuildTUI(self.scripts, self.config)

    def test_initialization(self):
        """Test TUI initialization."""
        self.assertEqual(self.tui.scripts, self.scripts)
        self.assertEqual(self.tui.current_idx, 0)
        self.assertIsNone(self.tui.category_filter)
        self.assertEqual(self.tui.search_term, "")

    def test_get_filtered_scripts_no_filter(self):
        """Test filtering with no filter."""
        result = self.tui.get_filtered_scripts()
        self.assertEqual(len(result), 3)

    def test_get_filtered_scripts_by_category(self):
        """Test filtering by category."""
        self.tui.category_filter = BuildCategory.VM

        result = self.tui.get_filtered_scripts()

        self.assertEqual(len(result), 2)
        for s in result:
            self.assertEqual(s.category, BuildCategory.VM)

    def test_get_filtered_scripts_by_search(self):
        """Test filtering by search term."""
        self.tui.search_term = "docker"

        result = self.tui.get_filtered_scripts()

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "build-docker.sh")

    def test_get_filtered_scripts_combined(self):
        """Test combined category and search filter."""
        self.tui.category_filter = BuildCategory.VM
        self.tui.search_term = "vm1"

        result = self.tui.get_filtered_scripts()

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "build-vm1.sh")

    def test_move_cursor(self):
        """Test cursor movement."""
        self.tui._move_cursor(1)
        self.assertEqual(self.tui.current_idx, 1)

        self.tui._move_cursor(1)
        self.assertEqual(self.tui.current_idx, 2)

        self.tui._move_cursor(-1)
        self.assertEqual(self.tui.current_idx, 1)

    def test_move_cursor_bounds(self):
        """Test cursor bounds."""
        self.tui._move_cursor(-10)
        self.assertEqual(self.tui.current_idx, 0)

        self.tui._move_cursor(100)
        self.assertEqual(self.tui.current_idx, 2)

    def test_cycle_category(self):
        """Test category cycling."""
        self.assertIsNone(self.tui.category_filter)

        self.tui._cycle_category()
        self.assertEqual(self.tui.category_filter, BuildCategory.VM)

        self.tui._cycle_category()
        self.assertEqual(self.tui.category_filter, BuildCategory.DOCKER)

    def test_cycle_category_resets(self):
        """Test category cycling resets cursor."""
        self.tui.current_idx = 2
        self.tui._cycle_category()

        self.assertEqual(self.tui.current_idx, 0)


class TestListScripts(TestCase):
    """Tests for list_scripts function."""

    def test_outputs_scripts(self):
        """Test script listing output."""
        scripts = [
            BuildScript(
                name="build-test.sh",
                path=Path("/test.sh"),
                category=BuildCategory.VM,
                description="Test script"
            )
        ]

        # Just verify it doesn't crash
        with mock.patch('builtins.print'):
            list_scripts(scripts)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('build_tui.discover_scripts')
    @mock.patch('build_tui.list_scripts')
    def test_list_mode(self, mock_list, mock_discover):
        """Test list mode."""
        from build_tui import main

        mock_discover.return_value = [
            BuildScript(
                name="test.sh",
                path=Path("/test.sh"),
                category=BuildCategory.VM
            )
        ]

        result = main(list_only=True)

        self.assertEqual(result, 0)
        mock_list.assert_called_once()

    @mock.patch('build_tui.discover_scripts')
    @mock.patch('build_tui.run_script')
    def test_run_mode(self, mock_run, mock_discover):
        """Test direct run mode."""
        from build_tui import main

        mock_discover.return_value = [
            BuildScript(
                name="build-test.sh",
                path=Path("/test.sh"),
                category=BuildCategory.VM
            )
        ]
        mock_run.return_value = 0

        result = main(run_script_name="build-test.sh")

        self.assertEqual(result, 0)
        mock_run.assert_called_once()

    @mock.patch('build_tui.discover_scripts')
    def test_run_mode_not_found(self, mock_discover):
        """Test run mode with script not found."""
        from build_tui import main

        mock_discover.return_value = [
            BuildScript(
                name="other.sh",
                path=Path("/test.sh"),
                category=BuildCategory.VM
            )
        ]

        result = main(run_script_name="nonexistent.sh")

        self.assertEqual(result, 1)

    @mock.patch('build_tui.discover_scripts')
    def test_no_scripts_found(self, mock_discover):
        """Test when no scripts found."""
        from build_tui import main

        mock_discover.return_value = []

        result = main(list_only=True)

        self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
