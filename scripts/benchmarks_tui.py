#!/usr/bin/env python3
"""TUI for running benchmark scripts.

A terminal user interface for discovering, running, and comparing
benchmark results from scripts/benchmarks/*.sh scripts.
"""

from __future__ import annotations

import curses
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class BenchmarkScript:
    """Represents a benchmark script."""

    path: Path
    name: str
    description: str = ""
    last_run: Optional[datetime] = None
    last_result: Optional[str] = None
    run_time: float = 0.0
    status: str = "pending"  # pending, running, success, failed


@dataclass
class BenchmarkResult:
    """Result from running a benchmark."""

    script_name: str
    timestamp: datetime
    duration: float
    exit_code: int
    output: str
    success: bool


@dataclass
class TUIState:
    """State for the TUI."""

    scripts: list[BenchmarkScript] = field(default_factory=list)
    results: list[BenchmarkResult] = field(default_factory=list)
    selected_index: int = 0
    scroll_offset: int = 0
    mode: str = "main"  # main, running, results, compare, help
    running_script: Optional[BenchmarkScript] = None
    output_lines: list[str] = field(default_factory=list)
    status_message: str = ""
    compare_indices: list[int] = field(default_factory=list)


def get_script_description(script_path: Path) -> str:
    """Extract description from script header comments."""
    try:
        content = script_path.read_text()
        lines = content.split("\n")
        for line in lines[1:10]:  # Check first 10 lines after shebang
            line = line.strip()
            if line.startswith("#") and not line.startswith("#!"):
                desc = line.lstrip("#").strip()
                if desc and len(desc) > 5:
                    return desc[:60]
        return script_path.stem.replace("-", " ").replace("_", " ").title()
    except OSError:
        return "Unknown"


def discover_benchmarks(scripts_dir: Path) -> list[BenchmarkScript]:
    """Discover all benchmark scripts."""
    benchmarks_dir = scripts_dir / "benchmarks"
    if not benchmarks_dir.exists():
        return []

    scripts = []
    for script_path in sorted(benchmarks_dir.glob("*.sh")):
        if script_path.is_file():
            scripts.append(BenchmarkScript(
                path=script_path,
                name=script_path.stem,
                description=get_script_description(script_path),
            ))
    return scripts


def run_benchmark(script: BenchmarkScript, output_callback: callable) -> BenchmarkResult:
    """Run a single benchmark script."""
    script.status = "running"
    start_time = time.time()
    output_lines = []

    try:
        process = subprocess.Popen(
            ["bash", str(script.path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=script.path.parent.parent.parent,
            env={**os.environ, "TERM": "dumb"},
        )

        for line in iter(process.stdout.readline, ""):
            output_lines.append(line.rstrip())
            output_callback(line.rstrip())

        process.wait()
        exit_code = process.returncode
        success = exit_code == 0

    except OSError as e:
        output_lines.append(f"Error: {e}")
        exit_code = 1
        success = False

    duration = time.time() - start_time
    script.status = "success" if success else "failed"
    script.last_run = datetime.now()
    script.run_time = duration

    return BenchmarkResult(
        script_name=script.name,
        timestamp=datetime.now(),
        duration=duration,
        exit_code=exit_code,
        output="\n".join(output_lines),
        success=success,
    )


def draw_header(stdscr: curses.window, width: int, state: TUIState) -> None:
    """Draw the header."""
    title = " Benchmarks TUI "
    stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
    stdscr.addstr(0, 0, "=" * width)
    stdscr.addstr(0, (width - len(title)) // 2, title)
    stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)


def draw_footer(stdscr: curses.window, height: int, width: int, state: TUIState) -> None:
    """Draw the footer with keybindings."""
    footer_y = height - 1

    if state.mode == "main":
        keys = "[Enter] Run  [a] Run All  [c] Compare  [r] Results  [h] Help  [q] Quit"
    elif state.mode == "running":
        keys = "[Esc] Cancel (if possible)"
    elif state.mode == "results":
        keys = "[Enter] View  [d] Delete  [Esc] Back"
    elif state.mode == "compare":
        keys = "[Space] Select  [Enter] Compare  [Esc] Back"
    elif state.mode == "help":
        keys = "[Any key] Back"
    else:
        keys = "[q] Quit"

    stdscr.attron(curses.color_pair(2))
    stdscr.addstr(footer_y, 0, " " * width)
    stdscr.addstr(footer_y, 0, keys[:width - 1])
    stdscr.attroff(curses.color_pair(2))

    if state.status_message:
        msg = f" {state.status_message} "
        if len(msg) < width - len(keys) - 2:
            stdscr.attron(curses.color_pair(3))
            stdscr.addstr(footer_y, width - len(msg) - 1, msg)
            stdscr.attroff(curses.color_pair(3))


def draw_script_list(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the list of benchmark scripts."""
    list_height = height - start_y - 2
    visible_scripts = state.scripts[state.scroll_offset:state.scroll_offset + list_height]

    stdscr.addstr(start_y, 2, f"Benchmarks ({len(state.scripts)} scripts)", curses.A_BOLD)

    for i, script in enumerate(visible_scripts):
        y = start_y + 1 + i
        actual_index = state.scroll_offset + i

        # Status indicator
        if script.status == "running":
            status = "[*]"
            color = curses.color_pair(4)
        elif script.status == "success":
            status = "[+]"
            color = curses.color_pair(5)
        elif script.status == "failed":
            status = "[-]"
            color = curses.color_pair(6)
        else:
            status = "[ ]"
            color = curses.color_pair(0)

        # Selection indicator
        if actual_index == state.selected_index:
            attr = curses.A_REVERSE
        elif state.mode == "compare" and actual_index in state.compare_indices:
            attr = curses.A_BOLD | curses.color_pair(4)
        else:
            attr = curses.A_NORMAL

        # Draw line
        line = f" {status} {script.name:<30} {script.description[:width - 40]}"
        stdscr.attron(attr | color)
        stdscr.addstr(y, 0, line[:width - 1].ljust(width - 1))
        stdscr.attroff(attr | color)


def draw_running_output(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the running benchmark output."""
    if state.running_script:
        stdscr.addstr(start_y, 2, f"Running: {state.running_script.name}", curses.A_BOLD)
    else:
        stdscr.addstr(start_y, 2, "Running benchmarks...", curses.A_BOLD)

    output_height = height - start_y - 3
    visible_lines = state.output_lines[-output_height:] if state.output_lines else []

    for i, line in enumerate(visible_lines):
        y = start_y + 1 + i
        if y < height - 2:
            # Strip ANSI codes for display
            clean_line = line
            for code in ["\033[0m", "\033[1m", "\033[31m", "\033[32m", "\033[33m", "\033[34m"]:
                clean_line = clean_line.replace(code, "")
            stdscr.addstr(y, 2, clean_line[:width - 4])


def draw_results(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the results view."""
    stdscr.addstr(start_y, 2, f"Results ({len(state.results)} runs)", curses.A_BOLD)

    list_height = height - start_y - 3
    visible_results = state.results[-list_height:] if state.results else []

    for i, result in enumerate(visible_results):
        y = start_y + 1 + i
        if y < height - 2:
            status = "[+]" if result.success else "[-]"
            color = curses.color_pair(5) if result.success else curses.color_pair(6)
            time_str = result.timestamp.strftime("%H:%M:%S")
            duration = f"{result.duration:.1f}s"
            line = f" {status} {time_str} {result.script_name:<25} {duration}"

            stdscr.attron(color)
            stdscr.addstr(y, 0, line[:width - 1])
            stdscr.attroff(color)


def draw_compare(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw comparison view."""
    stdscr.addstr(start_y, 2, "Compare Results (select 2+ scripts with Space)", curses.A_BOLD)

    selected_names = [state.scripts[i].name for i in state.compare_indices]
    if len(selected_names) >= 2:
        stdscr.addstr(start_y + 1, 2, f"Selected: {', '.join(selected_names)}")

        # Show comparison of selected scripts
        y = start_y + 3
        stdscr.addstr(y, 2, f"{'Script':<30} {'Last Run':<12} {'Duration':<10} {'Status':<10}", curses.A_BOLD)
        y += 1

        for idx in state.compare_indices:
            script = state.scripts[idx]
            if y < height - 2:
                last_run = script.last_run.strftime("%H:%M:%S") if script.last_run else "Never"
                duration = f"{script.run_time:.1f}s" if script.run_time > 0 else "-"
                line = f"  {script.name:<28} {last_run:<12} {duration:<10} {script.status:<10}"
                stdscr.addstr(y, 0, line[:width - 1])
                y += 1


def draw_help(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw help screen."""
    help_text = [
        "Benchmarks TUI - Help",
        "",
        "Navigation:",
        "  Up/Down, j/k    Move selection",
        "  PgUp/PgDn       Scroll page",
        "  Home/End        Go to first/last",
        "",
        "Actions:",
        "  Enter           Run selected benchmark",
        "  a               Run ALL benchmarks",
        "  c               Enter compare mode",
        "  r               View results",
        "  h               Show this help",
        "  q               Quit",
        "",
        "Compare Mode:",
        "  Space           Toggle selection",
        "  Enter           Show comparison",
        "  Esc             Exit compare mode",
        "",
        "Results Mode:",
        "  Enter           View result details",
        "  d               Delete result",
        "  Esc             Back to main",
        "",
        "Press any key to return...",
    ]

    for i, line in enumerate(help_text):
        y = start_y + i
        if y < height - 2:
            stdscr.addstr(y, 2, line[:width - 4])


def main_loop(stdscr: curses.window, state: TUIState) -> None:
    """Main TUI loop."""
    curses.curs_set(0)
    stdscr.nodelay(False)
    stdscr.timeout(100)

    # Initialize colors
    curses.start_color()
    curses.use_default_colors()
    curses.init_pair(1, curses.COLOR_CYAN, -1)      # Header
    curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_WHITE)  # Footer
    curses.init_pair(3, curses.COLOR_YELLOW, -1)    # Status
    curses.init_pair(4, curses.COLOR_YELLOW, -1)    # Running
    curses.init_pair(5, curses.COLOR_GREEN, -1)     # Success
    curses.init_pair(6, curses.COLOR_RED, -1)       # Failed

    while True:
        stdscr.clear()
        height, width = stdscr.getmaxyx()

        draw_header(stdscr, width, state)
        draw_footer(stdscr, height, width, state)

        if state.mode == "main":
            draw_script_list(stdscr, state, 2, height, width)
        elif state.mode == "running":
            draw_running_output(stdscr, state, 2, height, width)
        elif state.mode == "results":
            draw_results(stdscr, state, 2, height, width)
        elif state.mode == "compare":
            draw_script_list(stdscr, state, 2, height, width)
        elif state.mode == "help":
            draw_help(stdscr, 2, height, width)

        stdscr.refresh()

        try:
            key = stdscr.getch()
        except curses.error:
            continue

        if key == -1:
            continue

        # Global keys
        if key == ord("q") and state.mode != "running":
            break

        # Mode-specific keys
        if state.mode == "main":
            handle_main_keys(stdscr, state, key, height)
        elif state.mode == "running":
            if key == 27:  # Escape
                state.mode = "main"
                state.status_message = "Benchmark may still be running in background"
        elif state.mode == "results":
            if key == 27:  # Escape
                state.mode = "main"
        elif state.mode == "compare":
            handle_compare_keys(state, key, height)
        elif state.mode == "help":
            state.mode = "main"


def handle_main_keys(stdscr: curses.window, state: TUIState, key: int, height: int) -> None:
    """Handle keys in main mode."""
    list_height = height - 5

    if key in (curses.KEY_UP, ord("k")):
        if state.selected_index > 0:
            state.selected_index -= 1
            if state.selected_index < state.scroll_offset:
                state.scroll_offset = state.selected_index
    elif key in (curses.KEY_DOWN, ord("j")):
        if state.selected_index < len(state.scripts) - 1:
            state.selected_index += 1
            if state.selected_index >= state.scroll_offset + list_height:
                state.scroll_offset = state.selected_index - list_height + 1
    elif key == curses.KEY_PPAGE:
        state.selected_index = max(0, state.selected_index - list_height)
        state.scroll_offset = max(0, state.scroll_offset - list_height)
    elif key == curses.KEY_NPAGE:
        state.selected_index = min(len(state.scripts) - 1, state.selected_index + list_height)
        state.scroll_offset = min(len(state.scripts) - list_height, state.scroll_offset + list_height)
    elif key == curses.KEY_HOME:
        state.selected_index = 0
        state.scroll_offset = 0
    elif key == curses.KEY_END:
        state.selected_index = len(state.scripts) - 1
        state.scroll_offset = max(0, len(state.scripts) - list_height)
    elif key in (curses.KEY_ENTER, 10, 13):
        if state.scripts:
            run_single_benchmark(stdscr, state)
    elif key == ord("a"):
        run_all_benchmarks(stdscr, state)
    elif key == ord("c"):
        state.mode = "compare"
        state.compare_indices = []
        state.status_message = "Select benchmarks to compare"
    elif key == ord("r"):
        state.mode = "results"
    elif key == ord("h"):
        state.mode = "help"


def handle_compare_keys(state: TUIState, key: int, height: int) -> None:
    """Handle keys in compare mode."""
    list_height = height - 5

    if key in (curses.KEY_UP, ord("k")):
        if state.selected_index > 0:
            state.selected_index -= 1
    elif key in (curses.KEY_DOWN, ord("j")):
        if state.selected_index < len(state.scripts) - 1:
            state.selected_index += 1
    elif key == ord(" "):
        if state.selected_index in state.compare_indices:
            state.compare_indices.remove(state.selected_index)
        else:
            state.compare_indices.append(state.selected_index)
        state.status_message = f"{len(state.compare_indices)} selected"
    elif key in (curses.KEY_ENTER, 10, 13):
        if len(state.compare_indices) >= 2:
            state.status_message = "Comparison shown above"
    elif key == 27:  # Escape
        state.mode = "main"
        state.compare_indices = []
        state.status_message = ""


def run_single_benchmark(stdscr: curses.window, state: TUIState) -> None:
    """Run a single benchmark."""
    script = state.scripts[state.selected_index]
    state.mode = "running"
    state.running_script = script
    state.output_lines = []

    stdscr.nodelay(True)

    def output_callback(line: str) -> None:
        state.output_lines.append(line)
        stdscr.clear()
        height, width = stdscr.getmaxyx()
        draw_header(stdscr, width, state)
        draw_footer(stdscr, height, width, state)
        draw_running_output(stdscr, state, 2, height, width)
        stdscr.refresh()

    result = run_benchmark(script, output_callback)
    state.results.append(result)

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None

    if result.success:
        state.status_message = f"{script.name} completed in {result.duration:.1f}s"
    else:
        state.status_message = f"{script.name} failed (exit code {result.exit_code})"


def run_all_benchmarks(stdscr: curses.window, state: TUIState) -> None:
    """Run all benchmarks."""
    state.mode = "running"
    state.output_lines = []
    total = len(state.scripts)
    completed = 0
    failed = 0

    stdscr.nodelay(True)

    for i, script in enumerate(state.scripts):
        state.running_script = script
        state.output_lines.append(f"=== Running {i + 1}/{total}: {script.name} ===")

        def output_callback(line: str) -> None:
            state.output_lines.append(line)
            stdscr.clear()
            height, width = stdscr.getmaxyx()
            draw_header(stdscr, width, state)
            draw_footer(stdscr, height, width, state)
            draw_running_output(stdscr, state, 2, height, width)
            stdscr.refresh()

        result = run_benchmark(script, output_callback)
        state.results.append(result)

        if result.success:
            completed += 1
        else:
            failed += 1

        state.output_lines.append(f"=== {script.name}: {'SUCCESS' if result.success else 'FAILED'} ===")
        state.output_lines.append("")

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None
    state.status_message = f"Completed: {completed} succeeded, {failed} failed"


def save_results(state: TUIState, output_path: Path) -> None:
    """Save results to JSON file."""
    results_data = {
        "timestamp": datetime.now().isoformat(),
        "results": [
            {
                "script": r.script_name,
                "timestamp": r.timestamp.isoformat(),
                "duration": r.duration,
                "exit_code": r.exit_code,
                "success": r.success,
            }
            for r in state.results
        ],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results_data, indent=2))


def main() -> int:
    """Main entry point."""
    script_dir = Path(__file__).parent.resolve()
    state = TUIState()
    state.scripts = discover_benchmarks(script_dir)

    if not state.scripts:
        print("No benchmark scripts found in scripts/benchmarks/")
        print("Looking in:", script_dir / "benchmarks")
        return 1

    print(f"Found {len(state.scripts)} benchmark scripts")
    print("Starting TUI...")

    try:
        curses.wrapper(lambda stdscr: main_loop(stdscr, state))
    except KeyboardInterrupt:
        pass

    # Save results on exit if any
    if state.results:
        results_path = script_dir.parent / "artifacts" / "benchmark-results" / f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        save_results(state, results_path)
        print(f"\nResults saved to: {results_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
