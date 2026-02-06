#!/usr/bin/env python3
"""Tests for launch_vibecode_vm module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "vfkit"))

from vfkit.launch_vibecode_vm import (
    VMConfig,
    build_vfkit_command,
    check_vfkit_installed,
    create_disk_image,
    find_initramfs,
    get_project_dir,
    get_script_dir,
    get_vm_dir,
    prepare_console_log,
    verify_kernel,
    verify_project_dir,
)


class TestVMConfig(TestCase):
    """Tests for VMConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = VMConfig()
        self.assertEqual(config.name, "vibecode-alpine")
        self.assertEqual(config.share_tag, "vibecode")
        self.assertEqual(config.mount_point, "/mnt/vibecode")
        self.assertEqual(config.mac_address, "52:54:00:12:34:56")
        self.assertEqual(config.vsock_port, 1024)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = VMConfig(
            name="custom-vm",
            cpus=8,
            memory=8192,
            disk_size="50G"
        )
        self.assertEqual(config.name, "custom-vm")
        self.assertEqual(config.cpus, 8)
        self.assertEqual(config.memory, 8192)
        self.assertEqual(config.disk_size, "50G")

    @mock.patch.dict(os.environ, {"VFKIT_CPUS": "6", "VFKIT_MEMORY": "2048"})
    def test_env_values(self):
        """Test values from environment variables."""
        config = VMConfig()
        self.assertEqual(config.cpus, 6)
        self.assertEqual(config.memory, 2048)


class TestGetPaths(TestCase):
    """Tests for path helper functions."""

    def test_get_script_dir(self):
        """Test get_script_dir returns Path."""
        result = get_script_dir()
        self.assertIsInstance(result, Path)
        self.assertEqual(result.name, "vfkit")

    def test_get_project_dir(self):
        """Test get_project_dir returns Path."""
        result = get_project_dir()
        self.assertIsInstance(result, Path)

    def test_get_vm_dir(self):
        """Test get_vm_dir returns Path."""
        result = get_vm_dir()
        self.assertIsInstance(result, Path)
        self.assertTrue(str(result).endswith("vibecode-alpine"))


class TestCheckVfkitInstalled(TestCase):
    """Tests for check_vfkit_installed function."""

    @mock.patch('vfkit.launch_vibecode_vm.shutil.which')
    def test_vfkit_found(self, mock_which):
        """Test when vfkit is found."""
        mock_which.return_value = "/usr/local/bin/vfkit"

        result = check_vfkit_installed()

        self.assertEqual(result, "/usr/local/bin/vfkit")

    @mock.patch('vfkit.launch_vibecode_vm.shutil.which')
    def test_vfkit_not_found(self, mock_which):
        """Test when vfkit is not found."""
        mock_which.return_value = None

        result = check_vfkit_installed()

        self.assertIsNone(result)


class TestVerifyKernel(TestCase):
    """Tests for verify_kernel function."""

    def test_kernel_exists(self):
        """Test when kernel exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vm_dir = Path(tmpdir)
            kernel_dir = vm_dir / "kernel"
            kernel_dir.mkdir(parents=True)
            kernel = kernel_dir / "vmlinux"
            kernel.write_text("kernel content")

            result = verify_kernel(vm_dir)

            self.assertEqual(result, kernel)

    def test_kernel_missing(self):
        """Test when kernel is missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vm_dir = Path(tmpdir)

            result = verify_kernel(vm_dir)

            self.assertIsNone(result)


class TestFindInitramfs(TestCase):
    """Tests for find_initramfs function."""

    def test_custom_initramfs(self):
        """Test when custom initramfs exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vm_dir = Path(tmpdir)
            rootfs_dir = vm_dir / "rootfs"
            rootfs_dir.mkdir(parents=True)
            custom = rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"
            custom.write_text("custom rootfs")

            result = find_initramfs(vm_dir)

            self.assertEqual(result, custom)

    def test_kernel_initramfs(self):
        """Test when only kernel initramfs exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vm_dir = Path(tmpdir)
            kernel_dir = vm_dir / "kernel"
            kernel_dir.mkdir(parents=True)
            initramfs = kernel_dir / "initramfs"
            initramfs.write_text("alpine initramfs")

            result = find_initramfs(vm_dir)

            self.assertEqual(result, initramfs)

    def test_prefers_custom_over_kernel(self):
        """Test custom initramfs is preferred."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vm_dir = Path(tmpdir)

            # Create both
            rootfs_dir = vm_dir / "rootfs"
            rootfs_dir.mkdir(parents=True)
            custom = rootfs_dir / "alpine-vibecode-rootfs.cpio.gz"
            custom.write_text("custom")

            kernel_dir = vm_dir / "kernel"
            kernel_dir.mkdir(parents=True)
            (kernel_dir / "initramfs").write_text("kernel")

            result = find_initramfs(vm_dir)

            self.assertEqual(result, custom)

    def test_no_initramfs(self):
        """Test when no initramfs exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            vm_dir = Path(tmpdir)

            result = find_initramfs(vm_dir)

            self.assertIsNone(result)


class TestCreateDiskImage(TestCase):
    """Tests for create_disk_image function."""

    def test_existing_disk(self):
        """Test when disk already exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            disk_path = Path(tmpdir) / "disk" / "root.img"
            disk_path.parent.mkdir(parents=True)
            disk_path.write_text("existing disk")

            result = create_disk_image(disk_path, "20G")

            self.assertTrue(result)

    @mock.patch('vfkit.launch_vibecode_vm.shutil.which')
    @mock.patch('vfkit.launch_vibecode_vm.subprocess.run')
    def test_creates_with_qemu_img(self, mock_run, mock_which):
        """Test disk creation with qemu-img."""
        mock_which.return_value = "/usr/local/bin/qemu-img"
        mock_run.return_value = mock.Mock(returncode=0)

        with tempfile.TemporaryDirectory() as tmpdir:
            disk_path = Path(tmpdir) / "disk" / "root.img"

            result = create_disk_image(disk_path, "20G")

            self.assertTrue(result)
            mock_run.assert_called_once()


class TestPrepareConsoleLog(TestCase):
    """Tests for prepare_console_log function."""

    def test_creates_log_directory(self):
        """Test log directory is created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_dir = Path(tmpdir) / "logs"

            result = prepare_console_log(log_dir)

            self.assertTrue(log_dir.exists())
            self.assertEqual(result, log_dir / "console.log")

    def test_truncates_existing_log(self):
        """Test existing log is truncated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_dir = Path(tmpdir) / "logs"
            log_dir.mkdir(parents=True)
            console_log = log_dir / "console.log"
            console_log.write_text("old log content")

            prepare_console_log(log_dir)

            self.assertEqual(console_log.read_text(), "")


class TestVerifyProjectDir(TestCase):
    """Tests for verify_project_dir function."""

    def test_directory_exists(self):
        """Test when directory exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            config = VMConfig()

            result = verify_project_dir(project_dir, config)

            self.assertTrue(result)

    def test_directory_missing(self):
        """Test when directory is missing."""
        project_dir = Path("/nonexistent/path")
        config = VMConfig()

        result = verify_project_dir(project_dir, config)

        self.assertFalse(result)


class TestBuildVfkitCommand(TestCase):
    """Tests for build_vfkit_command function."""

    def test_command_structure(self):
        """Test command has correct structure."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            config = VMConfig(cpus=4, memory=4096)

            cmd = build_vfkit_command(
                config=config,
                kernel=tmpdir / "vmlinux",
                initramfs=tmpdir / "initramfs",
                disk_image=tmpdir / "root.img",
                console_log=tmpdir / "console.log",
                project_dir=tmpdir / "project",
                vm_dir=tmpdir / "vm"
            )

            self.assertEqual(cmd[0], "vfkit")
            self.assertIn("--cpus", cmd)
            self.assertIn("4", cmd)
            self.assertIn("--memory", cmd)
            self.assertIn("4096", cmd)

    def test_includes_all_devices(self):
        """Test command includes all device types."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            config = VMConfig()

            cmd = build_vfkit_command(
                config=config,
                kernel=tmpdir / "vmlinux",
                initramfs=tmpdir / "initramfs",
                disk_image=tmpdir / "root.img",
                console_log=tmpdir / "console.log",
                project_dir=tmpdir / "project",
                vm_dir=tmpdir / "vm"
            )

            cmd_str = " ".join(cmd)
            self.assertIn("virtio-blk", cmd_str)
            self.assertIn("virtio-net", cmd_str)
            self.assertIn("virtio-fs", cmd_str)
            self.assertIn("virtio-serial", cmd_str)
            self.assertIn("virtio-rng", cmd_str)
            self.assertIn("virtio-vsock", cmd_str)

    def test_includes_share_tag(self):
        """Test command includes share tag."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            config = VMConfig(share_tag="myshare")

            cmd = build_vfkit_command(
                config=config,
                kernel=tmpdir / "vmlinux",
                initramfs=tmpdir / "initramfs",
                disk_image=tmpdir / "root.img",
                console_log=tmpdir / "console.log",
                project_dir=tmpdir / "project",
                vm_dir=tmpdir / "vm"
            )

            cmd_str = " ".join(cmd)
            self.assertIn("mountTag=myshare", cmd_str)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('vfkit.launch_vibecode_vm.check_vfkit_installed')
    def test_fails_without_vfkit(self, mock_check):
        """Test fails when vfkit is not installed."""
        from vfkit.launch_vibecode_vm import main

        mock_check.return_value = None

        result = main()

        self.assertEqual(result, 1)

    @mock.patch('vfkit.launch_vibecode_vm.subprocess.run')
    @mock.patch('vfkit.launch_vibecode_vm.verify_project_dir')
    @mock.patch('vfkit.launch_vibecode_vm.create_disk_image')
    @mock.patch('vfkit.launch_vibecode_vm.find_initramfs')
    @mock.patch('vfkit.launch_vibecode_vm.verify_kernel')
    @mock.patch('vfkit.launch_vibecode_vm.check_vfkit_installed')
    def test_dry_run(
        self,
        mock_vfkit,
        mock_kernel,
        mock_initramfs,
        mock_disk,
        mock_project,
        mock_run
    ):
        """Test dry run mode."""
        from vfkit.launch_vibecode_vm import main

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            mock_vfkit.return_value = "/usr/local/bin/vfkit"
            mock_kernel.return_value = tmpdir / "vmlinux"
            mock_initramfs.return_value = tmpdir / "initramfs"
            mock_disk.return_value = True
            mock_project.return_value = True

            result = main(dry_run=True)

            self.assertEqual(result, 0)
            mock_run.assert_not_called()


if __name__ == '__main__':
    import unittest
    unittest.main()
