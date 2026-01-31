
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