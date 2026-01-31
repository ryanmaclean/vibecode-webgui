#!/usr/bin/env python3
"""EC2 user-data script for bootstrapping code-server instance.

This script runs on EC2 instance startup to install Docker and launch code-server.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


# Default configuration
DEFAULT_PASSWORD = "changeme"
DEFAULT_PORT = 8765
DEFAULT_WORKSPACE_DIR = "/home/ubuntu/workspace"
DEFAULT_IMAGE = "ghcr.io/ryanmaclean/vibecode-codeserver:latest"


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command."""
    return subprocess.run(cmd, check=check)


def install_docker() -> bool:
    """Install and enable Docker.

    Returns:
        True if successful, False otherwise.
    """
    try:
        # Update package list
        run_command(["apt-get", "update"])

        # Install Docker
        run_command(["apt-get", "install", "-y", "docker.io"])

        # Enable and start Docker service
        run_command(["systemctl", "enable", "--now", "docker"])

        return True
    except subprocess.CalledProcessError:
        return False


def create_workspace_directory(workspace_dir: str = DEFAULT_WORKSPACE_DIR) -> bool:
    """Create the workspace directory with proper permissions.

    Returns:
        True if successful, False otherwise.
    """
    try:
        workspace_path = Path(workspace_dir)
        workspace_path.mkdir(parents=True, exist_ok=True)

        # Set ownership to ubuntu user
        run_command(["chown", "ubuntu:ubuntu", str(workspace_path)])

        return True
    except (subprocess.CalledProcessError, OSError):
        return False


def start_code_server(
    password: str = DEFAULT_PASSWORD,
    port: int = DEFAULT_PORT,
    workspace_dir: str = DEFAULT_WORKSPACE_DIR,
    image: str = DEFAULT_IMAGE,
) -> bool:
    """Start code-server Docker container.

    Returns:
        True if successful, False otherwise.
    """
    try:
        run_command([
            "docker", "run", "-d",
            "--restart", "unless-stopped",
            "-e", f"PASSWORD={password}",
            "-p", f"{port}:{port}",
            "-v", f"{workspace_dir}:/home/coder/project",
            image,
        ])
        return True
    except subprocess.CalledProcessError:
        return False


def bootstrap_instance(
    password: str | None = None,
    port: int = DEFAULT_PORT,
    workspace_dir: str = DEFAULT_WORKSPACE_DIR,
    image: str = DEFAULT_IMAGE,
) -> int:
    """Bootstrap the EC2 instance with code-server.

    Args:
        password: Password for code-server (defaults to env var or "changeme")
        port: Port for code-server
        workspace_dir: Directory for workspace files
        image: Docker image to use

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if password is None:
        password = os.environ.get("PASSWORD", DEFAULT_PASSWORD)

    print("Installing Docker...")
    if not install_docker():
        print("ERROR: Failed to install Docker", file=sys.stderr)
        return 1

    print(f"Creating workspace directory: {workspace_dir}")
    if not create_workspace_directory(workspace_dir):
        print("ERROR: Failed to create workspace directory", file=sys.stderr)
        return 1

    print(f"Starting code-server on port {port}...")
    if not start_code_server(password, port, workspace_dir, image):
        print("ERROR: Failed to start code-server", file=sys.stderr)
        return 1

    print("Bootstrap complete!")
    return 0


def main() -> int:
    """Main entry point."""
    return bootstrap_instance()


if __name__ == "__main__":
    sys.exit(main())
