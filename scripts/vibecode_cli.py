#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "vibecode-cli"
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

"""VibeCode CLI - Master command-line interface for all VibeCode tools.

A unified CLI using Typer that provides access to all TUIs and common
development operations through subcommands.

Usage:
    vibecode --help              Show all commands
    vibecode vfkit               Launch vfkit VM TUI
    vibecode dev                 Launch development tools TUI
    vibecode setup               Launch setup wizard TUI
    vibecode build               Run production build
    vibecode test                Run tests
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

try:
    import typer
    from typer import Typer, Option, Argument
except ImportError:
    print("Error: typer library is required. Install with: pip install typer[all]")
    sys.exit(1)

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich import box
except ImportError:
    print("Error: rich library is required. Install with: pip install rich")
    sys.exit(1)

# Initialize
app = Typer(
    name="vibecode",
    help="VibeCode CLI - Unified interface for all development tools",
    add_completion=True,
    rich_markup_mode="rich",
)
console = Console()

# Sub-applications
vfkit_app = Typer(help="VFKit VM management commands")
dev_app = Typer(help="Development tools and commands")
setup_app = Typer(help="Setup and configuration commands")
build_app = Typer(help="Build commands for all platforms")
test_app = Typer(help="Testing commands")
deploy_app = Typer(help="Deployment commands")
security_app = Typer(help="Security and verification commands")
benchmark_app = Typer(help="Benchmarking commands")

app.add_typer(vfkit_app, name="vfkit")
app.add_typer(dev_app, name="dev")
app.add_typer(setup_app, name="setup")
app.add_typer(build_app, name="build")
app.add_typer(test_app, name="test")
app.add_typer(deploy_app, name="deploy")
app.add_typer(security_app, name="security")
app.add_typer(benchmark_app, name="benchmark")

def get_scripts_dir() -> Path:
    """Get the scripts directory."""
    return Path(__file__).parent.resolve()

def get_repo_root() -> Path:
    """Get the repository root directory."""
    return get_scripts_dir().parent

def run_script(relative_path: str, args: list[str] | None = None) -> int:
    """Run a shell script and return exit code."""
    scripts_dir = get_scripts_dir()
    script_path = scripts_dir / relative_path
    args = args or []

    if not script_path.exists():
        console.print(f"[red]Script not found: {relative_path}[/red]")
        return 1

    try:
        result = subprocess.run(
            ["bash", str(script_path)] + args,
            cwd=get_repo_root(),
        )
        return result.returncode
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
        return 130

def run_python_script(relative_path: str) -> int:
    """Run a Python script and return exit code."""
    scripts_dir = get_scripts_dir()
    script_path = scripts_dir / relative_path

    if not script_path.exists():
        console.print(f"[red]Script not found: {relative_path}[/red]")
        return 1

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=get_repo_root(),
        )
        return result.returncode
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
        return 130

def launch_tui(tui_name: str) -> int:
    """Launch a TUI by name."""
    tui_path = f"{tui_name}_tui.py"
    return run_python_script(tui_path)

# ============================================================================
# Main Commands
# ============================================================================

@app.command()
def status():
    """Show VibeCode environment status."""
    repo_root = get_repo_root()
    scripts_dir = get_scripts_dir()

    console.print(Panel("[bold cyan]VibeCode Status[/bold cyan]", box=box.DOUBLE))

    # Environment checks
    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column("Check", style="white")
    table.add_column("Status", justify="center")
    table.add_column("Details", style="dim")

    # Node modules
    if (repo_root / "node_modules").exists():
        table.add_row("Node Modules", "\u2705", "Installed")
    else:
        table.add_row("Node Modules", "\u274c", "Run: npm install")

    # Environment file
    if (repo_root / ".env.local").exists():
        table.add_row("Local Environment", "\u2705", ".env.local exists")
    else:
        table.add_row("Local Environment", "\u26a0\ufe0f", "Create .env.local")

    # Docker
    import shutil
    if shutil.which("docker"):
        table.add_row("Docker", "\u2705", "Available")
    else:
        table.add_row("Docker", "\u274c", "Not installed")

    # Kubernetes
    if shutil.which("kubectl"):
        table.add_row("kubectl", "\u2705", "Available")
    else:
        table.add_row("kubectl", "\u26a0\ufe0f", "Optional")

    # vfkit (macOS)
    if shutil.which("vfkit"):
        table.add_row("vfkit", "\u2705", "Available")
    else:
        table.add_row("vfkit", "\u26a0\ufe0f", "Optional (macOS VMs)")

    console.print(table)

    # Available TUIs
    console.print("\n[bold]Available TUIs:[/bold]")
    tuis = list(scripts_dir.glob("*_tui.py"))
    for tui in sorted(tuis):
        name = tui.stem.replace("_tui", "")
        console.print(f"  \u2022 vibecode {name}")

@app.command()
def tui():
    """Launch the main VibeCode TUI selector."""
    console.clear()
    console.print(Panel("[bold cyan]VibeCode TUI Launcher[/bold cyan]", box=box.DOUBLE))

    scripts_dir = get_scripts_dir()
    tuis = sorted(scripts_dir.glob("*_tui.py"))

    if not tuis:
        console.print("[yellow]No TUIs found[/yellow]")
        return

    table = Table(box=box.ROUNDED, title="Available TUIs")
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("TUI", style="green")
    table.add_column("Description", style="white")

    tui_info = {
        "vfkit_tui": "VFKit VM management and scripts",
        "dev_tools_tui": "Development tools (build, test, lint)",
        "setup_tui": "Setup wizard for environment configuration",
        "benchmarks_tui": "Performance benchmarking tools",
        "deployment_tui": "Deployment and release tools",
        "security_tui": "Security scanning and verification",
        "testing_tui": "Testing and validation tools",
    }

    for i, tui_path in enumerate(tuis, 1):
        name = tui_path.stem
        desc = tui_info.get(name, "TUI interface")
        table.add_row(str(i), name.replace("_tui", ""), desc)

    table.add_row("", "", "")
    table.add_row("0", "Exit", "")

    console.print(table)

    try:
        from rich.prompt import IntPrompt
        choice = IntPrompt.ask("\nSelect TUI", default=0)
    except KeyboardInterrupt:
        return

    if choice == 0:
        return

    if 1 <= choice <= len(tuis):
        tui_path = tuis[choice - 1]
        run_python_script(tui_path.name)

# ============================================================================
# VFKit Commands
# ============================================================================

@vfkit_app.callback(invoke_without_command=True)
def vfkit_main(ctx: typer.Context):
    """VFKit VM management. Run without subcommand for TUI."""
    if ctx.invoked_subcommand is None:
        raise SystemExit(launch_tui("vfkit"))

@vfkit_app.command("start")
def vfkit_start(vm: str = Argument("all", help="VM name or 'all'")):
    """Start VFKit VM(s)."""
    if vm == "all":
        raise SystemExit(run_script("vfkit/start-all-vms.sh"))
    else:
        console.print(f"[cyan]Starting VM: {vm}[/cyan]")
        raise SystemExit(run_script(f"vfkit/launch-{vm}.sh"))

@vfkit_app.command("stop")
def vfkit_stop(vm: str = Argument("all", help="VM name or 'all'")):
    """Stop VFKit VM(s)."""
    if vm == "all":
        raise SystemExit(run_script("vfkit/stop-all-vms.sh"))
    else:
        console.print(f"[cyan]Stopping VM: {vm}[/cyan]")
        # Would need specific stop script

@vfkit_app.command("list")
def vfkit_list():
    """List available VFKit VMs."""
    scripts_dir = get_scripts_dir()
    vfkit_dir = scripts_dir / "vfkit"

    launch_scripts = sorted(vfkit_dir.glob("launch-*.sh"))
    create_scripts = sorted(vfkit_dir.glob("create-*.sh"))

    console.print("[bold]Available VMs:[/bold]")
    for script in launch_scripts:
        name = script.stem.replace("launch-", "")
        console.print(f"  \u2022 {name}")

@vfkit_app.command("build")
def vfkit_build():
    """Build all VFKit VMs."""
    raise SystemExit(run_script("vfkit/BUILD_ALL_NOW.sh"))

@vfkit_app.command("test")
def vfkit_test():
    """Test all VFKit VMs."""
    raise SystemExit(run_script("vfkit/test-all-vms.sh"))

# ============================================================================
# Dev Commands
# ============================================================================

@dev_app.callback(invoke_without_command=True)
def dev_main(ctx: typer.Context):
    """Development tools. Run without subcommand for TUI."""
    if ctx.invoked_subcommand is None:
        raise SystemExit(launch_tui("dev_tools"))

@dev_app.command("install")
def dev_install():
    """Install project dependencies."""
    raise SystemExit(run_script("dev-tools.sh", ["install"]))

@dev_app.command("lint")
def dev_lint():
    """Run linters."""
    raise SystemExit(run_script("dev-tools.sh", ["lint"]))

@dev_app.command("server")
def dev_server():
    """Start development server."""
    raise SystemExit(run_script("dev-tools.sh", ["dev"]))

@dev_app.command("check")
def dev_check():
    """Run all checks (lint + test + build)."""
    raise SystemExit(run_script("dev-tools.sh", ["check"]))

@dev_app.command("ide")
def dev_ide():
    """Launch development IDE."""
    raise SystemExit(run_script("dev/start-ide-universal.sh"))

# ============================================================================
# Setup Commands
# ============================================================================

@setup_app.callback(invoke_without_command=True)
def setup_main(ctx: typer.Context):
    """Setup wizard. Run without subcommand for TUI."""
    if ctx.invoked_subcommand is None:
        raise SystemExit(launch_tui("setup"))

@setup_app.command("database")
def setup_database():
    """Setup PostgreSQL database."""
    raise SystemExit(run_script("setup-database.sh"))

@setup_app.command("secrets")
def setup_secrets():
    """Setup Kubernetes secrets."""
    raise SystemExit(run_script("setup-secrets.sh"))

@setup_app.command("kind")
def setup_kind():
    """Setup KIND Kubernetes cluster."""
    raise SystemExit(run_script("setup-kind-cluster.sh"))

@setup_app.command("azure")
def setup_azure():
    """Setup Azure resources."""
    raise SystemExit(run_script("setup-azure-resources.sh"))

@setup_app.command("homebrew")
def setup_homebrew():
    """Setup Homebrew services."""
    raise SystemExit(run_script("homebrew/setup-all.sh"))

@setup_app.command("all")
def setup_all():
    """Run full automation setup."""
    raise SystemExit(run_script("setup-full-automation.sh"))

# ============================================================================
# Build Commands
# ============================================================================

@build_app.callback(invoke_without_command=True)
def build_main(ctx: typer.Context):
    """Build commands."""
    if ctx.invoked_subcommand is None:
        raise SystemExit(run_script("dev-tools.sh", ["build"]))

@build_app.command("production")
def build_production():
    """Create production build."""
    raise SystemExit(run_script("dev-tools.sh", ["build"]))

@build_app.command("macos")
def build_macos():
    """Build macOS desktop app."""
    raise SystemExit(run_script("desktop/build-macos.sh"))

@build_app.command("linux")
def build_linux():
    """Build Linux desktop packages."""
    raise SystemExit(run_script("desktop/build-linux.sh"))

@build_app.command("desktop")
def build_desktop():
    """Build desktop app for current platform."""
    raise SystemExit(run_script("desktop/build-all.sh"))

@build_app.command("docker")
def build_docker():
    """Build Docker images."""
    raise SystemExit(run_script("cloud/docker/build.sh"))

# ============================================================================
# Test Commands
# ============================================================================

@test_app.callback(invoke_without_command=True)
def test_main(ctx: typer.Context):
    """Test commands."""
    if ctx.invoked_subcommand is None:
        raise SystemExit(run_script("dev-tools.sh", ["test"]))

@test_app.command("unit")
def test_unit():
    """Run unit tests."""
    raise SystemExit(run_script("dev-tools.sh", ["test"]))

@test_app.command("watch")
def test_watch():
    """Run tests in watch mode."""
    raise SystemExit(run_script("dev-tools.sh", ["test", "--watch"]))

@test_app.command("coverage")
def test_coverage():
    """Run tests with coverage."""
    raise SystemExit(run_script("dev-tools.sh", ["test", "--coverage"]))

@test_app.command("integration")
def test_integration():
    """Run integration tests."""
    scripts_dir = get_scripts_dir()
    if (scripts_dir / "consolidated/test/all.py").exists():
        raise SystemExit(run_python_script("consolidated/test/all.py"))
    else:
        console.print("[yellow]Integration test script not found[/yellow]")
        raise SystemExit(1)

@test_app.command("e2e")
def test_e2e():
    """Run end-to-end tests."""
    console.print("[cyan]Running E2E tests...[/cyan]")
    result = subprocess.run(["npm", "run", "test:e2e"], cwd=get_repo_root())
    raise SystemExit(result.returncode)

# ============================================================================
# Deploy Commands
# ============================================================================

@deploy_app.callback(invoke_without_command=True)
def deploy_main(ctx: typer.Context):
    """Deployment commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available deploy commands:[/cyan]")
        console.print("  vibecode deploy docker   - Deploy with Docker Compose")
        console.print("  vibecode deploy k8s      - Deploy to Kubernetes")
        console.print("  vibecode deploy aks      - Deploy to Azure AKS")

@deploy_app.command("docker")
def deploy_docker():
    """Deploy using Docker Compose."""
    raise SystemExit(run_script("cloud/docker/start-compose.sh"))

@deploy_app.command("k8s")
def deploy_k8s(
    namespace: str = Option("vibecode-dev", "--namespace", "-n", help="Kubernetes namespace"),
):
    """Deploy to Kubernetes cluster."""
    console.print(f"[cyan]Deploying to namespace: {namespace}[/cyan]")
    raise SystemExit(run_script("setup-vibecode-cluster.sh"))

@deploy_app.command("aks")
def deploy_aks():
    """Deploy to Azure AKS."""
    raise SystemExit(run_script("aks-bootstrap.sh"))

@deploy_app.command("stop")
def deploy_stop():
    """Stop Docker Compose deployment."""
    raise SystemExit(run_script("cloud/docker/stop-compose.sh"))

# ============================================================================
# Security Commands
# ============================================================================

@security_app.callback(invoke_without_command=True)
def security_main(ctx: typer.Context):
    """Security commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available security commands:[/cyan]")
        console.print("  vibecode security scan     - Run security scan")
        console.print("  vibecode security verify   - Verify Helm charts")
        console.print("  vibecode security secrets  - Check for exposed secrets")

@security_app.command("scan")
def security_scan():
    """Run security scan on codebase."""
    scripts_dir = get_scripts_dir()
    if (scripts_dir / "security/scan.sh").exists():
        raise SystemExit(run_script("security/scan.sh"))
    else:
        console.print("[yellow]Running npm audit...[/yellow]")
        result = subprocess.run(["npm", "audit"], cwd=get_repo_root())
        raise SystemExit(result.returncode)

@security_app.command("verify")
def security_verify():
    """Verify Helm charts."""
    scripts_dir = get_scripts_dir()
    if (scripts_dir / "security/verify_helm.py").exists():
        raise SystemExit(run_python_script("security/verify_helm.py"))
    else:
        console.print("[yellow]Helm verification script not found[/yellow]")

@security_app.command("secrets")
def security_secrets():
    """Check for exposed secrets."""
    raise SystemExit(run_script("cleanup/remove-tracked-secrets.sh"))

# ============================================================================
# Benchmark Commands
# ============================================================================

@benchmark_app.callback(invoke_without_command=True)
def benchmark_main(ctx: typer.Context):
    """Benchmarking commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available benchmark commands:[/cyan]")
        console.print("  vibecode benchmark boot     - Measure boot times")
        console.print("  vibecode benchmark perf     - Run performance tests")
        console.print("  vibecode benchmark vm       - Benchmark VMs")

@benchmark_app.command("boot")
def benchmark_boot():
    """Measure VM boot times."""
    raise SystemExit(run_script("vfkit/compare-boot-times.sh"))

@benchmark_app.command("perf")
def benchmark_perf():
    """Run performance benchmarks."""
    raise SystemExit(run_script("vfkit/comprehensive-performance-test.sh"))

@benchmark_app.command("vm")
def benchmark_vm():
    """Benchmark VM performance."""
    raise SystemExit(run_script("vfkit/test-vm-performance.sh"))

# ============================================================================
# Quick Commands (top-level shortcuts)
# ============================================================================

@app.command("run")
def quick_run():
    """Quick: Start development server."""
    raise SystemExit(run_script("dev-tools.sh", ["dev"]))

@app.command("check")
def quick_check():
    """Quick: Run all checks."""
    raise SystemExit(run_script("dev-tools.sh", ["check"]))

@app.command("install")
def quick_install():
    """Quick: Install dependencies."""
    raise SystemExit(run_script("dev-tools.sh", ["install"]))

# ============================================================================
# Version
# ============================================================================

def version_callback(value: bool):
    if value:
        console.print("[cyan]VibeCode CLI[/cyan] v1.0.0")
        raise typer.Exit()

@app.callback()
def main(
    version: bool = Option(
        None,
        "--version",
        "-v",
        callback=version_callback,
        is_eager=True,
        help="Show version",
    ),
):
    """
    VibeCode CLI - Unified interface for all development tools.

    Run 'vibecode --help' to see all available commands.
    Run 'vibecode tui' to launch the interactive TUI selector.
    """

if __name__ == "__main__":
    app()