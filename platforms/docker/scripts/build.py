#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
VibeCode Docker Build Script

Builds Docker images for various deployment targets.

Usage:
    python build.py [target] [options]
    python build.py dev
    python build.py prod --tag vibecode-webgui:latest --push
    python build.py aks --platform linux/amd64,linux/arm64 --push
"""

import argparse
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Color:
    """ANSI color codes for terminal output."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


class Target(Enum):
    """Build target environments."""
    DEV = "dev"
    PROD = "prod"
    TEST = "test"
    AKS = "aks"
    INGESTION = "ingestion"


@dataclass
class BuildConfig:
    """Configuration for a Docker build."""
    target: Target
    tag: str = "vibecode-webgui"
    push: bool = False
    platform: str = "linux/amd64"
    cache_from: Optional[str] = None
    cache_to: Optional[str] = None


@dataclass
class TargetConfig:
    """Build arguments and Dockerfile target for each target type."""
    build_args: dict
    dockerfile_target: str


def print_status(message: str) -> None:
    """Print an info message."""
    print(f"{Color.BLUE}[INFO]{Color.NC} {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def get_target_config(target: Target) -> TargetConfig:
    """Get build configuration for the specified target."""
    configs = {
        Target.DEV: TargetConfig(
            build_args={
                "NODE_VERSION": "24",
                "BASE_OS": "alpine",
                "INCLUDE_DEV_DEPS": "true",
                "ENABLE_LIGHTNINGCSS": "true",
                "ENABLE_PRISMA": "true",
            },
            dockerfile_target="development",
        ),
        Target.PROD: TargetConfig(
            build_args={
                "NODE_VERSION": "24",
                "BASE_OS": "alpine",
                "BUILD_TARGET": "production",
                "INCLUDE_DEV_DEPS": "false",
                "ENABLE_SOURCE_MAPS": "true",
                "ENABLE_DATADOG": "true",
                "ENABLE_LIGHTNINGCSS": "true",
                "ENABLE_PRISMA": "true",
                "ENABLE_HEALTH_CHECK": "true",
            },
            dockerfile_target="production",
        ),
        Target.TEST: TargetConfig(
            build_args={
                "NODE_VERSION": "24",
                "BASE_OS": "alpine",
                "INCLUDE_DEV_DEPS": "true",
                "ENABLE_LIGHTNINGCSS": "true",
                "ENABLE_PRISMA": "true",
            },
            dockerfile_target="testing",
        ),
        Target.AKS: TargetConfig(
            build_args={
                "NODE_VERSION": "24",
                "BASE_OS": "alpine",
                "BUILD_TARGET": "production",
                "INCLUDE_DEV_DEPS": "false",
                "ENABLE_SOURCE_MAPS": "true",
                "ENABLE_DATADOG": "true",
                "ENABLE_LIGHTNINGCSS": "true",
                "ENABLE_PRISMA": "true",
                "ENABLE_HEALTH_CHECK": "true",
            },
            dockerfile_target="production",
        ),
        Target.INGESTION: TargetConfig(
            build_args={
                "NODE_VERSION": "24",
                "BASE_OS": "alpine",
            },
            dockerfile_target="ingestion",
        ),
    }
    return configs[target]


def build_docker_command(config: BuildConfig) -> list[str]:
    """Build the docker buildx command."""
    target_config = get_target_config(config.target)

    cmd = [
        "docker", "buildx", "build",
        "--platform", config.platform,
        "--target", target_config.dockerfile_target,
        "--tag", config.tag,
    ]

    # Add build arguments
    for key, value in target_config.build_args.items():
        cmd.extend(["--build-arg", f"{key}={value}"])

    # Add cache options if provided
    if config.cache_from:
        cmd.extend(["--cache-from", config.cache_from])

    if config.cache_to:
        cmd.extend(["--cache-to", config.cache_to])

    # Add push option
    if config.push:
        cmd.append("--push")

    # Add dockerfile and context
    cmd.extend(["-f", "docker/Dockerfile", "."])

    return cmd


def run_build(config: BuildConfig) -> int:
    """Execute the Docker build."""
    target_config = get_target_config(config.target)

    print_status("Building VibeCode WebGUI Docker image")
    print_status(f"Target: {config.target.value}")
    print_status(f"Tag: {config.tag}")
    print_status(f"Platform: {config.platform}")
    print_status(f"Dockerfile Target: {target_config.dockerfile_target}")
    print_status(f"Push: {'Enabled' if config.push else 'Disabled'}")

    cmd = build_docker_command(config)
    print_status(f"Executing: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, check=True)
        print_success("Build completed successfully!")
        print_success(f"Image: {config.tag}")
        return 0
    except subprocess.CalledProcessError as e:
        print_error("Build failed!")
        return e.returncode


def parse_args() -> BuildConfig:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="VibeCode Docker Build Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Targets:
  dev         - Development environment
  prod        - Production environment
  test        - Testing environment
  aks         - AKS production with Datadog
  ingestion   - RAG ingestion worker

Examples:
  python build.py dev
  python build.py prod --tag vibecode-webgui:latest --push
  python build.py aks --platform linux/amd64,linux/arm64 --push
        """,
    )

    parser.add_argument(
        "target",
        nargs="?",
        default="prod",
        choices=["dev", "prod", "test", "aks", "ingestion"],
        help="Build target (default: prod)",
    )
    parser.add_argument(
        "--tag",
        default="vibecode-webgui",
        help="Image tag (default: vibecode-webgui)",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Push to registry after build",
    )
    parser.add_argument(
        "--platform",
        default="linux/amd64",
        help="Target platform (default: linux/amd64)",
    )
    parser.add_argument(
        "--cache-from",
        dest="cache_from",
        help="Cache from registry",
    )
    parser.add_argument(
        "--cache-to",
        dest="cache_to",
        help="Cache to registry",
    )

    args = parser.parse_args()

    return BuildConfig(
        target=Target(args.target),
        tag=args.tag,
        push=args.push,
        platform=args.platform,
        cache_from=args.cache_from,
        cache_to=args.cache_to,
    )


def main() -> int:
    """Main entry point."""
    config = parse_args()
    return run_build(config)


if __name__ == "__main__":
    sys.exit(main())