#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
VibeCode Docker Deployment Script

Deploys Docker containers for various environments.

Usage:
    python deploy.py [environment] [options]
    python deploy.py dev
    python deploy.py prod --registry ghcr.io/username
    python deploy.py aks --registry ghcr.io/username --namespace production
"""

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes for terminal output."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class Environment(Enum):
    """Deployment environments."""
    DEV = "dev"
    PROD = "prod"
    TEST = "test"
    AKS = "aks"


@dataclass
class DeployConfig:
    """Configuration for a deployment."""
    environment: Environment
    registry: Optional[str] = None
    namespace: str = "vibecode-platform"
    force: bool = False


def print_status(message: str) -> None:
    """Print an info message."""
    print(f"{Color.BLUE}[INFO]{Color.NC} {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def get_compose_file(environment: Environment) -> str:
    """Get the compose file name for the environment."""
    compose_files = {
        Environment.DEV: "docker-compose.dev.yml",
        Environment.PROD: "docker-compose.prod.yml",
        Environment.TEST: "docker-compose.test.yml",
        Environment.AKS: "docker-compose.aks.yml",
    }
    return compose_files[environment]


def check_compose_file_exists(compose_file: str) -> bool:
    """Check if the compose file exists."""
    return Path(f"docker/{compose_file}").exists()


def command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def confirm_deployment(config: DeployConfig) -> bool:
    """Prompt user for deployment confirmation."""
    if config.force:
        return True

    response = input("\nDo you want to proceed with the deployment? (y/N): ")
    return response.lower() in ("y", "yes")


def deploy_compose(config: DeployConfig, compose_file: str) -> int:
    """Deploy using Docker Compose."""
    print_status("Starting Docker Compose deployment...")

    try:
        # Change to docker directory and run compose
        result = subprocess.run(
            ["docker-compose", "-f", compose_file, "up", "--build", "-d"],
            cwd="docker",
            check=True,
        )

        print_success("Deployment completed successfully!")
        print_status("Services running:")

        subprocess.run(
            ["docker-compose", "-f", compose_file, "ps"],
            cwd="docker",
        )

        return 0
    except subprocess.CalledProcessError:
        print_error("Deployment failed!")
        return 1


def deploy_aks(config: DeployConfig) -> int:
    """Deploy to AKS using Helm."""
    print_status("Preparing AKS deployment...")

    # Check if kubectl is available
    if not command_exists("kubectl"):
        print_error("kubectl is not installed or not in PATH")
        return 1

    # Check if helm is available
    if not command_exists("helm"):
        print_error("helm is not installed or not in PATH")
        return 1

    # Build image if registry is provided
    if config.registry:
        print_status("Building and pushing image to registry...")
        image_tag = f"{config.registry}/vibecode-webgui:latest"

        result = subprocess.run(
            ["python", "build.py", "aks", "--tag", image_tag, "--push"],
            cwd=str(Path(__file__).parent),
        )

        if result.returncode != 0:
            print_error("Failed to build and push image")
            return 1

        print_success("Image built and pushed successfully!")

    # Deploy to AKS using Helm
    print_status("Deploying to AKS using Helm...")

    helm_cmd = [
        "helm", "upgrade", "--install", "vibecode-app", "../charts/vibecode",
        "--namespace", config.namespace,
        "--wait", "--timeout=600s",
    ]

    if config.registry:
        helm_cmd.extend([
            "--set", f"image.repository={config.registry}/vibecode-webgui",
            "--set", "image.tag=latest",
        ])

    try:
        subprocess.run(helm_cmd, cwd="docker", check=True)

        print_success("AKS deployment completed successfully!")
        print_status("Checking deployment status...")

        subprocess.run([
            "kubectl", "rollout", "status",
            f"deployment/vibecode-app",
            "-n", config.namespace,
            "--timeout=300s",
        ])

        subprocess.run([
            "kubectl", "get", "pods",
            "-n", config.namespace,
            "-l", "app.kubernetes.io/name=vibecode",
        ])

        return 0
    except subprocess.CalledProcessError:
        print_error("AKS deployment failed!")
        return 1


def run_deploy(config: DeployConfig) -> int:
    """Execute the deployment."""
    compose_file = get_compose_file(config.environment)

    # Check if compose file exists
    if not check_compose_file_exists(compose_file):
        print_error(f"Compose file not found: docker/{compose_file}")
        return 1

    # Print deployment information
    print_status("Deploying VibeCode WebGUI")
    print_status(f"Environment: {config.environment.value}")
    print_status(f"Compose File: docker/{compose_file}")

    if config.registry:
        print_status(f"Registry: {config.registry}")

    if config.environment == Environment.AKS:
        print_status(f"Namespace: {config.namespace}")

    # Confirmation prompt
    if not confirm_deployment(config):
        print_warning("Deployment cancelled")
        return 0

    # Deploy based on environment
    if config.environment == Environment.AKS:
        return deploy_aks(config)
    else:
        return deploy_compose(config, compose_file)


def parse_args() -> DeployConfig:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="VibeCode Docker Deployment Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environments:
  dev         - Development environment
  prod        - Production environment
  test        - Testing environment
  aks         - AKS production deployment

Examples:
  python deploy.py dev
  python deploy.py prod --registry ghcr.io/username
  python deploy.py aks --registry ghcr.io/username --namespace production
        """,
    )

    parser.add_argument(
        "environment",
        nargs="?",
        default="dev",
        choices=["dev", "prod", "test", "aks"],
        help="Deployment environment (default: dev)",
    )
    parser.add_argument(
        "--registry",
        help="Container registry (e.g., ghcr.io/username)",
    )
    parser.add_argument(
        "--namespace",
        default="vibecode-platform",
        help="Kubernetes namespace (default: vibecode-platform)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force deployment without confirmation",
    )

    args = parser.parse_args()

    return DeployConfig(
        environment=Environment(args.environment),
        registry=args.registry,
        namespace=args.namespace,
        force=args.force,
    )


def main() -> int:
    """Main entry point."""
    config = parse_args()
    return run_deploy(config)


if __name__ == "__main__":
    sys.exit(main())