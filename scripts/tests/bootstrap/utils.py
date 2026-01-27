"""Utility helpers for the converted bootstrap pytest suites."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Iterable, Mapping, Optional, Sequence


def run_command(
    cmd: Sequence[str],
    *,
    cwd: Path | None = None,
    env: Mapping[str, str] | None = None,
    timeout: Optional[int] = 60,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command and capture output for assertions."""

    return subprocess.run(
        list(cmd),
        capture_output=True,
        cwd=str(cwd) if cwd else None,
        env=dict(env) if env else None,
        text=True,
        timeout=timeout,
        check=False,
    )


def bash_syntax_ok(script: Path) -> tuple[bool, str]:
    """Return (is_valid, stderr) for ``bash -n``."""

    result = run_command(["bash", "-n", str(script)])
    return result.returncode == 0, result.stderr


def count_function_definitions(script: Path) -> int:
    """Count ``function() {`` occurrences for quick heuristics."""

    pattern = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\s*\(\)\s*{", re.MULTILINE)
    return len(pattern.findall(script.read_text()))


def file_line_count(script: Path) -> int:
    return len(script.read_text().splitlines())


def script_contains(script: Path, substring: str) -> bool:
    return substring in script.read_text()


def grep_regex(script: Path, pattern: str) -> Iterable[str]:
    compiled = re.compile(pattern)
    return compiled.findall(script.read_text())


def source_and_run(
    script: Path,
    body: str,
    *,
    env: Mapping[str, str] | None = None,
    timeout: Optional[int] = 60,
) -> subprocess.CompletedProcess[str]:
    """Source ``script`` in bash and run ``body`` commands afterwards."""

    snippet = f"set -euo pipefail\nsource '{script}'\n{body}\n"
    return run_command(["bash", "-lc", snippet], env=env, timeout=timeout)


def list_script_references(script: Path) -> list[str]:
    """Extract relative script references (``./scripts/*.sh``)."""

    pattern = re.compile(r"\./scripts/[A-Za-z0-9_-]+\.sh")
    seen = []
    for match in pattern.findall(script.read_text()):
        if match not in seen:
            seen.append(match)
    return seen


__all__ = [
    "bash_syntax_ok",
    "count_function_definitions",
    "file_line_count",
    "grep_regex",
    "list_script_references",
    "run_command",
    "script_contains",
    "source_and_run",
]

