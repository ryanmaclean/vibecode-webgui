#!/usr/bin/env python3
"""Datadog Logging Library for Python Scripts.

Usage: from scripts.lib.datadog_logging import dd_info, dd_error, dd_metric
"""

import json
import os
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from enum import IntEnum
from pathlib import Path
from typing import Any, Dict, List, Optional

# Datadog configuration
DD_API_KEY = os.environ.get("DD_API_KEY", os.environ.get("DATADOG_API_KEY", ""))
DD_SITE = os.environ.get("DD_SITE", "datadoghq.com")
DD_SERVICE = os.environ.get("DD_SERVICE", "vibecode-bash-scripts")
DD_ENV = os.environ.get("DD_ENV", os.environ.get("NODE_ENV", "development"))
DD_VERSION = os.environ.get("DD_VERSION", "1.0.0")


class LogLevel(IntEnum):
    """Log levels."""

    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3


# Current log level (default: INFO)
DD_CURRENT_LOG_LEVEL = LogLevel(int(os.environ.get("DD_CURRENT_LOG_LEVEL", str(LogLevel.INFO))))


def _get_hostname() -> str:
    """Get the hostname."""
    return socket.gethostname()


def _get_script_name() -> str:
    """Get the current script name."""
    return Path(sys.argv[0]).name if sys.argv else "unknown"


def _get_timestamp_iso() -> str:
    """Get current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get_timestamp_unix() -> int:
    """Get current Unix timestamp."""
    return int(time.time())


def dd_log(level: str, message: str, *tags: str) -> None:
    """Send log to Datadog.

    Args:
        level: Log level (debug, info, warn, error).
        message: The log message.
        *tags: Additional tags to include.
    """
    # Skip if DD_API_KEY not set
    if not DD_API_KEY:
        print(f"[DD-BASH] {level}: {message}", file=sys.stderr)
        return

    # Create JSON payload
    hostname = _get_hostname()
    script_name = _get_script_name()
    tags_str = ",".join(tags) if tags else ""

    payload = {
        "ddsource": "python",
        "ddtags": f"env:{DD_ENV},service:{DD_SERVICE},version:{DD_VERSION},script:{script_name},{tags_str}",
        "hostname": hostname,
        "message": message,
        "level": level,
        "timestamp": _get_timestamp_iso()
    }

    # Send to Datadog (async via subprocess)
    try:
        subprocess.Popen(
            [
                "curl", "-X", "POST",
                f"https://http-intake.logs.{DD_SITE}/v1/input/{DD_API_KEY}",
                "-H", "Content-Type: application/json",
                "-d", json.dumps(payload),
                "--max-time", "5",
                "--silent",
                "--show-error"
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except FileNotFoundError:
        pass  # curl not available

    # Also log locally
    print(f"[DD-BASH] {level}: {message}")


def dd_debug(message: str, *tags: str) -> None:
    """Log a debug message.

    Args:
        message: The log message.
        *tags: Additional tags to include.
    """
    if DD_CURRENT_LOG_LEVEL <= LogLevel.DEBUG:
        dd_log("debug", message, *tags)


def dd_info(message: str, *tags: str) -> None:
    """Log an info message.

    Args:
        message: The log message.
        *tags: Additional tags to include.
    """
    if DD_CURRENT_LOG_LEVEL <= LogLevel.INFO:
        dd_log("info", message, *tags)


def dd_warn(message: str, *tags: str) -> None:
    """Log a warning message.

    Args:
        message: The log message.
        *tags: Additional tags to include.
    """
    if DD_CURRENT_LOG_LEVEL <= LogLevel.WARN:
        dd_log("warn", message, *tags)


def dd_error(message: str, *tags: str) -> None:
    """Log an error message.

    Args:
        message: The log message.
        *tags: Additional tags to include.
    """
    if DD_CURRENT_LOG_LEVEL <= LogLevel.ERROR:
        dd_log("error", message, *tags)


def dd_metric(
    metric_name: str,
    value: float,
    metric_type: str = "gauge",
    *tags: str
) -> None:
    """Send metric to Datadog.

    Args:
        metric_name: The metric name.
        value: The metric value.
        metric_type: The metric type (gauge, count, histogram).
        *tags: Additional tags to include.
    """
    # Skip if DD_API_KEY not set
    if not DD_API_KEY:
        print(f"[DD-METRIC] {metric_name} = {value} ({metric_type})", file=sys.stderr)
        return

    hostname = _get_hostname()
    script_name = _get_script_name()
    timestamp = _get_timestamp_unix()

    # Build tags list
    tag_list = [f"env:{DD_ENV}", f"service:{DD_SERVICE}", f"script:{script_name}"]
    tag_list.extend(tags)

    payload = {
        "series": [{
            "metric": metric_name,
            "points": [[timestamp, value]],
            "type": metric_type,
            "host": hostname,
            "tags": tag_list
        }]
    }

    # Send to Datadog (async via subprocess)
    try:
        subprocess.Popen(
            [
                "curl", "-X", "POST",
                f"https://api.{DD_SITE}/api/v1/series",
                "-H", "Content-Type: application/json",
                "-H", f"DD-API-KEY: {DD_API_KEY}",
                "-d", json.dumps(payload),
                "--max-time", "5",
                "--silent",
                "--show-error"
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except FileNotFoundError:
        pass  # curl not available

    print(f"[DD-METRIC] {metric_name} = {value}")


def set_log_level(level: LogLevel) -> None:
    """Set the current log level.

    Args:
        level: The log level to set.
    """
    global DD_CURRENT_LOG_LEVEL
    DD_CURRENT_LOG_LEVEL = level
