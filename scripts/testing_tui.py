#!/usr/bin/env python3
"""Unified Testing TUI for VibeCode.

A terminal user interface that consolidates all test scripts:
- test-*.sh
- run-*-tests.sh
- scripts/tests/**/*.sh

Features:
- Browse tests by category
- Run individual tests or groups
- View test results and logs
- Search for tests
- Keyboard navigation
"""

from __future__ import annotations

import curses
import glob
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Callable


@dataclass
class TestScript:
    """Represents a test script."""

    path: Path
    name: str
    category: str
    description: str = ""
    status: str = "pending"  # pending, running, passed, failed, skipped
    output: str = ""
    duration: float = 0.0


@dataclass
class TestCategory:
    """A category of tests."""

    name: str
    tests: list[TestScript] = field(default_factory=list)
    expanded: bool = True


class ViewMode(Enum):
    """Current view mode."""

    TREE = auto()
    RESULTS = auto()
    LOG = auto()
    HELP = auto()


@dataclass(frozen=True)
class Colors:
    """Color pair indices for curses."""

    DEFAULT = 0
    HEADER = 1
    SELECTED = 2
    PASSED = 3
    FAILED = 4
    RUNNING = 5
    CATEGORY = 6
    HELP = 7
    STATUS_BAR = 8


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent


def extract_description(script_path: Path) -> str:
    """Extract description from script comments."""
    try:
        content = script_path.read_text()
        # Look for comment at top of file
        lines = content.split("\n")[:10]
        for line in lines:
            # Skip shebang
            if line.startswith("#!"):
                continue
            # Look for description comment
            if line.startswith("#") and len(line) > 3:
                desc = line.lstrip("#").strip()
                if desc and not desc.startswith("shellcheck") and not desc.startswith("set "):
                    return desc[:60]
        return ""
    except Exception:
        return ""


def categorize_test(path: Path, project_root: Path) -> str:
    """Determine category for a test script."""
    rel_path = str(path.relative_to(project_root))

    if "bootstrap" in rel_path:
        return "Bootstrap"
    elif "datadog" in rel_path:
        return "Datadog"
    elif "azure" in rel_path:
        return "Azure"
    elif "vfkit" in rel_path:
        return "VFKit VMs"
    elif "vz" in rel_path:
        return "Virtualization Framework"
    elif "benchmark" in rel_path:
        return "Benchmarks"
    elif "kind" in rel_path or "kubernetes" in rel_path or "k8s" in rel_path:
        return "Kubernetes"
    elif "docker" in rel_path:
        return "Docker"
    elif "vm" in rel_path.lower():
        return "VMs"
    elif "integration" in rel_path:
        return "Integration"
    elif "run-all" in rel_path or "run-" in rel_path:
        return "Test Runners"
    elif "docs/archive" in rel_path:
        return "Archived"
    else:
        return "General"


def discover_tests(project_root: Path) -> dict[str, TestCategory]:
    """Discover all test scripts in the project."""
    categories: dict[str, TestCategory] = {}

    # Patterns to search
    patterns = [
        "**/test-*.sh",
        "**/run-*-tests.sh",
        "scripts/tests/**/*.sh",
        "tests/**/*.sh",
    ]

    found_paths: set[Path] = set()

    for pattern in patterns:
        for path_str in glob.glob(str(project_root / pattern), recursive=True):
            path = Path(path_str)
            # Skip archived tests by default (they'll be in "Archived" category)
            found_paths.add(path)

    # Create test objects and categorize
    for path in sorted(found_paths):
        category_name = categorize_test(path, project_root)
        description = extract_description(path)

        test = TestScript(
            path=path,
            name=path.name,
            category=category_name,
            description=description,
        )

        if category_name not in categories:
            categories[category_name] = TestCategory(name=category_name)

        categories[category_name].tests.append(test)

    # Sort tests within each category
    for cat in categories.values():
        cat.tests.sort(key=lambda t: t.name)

    return categories


class TestRunner:
    """Runs tests and captures output."""

    def __init__(self) -> None:
        self.running = False
        self.current_test: TestScript | None = None
        self._thread: threading.Thread | None = None

    def run_test(
        self,
        test: TestScript,
        on_complete: Callable[[TestScript], None] | None = None,
    ) -> None:
        """Run a single test in a background thread."""
        if self.running:
            return

        self.running = True
        self.current_test = test
        test.status = "running"
        test.output = ""

        def _run() -> None:
            start_time = time.time()
            try:
                result = subprocess.run(
                    [str(test.path)],
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5 minute timeout
                    cwd=test.path.parent,
                )
                test.output = result.stdout + result.stderr
                test.status = "passed" if result.returncode == 0 else "failed"
            except subprocess.TimeoutExpired:
                test.output = "Test timed out after 5 minutes"
                test.status = "failed"
            except Exception as e:
                test.output = f"Error running test: {e}"
                test.status = "failed"
            finally:
                test.duration = time.time() - start_time
                self.running = False
                self.current_test = None
                if on_complete:
                    on_complete(test)

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop current test (best effort)."""
        self.running = False


class TestingTUI:
    """Main TUI application."""

    def __init__(self, stdscr: curses.window) -> None:
        self.stdscr = stdscr
        self.project_root = get_project_root()
        self.categories = discover_tests(self.project_root)
        self.runner = TestRunner()

        # UI state
        self.mode = ViewMode.TREE
        self.selected_idx = 0
        self.scroll_offset = 0
        self.search_query = ""
        self.search_mode = False
        self.log_scroll = 0
        self.selected_test: TestScript | None = None
        self.message = ""
        self.message_time = 0.0

        # Build flat list for navigation
        self._build_display_list()

        # Setup colors
        self._setup_colors()

        # Setup curses
        curses.curs_set(0)
        self.stdscr.nodelay(True)
        self.stdscr.timeout(100)

    def _setup_colors(self) -> None:
        """Initialize color pairs."""
        curses.start_color()
        curses.use_default_colors()

        curses.init_pair(Colors.HEADER, curses.COLOR_WHITE, curses.COLOR_BLUE)
        curses.init_pair(Colors.SELECTED, curses.COLOR_BLACK, curses.COLOR_CYAN)
        curses.init_pair(Colors.PASSED, curses.COLOR_GREEN, -1)
        curses.init_pair(Colors.FAILED, curses.COLOR_RED, -1)
        curses.init_pair(Colors.RUNNING, curses.COLOR_YELLOW, -1)
        curses.init_pair(Colors.CATEGORY, curses.COLOR_CYAN, -1)
        curses.init_pair(Colors.HELP, curses.COLOR_WHITE, -1)
        curses.init_pair(Colors.STATUS_BAR, curses.COLOR_BLACK, curses.COLOR_WHITE)

    def _build_display_list(self) -> None:
        """Build flat list of items for display."""
        self.display_items: list[tuple[str, TestCategory | TestScript | None]] = []

        # Sort categories, but put "Archived" last
        sorted_cats = sorted(
            self.categories.keys(),
            key=lambda c: (c == "Archived", c),
        )

        for cat_name in sorted_cats:
            cat = self.categories[cat_name]

            # Filter by search if active
            if self.search_query:
                matching_tests = [
                    t for t in cat.tests
                    if self.search_query.lower() in t.name.lower()
                    or self.search_query.lower() in t.description.lower()
                ]
                if not matching_tests:
                    continue
            else:
                matching_tests = cat.tests

            self.display_items.append(("category", cat))

            if cat.expanded:
                for test in matching_tests:
                    self.display_items.append(("test", test))

    def _get_status_symbol(self, status: str) -> tuple[str, int]:
        """Get symbol and color for test status."""
        symbols = {
            "pending": ("○", Colors.DEFAULT),
            "running": ("◐", Colors.RUNNING),
            "passed": ("✓", Colors.PASSED),
            "failed": ("✗", Colors.FAILED),
            "skipped": ("◌", Colors.DEFAULT),
        }
        return symbols.get(status, ("?", Colors.DEFAULT))

    def _draw_header(self) -> None:
        """Draw the header bar."""
        height, width = self.stdscr.getmaxyx()
        title = " VibeCode Testing TUI "
        mode_text = f" [{self.mode.name}] "

        # Draw header bar
        self.stdscr.attron(curses.color_pair(Colors.HEADER) | curses.A_BOLD)
        self.stdscr.addstr(0, 0, " " * width)
        self.stdscr.addstr(0, 2, title)
        self.stdscr.addstr(0, width - len(mode_text) - 2, mode_text)
        self.stdscr.attroff(curses.color_pair(Colors.HEADER) | curses.A_BOLD)

    def _draw_status_bar(self) -> None:
        """Draw the status bar at the bottom."""
        height, width = self.stdscr.getmaxyx()

        # Count tests by status
        total = sum(len(c.tests) for c in self.categories.values())
        passed = sum(
            1 for c in self.categories.values()
            for t in c.tests if t.status == "passed"
        )
        failed = sum(
            1 for c in self.categories.values()
            for t in c.tests if t.status == "failed"
        )

        if self.search_mode:
            status = f" Search: {self.search_query}_ "
        elif self.runner.running:
            status = f" Running: {self.runner.current_test.name if self.runner.current_test else '...'} "
        elif self.message and time.time() - self.message_time < 3:
            status = f" {self.message} "
        else:
            status = f" Tests: {total} | Passed: {passed} | Failed: {failed} "

        help_text = " [h]elp [q]uit "

        self.stdscr.attron(curses.color_pair(Colors.STATUS_BAR))
        self.stdscr.addstr(height - 1, 0, " " * width)
        self.stdscr.addstr(height - 1, 0, status[:width - len(help_text) - 1])
        self.stdscr.addstr(height - 1, width - len(help_text), help_text)
        self.stdscr.attroff(curses.color_pair(Colors.STATUS_BAR))

    def _draw_tree_view(self) -> None:
        """Draw the test tree view."""
        height, width = self.stdscr.getmaxyx()
        start_y = 2
        end_y = height - 2
        visible_lines = end_y - start_y

        # Adjust scroll offset
        if self.selected_idx < self.scroll_offset:
            self.scroll_offset = self.selected_idx
        elif self.selected_idx >= self.scroll_offset + visible_lines:
            self.scroll_offset = self.selected_idx - visible_lines + 1

        for i, (item_type, item) in enumerate(self.display_items):
            if i < self.scroll_offset:
                continue
            if i >= self.scroll_offset + visible_lines:
                break

            y = start_y + (i - self.scroll_offset)
            is_selected = i == self.selected_idx

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))

            if item_type == "category":
                cat = item
                arrow = "▼" if cat.expanded else "▶"
                count = len(cat.tests)
                passed = sum(1 for t in cat.tests if t.status == "passed")
                failed = sum(1 for t in cat.tests if t.status == "failed")

                if not is_selected:
                    self.stdscr.attron(curses.color_pair(Colors.CATEGORY) | curses.A_BOLD)

                line = f" {arrow} {cat.name} ({count} tests"
                if passed > 0:
                    line += f", {passed} passed"
                if failed > 0:
                    line += f", {failed} failed"
                line += ")"

                self.stdscr.addstr(y, 0, line[:width - 1].ljust(width - 1))

                if not is_selected:
                    self.stdscr.attroff(curses.color_pair(Colors.CATEGORY) | curses.A_BOLD)

            elif item_type == "test":
                test = item
                symbol, color = self._get_status_symbol(test.status)

                if not is_selected:
                    self.stdscr.attron(curses.color_pair(color))

                # Format: "   ○ test-name.sh - Description"
                name_part = f"   {symbol} {test.name}"
                if test.description:
                    desc_width = width - len(name_part) - 5
                    if desc_width > 10:
                        desc = test.description[:desc_width]
                        line = f"{name_part} - {desc}"
                    else:
                        line = name_part
                else:
                    line = name_part

                if test.duration > 0:
                    duration_str = f" ({test.duration:.1f}s)"
                    if len(line) + len(duration_str) < width - 1:
                        line += duration_str

                self.stdscr.addstr(y, 0, line[:width - 1].ljust(width - 1))

                if not is_selected:
                    self.stdscr.attroff(curses.color_pair(color))

            if is_selected:
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))

        # Draw scrollbar if needed
        if len(self.display_items) > visible_lines:
            scrollbar_height = max(1, visible_lines * visible_lines // len(self.display_items))
            scrollbar_pos = self.scroll_offset * (visible_lines - scrollbar_height) // max(1, len(self.display_items) - visible_lines)
            for y in range(start_y, end_y):
                char = "█" if start_y + scrollbar_pos <= y < start_y + scrollbar_pos + scrollbar_height else "│"
                self.stdscr.addstr(y, width - 1, char)

    def _draw_results_view(self) -> None:
        """Draw test results summary."""
        height, width = self.stdscr.getmaxyx()
        y = 2

        self.stdscr.addstr(y, 2, "Test Results Summary", curses.A_BOLD)
        y += 2

        # Draw results table
        headers = ["Category", "Total", "Pass", "Fail", "Skip"]
        col_widths = [25, 8, 8, 8, 8]

        # Header row
        x = 2
        for header, col_width in zip(headers, col_widths):
            self.stdscr.addstr(y, x, header.ljust(col_width), curses.A_BOLD)
            x += col_width
        y += 1

        # Separator
        self.stdscr.addstr(y, 2, "─" * sum(col_widths))
        y += 1

        # Data rows
        sorted_cats = sorted(
            self.categories.keys(),
            key=lambda c: (c == "Archived", c),
        )

        for cat_name in sorted_cats:
            if y >= height - 3:
                break

            cat = self.categories[cat_name]
            total = len(cat.tests)
            passed = sum(1 for t in cat.tests if t.status == "passed")
            failed = sum(1 for t in cat.tests if t.status == "failed")
            skipped = sum(1 for t in cat.tests if t.status == "skipped")

            x = 2
            self.stdscr.addstr(y, x, cat_name[:col_widths[0] - 1].ljust(col_widths[0]))
            x += col_widths[0]
            self.stdscr.addstr(y, x, str(total).ljust(col_widths[1]))
            x += col_widths[1]

            if passed > 0:
                self.stdscr.attron(curses.color_pair(Colors.PASSED))
            self.stdscr.addstr(y, x, str(passed).ljust(col_widths[2]))
            if passed > 0:
                self.stdscr.attroff(curses.color_pair(Colors.PASSED))
            x += col_widths[2]

            if failed > 0:
                self.stdscr.attron(curses.color_pair(Colors.FAILED))
            self.stdscr.addstr(y, x, str(failed).ljust(col_widths[3]))
            if failed > 0:
                self.stdscr.attroff(curses.color_pair(Colors.FAILED))
            x += col_widths[3]

            self.stdscr.addstr(y, x, str(skipped).ljust(col_widths[4]))
            y += 1

    def _draw_log_view(self) -> None:
        """Draw log output for selected test."""
        height, width = self.stdscr.getmaxyx()

        if not self.selected_test:
            self.stdscr.addstr(2, 2, "No test selected. Press 'l' on a test to view logs.")
            return

        # Header
        self.stdscr.addstr(2, 2, f"Log: {self.selected_test.name}", curses.A_BOLD)
        symbol, color = self._get_status_symbol(self.selected_test.status)
        self.stdscr.attron(curses.color_pair(color))
        self.stdscr.addstr(2, 6 + len(self.selected_test.name), f" [{symbol} {self.selected_test.status}]")
        self.stdscr.attroff(curses.color_pair(color))

        if self.selected_test.duration > 0:
            self.stdscr.addstr(2, width - 15, f"Duration: {self.selected_test.duration:.1f}s")

        # Path
        self.stdscr.addstr(3, 2, f"Path: {self.selected_test.path}", curses.A_DIM)

        # Log content
        if not self.selected_test.output:
            self.stdscr.addstr(5, 2, "No output yet. Run the test first.")
            return

        lines = self.selected_test.output.split("\n")
        start_y = 5
        end_y = height - 2
        visible_lines = end_y - start_y

        # Adjust scroll
        max_scroll = max(0, len(lines) - visible_lines)
        self.log_scroll = max(0, min(self.log_scroll, max_scroll))

        for i, line in enumerate(lines[self.log_scroll:]):
            y = start_y + i
            if y >= end_y:
                break

            # Highlight errors
            if "error" in line.lower() or "fail" in line.lower() or "❌" in line:
                self.stdscr.attron(curses.color_pair(Colors.FAILED))
                self.stdscr.addstr(y, 2, line[:width - 4])
                self.stdscr.attroff(curses.color_pair(Colors.FAILED))
            elif "pass" in line.lower() or "success" in line.lower() or "✅" in line or "✓" in line:
                self.stdscr.attron(curses.color_pair(Colors.PASSED))
                self.stdscr.addstr(y, 2, line[:width - 4])
                self.stdscr.attroff(curses.color_pair(Colors.PASSED))
            else:
                self.stdscr.addstr(y, 2, line[:width - 4])

    def _draw_help_view(self) -> None:
        """Draw help screen."""
        height, width = self.stdscr.getmaxyx()

        help_text = """
 VibeCode Testing TUI - Help
 ═══════════════════════════

 Navigation
 ──────────
   ↑/k       Move up
   ↓/j       Move down
   Enter     Toggle category / Run test
   Space     Select/deselect test

 Actions
 ───────
   r         Run selected test
   R         Run all tests in category
   a         Run ALL tests
   s         Stop running test
   c         Clear all results

 Views
 ─────
   t         Tree view (default)
   v         Results view
   l         Log view for selected test
   h/?       This help screen

 Search
 ──────
   /         Start search
   Esc       Cancel search
   n         Next search result

 Other
 ─────
   q         Quit
   Ctrl+C    Force quit

 Press any key to return...
"""

        lines = help_text.strip().split("\n")
        start_y = 1
        for i, line in enumerate(lines):
            if start_y + i >= height - 1:
                break
            self.stdscr.addstr(start_y + i, 2, line[:width - 4])

    def _set_message(self, msg: str) -> None:
        """Set a temporary status message."""
        self.message = msg
        self.message_time = time.time()

    def _run_selected_test(self) -> None:
        """Run the currently selected test."""
        if self.selected_idx >= len(self.display_items):
            return

        item_type, item = self.display_items[self.selected_idx]
        if item_type != "test":
            return

        test = item
        self.selected_test = test

        def on_complete(t: TestScript) -> None:
            self._set_message(f"{t.name}: {t.status}")

        self.runner.run_test(test, on_complete)
        self._set_message(f"Running {test.name}...")

    def _run_category_tests(self) -> None:
        """Run all tests in the selected category."""
        if self.selected_idx >= len(self.display_items):
            return

        item_type, item = self.display_items[self.selected_idx]

        # Find the category
        if item_type == "category":
            cat = item
        elif item_type == "test":
            # Find parent category
            for i in range(self.selected_idx, -1, -1):
                t, it = self.display_items[i]
                if t == "category":
                    cat = it
                    break
            else:
                return
        else:
            return

        self._set_message(f"Running {len(cat.tests)} tests in {cat.name}...")

        # Queue all tests (simplified - runs sequentially)
        for test in cat.tests:
            test.status = "pending"

        # Start first test
        if cat.tests:
            self.runner.run_test(cat.tests[0])

    def _toggle_category(self) -> None:
        """Toggle category expansion."""
        if self.selected_idx >= len(self.display_items):
            return

        item_type, item = self.display_items[self.selected_idx]
        if item_type == "category":
            item.expanded = not item.expanded
            self._build_display_list()

    def _clear_results(self) -> None:
        """Clear all test results."""
        for cat in self.categories.values():
            for test in cat.tests:
                test.status = "pending"
                test.output = ""
                test.duration = 0.0
        self._set_message("Results cleared")

    def draw(self) -> None:
        """Draw the full UI."""
        self.stdscr.clear()

        self._draw_header()

        if self.mode == ViewMode.TREE:
            self._draw_tree_view()
        elif self.mode == ViewMode.RESULTS:
            self._draw_results_view()
        elif self.mode == ViewMode.LOG:
            self._draw_log_view()
        elif self.mode == ViewMode.HELP:
            self._draw_help_view()

        self._draw_status_bar()

        self.stdscr.refresh()

    def handle_input(self, key: int) -> bool:
        """Handle keyboard input. Returns False to quit."""
        if self.search_mode:
            if key == 27:  # Escape
                self.search_mode = False
                self.search_query = ""
                self._build_display_list()
            elif key == 10:  # Enter
                self.search_mode = False
            elif key == curses.KEY_BACKSPACE or key == 127:
                self.search_query = self.search_query[:-1]
                self._build_display_list()
                self.selected_idx = 0
            elif 32 <= key <= 126:  # Printable characters
                self.search_query += chr(key)
                self._build_display_list()
                self.selected_idx = 0
            return True

        # Help view - any key returns
        if self.mode == ViewMode.HELP:
            if key != -1:
                self.mode = ViewMode.TREE
            return True

        # Navigation
        if key == curses.KEY_UP or key == ord("k"):
            self.selected_idx = max(0, self.selected_idx - 1)
        elif key == curses.KEY_DOWN or key == ord("j"):
            self.selected_idx = min(len(self.display_items) - 1, self.selected_idx + 1)
        elif key == curses.KEY_PPAGE:  # Page up
            self.selected_idx = max(0, self.selected_idx - 10)
        elif key == curses.KEY_NPAGE:  # Page down
            self.selected_idx = min(len(self.display_items) - 1, self.selected_idx + 10)
        elif key == ord("g"):  # Go to top
            self.selected_idx = 0
        elif key == ord("G"):  # Go to bottom
            self.selected_idx = len(self.display_items) - 1

        # Log view scrolling
        elif key == curses.KEY_LEFT and self.mode == ViewMode.LOG:
            self.log_scroll = max(0, self.log_scroll - 5)
        elif key == curses.KEY_RIGHT and self.mode == ViewMode.LOG:
            self.log_scroll += 5

        # Actions
        elif key == 10:  # Enter
            if self.mode == ViewMode.TREE:
                item_type, _ = self.display_items[self.selected_idx] if self.display_items else (None, None)
                if item_type == "category":
                    self._toggle_category()
                elif item_type == "test":
                    self._run_selected_test()

        elif key == ord("r"):
            self._run_selected_test()

        elif key == ord("R"):
            self._run_category_tests()

        elif key == ord("s"):
            self.runner.stop()
            self._set_message("Stopping test...")

        elif key == ord("c"):
            self._clear_results()

        # View switching
        elif key == ord("t"):
            self.mode = ViewMode.TREE
        elif key == ord("v"):
            self.mode = ViewMode.RESULTS
        elif key == ord("l"):
            if self.display_items and self.selected_idx < len(self.display_items):
                item_type, item = self.display_items[self.selected_idx]
                if item_type == "test":
                    self.selected_test = item
            self.mode = ViewMode.LOG
            self.log_scroll = 0
        elif key == ord("h") or key == ord("?"):
            self.mode = ViewMode.HELP

        # Search
        elif key == ord("/"):
            self.search_mode = True
            self.search_query = ""

        # Quit
        elif key == ord("q"):
            return False

        return True

    def run(self) -> None:
        """Main event loop."""
        running = True
        while running:
            self.draw()
            try:
                key = self.stdscr.getch()
                running = self.handle_input(key)
            except KeyboardInterrupt:
                running = False


def main_curses(stdscr: curses.window) -> int:
    """Main function wrapped for curses."""
    tui = TestingTUI(stdscr)
    tui.run()
    return 0


def run_headless(args: list[str]) -> int:
    """Run tests without TUI (for CI/automation)."""
    project_root = get_project_root()
    categories = discover_tests(project_root)

    # Parse arguments
    run_all = "--all" in args or "-a" in args
    category_filter = None
    test_filter = None

    for i, arg in enumerate(args):
        if arg in ("--category", "-c") and i + 1 < len(args):
            category_filter = args[i + 1]
        elif arg in ("--test", "-t") and i + 1 < len(args):
            test_filter = args[i + 1]

    # Collect tests to run
    tests_to_run: list[TestScript] = []

    for cat_name, cat in categories.items():
        if category_filter and category_filter.lower() not in cat_name.lower():
            continue
        for test in cat.tests:
            if test_filter and test_filter.lower() not in test.name.lower():
                continue
            if run_all or category_filter or test_filter:
                tests_to_run.append(test)

    if not tests_to_run:
        if run_all:
            tests_to_run = [t for c in categories.values() for t in c.tests]
        else:
            print("Usage: testing_tui.py [options]")
            print()
            print("Options:")
            print("  --all, -a           Run all tests")
            print("  --category, -c CAT  Run tests in category")
            print("  --test, -t NAME     Run tests matching name")
            print("  --list, -l          List all tests")
            print()
            print("Without options, launches the TUI.")
            return 0

    # List mode
    if "--list" in args or "-l" in args:
        for cat_name, cat in sorted(categories.items()):
            print(f"\n{cat_name} ({len(cat.tests)} tests)")
            print("─" * 40)
            for test in cat.tests:
                print(f"  {test.name}")
                if test.description:
                    print(f"    {test.description}")
        return 0

    # Run tests
    print(f"\nRunning {len(tests_to_run)} tests...\n")
    passed = 0
    failed = 0

    for test in tests_to_run:
        print(f"Running: {test.name}...", end=" ", flush=True)
        start = time.time()

        try:
            result = subprocess.run(
                [str(test.path)],
                capture_output=True,
                text=True,
                timeout=300,
                cwd=test.path.parent,
            )
            duration = time.time() - start

            if result.returncode == 0:
                print(f"✓ PASSED ({duration:.1f}s)")
                passed += 1
            else:
                print(f"✗ FAILED ({duration:.1f}s)")
                failed += 1
                if result.stderr:
                    print(f"    Error: {result.stderr[:200]}")

        except subprocess.TimeoutExpired:
            print("✗ TIMEOUT")
            failed += 1
        except Exception as e:
            print(f"✗ ERROR: {e}")
            failed += 1

    print(f"\n{'═' * 40}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'═' * 40}")

    return 0 if failed == 0 else 1


def main() -> int:
    """Main entry point."""
    args = sys.argv[1:]

    # Check for headless mode
    headless_flags = {"--all", "-a", "--category", "-c", "--test", "-t", "--list", "-l", "--help", "-h"}
    if any(arg in headless_flags for arg in args):
        return run_headless(args)

    # Check if terminal supports curses
    if not sys.stdout.isatty():
        print("Error: TUI requires a terminal. Use --help for headless options.")
        return 1

    try:
        return curses.wrapper(main_curses)
    except curses.error as e:
        print(f"Error initializing TUI: {e}")
        print("Try running with --help for headless options.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
