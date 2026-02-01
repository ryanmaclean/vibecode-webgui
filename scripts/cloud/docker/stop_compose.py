#!/usr/bin/env python3
"""Stop code-server Docker Compose services."""
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
