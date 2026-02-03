#!/usr/bin/env python3
"""TUI for running deployment scripts.

A terminal user interface for discovering, categorizing, and running
deployment scripts across different environments.
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


class Environment(Enum):
    """Deployment environment types."""

    LOCAL = "local"
    KIND = "kind"
    AZURE = "azure"
    PRODUCTION = "production"
    MONITORING = "monitoring"
    DATABASE = "database"
    OTHER = "other"


@dataclass
class DeploymentScript:
    """Represents a deployment script."""

    path: Path
    name: str
    description: str = ""
    environment: Environment = Environment.OTHER
    last_run: Optional[datetime] = None
    run_time: float = 0.0
    status: str = "pending"  # pending, running, success, failed
    requires_confirmation: bool = False


@dataclass
class DeploymentResult:
    """Result from running a deployment."""

    script_name: str
    environment: Environment
    timestamp: datetime
    duration: float
    exit_code: int
    output: str
    success: bool


@dataclass
class TUIState:
    """State for the TUI."""

    scripts: list[DeploymentScript] = field(default_factory=list)
    results: list[DeploymentResult] = field(default_factory=list)
    selected_index: int = 0
    scroll_offset: int = 0
    mode: str = "main"  # main, running, results, env_filter, confirm, help
    running_script: Optional[DeploymentScript] = None
    output_lines: list[str] = field(default_factory=list)
    status_message: str = ""
    env_filter: Optional[Environment] = None
    pending_script: Optional[DeploymentScript] = None
    env_vars: dict[str, str] = field(default_factory=dict)


# Environment detection patterns
ENV_PATTERNS = {
    Environment.LOCAL: [r"local", r"simple-local", r"dev"],
    Environment.KIND: [r"kind", r"k8s-local"],
    Environment.AZURE: [r"azure", r"aks", r"appservice"],
    Environment.PRODUCTION: [r"production", r"prod", r"deploy-vibecode"],
    Environment.MONITORING: [r"monitoring", r"datadog", r"dbm", r"apm", r"observ"],
    Environment.DATABASE: [r"database", r"postgres", r"migration", r"db"],
}


def detect_environment(script_name: str, description: str) -> Environment:
    """Detect the target environment from script name and description."""
    text = f"{script_name} {description}".lower()

    for env, patterns in ENV_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text):
                return env

    return Environment.OTHER


def get_script_description(script_path: Path) -> str:
    """Extract description from script header comments."""
    try:
        content = script_path.read_text()
        lines = content.split("\n")
        for line in lines[1:15]:  # Check first 15 lines after shebang
            line = line.strip()
            if line.startswith("#") and not line.startswith("#!"):
                desc = line.lstrip("#").strip()
                if desc and len(desc) > 5 and not desc.startswith("shellcheck"):
                    return desc[:70]
        return script_path.stem.replace("-", " ").replace("_", " ").title()
    except OSError:
        return "Unknown"


def is_dangerous_script(script_name: str) -> bool:
    """Check if script requires confirmation before running."""
    dangerous_keywords = [
        "production", "prod", "migrate", "migration", "delete",
        "destroy", "drop", "reset", "all-fixes",
    ]
    name_lower = script_name.lower()
    return any(kw in name_lower for kw in dangerous_keywords)


def discover_deployments(scripts_dir: Path) -> list[DeploymentScript]:
    """Discover all deployment scripts."""
    scripts = []

    # Patterns to find deployment scripts
    patterns = [
        "deploy*.sh",
        "*deploy*.sh",
        "aks-*.sh",
        "tofu-*.sh",
        "production-*.sh",
    ]

    found_paths = set()

    for pattern in patterns:
        for script_path in scripts_dir.glob(pattern):
            if script_path.is_file() and script_path not in found_paths:
                found_paths.add(script_path)
                description = get_script_description(script_path)
                env = detect_environment(script_path.stem, description)

                scripts.append(DeploymentScript(
                    path=script_path,
                    name=script_path.stem,
                    description=description,
                    environment=env,
                    requires_confirmation=is_dangerous_script(script_path.stem),
                ))

    # Also check subdirectories for deploy scripts
    for subdir in ["openindiana", "cloud", "azure"]:
        subdir_path = scripts_dir / subdir
        if subdir_path.exists():
            for script_path in subdir_path.glob("*deploy*.sh"):
                if script_path.is_file() and script_path not in found_paths:
                    found_paths.add(script_path)
                    description = get_script_description(script_path)
                    env = detect_environment(script_path.stem, description)

                    scripts.append(DeploymentScript(
                        path=script_path,
                        name=f"{subdir}/{script_path.stem}",
                        description=description,
                        environment=env,
                        requires_confirmation=is_dangerous_script(script_path.stem),
                    ))

    return sorted(scripts, key=lambda s: (s.environment.value, s.name))


def run_deployment(
    script: DeploymentScript,
    output_callback: callable,
    env_vars: dict[str, str] | None = None,
) -> DeploymentResult:
    """Run a deployment script."""
    script.status = "running"
    start_time = time.time()
    output_lines = []

    # Prepare environment
    run_env = os.environ.copy()
    if env_vars:
        run_env.update(env_vars)
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
        success = exit_code == 0

    except OSError as e:
        output_lines.append(f"Error: {e}")
        exit_code = 1
        success = False

    duration = time.time() - start_time
    script.status = "success" if success else "failed"
    script.last_run = datetime.now()
    script.run_time = duration

    return DeploymentResult(
        script_name=script.name,
        environment=script.environment,
        timestamp=datetime.now(),
        duration=duration,
        exit_code=exit_code,
        output="\n".join(output_lines),
        success=success,
    )


def get_filtered_scripts(state: TUIState) -> list[DeploymentScript]:
    """Get scripts filtered by current environment filter."""
    if state.env_filter is None:
        return state.scripts
    return [s for s in state.scripts if s.environment == state.env_filter]


def draw_header(stdscr: curses.window, width: int, state: TUIState) -> None:
    """Draw the header."""
    title = " Deployment TUI "
    stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
    stdscr.addstr(0, 0, "=" * width)
    stdscr.addstr(0, (width - len(title)) // 2, title)
    stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)

    # Show current filter
    if state.env_filter:
        filter_text = f" [{state.env_filter.value.upper()}] "
        stdscr.attron(curses.color_pair(4))
        stdscr.addstr(0, width - len(filter_text) - 2, filter_text)
        stdscr.attroff(curses.color_pair(4))


def draw_footer(stdscr: curses.window, height: int, width: int, state: TUIState) -> None:
    """Draw the footer with keybindings."""
    footer_y = height - 1

    if state.mode == "main":
        keys = "[Enter] Deploy  [e] Environment  [r] Results  [h] Help  [q] Quit"
    elif state.mode == "running":
        keys = "[Esc] Cancel (if possible)"
    elif state.mode == "results":
        keys = "[Enter] View  [Esc] Back"
    elif state.mode == "env_filter":
        keys = "[1-6] Select Environment  [a] All  [Esc] Cancel"
    elif state.mode == "confirm":
        keys = "[y] Yes, deploy  [n] No, cancel"
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


def get_env_color(env: Environment) -> int:
    """Get color pair for environment."""
    color_map = {
        Environment.LOCAL: 5,      # Green
        Environment.KIND: 4,       # Yellow
        Environment.AZURE: 1,      # Cyan
        Environment.PRODUCTION: 6, # Red
        Environment.MONITORING: 7, # Magenta
        Environment.DATABASE: 4,   # Yellow
        Environment.OTHER: 0,      # Default
    }
    return curses.color_pair(color_map.get(env, 0))


def draw_script_list(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the list of deployment scripts."""
    filtered_scripts = get_filtered_scripts(state)
    list_height = height - start_y - 2

    filter_text = f" ({state.env_filter.value})" if state.env_filter else ""
    stdscr.addstr(start_y, 2, f"Deployments ({len(filtered_scripts)} scripts){filter_text}", curses.A_BOLD)

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

        # Environment tag
        env_tag = f"[{script.environment.value[:4].upper()}]"
        env_color = get_env_color(script.environment)

        # Selection indicator
        if actual_index == state.selected_index:
            attr = curses.A_REVERSE
        else:
            attr = curses.A_NORMAL

        # Warning indicator for dangerous scripts
        warn = "!" if script.requires_confirmation else " "

        # Draw line
        stdscr.attron(attr)
        stdscr.addstr(y, 0, " " * (width - 1))
        stdscr.attroff(attr)

        # Draw components
        stdscr.attron(attr | status_color)
        stdscr.addstr(y, 1, status)
        stdscr.attroff(attr | status_color)

        stdscr.attron(attr | env_color)
        stdscr.addstr(y, 5, env_tag)
        stdscr.attroff(attr | env_color)

        if script.requires_confirmation:
            stdscr.attron(attr | curses.color_pair(6))
            stdscr.addstr(y, 11, warn)
            stdscr.attroff(attr | curses.color_pair(6))

        stdscr.attron(attr)
        name_width = min(25, width - 45)
        desc_start = 13 + name_width
        stdscr.addstr(y, 13, script.name[:name_width].ljust(name_width))
        if desc_start < width - 5:
            stdscr.addstr(y, desc_start, script.description[:width - desc_start - 2])
        stdscr.attroff(attr)


def draw_running_output(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the running deployment output."""
    if state.running_script:
        env_text = f"[{state.running_script.environment.value.upper()}]"
        stdscr.addstr(start_y, 2, f"Deploying: {state.running_script.name} {env_text}", curses.A_BOLD)
    else:
        stdscr.addstr(start_y, 2, "Running deployment...", curses.A_BOLD)

    output_height = height - start_y - 3
    visible_lines = state.output_lines[-output_height:] if state.output_lines else []

    for i, line in enumerate(visible_lines):
        y = start_y + 1 + i
        if y < height - 2:
            # Strip ANSI codes
            clean_line = re.sub(r'\033\[[0-9;]*m', '', line)
            stdscr.addstr(y, 2, clean_line[:width - 4])


def draw_results(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw the results view."""
    stdscr.addstr(start_y, 2, f"Deployment History ({len(state.results)} runs)", curses.A_BOLD)

    list_height = height - start_y - 3
    visible_results = state.results[-list_height:] if state.results else []

    for i, result in enumerate(visible_results):
        y = start_y + 1 + i
        if y < height - 2:
            status = "[+]" if result.success else "[-]"
            status_color = curses.color_pair(5) if result.success else curses.color_pair(6)
            env_tag = f"[{result.environment.value[:4].upper()}]"
            time_str = result.timestamp.strftime("%H:%M:%S")
            duration = f"{result.duration:.1f}s"

            stdscr.attron(status_color)
            stdscr.addstr(y, 2, status)
            stdscr.attroff(status_color)

            stdscr.attron(get_env_color(result.environment))
            stdscr.addstr(y, 6, env_tag)
            stdscr.attroff(get_env_color(result.environment))

            stdscr.addstr(y, 13, f"{time_str} {result.script_name:<25} {duration}")


def draw_env_filter(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw environment filter selection."""
    stdscr.addstr(start_y, 2, "Select Environment Filter:", curses.A_BOLD)

    environments = [
        ("1", Environment.LOCAL, "Local development"),
        ("2", Environment.KIND, "Kind/K8s local cluster"),
        ("3", Environment.AZURE, "Azure cloud"),
        ("4", Environment.PRODUCTION, "Production"),
        ("5", Environment.MONITORING, "Monitoring/Observability"),
        ("6", Environment.DATABASE, "Database/Migrations"),
        ("a", None, "All environments"),
    ]

    for i, (key, env, desc) in enumerate(environments):
        y = start_y + 2 + i
        if y < height - 2:
            env_name = env.value.upper() if env else "ALL"
            color = get_env_color(env) if env else curses.color_pair(0)

            stdscr.addstr(y, 4, f"[{key}]")
            stdscr.attron(color | curses.A_BOLD)
            stdscr.addstr(y, 9, f"{env_name:<12}")
            stdscr.attroff(color | curses.A_BOLD)
            stdscr.addstr(y, 22, desc)


def draw_confirm(stdscr: curses.window, state: TUIState, start_y: int, height: int, width: int) -> None:
    """Draw confirmation dialog."""
    if not state.pending_script:
        return

    stdscr.attron(curses.color_pair(6) | curses.A_BOLD)
    stdscr.addstr(start_y, 2, "CONFIRMATION REQUIRED", curses.A_BOLD)
    stdscr.attroff(curses.color_pair(6) | curses.A_BOLD)

    stdscr.addstr(start_y + 2, 4, f"Script: {state.pending_script.name}")
    stdscr.addstr(start_y + 3, 4, f"Environment: {state.pending_script.environment.value.upper()}")
    stdscr.addstr(start_y + 4, 4, f"Description: {state.pending_script.description}")

    stdscr.attron(curses.color_pair(4))
    stdscr.addstr(start_y + 6, 4, "This deployment may affect production or make irreversible changes.")
    stdscr.attroff(curses.color_pair(4))

    stdscr.addstr(start_y + 8, 4, "Are you sure you want to proceed? [y/n]")


def draw_help(stdscr: curses.window, start_y: int, height: int, width: int) -> None:
    """Draw help screen."""
    help_text = [
        "Deployment TUI - Help",
        "",
        "Navigation:",
        "  Up/Down, j/k    Move selection",
        "  PgUp/PgDn       Scroll page",
        "  Home/End        Go to first/last",
        "",
        "Actions:",
        "  Enter           Run selected deployment",
        "  e               Filter by environment",
        "  r               View deployment history",
        "  h               Show this help",
        "  q               Quit",
        "",
        "Environments:",
        "  [LOCA] Local      - Development environment",
        "  [KIND] Kind       - Local Kubernetes cluster",
        "  [AZUR] Azure      - Azure cloud deployments",
        "  [PROD] Production - Production deployments (!)",
        "  [MONI] Monitoring - Observability stack",
        "  [DATA] Database   - Database migrations",
        "",
        "Symbols:",
        "  [+] Success    [-] Failed    [*] Running",
        "  !   Requires confirmation before running",
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
    curses.init_pair(1, curses.COLOR_CYAN, -1)      # Header/Azure
    curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_WHITE)  # Footer
    curses.init_pair(3, curses.COLOR_YELLOW, -1)    # Status
    curses.init_pair(4, curses.COLOR_YELLOW, -1)    # Running/Kind
    curses.init_pair(5, curses.COLOR_GREEN, -1)     # Success/Local
    curses.init_pair(6, curses.COLOR_RED, -1)       # Failed/Production
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
        elif state.mode == "env_filter":
            draw_env_filter(stdscr, 2, height, width)
        elif state.mode == "confirm":
            draw_confirm(stdscr, state, 2, height, width)
        elif state.mode == "help":
            draw_help(stdscr, 2, height, width)

        stdscr.refresh()

        try:
            key = stdscr.getch()
        except curses.error:
            continue

        if key == -1:
            continue

        # Global quit
        if key == ord("q") and state.mode not in ("running", "confirm"):
            break

        # Mode-specific handling
        if state.mode == "main":
            handle_main_keys(stdscr, state, key, height)
        elif state.mode == "running":
            if key == 27:  # Escape
                state.mode = "main"
                state.status_message = "Deployment may still be running"
        elif state.mode == "results":
            if key == 27:
                state.mode = "main"
        elif state.mode == "env_filter":
            handle_env_filter_keys(state, key)
        elif state.mode == "confirm":
            handle_confirm_keys(stdscr, state, key)
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
            script = filtered_scripts[state.selected_index]
            if script.requires_confirmation:
                state.pending_script = script
                state.mode = "confirm"
            else:
                run_single_deployment(stdscr, state, script)
    elif key == ord("e"):
        state.mode = "env_filter"
    elif key == ord("r"):
        state.mode = "results"
    elif key == ord("h"):
        state.mode = "help"


def handle_env_filter_keys(state: TUIState, key: int) -> None:
    """Handle keys in environment filter mode."""
    env_map = {
        ord("1"): Environment.LOCAL,
        ord("2"): Environment.KIND,
        ord("3"): Environment.AZURE,
        ord("4"): Environment.PRODUCTION,
        ord("5"): Environment.MONITORING,
        ord("6"): Environment.DATABASE,
        ord("a"): None,
    }

    if key in env_map:
        state.env_filter = env_map[key]
        state.selected_index = 0
        state.scroll_offset = 0
        state.mode = "main"
        if state.env_filter:
            state.status_message = f"Filtered: {state.env_filter.value}"
        else:
            state.status_message = "Showing all environments"
    elif key == 27:  # Escape
        state.mode = "main"


def handle_confirm_keys(stdscr: curses.window, state: TUIState, key: int) -> None:
    """Handle keys in confirmation mode."""
    if key in (ord("y"), ord("Y")):
        if state.pending_script:
            run_single_deployment(stdscr, state, state.pending_script)
        state.pending_script = None
    elif key in (ord("n"), ord("N"), 27):  # n or Escape
        state.pending_script = None
        state.mode = "main"
        state.status_message = "Deployment cancelled"


def run_single_deployment(stdscr: curses.window, state: TUIState, script: DeploymentScript) -> None:
    """Run a single deployment."""
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

    result = run_deployment(script, output_callback, state.env_vars)
    state.results.append(result)

    stdscr.nodelay(False)
    state.mode = "main"
    state.running_script = None

    if result.success:
        state.status_message = f"{script.name} completed in {result.duration:.1f}s"
    else:
        state.status_message = f"{script.name} failed (exit code {result.exit_code})"


def save_results(state: TUIState, output_path: Path) -> None:
    """Save deployment results to JSON file."""
    results_data = {
        "timestamp": datetime.now().isoformat(),
        "results": [
            {
                "script": r.script_name,
                "environment": r.environment.value,
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
    state.scripts = discover_deployments(script_dir)

    if not state.scripts:
        print("No deployment scripts found in scripts/")
        print("Looking in:", script_dir)
        return 1

    print(f"Found {len(state.scripts)} deployment scripts")

    # Show environment breakdown
    env_counts: dict[str, int] = {}
    for script in state.scripts:
        env_name = script.environment.value
        env_counts[env_name] = env_counts.get(env_name, 0) + 1

    for env_name, count in sorted(env_counts.items()):
        print(f"  {env_name}: {count}")

    print("Starting TUI...")

    try:
        curses.wrapper(lambda stdscr: main_loop(stdscr, state))
    except KeyboardInterrupt:
        pass

    # Save results on exit if any
    if state.results:
        results_path = script_dir.parent / "artifacts" / "deployment-results" / f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        save_results(state, results_path)
        print(f"\nResults saved to: {results_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
