

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

import os
import shutil
import subprocess
from pathlib import Path
from typing import Sequence


Command = Sequence[str]


def run_command(
    command: Command,
    *,
    check: bool = True,
    capture_output: bool = False,
    text: bool = True,
    **kwargs,
) -> subprocess.CompletedProcess[str]:
    """Wrapper around ``subprocess.run`` with sane defaults."""

    return subprocess.run(  # type: ignore[arg-type]
        list(command),
        check=check,
        capture_output=capture_output,
        text=text,
        **kwargs,
    )


def ensure_executable(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Required binary not found: {path}")
    if not path.is_file():
        raise FileNotFoundError(f"Not a file: {path}")
    if not os.access(path, os.X_OK):  # type: ignore[name-defined]
        raise PermissionError(f"Binary is not executable: {path}")


def which(executable: str) -> str | None:
    return shutil.which(executable)