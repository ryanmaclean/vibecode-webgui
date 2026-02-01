#!/usr/bin/env python3
<<<<<<< HEAD


"""Stop code-server Docker Compose services."""

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
from typing import Optional


@dataclass
class DockerComposeStopConfig:
    """Docker Compose stop configuration."""

    compose_file: str = "docker/code-server/docker-compose.cloud.yml"
    project_name: str = "codeserver"
    remove_volumes: bool = False

    @classmethod
    def from_env(cls) -> "DockerComposeStopConfig":
        """Create config from environment variables."""
        return cls(
            compose_file=os.environ.get(
                "COMPOSE_FILE", "docker/code-server/docker-compose.cloud.yml"
            ),
            project_name=os.environ.get("PROJECT_NAME", "codeserver"),
            remove_volumes=os.environ.get("REMOVE_VOLUMES", "false").lower() == "true",
        )


def stop_compose(config: DockerComposeStopConfig) -> bool:
    """Stop Docker Compose services.

    Returns:
        True if successful, False otherwise.
    """
    cmd = [
        "docker", "compose",
        "-f", config.compose_file,
        "--project-name", config.project_name,
        "down",
    ]

    if config.remove_volumes:
        cmd.append("-v")

    try:
        result = subprocess.run(cmd, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def stop_docker_compose(config: Optional[DockerComposeStopConfig] = None) -> int:
    """Stop code-server Docker Compose services.

    Args:
        config: Docker Compose configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = DockerComposeStopConfig.from_env()

    # Check for docker compose
    if not shutil.which("docker"):
        print("ERROR: docker not found", file=sys.stderr)
        return 1

    # Stop services
    if not stop_compose(config):
        print("ERROR: Failed to stop Docker Compose services", file=sys.stderr)
        return 1

    action = "stopped and volumes removed" if config.remove_volumes else "stopped"
    print(f"Docker Compose services {action}")
    return 0


def main() -> int:
    """Main entry point."""
    return stop_docker_compose()


if __name__ == "__main__":
    sys.exit(main())
=======
"""Stop code-server Docker Compose services."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys


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
        "--remove-volumes",
        action="store_true",
        default=get_env("REMOVE_VOLUMES", "false").lower() == "true",
        help="Also remove volumes",
    )

    args = parser.parse_args(argv)

    cmd = [
        "docker", "compose",
        "-f", args.compose_file,
        "--project-name", args.project_name,
        "down",
    ]

    if args.remove_volumes:
        cmd.append("-v")

    result = run_cmd(cmd)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
