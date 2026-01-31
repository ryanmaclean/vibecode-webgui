#!/usr/bin/env python3
"""
VibeCode Platform Monitoring Stack Deployment Script.

Deploys observability infrastructure using Prometheus and Datadog.
Converts deploy-monitoring.sh to Python with enhanced error handling and Datadog tracing.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

# Datadog APM tracing
try:
    from ddtrace import tracer
except ImportError:
    tracer = None

# Local imports
try:
    from lib.vibecode_common import (
        init_vibecode_script,
        Metrics,
    )
    USE_COMMON = True
except ImportError:
    USE_COMMON = False
    import logging
    logging.basicConfig(level=logging.INFO)


class DeployConfig(NamedTuple):
    """Deployment configuration."""
    environment: str
    deploy_method: str
    namespace: str
    dd_api_key: str
    monitoring_dir: Path


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


def timestamp() -> str:
    """Get current timestamp string."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(message: str) -> None:
    """Log a message."""
    print(f"{Colors.GREEN}[{timestamp()}] {message}{Colors.NC}")


def warn(message: str) -> None:
    """Log a warning message."""
    print(f"{Colors.YELLOW}[{timestamp()}] WARNING: {message}{Colors.NC}")


def error(message: str) -> None:
    """Log an error message."""
    print(f"{Colors.RED}[{timestamp()}] ERROR: {message}{Colors.NC}")


def info(message: str) -> None:
    """Log an info message."""
    print(f"{Colors.BLUE}[{timestamp()}] INFO: {message}{Colors.NC}")


def run(
    cmd: list[str],
    *,
    capture_output: bool = False,
    check: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command with proper error handling."""
    try:
        return subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            check=check,
            cwd=cwd,
        )
    except subprocess.CalledProcessError as exc:
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def check_prerequisites(config: DeployConfig) -> None:
    """Check that all prerequisites are met."""
    log("Checking prerequisites...")

    required_commands = ["docker"]

    if config.deploy_method == "kubernetes":
        required_commands.extend(["kubectl", "helm"])
    elif config.deploy_method == "docker-compose":
        required_commands.append("docker-compose")

    for cmd in required_commands:
        if not shutil.which(cmd):
            raise CommandError(f"{cmd} is required but not installed")

    try:
        run(["docker", "info"], capture_output=True)
    except CommandError:
        raise CommandError("Docker is not running or not accessible")

    log("Prerequisites check passed")


def resolve_dd_api_key() -> str:
    """Resolve the Datadog API key from environment variables."""
    dd_key = os.environ.get("DD_API_KEY", "")
    datadog_key = os.environ.get("DATADOG_API_KEY", "")

    if dd_key and datadog_key and dd_key != datadog_key:
        warn("Both DD_API_KEY and DATADOG_API_KEY are set and differ; preferring DD_API_KEY")

    return dd_key or datadog_key


def validate_environment(config: DeployConfig) -> None:
    """Validate environment configuration."""
    log("Validating environment configuration...")

    if not config.dd_api_key:
        raise CommandError(
            "Datadog API key is required. Set DD_API_KEY (preferred) or DATADOG_API_KEY, "
            "or provide with -d flag."
        )

    # Write environment file for compatibility
    env_file = config.monitoring_dir / ".env"
    env_file.write_text(f"""\
DD_API_KEY={config.dd_api_key}
DATADOG_API_KEY={config.dd_api_key}
""")

    log("Environment validation passed")


def deploy_kubernetes(config: DeployConfig) -> None:
    """Deploy monitoring stack to Kubernetes."""
    log("Deploying to Kubernetes...")
    log(f"Ensuring Kubernetes namespace '{config.namespace}' exists...")

    try:
        run(["kubectl", "get", "ns", config.namespace], capture_output=True)
    except CommandError:
        run(["kubectl", "create", "namespace", config.namespace])

    log("Updating Helm repositories...")
    run(["helm", "repo", "add", "prometheus-community", "https://prometheus-community.github.io/helm-charts"])
    run(["helm", "repo", "add", "datadog", "https://helm.datadoghq.com"])
    run(["helm", "repo", "update"])

    log("Deploying Prometheus...")
    prometheus_values = config.monitoring_dir / "prometheus-helm-values.yml"
    helm_cmd = [
        "helm", "upgrade", "--install", "prometheus",
        "prometheus-community/prometheus",
        "--namespace", config.namespace,
        "--set", "alertmanager.enabled=false",
        "--set", "grafana.enabled=false",
        "--set", "pushgateway.enabled=false",
        "--atomic",
        "--wait",
    ]
    if prometheus_values.exists():
        helm_cmd.extend(["--values", str(prometheus_values)])

    run(helm_cmd)

    log("Deploying Datadog agent with log collection enabled...")
    run([
        "helm", "upgrade", "--install", "datadog-agent",
        "datadog/datadog",
        "--namespace", config.namespace,
        "--set", f"datadog.apiKey={config.dd_api_key}",
        "--set", "datadog.site=datadoghq.com",
        "--set", "datadog.logs.enabled=true",
        "--set", "datadog.logs.containerCollectAll=true",
        "--set", "clusterAgent.enabled=true",
        "--set", "clusterAgent.metrics.enabled=true",
        "--set", "metrics-server.enabled=true",
        "--atomic",
        "--wait",
    ])

    log("Kubernetes deployment completed")


def deploy_docker_compose(config: DeployConfig) -> None:
    """Deploy monitoring stack with Docker Compose."""
    log("Deploying with Docker Compose...")

    compose_file = config.monitoring_dir / "docker-compose.yml"
    if not compose_file.exists():
        raise CommandError(f"Docker Compose file not found: {compose_file}")

    run([
        "docker-compose", "-f", str(compose_file),
        "up", "-d", "--remove-orphans",
    ])

    log("Docker Compose deployment completed")


def display_access_info() -> None:
    """Display access information."""
    print()
    log("--- Access Information ---")
    info("Prometheus: http://localhost:9090")
    info("Datadog:    https://app.datadoghq.com/")
    print("-----------------------------------")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="VibeCode Platform Monitoring Stack Deployment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python deploy_monitoring.py -d <your-datadog-api-key>                      # Deploy with Docker Compose
  python deploy_monitoring.py -m kubernetes -n monitoring -d <your-key>      # Deploy to Kubernetes
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

    # Initialize logging and tracing
    metrics = None
    if USE_COMMON:
        logger, config_mgr, metrics, shutdown = init_vibecode_script(
            "deploy_monitoring",
            service_name="vibecode-monitoring-deployment",
        )

    # Resolve Datadog API key
    dd_api_key = args.dd_api_key or resolve_dd_api_key()

    # Determine paths
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent
    monitoring_dir = project_root / "monitoring"

    config = DeployConfig(
        environment=args.environment,
        deploy_method=args.deploy_method,
        namespace=args.namespace,
        dd_api_key=dd_api_key,
        monitoring_dir=monitoring_dir,
    )

    log("Starting VibeCode Platform Monitoring Deployment")
    log(f"Environment: {config.environment}")
    log(f"Deploy Method: {config.deploy_method}")
    if config.deploy_method == "kubernetes":
        log(f"Namespace: {config.namespace}")
    print()

    try:
        check_prerequisites(config)
        validate_environment(config)

        if config.deploy_method == "docker-compose":
            deploy_docker_compose(config)
        elif config.deploy_method == "kubernetes":
            deploy_kubernetes(config)
        else:
            raise CommandError(f"Unknown deploy method: {config.deploy_method}")

        display_access_info()

        if metrics:
            metrics.increment(
                "monitoring.deployment.success",
                tags=[f"method:{config.deploy_method}", f"environment:{config.environment}"],
            )

        log("Monitoring deployment completed successfully!")

    except CommandError as e:
        error(str(e))
        if metrics:
            metrics.increment(
                "monitoring.deployment.failure",
                tags=[f"method:{config.deploy_method}", f"environment:{config.environment}"],
            )
        return 1
    except KeyboardInterrupt:
        log("Deployment cancelled by user")
        return 130

    return 0


if __name__ == "__main__":
    sys.exit(main())
