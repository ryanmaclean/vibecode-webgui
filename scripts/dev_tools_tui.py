#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "dev-tools-tui"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Development Tools TUI - Terminal User Interface for development scripts.

A rich-based TUI consolidating all dev/, desktop/, and dev-tools.sh scripts
into one unified development tools interface.
"""



# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed

  # ddtrace not installed

import os
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, IntPrompt
    from rich.table import Table
    from rich.text import Text
    from rich import box
except ImportError:
    print("Error: rich library is required. Install with: pip install rich")
    sys.exit(1)

class ScriptInfo(NamedTuple):
    """Information about a script."""

    name: str
    path: str
    description: str
    category: str

console = Console()

def get_scripts_dir() -> Path:
    """Get the scripts directory."""
    return Path(__file__).parent.resolve()

# Script definitions organized by category
SCRIPT_DEFINITIONS: dict[str, list[tuple[str, str, str]]] = {
    "Development Commands": [
        ("install", "dev-tools.sh install", "Install project dependencies (pnpm/yarn/npm)"),
        ("lint", "dev-tools.sh lint", "Run linters on the codebase"),
        ("test", "dev-tools.sh test", "Run tests"),
        ("test:watch", "dev-tools.sh test --watch", "Run tests in watch mode"),
        ("test:coverage", "dev-tools.sh test --coverage", "Run tests with coverage report"),
        ("dev", "dev-tools.sh dev", "Start development server"),
        ("build", "dev-tools.sh build", "Create production build"),
        ("migrate", "dev-tools.sh migrate", "Run database migrations (Prisma)"),
        ("check", "dev-tools.sh check", "Run all checks (lint + test + build)"),
    ],
    "IDE & Development Environment": [
        ("start-ide-universal.sh", "dev/start-ide-universal.sh", "Start IDE with auto-detection (vfkit/Lima/host)"),
        ("start-chromium-ide.sh", "dev/start-chromium-ide.sh", "Start Chromium-based IDE kiosk"),
        ("start-openvscode-https.sh", "dev/start-openvscode-https.sh", "Start OpenVSCode Server with HTTPS proxy"),
        ("package-lima-kiosk.sh", "dev/package-lima-kiosk.sh", "Package Lima kiosk as macOS .app bundle"),
    ],
    "Desktop Builds": [
        ("build-all.sh", "desktop/build-all.sh", "Build desktop app for current platform"),
        ("build-macos.sh", "desktop/build-macos.sh", "Build macOS universal binary (.app + .dmg)"),
        ("build-linux.sh", "desktop/build-linux.sh", "Build Linux packages (.deb, .AppImage, .rpm)"),
    ],
}

# Quick action definitions
QUICK_ACTIONS = [
    ("Start Dev Server", "dev-tools.sh dev", "Start the development server"),
    ("Run All Checks", "dev-tools.sh check", "Run lint + test + build"),
    ("Install Dependencies", "dev-tools.sh install", "Install all project dependencies"),
    ("Start IDE", "dev/start-ide-universal.sh", "Launch the development IDE"),
    ("Build for Release", "dev-tools.sh build", "Create production build"),
]

def get_script_path(relative_path: str) -> Path:
    """Get full path for a script."""
    scripts_dir = get_scripts_dir()
    return scripts_dir / relative_path

def check_script_exists(relative_path: str) -> bool:
    """Check if a script exists."""
    # Handle dev-tools.sh commands
    if relative_path.startswith("dev-tools.sh"):
        return get_script_path("dev-tools.sh").exists()
    return get_script_path(relative_path).exists()

def display_header() -> None:
    """Display the TUI header."""
    header = Text()
    header.append("Development Tools", style="bold cyan")
    header.append("\n")
    header.append("Unified interface for dev, desktop, and build scripts", style="dim")

    console.print(Panel(header, box=box.DOUBLE, border_style="cyan"))

def display_main_menu() -> None:
    """Display the main menu."""
    table = Table(
        title="Main Menu",
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="blue",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Category", style="green")
    table.add_column("Scripts", style="dim", justify="right")

    for i, (category, scripts) in enumerate(SCRIPT_DEFINITIONS.items(), 1):
        # Count available scripts
        available = sum(1 for _, path, _ in scripts if check_script_exists(path))
        total = len(scripts)
        table.add_row(str(i), category, f"{available}/{total}")

    table.add_row("", "", "")
    table.add_row("0", "[bold red]Exit[/bold red]", "")

    console.print(table)

def display_category_menu(category: str, scripts: list[tuple[str, str, str]]) -> None:
    """Display a category submenu."""
    table = Table(
        title=category,
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="blue",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Command", style="green", max_width=30)
    table.add_column("Description", style="white")
    table.add_column("Status", style="dim", justify="center")

    for i, (name, path, description) in enumerate(scripts, 1):
        exists = check_script_exists(path)
        status = "\u2705" if exists else "\u274c"
        style = "" if exists else "dim strikethrough"
        table.add_row(str(i), f"[{style}]{name}[/]", description, status)

    table.add_row("", "", "", "")
    table.add_row("0", "[bold yellow]Back to Main Menu[/bold yellow]", "", "")

    console.print(table)

def run_script(relative_path: str, args: list[str] | None = None) -> None:
    """Run a script and display output."""
    scripts_dir = get_scripts_dir()
    args = args or []

    # Handle dev-tools.sh commands
    if relative_path.startswith("dev-tools.sh"):
        parts = relative_path.split()
        script_path = scripts_dir / "dev-tools.sh"
        cmd_args = parts[1:] + args
        display_name = " ".join(parts)
    else:
        script_path = scripts_dir / relative_path
        cmd_args = args
        display_name = relative_path

    console.print(f"\n[bold cyan]Running:[/bold cyan] {display_name}")
    console.print("[dim]" + "=" * 60 + "[/dim]")

    try:
        # Build the command
        cmd = ["bash", str(script_path)] + cmd_args

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=scripts_dir.parent,  # Run from repo root
        )

        if process.stdout:
            for line in process.stdout:
                console.print(line.rstrip())

        process.wait()

        if process.returncode == 0:
            console.print("\n[bold green]\u2705 Command completed successfully[/bold green]")
        else:
            console.print(f"\n[bold red]\u274c Command exited with code {process.returncode}[/bold red]")

    except KeyboardInterrupt:
        console.print("\n[bold yellow]\u26a0\ufe0f  Command interrupted by user[/bold yellow]")
        if process:
            process.terminate()
    except Exception as e:
        console.print(f"\n[bold red]Error running command: {e}[/bold red]")

    console.print("[dim]" + "=" * 60 + "[/dim]\n")
    Prompt.ask("Press Enter to continue")

def handle_category_selection(category: str, scripts: list[tuple[str, str, str]]) -> bool:
    """Handle script selection within a category. Returns True to stay in category."""
    display_category_menu(category, scripts)

    try:
        choice = IntPrompt.ask("\nSelect command", default=0)
    except KeyboardInterrupt:
        return False

    if choice == 0:
        return False

    if 1 <= choice <= len(scripts):
        name, path, description = scripts[choice - 1]
        if check_script_exists(path):
            # For test commands, offer options
            if "test" in path and "--watch" not in path and "--coverage" not in path:
                console.print("\n[cyan]Test Options:[/cyan]")
                console.print("  1. Run tests normally")
                console.print("  2. Run tests in watch mode")
                console.print("  3. Run tests with coverage")
                try:
                    test_choice = IntPrompt.ask("Select option", default=1)
                    if test_choice == 2:
                        path = path.replace("test", "test --watch")
                    elif test_choice == 3:
                        path = path.replace("test", "test --coverage")
                except KeyboardInterrupt:
                    return True

            run_script(path)
        else:
            console.print(f"[red]Script not found: {path}[/red]")
            Prompt.ask("Press Enter to continue")

    return True

def quick_actions_menu() -> None:
    """Display and handle quick actions menu."""
    table = Table(
        title="Quick Actions",
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="green",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Action", style="green")
    table.add_column("Description", style="white")
    table.add_column("Status", justify="center")

    for i, (action, path, description) in enumerate(QUICK_ACTIONS, 1):
        exists = check_script_exists(path)
        status = "\u2705" if exists else "\u274c"
        table.add_row(str(i), action, description, status)

    table.add_row("", "", "", "")
    table.add_row("0", "[bold yellow]Back[/bold yellow]", "", "")

    console.print(table)

    try:
        choice = IntPrompt.ask("\nSelect action", default=0)
    except KeyboardInterrupt:
        return

    if 1 <= choice <= len(QUICK_ACTIONS):
        action, path, description = QUICK_ACTIONS[choice - 1]
        if check_script_exists(path):
            run_script(path)
        else:
            console.print(f"[red]Script not found: {path}[/red]")
            Prompt.ask("Press Enter to continue")

def build_menu() -> None:
    """Display build options menu with platform selection."""
    console.print("\n[bold cyan]Build Options[/bold cyan]")
    console.print("=" * 40)

    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan", width=3)
    table.add_column(style="green")
    table.add_column(style="white")

    table.add_row("1", "Build Current Platform", "Auto-detect and build")
    table.add_row("2", "Build macOS", "Universal binary (.app + .dmg)")
    table.add_row("3", "Build Linux", ".deb, .AppImage, .rpm")
    table.add_row("4", "Production Build", "Frontend production build")
    table.add_row("", "", "")
    table.add_row("0", "Back", "")

    console.print(table)

    try:
        choice = IntPrompt.ask("\nSelect build option", default=0)
    except KeyboardInterrupt:
        return

    if choice == 1:
        run_script("desktop/build-all.sh")
    elif choice == 2:
        run_script("desktop/build-macos.sh")
    elif choice == 3:
        run_script("desktop/build-linux.sh")
    elif choice == 4:
        run_script("dev-tools.sh build")

def test_menu() -> None:
    """Display test options menu."""
    console.print("\n[bold cyan]Test Options[/bold cyan]")
    console.print("=" * 40)

    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan", width=3)
    table.add_column(style="green")
    table.add_column(style="white")

    table.add_row("1", "Run Tests", "Standard test run")
    table.add_row("2", "Watch Mode", "Re-run tests on file changes")
    table.add_row("3", "Coverage", "Run with coverage report")
    table.add_row("4", "All Checks", "Lint + Test + Build")
    table.add_row("", "", "")
    table.add_row("0", "Back", "")

    console.print(table)

    try:
        choice = IntPrompt.ask("\nSelect test option", default=0)
    except KeyboardInterrupt:
        return

    if choice == 1:
        run_script("dev-tools.sh test")
    elif choice == 2:
        run_script("dev-tools.sh test --watch")
    elif choice == 3:
        run_script("dev-tools.sh test --coverage")
    elif choice == 4:
        run_script("dev-tools.sh check")

def ide_menu() -> None:
    """Display IDE launch options."""
    console.print("\n[bold cyan]IDE Options[/bold cyan]")
    console.print("=" * 40)

    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan", width=3)
    table.add_column(style="green")
    table.add_column(style="white")

    table.add_row("1", "Universal IDE", "Auto-detect best option (vfkit/Lima/host)")
    table.add_row("2", "Chromium IDE", "Chrome/Chromium kiosk mode")
    table.add_row("3", "OpenVSCode HTTPS", "VS Code Server with HTTPS")
    table.add_row("4", "Package Lima Kiosk", "Create macOS .app bundle")
    table.add_row("", "", "")
    table.add_row("0", "Back", "")

    console.print(table)

    try:
        choice = IntPrompt.ask("\nSelect IDE option", default=0)
    except KeyboardInterrupt:
        return

    if choice == 1:
        run_script("dev/start-ide-universal.sh")
    elif choice == 2:
        run_script("dev/start-chromium-ide.sh")
    elif choice == 3:
        run_script("dev/start-openvscode-https.sh")
    elif choice == 4:
        run_script("dev/package-lima-kiosk.sh")

def display_extended_menu() -> None:
    """Display extended menu with shortcuts."""
    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan")
    table.add_column(style="white")

    table.add_row("q", "Quick Actions")
    table.add_row("t", "Test Menu")
    table.add_row("b", "Build Menu")
    table.add_row("i", "IDE Menu")
    table.add_row("d", "Start Dev Server")
    table.add_row("r", "Refresh")

    console.print(table)

def display_status() -> None:
    """Display current environment status."""
    scripts_dir = get_scripts_dir()
    repo_root = scripts_dir.parent

    status_items = []

    # Check for node_modules
    if (repo_root / "node_modules").exists():
        status_items.append(("[green]\u2705[/green]", "Dependencies installed"))
    else:
        status_items.append(("[yellow]\u26a0\ufe0f[/yellow]", "Dependencies not installed"))

    # Check for package manager
    if (repo_root / "pnpm-lock.yaml").exists():
        status_items.append(("[blue]\u2139\ufe0f[/blue]", "Using pnpm"))
    elif (repo_root / "yarn.lock").exists():
        status_items.append(("[blue]\u2139\ufe0f[/blue]", "Using yarn"))
    elif (repo_root / "package-lock.json").exists():
        status_items.append(("[blue]\u2139\ufe0f[/blue]", "Using npm"))

    # Check for .env.local
    if (repo_root / ".env.local").exists():
        status_items.append(("[green]\u2705[/green]", "Local env configured"))

    if status_items:
        console.print("[dim]Status:[/dim]", end=" ")
        for icon, text in status_items:
            console.print(f"{icon} {text}", end="  ")
        console.print()

def main_loop() -> None:
    """Main TUI loop."""
    categories = list(SCRIPT_DEFINITIONS.items())

    while True:
        console.clear()
        display_header()
        display_status()
        console.print()
        display_main_menu()
        display_extended_menu()

        try:
            choice = Prompt.ask("\nSelect category", default="0").strip().lower()
        except KeyboardInterrupt:
            break

        # Handle special commands
        if choice == "0" or choice == "exit":
            console.print("\n[cyan]Goodbye![/cyan]")
            break

        if choice == "q":
            quick_actions_menu()
            continue

        if choice == "t":
            test_menu()
            continue

        if choice == "b":
            build_menu()
            continue

        if choice == "i":
            ide_menu()
            continue

        if choice == "d":
            run_script("dev-tools.sh dev")
            continue

        if choice == "r":
            continue

        # Handle numeric category selection
        try:
            idx = int(choice)
            if 1 <= idx <= len(categories):
                category, scripts = categories[idx - 1]
                while True:
                    console.clear()
                    display_header()
                    if not handle_category_selection(category, scripts):
                        break
        except ValueError:
            console.print("[red]Invalid selection[/red]")
            Prompt.ask("Press Enter to continue")

def main() -> int:
    """Main entry point."""
    scripts_dir = get_scripts_dir()

    # Verify we're in the right location
    if not (scripts_dir / "dev-tools.sh").exists():
        console.print("[yellow]Warning: dev-tools.sh not found in scripts directory[/yellow]")

    try:
        main_loop()
    except KeyboardInterrupt:
        console.print("\n[cyan]Goodbye![/cyan]")

    return 0

if __name__ == "__main__":
    sys.exit(main())