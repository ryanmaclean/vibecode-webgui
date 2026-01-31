#!/usr/bin/env python3
"""Tests for test_vm_performance module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts/vfkit directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "vfkit"))

from test_vm_performance import (
    BootResult,
    TestConfig,
    compare_results,
    measure_boot_time,
)


class TestBootResult(TestCase):
    """Tests for BootResult dataclass."""

    def test_create_boot_result(self):
        """Test creating a BootResult."""
        result = BootResult(vm_name="test", boot_time=5.5, success=True)
        self.assertEqual(result.vm_name, "test")
        self.assertEqual(result.boot_time, 5.5)
        self.assertTrue(result.success)

    def test_failed_boot_result(self):
        """Test creating a failed BootResult."""
        result = BootResult(vm_name="failed", boot_time=999.0, success=False)
        self.assertFalse(result.success)
        self.assertEqual(result.boot_time, 999.0)


class TestTestConfig(TestCase):
    """Tests for TestConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = TestConfig()
        self.assertEqual(config.boot_timeout, 60)
        self.assertEqual(config.ready_marker, "System ready")
        self.assertTrue(str(config.vfkit_base).endswith(".vfkit/vms"))

    def test_custom_timeout(self):
        """Test custom timeout value."""
        config = TestConfig(boot_timeout=120)
        self.assertEqual(config.boot_timeout, 120)


class TestMeasureBootTime(TestCase):
    """Tests for measure_boot_time function."""

    def test_missing_vm_directory(self):
        """Test with non-existent VM directory."""
        config = TestConfig()
        result = measure_boot_time(
            "test-vm",
            Path("/nonexistent/vm/path"),
            "launch.sh",
            config
        )
        self.assertFalse(result.success)
        self.assertEqual(result.boot_time, 999.0)

    def test_missing_launch_script(self):
        """Test with missing launch script."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = TestConfig()
            result = measure_boot_time(
                "test-vm",
                Path(tmpdir),
                "launch.sh",
                config
            )
            self.assertFalse(result.success)
            self.assertEqual(result.boot_time, 999.0)

    def test_boot_timeout(self):
        """Test boot timeout detection."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            # Create a launch script that does nothing
            launch = tmp_path / "launch.sh"
            launch.write_text("#!/bin/bash\nsleep 1\n")
            launch.chmod(0o755)

            # Create logs directory
            (tmp_path / "logs").mkdir()

            config = TestConfig(boot_timeout=2)
            result = measure_boot_time(
                "test-vm",
                tmp_path,
                "launch.sh",
                config
            )
            # Should fail due to timeout (no "System ready" in log)
            self.assertFalse(result.success)


class TestCompareResults(TestCase):
    """Tests for compare_results function."""

    def test_optimized_faster(self):
        """Test comparison when optimized is faster."""
        non_opt = BootResult(vm_name="non-optimized", boot_time=10.0, success=True)
        opt = BootResult(vm_name="optimized", boot_time=5.0, success=True)

        # Should not raise any exceptions
        compare_results(non_opt, opt)

    def test_non_optimized_faster(self):
        """Test comparison when non-optimized is faster."""
        non_opt = BootResult(vm_name="non-optimized", boot_time=5.0, success=True)
        opt = BootResult(vm_name="optimized", boot_time=10.0, success=True)

        # Should not raise any exceptions
        compare_results(non_opt, opt)

    def test_equal_times(self):
        """Test comparison when times are equal."""
        non_opt = BootResult(vm_name="non-optimized", boot_time=5.0, success=True)
        opt = BootResult(vm_name="optimized", boot_time=5.0, success=True)

        # Should not raise any exceptions
        compare_results(non_opt, opt)

    def test_failed_boot(self):
        """Test comparison when a boot failed."""
        non_opt = BootResult(vm_name="non-optimized", boot_time=5.0, success=True)
        opt = BootResult(vm_name="optimized", boot_time=999.0, success=False)

        # Should not raise any exceptions
        compare_results(non_opt, opt)


if __name__ == '__main__':
    import unittest
    unittest.main()
