#!/usr/bin/env python3
"""Test the code-server Helm chart in a Kind cluster."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class KindTestConfig:
    """Kind test configuration."""

    cluster_name: str = "codeserver-cloud"
    helm_release: str = "codeserver"
    chart_path: str = "helm/code-server-cloud"
    password: str = "kindtest"
    rollout_timeout: str = "180s"

    @classmethod
    def from_env(cls) -> "KindTestConfig":
        """Create config from environment variables."""
        return cls(
            cluster_name=os.environ.get("CLUSTER_NAME", "codeserver-cloud"),
            helm_release=os.environ.get("HELM_RELEASE", "codeserver"),
            chart_path=os.environ.get("CHART_PATH", "helm/code-server-cloud"),
        )


def check_prerequisites() -> bool:
    """Check that required tools are installed.

    Returns:
        True if all tools found, False otherwise.
    """
    required_tools = ["kind", "kubectl", "helm"]

    for tool in required_tools:
        if not shutil.which(tool):
            print(f"{tool} is required", file=sys.stderr)
            return False

    return True


def cluster_exists(cluster_name: str) -> bool:
    """Check if a Kind cluster exists.

    Returns:
        True if cluster exists, False otherwise.
    """
    try:
        result = subprocess.run(
            ["kind", "get", "clusters"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            clusters = result.stdout.strip().split("\n")
            return cluster_name in clusters
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass
    return False


def create_cluster(cluster_name: str) -> bool:
    """Create a Kind cluster.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Creating Kind cluster: {cluster_name}")

    try:
        result = subprocess.run(
            ["kind", "create", "cluster", "--name", cluster_name],
            timeout=300,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def set_kubectl_context(cluster_name: str) -> bool:
    """Set kubectl context to the Kind cluster.

    Returns:
        True if successful, False otherwise.
    """
    context = f"kind-{cluster_name}"

    try:
        result = subprocess.run(
            ["kubectl", "config", "use-context", context],
            timeout=10,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def deploy_helm_chart(config: KindTestConfig) -> bool:
    """Deploy the Helm chart.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Deploying Helm chart: {config.chart_path}")

    cmd = [
        "helm", "upgrade", "--install", config.helm_release, config.chart_path,
        "--set", f"auth.password={config.password}",
        "--namespace", "default",
    ]

    try:
        result = subprocess.run(cmd, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def wait_for_rollout(config: KindTestConfig) -> bool:
    """Wait for the deployment rollout to complete.

    Returns:
        True if successful, False otherwise.
    """
    print("Waiting for deployment rollout...")

    cmd = [
        "kubectl", "rollout", "status",
        f"deployment/{config.helm_release}",
        f"--timeout={config.rollout_timeout}",
    ]

    try:
        result = subprocess.run(cmd, timeout=200)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def test_cloud_chart(config: Optional[KindTestConfig] = None) -> int:
    """Test the code-server Helm chart in Kind.

    Args:
        config: Kind test configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = KindTestConfig.from_env()

    # Check prerequisites
    if not check_prerequisites():
        return 1

    # Create cluster if needed
    if not cluster_exists(config.cluster_name):
        if not create_cluster(config.cluster_name):
            print("ERROR: Failed to create Kind cluster", file=sys.stderr)
            return 1
    else:
        print(f"Using existing cluster: {config.cluster_name}")

    # Set kubectl context
    if not set_kubectl_context(config.cluster_name):
        print("ERROR: Failed to set kubectl context", file=sys.stderr)
        return 1

    # Deploy Helm chart
    if not deploy_helm_chart(config):
        print("ERROR: Failed to deploy Helm chart", file=sys.stderr)
        return 1

    # Wait for rollout
    if not wait_for_rollout(config):
        print("ERROR: Deployment rollout failed", file=sys.stderr)
        return 1

    print(f"Run 'kubectl port-forward svc/{config.helm_release} 8765:80' to access code-server.")
    return 0


def main() -> int:
    """Main entry point."""
    return test_cloud_chart()


if __name__ == "__main__":
    sys.exit(main())
