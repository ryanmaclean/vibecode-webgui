#!/usr/bin/env python3

"""Measure vi launch latency inside qemu-based guests (OpenWrt, Yocto, etc.)."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pexpect


@dataclass
class QemuTarget:
  name: str
  description: str
  command: list[str]
  shell_prompt: str  # regex consumed by pexpect
  runs: int = 1
  login_prompt: Optional[str] = None
  username: Optional[str] = None
  password: Optional[str] = None
  pre_login_prompt: Optional[str] = None
  pre_login_send: Optional[str] = None
  vi_command: str = 'vi -u NONE -U NONE -c q'
  shutdown_command: str = 'poweroff'
  timeout: int = 120
  shutdown_timeout: int = 60


@dataclass
class Measurement:
  total_seconds: float
  vi_seconds: float


def run_target(target: QemuTarget, runs: int) -> dict:
  totals: list[float] = []
  vis: list[float] = []
  for idx in range(runs):
    child = pexpect.spawn(target.command[0], target.command[1:], encoding='utf-8', timeout=target.timeout)
    child.delaybeforesend = 0.05
    start_total = time.perf_counter()
