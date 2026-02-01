#!/usr/bin/env python3
"""Alpine (musl) Chromium headless DOM benchmark.

This benchmark:
- Pulls alpine:3.20, installs chromium
- Hits a URL (default http://host.docker.internal:8080/)
- Measures time-to-DOM via --dump-dom
- Emits JSON results to stdout
- Optionally emits DogStatsD metrics to host (Datadog agent) via UDP
  metric: vibecode.bench.dom_dump_ms (gauge)
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import re
import sys
import time
from pathlib import Path

try:
    from .benchmark_utils import (
        BenchmarkError,
        calc_stats,
        check_command,
        log,
        run_cmd,
        run_cmd_output,
    )
    from ._dogstatsd import DogStatsDSender
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        BenchmarkError,
        calc_stats,
        check_command,
        log,
        run_cmd,
        run_cmd_output,
    )
    from _dogstatsd import DogStatsDSender


DEFAULT_URL = "http://host.docker.internal:8080/"
DEFAULT_ITERATIONS = 3
DEFAULT_DOCKER_IMAGE = "alpine:3.20"
DEFAULT_DOGSTATSD_ADDR = "host.docker.internal:8125"


def sanitize_url_tag(url: str) -> str:
    """Sanitize URL for use as a DogStatsD tag."""
    return re.sub(r"[:,|# ]", "_", url)


def run_chromium_benchmark(
    url: str,
    iterations: int,
    docker_image: str,
    dogstatsd_addr: str,
    emit_stats: bool,
) -> dict:
    """Run the Chromium DOM dump benchmark in a Docker container.

    Args:
        url: URL to fetch
        iterations: Number of iterations to run
        docker_image: Docker image to use
        dogstatsd_addr: DogStatsD address (host:port)
        emit_stats: Whether to emit DogStatsD metrics

    Returns:
        Dictionary with benchmark results
    """
    if not check_command("docker"):
        raise BenchmarkError("Docker CLI not found in PATH")

    # Check Docker daemon
    result = run_cmd(["docker", "info"], check=False, capture=True)
    if result.returncode != 0:
        raise BenchmarkError("Docker daemon not available")

    # Build the container script
    container_script = f'''
set -euo pipefail
URL="{url}"
ITER={iterations}
DOGSTATSD_ADDR="{dogstatsd_addr}"
EMIT_STATS="{str(emit_stats).lower()}"

apk add --no-cache chromium curl coreutils >/dev/null

# Versions
MUSL_VER=$(ldd --version 2>&1 | head -n1 | tr -s ' ')
CHROME_BIN=$(command -v chromium-browser || command -v chromium)
CHROME_VER=$($CHROME_BIN --version 2>/dev/null | tr -s ' ')

# Run iterations
RESULTS=""
for i in $(seq 1 "$ITER"); do
  start=$(date +%s%3N)
  "$CHROME_BIN" --headless=new --disable-gpu --no-sandbox \\
    --user-data-dir=/tmp/chrome --dump-dom "$URL" >/tmp/dom.html 2>/tmp/chrome.log || true
  end=$(date +%s%3N)
  dur=$((end - start))
  if [ -n "$RESULTS" ]; then
    RESULTS="$RESULTS,$dur"
  else
    RESULTS="$dur"
  fi
  if [ "$EMIT_STATS" = "true" ]; then
    METRIC="vibecode.bench.dom_dump_ms:${{dur}}|g|#mode:alpine_chromium,url:$(echo "$URL" | sed 's/[:,|# ]/_/g')"
    (echo "$METRIC" >/dev/udp/${{DOGSTATSD_ADDR%:*}}/${{DOGSTATSD_ADDR#*:}}) 2>/dev/null || true
  fi
  sleep 0.2
done

# Output JSON
echo "{{\\"url\\": \\"$URL\\", \\"iter\\": $ITER, \\"musl\\": \\"$MUSL_VER\\", \\"chromium\\": \\"$CHROME_VER\\", \\"durations_ms\\": [$RESULTS]}}"
'''

    log(f"Running Chromium benchmark: {iterations} iterations on {url}")
    log(f"Using Docker image: {docker_image}")

    result = run_cmd(
        [
            "docker", "run", "--rm",
            "-e", f"URL={url}",
            "-e", f"ITER={iterations}",
            "-e", f"DOGSTATSD_ADDR={dogstatsd_addr}",
            "-e", f"EMIT_STATS={str(emit_stats).lower()}",
            docker_image,
            "sh", "-c", container_script,
        ],
        capture=True,
        timeout=300,  # 5 minutes max
    )

    # Parse the JSON output (last line)
    output_lines = result.stdout.strip().split("\n")
    json_line = output_lines[-1]

    try:
        data = json.loads(json_line)
    except json.JSONDecodeError as exc:
        raise BenchmarkError(f"Failed to parse benchmark output: {exc}") from exc

    # Calculate statistics
    durations = data.get("durations_ms", [])
    stats = calc_stats(durations)

    return {
        "url": data.get("url", url),
        "iter": data.get("iter", iterations),
        "musl": data.get("musl", "unknown"),
        "chromium": data.get("chromium", "unknown"),
        "durations_ms": durations,
        "min_ms": int(stats["min"]),
        "p50_ms": int(stats["p50"]),
        "p95_ms": int(stats["p95"]),
        "max_ms": int(stats["max"]),
    }


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"URL to benchmark (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "-n", "--iter",
        type=int,
        default=DEFAULT_ITERATIONS,
        help=f"Number of iterations (default: {DEFAULT_ITERATIONS})",
    )
    parser.add_argument(
        "--dogstatsd",
        default=DEFAULT_DOGSTATSD_ADDR,
        help=f"DogStatsD address (default: {DEFAULT_DOGSTATSD_ADDR})",
    )
    parser.add_argument(
        "--no-stats",
        action="store_true",
        help="Disable DogStatsD metric emission",
    )
    parser.add_argument(
        "--image",
        default=DEFAULT_DOCKER_IMAGE,
        help=f"Docker image to use (default: {DEFAULT_DOCKER_IMAGE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output JSON file (default: stdout)",
    )

    args = parser.parse_args(argv)

    try:
        results = run_chromium_benchmark(
            url=args.url,
            iterations=args.iter,
            docker_image=args.image,
            dogstatsd_addr=args.dogstatsd,
            emit_stats=not args.no_stats,
        )

        output = json.dumps(results, indent=2)

        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output)
            log(f"Results saved to: {args.output}")
        else:
            print(output)

        return 0

    except BenchmarkError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
