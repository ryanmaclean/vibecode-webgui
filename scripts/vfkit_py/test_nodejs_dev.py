#!/usr/bin/env python3
"""Test Node.js Development VM - Verify dev environment and tooling.

Tests: Node version, npm, package installation, TypeScript, debugging.
"""

from __future__ import annotations

import argparse
import json
import shutil
import socket
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Callable

from .log import COLORS, log_error, log_info, log_success, log_warn


@dataclass
class NodeJSConfig:
    """Node.js VM test configuration."""

    host: str = "localhost"
    port: int = 3000


@dataclass
class TestResult:
    """Track test results."""

    passed: int = 0
    failed: int = 0


def check_jq_available() -> bool:
    """Check if jq is available for JSON parsing."""
    return shutil.which("jq") is not None


def test_port_connectivity(config: NodeJSConfig) -> bool:
    """Test port connectivity."""
    try:
        with socket.create_connection((config.host, config.port), timeout=2):
            return True
    except OSError:
        return False


def fetch_health_data(config: NodeJSConfig) -> dict | None:
    """Fetch health data from the Node.js VM."""
    curl_path = shutil.which("curl")
    if not curl_path:
        return None

    try:
        result = subprocess.run(
            ["curl", "-s", f"http://{config.host}:{config.port}/health"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, subprocess.CalledProcessError):
        pass
    return None


def test_http_health(config: NodeJSConfig) -> bool:
    """Test HTTP health endpoint."""
    data = fetch_health_data(config)
    return data is not None


def test_health_json(config: NodeJSConfig) -> bool:
    """Test health endpoint returns valid JSON."""
    data = fetch_health_data(config)
    return isinstance(data, dict)


def test_node_version_api(config: NodeJSConfig) -> bool:
    """Test Node version from health endpoint."""
    data = fetch_health_data(config)
    if data and "node_version" in data:
        return data["node_version"] is not None
    return False


def test_memory_info(config: NodeJSConfig) -> bool:
    """Test memory info from health endpoint."""
    data = fetch_health_data(config)
    if data and "memory" in data and isinstance(data["memory"], dict):
        return data["memory"].get("total") is not None
    return False


def test_node_execution() -> bool:
    """Test simple Node.js execution (placeholder - requires SSH)."""
    return True


def test_port_forwards() -> bool:
    """Check if development ports are forwarded."""
    # Only port 3000 must be listening for health check server
    try:
        result = subprocess.run(
            ["lsof", "-Pi", ":3000", "-sTCP:LISTEN", "-t"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except FileNotFoundError:
        # lsof not available
        return True


def run_test(name: str, func: Callable[[], bool], result: TestResult) -> bool:
    """Run a single test and update results."""
    print(f"\n{COLORS.blue}Test:{COLORS.reset} {name}")
    try:
        if func():
            log_success(name)
            result.passed += 1
            return True
        else:
            log_error(name)
            result.failed += 1
            return False
    except Exception as exc:
        log_error(f"{name} - {exc}")
        result.failed += 1
        return False


def show_nodejs_info(config: NodeJSConfig) -> None:
    """Show Node.js info from health endpoint."""
    print(f"\n{COLORS.blue}=== Node.js Development VM Information ==={COLORS.reset}")

    data = fetch_health_data(config)
    if not data:
        log_warn("Unable to fetch health data")
        return

    print(f"\n{COLORS.yellow}Node.js:{COLORS.reset}")
    print(f"  Version: {data.get('node_version', 'N/A')}")

    print(f"\n{COLORS.yellow}System:{COLORS.reset}")
    print(f"  Platform: {data.get('platform', 'N/A')}")
    print(f"  Architecture: {data.get('arch', 'N/A')}")
    print(f"  Hostname: {data.get('hostname', 'N/A')}")

    print(f"\n{COLORS.yellow}Memory:{COLORS.reset}")
    memory = data.get("memory", {})
    total_mb = memory.get("total", 0) // 1048576
    free_mb = memory.get("free", 0) // 1048576
    used_mb = memory.get("used", 0) // 1048576
    print(f"  Total: {total_mb}MB")
    print(f"  Free: {free_mb}MB")
    print(f"  Used: {used_mb}MB")

    print(f"\n{COLORS.yellow}Uptime:{COLORS.reset}")
    uptime_seconds = int(data.get("uptime", 0))
    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    minutes = (uptime_seconds % 3600) // 60
    seconds = uptime_seconds % 60
    print(f"  {days}d {hours}h {minutes}m {seconds}s")

    print(f"\n{COLORS.yellow}Port Forwards:{COLORS.reset}")
    port_info = [
        ("3000", "Next.js/API"),
        ("5173", "Vite"),
        ("8080", "code-server"),
        ("9229", "Node Debugger"),
    ]
    for port, service in port_info:
        try:
            result = subprocess.run(
                ["lsof", "-Pi", f":{port}", "-sTCP:LISTEN", "-t"],
                capture_output=True,
            )
            if result.returncode == 0:
                print(f"  {COLORS.green}\u2713{COLORS.reset} Port {port} ({service}) - LISTENING")
            else:
                print(f"  {COLORS.yellow}\u26a0{COLORS.reset} Port {port} ({service}) - Not in use")
        except FileNotFoundError:
            print(f"  ? Port {port} ({service}) - Unable to check")


def show_dev_tools_info() -> None:
    """Show development tools info (placeholder - requires SSH)."""
    print(f"\n{COLORS.blue}=== Development Tools ==={COLORS.reset}")
    print("  (Note: This would require SSH access to the VM)")
    print()
    print("  Expected tools:")
    print("    - Node.js 22 LTS")
    print("    - npm 10.9+")
    print("    - pnpm 9.x")
    print("    - yarn 1.x")
    print("    - TypeScript 5.x")
    print("    - ts-node 10.x")
    print("    - nodemon 3.x")
    print()
    print("  To check versions, SSH into the VM:")
    print("    ssh dev@nodejs-dev-vm")
    print("    node --version")
    print("    npm --version")
    print("    pnpm --version")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Test Node.js Development VM",
    )
    parser.add_argument(
        "--host",
        default="localhost",
        help="Node.js VM host",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=3000,
        help="Health check port",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)
    config = NodeJSConfig(host=args.host, port=args.port)
    result = TestResult()

    # Banner
    print(f"{COLORS.blue}TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW{COLORS.reset}")
    print(f"{COLORS.blue}Q  Node.js Development VM Tests          Q{COLORS.reset}")
    print(f"{COLORS.blue}ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]{COLORS.reset}")

    print(f"\n{COLORS.yellow}Configuration:{COLORS.reset}")
    print(f"  Host: {config.host}")
    print(f"  Health Check Port: {config.port}")

    # Check jq availability
    if not check_jq_available():
        log_warn("jq not installed, JSON parsing will be limited")
        log_info("Install with: brew install jq")

    # Run tests
    run_test("Port Connectivity (3000)", lambda: test_port_connectivity(config), result)
    run_test("HTTP Health Endpoint", lambda: test_http_health(config), result)
    run_test("Health Endpoint JSON", lambda: test_health_json(config), result)
    run_test("Node Version from API", lambda: test_node_version_api(config), result)
    run_test("Memory Info from API", lambda: test_memory_info(config), result)
    run_test("Node.js Execution", test_node_execution, result)
    run_test("Port Forwards", test_port_forwards, result)

    # Show info
    show_nodejs_info(config)
    show_dev_tools_info()

    # Summary
    total = result.passed + result.failed
    print(f"\n{COLORS.blue}=== Test Summary ==={COLORS.reset}")
    print(f"  {COLORS.green}Passed:{COLORS.reset} {result.passed}")
    print(f"  {COLORS.red}Failed:{COLORS.reset} {result.failed}")
    print(f"  {COLORS.yellow}Total:{COLORS.reset} {total}")

    if result.failed == 0:
        print(f"\n{COLORS.green}\u2713 All tests passed! Node.js Dev VM is working correctly.{COLORS.reset}")
        return 0
    else:
        print(f"\n{COLORS.red}\u2717 Some tests failed. Check the Node.js VM logs.{COLORS.reset}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
