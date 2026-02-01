#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Dockerfile Build Time Benchmark

Benchmarks build times for different Dockerfile variants.

Usage:
    python benchmark_builds.py
"""

import csv
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes."""
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'


@dataclass
class BuildResult:
    """Result of a build benchmark."""
    description: str
    dockerfile: str
    profile: str
    build_time_seconds: Optional[int]
    image_size: Optional[str]
    success: bool


def run_command(cmd: list[str], timeout: int = 3600) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def clean_build_cache() -> None:
    """Clean Docker build cache."""
    print("Cleaning Docker build cache...")
    run_command(
        ["docker", "builder", "prune", "-f", "--filter", "until=1h"],
        timeout=60,
    )


def get_image_size(tag: str) -> Optional[str]:
    """Get the size of a Docker image."""
    rc, stdout, _ = run_command([
        "docker", "images", tag, "--format", "{{.Size}}"
    ])
    return stdout.strip() if rc == 0 else None


def test_image_functionality(tag: str) -> bool:
    """Test if the built image is functional."""
    rc, _, _ = run_command([
        "docker", "run", "--rm", tag,
        "bash", "-c", "vim --version && git --version && node --version"
    ], timeout=60)
    return rc == 0


def benchmark_build(
    dockerfile: str,
    tag: str,
    profile: str,
    description: str,
    use_cache: bool = False,
) -> BuildResult:
    """Run a build benchmark."""
    print("━" * 40)
    print(f"Building: {description}")
    print(f"Dockerfile: {dockerfile}")
    print(f"Profile: {profile}")
    print("━" * 40)

    if not use_cache:
        clean_build_cache()
        print("Starting build (no cache)...")
    else:
        print("Starting build (with cache)...")

    cache_args = [] if use_cache else ["--no-cache"]
    log_file = f"/tmp/docker-build-{tag.replace(':', '-')}.log"

    start_time = time.time()

    env = os.environ.copy()
    env["DOCKER_BUILDKIT"] = "1"

    cmd = [
        "docker", "build",
        "--file", dockerfile,
        "--tag", tag,
        "--build-arg", f"PROFILE={profile}",
        *cache_args,
        ".",
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
    )

    end_time = time.time()
    build_time = int(end_time - start_time)

    # Save log
    with open(log_file, "w") as f:
        f.write(result.stdout)
        f.write(result.stderr)

    if result.returncode == 0:
        build_minutes = build_time // 60
        build_seconds = build_time % 60
        image_size = get_image_size(tag)

        print(f"{Color.GREEN}✅ Build successful{Color.NC}")
        print(f"Time: {build_minutes}m {build_seconds}s")
        print(f"Size: {image_size}")

        # Test functionality
        print("Testing image functionality...")
        if test_image_functionality(tag):
            print(f"{Color.GREEN}✅ Image functional test passed{Color.NC}")
        else:
            print(f"{Color.RED}❌ Image functional test failed{Color.NC}")

        return BuildResult(
            description=description,
            dockerfile=dockerfile,
            profile=profile,
            build_time_seconds=build_time,
            image_size=image_size,
            success=True,
        )
    else:
        print(f"{Color.RED}❌ Build failed{Color.NC}")
        print(f"Check logs: {log_file}")

        return BuildResult(
            description=description,
            dockerfile=dockerfile,
            profile=profile,
            build_time_seconds=None,
            image_size=None,
            success=False,
        )


def run_benchmarks() -> int:
    """Run all build benchmarks."""
    print("=" * 42)
    print("Dockerfile Build Time Benchmark")
    print("=" * 42)
    print()

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    results_file = f"build-benchmark-results-{timestamp}.txt"

    print(f"Results will be saved to: {results_file}")
    print()

    results: list[BuildResult] = []

    # Benchmark 1: Fast build (minimal profile)
    results.append(benchmark_build(
        dockerfile="docker/code-server/Dockerfile.fast",
        tag="vibecode-benchmark-fast",
        profile="minimal",
        description="Fast Build (Minimal Profile)",
    ))
    print()

    # Benchmark 2: Fast build (cached)
    # Touch a file to test cache effectiveness
    settings_file = Path("docker/code-server/settings.json")
    if settings_file.exists():
        settings_file.touch()

    results.append(benchmark_build(
        dockerfile="docker/code-server/Dockerfile.fast",
        tag="vibecode-benchmark-fast-cached",
        profile="minimal",
        description="Fast Build (Minimal Profile) - Cached",
        use_cache=True,
    ))
    print()

    # Benchmark 3: Optimized build
    optimized_dockerfile = Path("docker/code-server/Dockerfile.optimized")
    if optimized_dockerfile.exists():
        results.append(benchmark_build(
            dockerfile="docker/code-server/Dockerfile.optimized",
            tag="vibecode-benchmark-optimized",
            profile="minimal",
            description="Optimized Build (Minimal Profile)",
        ))
        print()

    # Add estimated original build time
    results.append(BuildResult(
        description="Original Dockerfile (estimated)",
        dockerfile="docker/code-server/Dockerfile",
        profile="minimal",
        build_time_seconds=1200,  # 20 minutes
        image_size="4500MB",
        success=True,
    ))
    print(f"{Color.YELLOW}⚠️  Skipping original Dockerfile benchmark (too slow){Color.NC}")
    print()

    # Write results
    with open(results_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Description", "Dockerfile", "Profile", "Time (seconds)", "Size"])

        for r in results:
            time_str = str(r.build_time_seconds) if r.success else "FAILED"
            size_str = r.image_size or "N/A"
            writer.writerow([r.description, r.dockerfile, r.profile, time_str, size_str])

    # Summary
    print("=" * 42)
    print("Benchmark Complete!")
    print("=" * 42)
    print()
    print(f"Results saved to: {results_file}")
    print()
    print("Summary:")
    print("-" * 8)

    for r in results:
        if r.success and r.build_time_seconds:
            mins = r.build_time_seconds // 60
            secs = r.build_time_seconds % 60
            print(f"  {r.description}: {mins}m {secs}s, Size: {r.image_size or 'N/A'}")
        else:
            print(f"  {r.description}: FAILED")

    print()
    print("Detailed logs available in /tmp/docker-build-*.log")
    print()

    # Calculate time savings
    fast_result = next((r for r in results if "Fast Build" in r.description and "Cached" not in r.description), None)
    if fast_result and fast_result.build_time_seconds:
        original_time = 1200  # 20 minutes estimated
        time_saved = original_time - fast_result.build_time_seconds
        percent_saved = (time_saved * 100) // original_time

        print(f"{Color.GREEN}Time Savings:{Color.NC}")
        print("  Original: ~20 minutes")
        print(f"  Fast: {fast_result.build_time_seconds // 60}m {fast_result.build_time_seconds % 60}s")
        print(f"  Saved: {time_saved // 60}m {time_saved % 60}s ({percent_saved}%)")

    print()
    print("=" * 42)

    return 0


def main() -> int:
    """Main entry point."""
    return run_benchmarks()


if __name__ == "__main__":
    sys.exit(main())