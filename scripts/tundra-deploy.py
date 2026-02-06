#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "tundra-deploy"
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


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Tundra Deploy - Unified CLI for Tundra Dome Automation

This script provides a command-line interface for deploying, managing,
and validating Datadog-monitored Kubernetes clusters.

Usage:
    ./scripts/tundra-deploy.py deploy [cluster-name]   # Full deployment
    ./scripts/tundra-deploy.py teardown [cluster-name] # Remove cluster
    ./scripts/tundra-deploy.py status [cluster-name]   # Check status
    ./scripts/tundra-deploy.py validate [cluster-name] # Check metrics in DD
    ./scripts/tundra-deploy.py prereqs                 # Check/install prerequisites

Options:
    -v, --verbose    Enable verbose output
    -y, --yes        Non-interactive mode (skip confirmations)
    --no-color       Disable colored output
    --version        Show version and exit
    --help           Show help and exit
"""
try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


import os
import sys

# Ensure the tundra_automation package is importable
# This script lives in scripts/, package is in scripts/python/tundra_automation/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PACKAGE_DIR = os.path.join(SCRIPT_DIR, "python")

if PACKAGE_DIR not in sys.path:
    sys.path.insert(0, PACKAGE_DIR)


def main():
    """Main entry point."""
    try:
        from tundra_automation.cli import main as cli_main

        return cli_main()
    except ImportError as e:
        print(f"Error: Failed to import tundra_automation package: {e}", file=sys.stderr)
        print(f"Make sure the package is located at: {PACKAGE_DIR}/tundra_automation", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        return 130


if __name__ == "__main__":
    sys.exit(main())