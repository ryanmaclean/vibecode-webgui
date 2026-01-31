#!/usr/bin/env python3

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

"""
Comprehensive Deployment Script with Error Tracking

Handles all deployment scenarios with automatic error tracking.

Usage:
    python deploy_with_error_tracking.py [DEPLOYMENT_TYPE] [ENVIRONMENT]
    python deploy_with_error_tracking.py kubernetes production
    python deploy_with_error_tracking.py --dry-run
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class DeploymentType(Enum):
    """Deployment type options."""
    AUTO = "auto"
    KUBERNETES = "kubernetes"
    K8S = "k8s"
    AKS = "aks"
    AZURE = "azure"
    LOCAL = "local"
    DOCKER = "docker"


class Environment(Enum):
    """Environment options."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class DeployConfig:
    """Deployment configuration."""
    deployment_type: str = "auto"
    environment: str = "development"
    dry_run: bool = False
    verbose: bool = False


@dataclass
class PerformanceMetric:
    """Performance metric data."""
    name: str
    value: float
    category: str
    unit: str


class ErrorTracker:
    """Error tracking and logging."""

    def __init__(self, service: str, operation: str):
        self.service = service
        self.operation = operation
        self.dd_api_key = os.environ.get("DD_API_KEY", "")

    def log_error(self, message: str, exit_code: int, category: str,
                  operation: str, tags: str = "") -> None:
        """Log error to Datadog."""
        if not self.dd_api_key:
            return

        # In a real implementation, this would send to Datadog API
        print(f"[ERROR TRACKING] {category}/{operation}: {message} (tags: {tags})")

    def track_metric(self, metric: PerformanceMetric) -> None:
        """Track performance metric."""
        if not self.dd_api_key:
            return

        print(f"[METRIC] {metric.category}/{metric.name}: {metric.value} {metric.unit}")


class DeploymentRunner:
    """Comprehensive deployment runner with error tracking."""

    def __init__(self, config: DeployConfig):
        self.config = config
        self.tracker = ErrorTracker("deployment", "full_deployment")
        self.deployment_start = 0.0

    def log_info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.BLUE}[INFO]{Color.NC} {message}")

    def log_success(self, message: str) -> None:
        """Print success message."""
        print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")

    def log_warning(self, message: str) -> None:
        """Print warning message."""
        print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")

    def log_error(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}[ERROR]{Color.NC} {message}")

    def run_cmd(self, cmd: list[str], description: str) -> bool:
        """Run command with error tracking."""
        self.log_info(description)

        if self.config.dry_run:
            self.log_info(f"DRY RUN: Would run '{' '.join(cmd)}'")
            return True

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                self.log_success(f"Completed: {description}")
                return True
            else:
                self.log_error(f"Failed: {description}")
                if self.config.verbose:
                    print(result.stderr)
                self.tracker.log_error(
                    f"Command failed: {description}",
                    result.returncode,
                    "deployment",
                    "command_execution",
                )
                return False

        except Exception as e:
            self.log_error(f"Error: {e}")
            self.tracker.log_error(str(e), 1, "deployment", "command_exception")
            return False

    def track_deployment_start(self) -> None:
        """Track deployment start."""
        self.log_info("Starting deployment process...")
        self.log_info(f"Deployment Type: {self.config.deployment_type}")
        self.log_info(f"Environment: {self.config.environment}")
        self.log_info(f"Dry Run: {self.config.dry_run}")

        self.deployment_start = time.time()
        self.tracker.track_metric(PerformanceMetric(
            name="deployment_start_time",
            value=self.deployment_start,
            category="deployment",
            unit="timestamp",
        ))

    def validate_prerequisites(self) -> bool:
        """Validate prerequisites."""
        self.log_info("Validating prerequisites...")

        missing_tools = []

        if not shutil.which("kubectl"):
            missing_tools.append("kubectl")
        if not shutil.which("docker"):
            missing_tools.append("docker")
        if not shutil.which("npm"):
            missing_tools.append("npm")

        if missing_tools:
            self.log_error(f"Missing required tools: {', '.join(missing_tools)}")
            self.tracker.log_error(
                f"Missing required tools: {', '.join(missing_tools)}",
                1, "deployment", "prerequisites_check",
                f"missing_tools:{','.join(missing_tools)}",
            )
            return False

        if not os.environ.get("DD_API_KEY"):
            self.log_warning("DD_API_KEY not set - error tracking will be limited")

        self.log_success("Prerequisites validated")
        return True

    def build_application(self) -> bool:
        """Build application."""
        self.log_info("Building application...")

        build_start = time.time()

        if not self.run_cmd(["npm", "run", "build"], "Building application"):
            return False

        build_duration = time.time() - build_start
        self.tracker.track_metric(PerformanceMetric(
            name="build_duration",
            value=build_duration,
            category="deployment",
            unit="seconds",
        ))

        return True

    def run_tests(self) -> bool:
        """Run tests."""
        self.log_info("Running tests...")

        test_start = time.time()

        if not self.run_cmd(["npm", "test"], "Running tests"):
            return False

        test_duration = time.time() - test_start
        self.tracker.track_metric(PerformanceMetric(
            name="test_duration",
            value=test_duration,
            category="deployment",
            unit="seconds",
        ))

        return True

    def deploy_kubernetes(self) -> bool:
        """Deploy to Kubernetes."""
        self.log_info("Deploying to Kubernetes...")

        deploy_start = time.time()

        # Check cluster accessibility
        result = subprocess.run(
            ["kubectl", "cluster-info"],
            capture_output=True,
        )

        if result.returncode != 0:
            self.log_error("Kubernetes cluster is not accessible")
            self.tracker.log_error(
                "Kubernetes cluster not accessible",
                1, "deployment", "kubernetes_deploy",
                "cluster_check_failed",
            )
            return False

        self.log_info("Kubernetes cluster is accessible")

        if not self.run_cmd(["kubectl", "apply", "-f", "k8s/"], "Applying Kubernetes manifests"):
            return False

        deploy_duration = time.time() - deploy_start
        self.tracker.track_metric(PerformanceMetric(
            name="k8s_deploy_duration",
            value=deploy_duration,
            category="deployment",
            unit="seconds",
        ))

        return True

    def deploy_aks(self) -> bool:
        """Deploy to Azure AKS."""
        self.log_info("Deploying to Azure AKS...")

        deploy_start = time.time()

        if not shutil.which("az"):
            self.log_error("Azure CLI not found")
            self.tracker.log_error(
                "Azure CLI not found",
                1, "deployment", "aks_deploy",
                "azure_cli_missing",
            )
            return False

        # Check if logged in to Azure
        result = subprocess.run(
            ["az", "account", "show"],
            capture_output=True,
        )

        if result.returncode != 0:
            self.log_error("Not logged in to Azure")
            self.tracker.log_error(
                "Not logged in to Azure",
                1, "deployment", "aks_deploy",
                "azure_not_logged_in",
            )
            return False

        if not self.run_cmd(
            ["./scripts/aks-datadog-setup.sh"],
            "Running AKS deployment script",
        ):
            return False

        deploy_duration = time.time() - deploy_start
        self.tracker.track_metric(PerformanceMetric(
            name="aks_deploy_duration",
            value=deploy_duration,
            category="deployment",
            unit="seconds",
        ))

        return True

    def deploy_local(self) -> bool:
        """Deploy locally with Docker."""
        self.log_info("Deploying locally with Docker...")

        deploy_start = time.time()

        # Check Docker
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
        )

        if result.returncode != 0:
            self.log_error("Docker is not running")
            self.tracker.log_error(
                "Docker is not running",
                1, "deployment", "local_deploy",
                "docker_not_running",
            )
            return False

        # Build Docker image
        if not self.run_cmd(
            ["docker", "build", "-t", "vibecode-webgui:latest", "."],
            "Building Docker image",
        ):
            return False

        # Run Docker Compose
        if not self.run_cmd(
            ["docker-compose", "up", "-d"],
            "Starting Docker Compose",
        ):
            return False

        deploy_duration = time.time() - deploy_start
        self.tracker.track_metric(PerformanceMetric(
            name="local_deploy_duration",
            value=deploy_duration,
            category="deployment",
            unit="seconds",
        ))

        return True

    def health_check(self) -> bool:
        """Run health checks."""
        self.log_info("Running health checks...")

        health_start = time.time()

        if self.config.environment == "production":
            health_url = "https://your-production-url.com/api/health"
        else:
            health_url = "http://localhost:3000/api/health"

        if self.config.dry_run:
            self.log_info(f"DRY RUN: Would check health at {health_url}")
            return True

        max_attempts = 30
        for attempt in range(1, max_attempts + 1):
            result = subprocess.run(
                ["curl", "-sf", health_url],
                capture_output=True,
            )

            if result.returncode == 0:
                self.log_success(f"Health check passed (attempt {attempt})")
                break
            else:
                self.log_info(f"Health check attempt {attempt}/{max_attempts} failed, retrying...")
                time.sleep(10)
        else:
            self.log_error(f"Health check failed after {max_attempts} attempts")
            self.tracker.log_error(
                f"Health check failed after {max_attempts} attempts",
                1, "deployment", "health_check",
                "max_attempts_exceeded",
            )
            return False

        health_duration = time.time() - health_start
        self.tracker.track_metric(PerformanceMetric(
            name="health_check_duration",
            value=health_duration,
            category="deployment",
            unit="seconds",
        ))

        return True

    def post_deployment(self) -> bool:
        """Run post-deployment tasks."""
        self.log_info("Running post-deployment tasks...")

        # These are optional, so we don't fail on errors
        self.run_cmd(
            ["./scripts/setup-datadog-monitoring.ts"],
            "Setting up monitoring",
        )

        self.run_cmd(
            ["./scripts/deploy-database-migrations.sh"],
            "Running database migrations",
        )

        self.run_cmd(
            ["./scripts/validate-deployment-readiness.sh"],
            "Validating deployment readiness",
        )

        return True

    def run(self) -> int:
        """Run the deployment."""
        self.track_deployment_start()

        if not self.validate_prerequisites():
            return 1

        if not self.build_application():
            return 1

        if not self.run_tests():
            return 1

        # Deploy based on type
        deployment_type = self.config.deployment_type.lower()

        if deployment_type in ("kubernetes", "k8s"):
            if not self.deploy_kubernetes():
                return 1
        elif deployment_type in ("aks", "azure"):
            if not self.deploy_aks():
                return 1
        elif deployment_type in ("local", "docker"):
            if not self.deploy_local():
                return 1
        elif deployment_type == "auto":
            # Auto-detect deployment type
            result = subprocess.run(
                ["kubectl", "cluster-info"],
                capture_output=True,
            )

            if result.returncode == 0:
                self.log_info("Kubernetes cluster detected, deploying to K8s")
                if not self.deploy_kubernetes():
                    return 1
            elif shutil.which("az"):
                result = subprocess.run(
                    ["az", "account", "show"],
                    capture_output=True,
                )
                if result.returncode == 0:
                    self.log_info("Azure CLI detected, deploying to AKS")
                    if not self.deploy_aks():
                        return 1
                else:
                    self.log_info("No cloud provider detected, deploying locally")
                    if not self.deploy_local():
                        return 1
            else:
                self.log_info("No cloud provider detected, deploying locally")
                if not self.deploy_local():
                    return 1
        else:
            self.log_error(f"Unknown deployment type: {deployment_type}")
            self.tracker.log_error(
                f"Unknown deployment type: {deployment_type}",
                1, "deployment", "main",
                "invalid_deployment_type",
            )
            return 1

        if not self.health_check():
            return 1

        self.post_deployment()

        # Track deployment completion
        deployment_duration = time.time() - self.deployment_start
        self.tracker.track_metric(PerformanceMetric(
            name="total_deployment_duration",
            value=deployment_duration,
            category="deployment",
            unit="seconds",
        ))

        self.log_success("Deployment completed successfully!")
        self.log_info(f"Total deployment time: {int(deployment_duration)}s")

        return 0


def parse_args() -> DeployConfig:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Comprehensive Deployment Script with Error Tracking",
    )

    parser.add_argument("deployment_type", nargs="?", default="auto",
                        help="Deployment type (auto, kubernetes, aks, local)")
    parser.add_argument("environment", nargs="?", default="development",
                        help="Environment (development, staging, production)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be done without making changes")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Enable verbose output")

    args = parser.parse_args()

    return DeployConfig(
        deployment_type=args.deployment_type,
        environment=args.environment,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )


def main() -> int:
    """Main entry point."""
    config = parse_args()
    runner = DeploymentRunner(config)
    return runner.run()


if __name__ == "__main__":
    sys.exit(main())