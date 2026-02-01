#!/usr/bin/env python3
"""CLI wrapper for the database connection fix utility."""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import sys
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

from fix_database_connections_impl import main

if __name__ == "__main__":
    raise SystemExit(main())
