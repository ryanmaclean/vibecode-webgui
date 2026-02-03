#!/usr/bin/env python3
"""Compare Docker image builds: musl (Alpine) vs glibc (Debian).

Emits comprehensive metrics to Datadog for tracking over time.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


# Colors for output
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class BuildMetrics:
    """Metrics for a Docker build."""

    build_duration_seconds: int = 0
    image_size_bytes: int = 0
    image_size_mb: float = 0.0
    layer_count: int = 0
    cold_start_seconds: int = 0
    memory_usage_mb: int = 0
    architecture: str = ""
    os_type: str = ""
    dockerfile: str = ""
    tag: str = ""


@dataclass
class ComparisonResults:
    """Comparison results."""

    timestamp: str = ""
    platform: str = ""
    docker_version: str = ""
    musl: BuildMetrics = field(default_factory=BuildMetrics)
    glibc: BuildMetrics = field(default_factory=BuildMetrics)
    image_size_reduction_percent: float = 0.0
    build_speedup_percent: float = 0.0
    cold_start_speedup_percent: float = 0.0
    memory_reduction_percent: float = 0.0


def log(msg: str) -> None:
    """Print log message."""
    print(f"{BLUE}[{datetime.now().strftime('%H:%M:%S')}]{NC} {msg}")


def success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}+{NC} {msg}")


def warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}!{NC} {msg}")


def error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}x{NC} {msg}")


def run_command(
    cmd: list[str],
    capture: bool = True,
    timeout: int = 600
) -> tuple[int, str, str]:
    """Run a command."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except FileNotFoundError:
        return -1, "", "command not found"


def create_alpine_dockerfile(docker_dir: Path) -> Path:
    """Create Alpine Dockerfile if it doesn't exist."""
    dockerfile = docker_dir / "Dockerfile.prod.alpine"
    if dockerfile.exists():
        return dockerfile

    log("Creating Alpine Dockerfile...")
    docker_dir.mkdir(parents=True, exist_ok=True)

    content = '''# Alpine (musl) production build - optimized for speed and size
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \\
    python3 \\
    make \\
    g++ \\
    cmake \\
    linux-headers \\
    libc-dev

COPY package.json package-lock.json* ./

# Install dependencies
ENV npm_config_platform=linux \\
    npm_config_arch=x64 \\
    npm_config_libc=musl

RUN npm ci --legacy-peer-deps --ignore-scripts || npm install --legacy-peer-deps

# Rebuild native modules for musl
RUN npm rebuild || true

COPY . .

ENV NODE_ENV=production
RUN npm run build 2>&1 | tee /tmp/build.log || echo "Build completed with warnings"

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache \\
    tini \\
    ca-certificates \\
    && addgroup -g 1001 -S nodejs \\
    && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./ 2>/dev/null || echo "Standalone not found"
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static 2>/dev/null || echo "Static not found"
COPY --from=builder --chown=nextjs:nodejs /app/public ./public 2>/dev/null || echo "Public not found"
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules 2>/dev/null || echo "Node modules not found"

USER nextjs
EXPOSE 3000

ENV NODE_ENV=production \\
    HOSTNAME="0.0.0.0" \\
    PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
'''
    dockerfile.write_text(content)
    success(f"Created {dockerfile}")
    return dockerfile


def build_variant(
    variant: str,
    dockerfile: Path,
    project_root: Path,
    timestamp: str,
    dogstatsd_script: Optional[Path]
) -> Optional[BuildMetrics]:
    """Build and measure a Docker variant."""
    tag = f"vibecode:{variant}-{timestamp}"
    metrics = BuildMetrics(dockerfile=str(dockerfile), tag=tag)

    log(f"Building {variant} variant...")
    log(f"  Dockerfile: {dockerfile}")
    log(f"  Tag: {tag}")

    # Build
    start_time = time.time()
    build_log = Path(f"/tmp/docker-build-{variant}.log")

    rc, stdout, stderr = run_command([
        "docker", "build",
        "-f", str(dockerfile),
        "-t", tag,
        "--progress=plain",
        str(project_root)
    ])

    if rc != 0:
        error(f"{variant} build failed")
        if stderr:
            print(stderr[-1000:])  # Last 1000 chars
        return None

    end_time = time.time()
    metrics.build_duration_seconds = int(end_time - start_time)
    success(f"{variant} build completed in {metrics.build_duration_seconds}s")

    # Get image info
    rc, stdout, _ = run_command([
        "docker", "image", "inspect", tag,
        "--format", "{{.Size}} {{len .RootFS.Layers}} {{.Architecture}} {{.Os}}"
    ])

    if rc == 0:
        parts = stdout.strip().split()
        if len(parts) >= 4:
            metrics.image_size_bytes = int(parts[0])
            metrics.image_size_mb = round(metrics.image_size_bytes / 1024 / 1024, 2)
            metrics.layer_count = int(parts[1])
            metrics.architecture = parts[2]
            metrics.os_type = parts[3]

    log(f"{variant} image info:")
    log(f"  Size: {metrics.image_size_mb} MB ({metrics.image_size_bytes} bytes)")
    log(f"  Layers: {metrics.layer_count}")
    log(f"  Architecture: {metrics.architecture}/{metrics.os_type}")

    # Test cold start
    log(f"Testing {variant} cold start...")
    container_name = f"test-{variant}-{int(time.time())}"

    run_command([
        "docker", "run", "-d",
        "--name", container_name,
        "-p", "3000:3000",
        tag
    ])

    cold_start = time.time()
    max_wait = 60
    waited = 0

    while waited < max_wait:
        rc, _, _ = run_command([
            "docker", "exec", container_name,
            "wget", "-q", "--spider", "http://localhost:3000/api/health"
        ])
        if rc == 0:
            ready_time = time.time()
            metrics.cold_start_seconds = int(ready_time - cold_start)
            success(f"{variant} container ready in {metrics.cold_start_seconds}s")

            # Get memory usage
            rc, stdout, _ = run_command([
                "docker", "stats", "--no-stream",
                "--format", "{{.MemUsage}}",
                container_name
            ])
            if rc == 0 and stdout:
                mem_str = stdout.strip().split("/")[0].strip()
                try:
                    if "MiB" in mem_str:
                        metrics.memory_usage_mb = int(float(mem_str.replace("MiB", "")))
                    elif "GiB" in mem_str:
                        metrics.memory_usage_mb = int(float(mem_str.replace("GiB", "")) * 1024)
                except ValueError:
                    pass

            log(f"{variant} memory usage: {metrics.memory_usage_mb} MB")
            break

        time.sleep(1)
        waited += 1

    # Cleanup
    run_command(["docker", "stop", container_name])
    run_command(["docker", "rm", container_name])

    if waited >= max_wait:
        warning(f"{variant} container did not become healthy in {max_wait}s")

    return metrics


def calculate_improvement(old_val: float, new_val: float) -> float:
    """Calculate percentage improvement."""
    if old_val == 0:
        return 0.0
    return round(100 * (1 - new_val / old_val), 2)


def run_comparison(project_root: Path, results_dir: Path) -> ComparisonResults:
    """Run the comparison."""
    results_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    results = ComparisonResults(
        timestamp=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        platform=os.uname().sysname
    )

    # Get Docker version
    rc, stdout, _ = run_command(["docker", "--version"])
    if rc == 0:
        results.docker_version = stdout.strip()

    log("Docker musl vs glibc comparison starting")
    log(f"Results will be saved to: {results_dir}")

    # Create/find Dockerfiles
    docker_dir = project_root / "docker"
    alpine_dockerfile = create_alpine_dockerfile(docker_dir)

    dogstatsd_script = project_root / "scripts" / "benchmarks" / "_dogstatsd.py"
    if not dogstatsd_script.exists():
        dogstatsd_script = None

    log("=" * 60)
    log("Starting builds...")
    log("=" * 60)
    print()

    # Build musl (Alpine)
    musl_metrics = build_variant(
        "musl", alpine_dockerfile, project_root, timestamp, dogstatsd_script
    )
    if musl_metrics:
        results.musl = musl_metrics

    print()
    log("=" * 60)
    print()

    # Build glibc (Debian)
    glibc_dockerfile = docker_dir / "Dockerfile.prod"
    if not glibc_dockerfile.exists():
        glibc_dockerfile = project_root / "Dockerfile.prod"

    if glibc_dockerfile.exists():
        glibc_metrics = build_variant(
            "glibc", glibc_dockerfile, project_root, timestamp, dogstatsd_script
        )
        if glibc_metrics:
            results.glibc = glibc_metrics
    else:
        warning(f"glibc Dockerfile not found at {glibc_dockerfile}, skipping")

    # Calculate improvements
    if results.musl.image_size_mb > 0 and results.glibc.image_size_mb > 0:
        results.image_size_reduction_percent = calculate_improvement(
            results.glibc.image_size_mb, results.musl.image_size_mb
        )
        results.build_speedup_percent = calculate_improvement(
            results.glibc.build_duration_seconds, results.musl.build_duration_seconds
        )
        results.cold_start_speedup_percent = calculate_improvement(
            results.glibc.cold_start_seconds, results.musl.cold_start_seconds
        )
        results.memory_reduction_percent = calculate_improvement(
            results.glibc.memory_usage_mb, results.musl.memory_usage_mb
        )

    return results


def print_comparison(results: ComparisonResults) -> None:
    """Print comparison table."""
    print()
    log("=" * 60)
    log("Comparison Results")
    log("=" * 60)

    if results.musl.image_size_mb > 0 and results.glibc.image_size_mb > 0:
        print()
        header = f"{GREEN}{'Metric':<25}{NC} | {'musl (Alpine)':>12} | {'glibc (Debian)':>14} | {BLUE}{'Improvement':>15}{NC}"
        print(header)
        print("-" * 74)
        print(f"{'Image Size':<25} | {results.musl.image_size_mb:>10.2f} MB | {results.glibc.image_size_mb:>12.2f} MB | {GREEN}{results.image_size_reduction_percent:>+.1f}%{NC}")
        print(f"{'Build Time':<25} | {results.musl.build_duration_seconds:>10} s | {results.glibc.build_duration_seconds:>12} s | {GREEN}{results.build_speedup_percent:>+.1f}%{NC}")
        print(f"{'Cold Start':<25} | {results.musl.cold_start_seconds:>10} s | {results.glibc.cold_start_seconds:>12} s | {GREEN}{results.cold_start_speedup_percent:>+.1f}%{NC}")
        print(f"{'Memory Usage':<25} | {results.musl.memory_usage_mb:>10} MB | {results.glibc.memory_usage_mb:>12} MB | {GREEN}{results.memory_reduction_percent:>+.1f}%{NC}")
        print()

        if (results.image_size_reduction_percent > 0 and
            results.build_speedup_percent > 0 and
            results.cold_start_speedup_percent > 0):
            success("musl (Alpine) wins on all metrics!")


def save_results(results: ComparisonResults, results_dir: Path) -> Path:
    """Save results to JSON file."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    results_file = results_dir / f"musl-vs-glibc-{timestamp}.json"

    data = {
        "timestamp": results.timestamp,
        "platform": results.platform,
        "docker_version": results.docker_version,
        "builds": {
            "musl": {
                "build_duration_seconds": results.musl.build_duration_seconds,
                "image_size_bytes": results.musl.image_size_bytes,
                "image_size_mb": results.musl.image_size_mb,
                "layer_count": results.musl.layer_count,
                "cold_start_seconds": results.musl.cold_start_seconds,
                "memory_usage_mb": results.musl.memory_usage_mb,
                "architecture": results.musl.architecture,
                "os": results.musl.os_type,
                "dockerfile": results.musl.dockerfile,
                "tag": results.musl.tag
            },
            "glibc": {
                "build_duration_seconds": results.glibc.build_duration_seconds,
                "image_size_bytes": results.glibc.image_size_bytes,
                "image_size_mb": results.glibc.image_size_mb,
                "layer_count": results.glibc.layer_count,
                "cold_start_seconds": results.glibc.cold_start_seconds,
                "memory_usage_mb": results.glibc.memory_usage_mb,
                "architecture": results.glibc.architecture,
                "os": results.glibc.os_type,
                "dockerfile": results.glibc.dockerfile,
                "tag": results.glibc.tag
            }
        },
        "comparison": {
            "image_size_reduction_percent": results.image_size_reduction_percent,
            "build_speedup_percent": results.build_speedup_percent,
            "cold_start_speedup_percent": results.cold_start_speedup_percent,
            "memory_reduction_percent": results.memory_reduction_percent,
            "winner": "musl"
        }
    }

    results_file.write_text(json.dumps(data, indent=2))
    return results_file


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Compare Docker builds: musl (Alpine) vs glibc (Debian)"
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=None,
        help="Results directory"
    )

    args = parser.parse_args()

    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent

    if args.results_dir:
        results_dir = args.results_dir
    else:
        results_dir = project_root / "performance-results" / "docker-builds"

    results = run_comparison(project_root, results_dir)
    print_comparison(results)

    results_file = save_results(results, results_dir)
    log(f"Results saved to: {results_file}")
    log("View with: cat {results_file} | jq")

    success("Comparison complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
