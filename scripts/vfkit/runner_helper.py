

from __future__ import annotations
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

from pathlib import Path
from typing import Sequence
import sys


def _ensure_repo_root() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))


def run(args: Sequence[str]) -> None:
    """Invoke the vm-manager CLI with *args*."""

    _ensure_repo_root()
    from scripts.vfkit_py.vm_manager import cli

    cli(list(args))
