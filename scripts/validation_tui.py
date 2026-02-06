#!/usr/bin/env python3
"""TUI for running validation and verification scripts.

A terminal user interface for discovering, categorizing, and running
validation and verification scripts across different categories.
"""

from __future__ import annotations

import curses
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional


class Category(Enum):
    """Validation script categories."""

    CONFIG = "config"
    DATABASE = "database"
    DOCKER = "docker"
    MONITORING = "monitoring"
    SECURITY = "security"
    DEPLOYMENT = "deployment"
    INFRASTRUCTURE = "infrastructure"
    OTHER = "other"


@dataclass
class ValidationScript:
    """Represents a validation or verification script."""

    path: Path
    name: str
    description: str = ""
    category: Category = Category.OTHER
    script_type: str = "validate"  # validate, verify, check
    last_run: Optional[datetime] = None
    run_time: float = 0.0
    status: str = "pending"  # pending, running, passed, failed, warning


@dataclass
class ValidationResult:
    """Result from running a validation."""

    script_name: str
    category: Category
    script_type: str
    timestamp: datetime
    duration: float
    exit_code: int
    output: str
    passed: bool
    warnings: int = 0


@dataclass
class TUIState:
    """State for the TUI."""

    scripts: list[ValidationScript] = field(default_factory=list)
    results: list[ValidationResult] = field(default_factory=list)
    selected_index: int = 0
    scroll_offset: int = 0
    mode: str = "main"  # main, running, results, category_filter, summary, help
    running_script: Optional[ValidationScript] = None
    output_lines: list[str] = field(default_factory=list)
    status_message: str = ""
    category_filter: Optional[Category] = None
    run_all_in_progress: bool = False
    total_passed: int = 0
    total_failed: int = 0
    total_warnings: int = 0


# Category detection patterns
CATEGORY_PATTERNS = {
    Category.CONFIG: [r"config", r"env", r"setup", r"helm", r"cloud-init"],
    Category.DATABASE: [r"database", r"postgres", r"db", r"dbm", r"migration"],
    Category.DOCKER: [r"docker", r"dockerfile", r"container", r"image"],
    Category.MONITORING: [r"datadog", r"metric", r"health", r"observ", r"apm", r"llm"],
    Category.SECURITY: [r"license", r"gpl", r"security", r"ssl", r"dns"],
    Category.DEPLOYMENT: [r"deploy", r"workflow", r"readiness"],
    Category.INFRASTRUCTURE: [r"arm64", r"armv7", r"kernel", r"service", r"vfkit", r"vz"],
}


def detect_category(script_name: str, description: str) -> Category:
    """Detect the category from script name and description."""
    text = f"{script_name} {description}".lower()

    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text):
                return category

    return Category.OTHER


def detect_script_type(script_name: str) -> str:
    """Detect whether script is validate, verify, or check."""
    name_lower = script_name.lower()
    if "verify" in name_lower:
        return "verify"
    elif "check" in name_lower:
        return "check"
    return "validate"


def get_script_description(script_path: Path) -> str:
    """Extract description from script header comments."""
    try:
        content = script_path.read_text()
        lines = content.split("\n")
        for line in lines[1:15]:
            line = line.strip()
            if line.startswith("#") and not line.startswith("#!"):
                desc = line.lstrip("#").strip()
                if desc and len(desc) > 5 and not desc.startswith("shellcheck"):
                    return desc[:70]
        return script_path.stem.replace("-", " ").replace("_", " ").title()
    except OSError:
        return "Unknown"


def discover_validations(scripts_dir: Path) -> list[ValidationScript]:
    """Discover all validation and verification scripts."""
    scripts = []
    found_paths = set()

    # Patterns to find validation scripts
    patterns = [
        ("validate*.sh", "validate"),
        ("verify*.sh", "verify"),
        ("check*.sh", "check"),
    ]

    # Search in main scripts directory
    for pattern, script_type in patterns:
        for script_path in scripts_dir.glob(pattern):
            if script_path.is_file() and script_path not in found_paths:
                found_paths.add(script_path)
                description = get_script_description(script_path)
                category = detect_category(script_path.stem, description)

                scripts.append(ValidationScript(
                    path=script_path,
                    name=script_path.stem,
                    description=description,
                    category=category,
                    script_type=script_type,
                ))

    # Search in subdirectories
    subdirs = ["benchmarks", "vfkit", "vz", "vibecode-cli", "vibecode-cli-lib", "tests"]
    for subdir in subdirs:
        subdir_path = scripts_dir / subdir
        if subdir_path.exists():
            for pattern, script_type in patterns:
                for script_path in subdir_path.glob(pattern):
                    if script_path.is_file() and script_path not in found_paths:
                        found_paths.add(script_path)
                        description = get_script_description(script_path)
                        category = detect_category(script_path.stem, description)

                        scripts.append(ValidationScript(
                            path=script_path,
                            name=f"{subdir}/{script_path.stem}",
                            description=description,
                            category=category,
                            script_type=script_type,
                        ))

    return sorted(scripts, key=lambda s: (s.category.value, s.script_type, s.name))


def count_warnings_in_output(output: str) -> int:
    """Count warning indicators in output."""
    # Use \[WARN\] (exact match) instead of \[WARN to avoid double-counting [WARNING]
    warning_patterns = [r"⚠️", r"\[WARN\]", r"\[WARNING\]?", r"warning:", r"WARN:"]
    count = 0
    for pattern in warning_patterns:
        count += len(re.findall(pattern, output, re.IGNORECASE))
    return count


def run_validation(
    script: ValidationScript,
    output_callback: callable,
) -> ValidationResult:
    """Run a validation script."""
    script.status = "running"
    start_time = time.time()
    output_lines = []

    run_env = os.environ.copy()
    run_env["TERM"] = "dumb"

    try:
        process = subprocess.Popen(
            ["bash", str(script.path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=script.path.parent.parent if "/" in script.name else script.path.parent,
            env=run_env,
        )

        for line in iter(process.stdout.readline, ""):
            output_lines.append(line.rstrip())
            output_callback(line.rstrip())

        process.wait()
        exit_code = process.returncode
        passed = exit_code == 0

    except OSError as e:
        output_lines.append(f"Error: {e}")
        exit_code = 1
        passed = False

    duration = time.time() - start_time
    output_text = "\n".join(output_lines)
    warnings = count_warnings_in_output(output_text)

    if passed and warnings > 0:
        script.status = "warning"
    elif passed:
        script.status = "passed"
    else:
        script.status = "failed"

    script.last_run = datetime.now()
    script.run_time = duration

    return ValidationResult(
        script_name=script.name,
        category=script.category,
        script_type=script.script_type,
        timestamp=datetime.now(),
        duration=duration,
        exit_code=exit_code,
        output=output_text,
        passed=passed,
        warnings=warnings,
    )


def get_filtered_scripts(state: TUIState) -> list[ValidationScript]:
    """Get scripts filtered by current category filter."""
    if state.category_filter is None:
        return state.scripts
    return [s for s in state.scripts if s.category == state.category_filter]


def get_category_color(category: Category) -> int:
    """Get color pair for category."""
    color_map = {
        Category.CONFIG: 5,         # Green
        Category.DATABASE: 4,       # Yellow
        Category.DOCKER: 1,         # Cyan
        Category.MONITORING: 7,     # Magenta
        Category.SECURITY: 6,       # Red
        Category.DEPLOYMENT: 4,     # Yellow
        Category.INFRASTRUCTURE: 1, # Cyan
        Category.OTHER: 0,          # Default
    }
    return curses.color_pair(color_map.get(category, 0))


def get_type_symbol(script_type: str) -> str:
    """Get symbol for script type."""
    symbols = {
        "validate": "V",
        "verify": "?",
        "check": "C",
    }
    return symbols.get(script_type, "?")


def draw_header(stdscr: curses.window, width: int, state: TUIState) -> None:
    """Draw the header."""
    title = " Validation TUI "
    stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
    stdscr.addstr(0, 0, "=" * width)
    stdscr.addstr(0, (width - len(title)) // 2, title)
    stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)

    # Show current filter
    if state.category_filter:
        filter_text = f" [{state.category_filter.value.upper()}] "
        stdscr.attron(curses.color_pair(4))
        stdscr.addstr(0, width - len(filter_text) - 2, filter_text)
        stdscr.attroff(curses.color_pair(4))


def draw_footer(stdscr: curses.window, height: int, width: int, state: TUIState) -> None:
    """Draw the footer with keybindings."""
    footer_y = height - 1

    if state.mode == "main":
        keys = "[Enter] Run  [a] Run All  [c] Category  [s] Summary  [r] Results  [h] Help  [q] Quit"
    elif state.mode == "running":
        keys = "Running... (output shown above)"
    elif state.mode == "results":
        keys = "[Enter] View  [Esc] Back"
    elif state.mode == "category_filter":
        keys = "[1-8] Select Category  [a] All  [Esc] Cancel"
    elif state.mode == "summary":
        keys = "[Esc] Back"
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
    """Draw the list of validation scripts."""
    filtered_scripts = get_filtered_scripts(state)
    list_height = height - start_y - 2

    filter_text = f" ({state.category_filter.value})" if state.category_filter else ""
    stdscr.addstr(start_y, 2, f"Validations ({len(filtered_scripts)} scripts){filter_text}", curses.A_BOLD)

    visible_scripts = filtered_scripts[state.scroll_offset:state.scroll_offset + list_height]

    for i, script in enumerate(visible_scripts):
        y = start_y + 1 + i
        actual_index = state.scroll_offset + i

        # Status indicator
        if script.status == "running":
            status = "[*]"
            status_color = curses.color_pair(4)
        elif script.status == "passed":
            status = "[+]"
            status_color = curses.color_pair(5)
        elif script.status == "warning":
            status = "[!]"
            status_color = curses.color_pair(4)
        elif script.status == "failed":
            status = "[-]"
            status_color = curses.color_pair(6)
        else:
            status = "[ ]"
            status_color = curses.color_pair(0)

        # Category tag
        cat_tag = f"[{script.category.value[:4].upper()}]"
        cat_color = get_category_color(script.category)

        # Type symbol
        type_sym = get_type_symbol(script.script_type)

        # Selection indicator
        if actual_index == state.selected_index:
            attr = curses.A_REVERSE
        else:
            attr = curses.A_NORMAL

        # Draw line
        stdscr.attron(attr)
        stdscr.addstr(y, 0, " " * (width - 1))
        stdscr.attroff(attr)

        # Draw components
        stdscr.attron(attr | status_color)
        stdscr.addstr(y, 1, status)
        stdscr.attroff(attr | status_color)

        stdscr.attron(attr)
        stdscr.addstr(y, 5, type_sym)
        stdscr.attroff(attr)

        stdscr.attron(attr | cat_color)
        stdscr.addstr(y, 7, cat_tag)
        stdscr.attroff(attr | cat_color)

        stdscr.attron(attr)
        name_width = min(28, width - 45)
        desc_start = 14 + name_width
        stdscr.addstr(y, 14, script.name[:name_width].ljust(name_width))
        if desc_start < width - 5:
            stdscr.addstr(y, desc_start, script.description[:width - desc_start - 2])
        stdscr.attroff(attr)


def draw_running_output(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the running validation output."""
    if state.running_script:
        type_text = state.running_script.script_type.upper()
        stdscr.addstr(start_y, 2, f"Running {type_text}: {state.running_script.name}", curses.A_BOLD)
    else:
        stdscr.addstr(start_y, 2, "Running validations...", curses.A_BOLD)

    output_height = height - start_y - 3
    visible_lines = state.output_lines[-output_height:] if state.output_lines else []

    for i, line in enumerate(visible_lines):
        y = start_y + 1 + i
        if y < height - 2:
            clean_line = re.sub(r'\033\[[0-9;]*m', '', line)
            stdscr.addstr(y, 2, clean_line[:width - 4])


def draw_results(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the results view."""
    stdscr.addstr(start_y, 2, f"Validation History ({len(state.results)} runs)", curses.A_BOLD)

    list_height = height - start_y - 3
    visible_results = state.results[-list_height:] if state.results else []

    for i, result in enumerate(visible_results):
        y = start_y + 1 + i
        if y < height - 2:
            if result.passed and result.warnings == 0:
                status = "[+]"
                status_color = curses.color_pair(5)
            elif result.passed:
                status = "[!]"
                status_color = curses.color_pair(4)
            else:
                status = "[-]"
                status_color = curses.color_pair(6)

            cat_tag = f"[{result.category.value[:4].upper()}]"
            time_str = result.timestamp.strftime("%H:%M:%S")
            duration = f"{result.duration:.1f}s"

            stdscr.attron(status_color)
            stdscr.addstr(y, 2, status)
            stdscr.attroff(status_color)

            stdscr.attron(get_category_color(result.category))
            stdscr.addstr(y, 6, cat_tag)
            stdscr.attroff(get_category_color(result.category))

            stdscr.addstr(y, 13, f"{time_str} {result.script_name:<28} {duration}")


def draw_category_filter(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw category filter selection."""
    stdscr.addstr(start_y, 2, "Select Category Filter:", curses.A_BOLD)

    categories = [
        ("1", Category.CONFIG, "Configuration and setup"),
        ("2", Category.DATABASE, "Database and PostgreSQL"),
        ("3", Category.DOCKER, "Docker and containers"),
        ("4", Category.MONITORING, "Monitoring and observability"),
        ("5", Category.SECURITY, "Security and licenses"),
        ("6", Category.DEPLOYMENT, "Deployment workflows"),
        ("7", Category.INFRASTRUCTURE, "Infrastructure and VMs"),
        ("8", Category.OTHER, "Other validations"),
        ("a", None, "All categories"),
    ]

    for i, (key, category, desc) in enumerate(categories):
        y = start_y + 2 + i
        if y < height - 2:
            cat_name = category.value.upper() if category else "ALL"
            color = get_category_color(category) if category else curses.color_pair(0)

            stdscr.addstr(y, 4, f"[{key}]")
            stdscr.attron(color | curses.A_BOLD)
            stdscr.addstr(y, 9, f"{cat_name:<14}")
            stdscr.attroff(color | curses.A_BOLD)
            stdscr.addstr(y, 24, desc)


def draw_summary(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw validation summary."""
    stdscr.addstr(start_y, 2, "Validation Summary", curses.A_BOLD)

    if not state.results:
        stdscr.addstr(start_y + 2, 4, "No validations have been run yet.")
        return

    # Count by status
    passed = sum(1 for r in state.results if r.passed and r.warnings == 0)
    warnings = sum(1 for r in state.results if r.passed and r.warnings > 0)
    failed = sum(1 for r in state.results if not r.passed)
    total = len(state.results)

    stdscr.addstr(start_y + 2, 4, f"Total runs: {total}")

    stdscr.attron(curses.color_pair(5))
    stdscr.addstr(start_y + 3, 4, f"Passed:     {passed}")
    stdscr.attroff(curses.color_pair(5))

    stdscr.attron(curses.color_pair(4))
    stdscr.addstr(start_y + 4, 4, f"Warnings:   {warnings}")
    stdscr.attroff(curses.color_pair(4))

    stdscr.attron(curses.color_pair(6))
    stdscr.addstr(start_y + 5, 4, f"Failed:     {failed}")
    stdscr.attroff(curses.color_pair(6))

    # Count by category
    stdscr.addstr(start_y + 7, 4, "By Category:", curses.A_BOLD)
    y = start_y + 8

    category_stats: dict[str, dict[str, int]] = {}
    for result in state.results:
        cat_name = result.category.value
        if cat_name not in category_stats:
            category_stats[cat_name] = {"passed": 0, "failed": 0, "warnings": 0}
        if result.passed and result.warnings == 0:
            category_stats[cat_name]["passed"] += 1
        elif result.passed:
            category_stats[cat_name]["warnings"] += 1
        else:
            category_stats[cat_name]["failed"] += 1

    for cat_name, stats in sorted(category_stats.items()):
        if y < height - 2:
            stdscr.addstr(y, 6, f"{cat_name:<14}")
            stdscr.attron(curses.color_pair(5))
            stdscr.addstr(y, 21, f"+{stats['passed']}")
            stdscr.attroff(curses.color_pair(5))
            stdscr.attron(curses.color_pair(4))
            stdscr.addstr(y, 26, f"!{stats['warnings']}")
            stdscr.attroff(curses.color_pair(4))
            stdscr.attron(curses.color_pair(6))
            stdscr.addstr(y, 31, f"-{stats['failed']}")
            stdscr.attroff(curses.color_pair(6))
            y += 1


def draw_help(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw help screen."""
    help_text = [
        "Validation TUI - Help",
        "",
        "Navigation:",
        "  Up/Down, j/k    Move selection",
        "  PgUp/PgDn       Scroll page",
        "  Home/End        Go to first/last",
        "",
        "Actions:",
        "  Enter           Run selected validation",
        "  a               Run ALL validations",
        "  c               Filter by category",
        "  s               Show summary",
        "  r               View history",
        "  h               Show this help",
        "  q               Quit",
        "",
        "Categories:",
        "  [CONF] Config       - Configuration files",
        "  [DATA] Database     - Database validations",
        "  [DOCK] Docker       - Container validations",
        "  [MONI] Monitoring   - Observability checks",
        "  [SECU] Security     - License/security checks",
        "  [DEPL] Deployment   - Deployment workflows",
        "  [INFR] Infrastructure - VM/kernel checks",
        "",
        "Type symbols: V=validate  ?=verify  C=check",
        "Status: [+]=passed  [!]=warning  [-]=failed",
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
    curses.init_pair(4, curses.COLOR_YELLOW, -1)    # Warning
    curses.init_pair(5, curses.COLOR_GREEN, -1)     # Passed
    curses.init_pair(6, curses.COLOR_RED, -1)       # Failed
    curses.init_pair(7, curses.COLOR_MAGENTA, -1)   # Monitoring

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
        elif state.mode == "category_filter":
            draw_category_filter(stdscr, 2, height, width)
        elif state.mode == "summary":
            draw_summary(stdscr, state, 2, height, width)
        elif state.mode == "help":
            draw_help(stdscr, 2, height, width)

        stdscr.refresh()

        try:
            key = stdscr.getch()
        except curses.error:
            continue

        if key == -1:
            continue

        if key == ord("q") and state.mode not in ("running",):
            break

        if state.mode == "main":
            handle_main_keys(stdscr, state, key, height)
        elif state.mode == "running":
            pass  # No interaction during running
        elif state.mode == "results":
            if key == 27:
                state.mode = "main"
        elif state.mode == "category_filter":
            handle_category_filter_keys(state, key)
        elif state.mode == "summary":
            if key == 27:
                state.mode = "main"
        elif state.mode == "help":
            state.mode = "main"


def handle_main_keys(stdscr: curses.window, state: TUIState, key: int, height: int) -> None:
    """Handle keys in main mode."""
    filtered_scripts = get_filtered_scripts(state)
    list_height = height - 5

    if key in (curses.KEY_UP, ord("k")):
        if state.selected_index > 0:
            state.selected_index -= 1
            if state.selected_index < state.scroll_offset:
                state.scroll_offset = state.selected_index
    elif key in (curses.KEY_DOWN, ord("j")):
        if state.selected_index < len(filtered_scripts) - 1:
            state.selected_index += 1
            if state.selected_index >= state.scroll_offset + list_height:
                state.scroll_offset = state.selected_index - list_height + 1
    elif key == curses.KEY_PPAGE:
        state.selected_index = max(0, state.selected_index - list_height)
        state.scroll_offset = max(0, state.scroll_offset - list_height)
    elif key == curses.KEY_NPAGE:
        state.selected_index = min(len(filtered_scripts) - 1, state.selected_index + list_height)
        state.scroll_offset = min(max(0, len(filtered_scripts) - list_height), state.scroll_offset + list_height)
    elif key == curses.KEY_HOME:
        state.selected_index = 0
        state.scroll_offset = 0
    elif key == curses.KEY_END:
        state.selected_index = max(0, len(filtered_scripts) - 1)
        state.scroll_offset = max(0, len(filtered_scripts) - list_height)
    elif key in (curses.KEY_ENTER, 10, 13):
        if filtered_scripts:
            run_single_validation(stdscr, state, filtered_scripts[state.selected_index])
    elif key == ord("a"):
        run_all_validations(stdscr, state)
    elif key == ord("c"):
        state.mode = "category_filter"
    elif key == ord("s"):
        state.mode = "summary"
    elif key == ord("r"):
        state.mode = "results"
    elif key == ord("h"):
        state.mode = "help"


def handle_category_filter_keys(state: TUIState, key: int) -> None:
    """Handle keys in category filter mode."""
    cat_map = {
        ord("1"): Category.CONFIG,
        ord("2"): Category.DATABASE,
        ord("3"): Category.DOCKER,
        ord("4"): Category.MONITORING,
        ord("5"): Category.SECURITY,
        ord("6"): Category.DEPLOYMENT,
        ord("7"): Category.INFRASTRUCTURE,
        ord("8"): Category.OTHER,
        ord("a"): None,
    }

    if key in cat_map:
        state.category_filter = cat_map[key]
        state.selected_index = 0
        state.scroll_offset = 0
        state.mode = "main"
        if state.category_filter:
            state.status_message = f"Filtered: {state.category_filter.value}"
        else:
            state.status_message = "Showing all categories"
    elif key == 27:
        state.mode = "main"


def run_single_validation(stdscr: curses.window, state: TUIState, script: ValidationScript) -> None:
    """Run a single validation."""
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

    result = run_validation(script, output_callback)
    state.results.append(result)

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None

    if result.passed and result.warnings == 0:
        state.status_message = f"{script.name}: PASSED ({result.duration:.1f}s)"
    elif result.passed:
        state.status_message = f"{script.name}: PASSED with {result.warnings} warnings"
    else:
        state.status_message = f"{script.name}: FAILED (exit code {result.exit_code})"


def run_all_validations(stdscr: curses.window, state: TUIState) -> None:
    """Run all validations."""
    filtered_scripts = get_filtered_scripts(state)
    state.mode = "running"
    state.output_lines = []
    state.run_all_in_progress = True

    total = len(filtered_scripts)
    passed = 0
    failed = 0
    warnings = 0

    stdscr.nodelay(True)

    for i, script in enumerate(filtered_scripts):
        state.running_script = script
        state.output_lines.append(f"=== [{i + 1}/{total}] {script.script_type.upper()}: {script.name} ===")

        def output_callback(line: str) -> None:
            state.output_lines.append(line)
            stdscr.clear()
            height, width = stdscr.getmaxyx()
            draw_header(stdscr, width, state)
            draw_footer(stdscr, height, width, state)
            draw_running_output(stdscr, state, 2, height, width)
            stdscr.refresh()

        result = run_validation(script, output_callback)
        state.results.append(result)

        if result.passed and result.warnings == 0:
            passed += 1
            state.output_lines.append(f"=== PASSED ===")
        elif result.passed:
            passed += 1
            warnings += result.warnings
            state.output_lines.append(f"=== PASSED with {result.warnings} warnings ===")
        else:
            failed += 1
            state.output_lines.append(f"=== FAILED ===")

        state.output_lines.append("")

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None
    state.run_all_in_progress = False
    state.total_passed = passed
    state.total_failed = failed
    state.total_warnings = warnings
    state.status_message = f"Complete: {passed} passed, {failed} failed, {warnings} warnings"


def save_results(state: TUIState, output_path: Path) -> None:
    """Save validation results to JSON file."""
    results_data = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total": len(state.results),
            "passed": sum(1 for r in state.results if r.passed),
            "failed": sum(1 for r in state.results if not r.passed),
            "warnings": sum(r.warnings for r in state.results),
        },
        "results": [
            {
                "script": r.script_name,
                "category": r.category.value,
                "type": r.script_type,
                "timestamp": r.timestamp.isoformat(),
                "duration": r.duration,
                "exit_code": r.exit_code,
                "passed": r.passed,
                "warnings": r.warnings,
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
    state.scripts = discover_validations(script_dir)

    if not state.scripts:
        print("No validation scripts found in scripts/")
        print("Looking in:", script_dir)
        return 1

    print(f"Found {len(state.scripts)} validation scripts")

    # Show category breakdown
    cat_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    for script in state.scripts:
        cat_name = script.category.value
        cat_counts[cat_name] = cat_counts.get(cat_name, 0) + 1
        type_counts[script.script_type] = type_counts.get(script.script_type, 0) + 1

    print("By category:")
    for cat_name, count in sorted(cat_counts.items()):
        print(f"  {cat_name}: {count}")

    print("By type:")
    for type_name, count in sorted(type_counts.items()):
        print(f"  {type_name}: {count}")

    print("Starting TUI...")

    try:
        curses.wrapper(lambda stdscr: main_loop(stdscr, state))
    except KeyboardInterrupt:
        pass

    # Save results on exit if any
    if state.results:
        results_path = script_dir.parent / "artifacts" / "validation-results" / f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        save_results(state, results_path)
        print(f"\nResults saved to: {results_path}")

        # Print summary
        passed = sum(1 for r in state.results if r.passed)
        failed = sum(1 for r in state.results if not r.passed)
        print(f"Summary: {passed} passed, {failed} failed")

    return 0


if __name__ == "__main__":
    sys.exit(main())
