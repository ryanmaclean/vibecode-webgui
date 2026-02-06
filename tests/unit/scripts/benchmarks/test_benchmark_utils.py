
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for benchmark_utils.py shared utilities."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts/benchmarks to path for import
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "scripts" / "benchmarks"))

from benchmark_utils import (
    BenchmarkError,
    BenchmarkResult,
    Colors,
    HardwareInfo,
    calc_percentile,
    calc_stats,
    check_command,
    detect_cpu_count,
    detect_make_binary,
    file_size_bytes,
    file_size_human,
    get_iso_timestamp,
    get_timestamp,
    load_results,
    ms_now,
    run_cmd,
    run_cmd_output,
    save_results,
    wait_for_condition,
)


class TestColors:
    """Tests for Colors class."""

    def test_disable_removes_colors(self) -> None:
        """Should remove color codes when disabled."""
        Colors.disable()

        assert Colors.GREEN == ""
        assert Colors.RED == ""
        assert Colors.YELLOW == ""
        assert Colors.BLUE == ""
        assert Colors.NC == ""


class TestRunCmd:
    """Tests for run_cmd function."""

    def test_returns_completed_process(self) -> None:
        """Should return CompletedProcess object."""
        result = run_cmd(["echo", "hello"], capture=True)
        assert result.returncode == 0
        assert "hello" in result.stdout

    def test_raises_on_missing_command(self) -> None:
        """Should raise BenchmarkError for missing commands."""
        with pytest.raises(BenchmarkError, match="Command not found"):
            run_cmd(["nonexistent_command_xyz"])

    def test_raises_on_failed_command_when_check_true(self) -> None:
        """Should raise BenchmarkError when command fails and check=True."""
        with pytest.raises(BenchmarkError, match="Command failed"):
            run_cmd(["false"])

    def test_no_raise_on_failed_command_when_check_false(self) -> None:
        """Should not raise when command fails and check=False."""
        result = run_cmd(["false"], check=False)
        assert result.returncode != 0

    def test_uses_custom_env(self) -> None:
        """Should use custom environment variables."""
        result = run_cmd(
            ["sh", "-c", "echo $TEST_VAR"],
            capture=True,
            env={"TEST_VAR": "custom_value"},
        )
        assert "custom_value" in result.stdout

    def test_uses_cwd(self, tmp_path: Path) -> None:
        """Should use specified working directory."""
        result = run_cmd(["pwd"], capture=True, cwd=tmp_path)
        assert str(tmp_path) in result.stdout


class TestRunCmdOutput:
    """Tests for run_cmd_output function."""

    def test_returns_stdout_stripped(self) -> None:
        """Should return stripped stdout."""
        result = run_cmd_output(["echo", "hello"])
        assert result == "hello"

    def test_raises_on_failure(self) -> None:
        """Should raise BenchmarkError on command failure."""
        with pytest.raises(BenchmarkError):
            run_cmd_output(["false"])


class TestCheckCommand:
    """Tests for check_command function."""

    def test_returns_true_for_existing_command(self) -> None:
        """Should return True for commands that exist."""
        assert check_command("echo") is True
        assert check_command("sh") is True

    def test_returns_false_for_missing_command(self) -> None:
        """Should return False for commands that don't exist."""
        assert check_command("nonexistent_command_xyz_123") is False


class TestMsNow:
    """Tests for ms_now function."""

    def test_returns_integer(self) -> None:
        """Should return an integer timestamp."""
        result = ms_now()
        assert isinstance(result, int)

    def test_returns_positive_value(self) -> None:
        """Should return a positive milliseconds value."""
        result = ms_now()
        assert result > 0

    def test_returns_reasonable_timestamp(self) -> None:
        """Should return a timestamp in the expected range."""
        result = ms_now()
        # Should be after year 2020 (1577836800000 ms)
        assert result > 1577836800000
        # Should be before year 2100
        assert result < 4102444800000


class TestCalcStats:
    """Tests for calc_stats function."""

    def test_calculates_basic_stats(self) -> None:
        """Should calculate basic statistics correctly."""
        samples = [1, 2, 3, 4, 5]
        stats = calc_stats(samples)

        assert stats["min"] == 1.0
        assert stats["max"] == 5.0
        assert stats["avg"] == 3.0
        assert "p50" in stats
        assert "p95" in stats
        assert "p99" in stats
        assert "stdev" in stats

    def test_handles_empty_list(self) -> None:
        """Should return zeros for empty list."""
        stats = calc_stats([])

        assert stats["min"] == 0.0
        assert stats["max"] == 0.0
        assert stats["avg"] == 0.0

    def test_handles_single_value(self) -> None:
        """Should handle single value list."""
        stats = calc_stats([42])

        assert stats["min"] == 42.0
        assert stats["max"] == 42.0
        assert stats["avg"] == 42.0
        assert stats["stdev"] == 0.0

    def test_handles_floats(self) -> None:
        """Should handle float values."""
        samples = [1.5, 2.5, 3.5]
        stats = calc_stats(samples)

        assert stats["min"] == 1.5
        assert stats["max"] == 3.5
        assert stats["avg"] == 2.5


class TestCalcPercentile:
    """Tests for calc_percentile function."""

    def test_calculates_percentiles(self) -> None:
        """Should calculate percentiles correctly."""
        samples = list(range(1, 101))  # 1 to 100

        # The function uses idx = int(percentile / 100 * n)
        # So for n=100, p50 -> idx=50 -> samples[50] = 51
        p50 = calc_percentile(samples, 50)
        assert p50 == 51.0  # Index 50 of 1-100 is value 51

        p95 = calc_percentile(samples, 95)
        assert p95 == 96.0  # Index 95 of 1-100 is value 96

    def test_handles_empty_list(self) -> None:
        """Should return 0 for empty list."""
        assert calc_percentile([], 50) == 0.0

    def test_handles_small_list(self) -> None:
        """Should handle list smaller than percentile."""
        samples = [1, 2, 3]
        # Should not raise, should return valid value
        result = calc_percentile(samples, 99)
        assert result in [1.0, 2.0, 3.0]


class TestGetTimestamp:
    """Tests for timestamp functions."""

    def test_get_timestamp_format(self) -> None:
        """Should return timestamp in expected format."""
        result = get_timestamp()
        # Format: YYYYMMDD_HHMMSS
        assert len(result) == 15
        assert "_" in result

    def test_get_iso_timestamp_format(self) -> None:
        """Should return ISO 8601 timestamp."""
        result = get_iso_timestamp()
        assert "T" in result
        assert result.endswith("Z")


class TestHardwareInfo:
    """Tests for HardwareInfo dataclass."""

    def test_default_values(self) -> None:
        """Should have sensible defaults."""
        info = HardwareInfo()

        assert info.chip == "Unknown"
        assert info.logical_cpus == 1
        assert info.physical_cpus == 1

    def test_to_dict(self) -> None:
        """Should convert to dictionary."""
        info = HardwareInfo(chip="Test CPU", logical_cpus=8)
        result = info.to_dict()

        assert isinstance(result, dict)
        assert result["chip"] == "Test CPU"
        assert result["logical_cpus"] == 8


class TestDetectCpuCount:
    """Tests for detect_cpu_count function."""

    def test_returns_positive_integer(self) -> None:
        """Should return a positive integer."""
        result = detect_cpu_count()
        assert isinstance(result, int)
        assert result >= 1


class TestDetectMakeBinary:
    """Tests for detect_make_binary function."""

    def test_returns_make_or_gmake(self) -> None:
        """Should return either make or gmake."""
        result = detect_make_binary()
        assert result in ["make", "gmake"]


class TestBenchmarkResult:
    """Tests for BenchmarkResult dataclass."""

    def test_creates_with_required_fields(self) -> None:
        """Should create with required benchmark_id."""
        result = BenchmarkResult(benchmark_id="test-bench")
        assert result.benchmark_id == "test-bench"
        assert result.timestamp  # Should have default timestamp

    def test_to_dict(self) -> None:
        """Should convert to dictionary."""
        result = BenchmarkResult(
            benchmark_id="test-bench",
            configuration={"key": "value"},
        )
        data = result.to_dict()

        assert isinstance(data, dict)
        assert data["benchmark_id"] == "test-bench"
        assert data["configuration"]["key"] == "value"


class TestSaveLoadResults:
    """Tests for save_results and load_results functions."""

    def test_save_results_creates_file(self, tmp_path: Path) -> None:
        """Should create JSON file with results."""
        result = BenchmarkResult(benchmark_id="test")
        output_path = tmp_path / "results.json"

        save_results(result, output_path)

        assert output_path.exists()
        with open(output_path) as f:
            data = json.load(f)
        assert data["benchmark_id"] == "test"

    def test_save_results_creates_parent_dirs(self, tmp_path: Path) -> None:
        """Should create parent directories if needed."""
        result = BenchmarkResult(benchmark_id="test")
        output_path = tmp_path / "nested" / "dir" / "results.json"

        save_results(result, output_path)

        assert output_path.exists()

    def test_load_results_reads_file(self, tmp_path: Path) -> None:
        """Should read JSON file correctly."""
        output_path = tmp_path / "results.json"
        output_path.write_text('{"benchmark_id": "loaded"}')

        data = load_results(output_path)

        assert data["benchmark_id"] == "loaded"

    def test_load_results_raises_on_missing_file(self, tmp_path: Path) -> None:
        """Should raise BenchmarkError for missing file."""
        with pytest.raises(BenchmarkError, match="not found"):
            load_results(tmp_path / "nonexistent.json")

    def test_load_results_raises_on_invalid_json(self, tmp_path: Path) -> None:
        """Should raise BenchmarkError for invalid JSON."""
        output_path = tmp_path / "invalid.json"
        output_path.write_text("not valid json {{{")

        with pytest.raises(BenchmarkError, match="Invalid JSON"):
            load_results(output_path)


class TestFileSizeFunctions:
    """Tests for file size functions."""

    def test_file_size_bytes(self, tmp_path: Path) -> None:
        """Should return file size in bytes."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("hello world")

        size = file_size_bytes(test_file)
        assert size == 11

    def test_file_size_human_bytes(self) -> None:
        """Should format bytes correctly."""
        assert file_size_human(500) == "500.0B"

    def test_file_size_human_kb(self) -> None:
        """Should format kilobytes correctly."""
        result = file_size_human(1024)
        assert "KB" in result

    def test_file_size_human_mb(self) -> None:
        """Should format megabytes correctly."""
        result = file_size_human(1024 * 1024)
        assert "MB" in result

    def test_file_size_human_gb(self) -> None:
        """Should format gigabytes correctly."""
        result = file_size_human(1024 * 1024 * 1024)
        assert "GB" in result


class TestWaitForCondition:
    """Tests for wait_for_condition function."""

    def test_returns_when_condition_met(self) -> None:
        """Should return when condition becomes true."""
        call_count = [0]

        def condition():
            call_count[0] += 1
            if call_count[0] >= 3:
                return "success"
            return None

        result = wait_for_condition(condition, timeout_seconds=1.0, poll_interval=0.01)
        assert result == "success"

    def test_raises_on_timeout(self) -> None:
        """Should raise BenchmarkError on timeout."""
        def never_true():
            return None

        with pytest.raises(BenchmarkError, match="Timeout"):
            wait_for_condition(
                never_true,
                timeout_seconds=0.1,
                poll_interval=0.01,
                description="test condition",
            )

    def test_returns_immediately_when_already_true(self) -> None:
        """Should return immediately if condition is already true."""
        def always_true():
            return 42

        result = wait_for_condition(always_true, timeout_seconds=1.0)
        assert result == 42