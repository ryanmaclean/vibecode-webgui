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
AgentAPI Health Check Script

Performs comprehensive health checks for the AgentAPI service.

Usage:
    python health_check.py
"""

import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError


class HealthLevel(Enum):
    """Health check result levels."""
    OK = "OK"
    WARN = "WARN"
    ERROR = "ERROR"


@dataclass
class HealthMessage:
    """A health check result message."""
    level: HealthLevel
    message: str


@dataclass
class HealthCheckConfig:
    """Configuration for health checks."""
    host: str = "127.0.0.1"
    port: int = 3284
    terminal_dir: str = "/tmp/terminals"
    max_agents: int = 5
    max_response_time_ms: int = 1000


@dataclass
class HealthCheckResult:
    """Overall health check result."""
    healthy: bool
    messages: list[HealthMessage] = field(default_factory=list)


def check_http_health(config: HealthCheckConfig) -> tuple[HealthLevel, str, int]:
    """Check HTTP server responsiveness."""
    url = f"http://{config.host}:{config.port}/health"

    start_time = time.time_ns()
    try:
        request = Request(url, method="GET")
        with urlopen(request, timeout=5) as response:
            status_code = response.status
    except URLError:
        status_code = 0
    except Exception:
        status_code = 0

    end_time = time.time_ns()
    response_time_ms = (end_time - start_time) // 1_000_000

    if status_code != 200:
        return HealthLevel.ERROR, f"HTTP health check failed: HTTP {status_code}", response_time_ms

    if response_time_ms > config.max_response_time_ms:
        return HealthLevel.WARN, f"Slow response time: {response_time_ms}ms", response_time_ms

    return HealthLevel.OK, f"HTTP server healthy ({response_time_ms}ms)", response_time_ms


def check_terminal_directory(config: HealthCheckConfig) -> tuple[HealthLevel, str]:
    """Check terminal directory accessibility."""
    terminal_dir = Path(config.terminal_dir)

    if not terminal_dir.exists():
        return HealthLevel.ERROR, f"Terminal directory not accessible: {config.terminal_dir}"

    if not os.access(terminal_dir, os.W_OK):
        return HealthLevel.ERROR, f"Terminal directory not writable: {config.terminal_dir}"

    try:
        terminal_count = sum(1 for _ in terminal_dir.iterdir() if _.is_file())
    except PermissionError:
        terminal_count = 0

    return HealthLevel.OK, f"Terminal directory accessible ({terminal_count} active terminals)"


def check_agent_processes(config: HealthCheckConfig) -> tuple[HealthLevel, str]:
    """Check agent process health."""
    try:
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return HealthLevel.WARN, "Could not check agent processes"

        # Count agent processes
        agent_patterns = ["aider", "goose", "cline", "continue"]
        agent_count = 0
        for line in result.stdout.split("\n"):
            for pattern in agent_patterns:
                if pattern in line.lower() and "grep" not in line:
                    agent_count += 1
                    break

        if agent_count > config.max_agents:
            return HealthLevel.ERROR, f"Too many agent processes: {agent_count} (max: {config.max_agents})"

        return HealthLevel.OK, f"Agent count within limits: {agent_count}/{config.max_agents}"

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return HealthLevel.WARN, "Could not check agent processes"


def check_zombie_processes() -> tuple[HealthLevel, str]:
    """Check for zombie processes."""
    try:
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return HealthLevel.OK, "Could not check zombie processes"

        # Count zombie processes (state Z)
        zombie_count = 0
        for line in result.stdout.split("\n"):
            parts = line.split()
            if len(parts) > 7 and parts[7] == "Z":
                zombie_count += 1

        if zombie_count > 0:
            return HealthLevel.WARN, f"Zombie processes detected: {zombie_count}"

        return HealthLevel.OK, "No zombie processes"

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return HealthLevel.OK, "Could not check zombie processes"


def check_memory_usage() -> tuple[HealthLevel, str]:
    """Check memory usage of Python processes."""
    try:
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return HealthLevel.OK, "Could not check memory usage"

        # Calculate total memory usage for python3 processes
        memory_usage = 0.0
        for line in result.stdout.split("\n"):
            if "python3" in line.lower():
                parts = line.split()
                if len(parts) > 3:
                    try:
                        memory_usage += float(parts[3])
                    except ValueError:
                        pass

        memory_limit = 80.0
        if memory_usage > memory_limit:
            return HealthLevel.WARN, f"High memory usage: {memory_usage:.1f}%"

        return HealthLevel.OK, f"Memory usage: {memory_usage:.1f}%"

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return HealthLevel.OK, "Could not check memory usage"


def check_disk_space(config: HealthCheckConfig) -> tuple[HealthLevel, str]:
    """Check disk space for terminal directory."""
    terminal_dir = Path(config.terminal_dir)

    try:
        if not terminal_dir.exists():
            return HealthLevel.OK, "Terminal directory does not exist"

        # Use df command to check disk usage
        result = subprocess.run(
            ["df", str(terminal_dir)],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return HealthLevel.OK, "Could not check disk space"

        lines = result.stdout.strip().split("\n")
        if len(lines) < 2:
            return HealthLevel.OK, "Could not parse disk space output"

        # Parse the second line for disk usage
        parts = lines[1].split()
        if len(parts) < 5:
            return HealthLevel.OK, "Could not parse disk space output"

        usage_str = parts[4].rstrip("%")
        try:
            disk_usage = int(usage_str)
        except ValueError:
            return HealthLevel.OK, "Could not parse disk usage percentage"

        disk_limit = 90
        if disk_usage > disk_limit:
            return HealthLevel.ERROR, f"Disk space critical: {disk_usage}%"

        return HealthLevel.OK, f"Disk usage: {disk_usage}%"

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return HealthLevel.OK, "Could not check disk space"


def run_health_check(config: Optional[HealthCheckConfig] = None) -> HealthCheckResult:
    """Run all health checks."""
    if config is None:
        config = HealthCheckConfig(
            host=os.environ.get("AGENTAPI_HOST", "127.0.0.1"),
            port=int(os.environ.get("AGENTAPI_PORT", "3284")),
            terminal_dir=os.environ.get("AGENTAPI_TERMINAL_DIR", "/tmp/terminals"),
            max_agents=int(os.environ.get("AGENTAPI_MAX_CONCURRENT_AGENTS", "5")),
        )

    result = HealthCheckResult(healthy=True)

    # Run all checks
    checks = [
        lambda: check_http_health(config)[:2],
        lambda: check_terminal_directory(config),
        lambda: check_agent_processes(config),
        check_zombie_processes,
        check_memory_usage,
        lambda: check_disk_space(config),
    ]

    for check in checks:
        level, message = check()
        result.messages.append(HealthMessage(level=level, message=message))

        if level == HealthLevel.ERROR:
            result.healthy = False

    return result


def main() -> int:
    """Main entry point."""
    result = run_health_check()

    # Print error messages to stderr
    for msg in result.messages:
        if msg.level == HealthLevel.ERROR:
            print(f"[{msg.level.value}] {msg.message}", file=sys.stderr)

    # Print final status
    if result.healthy:
        print("AgentAPI is healthy")
        return 0
    else:
        print("AgentAPI health check failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())