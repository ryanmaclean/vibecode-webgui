#!/usr/bin/env python3
"""Comprehensive Deployment Script with Error Tracking.

Handles all deployment scenarios with automatic error tracking via Datadog.
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'


class DeploymentType(Enum):
    """Deployment target types."""
    AUTO = "auto"
    KUBERNETES = "kubernetes"
    K8S = "k8s"
    AKS = "aks"
    AZURE = "azure"
    LOCAL = "local"
    DOCKER = "docker"


@dataclass
class DeploymentConfig:
    """Deployment configuration."""

    deployment_type: DeploymentType = DeploymentType.AUTO
    environment: str = "development"
    verbose: bool = False
    dry_run: bool = False
    health_url: Optional[str] = None
    max_health_attempts: int = 30
    health_retry_delay: int = 10


@dataclass
class DeploymentMetrics:
    """Deployment timing metrics."""

    start_time: float = 0.0
    build_duration: float = 0.0
    test_duration: float = 0.0
    deploy_duration: float = 0.0
    health_check_duration: float = 0.0
    total_duration: float = 0.0


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{BLUE}[INFO]{NC} {message}")


def log_success(message: str) -> None:
    """Print success message."""
    print(f"{GREEN}[SUCCESS]{NC} {message}")


def log_warning(message: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}[WARNING]{NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{RED}[ERROR]{NC} {message}")


def run_command(
    cmd: list[str],
    check: bool = False,
    capture: bool = True
) -> tuple[int, str, str]:
    """Run a command and return result.

    Args:
        cmd: Command and arguments.
        check: Whether to raise on error.
        capture: Whether to capture output.

    Returns:
        Tuple of (returncode, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            check=check
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout or "", e.stderr or ""
    except FileNotFoundError:
        return -1, "", "command not found"


def command_exists(cmd: str) -> bool:
    """Check if a command exists."""
    return shutil.which(cmd) is not None


def safe_execute(
    command: str,
    category: str,
    operation: str,
    dry_run: bool = False
) -> bool:
    """Safely execute a command with error handling.

    Args:
        command: Command to execute.
        category: Error category.
        operation: Operation name.
        dry_run: If True, don't actually run.

    Returns:
        True if successful.
    """
    if dry_run:
        log_info(f"DRY RUN: Would run '{command}'")
        return True

    rc, stdout, stderr = run_command(command.split())
    if rc != 0:
        log_error(f"Command failed: {command}")
        if stderr:
            log_error(f"Error: {stderr}")
        return False
    return True


def track_performance_metric(
    name: str,
    value: float,
    category: str,
    unit: str
) -> None:
    """Track a performance metric (placeholder for Datadog integration).

    Args:
        name: Metric name.
        value: Metric value.
        category: Metric category.
        unit: Metric unit.
    """
    # This would integrate with Datadog in production
    pass


def log_error_to_datadog(
    message: str,
    severity: str,
    category: str,
    operation: str,
    tags: str
) -> None:
    """Log error to Datadog (placeholder for integration).

    Args:
        message: Error message.
        severity: Error severity.
        category: Error category.
        operation: Operation name.
        tags: Additional tags.
    """
    # This would integrate with Datadog in production
    pass


def validate_prerequisites(config: DeploymentConfig) -> bool:
    """Validate deployment prerequisites.

    Args:
        config: Deployment configuration.

    Returns:
        True if all prerequisites are met.
    """
    log_info("🔍 Validating prerequisites...")

    required_tools = ["kubectl", "docker", "npm"]
    missing_tools = [tool for tool in required_tools if not command_exists(tool)]

    if missing_tools:
        log_error(f"Missing required tools: {', '.join(missing_tools)}")
        log_error_to_datadog(
            f"Missing required tools: {', '.join(missing_tools)}",
            "1", "deployment", "prerequisites_check",
            f"missing_tools:{','.join(missing_tools)}"
        )
        return False

    if not os.environ.get("DD_API_KEY"):
        log_warning("DD_API_KEY not set - error tracking will be limited")

    log_success("Prerequisites validated")
    return True


def build_application(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Build the application.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if successful.
    """
    log_info("🏗️ Building application...")

    build_start = time.time()

    if not safe_execute("npm run build", "deployment", "build", config.dry_run):
        log_error("Application build failed")
        return False

    metrics.build_duration = time.time() - build_start
    track_performance_metric("build_duration", metrics.build_duration, "deployment", "seconds")
    log_success("Application built successfully")
    return True


def run_tests(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Run tests.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if successful.
    """
    log_info("🧪 Running tests...")

    test_start = time.time()

    if not safe_execute("npm test", "deployment", "testing", config.dry_run):
        log_error("Tests failed")
        return False

    metrics.test_duration = time.time() - test_start
    track_performance_metric("test_duration", metrics.test_duration, "deployment", "seconds")
    log_success("Tests passed")
    return True


def deploy_kubernetes(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Deploy to Kubernetes.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if successful.
    """
    log_info("☸️ Deploying to Kubernetes...")

    deploy_start = time.time()

    # Check if cluster is accessible
    rc, _, _ = run_command(["kubectl", "cluster-info"])
    if rc != 0:
        log_error("Kubernetes cluster is not accessible")
        log_error_to_datadog(
            "Kubernetes cluster not accessible",
            "1", "deployment", "kubernetes_deploy", "cluster_check_failed"
        )
        return False

    log_info("Kubernetes cluster is accessible")

    if not safe_execute("kubectl apply -f k8s/", "deployment", "k8s_apply", config.dry_run):
        log_error("Kubernetes deployment failed")
        return False

    metrics.deploy_duration = time.time() - deploy_start
    track_performance_metric("k8s_deploy_duration", metrics.deploy_duration, "deployment", "seconds")
    log_success("Kubernetes deployment completed")
    return True


def deploy_aks(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Deploy to Azure AKS.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if successful.
    """
    log_info("☁️ Deploying to Azure AKS...")

    deploy_start = time.time()

    if not command_exists("az"):
        log_error("Azure CLI not found")
        log_error_to_datadog(
            "Azure CLI not found",
            "1", "deployment", "aks_deploy", "azure_cli_missing"
        )
        return False

    # Check Azure login
    rc, _, _ = run_command(["az", "account", "show"])
    if rc != 0:
        log_error("Not logged in to Azure")
        log_error_to_datadog(
            "Not logged in to Azure",
            "1", "deployment", "aks_deploy", "azure_not_logged_in"
        )
        return False

    if not safe_execute(
        "./scripts/aks-datadog-setup.sh",
        "deployment", "aks_deploy", config.dry_run
    ):
        log_error("AKS deployment failed")
        return False

    metrics.deploy_duration = time.time() - deploy_start
    track_performance_metric("aks_deploy_duration", metrics.deploy_duration, "deployment", "seconds")
    log_success("AKS deployment completed")
    return True


def deploy_local(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Deploy locally with Docker.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if successful.
    """
    log_info("🐳 Deploying locally with Docker...")

    deploy_start = time.time()

    # Check Docker
    rc, _, _ = run_command(["docker", "info"])
    if rc != 0:
        log_error("Docker is not running")
        log_error_to_datadog(
            "Docker is not running",
            "1", "deployment", "local_deploy", "docker_not_running"
        )
        return False

    # Build Docker image
    if not safe_execute(
        "docker build -t vibecode-webgui:latest .",
        "deployment", "docker_build", config.dry_run
    ):
        log_error("Docker build failed")
        return False

    log_success("Docker image built")

    # Run Docker Compose
    if not safe_execute(
        "docker-compose up -d",
        "deployment", "docker_compose", config.dry_run
    ):
        log_error("Local deployment failed")
        return False

    metrics.deploy_duration = time.time() - deploy_start
    track_performance_metric("local_deploy_duration", metrics.deploy_duration, "deployment", "seconds")
    log_success("Local deployment completed")
    return True


def health_check(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Run health checks.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if health check passes.
    """
    log_info("🩺 Running health checks...")

    health_start = time.time()

    if config.environment == "production":
        health_url = config.health_url or "https://your-production-url.com/api/health"
    else:
        health_url = config.health_url or "http://localhost:3000/api/health"

    if config.dry_run:
        log_info(f"DRY RUN: Would check health at {health_url}")
        return True

    for attempt in range(1, config.max_health_attempts + 1):
        rc, _, _ = run_command(["curl", "-f", health_url])
        if rc == 0:
            log_success(f"Health check passed (attempt {attempt})")
            break
        else:
            log_info(f"Health check attempt {attempt}/{config.max_health_attempts} failed, retrying...")
            time.sleep(config.health_retry_delay)
    else:
        log_error(f"Health check failed after {config.max_health_attempts} attempts")
        log_error_to_datadog(
            f"Health check failed after {config.max_health_attempts} attempts",
            "1", "deployment", "health_check", "max_attempts_exceeded"
        )
        return False

    metrics.health_check_duration = time.time() - health_start
    track_performance_metric("health_check_duration", metrics.health_check_duration, "deployment", "seconds")
    log_success("All health checks passed")
    return True


def post_deployment(config: DeploymentConfig) -> None:
    """Run post-deployment tasks.

    Args:
        config: Deployment configuration.
    """
    log_info("🔧 Running post-deployment tasks...")

    # Update monitoring
    if safe_execute(
        "./scripts/setup-datadog-monitoring.ts",
        "deployment", "monitoring_setup", config.dry_run
    ):
        log_success("Monitoring setup completed")
    else:
        log_warning("Monitoring setup failed")

    # Run database migrations
    if safe_execute(
        "./scripts/deploy-database-migrations.sh",
        "deployment", "db_migrations", config.dry_run
    ):
        log_success("Database migrations completed")
    else:
        log_warning("Database migrations failed")

    # Verify deployment
    if safe_execute(
        "./scripts/validate-deployment-readiness.sh",
        "deployment", "deployment_validation", config.dry_run
    ):
        log_success("Deployment validation completed")
    else:
        log_warning("Deployment validation failed")


def auto_detect_deployment(config: DeploymentConfig, metrics: DeploymentMetrics) -> bool:
    """Auto-detect and run appropriate deployment.

    Args:
        config: Deployment configuration.
        metrics: Metrics tracker.

    Returns:
        True if successful.
    """
    # Check for Kubernetes
    rc, _, _ = run_command(["kubectl", "cluster-info"])
    if rc == 0:
        log_info("Kubernetes cluster detected, deploying to K8s")
        return deploy_kubernetes(config, metrics)

    # Check for Azure
    if command_exists("az"):
        rc, _, _ = run_command(["az", "account", "show"])
        if rc == 0:
            log_info("Azure CLI detected, deploying to AKS")
            return deploy_aks(config, metrics)

    log_info("No cloud provider detected, deploying locally")
    return deploy_local(config, metrics)


def main(
    deployment_type: str = "auto",
    environment: str = "development",
    dry_run: bool = False,
    verbose: bool = False
) -> int:
    """Main deployment function.

    Args:
        deployment_type: Type of deployment.
        environment: Target environment.
        dry_run: If True, don't make changes.
        verbose: If True, show verbose output.

    Returns:
        Exit code.
    """
    try:
        dtype = DeploymentType(deployment_type.lower())
    except ValueError:
        log_error(f"Unknown deployment type: {deployment_type}")
        return 1

    config = DeploymentConfig(
        deployment_type=dtype,
        environment=environment,
        verbose=verbose,
        dry_run=dry_run
    )

    metrics = DeploymentMetrics(start_time=time.time())

    log_info("🚀 Starting deployment process...")
    log_info(f"Deployment Type: {config.deployment_type.value}")
    log_info(f"Environment: {config.environment}")
    log_info(f"Dry Run: {config.dry_run}")

    track_performance_metric("deployment_start_time", metrics.start_time, "deployment", "timestamp")

    # Validate prerequisites
    if not validate_prerequisites(config):
        return 1

    # Build application
    if not build_application(config, metrics):
        return 1

    # Run tests
    if not run_tests(config, metrics):
        return 1

    # Deploy based on type
    success = False
    if dtype in (DeploymentType.KUBERNETES, DeploymentType.K8S):
        success = deploy_kubernetes(config, metrics)
    elif dtype in (DeploymentType.AKS, DeploymentType.AZURE):
        success = deploy_aks(config, metrics)
    elif dtype in (DeploymentType.LOCAL, DeploymentType.DOCKER):
        success = deploy_local(config, metrics)
    elif dtype == DeploymentType.AUTO:
        success = auto_detect_deployment(config, metrics)

    if not success:
        return 1

    # Health check
    if not health_check(config, metrics):
        return 1

    # Post-deployment tasks
    post_deployment(config)

    # Track completion
    metrics.total_duration = time.time() - metrics.start_time
    track_performance_metric("total_deployment_duration", metrics.total_duration, "deployment", "seconds")

    log_success("🎉 Deployment completed successfully!")
    log_info(f"Total deployment time: {metrics.total_duration:.1f}s")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Comprehensive Deployment Script with Error Tracking"
    )
    parser.add_argument(
        'deployment_type',
        nargs='?',
        default='auto',
        choices=['auto', 'kubernetes', 'k8s', 'aks', 'azure', 'local', 'docker'],
        help='Deployment type (default: auto)'
    )
    parser.add_argument(
        'environment',
        nargs='?',
        default='development',
        help='Target environment (default: development)'
    )
    parser.add_argument(
        '-n', '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()
    sys.exit(main(
        deployment_type=args.deployment_type,
        environment=args.environment,
        dry_run=args.dry_run,
        verbose=args.verbose
    ))
