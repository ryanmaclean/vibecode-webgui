#!/usr/bin/env python3
"""Tests for m_series_performance_test module."""

import json
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts/benchmarks directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "benchmarks"))

from m_series_performance_test import (
    BenchmarkConfig,
    HardwareInfo,
    TestResult,
    build_results_json,
    run_command,
    validate_targets,
)


class TestHardwareInfo(TestCase):
    """Tests for HardwareInfo dataclass."""

    def test_create_hardware_info(self):
        """Test creating HardwareInfo."""
        hw = HardwareInfo(
            chip="Apple M1",
            cores=8,
            memory_gb=16,
            performance_cores=4,
            efficiency_cores=4
        )
        self.assertEqual(hw.chip, "Apple M1")
        self.assertEqual(hw.cores, 8)
        self.assertEqual(hw.memory_gb, 16)

    def test_default_cores(self):
        """Test default core values."""
        hw = HardwareInfo(chip="Test", cores=4, memory_gb=8)
        self.assertEqual(hw.performance_cores, 0)
        self.assertEqual(hw.efficiency_cores, 0)


class TestTestResult(TestCase):
    """Tests for TestResult dataclass."""

    def test_create_with_ms(self):
        """Test creating result with milliseconds."""
        result = TestResult(name="test", duration_ms=500)
        self.assertEqual(result.name, "test")
        self.assertEqual(result.duration_ms, 500)
        self.assertEqual(result.status, "completed")

    def test_create_with_seconds(self):
        """Test creating result with seconds."""
        result = TestResult(name="test", duration_seconds=60)
        self.assertEqual(result.duration_seconds, 60)

    def test_extra_data(self):
        """Test extra data field."""
        result = TestResult(name="test", extra={"key": "value"})
        self.assertEqual(result.extra["key"], "value")


class TestBenchmarkConfig(TestCase):
    """Tests for BenchmarkConfig dataclass."""

    def test_default_values(self):
        """Test default configuration."""
        config = BenchmarkConfig()
        self.assertTrue(str(config.results_dir).endswith("m-series-benchmarks"))


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"])
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(["nonexistent_command_12345"])
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)

    def test_timeout(self):
        """Test command timeout."""
        rc, stdout, stderr = run_command(["sleep", "10"], timeout=1)
        self.assertEqual(rc, -1)
        self.assertEqual(stderr, "timeout")


class TestBuildResultsJson(TestCase):
    """Tests for build_results_json function."""

    def test_build_json_structure(self):
        """Test JSON structure."""
        hw = HardwareInfo(chip="Apple M1", cores=8, memory_gb=16)
        results = [
            TestResult(name="test1", duration_ms=100),
            TestResult(name="test2", duration_seconds=5)
        ]

        data = build_results_json(hw, results, "20240101_120000")

        self.assertIn("benchmark_id", data)
        self.assertIn("timestamp", data)
        self.assertIn("hardware", data)
        self.assertIn("tests", data)
        self.assertEqual(len(data["tests"]), 2)

    def test_hardware_in_json(self):
        """Test hardware info in JSON."""
        hw = HardwareInfo(
            chip="Apple M2",
            cores=10,
            memory_gb=24,
            performance_cores=6,
            efficiency_cores=4
        )
        results = []

        data = build_results_json(hw, results, "20240101_120000")

        self.assertEqual(data["hardware"]["chip"], "Apple M2")
        self.assertEqual(data["hardware"]["cores"], 10)
        self.assertEqual(data["hardware"]["memory_gb"], 24)


class TestValidateTargets(TestCase):
    """Tests for validate_targets function."""

    def test_fast_vm_boot(self):
        """Test validation with fast VM boot."""
        results = [TestResult(name="apple_virtualization_boot", duration_ms=3000)]
        hw = HardwareInfo(chip="Apple M1", cores=8, memory_gb=16)

        # Should not raise
        validate_targets(results, hw)

    def test_slow_vm_boot(self):
        """Test validation with slow VM boot."""
        results = [TestResult(name="apple_virtualization_boot", duration_ms=8000)]
        hw = HardwareInfo(chip="Apple M1", cores=8, memory_gb=16)

        # Should not raise
        validate_targets(results, hw)

    def test_fast_kernel_build(self):
        """Test validation with fast kernel build."""
        results = [TestResult(name="kernel_build_arm64", duration_seconds=300)]
        hw = HardwareInfo(chip="Apple M1", cores=8, memory_gb=16)

        # Should not raise
        validate_targets(results, hw)


if __name__ == '__main__':
    import unittest
    unittest.main()
