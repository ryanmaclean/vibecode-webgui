#!/usr/bin/env python3

"""Read benchmark JSON output and emit DogStatsD metrics."""
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
import sys
from pathlib import Path



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


