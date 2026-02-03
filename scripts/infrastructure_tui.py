#!/usr/bin/env python3
"""TUI for infrastructure management scripts.

A terminal user interface for discovering, categorizing, and running
infrastructure scripts across different cloud providers and environments.
Consolidates scripts/cloud/**, scripts/kind-*.sh, and scripts/aks-*.sh.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

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


class Provider(Enum):
    """Infrastructure provider categories."""

    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    KIND = "kind"
    DOCKER = "docker"
    OTHER = "other"


class Action(Enum):
    """Script action types."""

    START = "start"
    STOP = "stop"
    SETUP = "setup"
    DEPLOY = "deploy"
    CLEANUP = "cleanup"
    STATUS = "status"
    OTHER = "other"


@dataclass
class InfraScript:
    """Represents an infrastructure script."""

    path: Path
    name: str
    description: str = ""
    provider: Provider = Provider.OTHER
    action: Action = Action.OTHER
    last_run: Optional[datetime] = None
    run_time: float = 0.0
    status: str = "pending"  # pending, running, success, failed


@dataclass
class RunResult:
    """Result from running an infrastructure script."""

    script_name: str
    provider: Provider
    action: Action
    timestamp: datetime
    duration: float
    exit_code: int
    output: str
    success: bool


@dataclass
class TUIState:
    """State for the TUI."""

    scripts: list[InfraScript] = field(default_factory=list)
    results: list[RunResult] = field(default_factory=list)
    selected_index: int = 0
    scroll_offset: int = 0
    mode: str = "main"  # main, running, results, provider_filter, summary, help
    running_script: Optional[InfraScript] = None
    output_lines: list[str] = field(default_factory=list)
    status_message: str = ""
    provider_filter: Optional[Provider] = None
    run_all_in_progress: bool = False
    total_success: int = 0
    total_failed: int = 0


# Provider detection patterns
PROVIDER_PATTERNS = {
    Provider.AWS: [r"aws", r"workspace", r"ec2", r"s3"],
    Provider.GCP: [r"gcp", r"gcloud", r"gke"],
    Provider.AZURE: [r"azure", r"aks", r"acr"],
    Provider.KIND: [r"kind", r"cluster"],
    Provider.DOCKER: [r"docker", r"compose", r"container"],
}

# Action detection patterns (order matters - more specific patterns first)
ACTION_PATTERNS = {
    Action.SETUP: [r"setup", r"install", r"configure", r"init", r"bootstrap"],
    Action.CLEANUP: [r"cleanup", r"clean", r"delete", r"destroy"],
    Action.START: [r"start", r"create", r"\bup\b", r"launch"],
    Action.STOP: [r"stop", r"\bdown\b", r"shutdown"],
    Action.DEPLOY: [r"deploy", r"app-deploy"],
    Action.STATUS: [r"status", r"health", r"check", r"env-check"],
}


def detect_provider(script_name: str, script_path: Path) -> Provider:
    """Detect the provider from script name and path."""
    # Check path first for cloud subdirectories
    path_str = str(script_path).lower()
    if "/cloud/aws/" in path_str:
        return Provider.AWS
    elif "/cloud/gcp/" in path_str:
        return Provider.GCP
    elif "/cloud/docker/" in path_str:
        return Provider.DOCKER
    elif "/cloud/kind/" in path_str:
        return Provider.KIND

    # Check script name prefixes
    name_lower = script_name.lower()
    if name_lower.startswith("aks-"):
        return Provider.AZURE
    elif name_lower.startswith("kind-"):
        return Provider.KIND

    # Pattern matching
    for provider, patterns in PROVIDER_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, name_lower):
                return provider

    return Provider.OTHER


def detect_action(script_name: str, description: str) -> Action:
    """Detect the action type from script name and description."""
    text = f"{script_name} {description}".lower()

    for action, patterns in ACTION_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text):
                return action

    return Action.OTHER


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


def discover_scripts(scripts_dir: Path) -> list[InfraScript]:
    """Discover all infrastructure scripts."""
    scripts = []
    found_paths = set()

    # Discover cloud/** scripts
    cloud_dir = scripts_dir / "cloud"
    if cloud_dir.exists():
        for script_path in cloud_dir.glob("**/*.sh"):
            if script_path.is_file() and script_path not in found_paths:
                found_paths.add(script_path)
                # Create relative name from cloud/
                rel_path = script_path.relative_to(cloud_dir)
                name = f"cloud/{rel_path.stem}"
                description = get_script_description(script_path)
                provider = detect_provider(script_path.stem, script_path)
                action = detect_action(script_path.stem, description)

                scripts.append(InfraScript(
                    path=script_path,
                    name=name,
                    description=description,
                    provider=provider,
                    action=action,
                ))

    # Discover kind-*.sh scripts
    for script_path in scripts_dir.glob("kind-*.sh"):
        if script_path.is_file() and script_path not in found_paths:
            found_paths.add(script_path)
            description = get_script_description(script_path)
            action = detect_action(script_path.stem, description)

            scripts.append(InfraScript(
                path=script_path,
                name=script_path.stem,
                description=description,
                provider=Provider.KIND,
                action=action,
            ))

    # Discover aks-*.sh scripts
    for script_path in scripts_dir.glob("aks-*.sh"):
        if script_path.is_file() and script_path not in found_paths:
            found_paths.add(script_path)
            description = get_script_description(script_path)
            action = detect_action(script_path.stem, description)

            scripts.append(InfraScript(
                path=script_path,
                name=script_path.stem,
                description=description,
                provider=Provider.AZURE,
                action=action,
            ))

    return sorted(scripts, key=lambda s: (s.provider.value, s.action.value, s.name))


def run_script(script: InfraScript, output_callback: callable) -> RunResult:
    """Run an infrastructure script."""
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
            cwd=script.path.parent,
            env=run_env,
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
    output_text = "\n".join(output_lines)

    if success:
        script.status = "success"
    else:
        script.status = "failed"

    script.last_run = datetime.now()
    script.run_time = duration

    return RunResult(
        script_name=script.name,
        provider=script.provider,
        action=script.action,
        timestamp=datetime.now(),
        duration=duration,
        exit_code=exit_code,
        output=output_text,
        success=success,
    )


def get_filtered_scripts(state: TUIState) -> list[InfraScript]:
    """Get scripts filtered by current provider filter."""
    if state.provider_filter is None:
        return state.scripts
    return [s for s in state.scripts if s.provider == state.provider_filter]


def get_provider_color(provider: Provider) -> int:
    """Get color pair for provider."""
    color_map = {
        Provider.AWS: 4,       # Yellow (AWS orange-ish)
        Provider.GCP: 1,       # Cyan (Google blue)
        Provider.AZURE: 1,     # Cyan (Azure blue)
        Provider.KIND: 5,      # Green
        Provider.DOCKER: 1,    # Cyan (Docker blue)
        Provider.OTHER: 0,     # Default
    }
    return curses.color_pair(color_map.get(provider, 0))


def get_action_symbol(action: Action) -> str:
    """Get symbol for action type."""
    symbols = {
        Action.START: ">",
        Action.STOP: "#",
        Action.SETUP: "*",
        Action.DEPLOY: "D",
        Action.CLEANUP: "X",
        Action.STATUS: "?",
        Action.OTHER: "-",
    }
    return symbols.get(action, "-")


def draw_header(stdscr: curses.window, width: int, state: TUIState) -> None:
    """Draw the header."""
    title = " Infrastructure TUI "
    stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
    stdscr.addstr(0, 0, "=" * width)
    stdscr.addstr(0, (width - len(title)) // 2, title)
    stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)

    # Show current filter
    if state.provider_filter:
        filter_text = f" [{state.provider_filter.value.upper()}] "
        stdscr.attron(curses.color_pair(4))
        stdscr.addstr(0, width - len(filter_text) - 2, filter_text)
        stdscr.attroff(curses.color_pair(4))


def draw_footer(stdscr: curses.window, height: int, width: int, state: TUIState) -> None:
    """Draw the footer with keybindings."""
    footer_y = height - 1

    if state.mode == "main":
        keys = "[Enter] Run  [a] Run All  [p] Provider  [s] Summary  [r] Results  [h] Help  [q] Quit"
    elif state.mode == "running":
        keys = "Running... (output shown above)"
    elif state.mode == "results":
        keys = "[Enter] View  [Esc] Back"
    elif state.mode == "provider_filter":
        keys = "[1-6] Select Provider  [a] All  [Esc] Cancel"
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
    """Draw the list of infrastructure scripts."""
    filtered_scripts = get_filtered_scripts(state)
    list_height = height - start_y - 2

    filter_text = f" ({state.provider_filter.value})" if state.provider_filter else ""
    stdscr.addstr(start_y, 2, f"Infrastructure Scripts ({len(filtered_scripts)} scripts){filter_text}", curses.A_BOLD)

    visible_scripts = filtered_scripts[state.scroll_offset:state.scroll_offset + list_height]

    for i, script in enumerate(visible_scripts):
        y = start_y + 1 + i
        actual_index = state.scroll_offset + i

        # Status indicator
        if script.status == "running":
            status = "[*]"
            status_color = curses.color_pair(4)
        elif script.status == "success":
            status = "[+]"
            status_color = curses.color_pair(5)
        elif script.status == "failed":
            status = "[-]"
            status_color = curses.color_pair(6)
        else:
            status = "[ ]"
            status_color = curses.color_pair(0)

        # Provider tag
        prov_tag = f"[{script.provider.value[:5].upper()}]"
        prov_color = get_provider_color(script.provider)

        # Action symbol
        action_sym = get_action_symbol(script.action)

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
        stdscr.addstr(y, 5, action_sym)
        stdscr.attroff(attr)

        stdscr.attron(attr | prov_color)
        stdscr.addstr(y, 7, prov_tag)
        stdscr.attroff(attr | prov_color)

        stdscr.attron(attr)
        name_width = min(30, width - 45)
        desc_start = 15 + name_width
        stdscr.addstr(y, 15, script.name[:name_width].ljust(name_width))
        if desc_start < width - 5:
            stdscr.addstr(y, desc_start, script.description[:width - desc_start - 2])
        stdscr.attroff(attr)


def draw_running_output(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the running script output."""
    if state.running_script:
        prov = state.running_script.provider.value.upper()
        stdscr.addstr(start_y, 2, f"Running [{prov}]: {state.running_script.name}", curses.A_BOLD)
    else:
        stdscr.addstr(start_y, 2, "Running infrastructure scripts...", curses.A_BOLD)

    output_height = height - start_y - 3
    visible_lines = state.output_lines[-output_height:] if state.output_lines else []

    for i, line in enumerate(visible_lines):
        y = start_y + 1 + i
        if y < height - 2:
            clean_line = re.sub(r'\033\[[0-9;]*m', '', line)
            stdscr.addstr(y, 2, clean_line[:width - 4])


def draw_results(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the results view."""
    stdscr.addstr(start_y, 2, f"Run History ({len(state.results)} runs)", curses.A_BOLD)

    list_height = height - start_y - 3
    visible_results = state.results[-list_height:] if state.results else []

    for i, result in enumerate(visible_results):
        y = start_y + 1 + i
        if y < height - 2:
            if result.success:
                status = "[+]"
                status_color = curses.color_pair(5)
            else:
                status = "[-]"
                status_color = curses.color_pair(6)

            prov_tag = f"[{result.provider.value[:5].upper()}]"
            time_str = result.timestamp.strftime("%H:%M:%S")
            duration = f"{result.duration:.1f}s"

            stdscr.attron(status_color)
            stdscr.addstr(y, 2, status)
            stdscr.attroff(status_color)

            stdscr.attron(get_provider_color(result.provider))
            stdscr.addstr(y, 6, prov_tag)
            stdscr.attroff(get_provider_color(result.provider))

            stdscr.addstr(y, 14, f"{time_str} {result.script_name:<30} {duration}")


def draw_provider_filter(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw provider filter selection."""
    stdscr.addstr(start_y, 2, "Select Provider Filter:", curses.A_BOLD)

    providers = [
        ("1", Provider.AWS, "Amazon Web Services"),
        ("2", Provider.GCP, "Google Cloud Platform"),
        ("3", Provider.AZURE, "Azure / AKS"),
        ("4", Provider.KIND, "Kind (Kubernetes in Docker)"),
        ("5", Provider.DOCKER, "Docker / Compose"),
        ("6", Provider.OTHER, "Other scripts"),
        ("a", None, "All providers"),
    ]

    for i, (key, provider, desc) in enumerate(providers):
        y = start_y + 2 + i
        if y < height - 2:
            prov_name = provider.value.upper() if provider else "ALL"
            color = get_provider_color(provider) if provider else curses.color_pair(0)

            stdscr.addstr(y, 4, f"[{key}]")
            stdscr.attron(color | curses.A_BOLD)
            stdscr.addstr(y, 9, f"{prov_name:<8}")
            stdscr.attroff(color | curses.A_BOLD)
            stdscr.addstr(y, 18, desc)


def draw_summary(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw infrastructure summary."""
    stdscr.addstr(start_y, 2, "Infrastructure Summary", curses.A_BOLD)

    if not state.results:
        stdscr.addstr(start_y + 2, 4, "No scripts have been run yet.")
        return

    # Count by status
    success = sum(1 for r in state.results if r.success)
    failed = sum(1 for r in state.results if not r.success)
    total = len(state.results)

    stdscr.addstr(start_y + 2, 4, f"Total runs: {total}")

    stdscr.attron(curses.color_pair(5))
    stdscr.addstr(start_y + 3, 4, f"Successful: {success}")
    stdscr.attroff(curses.color_pair(5))

    stdscr.attron(curses.color_pair(6))
    stdscr.addstr(start_y + 4, 4, f"Failed:     {failed}")
    stdscr.attroff(curses.color_pair(6))

    # Count by provider
    stdscr.addstr(start_y + 6, 4, "By Provider:", curses.A_BOLD)
    y = start_y + 7

    provider_stats: dict[str, dict[str, int]] = {}
    for result in state.results:
        prov_name = result.provider.value
        if prov_name not in provider_stats:
            provider_stats[prov_name] = {"success": 0, "failed": 0}
        if result.success:
            provider_stats[prov_name]["success"] += 1
        else:
            provider_stats[prov_name]["failed"] += 1

    for prov_name, stats in sorted(provider_stats.items()):
        if y < height - 2:
            stdscr.addstr(y, 6, f"{prov_name:<8}")
            stdscr.attron(curses.color_pair(5))
            stdscr.addstr(y, 15, f"+{stats['success']}")
            stdscr.attroff(curses.color_pair(5))
            stdscr.attron(curses.color_pair(6))
            stdscr.addstr(y, 20, f"-{stats['failed']}")
            stdscr.attroff(curses.color_pair(6))
            y += 1


def draw_help(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw help screen."""
    help_text = [
        "Infrastructure TUI - Help",
        "",
        "Navigation:",
        "  Up/Down, j/k    Move selection",
        "  PgUp/PgDn       Scroll page",
        "  Home/End        Go to first/last",
        "",
        "Actions:",
        "  Enter           Run selected script",
        "  a               Run ALL scripts",
        "  p               Filter by provider",
        "  s               Show summary",
        "  r               View history",
        "  h               Show this help",
        "  q               Quit",
        "",
        "Providers:",
        "  [AWS]   Amazon Web Services",
        "  [GCP]   Google Cloud Platform",
        "  [AZURE] Microsoft Azure / AKS",
        "  [KIND]  Kubernetes in Docker",
        "  [DOCKE] Docker / Compose",
        "",
        "Action symbols:",
        "  > Start    # Stop    * Setup",
        "  D Deploy   X Cleanup ? Status",
        "",
        "Status: [+]=success [-]=failed",
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
    curses.init_pair(4, curses.COLOR_YELLOW, -1)    # AWS/Warning
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
        elif state.mode == "provider_filter":
            draw_provider_filter(stdscr, 2, height, width)
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
        elif state.mode == "provider_filter":
            handle_provider_filter_keys(state, key)
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
            run_single_script(stdscr, state, filtered_scripts[state.selected_index])
    elif key == ord("a"):
        run_all_scripts(stdscr, state)
    elif key == ord("p"):
        state.mode = "provider_filter"
    elif key == ord("s"):
        state.mode = "summary"
    elif key == ord("r"):
        state.mode = "results"
    elif key == ord("h"):
        state.mode = "help"


def handle_provider_filter_keys(state: TUIState, key: int) -> None:
    """Handle keys in provider filter mode."""
    prov_map = {
        ord("1"): Provider.AWS,
        ord("2"): Provider.GCP,
        ord("3"): Provider.AZURE,
        ord("4"): Provider.KIND,
        ord("5"): Provider.DOCKER,
        ord("6"): Provider.OTHER,
        ord("a"): None,
    }

    if key in prov_map:
        state.provider_filter = prov_map[key]
        state.selected_index = 0
        state.scroll_offset = 0
        state.mode = "main"
        if state.provider_filter:
            state.status_message = f"Filtered: {state.provider_filter.value}"
        else:
            state.status_message = "Showing all providers"
    elif key == 27:
        state.mode = "main"


def run_single_script(stdscr: curses.window, state: TUIState, script: InfraScript) -> None:
    """Run a single infrastructure script."""
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

    result = run_script(script, output_callback)
    state.results.append(result)

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None

    if result.success:
        state.status_message = f"{script.name}: SUCCESS ({result.duration:.1f}s)"
    else:
        state.status_message = f"{script.name}: FAILED (exit code {result.exit_code})"


def run_all_scripts(stdscr: curses.window, state: TUIState) -> None:
    """Run all scripts."""
    filtered_scripts = get_filtered_scripts(state)
    state.mode = "running"
    state.output_lines = []
    state.run_all_in_progress = True

    total = len(filtered_scripts)
    success = 0
    failed = 0

    stdscr.nodelay(True)

    for i, script in enumerate(filtered_scripts):
        state.running_script = script
        prov = script.provider.value.upper()
        state.output_lines.append(f"=== [{i + 1}/{total}] [{prov}] {script.name} ===")

        def output_callback(line: str) -> None:
            state.output_lines.append(line)
            stdscr.clear()
            height, width = stdscr.getmaxyx()
            draw_header(stdscr, width, state)
            draw_footer(stdscr, height, width, state)
            draw_running_output(stdscr, state, 2, height, width)
            stdscr.refresh()

        result = run_script(script, output_callback)
        state.results.append(result)

        if result.success:
            success += 1
            state.output_lines.append("=== SUCCESS ===")
        else:
            failed += 1
            state.output_lines.append("=== FAILED ===")

        state.output_lines.append("")

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None
    state.run_all_in_progress = False
    state.total_success = success
    state.total_failed = failed
    state.status_message = f"Complete: {success} success, {failed} failed"


def save_results(state: TUIState, output_path: Path) -> None:
    """Save run results to JSON file."""
    results_data = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total": len(state.results),
            "success": sum(1 for r in state.results if r.success),
            "failed": sum(1 for r in state.results if not r.success),
        },
        "results": [
            {
                "script": r.script_name,
                "provider": r.provider.value,
                "action": r.action.value,
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
    state.scripts = discover_scripts(script_dir)

    if not state.scripts:
        print("No infrastructure scripts found.")
        print("Looking for: cloud/**/*.sh, kind-*.sh, aks-*.sh")
        print("In directory:", script_dir)
        return 1

    print(f"Found {len(state.scripts)} infrastructure scripts")

    # Show provider breakdown
    prov_counts: dict[str, int] = {}
    action_counts: dict[str, int] = {}
    for script in state.scripts:
        prov_name = script.provider.value
        prov_counts[prov_name] = prov_counts.get(prov_name, 0) + 1
        action_counts[script.action.value] = action_counts.get(script.action.value, 0) + 1

    print("By provider:")
    for prov_name, count in sorted(prov_counts.items()):
        print(f"  {prov_name}: {count}")

    print("By action:")
    for action_name, count in sorted(action_counts.items()):
        print(f"  {action_name}: {count}")

    print("Starting TUI...")

    try:
        curses.wrapper(lambda stdscr: main_loop(stdscr, state))
    except KeyboardInterrupt:
        pass

    # Save results on exit if any
    if state.results:
        results_path = script_dir.parent / "artifacts" / "infrastructure-results" / f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        save_results(state, results_path)
        print(f"\nResults saved to: {results_path}")

        # Print summary
        success = sum(1 for r in state.results if r.success)
        failed = sum(1 for r in state.results if not r.success)
        print(f"Summary: {success} success, {failed} failed")

    return 0


if __name__ == "__main__":
    sys.exit(main())
