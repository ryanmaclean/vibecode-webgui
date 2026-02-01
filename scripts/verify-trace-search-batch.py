#!/usr/bin/env python3

"""Batch verify Datadog trace search access using a config file."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        required=True,
        help="Path to JSON config file with service/env/window configurations"
    )
    args = parser.parse_args()

    # Verify config file exists
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"❌ Config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    # Load config
