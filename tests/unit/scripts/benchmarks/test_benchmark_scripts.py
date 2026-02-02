"""Tests for benchmark runner scripts."""

import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts/benchmarks to path for import
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "scripts" / "benchmarks"))


class TestAlpineChromiumBench:
    """Tests for alpine_chromium_bench.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        import alpine_chromium_bench
        assert hasattr(alpine_chromium_bench, "main")


class TestApplevfFastbootBench:
    """Tests for applevf_fastboot_bench.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        import applevf_fastboot_bench
        assert hasattr(applevf_fastboot_bench, "AppleVFBenchmark")
        assert hasattr(applevf_fastboot_bench, "main")


class TestApplevfVfkitLauncher:
    """Tests for applevf_vfkit_launcher.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        from applevf_vfkit_launcher import VFKitLauncher
        assert VFKitLauncher is not None


class TestVscodeMicrovm:
    """Tests for vscode_microvm.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        from vscode_microvm import MicroVM, MicroVMConfig
        assert MicroVM is not None
        assert MicroVMConfig is not None

    def test_microvm_config_defaults(self) -> None:
        """Should have sensible defaults."""
        from vscode_microvm import MicroVMConfig

        config = MicroVMConfig()
        assert config.memory_mb >= 256
        assert config.cpus >= 1


class TestMSeriesPerformanceTest:
    """Tests for m_series_performance_test.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        import m_series_performance_test
        assert hasattr(m_series_performance_test, "main")


class TestNoisyNeighborExperiment:
    """Tests for noisy_neighbor_experiment.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        import noisy_neighbor_experiment
        assert hasattr(noisy_neighbor_experiment, "main")


class TestOpenvscoBenchmark:
    """Tests for openvscode_benchmark.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        import openvscode_benchmark
        assert hasattr(openvscode_benchmark, "main")


class TestCompareVscodeBuilds:
    """Tests for compare_vscode_builds.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        import compare_vscode_builds
        assert hasattr(compare_vscode_builds, "main")


class TestDockerMuslVsGlibc:
    """Tests for docker_musl_vs_glibc.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        from docker_musl_vs_glibc import ALPINE_DOCKERFILE_CONTENT
        # The dockerfile uses node:20-alpine which is based on alpine
        assert "alpine" in ALPINE_DOCKERFILE_CONTENT.lower()


class TestTestMuslBuilds:
    """Tests for test_musl_builds.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        from test_musl_builds import (
            TestRunner,
            find_busybox_binary,
        )
        assert hasattr(TestRunner, "run_test")
        assert callable(find_busybox_binary)

    def test_test_runner_tracking(self) -> None:
        """Should track pass/fail counts."""
        from test_musl_builds import TestRunner

        runner = TestRunner()
        assert runner.tests_passed == 0
        assert runner.tests_failed == 0

        runner.run_test("passing test", True)
        assert runner.tests_passed == 1
        assert runner.tests_failed == 0

        runner.run_test("failing test", False)
        assert runner.tests_passed == 1
        assert runner.tests_failed == 1


class TestTestNeovimMinimal:
    """Tests for test_neovim_minimal.py functions."""

    def test_import(self) -> None:
        """Should import successfully."""
        from test_neovim_minimal import (
            NEOVIM_VERSION,
            check_local_neovim,
            check_static_linking,
        )
        assert NEOVIM_VERSION is not None
        assert callable(check_local_neovim)
        assert callable(check_static_linking)

    def test_check_static_linking_returns_bool(self, tmp_path: Path) -> None:
        """Should return boolean."""
        from test_neovim_minimal import check_static_linking

        # Create a test file
        test_file = tmp_path / "test_binary"
        test_file.write_bytes(b"\x7fELF")  # ELF header

        result = check_static_linking(test_file)
        assert isinstance(result, bool)
