#!/usr/bin/env python3
"""Start all vfkit-managed VMs."""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit.runner_helper import run


def main() -> None:
    run(["start-all"])


if __name__ == "__main__":  # pragma: no cover
    main()
