"""Vibecode CLI utilities for local development environment management."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()


def log(message: str, stream: TextIO = sys.stdout) -> None:
    """Print blue informational message."""
    stream.write(f"{COLORS.blue}{message}{COLORS.reset}\n")
    stream.flush()


def ok(message: str, stream: TextIO = sys.stdout) -> None:
    """Print green success message with checkmark."""
    stream.write(f"{COLORS.green}\u2713 {message}{COLORS.reset}\n")
    stream.flush()


def warn(message: str, stream: TextIO = sys.stdout) -> None:
    """Print yellow warning message."""
    stream.write(f"{COLORS.yellow}\u26a0 {message}{COLORS.reset}\n")
    stream.flush()


def err(message: str, stream: TextIO = sys.stderr) -> None:
    """Print red error message."""
    stream.write(f"{COLORS.red}\u2717 {message}{COLORS.reset}\n")
    stream.flush()


def which(cmd: str) -> str | None:
    """Check if command exists in PATH."""
    return shutil.which(cmd)


def run_command(
    cmd: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
    text: bool = True,
    **kwargs,
) -> subprocess.CompletedProcess[str]:
    """Run a command with subprocess."""
    return subprocess.run(cmd, check=check, capture_output=capture_output, text=text, **kwargs)


def get_project_root() -> Path:
    """Get the project root directory (two levels up from scripts/vibecode_cli)."""
    return Path(__file__).resolve().parent.parent.parent


def is_root_user() -> bool:
    """Check if running as root user."""
    return os.getuid() == 0


__all__ = [
    "COLORS",
    "Colors",
    "err",
    "get_project_root",
    "is_root_user",
    "log",
    "ok",
    "run_command",
    "warn",
    "which",
]
