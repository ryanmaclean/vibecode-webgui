#!/usr/bin/env python3
"""Build multi-architecture code-server images locally (no push).

This script builds Docker images for AMD64 and ARM64 architectures
and tags the native architecture as latest.
"""

import argparse
import platform
import subprocess
import sys
from datetime import datetime, timezone
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

# Build configuration
IMAGE_NAME = "vibecode-codeserver"
DOCKERFILE_PATH = "docker/code-server/Dockerfile"
DEFAULT_VERSION = "1.0.0"


def get_git_commit() -> str:
    """Get the current git commit hash.

    Returns:
        Short git commit hash or 'unknown'.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return "unknown"


def get_build_date() -> str:
    """Get the current build date in ISO format.

    Returns:
        ISO formatted UTC datetime string.
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_native_arch() -> str:
    """Get the native machine architecture.

    Returns:
        Architecture string ('arm64' or 'amd64').
    """
    machine = platform.machine().lower()
    if machine in ("arm64", "aarch64"):
        return "arm64"
    return "amd64"


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = False
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run as list of strings.
        check: If True, print error on failure.
        capture: If True, capture output.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True
        )
        if check and result.returncode != 0:
            print(f"{YELLOW}Command failed: {' '.join(cmd)}{NC}")
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def cleanup_old_images(image_name: str) -> None:
    """Clean up old Docker images.

    Args:
        image_name: Name of the image to clean up.
    """
    print(f"{GREEN}Cleaning up old images...{NC}")

    # Get image IDs
    result = subprocess.run(
        ["docker", "images", "--format", "{{.ID}}", image_name],
        capture_output=True,
        text=True
    )

    if result.returncode == 0 and result.stdout.strip():
        image_ids = result.stdout.strip().split('\n')
        for image_id in image_ids:
            subprocess.run(
                ["docker", "rmi", "-f", image_id],
                capture_output=True
            )


def build_image(
    platform_arch: str,
    image_name: str,
    version: str,
    build_date: str,
    git_commit: str
) -> bool:
    """Build a Docker image for a specific platform.

    Args:
        platform_arch: Target platform (linux/amd64 or linux/arm64).
        image_name: Name for the image.
        version: Version tag.
        build_date: Build date string.
        git_commit: Git commit hash.

    Returns:
        True if build succeeded.
    """
    arch_suffix = platform_arch.split("/")[1]
    print(f"{GREEN}Building {arch_suffix.upper()} image...{NC}")

    cmd = [
        "docker", "buildx", "build",
        "--platform", platform_arch,
        "-f", DOCKERFILE_PATH,
        "-t", f"{image_name}:{version}-{arch_suffix}",
        "-t", f"{image_name}:latest-{arch_suffix}",
        "--build-arg", f"BUILD_DATE={build_date}",
        "--build-arg", f"GIT_COMMIT={git_commit}",
        "--build-arg", f"VERSION={version}",
        "--load",
        "."
    ]

    rc, _, _ = run_command(cmd)
    return rc == 0


def tag_native_architecture(image_name: str, version: str) -> bool:
    """Tag the native architecture image as latest.

    Args:
        image_name: Name of the image.
        version: Version tag.

    Returns:
        True if tagging succeeded.
    """
    arch = get_native_arch()

    # Tag version
    rc1, _, _ = run_command([
        "docker", "tag",
        f"{image_name}:{version}-{arch}",
        f"{image_name}:{version}"
    ])

    # Tag latest
    rc2, _, _ = run_command([
        "docker", "tag",
        f"{image_name}:{version}-{arch}",
        f"{image_name}:latest"
    ])

    return rc1 == 0 and rc2 == 0


def print_summary(image_name: str, version: str) -> None:
    """Print build summary and usage instructions.

    Args:
        image_name: Name of the image.
        version: Version tag.
    """
    print()
    print(f"{GREEN}Build complete!{NC}")
    print()
    print("Images built:")
    print(f"  - {image_name}:{version}")
    print(f"  - {image_name}:latest")
    print()
    print("To run:")
    print(f"  docker run -d -p 8765:8765 -p 46203:46203 \\")
    print(f"    -e PASSWORD=your-password \\")
    print(f"    {image_name}:{version}")
    print()
    print("Done!")


def main(
    version: Optional[str] = None,
    skip_cleanup: bool = False,
    amd64_only: bool = False,
    arm64_only: bool = False
) -> int:
    """Main entry point.

    Args:
        version: Version tag (default: 1.0.0).
        skip_cleanup: If True, skip cleanup of old images.
        amd64_only: If True, only build AMD64.
        arm64_only: If True, only build ARM64.

    Returns:
        Exit code (0 for success).
    """
    if version is None:
        version = DEFAULT_VERSION

    build_date = get_build_date()
    git_commit = get_git_commit()

    print(f"{GREEN}Building VibeCode Code-Server (Local){NC}")
    print("=========================================")
    print(f"Image: {IMAGE_NAME}")
    print(f"Version: {version}")
    print(f"Build Date: {build_date}")
    print(f"Git Commit: {git_commit}")
    print()

    # Clean up old builds
    if not skip_cleanup:
        cleanup_old_images(IMAGE_NAME)

    # Build AMD64
    if not arm64_only:
        print()
        if not build_image("linux/amd64", IMAGE_NAME, version, build_date, git_commit):
            print(f"{YELLOW}AMD64 build failed{NC}")
            return 1

    # Build ARM64
    if not amd64_only:
        print()
        if not build_image("linux/arm64", IMAGE_NAME, version, build_date, git_commit):
            print(f"{YELLOW}ARM64 build failed{NC}")
            return 1

    # Tag native architecture
    if not tag_native_architecture(IMAGE_NAME, version):
        print(f"{YELLOW}Failed to tag native architecture{NC}")
        return 1

    print_summary(IMAGE_NAME, version)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Build multi-architecture code-server images locally"
    )
    parser.add_argument(
        'version',
        nargs='?',
        default=DEFAULT_VERSION,
        help=f"Version tag (default: {DEFAULT_VERSION})"
    )
    parser.add_argument(
        '--skip-cleanup',
        action='store_true',
        help="Skip cleanup of old images"
    )
    parser.add_argument(
        '--amd64-only',
        action='store_true',
        help="Only build AMD64 image"
    )
    parser.add_argument(
        '--arm64-only',
        action='store_true',
        help="Only build ARM64 image"
    )

    args = parser.parse_args()
    sys.exit(main(args.version, args.skip_cleanup, args.amd64_only, args.arm64_only))
