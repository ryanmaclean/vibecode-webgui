#!/usr/bin/env python3
"""Tests for build_linux module."""

import hashlib
import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "desktop"))

from desktop.build_linux import (
    REQUIRED_DEPS,
    SUPPORTED_ARCHES,
    BuildArtifact,
    BuildConfig,
    check_command_exists,
    check_dpkg_dependency,
    check_linux_dependencies,
    check_prerequisites,
    configure_cargo_cross_compile,
    find_artifact,
    generate_checksum,
    get_command_version,
    get_file_size,
    get_rust_target,
    is_native_arm64,
    run_command,
)


class TestConstants(TestCase):
    """Tests for module constants."""

    def test_supported_arches(self):
        """Test supported architectures."""
        self.assertIn("x86_64", SUPPORTED_ARCHES)
        self.assertIn("arm64", SUPPORTED_ARCHES)
        self.assertEqual(len(SUPPORTED_ARCHES), 2)

    def test_required_deps(self):
        """Test required dependencies list."""
        self.assertIn("libwebkit2gtk-4.1-dev", REQUIRED_DEPS)
        self.assertIn("build-essential", REQUIRED_DEPS)
        self.assertIn("pkg-config", REQUIRED_DEPS)


class TestBuildConfig(TestCase):
    """Tests for BuildConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = BuildConfig()
        self.assertEqual(config.build_type, "release")
        self.assertEqual(config.arch, "x86_64")
        self.assertTrue(config.create_deb)
        self.assertTrue(config.create_appimage)
        self.assertTrue(config.create_rpm)
        self.assertEqual(config.rust_target, "")

    def test_custom_values(self):
        """Test custom configuration values."""
        config = BuildConfig(
            build_type="debug",
            arch="arm64",
            create_deb=False,
            create_appimage=True,
            create_rpm=False,
            rust_target="aarch64-unknown-linux-gnu"
        )
        self.assertEqual(config.build_type, "debug")
        self.assertEqual(config.arch, "arm64")
        self.assertFalse(config.create_deb)
        self.assertTrue(config.create_appimage)
        self.assertFalse(config.create_rpm)
        self.assertEqual(config.rust_target, "aarch64-unknown-linux-gnu")


class TestBuildArtifact(TestCase):
    """Tests for BuildArtifact dataclass."""

    def test_default_values(self):
        """Test default artifact values."""
        artifact = BuildArtifact(path=Path("/test.deb"), size="10M")
        self.assertEqual(artifact.path, Path("/test.deb"))
        self.assertEqual(artifact.size, "10M")
        self.assertIsNone(artifact.checksum_path)

    def test_with_checksum(self):
        """Test artifact with checksum."""
        artifact = BuildArtifact(
            path=Path("/test.deb"),
            size="10M",
            checksum_path=Path("/test.deb.sha256")
        )
        self.assertEqual(artifact.checksum_path, Path("/test.deb.sha256"))


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

    def test_with_cwd(self):
        """Test command with working directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            rc, stdout, stderr = run_command(
                ["pwd"],
                cwd=Path(tmpdir)
            )
            self.assertEqual(rc, 0)
            self.assertIn(tmpdir, stdout)


class TestGetRustTarget(TestCase):
    """Tests for get_rust_target function."""

    def test_x86_64_target(self):
        """Test x86_64 Rust target."""
        result = get_rust_target("x86_64")
        self.assertEqual(result, "x86_64-unknown-linux-gnu")

    def test_arm64_target(self):
        """Test arm64 Rust target."""
        result = get_rust_target("arm64")
        self.assertEqual(result, "aarch64-unknown-linux-gnu")

    def test_unknown_arch(self):
        """Test unknown architecture."""
        result = get_rust_target("unknown")
        self.assertIsNone(result)


class TestCheckCommandExists(TestCase):
    """Tests for check_command_exists function."""

    def test_existing_command(self):
        """Test with existing command."""
        result = check_command_exists("echo")
        self.assertTrue(result)

    def test_nonexistent_command(self):
        """Test with nonexistent command."""
        result = check_command_exists("nonexistent_cmd_12345")
        self.assertFalse(result)


class TestGetCommandVersion(TestCase):
    """Tests for get_command_version function."""

    @mock.patch('desktop.build_linux.run_command')
    def test_returns_version(self, mock_run):
        """Test returns version string."""
        mock_run.return_value = (0, "v20.0.0\n", "")

        result = get_command_version("node", "--version")

        self.assertEqual(result, "v20.0.0")

    @mock.patch('desktop.build_linux.run_command')
    def test_returns_empty_on_failure(self, mock_run):
        """Test returns empty on failure."""
        mock_run.return_value = (1, "", "error")

        result = get_command_version("nonexistent")

        self.assertEqual(result, "")


class TestCheckPrerequisites(TestCase):
    """Tests for check_prerequisites function."""

    @mock.patch('desktop.build_linux.check_command_exists')
    def test_all_present(self, mock_check):
        """Test when all tools present."""
        mock_check.return_value = True

        ok, missing = check_prerequisites()

        self.assertTrue(ok)
        self.assertEqual(missing, [])

    @mock.patch('desktop.build_linux.check_command_exists')
    def test_some_missing(self, mock_check):
        """Test when some tools missing."""
        mock_check.side_effect = lambda x: x != "cargo"

        ok, missing = check_prerequisites()

        self.assertFalse(ok)
        self.assertIn("cargo", missing)


class TestCheckDpkgDependency(TestCase):
    """Tests for check_dpkg_dependency function."""

    @mock.patch('desktop.build_linux.run_command')
    def test_installed(self, mock_run):
        """Test when package installed."""
        mock_run.return_value = (0, "ii  build-essential  12.9\n", "")

        result = check_dpkg_dependency("build-essential")

        self.assertTrue(result)

    @mock.patch('desktop.build_linux.run_command')
    def test_not_installed(self, mock_run):
        """Test when package not installed."""
        mock_run.return_value = (1, "", "")

        result = check_dpkg_dependency("missing-pkg")

        self.assertFalse(result)

    @mock.patch('desktop.build_linux.run_command')
    def test_wrong_status(self, mock_run):
        """Test when package has wrong status."""
        mock_run.return_value = (0, "rc  removed-pkg  1.0\n", "")

        result = check_dpkg_dependency("removed-pkg")

        self.assertFalse(result)


class TestCheckLinuxDependencies(TestCase):
    """Tests for check_linux_dependencies function."""

    @mock.patch('desktop.build_linux.check_dpkg_dependency')
    def test_all_present(self, mock_check):
        """Test when all dependencies present."""
        mock_check.return_value = True

        ok, missing = check_linux_dependencies()

        self.assertTrue(ok)
        self.assertEqual(missing, [])

    @mock.patch('desktop.build_linux.check_dpkg_dependency')
    def test_some_missing(self, mock_check):
        """Test when some dependencies missing."""
        mock_check.side_effect = lambda x: x != "patchelf"

        ok, missing = check_linux_dependencies()

        self.assertFalse(ok)
        self.assertIn("patchelf", missing)


class TestConfigureCargoCC(TestCase):
    """Tests for configure_cargo_cross_compile function."""

    def test_creates_config(self):
        """Test creates cargo config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with mock.patch.object(Path, 'home', return_value=Path(tmpdir)):
                result = configure_cargo_cross_compile()

                self.assertTrue(result)
                config_path = Path(tmpdir) / ".cargo" / "config.toml"
                self.assertTrue(config_path.exists())
                content = config_path.read_text()
                self.assertIn("aarch64-unknown-linux-gnu", content)
                self.assertIn("aarch64-linux-gnu-gcc", content)

    def test_skips_if_exists(self):
        """Test skips if already configured."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cargo_dir = Path(tmpdir) / ".cargo"
            cargo_dir.mkdir()
            config_path = cargo_dir / "config.toml"
            config_path.write_text('[target.aarch64-unknown-linux-gnu]\nlinker = "test"\n')

            with mock.patch.object(Path, 'home', return_value=Path(tmpdir)):
                result = configure_cargo_cross_compile()

                self.assertTrue(result)
                # Content should not be duplicated
                content = config_path.read_text()
                self.assertEqual(content.count("aarch64-unknown-linux-gnu"), 1)


class TestIsNativeArm64(TestCase):
    """Tests for is_native_arm64 function."""

    @mock.patch('desktop.build_linux.run_command')
    def test_is_arm64(self, mock_run):
        """Test on ARM64 machine."""
        mock_run.return_value = (0, "aarch64\n", "")

        result = is_native_arm64()

        self.assertTrue(result)

    @mock.patch('desktop.build_linux.run_command')
    def test_is_x86_64(self, mock_run):
        """Test on x86_64 machine."""
        mock_run.return_value = (0, "x86_64\n", "")

        result = is_native_arm64()

        self.assertFalse(result)


class TestGenerateChecksum(TestCase):
    """Tests for generate_checksum function."""

    def test_generates_checksum(self):
        """Test generates SHA256 checksum."""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.deb"
            test_file.write_bytes(b"test content")

            result = generate_checksum(test_file)

            self.assertIsNotNone(result)
            self.assertTrue(result.exists())
            self.assertEqual(result.suffix, ".sha256")

            # Verify checksum content
            content = result.read_text()
            expected_hash = hashlib.sha256(b"test content").hexdigest()
            self.assertIn(expected_hash, content)
            self.assertIn("test.deb", content)

    def test_nonexistent_file(self):
        """Test with nonexistent file."""
        result = generate_checksum(Path("/nonexistent/file.deb"))
        self.assertIsNone(result)


class TestGetFileSize(TestCase):
    """Tests for get_file_size function."""

    def test_bytes_size(self):
        """Test bytes size formatting."""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "small.txt"
            test_file.write_bytes(b"x" * 500)

            result = get_file_size(test_file)

            self.assertIn("B", result)

    def test_kilobytes_size(self):
        """Test kilobytes size formatting."""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "medium.txt"
            test_file.write_bytes(b"x" * 5000)

            result = get_file_size(test_file)

            self.assertIn("K", result)

    def test_megabytes_size(self):
        """Test megabytes size formatting."""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "large.bin"
            test_file.write_bytes(b"x" * (2 * 1024 * 1024))

            result = get_file_size(test_file)

            self.assertIn("M", result)


class TestFindArtifact(TestCase):
    """Tests for find_artifact function."""

    def test_finds_deb(self):
        """Test finds .deb artifact."""
        with tempfile.TemporaryDirectory() as tmpdir:
            bundle_dir = Path(tmpdir)
            deb_dir = bundle_dir / "deb"
            deb_dir.mkdir()
            deb_file = deb_dir / "vibecode_1.0.0_amd64.deb"
            deb_file.write_bytes(b"deb content")

            result = find_artifact(bundle_dir, "deb", "*.deb")

            self.assertIsNotNone(result)
            self.assertEqual(result.path, deb_file)
            self.assertIsNotNone(result.size)
            self.assertIsNotNone(result.checksum_path)

    def test_finds_appimage(self):
        """Test finds .AppImage artifact."""
        with tempfile.TemporaryDirectory() as tmpdir:
            bundle_dir = Path(tmpdir)
            appimage_dir = bundle_dir / "appimage"
            appimage_dir.mkdir()
            appimage_file = appimage_dir / "VibeCode_1.0.0_amd64.AppImage"
            appimage_file.write_bytes(b"appimage content")

            result = find_artifact(bundle_dir, "appimage", "*.AppImage")

            self.assertIsNotNone(result)
            self.assertEqual(result.path, appimage_file)

    def test_no_artifact(self):
        """Test when no artifact found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            bundle_dir = Path(tmpdir)

            result = find_artifact(bundle_dir, "deb", "*.deb")

            self.assertIsNone(result)

    def test_empty_directory(self):
        """Test with empty artifact directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            bundle_dir = Path(tmpdir)
            deb_dir = bundle_dir / "deb"
            deb_dir.mkdir()

            result = find_artifact(bundle_dir, "deb", "*.deb")

            self.assertIsNone(result)


class TestBuild(TestCase):
    """Tests for build function."""

    @mock.patch('desktop.build_linux.find_artifact')
    @mock.patch('desktop.build_linux.build_tauri')
    @mock.patch('desktop.build_linux.build_frontend')
    @mock.patch('desktop.build_linux.install_npm_dependencies')
    @mock.patch('desktop.build_linux.install_rust_target')
    @mock.patch('desktop.build_linux.check_linux_dependencies')
    @mock.patch('desktop.build_linux.check_prerequisites')
    def test_build_success(
        self,
        mock_prereqs,
        mock_deps,
        mock_rust,
        mock_npm,
        mock_frontend,
        mock_tauri,
        mock_artifact
    ):
        """Test successful build."""
        from desktop.build_linux import build

        mock_prereqs.return_value = (True, [])
        mock_deps.return_value = (True, [])
        mock_rust.return_value = True
        mock_npm.return_value = True
        mock_frontend.return_value = True
        mock_tauri.return_value = True
        mock_artifact.return_value = None

        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            bundle_dir = project_root / "src-tauri" / "target" / "x86_64-unknown-linux-gnu" / "release" / "bundle"
            bundle_dir.mkdir(parents=True)

            config = BuildConfig(
                project_root=project_root,
                arch="x86_64"
            )

            result = build(config)

            self.assertEqual(result, 0)

    @mock.patch('desktop.build_linux.check_prerequisites')
    def test_build_missing_prereqs(self, mock_prereqs):
        """Test build fails with missing prerequisites."""
        from desktop.build_linux import build

        mock_prereqs.return_value = (False, ["cargo"])

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(project_root=Path(tmpdir))

            result = build(config)

            self.assertEqual(result, 1)

    def test_build_unsupported_arch(self):
        """Test build fails with unsupported architecture."""
        from desktop.build_linux import build

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                project_root=Path(tmpdir),
                arch="unsupported"
            )

            result = build(config)

            self.assertEqual(result, 1)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('desktop.build_linux.build')
    def test_main_default(self, mock_build):
        """Test main with defaults."""
        from desktop.build_linux import main

        mock_build.return_value = 0

        result = main()

        self.assertEqual(result, 0)
        mock_build.assert_called_once()

    @mock.patch('desktop.build_linux.build')
    def test_main_with_args(self, mock_build):
        """Test main with arguments."""
        from desktop.build_linux import main

        mock_build.return_value = 0

        with tempfile.TemporaryDirectory() as tmpdir:
            result = main(
                build_type="debug",
                arch="arm64",
                create_deb=False,
                project_root=Path(tmpdir)
            )

            self.assertEqual(result, 0)
            call_config = mock_build.call_args[0][0]
            self.assertEqual(call_config.build_type, "debug")
            self.assertEqual(call_config.arch, "arm64")
            self.assertFalse(call_config.create_deb)

    @mock.patch('desktop.build_linux.build')
    @mock.patch.dict(os.environ, {
        "BUILD_TYPE": "debug",
        "ARCH": "arm64",
        "CREATE_DEB": "false"
    })
    def test_main_uses_env(self, mock_build):
        """Test main uses environment variables."""
        from desktop.build_linux import main

        mock_build.return_value = 0

        with tempfile.TemporaryDirectory() as tmpdir:
            result = main(project_root=Path(tmpdir))

            self.assertEqual(result, 0)
            call_config = mock_build.call_args[0][0]
            self.assertEqual(call_config.build_type, "debug")
            self.assertEqual(call_config.arch, "arm64")
            self.assertFalse(call_config.create_deb)


if __name__ == '__main__':
    import unittest
    unittest.main()
