"""Python utilities for vfkit workflows.

This package hosts shared infrastructure for porting the legacy shell
scripts in ``scripts/vfkit`` to Python entrypoints.  Modules export reusable
helpers (logging, path management, command execution) so each converted
script can remain a thin wrapper around the real orchestration logic.
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


from .paths import VFKitPaths
from .log import log_error, log_info, log_section, log_success, log_warn
from .runner import run_command
from .valkey_tester import ValkeyCLI, ValkeyConfig, ValkeyTestSuite, ValkeyTester

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
]
