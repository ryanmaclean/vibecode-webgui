#!/usr/bin/env python3
"""Start the valkey VM."""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit.runner_helper import run


def main() -> None:
    run(["start", "valkey"])


if __name__ == "__main__":  # pragma: no cover
    main()
