#!/usr/bin/env python3
"""Tests for configure_lx_zone module."""

import os
import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "openindiana"))

from openindiana.configure_lx_zone import (
    ZoneConfig,
    check_root,
    generate_network_config,
    generate_zone_config,
    log_error,
    log_info,
    log_warn,
    run_command,
)


class TestZoneConfig(TestCase):
    """Tests for ZoneConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = ZoneConfig()
        self.assertEqual(config.name, "vibecode-zone")
        self.assertEqual(config.vnic, "vibecode0")
        self.assertEqual(config.cpus, 4)
        self.assertEqual(config.memory, "8G")
        self.assertEqual(config.swap, "10G")
        self.assertEqual(config.resolvers, "8.8.8.8,8.8.4.4")
        self.assertEqual(config.dns_domain, "local")

    def test_custom_values(self):
        """Test custom configuration values."""
        config = ZoneConfig(
            name="custom-zone",
            cpus=8,
            memory="16G"
        )
        self.assertEqual(config.name, "custom-zone")
        self.assertEqual(config.cpus, 8)
        self.assertEqual(config.memory, "16G")

    def test_zone_path_property(self):
        """Test zone_path property."""
        config = ZoneConfig(name="test-zone")
        self.assertEqual(config.zone_path, "/zones/test-zone")

    def test_zfs_base_property(self):
        """Test zfs_base property."""
        config = ZoneConfig(name="test-zone")
        self.assertEqual(config.zfs_base, "rpool/zones/test-zone")

    def test_debian_image_url(self):
        """Test Debian image URL is set."""
        config = ZoneConfig()
        self.assertIn("debian-11", config.debian_image_url)
        self.assertIn("manta.mnx.io", config.debian_image_url)


class TestLogFunctions(TestCase):
    """Tests for logging functions."""

    @mock.patch('builtins.print')
    def test_log_info(self, mock_print):
        """Test log_info outputs correctly."""
        log_info("Test message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[INFO]", call_args)
        self.assertIn("Test message", call_args)

    @mock.patch('builtins.print')
    def test_log_warn(self, mock_print):
        """Test log_warn outputs correctly."""
        log_warn("Warning message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[WARN]", call_args)

    @mock.patch('builtins.print')
    def test_log_error(self, mock_print):
        """Test log_error outputs correctly."""
        log_error("Error message")
        mock_print.assert_called_once()
        call_args = mock_print.call_args[0][0]
        self.assertIn("[ERROR]", call_args)


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

    def test_with_input(self):
        """Test command with input."""
        rc, stdout, stderr = run_command(
            ["cat"],
            input_text="test input"
        )
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "test input")


class TestCheckRoot(TestCase):
    """Tests for check_root function."""

    @mock.patch('openindiana.configure_lx_zone.os.geteuid')
    def test_is_root(self, mock_geteuid):
        """Test when running as root."""
        mock_geteuid.return_value = 0
        result = check_root()
        self.assertTrue(result)

    @mock.patch('openindiana.configure_lx_zone.os.geteuid')
    def test_not_root(self, mock_geteuid):
        """Test when not running as root."""
        mock_geteuid.return_value = 1000
        result = check_root()
        self.assertFalse(result)


class TestGenerateZoneConfig(TestCase):
    """Tests for generate_zone_config function."""

    def test_generates_config(self):
        """Test zone config is generated."""
        config = ZoneConfig(
            name="test-zone",
            cpus=4,
            memory="8G",
            swap="10G"
        )

        result = generate_zone_config(config)

        self.assertIn("create -t lx", result)
        self.assertIn("zonepath=/zones/test-zone", result)
        self.assertIn("autoboot=true", result)
        self.assertIn("ip-type=exclusive", result)

    def test_includes_network(self):
        """Test config includes network settings."""
        config = ZoneConfig(vnic="test0")

        result = generate_zone_config(config)

        self.assertIn("add net", result)
        self.assertIn("physical=test0", result)

    def test_includes_resolvers(self):
        """Test config includes DNS resolvers."""
        config = ZoneConfig(resolvers="1.1.1.1,1.0.0.1")

        result = generate_zone_config(config)

        self.assertIn("name=resolvers", result)
        self.assertIn("value=1.1.1.1,1.0.0.1", result)

    def test_includes_resource_limits(self):
        """Test config includes resource limits."""
        config = ZoneConfig(cpus=8, memory="16G", swap="20G")

        result = generate_zone_config(config)

        self.assertIn("add capped-cpu", result)
        self.assertIn("ncpus=8", result)
        self.assertIn("add capped-memory", result)
        self.assertIn("physical=16G", result)
        self.assertIn("swap=20G", result)


class TestGenerateNetworkConfig(TestCase):
    """Tests for generate_network_config function."""

    def test_generates_script(self):
        """Test network config script is generated."""
        result = generate_network_config()

        self.assertIn("/etc/network/interfaces", result)
        self.assertIn("iface lo inet loopback", result)
        self.assertIn("iface net0 inet dhcp", result)

    def test_includes_restart(self):
        """Test script includes restart command."""
        result = generate_network_config()
        self.assertIn("systemctl restart networking", result)

    def test_includes_apt_update(self):
        """Test script includes apt update."""
        result = generate_network_config()
        self.assertIn("apt update", result)


class TestDetectNetwork(TestCase):
    """Tests for detect_network function."""

    @mock.patch('openindiana.configure_lx_zone.run_command')
    def test_detects_nic(self, mock_run):
        """Test detecting primary NIC."""
        from openindiana.configure_lx_zone import detect_network

        mock_run.return_value = (0, "e1000g0\nlo0\n", "")

        result = detect_network()

        self.assertEqual(result, "e1000g0")

    @mock.patch('openindiana.configure_lx_zone.run_command')
    def test_no_nic_found(self, mock_run):
        """Test when no NIC found."""
        from openindiana.configure_lx_zone import detect_network

        mock_run.return_value = (0, "", "")

        result = detect_network()

        self.assertIsNone(result)


class TestCreateVnic(TestCase):
    """Tests for create_vnic function."""

    @mock.patch('openindiana.configure_lx_zone.run_command')
    def test_creates_vnic(self, mock_run):
        """Test VNIC creation."""
        from openindiana.configure_lx_zone import create_vnic

        mock_run.return_value = (0, "", "")
        config = ZoneConfig(vnic="test0")

        result = create_vnic(config, "e1000g0")

        self.assertTrue(result)

    @mock.patch('openindiana.configure_lx_zone.run_command')
    def test_removes_existing_vnic(self, mock_run):
        """Test existing VNIC is removed."""
        from openindiana.configure_lx_zone import create_vnic

        # First call (check exists) returns success
        # Rest return success
        mock_run.return_value = (0, "", "")
        config = ZoneConfig(vnic="test0")

        create_vnic(config, "e1000g0")

        # Check delete-vnic was called
        calls = [call[0][0] for call in mock_run.call_args_list]
        delete_calls = [c for c in calls if "delete-vnic" in c]
        self.assertTrue(len(delete_calls) > 0)


class TestInstallLxBrand(TestCase):
    """Tests for install_lx_brand function."""

    @mock.patch('openindiana.configure_lx_zone.run_command')
    def test_already_installed(self, mock_run):
        """Test when lx brand is already installed."""
        from openindiana.configure_lx_zone import install_lx_brand

        mock_run.return_value = (0, "", "")

        result = install_lx_brand()

        self.assertTrue(result)

    @mock.patch('openindiana.configure_lx_zone.run_command')
    def test_installs_package(self, mock_run):
        """Test package installation."""
        from openindiana.configure_lx_zone import install_lx_brand

        # First call (check) fails, second (install) succeeds, third (verify) succeeds
        mock_run.side_effect = [
            (1, "", ""),  # pkg list fails
            (0, "", ""),  # pkg install succeeds
            (0, "", ""),  # pkg list succeeds
        ]

        result = install_lx_brand()

        self.assertTrue(result)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('openindiana.configure_lx_zone.print_completion_message')
    @mock.patch('openindiana.configure_lx_zone.show_zone_info')
    @mock.patch('openindiana.configure_lx_zone.create_snapshot')
    @mock.patch('openindiana.configure_lx_zone.configure_zone_network')
    @mock.patch('openindiana.configure_lx_zone.boot_zone')
    @mock.patch('openindiana.configure_lx_zone.install_zone')
    @mock.patch('openindiana.configure_lx_zone.create_zone_config')
    @mock.patch('openindiana.configure_lx_zone.create_zfs_datasets')
    @mock.patch('openindiana.configure_lx_zone.create_vnic')
    @mock.patch('openindiana.configure_lx_zone.detect_network')
    @mock.patch('openindiana.configure_lx_zone.download_debian_image')
    @mock.patch('openindiana.configure_lx_zone.install_lx_brand')
    @mock.patch('openindiana.configure_lx_zone.update_system')
    def test_main_success(
        self,
        mock_update,
        mock_install,
        mock_download,
        mock_detect,
        mock_vnic,
        mock_zfs,
        mock_zone_cfg,
        mock_install_zone,
        mock_boot,
        mock_network,
        mock_snapshot,
        mock_info,
        mock_complete
    ):
        """Test successful main execution."""
        from openindiana.configure_lx_zone import main

        mock_update.return_value = True
        mock_install.return_value = True
        mock_download.return_value = True
        mock_detect.return_value = "e1000g0"
        mock_vnic.return_value = True
        mock_zfs.return_value = True
        mock_zone_cfg.return_value = True
        mock_install_zone.return_value = True
        mock_boot.return_value = True
        mock_network.return_value = True
        mock_snapshot.return_value = True

        result = main(skip_checks=True, skip_update=True)

        self.assertEqual(result, 0)

    @mock.patch('openindiana.configure_lx_zone.check_root')
    def test_main_not_root(self, mock_root):
        """Test main fails when not root."""
        from openindiana.configure_lx_zone import main

        mock_root.return_value = False

        result = main()

        self.assertEqual(result, 1)

    @mock.patch('openindiana.configure_lx_zone.detect_network')
    @mock.patch('openindiana.configure_lx_zone.download_debian_image')
    @mock.patch('openindiana.configure_lx_zone.install_lx_brand')
    def test_main_no_network(
        self,
        mock_install,
        mock_download,
        mock_detect
    ):
        """Test main fails when no network found."""
        from openindiana.configure_lx_zone import main

        mock_install.return_value = True
        mock_download.return_value = True
        mock_detect.return_value = None

        result = main(skip_checks=True, skip_update=True)

        self.assertEqual(result, 1)


if __name__ == '__main__':
    import unittest
    unittest.main()
