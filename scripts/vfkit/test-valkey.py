#!/usr/bin/env python3
"""Python replacement for scripts/vfkit/test-valkey.sh."""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import sys
from pathlib import Path


def _bootstrap() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))


def main(argv: list[str] | None = None) -> int:
    _bootstrap()
    from scripts.vfkit_py.valkey_tester import main as valkey_main

    return valkey_main(argv or sys.argv[1:])


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
