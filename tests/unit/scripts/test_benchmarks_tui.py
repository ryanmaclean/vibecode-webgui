"""Tests for scripts/benchmarks_tui.py"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from benchmarks_tui import (
    BenchmarkResult,
    BenchmarkScript,
    TUIState,
    discover_benchmarks,
    get_script_description,
    save_results,
)


class TestBenchmarkScript:
    """Tests for BenchmarkScript dataclass."""

    def test_creates_script(self, tmp_path: Path) -> None:
        """Should create benchmark script."""
        script = BenchmarkScript(
            path=tmp_path / "test.sh",
            name="test",
            description="Test script",
        )
        assert script.name == "test"
        assert script.description == "Test script"
        assert script.status == "pending"

    def test_default_values(self, tmp_path: Path) -> None:
        """Should have default values."""
        script = BenchmarkScript(path=tmp_path / "test.sh", name="test")
        assert script.description == ""
        assert script.last_run is None
        assert script.last_result is None
        assert script.run_time == 0.0
        assert script.status == "pending"


class TestBenchmarkResult:
    """Tests for BenchmarkResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create benchmark result."""
        result = BenchmarkResult(
            script_name="test",
            timestamp=datetime.now(),
            duration=10.5,
            exit_code=0,
            output="Output",
            success=True,
        )
        assert result.script_name == "test"
        assert result.duration == 10.5
        assert result.success is True


class TestTUIState:
    """Tests for TUIState dataclass."""

    def test_default_values(self) -> None:
        """Should have default values."""
        state = TUIState()
        assert state.scripts == []
        assert state.results == []
        assert state.selected_index == 0
        assert state.scroll_offset == 0
        assert state.mode == "main"
        assert state.running_script is None
        assert state.output_lines == []
        assert state.status_message == ""
        assert state.compare_indices == []


class TestGetScriptDescription:
    """Tests for get_script_description function."""

    def test_extracts_description(self, tmp_path: Path) -> None:
        """Should extract description from header."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\n# This is a test script\necho hello\n")

        desc = get_script_description(script)
        assert desc == "This is a test script"

    def test_handles_no_description(self, tmp_path: Path) -> None:
        """Should handle script with no description."""
        script = tmp_path / "test-script.sh"
        script.write_text("#!/bin/bash\necho hello\n")

        desc = get_script_description(script)
        assert "Test Script" in desc

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should handle missing file."""
        desc = get_script_description(tmp_path / "nonexistent.sh")
        assert desc == "Unknown"

    def test_truncates_long_description(self, tmp_path: Path) -> None:
        """Should truncate long descriptions."""
        script = tmp_path / "test.sh"
        long_desc = "# " + "A" * 100
        script.write_text(f"#!/bin/bash\n{long_desc}\necho hello\n")

        desc = get_script_description(script)
        assert len(desc) <= 60

    def test_skips_shebang(self, tmp_path: Path) -> None:
        """Should skip shebang line."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\n# Real description\necho hello\n")

        desc = get_script_description(script)
        assert "bash" not in desc.lower()


class TestDiscoverBenchmarks:
    """Tests for discover_benchmarks function."""

    def test_discovers_scripts(self, tmp_path: Path) -> None:
        """Should discover benchmark scripts."""
        benchmarks_dir = tmp_path / "benchmarks"
        benchmarks_dir.mkdir()

        (benchmarks_dir / "bench1.sh").write_text("#!/bin/bash\n# Benchmark 1\n")
        (benchmarks_dir / "bench2.sh").write_text("#!/bin/bash\n# Benchmark 2\n")

        scripts = discover_benchmarks(tmp_path)

        assert len(scripts) == 2
        assert any(s.name == "bench1" for s in scripts)
        assert any(s.name == "bench2" for s in scripts)

    def test_returns_empty_when_no_dir(self, tmp_path: Path) -> None:
        """Should return empty list when no benchmarks dir."""
        scripts = discover_benchmarks(tmp_path)
        assert scripts == []

    def test_ignores_non_sh_files(self, tmp_path: Path) -> None:
        """Should ignore non-shell files."""
        benchmarks_dir = tmp_path / "benchmarks"
        benchmarks_dir.mkdir()

        (benchmarks_dir / "bench.sh").write_text("#!/bin/bash\n")
        (benchmarks_dir / "bench.py").write_text("#!/usr/bin/env python3\n")
        (benchmarks_dir / "README.md").write_text("# README\n")

        scripts = discover_benchmarks(tmp_path)

        assert len(scripts) == 1
        assert scripts[0].name == "bench"

    def test_sorts_scripts_alphabetically(self, tmp_path: Path) -> None:
        """Should sort scripts alphabetically."""
        benchmarks_dir = tmp_path / "benchmarks"
        benchmarks_dir.mkdir()

        (benchmarks_dir / "zebra.sh").write_text("#!/bin/bash\n")
        (benchmarks_dir / "alpha.sh").write_text("#!/bin/bash\n")
        (benchmarks_dir / "beta.sh").write_text("#!/bin/bash\n")

        scripts = discover_benchmarks(tmp_path)

        assert scripts[0].name == "alpha"
        assert scripts[1].name == "beta"
        assert scripts[2].name == "zebra"


class TestSaveResults:
    """Tests for save_results function."""

    def test_saves_results_to_json(self, tmp_path: Path) -> None:
        """Should save results to JSON file."""
        state = TUIState()
        state.results = [
            BenchmarkResult(
                script_name="test1",
                timestamp=datetime(2024, 1, 1, 12, 0, 0),
                duration=10.5,
                exit_code=0,
                output="output",
                success=True,
            ),
            BenchmarkResult(
                script_name="test2",
                timestamp=datetime(2024, 1, 1, 12, 1, 0),
                duration=5.2,
                exit_code=1,
                output="error",
                success=False,
            ),
        ]

        output_path = tmp_path / "results.json"
        save_results(state, output_path)

        assert output_path.exists()
        import json
        data = json.loads(output_path.read_text())
        assert "timestamp" in data
        assert len(data["results"]) == 2
        assert data["results"][0]["script"] == "test1"
        assert data["results"][0]["success"] is True
        assert data["results"][1]["script"] == "test2"
        assert data["results"][1]["success"] is False

    def test_creates_parent_directories(self, tmp_path: Path) -> None:
        """Should create parent directories if needed."""
        state = TUIState()
        state.results = []

        output_path = tmp_path / "deep" / "nested" / "results.json"
        save_results(state, output_path)

        assert output_path.exists()

    def test_handles_empty_results(self, tmp_path: Path) -> None:
        """Should handle empty results."""
        state = TUIState()
        state.results = []

        output_path = tmp_path / "results.json"
        save_results(state, output_path)

        import json
        data = json.loads(output_path.read_text())
        assert data["results"] == []


class TestTUIStateManagement:
    """Tests for TUI state management."""

    def test_mode_transitions(self) -> None:
        """Should handle mode transitions."""
        state = TUIState()

        assert state.mode == "main"

        state.mode = "running"
        assert state.mode == "running"

        state.mode = "results"
        assert state.mode == "results"

        state.mode = "compare"
        assert state.mode == "compare"

        state.mode = "help"
        assert state.mode == "help"

    def test_compare_indices(self) -> None:
        """Should track compare indices."""
        state = TUIState()

        state.compare_indices.append(0)
        state.compare_indices.append(2)

        assert 0 in state.compare_indices
        assert 2 in state.compare_indices
        assert len(state.compare_indices) == 2

    def test_selection_tracking(self) -> None:
        """Should track selection."""
        state = TUIState()
        state.scripts = [
            BenchmarkScript(path=Path("/tmp/a.sh"), name="a"),
            BenchmarkScript(path=Path("/tmp/b.sh"), name="b"),
            BenchmarkScript(path=Path("/tmp/c.sh"), name="c"),
        ]

        state.selected_index = 1
        assert state.scripts[state.selected_index].name == "b"

        state.selected_index = 2
        assert state.scripts[state.selected_index].name == "c"

    def test_scroll_offset(self) -> None:
        """Should track scroll offset."""
        state = TUIState()

        state.scroll_offset = 5
        assert state.scroll_offset == 5

        state.scroll_offset = 0
        assert state.scroll_offset == 0

    def test_output_lines(self) -> None:
        """Should track output lines."""
        state = TUIState()

        state.output_lines.append("Line 1")
        state.output_lines.append("Line 2")

        assert len(state.output_lines) == 2
        assert state.output_lines[0] == "Line 1"

    def test_status_message(self) -> None:
        """Should track status message."""
        state = TUIState()

        state.status_message = "Running benchmark..."
        assert state.status_message == "Running benchmark..."

        state.status_message = ""
        assert state.status_message == ""


class TestBenchmarkScriptStatus:
    """Tests for benchmark script status transitions."""

    def test_status_pending(self, tmp_path: Path) -> None:
        """Should start with pending status."""
        script = BenchmarkScript(path=tmp_path / "test.sh", name="test")
        assert script.status == "pending"

    def test_status_running(self, tmp_path: Path) -> None:
        """Should transition to running."""
        script = BenchmarkScript(path=tmp_path / "test.sh", name="test")
        script.status = "running"
        assert script.status == "running"

    def test_status_success(self, tmp_path: Path) -> None:
        """Should transition to success."""
        script = BenchmarkScript(path=tmp_path / "test.sh", name="test")
        script.status = "success"
        script.last_run = datetime.now()
        script.run_time = 5.5

        assert script.status == "success"
        assert script.last_run is not None
        assert script.run_time == 5.5

    def test_status_failed(self, tmp_path: Path) -> None:
        """Should transition to failed."""
        script = BenchmarkScript(path=tmp_path / "test.sh", name="test")
        script.status = "failed"
        assert script.status == "failed"
