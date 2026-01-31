#!/usr/bin/env python3
"""Entry point for the Python-based pre-commit checks."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from precommit.pre_commit import main

if __name__ == "__main__":
    raise SystemExit(main())
