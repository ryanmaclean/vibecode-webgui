#!/usr/bin/env python3
"""Datadog installation helper for AKS clusters.

This module wraps the kubectl/helm orchestration required to deploy the
Datadog agents and cluster agent. It is designed to replace the legacy
`aks-datadog-setup.sh` script while remaining easy to invoke from shell
wrappers and tests.
"""


from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

DEFAULT_NAMESPACE = "datadog"
DEFAULT_VALUES_FILE = Path("k8s/datadog-values-aks.yaml")
DEFAULT_WAIT_TIMEOUT = 600


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, input_text: str | None = None, dry_run: bool = False) -> subprocess.CompletedProcess[str]:
    if dry_run:
        print(f"[DRY-RUN] {' '.join(cmd)}")
        if input_text:
            snippet = input_text if len(input_text) < 120 else f"{input_text[:117]}..."
            print(f"[DRY-RUN] with stdin:\n{snippet}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

