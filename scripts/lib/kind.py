#!/usr/bin/env python3
"""Shared helpers for KIND (Kubernetes in Docker) orchestration scripts."""

import os
import stat
import subprocess
from pathlib import Path
from typing import Optional

try:
    from .script_logging import log_error, log_step, log_warn
except ImportError:
    from script_logging import log_error, log_step, log_warn

# Global state
KIND_SCRIPTS_DIR: Optional[Path] = None


def kind_set_scripts_dir(scripts_dir: str) -> None:
    """Set the KIND scripts directory.

    Args:
        scripts_dir: Path to the KIND scripts directory.
    """
    global KIND_SCRIPTS_DIR
    KIND_SCRIPTS_DIR = Path(scripts_dir)


def kind_get_scripts_dir() -> Optional[Path]:
    """Get the current KIND scripts directory.

    Returns:
        The current scripts directory path or None if not set.
    """
    return KIND_SCRIPTS_DIR


def kind_run_step(
    description: str,
    script_name: str,
    requirement: str = "required"
) -> bool:
    """Run a KIND orchestration step.

    Args:
        description: Description of the step to display.
        script_name: Name of the script to run.
        requirement: Whether the script is "required" or "optional".

    Returns:
        True if successful, False otherwise.
    """
    if KIND_SCRIPTS_DIR is None:
        log_error("KIND_SCRIPTS_DIR is not set. Call kind_set_scripts_dir first.")
        return False

    log_step(description)

    script_path = KIND_SCRIPTS_DIR / script_name

    if not script_path.is_file():
        if requirement == "optional":
            log_warn(f"Script not found, skipping: {script_path}")
            return True

        log_error(f"Script not found: {script_path}")
        return False

    # Make script executable
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    # Run the script
    result = subprocess.run([str(script_path)], cwd=str(KIND_SCRIPTS_DIR))

    if result.returncode != 0:
        if requirement == "optional":
            log_warn(f"Script failed: {script_path}")
            return True

        log_error(f"Script failed: {script_path}")
        return False

    return True


def kind_run_command(command: list, cwd: Optional[str] = None) -> subprocess.CompletedProcess:
    """Run a KIND-related command.

    Args:
        command: The command and arguments to run.
        cwd: Working directory for the command.

    Returns:
        The completed process result.
    """
    return subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True
    )


def kind_cluster_exists(cluster_name: str = "kind") -> bool:
    """Check if a KIND cluster exists.

    Args:
        cluster_name: The name of the cluster to check.

    Returns:
        True if the cluster exists, False otherwise.
    """
    result = subprocess.run(
        ["kind", "get", "clusters"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return False

    clusters = result.stdout.strip().split("\n")
    return cluster_name in clusters


def kind_create_cluster(
    cluster_name: str = "kind",
    config_path: Optional[str] = None
) -> bool:
    """Create a KIND cluster.

    Args:
        cluster_name: The name of the cluster to create.
        config_path: Optional path to a KIND config file.

    Returns:
        True if successful, False otherwise.
    """
    cmd = ["kind", "create", "cluster", "--name", cluster_name]

    if config_path:
        cmd.extend(["--config", config_path])

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def kind_delete_cluster(cluster_name: str = "kind") -> bool:
    """Delete a KIND cluster.

    Args:
        cluster_name: The name of the cluster to delete.

    Returns:
        True if successful, False otherwise.
    """
    result = subprocess.run(
        ["kind", "delete", "cluster", "--name", cluster_name],
        capture_output=True,
        text=True
    )
    return result.returncode == 0


def kind_load_image(image_name: str, cluster_name: str = "kind") -> bool:
    """Load a Docker image into the KIND cluster.

    Args:
        image_name: The name of the image to load.
        cluster_name: The name of the cluster.

    Returns:
        True if successful, False otherwise.
    """
    result = subprocess.run(
        ["kind", "load", "docker-image", image_name, "--name", cluster_name],
        capture_output=True,
        text=True
    )
    return result.returncode == 0
