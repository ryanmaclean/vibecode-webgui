#!/usr/bin/env python3


"""Compare Vim launch latency across native and Lima-based hypervisors."""
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

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed

import argparse
import json
import statistics
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List

# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    pass


@dataclass
class Target:
  name: str
  description: str
  command: List[str]
  kind: str  # native or lima
  instance: str | None = None


TARGETS = [
    Target(
        name="native",
        description="Host macOS (no hypervisor)",
        command=["/usr/bin/vim", "-n", "-u", "NONE", "-U", "NONE", "-c", "q"],
        kind="native",
    ),
    Target(
        name="lima_vz",
        description="Lima vmType=vz (Virtualization.framework)",
        command=[
            "limactl",
            "shell",
            "alpine-vim",
            "--",
            "vim",
            "-n",
            "-u",
            "NONE",
            "-U",
            "NONE",
            "-c",
            "q",
        ],
        kind="lima",
        instance="alpine-vim",
    ),
    Target(
        name="lima_qemu",
        description="Lima vmType=qemu (HVF accelerated)",
        command=[
            "limactl",
            "shell",
            "alpine-qemu",
            "--",
            "vim",
            "-n",
            "-u",
            "NONE",
            "-U",
            "NONE",
            "-c",
            "q",
        ],
        kind="lima",
        instance="alpine-qemu",
    ),
    Target(
        name="lima_ide",
        description="Lima IDE instance (Alpine, vim)",
        command=[
            "limactl",
            "shell",
            "ide-lima",
            "--",
            "vim",
            "-n",
            "-u",
            "NONE",
            "-U",
            "NONE",
            "-c",
            "q",
        ],
        kind="lima",
        instance="ide-lima",
    ),
]


def run(cmd: List[str]) -> subprocess.CompletedProcess:
  return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def ensure_lima_instance(name: str) -> None:
  """Ensure the Lima instance is running."""
  status = run(["limactl", "list", "--json"])
  if status.returncode != 0:
    print(status.stderr, file=sys.stderr)
    raise RuntimeError("unable to list lima instances")
  entries = []
  for line in status.stdout.strip().splitlines():
    if not line:
      continue
    entries.append(json.loads(line))
  for entry in entries:
    if entry.get("name") == name:
      if entry.get("status") == "Running":
        return
      break
  # If not running, start
  print(f"Starting Lima instance {name}...", file=sys.stderr)
  start = run(["limactl", "start", name])
  if start.returncode != 0:
    raise RuntimeError(f"failed to start {name}: {start.stderr}")


def measure(target: Target, runs: int) -> dict:
  durations: List[float] = []
  stderr_samples: List[str] = []
  for idx in range(runs):
    start = time.perf_counter()
    proc = run(target.command)
    elapsed = time.perf_counter() - start
    if proc.returncode != 0:
      raise RuntimeError(
          f"command for {target.name} failed with code {proc.returncode}: {proc.stderr.strip()}"
      )
    durations.append(elapsed)
    if proc.stderr:
      stderr_samples.append(proc.stderr.strip())
  return {
      "name": target.name,
      "description": target.description,
      "runs": runs,
      "avg_seconds": statistics.mean(durations),
      "stdev_seconds": statistics.pstdev(durations) if runs > 1 else 0.0,
      "min_seconds": min(durations),
      "max_seconds": max(durations),
      "samples": durations,
      "stderr_samples": stderr_samples[:3],
  }


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--runs", type=int, default=5, help="Number of invocations per target")
  parser.add_argument(
      "--output",
      type=Path,
      help="Optional JSON file to store structured results",
  )
  args = parser.parse_args()

  results = []
  for target in TARGETS:
    if target.kind == "lima":
      ensure_lima_instance(target.instance)
    print(f"\n=== {target.name} ({target.description}) ===")
    result = measure(target, args.runs)
    print(
        f"avg={result['avg_seconds']:.3f}s min={result['min_seconds']:.3f}s max={result['max_seconds']:.3f}s"
    )
    results.append(result)

  if args.output:
    payload = {
        "timestamp": time.time(),
        "runs": args.runs,
        "results": results,
    }
    args.output.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote benchmark JSON to {args.output}")

  return 0


if __name__ == "__main__":
  try:
    raise SystemExit(main())
  except RuntimeError as exc:
    print(f"error: {exc}", file=sys.stderr)
    raise SystemExit(1)