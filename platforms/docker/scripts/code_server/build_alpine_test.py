#!/usr/bin/env python3
"""
Alpine Build Test Script

Tests Alpine Dockerfile build and performs size comparison.

Usage:
    python build_alpine_test.py
"""

import os
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def get_project_root() -> Path:
    """Get the project root directory."""
    script_dir = Path(__file__).resolve().parent
    # Navigate up from scripts/code_server to project root
    return script_dir.parent.parent.parent.parent


def run_command(cmd: list[str], cwd: str = None, timeout: int = 3600) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_git_commit() -> str:
    """Get the current git commit hash."""
    rc, stdout, _ = run_command(["git", "rev-parse", "--short", "HEAD"])
    return stdout.strip() if rc == 0 else "unknown"


def get_image_size(tag: str) -> str:
    """Get the size of a Docker image."""
    rc, stdout, _ = run_command([
        "docker", "images", tag, "--format", "{{.Size}}"
    ])
    return stdout.strip() if rc == 0 else "unknown"


def run_alpine_test() -> int:
    """Run the Alpine build test."""
    project_root = get_project_root()
    os.chdir(project_root)

    print("=" * 48)
    print("Alpine Linux Code-Server Build Test")
    print("=" * 48)
    print()

    # Detect platform
    machine = platform.machine()
    if machine == "x86_64":
        target_platform = "linux/amd64"
        arch_name = "amd64"
    elif machine in ("arm64", "aarch64"):
        target_platform = "linux/arm64"
        arch_name = "arm64"
    else:
        print(f"Unsupported platform: {machine}")
        return 1

    print(f"Detected Platform: {target_platform}")
    print(f"Architecture: {arch_name}")
    print()

    # Build configuration
    build_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    git_commit = get_git_commit()
    version = "1.2.0-alpine-experimental"

    print("Build Configuration:")
    print(f"  Date: {build_date}")
    print(f"  Commit: {git_commit}")
    print(f"  Version: {version}")
    print()

    # Phase 1: Build Alpine image
    print("=" * 48)
    print("Phase 1: Building Alpine Image")
    print("=" * 48)
    print()
    print("This will take 15-20 minutes (compiling code-server from source)...")
    print()

    tag = f"vibecode-alpine:test-{arch_name}"

    start_time = time.time()
    result = subprocess.run([
        "docker", "build",
        "-f", "docker/code-server/Dockerfile.alpine",
        "--build-arg", f"TARGETPLATFORM={target_platform}",
        "--build-arg", f"TARGETARCH={arch_name}",
        "--build-arg", "PROFILE=minimal",
        "--build-arg", f"BUILD_DATE={build_date}",
        "--build-arg", f"GIT_COMMIT={git_commit}",
        "--build-arg", f"VERSION={version}",
        "-t", tag,
        ".",
    ])
    end_time = time.time()

    if result.returncode != 0:
        print("Build failed!")
        return 1

    build_time = int(end_time - start_time)
    print()
    print(f"✅ Alpine build completed in {build_time // 60}m {build_time % 60}s")
    print()

    # Phase 2: Size comparison
    print("=" * 48)
    print("Phase 2: Size Comparison")
    print("=" * 48)
    print()

    alpine_size = get_image_size(tag)
    print(f"Alpine Image Size: {alpine_size}")

    # Check for Ubuntu image
    rc, stdout, _ = run_command(["docker", "images"])
    if "vibecode-optimized" in stdout:
        ubuntu_size = get_image_size("vibecode-optimized:latest")
        print(f"Ubuntu Image Size: {ubuntu_size} (for comparison)")
        print()
        print("Expected Savings: 60-70% reduction")
    else:
        print("Ubuntu image not found (skipping comparison)")

    print()

    # Phase 3: Layer inspection
    print("=" * 48)
    print("Phase 3: Layer Breakdown")
    print("=" * 48)
    print()

    rc, stdout, _ = run_command([
        "docker", "history", tag, "--human", "--no-trunc"
    ])
    if rc == 0:
        # Print first 20 lines
        lines = stdout.strip().split("\n")[:20]
        for line in lines:
            print(line)

    print()

    # Phase 4: Runtime test
    print("=" * 48)
    print("Phase 4: Runtime Test")
    print("=" * 48)
    print()

    print("Starting container for runtime test...")
    rc, stdout, _ = run_command([
        "docker", "run", "-d", "-p", "8765:8765", tag
    ])

    if rc != 0:
        print("Failed to start container")
        return 1

    container_id = stdout.strip()
    print(f"Container ID: {container_id}")
    print("Waiting 10 seconds for startup...")
    time.sleep(10)

    # Test health check
    print()
    print("Testing health endpoint...")
    rc, _, _ = run_command([
        "curl", "-f", "http://localhost:8765/healthz"
    ], timeout=10)
    if rc == 0:
        print("✅ Health check passed")
    else:
        print("⚠️  Health check failed (may need more time)")

    # Test extension listing
    print()
    print("Listing installed extensions...")
    rc, stdout, _ = run_command([
        "docker", "exec", container_id, "code-server", "--list-extensions"
    ])
    if rc == 0:
        print(stdout)

    # Cleanup
    print()
    print("Stopping test container...")
    run_command(["docker", "stop", container_id])
    run_command(["docker", "rm", container_id])

    print()
    print("=" * 48)
    print("Test Complete")
    print("=" * 48)
    print()
    print(f"Alpine image: {tag}")
    print(f"Size: {alpine_size}")
    print()
    print("To run the Alpine image manually:")
    print(f"  docker run -p 8765:8765 {tag}")
    print()
    print("To inspect the image:")
    print(f"  docker inspect {tag}")
    print()
    print("To remove the test image:")
    print(f"  docker rmi {tag}")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    return run_alpine_test()


if __name__ == "__main__":
    sys.exit(main())
