#!/usr/bin/env python3
"""Provision a minimal Azure demo using Azure Container Instances and PostgreSQL Basic.

This script is intentionally lightweight and focuses on orchestration via the
Azure CLI so it can run from developer laptops or CI without extra SDKs.
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
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable

DEFAULT_RESOURCE_GROUP = "rg-vibecode-demo"
DEFAULT_LOCATION = "eastus2"
DEFAULT_ACI_NAME = "aci-vibecode-demo"
DEFAULT_POSTGRES_NAME = "vibecode-demo"
DEFAULT_ENV_FILE = Path(".env.demo")
DEFAULT_CPU = 1.0
DEFAULT_MEMORY = 2.0  # GB
DEFAULT_PORT = 3000


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, dry_run: bool = False, env: Dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    if dry_run:
        printable = " ".join(shlex.quote(part) for part in cmd)
        print(f"[DRY-RUN] {printable}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

