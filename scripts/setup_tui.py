#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "setup-tui"
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

"""Setup Wizard TUI - Terminal User Interface for all setup scripts.

A rich-based TUI consolidating all setup-*.sh scripts into one unified
setup wizard with guided workflows and categorized options.
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

import subprocess
import sys
from pathlib import Path

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, IntPrompt, Confirm
    from rich.table import Table
    from rich.text import Text
    from rich.tree import Tree
    from rich import box
except ImportError:
    print("Error: rich library is required. Install with: pip install rich")
    sys.exit(1)

console = Console()

def get_scripts_dir() -> Path:
    """Get the scripts directory."""
    return Path(__file__).parent.resolve()

# Script categories with descriptions
SCRIPT_CATEGORIES: dict[str, dict[str, str]] = {
    "Local Development": {
        "setup-database.sh": "Setup PostgreSQL database for development",
        "setup-local-dev-with-monitoring.sh": "Local dev environment with Datadog monitoring",
        "setup-tailwind-mode.sh": "Configure Tailwind CSS mode",
        "setup-extension-local.sh": "Setup VS Code extension locally",
        "setup-extension-reload.sh": "Configure extension hot reload",
        "homebrew/setup-all.sh": "Install all Homebrew services (Redis, PostgreSQL, etc.)",
    },
    "Azure Cloud": {
        "setup-azure-resources.sh": "Provision Azure OpenAI resources",
        "setup-azure-openai.sh": "Configure Azure OpenAI service",
        "setup-azure-openai-monitoring.sh": "Setup Azure OpenAI monitoring",
        "setup-azure-search.sh": "Configure Azure Cognitive Search",
    },
    "Kubernetes": {
        "setup-kind-cluster.sh": "Create KIND cluster for local development",
        "setup-vibecode-cluster.sh": "Setup VibeCode Kubernetes cluster",
        "setup-k8s-db-scaling.sh": "Configure Kubernetes database scaling",
        "setup-secrets.sh": "Create Kubernetes secrets from env vars",
    },
    "Database & RAG": {
        "setup-database.sh": "Setup PostgreSQL database",
        "setup-rag-db.sh": "Setup RAG database with pgvector",
        "setup-openai-key.sh": "Configure OpenAI API key",
    },
    "Monitoring & Observability": {
        "setup-datadog-cnm.sh": "Setup Datadog Cloud Network Monitoring",
        "setup-aks-datadog-monitoring.sh": "Configure AKS Datadog monitoring",
        "setup-postgres-datadog-monitoring.sh": "Setup PostgreSQL Datadog monitoring",
        "setup-production-monitoring.sh": "Configure production monitoring stack",
        "setup-mcp-tracing.sh": "Setup MCP tracing",
    },
    "Testing": {
        "setup-test-env.sh": "Setup Azure test environment",
        "setup-test-dependencies.sh": "Install test dependencies",
        "setup-real-testing.sh": "Configure real testing environment",
    },
    "VM & IDE": {
        "setup-ide-vm.sh": "Setup IDE VM with OpenVSCode Server",
        "setup-vfkit-demo.sh": "Setup vfkit demo environment",
        "setup-vm-hostname.sh": "Configure VM hostname",
        "setup-vms-for-new-clone.sh": "Setup VMs for new repository clone",
        "vfkit/setup-alpine-services.sh": "Setup Alpine services in vfkit",
        "vfkit/setup-demo-environment.sh": "Setup vfkit demo environment",
    },
    "Security & CI/CD": {
        "setup-secrets.sh": "Manage Kubernetes secrets",
        "setup-branch-protection.sh": "Configure GitHub branch protection",
        "util/setup-branch-protection.sh": "Branch protection (util version)",
        "setup-backup-strategy.sh": "Configure backup strategy",
    },
    "Full Stack": {
        "setup-full-automation.sh": "Complete automation setup",
    },
}

# Guided setup workflows
GUIDED_WORKFLOWS: dict[str, list[str]] = {
    "New Developer Setup": [
        "homebrew/setup-all.sh",
        "setup-database.sh",
        "setup-secrets.sh",
        "setup-local-dev-with-monitoring.sh",
    ],
    "Kubernetes Development": [
        "setup-kind-cluster.sh",
        "setup-secrets.sh",
        "setup-vibecode-cluster.sh",
    ],
    "Azure Cloud Setup": [
        "setup-azure-resources.sh",
        "setup-azure-openai.sh",
        "setup-azure-search.sh",
        "setup-azure-openai-monitoring.sh",
    ],
    "Production Monitoring": [
        "setup-datadog-cnm.sh",
        "setup-production-monitoring.sh",
        "setup-aks-datadog-monitoring.sh",
    ],
    "RAG/AI Development": [
        "setup-database.sh",
        "setup-rag-db.sh",
        "setup-openai-key.sh",
        "setup-azure-openai.sh",
    ],
    "VM Development Environment": [
        "setup-ide-vm.sh",
        "setup-vfkit-demo.sh",
        "vfkit/setup-alpine-services.sh",
    ],
}

def check_script_exists(relative_path: str) -> bool:
    """Check if a script exists."""
    return (get_scripts_dir() / relative_path).exists()

def display_header() -> None:
    """Display the TUI header."""
    header = Text()
    header.append("\u2699\ufe0f  Setup Wizard", style="bold cyan")
    header.append("\n")
    header.append("Guided setup for VibeCode development environment", style="dim")

    console.print(Panel(header, box=box.DOUBLE, border_style="cyan"))

def display_main_menu() -> None:
    """Display the main menu."""
    table = Table(
        title="Setup Categories",
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="blue",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Category", style="green")
    table.add_column("Scripts", style="dim", justify="right")

    categories = list(SCRIPT_CATEGORIES.items())
    for i, (category, scripts) in enumerate(categories, 1):
        available = sum(1 for path in scripts if check_script_exists(path))
        total = len(scripts)
        table.add_row(str(i), category, f"{available}/{total}")

    table.add_row("", "", "")
    table.add_row("0", "[bold red]Exit[/bold red]", "")

    console.print(table)

def display_category_menu(category: str, scripts: dict[str, str]) -> None:
    """Display a category submenu."""
    table = Table(
        title=category,
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="blue",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Script", style="green", max_width=35)
    table.add_column("Description", style="white")
    table.add_column("Status", style="dim", justify="center")

    script_list = list(scripts.items())
    for i, (script_path, description) in enumerate(script_list, 1):
        exists = check_script_exists(script_path)
        status = "\u2705" if exists else "\u274c"
        style = "" if exists else "dim strikethrough"
        # Show just the filename for cleaner display
        display_name = Path(script_path).name
        table.add_row(str(i), f"[{style}]{display_name}[/]", description, status)

    table.add_row("", "", "", "")
    table.add_row("0", "[bold yellow]Back to Main Menu[/bold yellow]", "", "")

    console.print(table)

def run_script(relative_path: str) -> bool:
    """Run a script and display output. Returns True if successful."""
    scripts_dir = get_scripts_dir()
    script_path = scripts_dir / relative_path

    if not script_path.exists():
        console.print(f"[red]Script not found: {relative_path}[/red]")
        return False

    console.print(f"\n[bold cyan]Running:[/bold cyan] {relative_path}")
    console.print("[dim]" + "=" * 60 + "[/dim]")

    try:
        process = subprocess.Popen(
            ["bash", str(script_path)],
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
            console.print("\n[bold green]\u2705 Setup completed successfully[/bold green]")
            return True
        else:
            console.print(f"\n[bold red]\u274c Setup failed with code {process.returncode}[/bold red]")
            return False

    except KeyboardInterrupt:
        console.print("\n[bold yellow]\u26a0\ufe0f  Setup interrupted by user[/bold yellow]")
        if process:
            process.terminate()
        return False
    except Exception as e:
        console.print(f"\n[bold red]Error running script: {e}[/bold red]")
        return False
    finally:
        console.print("[dim]" + "=" * 60 + "[/dim]\n")
        Prompt.ask("Press Enter to continue")

def handle_category_selection(category: str, scripts: dict[str, str]) -> bool:
    """Handle script selection within a category. Returns True to stay in category."""
    display_category_menu(category, scripts)

    try:
        choice = IntPrompt.ask("\nSelect script", default=0)
    except KeyboardInterrupt:
        return False

    if choice == 0:
        return False

    script_list = list(scripts.items())
    if 1 <= choice <= len(script_list):
        script_path, description = script_list[choice - 1]
        if check_script_exists(script_path):
            # Confirm before running
            if Confirm.ask(f"\nRun [cyan]{Path(script_path).name}[/cyan]?", default=True):
                run_script(script_path)
        else:
            console.print(f"[red]Script not found: {script_path}[/red]")
            Prompt.ask("Press Enter to continue")

    return True

def display_workflow_menu() -> None:
    """Display guided workflow options."""
    table = Table(
        title="\U0001f9ed Guided Setup Workflows",
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="green",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Workflow", style="green")
    table.add_column("Steps", style="dim", justify="right")

    workflows = list(GUIDED_WORKFLOWS.items())
    for i, (name, steps) in enumerate(workflows, 1):
        available = sum(1 for s in steps if check_script_exists(s))
        table.add_row(str(i), name, f"{available}/{len(steps)} scripts")

    table.add_row("", "", "")
    table.add_row("0", "[bold yellow]Back[/bold yellow]", "")

    console.print(table)

def run_guided_workflow(name: str, steps: list[str]) -> None:
    """Run a guided workflow with multiple steps."""
    console.print(f"\n[bold cyan]\U0001f9ed Starting: {name}[/bold cyan]")
    console.print("[dim]" + "=" * 60 + "[/dim]")

    # Show workflow overview
    tree = Tree(f"[bold]{name}[/bold]")
    for i, step in enumerate(steps, 1):
        exists = check_script_exists(step)
        status = "\u2705" if exists else "\u274c"
        tree.add(f"{status} Step {i}: {Path(step).name}")

    console.print(tree)
    console.print()

    if not Confirm.ask("Start this workflow?", default=True):
        return

    completed = 0
    failed = 0

    for i, step in enumerate(steps, 1):
        console.print(f"\n[bold blue]Step {i}/{len(steps)}:[/bold blue] {Path(step).name}")

        if not check_script_exists(step):
            console.print(f"[yellow]\u26a0\ufe0f  Skipping - script not found[/yellow]")
            continue

        if not Confirm.ask(f"Run {Path(step).name}?", default=True):
            console.print("[yellow]Skipped by user[/yellow]")
            continue

        success = run_script(step)
        if success:
            completed += 1
        else:
            failed += 1
            if not Confirm.ask("Continue with next step?", default=True):
                break

    # Summary
    console.print("\n[bold cyan]Workflow Summary[/bold cyan]")
    console.print(f"  \u2705 Completed: {completed}")
    console.print(f"  \u274c Failed: {failed}")
    console.print(f"  \u23ed\ufe0f  Skipped: {len(steps) - completed - failed}")

def handle_workflow_selection() -> None:
    """Handle workflow selection."""
    display_workflow_menu()

    try:
        choice = IntPrompt.ask("\nSelect workflow", default=0)
    except KeyboardInterrupt:
        return

    if choice == 0:
        return

    workflows = list(GUIDED_WORKFLOWS.items())
    if 1 <= choice <= len(workflows):
        name, steps = workflows[choice - 1]
        run_guided_workflow(name, steps)

def quick_setup_menu() -> None:
    """Display quick setup options."""
    console.print("\n[bold cyan]\u26a1 Quick Setup[/bold cyan]")
    console.print("=" * 40)

    quick_options = [
        ("1", "New Developer", "Full local development setup"),
        ("2", "Database Only", "Just PostgreSQL + pgvector"),
        ("3", "Kubernetes", "KIND cluster + secrets"),
        ("4", "Azure Cloud", "Azure resources + OpenAI"),
        ("5", "Homebrew Services", "Redis, PostgreSQL via Homebrew"),
    ]

    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan", width=3)
    table.add_column(style="green")
    table.add_column(style="dim")

    for num, name, desc in quick_options:
        table.add_row(num, name, desc)

    table.add_row("", "", "")
    table.add_row("0", "Back", "")

    console.print(table)

    try:
        choice = Prompt.ask("\nSelect option", default="0")
    except KeyboardInterrupt:
        return

    if choice == "1":
        run_guided_workflow("New Developer Setup", GUIDED_WORKFLOWS["New Developer Setup"])
    elif choice == "2":
        scripts = ["setup-database.sh", "setup-rag-db.sh"]
        run_guided_workflow("Database Setup", scripts)
    elif choice == "3":
        run_guided_workflow("Kubernetes Development", GUIDED_WORKFLOWS["Kubernetes Development"])
    elif choice == "4":
        run_guided_workflow("Azure Cloud Setup", GUIDED_WORKFLOWS["Azure Cloud Setup"])
    elif choice == "5":
        if check_script_exists("homebrew/setup-all.sh"):
            run_script("homebrew/setup-all.sh")

def display_status() -> None:
    """Display current setup status."""
    scripts_dir = get_scripts_dir()
    repo_root = scripts_dir.parent

    checks = []

    # Check common indicators
    if (repo_root / "node_modules").exists():
        checks.append(("\u2705", "Node modules"))
    else:
        checks.append(("\u274c", "Node modules"))

    if (repo_root / ".env.local").exists():
        checks.append(("\u2705", "Local env"))
    else:
        checks.append(("\u26a0\ufe0f", "Local env"))

    # Check for common tools
    import shutil
    if shutil.which("docker"):
        checks.append(("\u2705", "Docker"))
    else:
        checks.append(("\u274c", "Docker"))

    if shutil.which("kubectl"):
        checks.append(("\u2705", "kubectl"))
    else:
        checks.append(("\u26a0\ufe0f", "kubectl"))

    if shutil.which("az"):
        checks.append(("\u2705", "Azure CLI"))
    else:
        checks.append(("\u26a0\ufe0f", "Azure CLI"))

    console.print("[dim]Environment:[/dim]", end=" ")
    for icon, name in checks:
        console.print(f"{icon} {name}", end="  ")
    console.print()

def display_extended_menu() -> None:
    """Display extended menu options."""
    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan")
    table.add_column(style="white")

    table.add_row("w", "Guided Workflows")
    table.add_row("q", "Quick Setup")
    table.add_row("s", "Show All Scripts")
    table.add_row("r", "Refresh")

    console.print(table)

def show_all_scripts() -> None:
    """Show all available setup scripts."""
    console.print("\n[bold cyan]All Setup Scripts[/bold cyan]")
    console.print("=" * 60)

    all_scripts: list[tuple[str, str, str]] = []
    for category, scripts in SCRIPT_CATEGORIES.items():
        for path, desc in scripts.items():
            all_scripts.append((path, desc, category))

    # Sort by path
    all_scripts.sort(key=lambda x: x[0])

    table = Table(box=box.SIMPLE)
    table.add_column("Script", style="green")
    table.add_column("Description", style="white")
    table.add_column("Category", style="dim")
    table.add_column("", justify="center")

    for path, desc, category in all_scripts:
        exists = check_script_exists(path)
        status = "\u2705" if exists else "\u274c"
        table.add_row(Path(path).name, desc, category, status)

    console.print(table)
    console.print(f"\nTotal: {len(all_scripts)} scripts")
    Prompt.ask("\nPress Enter to continue")

def main_loop() -> None:
    """Main TUI loop."""
    categories = list(SCRIPT_CATEGORIES.items())

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

        if choice == "w":
            handle_workflow_selection()
            continue

        if choice == "q":
            quick_setup_menu()
            continue

        if choice == "s":
            show_all_scripts()
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
    try:
        main_loop()
    except KeyboardInterrupt:
        console.print("\n[cyan]Goodbye![/cyan]")

    return 0

if __name__ == "__main__":
    sys.exit(main())