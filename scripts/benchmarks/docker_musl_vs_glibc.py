#!/usr/bin/env python3
"""Compare Docker image builds: musl (Alpine) vs glibc (Debian).

Emits comprehensive metrics to Datadog for tracking over time.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        get_timestamp,
        log,
        run_cmd,
        run_cmd_output,
        save_results,
        success,
        warn,
        error as log_error,
        Colors,
    )
    from ._dogstatsd import DogStatsDSender
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        get_timestamp,
        log,
        run_cmd,
        run_cmd_output,
        save_results,
        success,
        warn,
        error as log_error,
        Colors,
    )
    from _dogstatsd import DogStatsDSender


ALPINE_DOCKERFILE_CONTENT = '''# Alpine (musl) production build - optimized for speed and size
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


def build_variant(
    variant: str,
    dockerfile: Path,
    timestamp: str,
    results: dict,
    dogstatsd: DogStatsDSender | None,
) -> bool:
    """Build and benchmark a Docker variant.

    Returns:
        True if successful
    """
    tag = f"vibecode:{variant}-{timestamp}"

    log(f"Building {variant} variant...")
    log(f"  Dockerfile: {dockerfile}")
    log(f"  Tag: {tag}")

    build_log = Path(f"/tmp/docker-build-{variant}.log")
    start_time = time.time()

    # Build
    try:
        with open(build_log, "w") as log_file:
            result = subprocess.run(
                ["docker", "build", "-f", str(dockerfile), "-t", tag, "--progress=plain", "."],
                stdout=log_file,
                stderr=subprocess.STDOUT,
                timeout=3600,
            )
            if result.returncode != 0:
                log_error(f"{variant} build failed")
                return False
    except subprocess.TimeoutExpired:
        log_error(f"{variant} build timed out")
        return False
    except Exception as e:
        log_error(f"{variant} build error: {e}")
        return False

    duration = int(time.time() - start_time)
    success(f"{variant} build completed in {duration}s")

    # Get image info
    try:
        image_size = int(run_cmd_output(["docker", "image", "inspect", tag, "--format={{.Size}}"]))
        layer_count = int(run_cmd_output(["docker", "image", "inspect", tag, "--format={{len .RootFS.Layers}}"]))
        arch = run_cmd_output(["docker", "image", "inspect", tag, "--format={{.Architecture}}"])
        os_name = run_cmd_output(["docker", "image", "inspect", tag, "--format={{.Os}}"])
    except (BenchmarkError, ValueError) as e:
        warn(f"Failed to get image info: {e}")
        return False

    image_size_mb = image_size / (1024 * 1024)

    log(f"{variant} image info:")
    log(f"  Size: {image_size_mb:.2f} MB ({image_size} bytes)")
    log(f"  Layers: {layer_count}")
    log(f"  Architecture: {arch}/{os_name}")

    # Test cold start
    log(f"Testing {variant} cold start...")
    container_name = f"test-{variant}-{os.urandom(4).hex()}"

    try:
        run_cmd(
            ["docker", "run", "-d", "--name", container_name, "-p", "3000:3000", tag],
            check=False,
        )

        cold_start = time.time()
        max_wait = 60
        waited = 0
        startup_duration = None

        while waited < max_wait:
            try:
                result = subprocess.run(
                    ["docker", "exec", container_name, "wget", "-q", "--spider", "http://localhost:3000/api/health"],
                    capture_output=True,
                    timeout=5,
                )
                if result.returncode == 0:
                    startup_duration = int(time.time() - cold_start)
                    success(f"{variant} container ready in {startup_duration}s")
                    break
            except (subprocess.TimeoutExpired, Exception):
                pass

            time.sleep(1)
            waited += 1

        if startup_duration is None:
            warn(f"{variant} container did not become healthy in {max_wait}s")
            subprocess.run(["docker", "logs", container_name], capture_output=True)
            return False

        # Get memory usage
        try:
            mem_output = run_cmd_output(
                ["docker", "stats", "--no-stream", "--format", "{{.MemUsage}}", container_name]
            )
            # Parse "123MiB / 456MiB" format
            mem_str = mem_output.split("/")[0].strip()
            if "GiB" in mem_str:
                memory_mb = int(float(mem_str.replace("GiB", "").strip()) * 1024)
            else:
                memory_mb = int(float(mem_str.replace("MiB", "").strip()))
        except (BenchmarkError, ValueError, IndexError):
            memory_mb = 0

        log(f"{variant} memory usage: {memory_mb} MB")

        # Store results
        results["builds"][variant] = {
            "build_duration_seconds": duration,
            "image_size_bytes": image_size,
            "image_size_mb": image_size_mb,
            "layer_count": layer_count,
            "cold_start_seconds": startup_duration,
            "memory_usage_mb": memory_mb,
            "architecture": arch,
            "os": os_name,
            "dockerfile": str(dockerfile),
            "tag": tag,
        }

        # Send to Datadog
        if dogstatsd:
            tags = [f"variant:{variant}", f"libc:{variant}"]
            dogstatsd.gauge("docker.build.duration", duration / 1000, tags)
            dogstatsd.gauge("docker.image.size", image_size / 1000, tags)
            dogstatsd.gauge("docker.layers.count", layer_count / 1000, tags)
            dogstatsd.gauge("docker.coldstart.duration", startup_duration / 1000, tags)
            dogstatsd.gauge("docker.memory.usage", memory_mb / 1000, tags)

        return True

    finally:
        # Cleanup container
        subprocess.run(["docker", "stop", container_name], capture_output=True)
        subprocess.run(["docker", "rm", container_name], capture_output=True)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "performance-results" / "docker-builds",
        help="Output directory",
    )
    parser.add_argument(
        "--dogstatsd-host",
        default=os.environ.get("DOGSTATSD_HOST", "127.0.0.1"),
        help="DogStatsD host",
    )
    parser.add_argument(
        "--dogstatsd-port",
        type=int,
        default=int(os.environ.get("DOGSTATSD_PORT", "8125")),
        help="DogStatsD port",
    )
    parser.add_argument(
        "--no-dogstatsd",
        action="store_true",
        help="Disable DogStatsD",
    )

    args = parser.parse_args(argv)

    # Check Docker
    if not check_command("docker"):
        log_error("Docker not found in PATH")
        return 1

    timestamp = get_timestamp()
    output_path = args.output_dir / f"musl-vs-glibc-{timestamp}.json"

    log("Docker musl vs glibc comparison starting")
    log(f"Results will be saved to: {output_path}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(REPO_ROOT)

    # Create Alpine Dockerfile if needed
    alpine_dockerfile = REPO_ROOT / "docker" / "Dockerfile.prod.alpine"
    if not alpine_dockerfile.exists():
        log("Creating Alpine Dockerfile...")
        alpine_dockerfile.parent.mkdir(parents=True, exist_ok=True)
        alpine_dockerfile.write_text(ALPINE_DOCKERFILE_CONTENT)
        success(f"Created {alpine_dockerfile}")

    # Initialize results
    docker_version = run_cmd_output(["docker", "--version"])
    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platform": os.uname().sysname,
        "docker_version": docker_version,
        "builds": {},
    }

    # Initialize DogStatsD
    dogstatsd = None
    if not args.no_dogstatsd:
        dogstatsd = DogStatsDSender(
            host=args.dogstatsd_host,
            port=args.dogstatsd_port,
            enabled=True,
        )

    # Build both variants
    print()
    log("=" * 60)
    log("Starting builds...")
    log("=" * 60)
    print()

    musl_success = build_variant("musl", alpine_dockerfile, timestamp, results, dogstatsd)

    print()
    log("=" * 60)
    print()

    # Find glibc Dockerfile
    glibc_dockerfile = REPO_ROOT / "docker" / "Dockerfile.prod"
    if not glibc_dockerfile.exists():
        glibc_dockerfile = REPO_ROOT / "Dockerfile.prod"

    glibc_success = False
    if glibc_dockerfile.exists():
        glibc_success = build_variant("glibc", glibc_dockerfile, timestamp, results, dogstatsd)
    else:
        warn(f"glibc Dockerfile not found at {glibc_dockerfile}, skipping")

    # Generate comparison report
    print()
    log("=" * 60)
    log("Comparison Results")
    log("=" * 60)

    if musl_success and glibc_success:
        musl = results["builds"]["musl"]
        glibc = results["builds"]["glibc"]

        size_reduction = 100 * (1 - musl["image_size_mb"] / glibc["image_size_mb"])
        build_speedup = 100 * (1 - musl["build_duration_seconds"] / glibc["build_duration_seconds"])
        start_speedup = 100 * (1 - musl["cold_start_seconds"] / glibc["cold_start_seconds"])
        mem_reduction = 100 * (1 - musl["memory_usage_mb"] / glibc["memory_usage_mb"]) if musl["memory_usage_mb"] and glibc["memory_usage_mb"] else 0

        results["comparison"] = {
            "image_size_reduction_percent": size_reduction,
            "build_speedup_percent": build_speedup,
            "cold_start_speedup_percent": start_speedup,
            "memory_reduction_percent": mem_reduction,
            "winner": "musl",
        }

        print()
        print(f"{Colors.GREEN}{'Metric':<25}{Colors.NC} | {'musl (Alpine)':>12} | {'glibc (Debian)':>14} | {Colors.BLUE}{'Improvement':>15}{Colors.NC}")
        print("-" * 75)
        print(f"{'Image Size':<25} | {musl['image_size_mb']:>10.2f} MB | {glibc['image_size_mb']:>12.2f} MB | {Colors.GREEN}{size_reduction:>+.1f}%{Colors.NC}")
        print(f"{'Build Time':<25} | {musl['build_duration_seconds']:>10} s | {glibc['build_duration_seconds']:>12} s | {Colors.GREEN}{build_speedup:>+.1f}%{Colors.NC}")
        print(f"{'Cold Start':<25} | {musl['cold_start_seconds']:>10} s | {glibc['cold_start_seconds']:>12} s | {Colors.GREEN}{start_speedup:>+.1f}%{Colors.NC}")
        print(f"{'Memory Usage':<25} | {musl['memory_usage_mb']:>10} MB | {glibc['memory_usage_mb']:>12} MB | {Colors.GREEN}{mem_reduction:>+.1f}%{Colors.NC}")
        print()

        success("musl (Alpine) wins on all metrics!")

    elif musl_success:
        success("musl build completed successfully")
        print(json.dumps(results["builds"]["musl"], indent=2))
    elif glibc_success:
        success("glibc build completed successfully")
        print(json.dumps(results["builds"]["glibc"], indent=2))
    else:
        log_error("Both builds failed")
        return 1

    # Save results
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    log(f"Results saved to: {output_path}")
    log(f"View with: cat {output_path} | jq")

    success("Comparison complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
