#!/usr/bin/env python3
"""Helper to invoke the Go CLI from Python wrappers."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Optional


def _find_skill_root() -> Optional[Path]:
    env_root = os.getenv("DD_SKILL_ROOT")
    if env_root:
        candidate = Path(env_root).expanduser().resolve()
        if (candidate / "SKILL.md").exists():
            return candidate

    # Default: python/ -> repo root
    here = Path(__file__).resolve()
    for parent in [here.parent.parent, *here.parents]:
        if (parent / "SKILL.md").exists():
            return parent

    return None


def find_go_cli() -> Optional[Path]:
    env_cli = os.getenv("DD_SKILL_GO_CLI")
    if env_cli:
        candidate = Path(env_cli).expanduser().resolve()
        if candidate.exists():
            return candidate

    root = _find_skill_root()
    if root:
        candidate = root / "datadog-skill-go" / "datadog-cli"
        if candidate.exists():
            return candidate

    return None


def run_go_cli(command: str, args: Iterable[str]) -> int:
    cli = find_go_cli()
    if cli is None:
        print(
            "Error: Go CLI not found. Set DD_SKILL_GO_CLI or build datadog-skill-go/datadog-cli.",
            file=sys.stderr,
        )
        return 1

    cmd = [str(cli), command, *args]
    return subprocess.call(cmd)
