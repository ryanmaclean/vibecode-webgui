#!/usr/bin/env python3
"""Pre-pull Helm images for Kubernetes deployments.

Pulls Docker images and optionally loads them into a kind cluster.
"""

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass


@dataclass
class PrepullConfig:
    """Configuration for image pre-pulling."""

    images: list[str]
    cluster_name: str

    @classmethod
    def from_environment(cls) -> "PrepullConfig":
        """Create config from environment variables.

        Returns:
            PrepullConfig with values from environment or defaults.
        """
        images_str = os.environ.get(
            "HELM_IMAGES",
            "codercom/code-server:latest bitnami/postgresql:16",
        )
        images = images_str.split()

        cluster_name = os.environ.get(
            "KIND_CLUSTER_NAME",
            "vibecode-provisioning-test",
        )

        return cls(images=images, cluster_name=cluster_name)


def run_command(
    cmd: list[str],
    check: bool = False,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result.

    Args:
        cmd: Command and arguments to run.
        check: If True, raise on non-zero exit.
        capture_output: If True, capture stdout/stderr.

    Returns:
        CompletedProcess with result.
    """
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
    )


def is_docker_available() -> bool:
    """Check if docker command is available.

    Returns:
        True if docker is available.
    """
    return shutil.which("docker") is not None


def is_kind_available() -> bool:
    """Check if kind command is available.

    Returns:
        True if kind is available.
    """
    return shutil.which("kind") is not None


def get_kind_clusters() -> list[str]:
    """Get list of existing kind clusters.

    Returns:
        List of cluster names.
    """
    if not is_kind_available():
        return []

    result = run_command(["kind", "get", "clusters"])
    if result.returncode != 0:
        return []

    return result.stdout.strip().split("\n") if result.stdout.strip() else []


def pull_image(image: str) -> bool:
    """Pull a Docker image.

    Args:
        image: Image name to pull.

    Returns:
        True if pull succeeded.
    """
    print(f"Pulling {image}...")
    result = run_command(["docker", "pull", image])

    if result.returncode != 0:
        print(f"warning: failed to pull {image}", file=sys.stderr)
        return False

    return True


def load_image_to_kind(image: str, cluster_name: str) -> bool:
    """Load a Docker image into a kind cluster.

    Args:
        image: Image name to load.
        cluster_name: Name of the kind cluster.

    Returns:
        True if load succeeded.
    """
    print(f"Loading {image} into kind cluster {cluster_name}...")
    result = run_command(
        ["kind", "load", "docker-image", image, "--name", cluster_name]
    )

    if result.returncode != 0:
        print(f"warning: failed to load {image} into kind", file=sys.stderr)
        return False

    return True


def prepull_images(config: PrepullConfig) -> int:
    """Pre-pull all configured images.

    Args:
        config: Configuration with images and cluster name.

    Returns:
        Exit code (0 for success).
    """
    if not is_docker_available():
        print("docker not found; skipping image pre-pull", file=sys.stderr)
        return 0

    # Check if kind cluster exists
    clusters = get_kind_clusters()
    cluster_exists = config.cluster_name in clusters

    for image in config.images:
        # Pull the image
        pull_image(image)

        # Load into kind cluster if available
        if is_kind_available() and cluster_exists:
            load_image_to_kind(image, config.cluster_name)

    return 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    config = PrepullConfig.from_environment()
    return prepull_images(config)


if __name__ == "__main__":
    sys.exit(main())
