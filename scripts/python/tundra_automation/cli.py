#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "tundra-cli"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "tundra", "cluster": "tundra-dome"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Tundra Dome Automation CLI

A unified command-line interface for deploying, managing, and validating
Datadog-monitored Kubernetes clusters.

Commands:
    deploy      Deploy Datadog agent to a cluster
    teardown    Remove Datadog deployment from a cluster
    status      Check deployment status
    validate    Validate metrics are flowing in Datadog
    prereqs     Check/install prerequisites

Usage:
    tundra-deploy.py deploy my-cluster
    tundra-deploy.py status my-cluster
    tundra-deploy.py validate my-cluster --timeout 10
    tundra-deploy.py prereqs
"""

# Datadog APM tracing - auto-detects local agent
import os

os.environ.setdefault("DD_SERVICE", "tundra-automation")
os.environ.setdefault("DD_ENV", "development")

try:
    from ddtrace import tracer, patch_all

    patch_all()
    _TRACING_ENABLED = True
except ImportError:
    tracer = None
    _TRACING_ENABLED = False

import argparse
import sys
from typing import Optional


# ANSI color codes for terminal output
class Colors:
    """ANSI color codes for terminal output."""

    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    # Foreground colors
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

    # Background colors
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"

    @classmethod
    def disable(cls):
        """Disable all colors (for non-TTY output)."""
        cls.RESET = ""
        cls.BOLD = ""
        cls.DIM = ""
        cls.RED = ""
        cls.GREEN = ""
        cls.YELLOW = ""
        cls.BLUE = ""
        cls.MAGENTA = ""
        cls.CYAN = ""
        cls.WHITE = ""
        cls.BG_RED = ""
        cls.BG_GREEN = ""
        cls.BG_YELLOW = ""
        cls.BG_BLUE = ""


def print_success(message: str) -> None:
    """Print a success message in green."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.RESET} {message}")


def print_error(message: str) -> None:
    """Print an error message in red."""
    print(f"{Colors.RED}[ERROR]{Colors.RESET} {message}", file=sys.stderr)


def print_warning(message: str) -> None:
    """Print a warning message in yellow."""
    print(f"{Colors.YELLOW}[WARNING]{Colors.RESET} {message}")


def print_info(message: str) -> None:
    """Print an info message in blue."""
    print(f"{Colors.BLUE}[INFO]{Colors.RESET} {message}")


def print_step(step: int, total: int, message: str) -> None:
    """Print a step progress message."""
    print(f"{Colors.CYAN}[{step}/{total}]{Colors.RESET} {message}")


def print_header(title: str) -> None:
    """Print a section header."""
    print()
    print(f"{Colors.BOLD}{Colors.MAGENTA}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.MAGENTA}  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.MAGENTA}{'=' * 60}{Colors.RESET}")
    print()


def confirm_action(message: str, default: bool = False) -> bool:
    """Ask for user confirmation.

    Args:
        message: The confirmation message
        default: Default value if user presses Enter

    Returns:
        True if confirmed, False otherwise
    """
    default_hint = "[Y/n]" if default else "[y/N]"
    try:
        response = input(f"{message} {default_hint}: ").strip().lower()
        if not response:
            return default
        return response in ("y", "yes")
    except (KeyboardInterrupt, EOFError):
        print()
        return False


def cmd_prereqs(args: argparse.Namespace) -> int:
    """Check and optionally install prerequisites.

    Args:
        args: Parsed command line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    from .prerequisites import PrerequisitesChecker, ToolStatus

    print_header("Prerequisites Check")

    checker = PrerequisitesChecker(verbose=args.verbose)
    result = checker.check_all()

    # Display tool status
    for tool_name, tool_result in result.tools.items():
        if tool_result.status == ToolStatus.INSTALLED:
            version_str = f" ({tool_result.version})" if tool_result.version else ""
            print_success(f"{tool_name}{version_str}")
            if args.verbose and tool_result.path:
                print_info(f"  Path: {tool_result.path}")
        elif tool_result.status == ToolStatus.NOT_INSTALLED:
            print_error(f"{tool_name}: NOT INSTALLED")
        elif tool_result.status == ToolStatus.NOT_RUNNING:
            print_warning(f"{tool_name}: NOT RUNNING")
            if tool_result.message:
                print_info(f"  {tool_result.message}")
        else:
            print_warning(f"{tool_name}: {tool_result.status.value}")

    # Docker resources
    if result.docker_resources:
        print()
        print_info("Docker Resources:")
        res = result.docker_resources
        if res.get("error"):
            print_warning(f"  Error: {res['error']}")
        else:
            disk_gb = res.get("disk_space_gb", 0)
            total_gb = res.get("disk_total_gb", 0)
            sufficient = res.get("sufficient", False)
            status_icon = Colors.GREEN if sufficient else Colors.YELLOW
            print(f"  Disk Space: {status_icon}{disk_gb:.1f} GB{Colors.RESET} / {total_gb:.1f} GB")

    # Issues and warnings
    if result.issues:
        print()
        print_error("Issues found:")
        for issue in result.issues:
            print(f"  - {issue}")

    if result.warnings:
        print()
        print_warning("Warnings:")
        for warning in result.warnings:
            print(f"  - {warning}")

    # Summary
    print()
    if result.success:
        print_success("All prerequisites are satisfied!")
        return 0
    else:
        print_error("Prerequisites check failed. Please resolve the issues above.")

        # Show installation hints for missing tools
        missing = checker.get_missing_tools()
        if missing:
            print()
            print_info("To install missing tools via Homebrew (macOS):")
            for tool in missing:
                tool_config = checker.REQUIRED_TOOLS.get(tool, {})
                brew_name = tool_config.get("brew_name", tool)
                is_cask = tool_config.get("brew_cask", False)
                if is_cask:
                    print(f"  brew install --cask {brew_name}")
                else:
                    print(f"  brew install {brew_name}")

        return 1


def cmd_deploy(args: argparse.Namespace) -> int:
    """Deploy Datadog agent to a cluster.

    Args:
        args: Parsed command line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    from .prerequisites import PrerequisitesChecker
    from .bootstrap import BootstrapOrchestrator

    cluster_name = args.cluster_name
    print_header(f"Deploying Tundra Dome: {cluster_name}")

    # Step 1: Check prerequisites
    print_step(1, 4, "Checking prerequisites...")
    checker = PrerequisitesChecker(verbose=args.verbose)
    result = checker.check_all()

    if not result.success:
        missing = checker.get_missing_tools()
        print_error(f"Missing required tools: {', '.join(missing)}")
        print_info("Run 'prereqs' command to see installation instructions")
        return 1
    print_success("Prerequisites OK")

    # Step 2: Check Datadog API key
    print_step(2, 4, "Checking Datadog credentials...")
    api_key = os.environ.get("DD_API_KEY")
    if not api_key:
        # Try to read from file
        api_key_file = os.path.expanduser("~/.datadog/api_key")
        if os.path.exists(api_key_file):
            with open(api_key_file) as f:
                api_key = f.read().strip()
                os.environ["DD_API_KEY"] = api_key

    if api_key:
        print_success("Datadog API key available")
        if args.verbose:
            print_info(f"  API Key: {api_key[:8]}...")
    else:
        print_warning("DD_API_KEY not set - Datadog features will be limited")
        if args.yes:
            print_info("Continuing without API key (--yes flag set)")
        else:
            print_error("Set DD_API_KEY or save to ~/.datadog/api_key")
            return 1

    # Step 3: Run full bootstrap
    print_step(3, 4, "Running bootstrap script...")
    print_info("This creates: KIND cluster, Datadog agent, Kafka, Airflow, Observer")
    print()

    orchestrator = BootstrapOrchestrator()

    # Check if cluster exists and offer teardown
    import subprocess
    existing = subprocess.run(
        ["kind", "get", "clusters"],
        capture_output=True, text=True
    ).stdout.strip().split("\n")

    teardown_first = cluster_name in existing
    if teardown_first:
        print_warning(f"Cluster '{cluster_name}' already exists")
        if not args.yes:
            response = input("Tear down and recreate? [y/N]: ").strip().lower()
            if response != "y":
                print_info("Skipping deployment")
                return 0
        print_info("Tearing down existing cluster...")

    # Run the bootstrap
    result = orchestrator.run(
        cluster_name=cluster_name,
        teardown_first=teardown_first,
        timeout_seconds=900,  # 15 minutes
        auto_confirm=args.yes,
    )

    if result.success:
        print_success(f"Bootstrap completed in {result.duration_seconds:.1f}s")
    else:
        print_error(f"Bootstrap failed: {result.error_message}")
        if result.diagnostics:
            print_info("Diagnostics:")
            for diag in result.diagnostics:
                print_info(f"  - {diag}")
        return 1

    # Step 4: Validate deployment
    print_step(4, 4, "Validating deployment...")

    status = orchestrator.get_cluster_status(cluster_name)
    if status.get("healthy", False):
        print_success("Cluster is healthy")
    else:
        print_warning("Cluster may still be initializing")

    # Final status
    print()
    print_header("Deployment Complete")
    print_info(f"Cluster: kind-{cluster_name}")
    print_info(f"Context: kind-{cluster_name}")
    print_info(f"Nodes: {len(status.get('nodes', []))}")
    print_info(f"Pods: {status.get('tundra_dome_pods', 0)} (tundra-dome) + {status.get('datadog_pods', 0)} (datadog)")

    print()
    print_success(f"Tundra Dome '{cluster_name}' is deployed!")
    print_info("Run 'validate' command to check metrics in Datadog")
    print_info(f"  python3 scripts/tundra-deploy.py validate {cluster_name}")

    return 0


def cmd_teardown(args: argparse.Namespace) -> int:
    """Remove Datadog deployment from a cluster.

    Args:
        args: Parsed command line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    from .bootstrap import TundraBootstrap, DeploymentStatus

    cluster_name = args.cluster_name
    print_header(f"Tearing Down: {cluster_name}")

    # Confirmation
    if not args.yes:
        if not confirm_action(f"Remove Datadog deployment from '{cluster_name}'?"):
            print_info("Teardown cancelled")
            return 0

    bootstrap = TundraBootstrap(cluster_name=cluster_name, verbose=args.verbose)

    # Check if deployed
    status = bootstrap.get_deployment_status()
    if not status.get("deployed"):
        print_warning("No Datadog deployment found")
        return 0

    print_info("Removing Datadog agent...")
    result = bootstrap.teardown()

    if result.status == DeploymentStatus.ROLLED_BACK:
        print_success(f"Teardown completed in {result.elapsed_seconds:.1f}s")
        return 0
    else:
        print_error(f"Teardown failed: {result.message}")
        return 1


def cmd_status(args: argparse.Namespace) -> int:
    """Check deployment status.

    Args:
        args: Parsed command line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    from .bootstrap import TundraBootstrap

    cluster_name = args.cluster_name
    print_header(f"Status: {cluster_name}")

    bootstrap = TundraBootstrap(cluster_name=cluster_name, verbose=args.verbose)
    status = bootstrap.get_deployment_status()

    if status.get("deployed"):
        print_success("Datadog agent is deployed")
        print()
        print_info(f"Release: {status.get('release_name', 'N/A')}")
        print_info(f"Chart: {status.get('chart', 'N/A')}")
        print_info(f"App Version: {status.get('app_version', 'N/A')}")
        print_info(f"Helm Status: {status.get('status', 'N/A')}")
        print()

        pods = status.get("pods", [])
        if pods:
            print_info(f"Pods ({len(pods)}):")
            for pod in pods:
                pod_status = (
                    f"{Colors.GREEN}Ready{Colors.RESET}"
                    if pod.get("ready")
                    else f"{Colors.YELLOW}{pod.get('phase', 'Unknown')}{Colors.RESET}"
                )
                print(f"  - {pod.get('name', 'unknown')}: {pod_status}")
        else:
            print_warning("No pods found")

        if status.get("ready"):
            print()
            print_success("Deployment is healthy!")
            return 0
        else:
            print()
            print_warning("Some pods are not ready")
            return 1
    else:
        print_warning("Datadog agent is not deployed")
        return 1


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate metrics are flowing in Datadog.

    Args:
        args: Parsed command line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    cluster_name = args.cluster_name
    print_header(f"Validating Metrics: {cluster_name}")

    # Check for required credentials
    api_key = os.environ.get("DD_API_KEY")
    app_key = os.environ.get("DD_APP_KEY")

    if not api_key or not app_key:
        print_error("DD_API_KEY and DD_APP_KEY environment variables are required")
        print_info("Set these variables to validate metrics in Datadog")
        return 1

    try:
        from .metrics_validator import MetricsValidator
    except ValueError as e:
        print_error(f"Failed to initialize validator: {e}")
        return 1

    print_info(f"Timeout: {args.timeout} minutes")
    print_info(f"Poll interval: {args.interval} seconds")
    print()

    try:
        with MetricsValidator() as validator:
            if args.check_only:
                print_info("Running single check (no wait)...")
                from .metrics_validator import ValidationResult

                result = ValidationResult(cluster_name=cluster_name)
                result.k8s_result = validator.check_k8s_metrics(cluster_name)
                result.kafka_result = validator.check_kafka_metrics(cluster_name)
                result.airflow_result = validator.check_airflow_metrics(cluster_name)
            else:
                print_info("Waiting for metrics to flow...")
                result = validator.wait_for_metrics(
                    cluster_name=cluster_name,
                    timeout_minutes=args.timeout,
                    poll_interval_seconds=args.interval,
                    require_all=args.require_all,
                )

            # Print results
            print()
            print_header("Validation Results")

            # Kubernetes
            if result.k8s_result:
                if result.k8s_result.healthy:
                    print_success(f"Kubernetes: {result.k8s_result}")
                else:
                    print_error(f"Kubernetes: {result.k8s_result}")
                if args.verbose:
                    if result.k8s_result.metrics_found:
                        print_info(
                            f"  Found: {', '.join(result.k8s_result.metrics_found)}"
                        )
                    if result.k8s_result.metrics_missing:
                        print_warning(
                            f"  Missing: {', '.join(result.k8s_result.metrics_missing)}"
                        )

            # Kafka
            if result.kafka_result:
                if result.kafka_result.healthy:
                    print_success(f"Kafka: {result.kafka_result}")
                else:
                    print_warning(f"Kafka: {result.kafka_result}")

            # Airflow
            if result.airflow_result:
                if result.airflow_result.healthy:
                    print_success(f"Airflow: {result.airflow_result}")
                else:
                    print_warning(f"Airflow: {result.airflow_result}")

            # Summary
            print()
            if result.all_healthy:
                print_success("All metric categories are healthy!")
                return 0
            elif result.any_healthy:
                print_warning(
                    f"Partial success: {', '.join(result.healthy_categories)}"
                )
                if args.require_all:
                    return 1
                return 0
            else:
                print_error("No metrics found for cluster")
                return 1

    except Exception as e:
        print_error(f"Validation failed: {e}")
        if args.verbose:
            import traceback

            traceback.print_exc()
        return 1


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser.

    Returns:
        Configured ArgumentParser
    """
    parser = argparse.ArgumentParser(
        prog="tundra-deploy",
        description="Tundra Dome Automation CLI - Deploy and manage Datadog-monitored Kubernetes clusters",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s prereqs                    Check prerequisites
  %(prog)s deploy my-cluster          Deploy Datadog to cluster
  %(prog)s deploy my-cluster -y       Deploy without confirmation
  %(prog)s status my-cluster          Check deployment status
  %(prog)s validate my-cluster        Validate metrics in Datadog
  %(prog)s teardown my-cluster        Remove deployment
        """,
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Non-interactive mode, assume yes to prompts",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 0.2.0",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        title="commands",
        description="Available commands",
        metavar="COMMAND",
    )

    # prereqs command
    prereqs_parser = subparsers.add_parser(
        "prereqs",
        help="Check and display prerequisites",
        description="Check if all required tools are installed and configured",
    )
    prereqs_parser.set_defaults(func=cmd_prereqs)

    # deploy command
    deploy_parser = subparsers.add_parser(
        "deploy",
        help="Deploy Datadog agent to a cluster",
        description="Full deployment: prerequisites -> credentials -> bootstrap -> validate",
    )
    deploy_parser.add_argument(
        "cluster_name",
        nargs="?",
        default="tundra-dome",
        help="Name of the cluster (default: tundra-dome)",
    )
    deploy_parser.set_defaults(func=cmd_deploy)

    # teardown command
    teardown_parser = subparsers.add_parser(
        "teardown",
        help="Remove Datadog deployment from a cluster",
        description="Uninstall the Datadog Helm release and clean up resources",
    )
    teardown_parser.add_argument(
        "cluster_name",
        nargs="?",
        default="tundra-dome",
        help="Name of the cluster (default: tundra-dome)",
    )
    teardown_parser.set_defaults(func=cmd_teardown)

    # status command
    status_parser = subparsers.add_parser(
        "status",
        help="Check deployment status",
        description="Display current deployment status and pod health",
    )
    status_parser.add_argument(
        "cluster_name",
        nargs="?",
        default="tundra-dome",
        help="Name of the cluster (default: tundra-dome)",
    )
    status_parser.set_defaults(func=cmd_status)

    # validate command
    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate metrics in Datadog",
        description="Check that metrics are flowing correctly in Datadog",
    )
    validate_parser.add_argument(
        "cluster_name",
        nargs="?",
        default="tundra-dome",
        help="Name of the cluster (default: tundra-dome)",
    )
    validate_parser.add_argument(
        "--timeout",
        type=int,
        default=15,
        help="Timeout in minutes (default: 15)",
    )
    validate_parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Poll interval in seconds (default: 30)",
    )
    validate_parser.add_argument(
        "--require-all",
        action="store_true",
        help="Require all metric categories (K8s, Kafka, Airflow) to be healthy",
    )
    validate_parser.add_argument(
        "--check-only",
        action="store_true",
        help="Run a single check without waiting",
    )
    validate_parser.set_defaults(func=cmd_validate)

    return parser


def main(args: Optional[list] = None) -> int:
    """Main entry point for the CLI.

    Args:
        args: Command line arguments (defaults to sys.argv)

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    parser = create_parser()
    parsed_args = parser.parse_args(args)

    # Disable colors if requested or not a TTY
    if parsed_args.no_color or not sys.stdout.isatty():
        Colors.disable()

    # Show help if no command specified
    if not parsed_args.command:
        parser.print_help()
        return 0

    # Run the command
    try:
        return parsed_args.func(parsed_args)
    except KeyboardInterrupt:
        print()
        print_warning("Interrupted by user")
        return 130
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        if parsed_args.verbose:
            import traceback

            traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())