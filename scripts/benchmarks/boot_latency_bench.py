#!/usr/bin/env python3

"""Measure host vs container startup latency for simple workloads."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import shutil
import statistics
import subprocess
import sys
import time
import uuid
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_INITRD = REPO_ROOT / "bench-images" / "busybox" / "busybox-initramfs.cpio.gz"
QEMU_BINARIES = {
    "x86_64": "qemu-system-x86_64",
}




def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:

      proc.terminate()
