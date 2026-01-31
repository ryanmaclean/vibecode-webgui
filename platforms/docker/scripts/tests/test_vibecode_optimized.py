"""Tests for vibecode_optimized scripts."""

import pytest
from unittest.mock import patch, MagicMock
import os
import sys
import platform

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vibecode_optimized.build_arm64 import (
    check_arm64,
)

from vibecode_optimized.build_nodejs import (
    get_cpu_count,
)

from vibecode_optimized.performance_test import (
    PerformanceResult,
    get_process_memory,
    get_directory_size,
)


class TestCheckArm64:
    """Tests for check_arm64 function."""

    def test_returns_bool(self):
        """Test that function returns a boolean."""
        result = check_arm64()
        assert isinstance(result, bool)

    def test_matches_platform(self):
        """Test that result matches platform."""
        expected = platform.machine() in ("arm64", "aarch64")
        assert check_arm64() == expected


class TestGetCpuCount:
    """Tests for get_cpu_count function."""

    def test_returns_positive_int(self):
        """Test that function returns a positive integer."""
        count = get_cpu_count()
        assert isinstance(count, int)
        assert count > 0

    def test_at_least_one(self):
        """Test that at least one CPU is reported."""
        count = get_cpu_count()
        assert count >= 1


class TestPerformanceResult:
    """Tests for PerformanceResult dataclass."""

    def test_result_creation(self):
        """Test creating performance result."""
        result = PerformanceResult(
            startup_time_ms=500,
            memory_usage_kb=100000,
            binary_size="50MB",
        )
        assert result.startup_time_ms == 500
        assert result.memory_usage_kb == 100000
        assert result.binary_size == "50MB"


class TestGetProcessMemory:
    """Tests for get_process_memory function."""

    def test_returns_int(self):
        """Test that function returns an integer."""
        memory = get_process_memory()
        assert isinstance(memory, int)

    def test_non_negative(self):
        """Test that memory is non-negative."""
        memory = get_process_memory()
        assert memory >= 0


class TestGetDirectorySize:
    """Tests for get_directory_size function."""

    def test_returns_string(self):
        """Test that function returns a string."""
        size = get_directory_size(".")
        assert isinstance(size, str)

    @patch('subprocess.run')
    def test_parses_du_output(self, mock_run):
        """Test parsing du command output."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="100M\t.\n",
            stderr="",
        )

        size = get_directory_size(".")
        assert "100M" in size


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
