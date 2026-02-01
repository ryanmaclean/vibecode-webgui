#!/usr/bin/env python3
"""
AgentAPI Deployment Script

Deploys VibeCode workspace with AgentAPI to Kubernetes.

Usage:
    python deploy_agentapi.py [ENVIRONMENT]
    python deploy_agentapi.py dev
    python deploy_agentapi.py --dry-run
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class AgentAPIDeployer:
    """Handles AgentAPI deployment to Kubernetes."""

    def __init__(
        self,
        environment: str = "dev",
        namespace: str = "vibecode-platform",
        release_name: str = "agentapi",
        dry_run: bool = False,
    ):
        self.environment = environment
        self.namespace = os.environ.get("NAMESPACE", namespace)
        self.release_name = os.environ.get("RELEASE_NAME", release_name)
        self.dry_run = dry_run

        self.script_dir = Path(__file__).parent
        self.project_root = self.script_dir.parent
        self.helm_chart_path = self.project_root / "helm" / "agentapi"

    def log_info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.BLUE}[INFO]{Color.NC} {message}")

    def log_success(self, message: str) -> None:
        """Print success message."""
        print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")

    def log_error(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}[ERROR]{Color.NC} {message}")

    def run_cmd(self, cmd: list[str], description: str = "") -> bool:
        """Run command and return success status."""
        if description:
            self.log_info(description)

        if self.dry_run:
            self.log_info(f"DRY RUN: Would run '{' '.join(cmd)}'")
            return True

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                self.log_error(f"Command failed: {result.stderr}")
                return False
            return True
        except Exception as e:
            self.log_error(f"Error running command: {e}")
            return False

    def deploy(self) -> bool:
        """Deploy AgentAPI to Kubernetes."""
        self.log_info(f"Deploying AgentAPI to {self.environment}...")

        values_file = self.helm_chart_path / f"values-{self.environment}.yaml"

        cmd = [
            "helm", "upgrade", "--install", self.release_name,
            str(self.helm_chart_path),
            "--namespace", self.namespace,
            "--create-namespace",
            "--values", str(values_file),
            "--wait",
        ]

        if not self.run_cmd(cmd, "Running Helm upgrade"):
            return False

        self.log_success("Deployment complete!")
        return True


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="AgentAPI Deployment Script",
    )

    parser.add_argument(
        "environment",
        nargs="?",
        default="dev",
        help="Environment (dev, staging, production)",
    )
    parser.add_argument(
        "--namespace",
        default="vibecode-platform",
        help="Kubernetes namespace",
    )
    parser.add_argument(
        "--release-name",
        default="agentapi",
        help="Helm release name",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_args()

    deployer = AgentAPIDeployer(
        environment=args.environment,
        namespace=args.namespace,
        release_name=args.release_name,
        dry_run=args.dry_run,
    )

    if deployer.deploy():
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
