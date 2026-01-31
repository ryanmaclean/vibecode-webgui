
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

"""Python utilities for vfkit workflows.

This package hosts shared infrastructure for porting the legacy shell
scripts in ``scripts/vfkit`` to Python entrypoints.  Modules export reusable
helpers (logging, path management, command execution) so each converted
script can remain a thin wrapper around the real orchestration logic.
"""

from .paths import VFKitPaths
from .log import log_error, log_info, log_section, log_success, log_warn
from .runner import run_command
from .valkey_tester import ValkeyCLI, ValkeyConfig, ValkeyTestSuite, ValkeyTester
from .postgresql_tester import (
    PostgreSQLCLI,
    PostgreSQLConfig,
    PostgreSQLTestSuite,
    PostgreSQLTester,
)

__all__ = [
    "VFKitPaths",
    "log_error",
    "log_info",
    "log_section",
    "log_success",
    "log_warn",
    "run_command",
    "ValkeyCLI",
    "ValkeyConfig",
    "ValkeyTestSuite",
    "ValkeyTester",
    "PostgreSQLCLI",
    "PostgreSQLConfig",
    "PostgreSQLTestSuite",
    "PostgreSQLTester",
]