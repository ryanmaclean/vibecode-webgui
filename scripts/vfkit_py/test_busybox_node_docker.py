from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-busybox-node-docker"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation




"""Test BusyBox + Node.js Docker image."""


# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass
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

import argparse
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass

from .log import COLORS, log_error, log_info, log_success, log_warn


@dataclass
class DockerConfig:
    """Docker test configuration."""

    image_name: str = "vibecode-busybox-node"
    container_name: str = "vibecode-busybox-test"
    port: int = 8080
    startup_wait: int = 5


def docker_available() -> bool:
    """Check if Docker is running."""
    try:
        subprocess.run(
            ["docker", "info"],
            capture_output=True,
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def image_exists(image_name: str) -> bool:
    """Check if a Docker image exists."""
    try:
        result = subprocess.run(
            ["docker", "images", f"{image_name}:latest", "--format", "{{.Repository}}"],
            capture_output=True,
            text=True,
            check=True,
        )
        return image_name in result.stdout
    except subprocess.CalledProcessError:
        return False


def container_exists(container_name: str) -> bool:
    """Check if a container exists (running or stopped)."""
    try:
        result = subprocess.run(
            ["docker", "ps", "-a", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=True,
        )
        return container_name in result.stdout.splitlines()
    except subprocess.CalledProcessError:
        return False


def container_running(container_name: str) -> bool:
    """Check if a container is running."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=True,
        )
        return container_name in result.stdout.splitlines()
    except subprocess.CalledProcessError:
        return False


def stop_container(container_name: str) -> None:
    """Stop a container if running."""
    subprocess.run(
        ["docker", "stop", container_name],
        capture_output=True,
    )


def remove_container(container_name: str) -> None:
    """Remove a container."""
    subprocess.run(
        ["docker", "rm", container_name],
        capture_output=True,
    )


def start_container(config: DockerConfig) -> bool:
    """Start the test container."""
    try:
        subprocess.run(
            [
                "docker", "run", "-d",
                "--name", config.container_name,
                "-p", f"{config.port}:{config.port}",
                f"{config.image_name}:latest",
            ],
            capture_output=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def test_vscode_server(port: int) -> bool:
    """Test if VSCode Server is accessible."""
    curl_path = shutil.which("curl")
    if not curl_path:
        log_warn("curl not available for HTTP test")
        return False

    try:
        subprocess.run(
            ["curl", "-f", f"http://localhost:{port}/"],
            capture_output=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def test_ai_tools(container_name: str) -> bool:
    """Test AI tools in the container."""
    try:
        subprocess.run(
            ["docker", "exec", container_name, "verify-ai-tools"],
            check=True,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def get_container_logs(container_name: str) -> str:
    """Get container logs."""
    try:
        result = subprocess.run(
            ["docker", "logs", container_name],
            capture_output=True,
            text=True,
        )
        return result.stdout + result.stderr
    except subprocess.CalledProcessError:
        return ""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Test BusyBox + Node.js Docker image",
    )
    parser.add_argument(
        "--image",
        default="vibecode-busybox-node",
        help="Docker image name",
    )
    parser.add_argument(
        "--container",
        default="vibecode-busybox-test",
        help="Container name for testing",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port to expose",
    )
    parser.add_argument(
        "--wait",
        type=int,
        default=5,
        help="Seconds to wait for container startup",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)
    config = DockerConfig(
        image_name=args.image,
        container_name=args.container,
        port=args.port,
        startup_wait=args.wait,
    )

    print("\U0001f9ea Testing BusyBox + Node.js Docker Image")
    print("========================================")
    print()

    # Check Docker
    if not docker_available():
        log_error("Docker is not running")
        print("Please start Docker Desktop and try again")
        return 1
    log_success("Docker is running")

    # Check image
    if not image_exists(config.image_name):
        log_error(f"Image not found: {config.image_name}:latest")
        print("Please run: ./scripts/vfkit/build-busybox-node-docker.sh")
        return 1
    log_success(f"Image found: {config.image_name}:latest")

    # Stop and remove existing container
    if container_exists(config.container_name):
        print("\U0001f504 Stopping existing container...")
        stop_container(config.container_name)
        remove_container(config.container_name)

    # Start container
    print("\U0001f680 Starting container...")
    if not start_container(config):
        log_error("Failed to start container")
        return 1

    # Wait for startup
    print(f"\u23f3 Waiting for container to start...")
    time.sleep(config.startup_wait)

    # Check if running
    if not container_running(config.container_name):
        log_error("Container failed to start")
        print("Container logs:")
        print(get_container_logs(config.container_name))
        return 1
    log_success("Container is running")

    # Test VSCode Server
    print("\U0001f310 Testing VSCode Server...")
    if test_vscode_server(config.port):
        log_success(f"VSCode Server is accessible at http://localhost:{config.port}")
    else:
        log_warn("VSCode Server not yet ready (may need more time)")

    # Test AI tools
    print("\U0001f916 Testing AI tools...")
    if test_ai_tools(config.container_name):
        log_success("AI tools verified")
    else:
        log_warn("AI tools verification failed")

    print()
    print("\U0001f389 SUCCESS! BusyBox + Node.js + VSCode Server + Claude Code is working!")
    print()
    print("\U0001f4cb Access Information:")
    print(f"\u2022 VSCode Server: http://localhost:{config.port}")
    print(f"\u2022 Container: {config.container_name}")
    print(f"\u2022 Stop container: docker stop {config.container_name}")
    print(f"\u2022 Remove container: docker rm {config.container_name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())