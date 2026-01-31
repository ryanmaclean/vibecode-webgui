#!/usr/bin/env python3
"""Shared logging helpers for Python scripts."""

import sys
from typing import Optional

# ANSI color codes
LOG_COLOR_RED = '\033[0;31m'
LOG_COLOR_GREEN = '\033[0;32m'
LOG_COLOR_YELLOW = '\033[0;33m'
LOG_COLOR_BLUE = '\033[0;34m'
LOG_COLOR_RESET = '\033[0m'

# Backwards-compatible color aliases
RED = LOG_COLOR_RED
GREEN = LOG_COLOR_GREEN
YELLOW = LOG_COLOR_YELLOW
BLUE = LOG_COLOR_BLUE
NC = LOG_COLOR_RESET

# Color state
_colors_enabled = True


def disable_colors() -> None:
    """Disable color output."""
    global _colors_enabled, RED, GREEN, YELLOW, BLUE, NC
    _colors_enabled = False
    RED = GREEN = YELLOW = BLUE = NC = ''


def enable_colors() -> None:
    """Enable color output."""
    global _colors_enabled, RED, GREEN, YELLOW, BLUE, NC
    _colors_enabled = True
    RED = LOG_COLOR_RED
    GREEN = LOG_COLOR_GREEN
    YELLOW = LOG_COLOR_YELLOW
    BLUE = LOG_COLOR_BLUE
    NC = LOG_COLOR_RESET


def _get_color(color: str) -> str:
    """Get color code if colors are enabled."""
    return color if _colors_enabled else ''


def log_info(message: str) -> None:
    """Log an info message."""
    blue = _get_color(LOG_COLOR_BLUE)
    reset = _get_color(LOG_COLOR_RESET)
    print(f'{blue}INFO:{reset} {message}')


def log_success(message: str) -> None:
    """Log a success message."""
    green = _get_color(LOG_COLOR_GREEN)
    reset = _get_color(LOG_COLOR_RESET)
    print(f'{green}SUCCESS:{reset} {message}')


def log_warn(message: str) -> None:
    """Log a warning message."""
    yellow = _get_color(LOG_COLOR_YELLOW)
    reset = _get_color(LOG_COLOR_RESET)
    print(f'{yellow}WARNING:{reset} {message}')


def log_error(message: str) -> None:
    """Log an error message to stderr."""
    red = _get_color(LOG_COLOR_RED)
    reset = _get_color(LOG_COLOR_RESET)
    print(f'{red}ERROR:{reset} {message}', file=sys.stderr)


def log_step(message: str) -> None:
    """Log a step message with visual separator."""
    green = _get_color(LOG_COLOR_GREEN)
    reset = _get_color(LOG_COLOR_RESET)
    print(f'\n{green}==>{reset} {message}')


# Alias for backwards compatibility
log_warning = log_warn
