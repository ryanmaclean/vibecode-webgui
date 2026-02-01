#!/usr/bin/env python3
"""Tests for benchmark script modules."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestAlpineChromiumBench(TestCase):
    """Tests for alpine_chromium_bench module."""

    def test_import(self):
        """Test module imports."""
        from alpine_chromium_bench import (
            BenchmarkConfig,
            BenchmarkResults,
            command_exists,
            calculate_percentile,
        )
        self.assertTrue(callable(command_exists))
        self.assertTrue(callable(calculate_percentile))

    def test_benchmark_config_defaults(self):
        """Test default configuration."""
        from alpine_chromium_bench import BenchmarkConfig
        config = BenchmarkConfig()
        self.assertEqual(config.iterations, 3)
        self.assertEqual(config.docker_image, "alpine:3.20")
        self.assertTrue(config.emit_stats)

    def test_benchmark_results_defaults(self):
        """Test default results."""
        from alpine_chromium_bench import BenchmarkResults
        results = BenchmarkResults()
        self.assertEqual(results.durations_ms, [])
        self.assertEqual(results.min_ms, 0)
        self.assertEqual(results.max_ms, 0)

    def test_calculate_percentile(self):
        """Test percentile calculation."""
        from alpine_chromium_bench import calculate_percentile
        data = [10, 20, 30, 40, 50]
        self.assertEqual(calculate_percentile(data, 0.5), 30)
        self.assertEqual(calculate_percentile([], 0.5), 0)


class TestApplevfFastbootBench(TestCase):
    """Tests for applevf_fastboot_bench module."""

    def test_import(self):
        """Test module imports."""
        from applevf_fastboot_bench import (
            BenchmarkConfig,
            BenchmarkResults,
            ms_now,
        )
        self.assertTrue(callable(ms_now))

    def test_ms_now(self):
        """Test ms_now function."""
        from applevf_fastboot_bench import ms_now
        import time
        before = int(time.time() * 1000)
        result = ms_now()
        after = int(time.time() * 1000)
        self.assertGreaterEqual(result, before)
        self.assertLessEqual(result, after)


class TestBuildBusyboxMusl(TestCase):
    """Tests for build_busybox_musl module."""

    def test_import(self):
        """Test module imports."""
        from build_busybox_musl import (
            BuildConfig,
            run_command,
        )
        self.assertTrue(callable(run_command))

    def test_build_config_defaults(self):
        """Test default configuration."""
        from build_busybox_musl import BuildConfig
        config = BuildConfig()
        self.assertEqual(config.arch, "x86_64")
        self.assertEqual(config.version, "1.36.1")


class TestCompareVscodeBuilds(TestCase):
    """Tests for compare_vscode_builds module."""

    def test_import(self):
        """Test module imports."""
        from compare_vscode_builds import (
            BuildMetrics,
            ComparisonResults,
            calculate_diff_percent,
        )
        self.assertTrue(callable(calculate_diff_percent))

    def test_calculate_diff_percent(self):
        """Test percentage difference calculation."""
        from compare_vscode_builds import calculate_diff_percent
        self.assertEqual(calculate_diff_percent(100, 110), 10.0)
        self.assertEqual(calculate_diff_percent(100, 90), -10.0)
        self.assertEqual(calculate_diff_percent(0, 100), 0.0)

    def test_build_metrics_defaults(self):
        """Test default metrics."""
        from compare_vscode_builds import BuildMetrics
        metrics = BuildMetrics()
        self.assertEqual(metrics.size_mb, 0)
        self.assertEqual(metrics.boot_time_ms, 0)


class TestNoisyNeighborExperiment(TestCase):
    """Tests for noisy_neighbor_experiment module."""

    def test_import(self):
        """Test module imports."""
        from noisy_neighbor_experiment import (
            ExperimentConfig,
            ExperimentResults,
            measure_boot_time,
        )
        self.assertTrue(callable(measure_boot_time))

    def test_experiment_config_defaults(self):
        """Test default configuration."""
        from noisy_neighbor_experiment import ExperimentConfig
        config = ExperimentConfig()
        self.assertEqual(config.num_baseline_runs, 5)
        self.assertEqual(config.num_concurrent_vms, 10)

    def test_experiment_results_defaults(self):
        """Test default results."""
        from noisy_neighbor_experiment import ExperimentResults
        results = ExperimentResults()
        self.assertEqual(results.baseline_runs, [])
        self.assertTrue(results.acceptable)


class TestBuildMinivimKernel(TestCase):
    """Tests for build_minivim_kernel module."""

    def test_import(self):
        """Test module imports."""
        from build_minivim_kernel import (
            BuildConfig,
            SUPPORTED_ARCHES,
            get_make_bin,
            get_jobs,
        )
        self.assertIn("x86_64", SUPPORTED_ARCHES)
        self.assertIn("arm64", SUPPORTED_ARCHES)
        self.assertIn("armv7", SUPPORTED_ARCHES)

    def test_build_config_defaults(self):
        """Test default configuration."""
        from build_minivim_kernel import BuildConfig
        config = BuildConfig()
        self.assertEqual(config.arch, "x86_64")
        self.assertEqual(config.kernel_version, "6.12.10")
        self.assertFalse(config.skip_mrproper)


class TestDockerMuslVsGlibc(TestCase):
    """Tests for docker_musl_vs_glibc module."""

    def test_import(self):
        """Test module imports."""
        from docker_musl_vs_glibc import (
            BuildMetrics,
            ComparisonResults,
            calculate_improvement,
        )
        self.assertTrue(callable(calculate_improvement))

    def test_calculate_improvement(self):
        """Test improvement calculation."""
        from docker_musl_vs_glibc import calculate_improvement
        self.assertEqual(calculate_improvement(100, 90), 10.0)
        self.assertEqual(calculate_improvement(100, 80), 20.0)
        self.assertEqual(calculate_improvement(0, 100), 0.0)


class TestVscodeMicrovm(TestCase):
    """Tests for vscode_microvm module."""

    def test_import(self):
        """Test module imports."""
        from vscode_microvm import (
            MicroVMConfig,
            ms_now,
        )
        self.assertTrue(callable(ms_now))

    def test_microvm_config_defaults(self):
        """Test default configuration."""
        from vscode_microvm import MicroVMConfig
        config = MicroVMConfig()
        self.assertEqual(config.arch, "x86_64")
        self.assertEqual(config.runtime, "qemu")
        self.assertEqual(config.cpus, 4)
        self.assertEqual(config.memory_mb, 2048)


class TestValidateArmv7Kernel(TestCase):
    """Tests for validate_armv7_kernel module."""

    def test_import(self):
        """Test module imports."""
        from validate_armv7_kernel import (
            ValidationConfig,
            ValidationResult,
        )

    def test_validation_config_defaults(self):
        """Test default configuration."""
        from validate_armv7_kernel import ValidationConfig
        config = ValidationConfig()
        self.assertEqual(config.kernel_version, "6.17.14")
        self.assertEqual(config.target_size_mb, 4.0)

    def test_validation_result_defaults(self):
        """Test default result."""
        from validate_armv7_kernel import ValidationResult
        result = ValidationResult()
        self.assertFalse(result.size_compliant)
        self.assertFalse(result.validation_passed)


class TestTrimMicrovmRootfs(TestCase):
    """Tests for trim_microvm_rootfs module."""

    def test_import(self):
        """Test module imports."""
        from trim_microvm_rootfs import (
            TrimConfig,
            TrimResults,
            get_dir_size_mb,
        )
        self.assertTrue(callable(get_dir_size_mb))

    def test_trim_results_defaults(self):
        """Test default results."""
        from trim_microvm_rootfs import TrimResults
        results = TrimResults()
        self.assertEqual(results.original_size_mb, 0)
        self.assertEqual(results.savings_percent, 0)


if __name__ == '__main__':
    import unittest
    unittest.main()
