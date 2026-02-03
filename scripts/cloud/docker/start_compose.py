#!/usr/bin/env python3
"""Start code-server using Docker Compose."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class DockerComposeConfig:
    """Docker Compose configuration."""

    compose_file: str = "docker/code-server/docker-compose.cloud.yml"
    project_name: str = "codeserver"
    password: str = "changeme"

    @classmethod
    def from_env(cls) -> "DockerComposeConfig":
        """Create config from environment variables."""
        return cls(
            compose_file=os.environ.get(
                "COMPOSE_FILE", "docker/code-server/docker-compose.cloud.yml"
            ),
            project_name=os.environ.get("PROJECT_NAME", "codeserver"),
            password=os.environ.get("CODE_SERVER_PASSWORD", "changeme"),
        )


def create_directories() -> bool:
    """Create workspace and config directories.

    Returns:
        True if successful, False otherwise.
    """
    try:
        Path("workspace").mkdir(exist_ok=True)
        Path("config").mkdir(exist_ok=True)
        return True
    except OSError:
        return False


def start_compose(config: DockerComposeConfig) -> bool:
    """Start Docker Compose services.

    Returns:
        True if successful, False otherwise.
    """
    cmd = [
        "docker", "compose",
        "-f", config.compose_file,
        "--project-name", config.project_name,
        "up", "-d",
    ]

    try:
        result = subprocess.run(cmd, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def start_docker_compose(config: Optional[DockerComposeConfig] = None) -> int:
    """Start code-server with Docker Compose.

    Args:
        config: Docker Compose configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = DockerComposeConfig.from_env()

    # Check for docker compose
    if not shutil.which("docker"):
        print("ERROR: docker not found", file=sys.stderr)
        return 1

    # Create directories
    if not create_directories():
        print("ERROR: Failed to create directories", file=sys.stderr)
        return 1

    # Start services
    if not start_compose(config):
        print("ERROR: Failed to start Docker Compose services", file=sys.stderr)
        return 1

    print(f"code-server available on http://localhost:8765 (password: {config.password})")
    return 0


def main() -> int:
    """Main entry point."""
    return start_docker_compose()


if __name__ == "__main__":
    sys.exit(main())
