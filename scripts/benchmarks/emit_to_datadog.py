#!/usr/bin/env python3

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
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

"""Read benchmark JSON output and emit DogStatsD metrics."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
  from ._dogstatsd import DogStatsDSender, emit_duration_metrics
except ImportError:  # pragma: no cover - fallback when run as script
  sys.path.append(str(Path(__file__).resolve().parent))
  from _dogstatsd import DogStatsDSender, emit_duration_metrics


class EmitError(RuntimeError):
  pass


def load_results(path: Path) -> list[dict]:
  if not path.exists():
    raise EmitError(f"Input file not found: {path}")
  with path.open("r", encoding="utf-8") as handle:
    data = json.load(handle)

  if isinstance(data, list):
    return data
  if isinstance(data, dict):
    if "results" in data:
      results = data["results"]
      if isinstance(results, list):
        return results
      return [results]
    if "label" in data:
      return [data]
  raise EmitError("Unsupported JSON structure; expected dict/list with 'results' entries")


def summarise(entry: dict) -> str:
  return (
      f"{entry['label']}: avg={entry['avg_seconds']:.4f}s"
      f" min={entry['min_seconds']:.4f}s max={entry['max_seconds']:.4f}s"
  )


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--input", type=Path, required=True, help="Path to benchmark JSON output")
  parser.add_argument("--dogstatsd-host", default=os.environ.get("DOGSTATSD_HOST", "127.0.0.1"))
  parser.add_argument("--dogstatsd-port", type=int, default=int(os.environ.get("DOGSTATSD_PORT", "8125")))
  parser.add_argument("--metric-prefix", default=os.environ.get("DOGSTATSD_PREFIX"))
  parser.add_argument("--dd-tag", action="append", default=None, help="Additional DogStatsD tag (repeatable)")
  parser.add_argument("--dry-run", action="store_true", help="Parse but do not send metrics")
  parser.add_argument("--verbose", action="store_true", help="Print summaries of each entry")
  args = parser.parse_args(argv)

  results = load_results(args.input)

  if args.verbose or args.dry_run:
    for entry in results:
      print(summarise(entry))

  extra_tags = []
  env_tags = os.environ.get("DOGSTATSD_TAGS")
  if env_tags:
    extra_tags.extend(tag for tag in env_tags.split(",") if tag)
  if args.dd_tag:
    extra_tags.extend(tag for tag in args.dd_tag if tag)

  sender = DogStatsDSender(
      host=args.dogstatsd_host,
      port=args.dogstatsd_port,
      enabled=not args.dry_run,
      prefix=args.metric_prefix,
      default_tags=extra_tags,
  )

  emit_duration_metrics(results, sender)

  if args.dry_run:
    print("Dry run: metrics were not sent to DogStatsD")

  return 0


if __name__ == "__main__":
  try:
    sys.exit(main())
  except EmitError as exc:
    print(f"error: {exc}", file=sys.stderr)
    sys.exit(2)
  except json.JSONDecodeError as exc:
    print(f"error parsing JSON: {exc}", file=sys.stderr)
    sys.exit(2)