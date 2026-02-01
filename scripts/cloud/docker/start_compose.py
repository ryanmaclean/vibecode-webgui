#!/usr/bin/env python3
<<<<<<< HEAD


"""Start code-server using Docker Compose."""

from __future__ import annotations
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
=======
"""Start code-server using Docker Compose."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import subprocess
import sys
from pathlib import Path


def run_cmd(
    cmd: list[str],
    capture: bool = False,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def get_env(name: str, default: str = "") -> str:
    """Get environment variable with default."""
    return os.environ.get(name, default)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--compose-file",
        default=get_env("COMPOSE_FILE", "docker/code-server/docker-compose.cloud.yml"),
        help="Docker Compose file path",
    )
    parser.add_argument(
        "--project-name",
        default=get_env("PROJECT_NAME", "codeserver"),
        help="Docker Compose project name",
    )
    parser.add_argument(
        "--password",
        default=get_env("CODE_SERVER_PASSWORD", "changeme"),
        help="code-server password",
    )

    args = parser.parse_args(argv)

    # Create required directories
    Path("workspace").mkdir(exist_ok=True)
    Path("config").mkdir(exist_ok=True)

    # Start services
    result = run_cmd([
        "docker", "compose",
        "-f", args.compose_file,
        "--project-name", args.project_name,
        "up", "-d",
    ])

    if result.returncode != 0:
        print("Failed to start services")
        return 1

    print(f"code-server available on http://localhost:8765 (password: {args.password})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
