#!/usr/bin/env python3


"""Measure Firecracker microVM boot latency using the local resources."""
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
import os
import statistics
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

try:
  from ._dogstatsd import DogStatsDSender, emit_duration_metrics
except ImportError:  # pragma: no cover - fallback when run as a script
  sys.path.append(str(Path(__file__).resolve().parent))
  from _dogstatsd import DogStatsDSender, emit_duration_metrics

ROOT = Path(__file__).resolve().parent
FC_DIR = ROOT / "firecracker"
FIRECRACKER_BIN = FC_DIR / "firecracker"
CONFIG_FILE = FC_DIR / "microvm-config.json"


class FirecrackerError(RuntimeError):
  pass


def ensure_resources() -> None:
  missing = [p for p in (FIRECRACKER_BIN, CONFIG_FILE) if not p.exists()]
  if missing:
    raise FirecrackerError(
        "Missing resources: " + ", ".join(str(p) for p in missing)
        + " — run the Firecracker setup steps first."
    )
  if not os.access(FIRECRACKER_BIN, os.X_OK):
    raise FirecrackerError(f"Firecracker binary not executable: {FIRECRACKER_BIN}")


def load_microvm_tags() -> list[str]:
  tags: list[str] = []
  try:
    config = json.loads(CONFIG_FILE.read_text())
  except FileNotFoundError:
    return tags
  except json.JSONDecodeError:
    return tags

  machine = config.get("machine-config", {})
  vcpu = machine.get("vcpu_count")
  if vcpu is not None:
    tags.append(f"vcpu:{vcpu}")
  mem = machine.get("mem_size_mib")
  if mem is not None:
    tags.append(f"mem_mib:{mem}")

  for drive in config.get("drives", []):
    if drive.get("is_root_device"):
      path_on_host = drive.get("path_on_host")
      if path_on_host:
        name = Path(path_on_host).stem
        tags.append(f"rootfs:{name}")
      break
  return tags


def run_microvm(timeout: float) -> float:
  """Boot the microVM, return time until login prompt."""
  cmd = [str(FIRECRACKER_BIN), "--no-api", "--config-file", str(CONFIG_FILE)]
  start = time.perf_counter()
  proc = subprocess.Popen(
      cmd,
      cwd=FC_DIR,
      stdout=subprocess.PIPE,
      stderr=subprocess.STDOUT,
      text=True,
      bufsize=1,
  )
  boot_time: Optional[float] = None
  try:
    assert proc.stdout is not None
    for line in proc.stdout:
      now = time.perf_counter()
      if "login:" in line or line.startswith("root@"):
        boot_time = now - start
        break
      if now - start > timeout:
        raise FirecrackerError(f"Boot timed out after {timeout} seconds")
  finally:
    proc.terminate()
    try:
      proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
      proc.kill()
  if boot_time is None:
    raise FirecrackerError("Failed to detect login prompt in Firecracker output")
  return boot_time


def benchmark(iterations: int, timeout: float, base_tags: list[str] | None = None) -> dict:
  samples = []
  for _ in range(iterations):
    samples.append(run_microvm(timeout))
  result = {
      "label": "firecracker_microvm_boot",
      "runs": iterations,
      "avg_seconds": statistics.mean(samples),
      "min_seconds": min(samples),
      "max_seconds": max(samples),
      "samples": samples,
  }
  if base_tags:
    result["tags"] = base_tags
  return result


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--iterations", type=int, default=3, help="Number of boots to measure")
  parser.add_argument("--timeout", type=float, default=10.0, help="Max seconds to wait for boot")
  parser.add_argument("--output", type=Path, help="Optional JSON output file")
  parser.add_argument("--dogstatsd", action="store_true", help="Emit DogStatsD metrics")
  parser.add_argument("--dogstatsd-host", default=os.environ.get("DOGSTATSD_HOST", "127.0.0.1"), help="DogStatsD host")
  parser.add_argument("--dogstatsd-port", type=int, default=int(os.environ.get("DOGSTATSD_PORT", "8125")), help="DogStatsD port")
  parser.add_argument("--metric-prefix", default=os.environ.get("DOGSTATSD_PREFIX"), help="Optional metric prefix")
  parser.add_argument("--dd-tag", action="append", default=None, help="Additional DogStatsD tag (repeatable)")
  args = parser.parse_args(argv)

  ensure_resources()

  base_tags = load_microvm_tags()
  if args.dd_tag:
    base_tags.extend(tag for tag in args.dd_tag if tag)
  env_tags = os.environ.get("DOGSTATSD_TAGS")
  if env_tags:
    base_tags.extend(tag for tag in env_tags.split(",") if tag)

  sender = DogStatsDSender(
      host=args.dogstatsd_host,
      port=args.dogstatsd_port,
      enabled=args.dogstatsd,
      prefix=args.metric_prefix,
      default_tags=base_tags,
  )

  result = benchmark(args.iterations, args.timeout, base_tags)
  print(
      f"Firecracker microVM boot latency: avg={result['avg_seconds']:.4f}s "
      f"min={result['min_seconds']:.4f}s max={result['max_seconds']:.4f}s"
  )
  print("Samples:", ", ".join(f"{s:.4f}" for s in result["samples"]))

  emit_duration_metrics([result], sender)

  if args.output:
    payload = {
        "timestamp": time.time(),
        "iterations": args.iterations,
        "results": result,
    }
    args.output.write_text(json.dumps(payload, indent=2))
    print(f"Wrote JSON results to {args.output}")

  return 0


if __name__ == "__main__":
  try:
    sys.exit(main())
  except FirecrackerError as exc:
    print(f"error: {exc}", file=sys.stderr)
    sys.exit(2)