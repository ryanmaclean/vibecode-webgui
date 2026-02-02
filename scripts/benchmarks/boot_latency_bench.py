#!/usr/bin/env python3

<<<<<<< HEAD


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

=======
>>>>>>> 5146aef79 (feat(scripts): add Datadog APM tracing to all 195 Python scripts)
"""Measure host vs container startup latency for simple workloads."""
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
<<<<<<< HEAD
      try:
        proc.wait(timeout=5)
      except subprocess.TimeoutExpired:
        proc.kill()

    if boot_time is None:
      raise BenchmarkError("Failed to detect BusyBox shell prompt during kernel boot")

    samples.append(boot_time)

  return summarise("minivim kernel boot", samples)



def format_row(entry: dict) -> str:
  return (
      f"{entry['label']:<32} avg={entry['avg_seconds']:.4f}s "
      f"min={entry['min_seconds']:.4f}s max={entry['max_seconds']:.4f}s"
  )






def ensure_docker_image(image: str) -> None:
  result = subprocess.run(["docker", "image", "inspect", image], stdout=DEVNULL, stderr=DEVNULL)
  if result.returncode != 0:
    print(f"Pulling missing image: {image}")
    run_command(["docker", "pull", image])


def warm_container(image: str, iterations: int) -> list[dict]:
  ensure_docker_image(image)
  container = f"bench-{uuid.uuid4().hex[:12]}"
  create_cmd = [
      "docker",
      "create",
      "--name",
      container,
      image,
      "sh",
      "-c",
      "while true; do sleep 3600; done",
  ]
  run_command(create_cmd)
  start_samples: list[float] = []
  stop_samples: list[float] = []
  try:
    for _ in range(iterations):
      start = time.perf_counter()
      run_command(["docker", "start", container])
      start_samples.append(time.perf_counter() - start)
      start = time.perf_counter()
      run_command(["docker", "stop", "-t", "0", container])
      stop_samples.append(time.perf_counter() - start)
  finally:
    subprocess.run(["docker", "rm", "-f", container], stdout=DEVNULL, stderr=DEVNULL)
  return [
      summarise(f"docker start ({image})", start_samples),
      summarise(f"docker stop ({image})", stop_samples),
  ]


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--iterations", type=int, default=5, help="Runs per benchmark (default: 5)")
  parser.add_argument("--output", type=Path, help="Optional JSON file for raw results")
  parser.add_argument("--report", type=Path, help="Alias for --output when measuring kernels")
  parser.add_argument("--no-node", action="store_true", help="Skip Node.js benchmarks")
  parser.add_argument("--warm", action="store_true", help="Measure start/stop on a warmed container")
  parser.add_argument("--kernel", type=Path, help="Path to a kernel image for MiniVim boot benchmarks")
  parser.add_argument(
      "--initrd",
      type=Path,
      help=f"Initrd to pair with --kernel (default: {DEFAULT_INITRD})",
  )
  parser.add_argument(
      "--kernel-arch",
      default="x86_64",
      choices=tuple(QEMU_BINARIES.keys()),
      help="Architecture for --kernel boot test",
  )
  parser.add_argument(
      "--kernel-timeout",
      type=float,
      default=30.0,
      help="Seconds to wait for kernel boot prompt",
  )
  parser.add_argument("--image", default="alpine:3.20", help="Base image for shell tests (default: alpine:3.20)")
  parser.add_argument("--node-image", default="node:22-alpine", help="Image used for Node.js tests")
  parser.add_argument("--show-samples", action="store_true", help="Print individual samples")
  parser.add_argument("--dogstatsd", action="store_true", help="Emit DogStatsD metrics for each measurement")
  parser.add_argument("--dogstatsd-host", default=os.environ.get("DOGSTATSD_HOST", "127.0.0.1"), help="DogStatsD host (default: env DOGSTATSD_HOST or 127.0.0.1)")
  parser.add_argument("--dogstatsd-port", type=int, default=int(os.environ.get("DOGSTATSD_PORT", "8125")), help="DogStatsD port (default: env DOGSTATSD_PORT or 8125)")
  parser.add_argument("--metric-prefix", default=os.environ.get("DOGSTATSD_PREFIX"), help="Metric prefix, optional (env DOGSTATSD_PREFIX)")
  parser.add_argument("--dd-tag", action="append", default=None, help="Additional DogStatsD tag (can be repeated). Defaults to DOGSTATSD_TAGS env (comma separated)")
  args = parser.parse_args(argv)

  output_path = args.report if args.report else args.output
  kernel_mode = args.kernel is not None

  results: list[dict] = []

  metric_tags: list[str] = []
  env_tags = os.environ.get("DOGSTATSD_TAGS")
  if env_tags:
    metric_tags.extend(tag for tag in env_tags.split(",") if tag)
  if args.dd_tag:
    metric_tags.extend(tag for tag in args.dd_tag if tag)

  dogstatsd_sender = DogStatsDSender(
      host=args.dogstatsd_host,
      port=args.dogstatsd_port,
      enabled=args.dogstatsd,
      prefix=args.metric_prefix,
      default_tags=metric_tags,
  )

  if kernel_mode:
    kernel_path = args.kernel.expanduser().resolve()
    initrd_candidate = args.initrd if args.initrd is not None else DEFAULT_INITRD
    initrd_path = initrd_candidate.expanduser().resolve()

    kernel_result = measure_kernel_boot(
        kernel_path,
        initrd_path,
        args.kernel_arch,
        args.iterations,
        args.kernel_timeout,
    )
    kernel_result["tags"] = [
        "scope:kernel",
        f"arch:{args.kernel_arch}",
        f"kernel:{kernel_path.name}",
    ]
    results.append(kernel_result)

    print("Benchmark results")
    print("-----------------")
    for entry in results:
      print(format_row(entry))
      if args.show_samples:
        print("  samples:", ", ".join(f"{s:.4f}" for s in entry["samples"]))

    emit_duration_metrics(results, dogstatsd_sender)

    if output_path:
      payload = {
          "timestamp": time.time(),
          "iterations": args.iterations,
          "results": results,
      }
      output_path.write_text(json.dumps(payload, indent=2))
      print(f"\nWrote JSON results to {output_path}")

    return 0

  if shutil.which("docker") is None:
    raise BenchmarkError("Docker CLI not found in PATH")

  ensure_docker_image(args.image)

  shell_host_cmd = ["/bin/sh", "-c", "echo ready"]
  shell_container_cmd = ["docker", "run", "--rm", args.image, "echo", "ready"]
  results.append(
      measure_latency(
          "host shell",
          shell_host_cmd,
          args.iterations,
          ["scope:host", "runtime:shell"],
      )
  )
  results.append(
      measure_latency(
          f"container shell ({args.image})",
          shell_container_cmd,
          args.iterations,
          ["scope:container", "runtime:shell", f"image:{args.image}"],
      )
  )

  if not args.no_node:
    if shutil.which("node") is None:
      raise BenchmarkError("Node.js runtime not found; rerun with --no-node to skip")
    ensure_docker_image(args.node_image)
    node_host_cmd = ["node", "-e", "process.exit(0)"]
    node_container_cmd = [
        "docker",
        "run",
        "--rm",
        args.node_image,
        "node",
        "-e",
        "process.exit(0)",
    ]
    results.append(
        measure_latency(
            "host node",
            node_host_cmd,
            args.iterations,
            ["scope:host", "runtime:node"],
        )
    )
    results.append(
        measure_latency(
            f"container node ({args.node_image})",
            node_container_cmd,
            args.iterations,
            ["scope:container", "runtime:node", f"image:{args.node_image}"],
        )
    )

  if args.warm:
    warm_results = warm_container(args.image, args.iterations)
    # Annotate tags for warm start/stop entries.
    for entry in warm_results:
      if entry["label"].startswith("docker start"):
        entry["tags"] = ["scope:container", "action:start", f"image:{args.image}"]
      elif entry["label"].startswith("docker stop"):
        entry["tags"] = ["scope:container", "action:stop", f"image:{args.image}"]
    results.extend(warm_results)

  print("Benchmark results")
  print("-----------------")
  for entry in results:
    print(format_row(entry))
    if args.show_samples:
      print("  samples:", ", ".join(f"{s:.4f}" for s in entry["samples"]))

  emit_duration_metrics(results, dogstatsd_sender)

  if output_path:
    payload = {
        "timestamp": time.time(),
        "iterations": args.iterations,
        "results": results,
    }
    output_path.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote JSON results to {output_path}")

  return 0


if __name__ == "__main__":
  try:
    sys.exit(main())
  except BenchmarkError as err:
    print(f"error: {err}", file=sys.stderr)
    sys.exit(2)
  except subprocess.CalledProcessError as err:
    print(f"command failed: {err}", file=sys.stderr)
    sys.exit(err.returncode)
=======
>>>>>>> 5146aef79 (feat(scripts): add Datadog APM tracing to all 195 Python scripts)
