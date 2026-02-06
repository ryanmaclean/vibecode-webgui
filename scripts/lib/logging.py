#!/usr/bin/env python3
from __future__ import annotations
"""Colored logging helpers for Python automation scripts."""

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

# Datadog Unified Service Tagging
_dd_service = "logging"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "library"})
    _dd_patch()
except ImportError:
    pass


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import os
import sys
from dataclasses import dataclass
from typing import TextIO


LOG_COLOR_RED = "\033[0;31m"
LOG_COLOR_GREEN = "\033[0;32m"
LOG_COLOR_YELLOW = "\033[0;33m"
LOG_COLOR_BLUE = "\033[0;34m"
LOG_COLOR_RESET = "\033[0m"


@dataclass
class ScriptLogger:
    """Lightweight color aware logger mirroring the Bash helper output."""

    use_color: bool = True
    stream: TextIO = sys.stdout
    error_stream: TextIO = sys.stderr

    def __post_init__(self) -> None:
        if os.getenv("NO_COLOR"):
            self.use_color = False
        elif not getattr(self.stream, "isatty", lambda: False)():
            self.use_color = False

    def _fmt(self, label: str, color: str, message: str) -> str:
        if self.use_color:
            return f"{color}{label}{LOG_COLOR_RESET} {message}"
        return f"{label} {message}"

    def info(self, message: str) -> None:
        self.stream.write(self._fmt("INFO:", LOG_COLOR_BLUE, message) + "\n")

    def success(self, message: str) -> None:
        self.stream.write(self._fmt("SUCCESS:", LOG_COLOR_GREEN, message) + "\n")

    def warn(self, message: str) -> None:
        self.stream.write(self._fmt("WARNING:", LOG_COLOR_YELLOW, message) + "\n")

    def error(self, message: str) -> None:
        self.error_stream.write(self._fmt("ERROR:", LOG_COLOR_RED, message) + "\n")

    def step(self, message: str) -> None:
        prefix = "==>"
        if self.use_color:
            formatted = f"\n{LOG_COLOR_GREEN}{prefix}{LOG_COLOR_RESET} {message}\n"
        else:
            formatted = f"\n{prefix} {message}\n"
        self.stream.write(formatted)


_LOGGER = ScriptLogger()


def log_info(message: str) -> None:
    _LOGGER.info(message)


def log_success(message: str) -> None:
    _LOGGER.success(message)


def log_warn(message: str) -> None:
    _LOGGER.warn(message)


def log_error(message: str) -> None:
    _LOGGER.error(message)


def log_step(message: str) -> None:
    _LOGGER.step(message)


def log_warning(message: str) -> None:
    log_warn(message)


__all__ = [
    "ScriptLogger",
    "log_error",
    "log_info",
    "log_step",
    "log_success",
    "log_warn",
    "log_warning",
]