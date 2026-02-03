#!/usr/bin/env python3
"""VibeCode Platform Monitoring Stack Deployment Script.

Deploys observability infrastructure using Prometheus and Datadog.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import NoReturn


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()


@dataclass
class DeployConfig:
    """Deployment configuration."""

    environment: str = field(default_factory=lambda: os.environ.get("ENVIRONMENT", "production"))
    namespace: str = field(default_factory=lambda: os.environ.get("NAMESPACE", "vibecode-monitoring"))
    deploy_method: str = field(default_factory=lambda: os.environ.get("DEPLOY_METHOD", "docker-compose"))
    dd_api_key: str = field(default_factory=lambda: os.environ.get("DD_API_KEY", ""))
    datadog_api_key: str = field(default_factory=lambda: os.environ.get("DATADOG_API_KEY", ""))
    effective_dd_api_key: str = ""

    def resolve_api_key(self) -> None:
        """Resolve the effective Datadog API key."""
        if self.dd_api_key and self.datadog_api_key and self.dd_api_key != self.datadog_api_key:
            log_warn("Both DD_API_KEY and DATADOG_API_KEY are set and differ; preferring DD_API_KEY")
        self.effective_dd_api_key = self.dd_api_key or self.datadog_api_key


def get_paths() -> tuple[Path, Path]:
    """Get script directory and monitoring directory."""
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    monitoring_dir = project_root / "monitoring"
    return script_dir, monitoring_dir


def get_timestamp() -> str:
    """Get formatted timestamp."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(message: str) -> None:
    """Print green log message with timestamp."""
    print(f"{COLORS.green}[{get_timestamp()}] {message}{COLORS.reset}")


def log_warn(message: str) -> None:
    """Print yellow warning message with timestamp."""
    print(f"{COLORS.yellow}[{get_timestamp()}] WARNING: {message}{COLORS.reset}")


def log_error(message: str) -> NoReturn:
    """Print red error message with timestamp and exit."""
    print(f"{COLORS.red}[{get_timestamp()}] ERROR: {message}{COLORS.reset}")
    sys.exit(1)


def log_info(message: str) -> None:
    """Print blue info message with timestamp."""
    print(f"{COLORS.blue}[{get_timestamp()}] INFO: {message}{COLORS.reset}")


def check_command(cmd: str) -> bool:
    """Check if a command is available."""
    return shutil.which(cmd) is not None


def check_prerequisites(config: DeployConfig) -> None:
    """Check that required tools are installed.

    Args:
        config: Deployment configuration.

    Raises:
        SystemExit: If a required command is missing.
    """
    log("Checking prerequisites...")

    required_commands = ["docker"]

    if config.deploy_method == "kubernetes":
        required_commands.extend(["kubectl", "helm"])
    elif config.deploy_method == "docker-compose":
        required_commands.append("docker-compose")

    for cmd in required_commands:
        if not check_command(cmd):
            log_error(f"{cmd} is required but not installed")

    # Check Docker is running
    result = subprocess.run(
        ["docker", "info"],
        capture_output=True,
    )
    if result.returncode != 0:
        log_error("Docker is not running or not accessible")

    log("Prerequisites check passed \u2705")


def validate_environment(config: DeployConfig, monitoring_dir: Path) -> None:
    """Validate environment configuration and write env file.

    Args:
        config: Deployment configuration.
        monitoring_dir: Path to monitoring directory.

    Raises:
        SystemExit: If API key is missing.
    """
    log("Validating environment configuration...")

    config.resolve_api_key()

    if not config.effective_dd_api_key:
        log_error("Datadog API key is required. Set DD_API_KEY (preferred) or DATADOG_API_KEY, or provide with -d flag.")

    # Write env file
    monitoring_dir.mkdir(parents=True, exist_ok=True)
    env_file = monitoring_dir / ".env"
    env_file.write_text(
        f"DD_API_KEY={config.effective_dd_api_key}\n"
        f"DATADOG_API_KEY={config.effective_dd_api_key}\n"
    )

    log("Environment validation passed \u2705")


def deploy_kubernetes(config: DeployConfig, monitoring_dir: Path) -> None:
    """Deploy to Kubernetes using Helm.

    Args:
        config: Deployment configuration.
        monitoring_dir: Path to monitoring directory.
    """
    log("Deploying to Kubernetes...")

    # Ensure namespace exists
    log(f"Ensuring Kubernetes namespace '{config.namespace}' exists...")
    result = subprocess.run(
        ["kubectl", "get", "ns", config.namespace],
        capture_output=True,
    )
    if result.returncode != 0:
        subprocess.run(
            ["kubectl", "create", "namespace", config.namespace],
            check=True,
        )

    # Update Helm repos
    log("Updating Helm repositories...")
    subprocess.run(
        ["helm", "repo", "add", "prometheus-community", "https://prometheus-community.github.io/helm-charts"],
        capture_output=True,
    )
    subprocess.run(
        ["helm", "repo", "add", "datadog", "https://helm.datadoghq.com"],
        capture_output=True,
    )
    subprocess.run(["helm", "repo", "update"], check=True)

    # Deploy Prometheus
    log("Deploying Prometheus...")
    prometheus_values = monitoring_dir / "prometheus-helm-values.yml"
    prometheus_args = [
        "helm", "upgrade", "--install", "prometheus", "prometheus-community/prometheus",
        "--namespace", config.namespace,
        "--set", "alertmanager.enabled=false",
        "--set", "grafana.enabled=false",
        "--set", "pushgateway.enabled=false",
        "--atomic",
        "--wait",
    ]
    if prometheus_values.exists():
        prometheus_args.extend(["--values", str(prometheus_values)])

    subprocess.run(prometheus_args, check=True)

    # Deploy Datadog agent
    log("Deploying Datadog agent with log collection enabled...")
    subprocess.run([
        "helm", "upgrade", "--install", "datadog-agent", "datadog/datadog",
        "--namespace", config.namespace,
        "--set", f"datadog.apiKey={config.effective_dd_api_key}",
        "--set", "datadog.site=datadoghq.com",
        "--set", "datadog.logs.enabled=true",
        "--set", "datadog.logs.containerCollectAll=true",
        "--set", "clusterAgent.enabled=true",
        "--set", "clusterAgent.metrics.enabled=true",
        "--set", "metrics-server.enabled=true",
        "--atomic",
        "--wait",
    ], check=True)

    log("Kubernetes deployment completed \u2705")


def deploy_docker_compose(monitoring_dir: Path) -> None:
    """Deploy using Docker Compose.

    Args:
        monitoring_dir: Path to monitoring directory.
    """
    log("Deploying with Docker Compose...")

    compose_file = monitoring_dir / "docker-compose.yml"
    if not compose_file.exists():
        log_error(f"Docker Compose file not found: {compose_file}")

    subprocess.run([
        "docker-compose",
        "-f", str(compose_file),
        "up", "-d", "--remove-orphans",
    ], check=True)

    log("Docker Compose deployment completed \u2705")


def display_access_info() -> None:
    """Display access information for deployed services."""
    print()
    log("--- Access Information ---")
    log_info("Prometheus: http://localhost:9090")
    log_info("Datadog:    https://app.datadoghq.com/")
    print("-----------------------------------")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="VibeCode Platform Monitoring Stack Deployment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s -d <your-datadog-api-key>                    # Deploy with Docker Compose
  %(prog)s -m kubernetes -n monitoring -d <your-key>   # Deploy to Kubernetes
""",
    )
    parser.add_argument(
        "-e", "--environment",
        default=os.environ.get("ENVIRONMENT", "production"),
        help="Environment (default: production)",
    )
    parser.add_argument(
        "-m", "--method",
        dest="deploy_method",
        default=os.environ.get("DEPLOY_METHOD", "docker-compose"),
        choices=["docker-compose", "kubernetes"],
        help="Deployment method (default: docker-compose)",
    )
    parser.add_argument(
        "-n", "--namespace",
        default=os.environ.get("NAMESPACE", "vibecode-monitoring"),
        help="Kubernetes namespace (default: vibecode-monitoring)",
    )
    parser.add_argument(
        "-d", "--datadog-key",
        dest="dd_api_key",
        default="",
        help="Datadog API key (sets DD_API_KEY)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    # Build config from args and environment
    config = DeployConfig(
        environment=args.environment,
        namespace=args.namespace,
        deploy_method=args.deploy_method,
        dd_api_key=args.dd_api_key or os.environ.get("DD_API_KEY", ""),
        datadog_api_key=os.environ.get("DATADOG_API_KEY", ""),
    )

    _, monitoring_dir = get_paths()

    log("Starting VibeCode Platform Monitoring Deployment")
    log(f"Environment: {config.environment}")
    log(f"Deploy Method: {config.deploy_method}")
    if config.deploy_method == "kubernetes":
        log(f"Namespace: {config.namespace}")
    print()

    check_prerequisites(config)
    validate_environment(config, monitoring_dir)

    if config.deploy_method == "docker-compose":
        deploy_docker_compose(monitoring_dir)
    elif config.deploy_method == "kubernetes":
        deploy_kubernetes(config, monitoring_dir)
    else:
        log_error(f"Unknown deploy method: {config.deploy_method}")

    display_access_info()
    log("Monitoring deployment completed successfully! \U0001f680")

    return 0


if __name__ == "__main__":
    sys.exit(main())
