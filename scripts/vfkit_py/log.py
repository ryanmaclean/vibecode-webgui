
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

from __future__ import annotations

from dataclasses import dataclass
import sys
from typing import TextIO


@dataclass(frozen=True)
class _Colors:
    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    magenta: str = "\033[0;35m"
    cyan: str = "\033[0;36m"
    reset: str = "\033[0m"


COLORS = _Colors()


def _emit(label: str, color: str, message: str, stream: TextIO = sys.stdout) -> None:
    stream.write(f"{color}{label}{COLORS.reset} {message}\n")
    stream.flush()


def log_info(message: str, stream: TextIO = sys.stdout) -> None:
    _emit("[INFO]", COLORS.blue, message, stream)


def log_success(message: str, stream: TextIO = sys.stdout) -> None:
    _emit("[SUCCESS]", COLORS.green, message, stream)


def log_warn(message: str, stream: TextIO = sys.stdout) -> None:
    _emit("[WARN]", COLORS.yellow, message, stream)


def log_error(message: str, stream: TextIO = sys.stderr) -> None:
    _emit("[ERROR]", COLORS.red, message, stream)


def log_section(title: str, stream: TextIO = sys.stdout) -> None:
    stream.write(f"\n{COLORS.cyan}==={COLORS.reset} {title} {COLORS.cyan}==={COLORS.reset}\n")
    stream.flush()


__all__ = [
    "COLORS",
    "log_error",
    "log_info",
    "log_section",
    "log_success",
    "log_warn",
]