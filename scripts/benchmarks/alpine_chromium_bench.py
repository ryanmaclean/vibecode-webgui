#!/usr/bin/env python3
"""Alpine (musl) Chromium headless DOM benchmark.

- Pulls alpine:3.20, installs chromium
- Hits a URL (default http://host.docker.internal:8080/)
- Measures time-to-DOM via --dump-dom
- Emits JSON results to stdout
- Optionally emits DogStatsD metrics to host (Datadog agent) via UDP
  metric: vibecode.bench.dom_dump_ms (gauge)
"""

import argparse
import json
import shutil
import socket
import statistics
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class BenchmarkConfig:
    """Benchmark configuration."""

    url: str = "http://host.docker.internal:8080/"
    iterations: int = 3
    docker_image: str = "alpine:3.20"
    dogstatsd_addr: str = "host.docker.internal:8125"
    emit_stats: bool = True


@dataclass
class BenchmarkResults:
    """Benchmark results."""

    url: str = ""
    iterations: int = 0
    musl_version: str = ""
    chromium_version: str = ""
    durations_ms: list[int] = field(default_factory=list)
    min_ms: int = 0
    p50_ms: int = 0
    p95_ms: int = 0
    max_ms: int = 0


def command_exists(cmd: str) -> bool:
    """Check if a command exists."""
    return shutil.which(cmd) is not None


def run_command(
    cmd: list[str],
    capture: bool = True,
    cwd: Optional[Path] = None
) -> tuple[int, str, str]:
    """Run a command and return result."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            cwd=cwd
        )
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return -1, "", "command not found"


def check_docker() -> bool:
    """Check if Docker is available."""
    rc, _, _ = run_command(["docker", "info"])
    return rc == 0


def send_dogstatsd_metric(
    addr: str,
    metric_name: str,
    value: int,
    tags: dict[str, str]
) -> None:
    """Send a metric via DogStatsD UDP."""
    try:
        host, port_str = addr.split(":")
        port = int(port_str)

        tag_str = ",".join(f"{k}:{v}" for k, v in tags.items())
        message = f"{metric_name}:{value}|g|#{tag_str}"

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(message.encode(), (host, port))
        sock.close()
    except Exception:
        pass  # Fire and forget


def calculate_percentile(data: list[int], percentile: float) -> int:
    """Calculate percentile from sorted data."""
    if not data:
        return 0
    sorted_data = sorted(data)
    idx = int(percentile * len(sorted_data))
    if idx >= len(sorted_data):
        idx = len(sorted_data) - 1
    if idx < 0:
        idx = 0
    return sorted_data[idx]


def run_benchmark(config: BenchmarkConfig) -> BenchmarkResults:
    """Run the Chromium DOM benchmark.

    Args:
        config: Benchmark configuration.

    Returns:
        Benchmark results.
    """
    results = BenchmarkResults(
        url=config.url,
        iterations=config.iterations
    )

    # Build the container script
    container_script = f'''
set -euo pipefail
URL="{config.url}"
ITER="{config.iterations}"
DOGSTATSD_ADDR="{config.dogstatsd_addr}"
EMIT_STATS="{str(config.emit_stats).lower()}"

apk add --no-cache chromium curl coreutils >/dev/null

# Get versions
MUSL_VER=$(ldd --version 2>&1 | head -n1 | tr -s ' ')
CHROME_BIN=$(command -v chromium-browser || command -v chromium)
CHROME_VER=$($CHROME_BIN --version 2>/dev/null | tr -s ' ')

echo "MUSL_VERSION:$MUSL_VER"
echo "CHROME_VERSION:$CHROME_VER"

# Run iterations
for i in $(seq 1 "$ITER"); do
  start=$(date +%s%3N)
  "$CHROME_BIN" --headless=new --disable-gpu --no-sandbox \\
    --user-data-dir=/tmp/chrome --dump-dom "$URL" >/tmp/dom.html 2>/tmp/chrome.log || true
  end=$(date +%s%3N)
  dur=$((end - start))
  echo "DURATION:$dur"
  sleep 0.2
done
'''

    # Run Docker container
    rc, stdout, stderr = run_command([
        "docker", "run", "--rm",
        "-e", f"URL={config.url}",
        "-e", f"ITER={config.iterations}",
        "-e", f"DOGSTATSD_ADDR={config.dogstatsd_addr}",
        "-e", f"EMIT_STATS={str(config.emit_stats).lower()}",
        config.docker_image,
        "sh", "-c", container_script
    ])

    if rc != 0:
        print(f"Docker run failed: {stderr}", file=sys.stderr)
        return results

    # Parse output
    durations = []
    for line in stdout.splitlines():
        if line.startswith("MUSL_VERSION:"):
            results.musl_version = line.split(":", 1)[1].strip()
        elif line.startswith("CHROME_VERSION:"):
            results.chromium_version = line.split(":", 1)[1].strip()
        elif line.startswith("DURATION:"):
            try:
                dur = int(line.split(":", 1)[1].strip())
                durations.append(dur)

                # Send to DogStatsD if enabled
                if config.emit_stats:
                    safe_url = config.url.replace(":", "_").replace("|", "_").replace("#", "_").replace(" ", "_")
                    send_dogstatsd_metric(
                        config.dogstatsd_addr,
                        "vibecode.bench.dom_dump_ms",
                        dur,
                        {"mode": "alpine_chromium", "url": safe_url}
                    )
            except ValueError:
                pass

    results.durations_ms = durations

    if durations:
        results.min_ms = min(durations)
        results.max_ms = max(durations)
        results.p50_ms = int(statistics.median(durations))
        results.p95_ms = calculate_percentile(durations, 0.95)

    return results


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    parser = argparse.ArgumentParser(
        description="Alpine (musl) Chromium headless DOM benchmark"
    )
    parser.add_argument(
        "--url",
        default="http://host.docker.internal:8080/",
        help="URL to benchmark"
    )
    parser.add_argument(
        "-n", "--iter",
        type=int,
        default=3,
        help="Number of iterations"
    )
    parser.add_argument(
        "--dogstatsd",
        default="host.docker.internal:8125",
        help="DogStatsD address"
    )
    parser.add_argument(
        "--no-stats",
        action="store_true",
        help="Disable DogStatsD metrics"
    )

    args = parser.parse_args()

    # Check Docker
    if not check_docker():
        print("ERROR: Docker daemon not available", file=sys.stderr)
        return 1

    config = BenchmarkConfig(
        url=args.url,
        iterations=args.iter,
        dogstatsd_addr=args.dogstatsd,
        emit_stats=not args.no_stats
    )

    results = run_benchmark(config)

    # Output JSON
    output = {
        "url": results.url,
        "iter": results.iterations,
        "musl": results.musl_version,
        "chromium": results.chromium_version,
        "durations_ms": results.durations_ms,
        "min_ms": results.min_ms,
        "p50_ms": results.p50_ms,
        "p95_ms": results.p95_ms,
        "max_ms": results.max_ms
    }
    print(json.dumps(output, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
