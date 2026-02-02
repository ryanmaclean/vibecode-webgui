#!/usr/bin/env python3
"""VFKit TUI - Terminal User Interface for vfkit VM management.

A rich-based TUI providing menu access to all vfkit shell scripts.
Organized into submenus for setup, VM management, building, and testing.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


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
    path: Path
    description: str


console = Console()

# Script categories and their scripts
SCRIPT_CATEGORIES: dict[str, dict[str, str]] = {
    "Setup & Installation": {
        "01-setup-vfkit.sh": "Initial vfkit setup and dependencies",
        "02-download-alpine-kernel.sh": "Download Alpine Linux kernel",
        "install.sh": "Main installation script",
        "install-alpine-vm.sh": "Install Alpine VM",
        "install-vscode-server.sh": "Install VS Code Server",
        "install-ai-tools-vfkit.sh": "Install AI tools in vfkit",
        "install-grub-alpine.sh": "Install GRUB bootloader for Alpine",
        "DECOMPRESS_KERNEL.sh": "Decompress kernel image",
    },
    "Create Rootfs & VMs": {
        "03-create-alpine-rootfs.sh": "Create Alpine Linux rootfs",
        "06-create-vibecode-rootfs.sh": "Create VibeCode rootfs with Node.js",
        "07-create-persistent-vm.sh": "Create persistent VM with storage",
        "08-create-node24-rootfs.sh": "Create Node.js 24 rootfs",
        "12-create-vscode-server-rootfs.sh": "Create VS Code Server rootfs",
        "14-create-fun-demo-rootfs.sh": "Create fun demo rootfs",
        "create-alpine-rootfs.sh": "Create Alpine rootfs (alternative)",
        "create-busybox-vm.sh": "Create BusyBox-based VM",
        "create-disk-vms.sh": "Create disk-based VMs",
        "create-efi-variable-store.sh": "Create EFI variable store",
        "create-minimal-alpine-vm.sh": "Create minimal Alpine VM",
        "create-multi-vm-setup.sh": "Create multi-VM environment",
        "create-optimized-alpine-vm.sh": "Create optimized Alpine VM",
        "create-practical-busybox-vm.sh": "Create practical BusyBox VM",
        "create-preinstalled-vm.sh": "Create preinstalled VM",
        "create-simple-alpine-vm.sh": "Create simple Alpine VM",
        "create-simple-busybox-vm.sh": "Create simple BusyBox VM",
        "create-ultra-minimal-vm.sh": "Create ultra-minimal VM",
        "create-working-alpine-vm.sh": "Create working Alpine VM",
        "create-working-busybox-vm.sh": "Create working BusyBox VM",
        "create-working-vm.sh": "Create working VM",
    },
    "Launch & Start VMs": {
        "04-launch-alpine-vm.sh": "Launch Alpine VM",
        "05-launch-vibecode-vm.sh": "Launch VibeCode VM",
        "09-launch-node24-vm.sh": "Launch Node.js 24 VM",
        "13-launch-vscode-server-vm.sh": "Launch VS Code Server VM",
        "launch-nodejs-dev-vm.sh": "Launch Node.js development VM",
        "launch-nodejs-dev.sh": "Launch Node.js dev environment",
        "launch-postgresql.sh": "Launch PostgreSQL VM",
        "launch-valkey-vm-test.sh": "Launch Valkey VM for testing",
        "launch-valkey.sh": "Launch Valkey VM",
        "start-all-vms.sh": "Start all VMs",
        "start-all-vms-fixed.sh": "Start all VMs (fixed version)",
        "start-nodejs-dev.sh": "Start Node.js development",
        "start-postgresql.sh": "Start PostgreSQL",
        "start-valkey.sh": "Start Valkey",
    },
    "VM Management": {
        "stop-all-vms.sh": "Stop all running VMs",
        "vm-manager.sh": "VM management utilities",
        "vm-health-check.sh": "Check VM health status",
        "vm-setup-services.sh": "Setup VM services",
        "vibecode-init.sh": "Initialize VibeCode environment",
        "setup-alpine-services.sh": "Setup Alpine services",
        "setup-demo-environment.sh": "Setup demo environment",
        "manage-efi-boot-entries.sh": "Manage EFI boot entries",
        "network-utils.sh": "Network utilities",
    },
    "Building": {
        "BUILD_ALL_NOW.sh": "Build all components now",
        "BUILD_FOUR_VMS.sh": "Build four VMs",
        "BUILD_WORKING_VMS.sh": "Build working VMs",
        "FIX_VMS_NO_DOCKER.sh": "Fix VMs without Docker",
        "actually-build-now.sh": "Actually build now",
        "11-build-minimal-kernel.sh": "Build minimal kernel",
        "11-build-minimal-kernel-docker.sh": "Build minimal kernel (Docker)",
        "build-ai-tools-vm.sh": "Build AI tools VM",
        "build-ai-tools-vm-complete.sh": "Build AI tools VM (complete)",
        "build-all-tiny-services.sh": "Build all tiny services",
        "build-busybox-node-docker.sh": "Build BusyBox Node.js (Docker)",
        "build-openvscode.sh": "Build OpenVSCode Server",
        "build-openvscode-musl.sh": "Build OpenVSCode (musl)",
        "build-services-arm64.sh": "Build services for ARM64",
        "build-services-on-host.sh": "Build services on host",
        "build-tiny-node24.sh": "Build tiny Node.js 24",
        "build-tiny-openvscode-with-rag.sh": "Build tiny OpenVSCode with RAG",
        "build-tiny-postgresql-pgvector.sh": "Build tiny PostgreSQL with pgvector",
        "compile-valkey-musl.sh": "Compile Valkey (musl)",
        "compile-valkey-uclibc.sh": "Compile Valkey (uclibc)",
        "run-builds.sh": "Run builds",
        "execute-builds-in-vms.sh": "Execute builds in VMs",
        "fast-build-and-test.sh": "Fast build and test",
        "integrate-grub-into-vm-creation.sh": "Integrate GRUB into VM creation",
        "prepare-vm-with-grub.sh": "Prepare VM with GRUB",
    },
    "Testing & Benchmarks": {
        "test-all-vms.sh": "Test all VMs",
        "test-busybox-node-docker.sh": "Test BusyBox Node.js Docker",
        "test-nodejs-dev.sh": "Test Node.js development",
        "test-openvscode-in-vm.sh": "Test OpenVSCode in VM",
        "test-postgresql.sh": "Test PostgreSQL",
        "test-valkey.sh": "Test Valkey",
        "test-vm-performance.sh": "Test VM performance",
        "basic-performance-test.sh": "Basic performance test",
        "benchmark-validation.sh": "Benchmark validation",
        "compare-boot-times.sh": "Compare boot times",
        "compare-busybox-alpine.sh": "Compare BusyBox vs Alpine",
        "comprehensive-performance-test.sh": "Comprehensive performance test",
        "continuous-performance-monitor.sh": "Continuous performance monitor",
        "detailed-performance-test.sh": "Detailed performance test",
        "final-performance-test.sh": "Final performance test",
        "real-boot-time-test.sh": "Real boot time test",
        "simple-automated-test.sh": "Simple automated test",
        "verify-services.sh": "Verify services",
        "prove-ai-tools-work.sh": "Prove AI tools work",
    },
    "Upgrades & Analysis": {
        "10-upgrade-to-alpine-3.22.sh": "Upgrade to Alpine 3.22",
        "analyze-kernel-optimization.sh": "Analyze kernel optimization",
    },
}


def get_vfkit_dir() -> Path:
    """Get the vfkit scripts directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir / "vfkit"


def get_available_scripts(vfkit_dir: Path) -> set[str]:
    """Get set of available script names."""
    return {f.name for f in vfkit_dir.glob("*.sh") if f.is_file()}


def display_header() -> None:
    """Display the TUI header."""
    header = Text()
    header.append("VFKit VM Manager", style="bold cyan")
    header.append("\n")
    header.append("Terminal User Interface for vfkit scripts", style="dim")

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

    vfkit_dir = get_vfkit_dir()
    available = get_available_scripts(vfkit_dir)

    for i, (category, scripts) in enumerate(SCRIPT_CATEGORIES.items(), 1):
        # Count available scripts in this category
        count = sum(1 for s in scripts if s in available)
        total = len(scripts)
        table.add_row(str(i), category, f"{count}/{total}")

    table.add_row("", "", "")
    table.add_row("0", "[bold red]Exit[/bold red]", "")

    console.print(table)


def display_category_menu(category: str, scripts: dict[str, str]) -> None:
    """Display a category submenu."""
    vfkit_dir = get_vfkit_dir()
    available = get_available_scripts(vfkit_dir)

    table = Table(
        title=category,
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="blue",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Script", style="green", max_width=40)
    table.add_column("Description", style="white")
    table.add_column("Status", style="dim", justify="center")

    script_list = list(scripts.items())
    for i, (script_name, description) in enumerate(script_list, 1):
        status = "\u2705" if script_name in available else "\u274c"
        style = "" if script_name in available else "dim strikethrough"
        table.add_row(str(i), f"[{style}]{script_name}[/]", description, status)

    table.add_row("", "", "", "")
    table.add_row("0", "[bold yellow]Back to Main Menu[/bold yellow]", "", "")

    console.print(table)


def run_script(script_path: Path) -> None:
    """Run a script and display output."""
    console.print(f"\n[bold cyan]Running:[/bold cyan] {script_path.name}")
    console.print("[dim]" + "=" * 60 + "[/dim]")

    try:
        process = subprocess.Popen(
            ["bash", str(script_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        if process.stdout:
            for line in process.stdout:
                console.print(line.rstrip())

        process.wait()

        if process.returncode == 0:
            console.print("\n[bold green]\u2705 Script completed successfully[/bold green]")
        else:
            console.print(f"\n[bold red]\u274c Script exited with code {process.returncode}[/bold red]")

    except KeyboardInterrupt:
        console.print("\n[bold yellow]\u26a0\ufe0f  Script interrupted by user[/bold yellow]")
        if process:
            process.terminate()
    except Exception as e:
        console.print(f"\n[bold red]Error running script: {e}[/bold red]")

    console.print("[dim]" + "=" * 60 + "[/dim]\n")
    Prompt.ask("Press Enter to continue")


def handle_category_selection(category: str, scripts: dict[str, str]) -> bool:
    """Handle script selection within a category. Returns True to stay in category."""
    vfkit_dir = get_vfkit_dir()
    available = get_available_scripts(vfkit_dir)
    script_list = list(scripts.items())

    display_category_menu(category, scripts)

    try:
        choice = IntPrompt.ask("\nSelect script", default=0)
    except KeyboardInterrupt:
        return False

    if choice == 0:
        return False

    if 1 <= choice <= len(script_list):
        script_name = script_list[choice - 1][0]
        if script_name in available:
            script_path = vfkit_dir / script_name
            run_script(script_path)
        else:
            console.print(f"[red]Script not found: {script_name}[/red]")
            Prompt.ask("Press Enter to continue")

    return True


def quick_actions_menu() -> None:
    """Display quick actions menu."""
    vfkit_dir = get_vfkit_dir()
    available = get_available_scripts(vfkit_dir)

    quick_actions = [
        ("Start All VMs", "start-all-vms.sh"),
        ("Stop All VMs", "stop-all-vms.sh"),
        ("VM Health Check", "vm-health-check.sh"),
        ("Test All VMs", "test-all-vms.sh"),
        ("Build All", "BUILD_ALL_NOW.sh"),
    ]

    table = Table(
        title="Quick Actions",
        box=box.ROUNDED,
        title_style="bold magenta",
        border_style="green",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Action", style="green")
    table.add_column("Script", style="dim")
    table.add_column("Status", justify="center")

    for i, (action, script) in enumerate(quick_actions, 1):
        status = "\u2705" if script in available else "\u274c"
        table.add_row(str(i), action, script, status)

    table.add_row("", "", "", "")
    table.add_row("0", "[bold yellow]Back[/bold yellow]", "", "")

    console.print(table)

    try:
        choice = IntPrompt.ask("\nSelect action", default=0)
    except KeyboardInterrupt:
        return

    if 1 <= choice <= len(quick_actions):
        script_name = quick_actions[choice - 1][1]
        if script_name in available:
            run_script(vfkit_dir / script_name)
        else:
            console.print(f"[red]Script not found: {script_name}[/red]")
            Prompt.ask("Press Enter to continue")


def search_scripts() -> None:
    """Search for scripts by name or description."""
    vfkit_dir = get_vfkit_dir()
    available = get_available_scripts(vfkit_dir)

    query = Prompt.ask("\nSearch query").lower().strip()
    if not query:
        return

    results: list[tuple[str, str, str]] = []
    for category, scripts in SCRIPT_CATEGORIES.items():
        for script_name, description in scripts.items():
            if query in script_name.lower() or query in description.lower():
                results.append((script_name, description, category))

    if not results:
        console.print("[yellow]No matching scripts found[/yellow]")
        Prompt.ask("Press Enter to continue")
        return

    table = Table(
        title=f"Search Results for '{query}'",
        box=box.ROUNDED,
        title_style="bold magenta",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Script", style="green")
    table.add_column("Description", style="white")
    table.add_column("Category", style="dim")
    table.add_column("Status", justify="center")

    for i, (script_name, description, category) in enumerate(results, 1):
        status = "\u2705" if script_name in available else "\u274c"
        table.add_row(str(i), script_name, description, category, status)

    table.add_row("", "", "", "", "")
    table.add_row("0", "[bold yellow]Back[/bold yellow]", "", "", "")

    console.print(table)

    try:
        choice = IntPrompt.ask("\nSelect script to run", default=0)
    except KeyboardInterrupt:
        return

    if 1 <= choice <= len(results):
        script_name = results[choice - 1][0]
        if script_name in available:
            run_script(vfkit_dir / script_name)
        else:
            console.print(f"[red]Script not found: {script_name}[/red]")
            Prompt.ask("Press Enter to continue")


def display_extended_menu() -> None:
    """Display extended menu with additional options."""
    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column(style="cyan")
    table.add_column(style="white")

    table.add_row("q", "Quick Actions")
    table.add_row("s", "Search Scripts")
    table.add_row("r", "Refresh")

    console.print(table)


def main_loop() -> None:
    """Main TUI loop."""
    categories = list(SCRIPT_CATEGORIES.items())

    while True:
        console.clear()
        display_header()
        display_main_menu()
        display_extended_menu()

        try:
            choice = Prompt.ask("\nSelect category", default="0").strip().lower()
        except KeyboardInterrupt:
            break

        if choice == "0" or choice == "exit" or choice == "q" and len(choice) == 1:
            if choice == "0" or choice == "exit":
                console.print("\n[cyan]Goodbye![/cyan]")
                break
            else:
                quick_actions_menu()
                continue

        if choice == "s":
            search_scripts()
            continue

        if choice == "r":
            continue

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
    # Check if vfkit directory exists
    vfkit_dir = get_vfkit_dir()
    if not vfkit_dir.exists():
        console.print(f"[red]Error: vfkit directory not found at {vfkit_dir}[/red]")
        return 1

    try:
        main_loop()
    except KeyboardInterrupt:
        console.print("\n[cyan]Goodbye![/cyan]")

    return 0


if __name__ == "__main__":
    sys.exit(main())
