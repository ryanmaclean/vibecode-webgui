#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for openvscode_benchmark module."""

import json
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts/benchmarks directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "benchmarks"))

from openvscode_benchmark import (
    BenchmarkConfig,
    BenchmarkResults,
    build_results_json,
    calculate_statistics,
    run_command,
)


class TestBenchmarkConfig(TestCase):
    """Tests for BenchmarkConfig dataclass."""

    def test_default_values(self):
        """Test default configuration."""
        config = BenchmarkConfig()
        self.assertEqual(config.version, "latest")
        self.assertEqual(config.num_runs, 5)
        self.assertTrue(config.build_image)

    def test_custom_values(self):
        """Test custom configuration."""
        config = BenchmarkConfig(
            arch="arm64",
            version="1.85.0",
            num_runs=10,
            build_image=False
        )
        self.assertEqual(config.arch, "arm64")
        self.assertEqual(config.version, "1.85.0")
        self.assertEqual(config.num_runs, 10)
        self.assertFalse(config.build_image)


class TestBenchmarkResults(TestCase):
    """Tests for BenchmarkResults dataclass."""

    def test_default_values(self):
        """Test default results."""
        results = BenchmarkResults()
        self.assertEqual(results.boot_times, [])
        self.assertEqual(results.memory_usages, [])
        self.assertIsNone(results.build_duration)

    def test_add_results(self):
        """Test adding results."""
        results = BenchmarkResults()
        results.boot_times.append(1000)
        results.boot_times.append(1100)
        results.memory_usages.append(400)

        self.assertEqual(len(results.boot_times), 2)
        self.assertEqual(len(results.memory_usages), 1)


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "test"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "test")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"])
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(["nonexistent_12345"])
        self.assertEqual(rc, -1)


class TestCalculateStatistics(TestCase):
    """Tests for calculate_statistics function."""

    def test_simple_statistics(self):
        """Test calculating simple statistics."""
        values = [100, 200, 300]
        stats = calculate_statistics(values)

        self.assertEqual(stats["avg"], 200.0)
        self.assertEqual(stats["min"], 100)
        self.assertEqual(stats["max"], 300)

    def test_single_value(self):
        """Test with single value."""
        values = [500]
        stats = calculate_statistics(values)

        self.assertEqual(stats["avg"], 500.0)
        self.assertEqual(stats["min"], 500)
        self.assertEqual(stats["max"], 500)

    def test_decimal_average(self):
        """Test decimal average."""
        values = [100, 101, 102]
        stats = calculate_statistics(values)

        self.assertEqual(stats["avg"], 101.0)


class TestBuildResultsJson(TestCase):
    """Tests for build_results_json function."""

    def test_basic_structure(self):
        """Test basic JSON structure."""
        config = BenchmarkConfig(arch="arm64", version="1.85.0", num_runs=3)
        results = BenchmarkResults(
            boot_times=[1000, 1100, 900],
            memory_usages=[400, 450, 420]
        )
        boot_stats = {"avg": 1000.0, "min": 900, "max": 1100}
        mem_stats = {"avg": 423.33, "min": 400, "max": 450}

        data = build_results_json(config, results, boot_stats, mem_stats, "20240101_120000")

        self.assertIn("benchmark_id", data)
        self.assertIn("timestamp", data)
        self.assertIn("configuration", data)
        self.assertIn("boot_times", data)
        self.assertIn("memory_usage", data)
        self.assertIn("summary", data)

    def test_configuration_in_json(self):
        """Test configuration in JSON."""
        config = BenchmarkConfig(arch="x86_64", version="1.84.0", num_runs=5)
        results = BenchmarkResults(boot_times=[1000], memory_usages=[400])
        boot_stats = {"avg": 1000.0, "min": 1000, "max": 1000}
        mem_stats = {"avg": 400.0, "min": 400, "max": 400}

        data = build_results_json(config, results, boot_stats, mem_stats, "20240101_120000")

        self.assertEqual(data["configuration"]["arch"], "x86_64")
        self.assertEqual(data["configuration"]["version"], "1.84.0")
        self.assertEqual(data["configuration"]["num_runs"], 5)

    def test_summary_targets(self):
        """Test summary target flags."""
        config = BenchmarkConfig()
        results = BenchmarkResults(boot_times=[5000], memory_usages=[300])
        boot_stats = {"avg": 5000.0, "min": 5000, "max": 5000}
        mem_stats = {"avg": 300.0, "min": 300, "max": 300}

        data = build_results_json(config, results, boot_stats, mem_stats, "20240101_120000")

        self.assertTrue(data["summary"]["boot_under_10s"])
        self.assertTrue(data["summary"]["memory_under_512mb"])

    def test_failed_targets(self):
        """Test failed target flags."""
        config = BenchmarkConfig()
        results = BenchmarkResults(boot_times=[15000], memory_usages=[600])
        boot_stats = {"avg": 15000.0, "min": 15000, "max": 15000}
        mem_stats = {"avg": 600.0, "min": 600, "max": 600}

        data = build_results_json(config, results, boot_stats, mem_stats, "20240101_120000")

        self.assertFalse(data["summary"]["boot_under_10s"])
        self.assertFalse(data["summary"]["memory_under_512mb"])

    def test_with_build_duration(self):
        """Test with build duration."""
        config = BenchmarkConfig()
        results = BenchmarkResults(
            boot_times=[1000],
            memory_usages=[400],
            build_duration=120
        )
        boot_stats = {"avg": 1000.0, "min": 1000, "max": 1000}
        mem_stats = {"avg": 400.0, "min": 400, "max": 400}

        data = build_results_json(config, results, boot_stats, mem_stats, "20240101_120000")

        self.assertIn("build_info", data)
        self.assertEqual(data["build_info"]["duration_seconds"], 120)
        self.assertEqual(data["build_info"]["arch"], "arm64")


if __name__ == '__main__':
    import unittest
    unittest.main()