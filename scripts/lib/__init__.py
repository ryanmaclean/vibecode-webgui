"""Shared library modules for vibecode scripts."""

from .script_logging import (
    log_info,
    log_success,
    log_warn,
    log_warning,
    log_error,
    log_step,
    disable_colors,
    enable_colors,
    RED,
    GREEN,
    YELLOW,
    BLUE,
    NC,
)

from .bootstrap import (
    bootstrap_init,
    get_scripts_root,
    get_lib_dir,
)

__all__ = [
    # logging
    "log_info",
    "log_success",
    "log_warn",
    "log_warning",
    "log_error",
    "log_step",
    "disable_colors",
    "enable_colors",
    "RED",
    "GREEN",
    "YELLOW",
    "BLUE",
    "NC",
    # bootstrap
    "bootstrap_init",
    "get_scripts_root",
    "get_lib_dir",
]
