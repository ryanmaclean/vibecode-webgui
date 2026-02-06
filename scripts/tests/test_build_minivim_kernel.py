#!/usr/bin/env python3
"""Tests for build_minivim_kernel module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "benchmarks"))

from benchmarks.build_minivim_kernel import (
    BuildConfig,
    SUPPORTED_ARCHES,
    get_defconfig,
    get_jobs,
    get_make_bin,
    run_command,
)


class TestSupportedArches(TestCase):
    """Tests for SUPPORTED_ARCHES constant."""

    def test_contains_x86_64(self):
        """Test x86_64 is supported."""
        self.assertIn("x86_64", SUPPORTED_ARCHES)

    def test_contains_arm64(self):
        """Test arm64 is supported."""
        self.assertIn("arm64", SUPPORTED_ARCHES)

    def test_contains_armv7(self):
        """Test armv7 is supported."""
        self.assertIn("armv7", SUPPORTED_ARCHES)

    def test_has_three_arches(self):
        """Test there are exactly 3 supported architectures."""
        self.assertEqual(len(SUPPORTED_ARCHES), 3)


class TestBuildConfig(TestCase):
    """Tests for BuildConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = BuildConfig()
        self.assertEqual(config.arch, "x86_64")
        self.assertEqual(config.kernel_version, "6.12.10")
        self.assertFalse(config.skip_mrproper)
        self.assertEqual(config.jobs, 4)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = BuildConfig(
            arch="arm64",
            kernel_version="6.11.0",
            skip_mrproper=True,
            jobs=8
        )
        self.assertEqual(config.arch, "arm64")
        self.assertEqual(config.kernel_version, "6.11.0")
        self.assertTrue(config.skip_mrproper)
        self.assertEqual(config.jobs, 8)

    def test_path_fields(self):
        """Test path fields default to empty Path."""
        config = BuildConfig()
        self.assertEqual(config.build_root, Path())
        self.assertEqual(config.src_dir, Path())
        self.assertEqual(config.config_dir, Path())


class TestGetDefconfig(TestCase):
    """Tests for get_defconfig function."""

    def test_x86_64_defconfig(self):
        """Test x86_64 defconfig."""
        result = get_defconfig("x86_64")
        self.assertEqual(result, "x86_64_defconfig")

    def test_arm64_defconfig(self):
        """Test arm64 defconfig."""
        result = get_defconfig("arm64")
        self.assertEqual(result, "defconfig")

    def test_armv7_defconfig(self):
        """Test armv7 defconfig."""
        result = get_defconfig("armv7")
        self.assertEqual(result, "multi_v7_defconfig")

    def test_unknown_arch_defconfig(self):
        """Test unknown architecture returns default defconfig."""
        result = get_defconfig("unknown")
        self.assertEqual(result, "defconfig")


class TestGetMakeBin(TestCase):
    """Tests for get_make_bin function."""

    @mock.patch('benchmarks.build_minivim_kernel.shutil.which')
    def test_prefers_gmake(self, mock_which):
        """Test gmake is preferred."""
        mock_which.side_effect = lambda x: f"/usr/bin/{x}"

        result = get_make_bin()

        self.assertEqual(result, "gmake")

    @mock.patch('benchmarks.build_minivim_kernel.shutil.which')
    def test_falls_back_to_make(self, mock_which):
        """Test falls back to make when gmake not found."""
        mock_which.side_effect = lambda x: None if x == "gmake" else "/usr/bin/make"

        result = get_make_bin()

        self.assertEqual(result, "make")


class TestGetJobs(TestCase):
    """Tests for get_jobs function."""

    @mock.patch.dict(os.environ, {"MINIVIM_JOBS": "16"})
    def test_uses_env_var(self):
        """Test uses MINIVIM_JOBS environment variable."""
        result = get_jobs()
        self.assertEqual(result, 16)

    @mock.patch.dict(os.environ, {"MINIVIM_JOBS": ""}, clear=False)
    @mock.patch('benchmarks.build_minivim_kernel.shutil.which')
    @mock.patch('benchmarks.build_minivim_kernel.run_command')
    def test_uses_nproc(self, mock_run, mock_which):
        """Test uses nproc when available."""
        mock_which.side_effect = lambda x: "/usr/bin/nproc" if x == "nproc" else None
        mock_run.return_value = (0, "8\n", "")

        # Clear the env var for this test
        with mock.patch.dict(os.environ, {"MINIVIM_JOBS": ""}, clear=False):
            result = get_jobs()

        self.assertEqual(result, 8)

    @mock.patch.dict(os.environ, {}, clear=True)
    @mock.patch('benchmarks.build_minivim_kernel.shutil.which')
    def test_default_to_4(self, mock_which):
        """Test defaults to 4 when no method works."""
        mock_which.return_value = None

        result = get_jobs()

        self.assertEqual(result, 4)


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

    def test_with_cwd(self):
        """Test command with working directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            rc, stdout, stderr = run_command(
                ["pwd"],
                cwd=Path(tmpdir),
                capture=True
            )
            self.assertEqual(rc, 0)


class TestDownloadKernel(TestCase):
    """Tests for download_kernel function."""

    @mock.patch('benchmarks.build_minivim_kernel.run_command')
    def test_skips_existing_tarball(self, mock_run):
        """Test skips download when tarball exists."""
        from benchmarks.build_minivim_kernel import download_kernel

        with tempfile.TemporaryDirectory() as tmpdir:
            build_root = Path(tmpdir)
            src_dir = build_root / "linux-6.12.10"
            src_dir.mkdir()

            # Create existing tarball
            tarball = build_root / "linux-6.12.10.tar.xz"
            tarball.write_text("existing")

            config = BuildConfig(
                build_root=build_root,
                src_dir=src_dir
            )

            result = download_kernel(config)

            self.assertTrue(result)
            # curl should not be called
            mock_run.assert_not_called()


class TestSaveCpuInfo(TestCase):
    """Tests for save_cpu_info function."""

    @mock.patch('benchmarks.build_minivim_kernel.shutil.which')
    @mock.patch('benchmarks.build_minivim_kernel.run_command')
    def test_saves_lscpu_output(self, mock_run, mock_which):
        """Test saves lscpu output."""
        from benchmarks.build_minivim_kernel import save_cpu_info

        mock_which.return_value = "/usr/bin/lscpu"
        mock_run.return_value = (0, "cpu info output", "")

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="x86_64",
                build_root=Path(tmpdir)
            )

            save_cpu_info(config)

            cpu_file = Path(tmpdir) / "cpuinfo-x86_64.txt"
            self.assertTrue(cpu_file.exists())
            self.assertEqual(cpu_file.read_text(), "cpu info output")


class TestBuildKernel(TestCase):
    """Tests for build_kernel function."""

    @mock.patch('benchmarks.build_minivim_kernel.run_command')
    @mock.patch('benchmarks.build_minivim_kernel.get_make_bin')
    def test_x86_64_build_args(self, mock_make_bin, mock_run):
        """Test x86_64 build uses correct args."""
        from benchmarks.build_minivim_kernel import build_kernel

        mock_make_bin.return_value = "make"
        mock_run.return_value = (0, "", "")

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="x86_64",
                src_dir=Path(tmpdir),
                jobs=4
            )

            result = build_kernel(config)

            self.assertTrue(result)
            call_args = mock_run.call_args[0][0]
            self.assertIn("ARCH=x86_64", call_args)
            self.assertIn("bzImage", call_args)

    @mock.patch('benchmarks.build_minivim_kernel.run_command')
    @mock.patch('benchmarks.build_minivim_kernel.get_make_bin')
    def test_arm64_build_args(self, mock_make_bin, mock_run):
        """Test arm64 build uses correct args."""
        from benchmarks.build_minivim_kernel import build_kernel

        mock_make_bin.return_value = "make"
        mock_run.return_value = (0, "", "")

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="arm64",
                src_dir=Path(tmpdir),
                jobs=4
            )

            result = build_kernel(config)

            self.assertTrue(result)
            call_args = mock_run.call_args[0][0]
            self.assertIn("ARCH=arm64", call_args)
            self.assertIn("Image", call_args)

    @mock.patch('benchmarks.build_minivim_kernel.run_command')
    @mock.patch('benchmarks.build_minivim_kernel.get_make_bin')
    def test_armv7_uses_cross_compile(self, mock_make_bin, mock_run):
        """Test armv7 build uses cross compiler."""
        from benchmarks.build_minivim_kernel import build_kernel

        mock_make_bin.return_value = "make"
        mock_run.return_value = (0, "", "")

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="armv7",
                src_dir=Path(tmpdir),
                jobs=4
            )

            result = build_kernel(config)

            self.assertTrue(result)
            call_args = mock_run.call_args[0][0]
            self.assertIn("ARCH=arm", call_args)
            self.assertIn("CROSS_COMPILE=arm-linux-gnueabihf-", call_args)
            self.assertIn("zImage", call_args)


class TestCopyArtifacts(TestCase):
    """Tests for copy_artifacts function."""

    def test_copies_x86_64_bzimage(self):
        """Test copies bzImage for x86_64."""
        from benchmarks.build_minivim_kernel import copy_artifacts

        with tempfile.TemporaryDirectory() as tmpdir:
            src_dir = Path(tmpdir) / "src"
            build_root = Path(tmpdir) / "build"
            build_root.mkdir()

            # Create source image
            bzimage_dir = src_dir / "arch" / "x86" / "boot"
            bzimage_dir.mkdir(parents=True)
            (bzimage_dir / "bzImage").write_text("kernel")

            config = BuildConfig(
                arch="x86_64",
                kernel_version="6.12.10",
                src_dir=src_dir,
                build_root=build_root
            )

            result = copy_artifacts(config)

            self.assertTrue(result)
            output = build_root / "bzImage-x86_64-6.12.10"
            self.assertTrue(output.exists())

    def test_returns_false_when_image_missing(self):
        """Test returns False when kernel image is missing."""
        from benchmarks.build_minivim_kernel import copy_artifacts

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="x86_64",
                src_dir=Path(tmpdir),
                build_root=Path(tmpdir)
            )

            result = copy_artifacts(config)

            self.assertFalse(result)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('benchmarks.build_minivim_kernel.copy_artifacts')
    @mock.patch('benchmarks.build_minivim_kernel.build_kernel')
    @mock.patch('benchmarks.build_minivim_kernel.configure_kernel')
    @mock.patch('benchmarks.build_minivim_kernel.save_cpu_info')
    @mock.patch('benchmarks.build_minivim_kernel.download_kernel')
    def test_main_success(
        self,
        mock_download,
        mock_cpu,
        mock_configure,
        mock_build,
        mock_copy
    ):
        """Test successful main execution."""
        from benchmarks.build_minivim_kernel import build, BuildConfig

        mock_download.return_value = True
        mock_configure.return_value = True
        mock_build.return_value = True
        mock_copy.return_value = True

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="x86_64",
                build_root=Path(tmpdir),
                src_dir=Path(tmpdir) / "linux-6.12.10",
                config_dir=Path(tmpdir) / "configs"
            )

            result = build(config)

            self.assertEqual(result, 0)

    @mock.patch('benchmarks.build_minivim_kernel.download_kernel')
    def test_main_download_failure(self, mock_download):
        """Test main fails on download failure."""
        from benchmarks.build_minivim_kernel import build, BuildConfig

        mock_download.return_value = False

        with tempfile.TemporaryDirectory() as tmpdir:
            config = BuildConfig(
                arch="x86_64",
                build_root=Path(tmpdir)
            )

            result = build(config)

            self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
