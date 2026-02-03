#!/usr/bin/env python3
"""VibeCode Master CLI - Unified command-line interface for all VibeCode tools.

A comprehensive CLI using Typer that provides unified access to all TUIs
and development operations through subcommands.

Usage:
    vibecode --help              Show all commands
    vibecode vfkit               Launch vfkit VM TUI
    vibecode dev                 Launch development tools TUI
    vibecode setup               Launch setup wizard TUI
    vibecode build               Build commands
    vibecode test                Testing commands
    vibecode deploy              Deployment commands
    vibecode security            Security commands
    vibecode benchmark           Benchmarking commands
    vibecode infra               Infrastructure commands
    vibecode validate            Validation commands
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

try:
    import typer
    from typer import Typer, Option, Argument, Context
except ImportError:
    print("Error: typer library is required. Install with: pip install 'typer[all]'")
    sys.exit(1)

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.tree import Tree
    from rich import box
except ImportError:
    print("Error: rich library is required. Install with: pip install rich")
    sys.exit(1)


# Initialize main app
app = Typer(
    name="vibecode",
    help="VibeCode Master CLI - Unified interface for all development tools",
    add_completion=True,
    rich_markup_mode="rich",
    no_args_is_help=True,
)
console = Console()

# Sub-applications for each category
vfkit_app = Typer(help="VFKit VM management and microVM tools")
dev_app = Typer(help="Development tools (build, test, lint, IDE)")
setup_app = Typer(help="Setup wizard and environment configuration")
build_app = Typer(help="Build commands for all platforms")
test_app = Typer(help="Testing and validation commands")
deploy_app = Typer(help="Deployment and release commands")
security_app = Typer(help="Security scanning and verification")
benchmark_app = Typer(help="Performance benchmarking tools")
infra_app = Typer(help="Infrastructure management")
validate_app = Typer(help="Validation and verification tools")

# Register sub-apps
app.add_typer(vfkit_app, name="vfkit")
app.add_typer(dev_app, name="dev")
app.add_typer(setup_app, name="setup")
app.add_typer(build_app, name="build")
app.add_typer(test_app, name="test")
app.add_typer(deploy_app, name="deploy")
app.add_typer(security_app, name="security")
app.add_typer(benchmark_app, name="benchmark")
app.add_typer(infra_app, name="infra")
app.add_typer(validate_app, name="validate")


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


def run_python_script(relative_path: str, args: list[str] | None = None) -> int:
    """Run a Python script and return exit code."""
    scripts_dir = get_scripts_dir()
    script_path = scripts_dir / relative_path
    args = args or []

    if not script_path.exists():
        console.print(f"[red]Script not found: {relative_path}[/red]")
        return 1

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)] + args,
            cwd=get_repo_root(),
        )
        return result.returncode
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
        return 130


def launch_tui(tui_name: str) -> int:
    """Launch a TUI by name."""
    tui_path = f"{tui_name}_tui.py"
    scripts_dir = get_scripts_dir()

    if not (scripts_dir / tui_path).exists():
        console.print(f"[yellow]TUI not found: {tui_path}[/yellow]")
        console.print(f"[dim]Available TUIs:[/dim]")
        for tui in sorted(scripts_dir.glob("*_tui.py")):
            console.print(f"  - {tui.stem}")
        return 1

    return run_python_script(tui_path)


# ============================================================================
# Main Commands
# ============================================================================

@app.command()
def status():
    """Show VibeCode environment status and available tools."""
    repo_root = get_repo_root()
    scripts_dir = get_scripts_dir()

    console.print(Panel("[bold cyan]VibeCode Environment Status[/bold cyan]", box=box.DOUBLE))

    # Environment checks
    table = Table(box=box.SIMPLE, show_header=True)
    table.add_column("Component", style="white")
    table.add_column("Status", justify="center")
    table.add_column("Details", style="dim")

    import shutil

    checks = [
        ("Node Modules", (repo_root / "node_modules").exists(), "npm install"),
        ("Local Environment", (repo_root / ".env.local").exists(), ".env.local"),
        ("Docker", shutil.which("docker") is not None, "Container runtime"),
        ("kubectl", shutil.which("kubectl") is not None, "Kubernetes CLI"),
        ("vfkit", shutil.which("vfkit") is not None, "macOS microVMs"),
        ("Azure CLI", shutil.which("az") is not None, "Azure management"),
        ("Helm", shutil.which("helm") is not None, "K8s package manager"),
    ]

    for name, exists, detail in checks:
        status_icon = "\u2705" if exists else "\u274c"
        table.add_row(name, status_icon, detail)

    console.print(table)

    # Available TUIs
    console.print("\n[bold]Available TUIs:[/bold]")
    tuis = sorted(scripts_dir.glob("*_tui.py"))
    for tui in tuis:
        name = tui.stem.replace("_tui", "")
        console.print(f"  \u2022 vibecode {name}")


@app.command()
def tui():
    """Launch interactive TUI selector."""
    console.clear()
    console.print(Panel("[bold cyan]VibeCode TUI Launcher[/bold cyan]", box=box.DOUBLE))

    scripts_dir = get_scripts_dir()
    tuis = sorted(scripts_dir.glob("*_tui.py"))

    if not tuis:
        console.print("[yellow]No TUIs found[/yellow]")
        return

    tui_descriptions = {
        "vfkit_tui": "VFKit VM management (94 scripts)",
        "dev_tools_tui": "Development tools (build, test, lint)",
        "setup_tui": "Setup wizard (35 setup scripts)",
        "benchmarks_tui": "Performance benchmarking",
        "deployment_tui": "Deployment and releases",
        "security_tui": "Security scanning",
        "testing_tui": "Testing and validation",
        "infrastructure_tui": "Infrastructure management",
        "validation_tui": "Comprehensive validation",
        "build_tui": "Build management",
    }

    table = Table(box=box.ROUNDED, title="Available TUIs")
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("TUI", style="green")
    table.add_column("Description", style="white")

    for i, tui_path in enumerate(tuis, 1):
        name = tui_path.stem
        desc = tui_descriptions.get(name, "TUI interface")
        display_name = name.replace("_tui", "")
        table.add_row(str(i), display_name, desc)

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
        run_python_script(tuis[choice - 1].name)


@app.command()
def doctor():
    """Run diagnostic checks on the VibeCode environment."""
    console.print(Panel("[bold cyan]VibeCode Doctor[/bold cyan]", box=box.DOUBLE))
    console.print("Running diagnostic checks...\n")

    import shutil
    repo_root = get_repo_root()

    checks_passed = 0
    checks_failed = 0

    def check(name: str, condition: bool, fix: str = "") -> None:
        nonlocal checks_passed, checks_failed
        if condition:
            console.print(f"  \u2705 {name}")
            checks_passed += 1
        else:
            console.print(f"  \u274c {name}")
            if fix:
                console.print(f"      [dim]Fix: {fix}[/dim]")
            checks_failed += 1

    console.print("[bold]Required Tools:[/bold]")
    check("Node.js", shutil.which("node") is not None, "Install Node.js 20+")
    check("npm", shutil.which("npm") is not None, "Comes with Node.js")
    check("Python 3.10+", sys.version_info >= (3, 10), "Install Python 3.10+")
    check("Git", shutil.which("git") is not None, "Install Git")

    console.print("\n[bold]Project Setup:[/bold]")
    check("package.json", (repo_root / "package.json").exists(), "Missing package.json")
    check("node_modules", (repo_root / "node_modules").exists(), "Run: npm install")
    check(".env.local", (repo_root / ".env.local").exists(), "Copy .env.example to .env.local")

    console.print("\n[bold]Optional Tools:[/bold]")
    check("Docker", shutil.which("docker") is not None, "Install Docker Desktop")
    check("kubectl", shutil.which("kubectl") is not None, "Install kubectl")
    check("Helm", shutil.which("helm") is not None, "Install Helm")
    check("vfkit", shutil.which("vfkit") is not None, "brew install vfkit (macOS)")
    check("Azure CLI", shutil.which("az") is not None, "Install Azure CLI")

    console.print(f"\n[bold]Summary:[/bold] {checks_passed} passed, {checks_failed} failed")

    if checks_failed > 0:
        console.print("\n[yellow]Some checks failed. Review the fixes above.[/yellow]")
        raise SystemExit(1)
    else:
        console.print("\n[green]All checks passed![/green]")


# ============================================================================
# VFKit Commands
# ============================================================================

@vfkit_app.callback(invoke_without_command=True)
def vfkit_main(ctx: Context):
    """VFKit VM management. Run without subcommand for TUI."""
    if ctx.invoked_subcommand is None:
        raise SystemExit(launch_tui("vfkit"))


@vfkit_app.command("start")
def vfkit_start(vm: str = Argument("all", help="VM name or 'all'")):
    """Start VFKit VM(s)."""
    if vm == "all":
        raise SystemExit(run_script("vfkit/start-all-vms.sh"))
    raise SystemExit(run_script(f"vfkit/launch-{vm}.sh"))


@vfkit_app.command("stop")
def vfkit_stop():
    """Stop all VFKit VMs."""
    raise SystemExit(run_script("vfkit/stop-all-vms.sh"))


@vfkit_app.command("list")
def vfkit_list():
    """List available VFKit VMs."""
    scripts_dir = get_scripts_dir()
    vfkit_dir = scripts_dir / "vfkit"

    console.print("[bold]Available VMs:[/bold]")
    for script in sorted(vfkit_dir.glob("launch-*.sh")):
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


@vfkit_app.command("health")
def vfkit_health():
    """Run VM health checks."""
    raise SystemExit(run_script("vfkit/vm-health-check.sh"))


# ============================================================================
# Dev Commands
# ============================================================================

@dev_app.callback(invoke_without_command=True)
def dev_main(ctx: Context):
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
def setup_main(ctx: Context):
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


@setup_app.command("full")
def setup_full():
    """Run full automation setup."""
    raise SystemExit(run_script("setup-full-automation.sh"))


# ============================================================================
# Build Commands
# ============================================================================

@build_app.callback(invoke_without_command=True)
def build_main(ctx: Context):
    """Build commands. Run without subcommand for production build."""
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


@build_app.command("vm")
def build_vm():
    """Build VM images."""
    raise SystemExit(run_script("macos-vm/build.py"))


# ============================================================================
# Test Commands
# ============================================================================

@test_app.callback(invoke_without_command=True)
def test_main(ctx: Context):
    """Test commands. Run without subcommand for unit tests."""
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
    raise SystemExit(run_python_script("consolidated/test/all.py", ["integration"]))


@test_app.command("e2e")
def test_e2e():
    """Run end-to-end tests."""
    result = subprocess.run(["npm", "run", "test:e2e"], cwd=get_repo_root())
    raise SystemExit(result.returncode)


@test_app.command("all")
def test_all():
    """Run all tests."""
    raise SystemExit(run_python_script("consolidated/test/all.py", ["all"]))


# ============================================================================
# Deploy Commands
# ============================================================================

@deploy_app.callback(invoke_without_command=True)
def deploy_main(ctx: Context):
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
def deploy_k8s(namespace: str = Option("vibecode-dev", "-n", "--namespace")):
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
def security_main(ctx: Context):
    """Security commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available security commands:[/cyan]")
        console.print("  vibecode security scan     - Run security scan")
        console.print("  vibecode security verify   - Verify Helm charts")
        console.print("  vibecode security secrets  - Check for exposed secrets")
        console.print("  vibecode security audit    - Run npm audit")


@security_app.command("scan")
def security_scan():
    """Run security scan on codebase."""
    console.print("[cyan]Running npm audit...[/cyan]")
    result = subprocess.run(["npm", "audit"], cwd=get_repo_root())
    raise SystemExit(result.returncode)


@security_app.command("verify")
def security_verify():
    """Verify Helm charts."""
    raise SystemExit(run_python_script("security/verify_helm.py"))


@security_app.command("secrets")
def security_secrets():
    """Check for exposed secrets."""
    raise SystemExit(run_script("cleanup/remove-tracked-secrets.sh"))


@security_app.command("audit")
def security_audit():
    """Run full security audit."""
    console.print("[cyan]Running security audit...[/cyan]")
    subprocess.run(["npm", "audit", "--audit-level=high"], cwd=get_repo_root())
    raise SystemExit(run_script("cleanup/remove-tracked-secrets.sh"))


# ============================================================================
# Benchmark Commands
# ============================================================================

@benchmark_app.callback(invoke_without_command=True)
def benchmark_main(ctx: Context):
    """Benchmarking commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available benchmark commands:[/cyan]")
        console.print("  vibecode benchmark boot   - Measure boot times")
        console.print("  vibecode benchmark perf   - Run performance tests")
        console.print("  vibecode benchmark vm     - Benchmark VMs")


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


@benchmark_app.command("desktop")
def benchmark_desktop():
    """Benchmark desktop app."""
    raise SystemExit(run_python_script("benchmark_desktop.py"))


# ============================================================================
# Infrastructure Commands
# ============================================================================

@infra_app.callback(invoke_without_command=True)
def infra_main(ctx: Context):
    """Infrastructure commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available infra commands:[/cyan]")
        console.print("  vibecode infra validate  - Validate infrastructure")
        console.print("  vibecode infra kind      - Manage KIND cluster")
        console.print("  vibecode infra docker    - Docker management")


@infra_app.command("validate")
def infra_validate():
    """Validate infrastructure setup."""
    raise SystemExit(run_python_script("validate-infrastructure.py"))


@infra_app.command("kind")
def infra_kind():
    """Setup KIND cluster."""
    raise SystemExit(run_script("setup-kind-cluster.sh"))


@infra_app.command("docker-up")
def infra_docker_up():
    """Start Docker services."""
    raise SystemExit(run_script("cloud/docker/start-compose.sh"))


@infra_app.command("docker-down")
def infra_docker_down():
    """Stop Docker services."""
    raise SystemExit(run_script("cloud/docker/stop-compose.sh"))


# ============================================================================
# Validate Commands
# ============================================================================

@validate_app.callback(invoke_without_command=True)
def validate_main(ctx: Context):
    """Validation commands."""
    if ctx.invoked_subcommand is None:
        console.print("[cyan]Available validate commands:[/cyan]")
        console.print("  vibecode validate infra    - Validate infrastructure")
        console.print("  vibecode validate azure    - Validate Azure deployment")
        console.print("  vibecode validate health   - Check health endpoints")
        console.print("  vibecode validate all      - Run all validations")


@validate_app.command("infra")
def validate_infra():
    """Validate infrastructure."""
    raise SystemExit(run_python_script("validate-infrastructure.py"))


@validate_app.command("azure")
def validate_azure():
    """Validate Azure deployment."""
    raise SystemExit(run_python_script("azure_deployment_validation.py"))


@validate_app.command("health")
def validate_health():
    """Check health endpoints."""
    raise SystemExit(run_python_script("verify_health_endpoints.py"))


@validate_app.command("comprehensive")
def validate_comprehensive():
    """Run comprehensive validation."""
    raise SystemExit(run_python_script("comprehensive_validation.py"))


@validate_app.command("all")
def validate_all():
    """Run all validations."""
    console.print("[cyan]Running all validations...[/cyan]")
    run_python_script("validate-infrastructure.py")
    run_python_script("verify_health_endpoints.py")
    run_python_script("comprehensive_validation.py")


# ============================================================================
# Quick Commands
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
        console.print("[cyan]VibeCode Master CLI[/cyan] v1.0.0")
        console.print("[dim]Unified interface for all VibeCode tools[/dim]")
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
    VibeCode Master CLI - Unified interface for all development tools.

    \b
    Quick Start:
      vibecode status      - Show environment status
      vibecode doctor      - Run diagnostic checks
      vibecode tui         - Launch TUI selector
      vibecode run         - Start dev server
      vibecode check       - Run all checks

    \b
    Categories:
      vfkit      - VM management
      dev        - Development tools
      setup      - Environment setup
      build      - Build commands
      test       - Testing
      deploy     - Deployment
      security   - Security scanning
      benchmark  - Performance testing
      infra      - Infrastructure
      validate   - Validation tools
    """
    pass


if __name__ == "__main__":
    app()
