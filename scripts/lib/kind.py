#!/usr/bin/env python3
"""Helpers for orchestrating KIND workflow scripts."""

from __future__ import annotations

import os
import stat
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Datadog APM tracing
try:
    from ddtrace import tracer
except ImportError:
    tracer = None  # type: ignore

from .logging import ScriptLogger


class KindError(RuntimeError):
    """Raised when a KIND orchestration step fails."""


@dataclass
class KindRunner:
    scripts_dir: Path
    logger: ScriptLogger = field(default_factory=ScriptLogger)

    def set_scripts_dir(self, path: os.PathLike[str] | str) -> None:
        self.scripts_dir = Path(path)

    def run_step(self, description: str, script_name: str, requirement: str = "required") -> bool:
        if not self.scripts_dir:
            raise KindError("KIND_SCRIPTS_DIR is not set. Call kind_set_scripts_dir first.")

        self.logger.step(description)
        script_path = (self.scripts_dir / script_name).resolve()

        if not script_path.exists():
            if requirement == "optional":
                self.logger.warn(f"Script not found, skipping: {script_path}")
                return False
            raise KindError(f"Script not found: {script_path}")

        script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)
        result = subprocess.run([str(script_path)], check=False)  # nosec B603
        if result.returncode != 0:
            if requirement == "optional":
                self.logger.warn(f"Script failed: {script_path}")
                return False
            raise KindError(f"Script failed: {script_path}")

        return True


_KIND_RUNNER: Optional[KindRunner] = None


def kind_set_scripts_dir(path: os.PathLike[str] | str) -> KindRunner:
    global _KIND_RUNNER
    _KIND_RUNNER = KindRunner(Path(path))
    return _KIND_RUNNER


def kind_run_step(description: str, script_name: str, requirement: str = "required") -> bool:
    if _KIND_RUNNER is None:
        raise KindError("KIND_SCRIPTS_DIR is not set. Call kind_set_scripts_dir first.")
    return _KIND_RUNNER.run_step(description, script_name, requirement)


__all__ = ["KindRunner", "KindError", "kind_set_scripts_dir", "kind_run_step"]

