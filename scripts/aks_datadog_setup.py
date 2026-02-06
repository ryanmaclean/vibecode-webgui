#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "aks-datadog-setup"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""AKS Datadog setup wrapper.

Deprecated: Datadog setup is handled by scripts/datadog_setup.py
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import sys
from pathlib import Path


def main() -> int:
    """Main entry point."""
    print(
        "[aks-datadog-setup] NOTICE: this script is deprecated.\n"
        "Please invoke scripts/datadog_setup.py directly.\n"
        "Proceeding by delegating to the Python helper..."
    )

    script_dir = Path(__file__).parent.resolve()
    datadog_setup = script_dir / "datadog_setup.py"

    result = subprocess.run(
        [sys.executable, str(datadog_setup), *sys.argv[1:]],
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())