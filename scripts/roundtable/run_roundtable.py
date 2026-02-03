#!/usr/bin/env python3
"""Run the roundtable-ai CLI availability check.

Runs the roundtable-ai CLI (via uvx) with the desired subagents.
Availability results are written to ~/.roundtable/availability_check.json.

Examples:
    ./scripts/roundtable/run_roundtable.py
    ./scripts/roundtable/run_roundtable.py --agents codex
    ./scripts/roundtable/run_roundtable.py --agents codex,cursor,gemini
"""

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# ANSI colors
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'

# Default values
DEFAULT_AGENTS = "codex,cursor,gemini"
DEFAULT_WORKING_DIR = Path.home() / "vibecode-webgui"
DEFAULT_PYTHON_CMD = "python3.13"


@dataclass
class RoundtableConfig:
    """Configuration for roundtable CLI."""

    agents: str = DEFAULT_AGENTS
    working_dir: Path = DEFAULT_WORKING_DIR
    python_cmd: str = DEFAULT_PYTHON_CMD


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = True,
    env: Optional[dict] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, raise on failure.
        capture: If True, capture output.
        env: Environment variables.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        merged_env = os.environ.copy()
        if env:
            merged_env.update(env)

        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            env=merged_env
        )
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def check_uvx_installed() -> bool:
    """Check if uvx is installed and available.

    Returns:
        True if uvx is available.
    """
    return shutil.which("uvx") is not None


def run_roundtable(config: RoundtableConfig) -> int:
    """Run the roundtable-ai availability check.

    Args:
        config: Roundtable configuration.

    Returns:
        Exit code (0 for success).
    """
    # Check for uvx
    if not check_uvx_installed():
        print(f"{RED}Error: uvx is required but not found in PATH.{NC}",
              file=sys.stderr)
        return 1

    print(f"{GREEN}Running roundtable-ai availability check...{NC}")
    print(f"   Working dir: {config.working_dir}")
    print(f"   Agents: {config.agents}")
    print()

    # Set up environment
    env = {
        "CLI_MCP_WORKING_DIR": str(config.working_dir),
        "CLI_MCP_SUBAGENTS": config.agents,
    }

    # Build command
    cmd = [
        "uvx",
        "--python", config.python_cmd,
        "roundtable-ai@latest",
        "--check"
    ]

    # Run the command (don't capture output so it streams to terminal)
    rc, _, _ = run_command(cmd, env=env, capture=False, check=False)

    if rc != 0:
        print(f"{RED}Error: roundtable-ai check failed with exit code {rc}{NC}",
              file=sys.stderr)
        return rc

    # Check for results file
    results_path = Path.home() / ".roundtable" / "availability_check.json"
    if results_path.exists():
        print(f"{GREEN}Availability written to {results_path}{NC}")
        return 0
    else:
        print(f"{YELLOW}Expected availability file not found at {results_path}{NC}",
              file=sys.stderr)
        return 1


def get_results_path() -> Path:
    """Get the path to the availability results file.

    Returns:
        Path to results file.
    """
    return Path.home() / ".roundtable" / "availability_check.json"


def read_results() -> Optional[dict]:
    """Read the availability results.

    Returns:
        Results dictionary or None if not found.
    """
    import json

    results_path = get_results_path()
    if not results_path.exists():
        return None

    try:
        return json.loads(results_path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def main(
    agents: Optional[str] = None,
    working_dir: Optional[Path] = None,
    python_cmd: Optional[str] = None
) -> int:
    """Main entry point.

    Args:
        agents: Comma-separated list of agents.
        working_dir: Working directory path.
        python_cmd: Python command to use.

    Returns:
        Exit code (0 for success).
    """
    # Get configuration from environment
    config = RoundtableConfig(
        agents=os.environ.get("CLI_MCP_SUBAGENTS", DEFAULT_AGENTS),
        working_dir=Path(os.environ.get("CLI_MCP_WORKING_DIR", str(DEFAULT_WORKING_DIR))),
        python_cmd=os.environ.get("PYTHON_CMD", DEFAULT_PYTHON_CMD),
    )

    # Override with arguments
    if agents:
        config.agents = agents
    if working_dir:
        config.working_dir = working_dir
    if python_cmd:
        config.python_cmd = python_cmd

    return run_roundtable(config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run the roundtable-ai CLI availability check"
    )
    parser.add_argument(
        '--agents',
        default=None,
        help=f"Comma-separated list of agents (default: {DEFAULT_AGENTS})"
    )
    parser.add_argument(
        '--working-dir',
        type=Path,
        default=None,
        help=f"Working directory (default: {DEFAULT_WORKING_DIR})"
    )
    parser.add_argument(
        '--python',
        dest='python_cmd',
        default=None,
        help=f"Python command to use (default: {DEFAULT_PYTHON_CMD})"
    )

    args = parser.parse_args()

    sys.exit(main(
        agents=args.agents,
        working_dir=args.working_dir,
        python_cmd=args.python_cmd
    ))
