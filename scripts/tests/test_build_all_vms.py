#!/usr/bin/env python3
"""Tests for build_all_vms module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from build_all_vms import (
    BuildStatus,
    VMBuild,
    command_exists,
    get_default_vms,
    run_script,
)


class TestBuildStatus(TestCase):
    """Tests for BuildStatus enum."""

    def test_status_values(self):
        """Test status enum values."""
        self.assertEqual(BuildStatus.SUCCESS.value, "SUCCESS")
        self.assertEqual(BuildStatus.FAILED.value, "FAILED")
        self.assertEqual(BuildStatus.SKIPPED.value, "SKIPPED")


class TestVMBuild(TestCase):
    """Tests for VMBuild dataclass."""

    def test_create_vm_build(self):
        """Test creating a VM build configuration."""
        vm = VMBuild(name="Test VM", script="test.sh")
        self.assertEqual(vm.name, "Test VM")
        self.assertEqual(vm.script, "test.sh")
        self.assertEqual(vm.status, BuildStatus.SKIPPED)
        self.assertTrue(vm.required)

    def test_optional_vm(self):
        """Test optional VM build."""
        vm = VMBuild(name="Optional", script="opt.sh", required=False)
        self.assertFalse(vm.required)

    def test_status_update(self):
        """Test updating VM status."""
        vm = VMBuild(name="Test", script="test.sh")
        vm.status = BuildStatus.SUCCESS
        self.assertEqual(vm.status, BuildStatus.SUCCESS)


class TestCommandExists(TestCase):
    """Tests for command_exists function."""

    def test_existing_command(self):
        """Test existing command."""
        self.assertTrue(command_exists("python3") or command_exists("python"))

    def test_nonexistent_command(self):
        """Test non-existent command."""
        self.assertFalse(command_exists("nonexistent_command_12345"))


class TestRunScript(TestCase):
    """Tests for run_script function."""

    def test_dry_run_mode(self):
        """Test dry run mode."""
        result = run_script(Path("/nonexistent/script.sh"), dry_run=True)
        self.assertTrue(result)

    def test_nonexistent_script(self):
        """Test running non-existent script."""
        result = run_script(Path("/nonexistent/script.sh"), dry_run=False)
        self.assertFalse(result)

    def test_successful_script(self):
        """Test running successful script."""
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.sh', delete=False
        ) as f:
            f.write("#!/bin/bash\nexit 0\n")
            script_path = Path(f.name)

        script_path.chmod(0o755)
        result = run_script(script_path, dry_run=False)
        self.assertTrue(result)
        script_path.unlink()

    def test_failing_script(self):
        """Test running failing script."""
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.sh', delete=False
        ) as f:
            f.write("#!/bin/bash\nexit 1\n")
            script_path = Path(f.name)

        script_path.chmod(0o755)
        result = run_script(script_path, dry_run=False)
        self.assertFalse(result)
        script_path.unlink()


class TestGetDefaultVms(TestCase):
    """Tests for get_default_vms function."""

    def test_returns_list(self):
        """Test that function returns a list."""
        vms = get_default_vms()
        self.assertIsInstance(vms, list)

    def test_has_vms(self):
        """Test that list has VMs."""
        vms = get_default_vms()
        self.assertGreater(len(vms), 0)

    def test_vm_names(self):
        """Test VM names are present."""
        vms = get_default_vms()
        names = [vm.name for vm in vms]
        self.assertIn("Valkey", names)
        self.assertIn("PostgreSQL", names)

    def test_vms_have_scripts(self):
        """Test all VMs have scripts defined."""
        vms = get_default_vms()
        for vm in vms:
            self.assertTrue(vm.script.endswith('.sh'))


if __name__ == '__main__':
    import unittest
    unittest.main()
