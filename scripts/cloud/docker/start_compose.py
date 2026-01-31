#!/usr/bin/env python3
"""Start code-server using Docker Compose."""
from __future__ import annotations

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
