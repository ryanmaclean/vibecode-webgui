#!/usr/bin/env python3
"""Datadog Error Tracking Automation for Scripts.

This module provides automatic error tracking for all Python scripts.
"""

import json
import os
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional

# Error tracking configuration
DD_ERROR_TRACKING_ENABLED = os.environ.get("DD_ERROR_TRACKING_ENABLED", "true").lower() == "true"
DD_SERVICE = os.environ.get("DD_SERVICE", "vibecode-webgui")
DD_ENV = os.environ.get("DD_ENV", os.environ.get("NODE_ENV", "development"))
DD_VERSION = os.environ.get("DD_VERSION", "1.0.0")
DD_API_KEY = os.environ.get("DD_API_KEY", "")

# Script metadata
SCRIPT_NAME = Path(sys.argv[0]).name if sys.argv else "unknown"
SCRIPT_DIR = str(Path(sys.argv[0]).parent) if sys.argv else ""
SCRIPT_PATH = sys.argv[0] if sys.argv else ""
SCRIPT_ARGS = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else ""


def _get_timestamp() -> str:
    """Get current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _get_hostname() -> str:
    """Get the hostname."""
    return socket.gethostname()


def _get_username() -> str:
    """Get the current username."""
    return os.environ.get("USER", os.environ.get("USERNAME", "unknown"))


def _send_to_datadog(payload: Dict[str, Any]) -> bool:
    """Send payload to Datadog.

    Args:
        payload: The JSON payload to send.

    Returns:
        True if successful, False otherwise.
    """
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return False

    try:
        subprocess.run(
            [
                "curl", "-s", "-X", "POST",
                f"https://http-intake.logs.datadoghq.com/v1/input/{DD_API_KEY}",
                "-H", "Content-Type: application/json",
                "-d", json.dumps(payload),
                "--max-time", "5",
                "--retry", "2",
                "--retry-delay", "1"
            ],
            capture_output=True,
            timeout=10
        )
        return True
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        return False


def log_error_to_datadog(
    error_message: str,
    error_code: int = 1,
    component: str = "script",
    action: str = "execution",
    additional_context: str = ""
) -> bool:
    """Log an error to Datadog.

    Args:
        error_message: The error message.
        error_code: The error exit code.
        component: The component name.
        action: The action being performed.
        additional_context: Additional context information.

    Returns:
        True if successfully sent to Datadog.
    """
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return False

    payload = {
        "timestamp": _get_timestamp(),
        "service": DD_SERVICE,
        "env": DD_ENV,
        "version": DD_VERSION,
        "error": {
            "message": error_message,
            "type": "ScriptError",
            "stack": f"Script: {SCRIPT_NAME}\nArgs: {SCRIPT_ARGS}\nExit Code: {error_code}"
        },
        "context": {
            "component": component,
            "action": action,
            "script_name": SCRIPT_NAME,
            "script_path": SCRIPT_PATH,
            "script_args": SCRIPT_ARGS,
            "exit_code": str(error_code),
            "hostname": _get_hostname(),
            "user": _get_username(),
            "working_directory": os.getcwd(),
            "additional_context": additional_context
        },
        "tags": [
            f"service:{DD_SERVICE}",
            f"env:{DD_ENV}",
            f"component:{component}",
            f"script:{SCRIPT_NAME}",
            "error_type:script_execution"
        ]
    }

    return _send_to_datadog(payload)


def handle_script_error(exit_code: int, line_number: str = "unknown") -> None:
    """Handle a script error with automatic tracking.

    Args:
        exit_code: The exit code.
        line_number: The line number where the error occurred.
    """
    error_message = f"Script '{SCRIPT_NAME}' failed at line {line_number} with exit code {exit_code}"

    # Log to console
    print(f"ERROR: {error_message}", file=sys.stderr)
    print(f"   Script: {SCRIPT_PATH}", file=sys.stderr)
    print(f"   Args: {SCRIPT_ARGS}", file=sys.stderr)
    print(f"   Working Directory: {os.getcwd()}", file=sys.stderr)

    # Track error in Datadog
    log_error_to_datadog(error_message, exit_code, "script", "execution", f"line:{line_number}")


def track_script_start(component: str = "script", action: str = "start") -> bool:
    """Track script start event.

    Args:
        component: The component name.
        action: The action being performed.

    Returns:
        True if successfully sent to Datadog.
    """
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return False

    payload = {
        "timestamp": _get_timestamp(),
        "service": DD_SERVICE,
        "env": DD_ENV,
        "version": DD_VERSION,
        "message": f"Script started: {SCRIPT_NAME}",
        "context": {
            "component": component,
            "action": action,
            "script_name": SCRIPT_NAME,
            "script_path": SCRIPT_PATH,
            "script_args": SCRIPT_ARGS,
            "hostname": _get_hostname(),
            "user": _get_username(),
            "working_directory": os.getcwd()
        },
        "tags": [
            f"service:{DD_SERVICE}",
            f"env:{DD_ENV}",
            f"component:{component}",
            f"script:{SCRIPT_NAME}",
            "event_type:script_start"
        ]
    }

    return _send_to_datadog(payload)


def track_script_completion(
    exit_code: int = 0,
    component: str = "script",
    action: str = "completion",
    duration: str = "unknown"
) -> bool:
    """Track script completion event.

    Args:
        exit_code: The exit code.
        component: The component name.
        action: The action being performed.
        duration: The duration of execution.

    Returns:
        True if successfully sent to Datadog.
    """
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return False

    payload = {
        "timestamp": _get_timestamp(),
        "service": DD_SERVICE,
        "env": DD_ENV,
        "version": DD_VERSION,
        "message": f"Script completed: {SCRIPT_NAME}",
        "context": {
            "component": component,
            "action": action,
            "script_name": SCRIPT_NAME,
            "script_path": SCRIPT_PATH,
            "script_args": SCRIPT_ARGS,
            "exit_code": str(exit_code),
            "duration": duration,
            "hostname": _get_hostname(),
            "user": _get_username(),
            "working_directory": os.getcwd()
        },
        "tags": [
            f"service:{DD_SERVICE}",
            f"env:{DD_ENV}",
            f"component:{component}",
            f"script:{SCRIPT_NAME}",
            "event_type:script_completion",
            f"exit_code:{exit_code}"
        ]
    }

    return _send_to_datadog(payload)


def track_command_execution(
    command: str,
    exit_code: int = 0,
    component: str = "script",
    action: str = "command_execution",
    output: str = ""
) -> bool:
    """Track command execution event.

    Args:
        command: The command that was executed.
        exit_code: The exit code.
        component: The component name.
        action: The action being performed.
        output: The command output.

    Returns:
        True if successfully sent to Datadog.
    """
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return False

    payload = {
        "timestamp": _get_timestamp(),
        "service": DD_SERVICE,
        "env": DD_ENV,
        "version": DD_VERSION,
        "message": f"Command executed: {command}",
        "context": {
            "component": component,
            "action": action,
            "command": command,
            "exit_code": str(exit_code),
            "output": output,
            "script_name": SCRIPT_NAME,
            "hostname": _get_hostname(),
            "user": _get_username(),
            "working_directory": os.getcwd()
        },
        "tags": [
            f"service:{DD_SERVICE}",
            f"env:{DD_ENV}",
            f"component:{component}",
            f"script:{SCRIPT_NAME}",
            "event_type:command_execution",
            f"exit_code:{exit_code}"
        ]
    }

    return _send_to_datadog(payload)


def safe_execute(command: str, component: str = "script", action: str = "command_execution") -> int:
    """Safely execute a command with error tracking.

    Args:
        command: The command to execute.
        component: The component name.
        action: The action being performed.

    Returns:
        The exit code of the command.
    """
    print(f"Executing: {command}")

    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    track_command_execution(command, result.returncode, component, action, result.stdout)

    return result.returncode


def track_performance_metric(
    metric_name: str,
    metric_value: float,
    component: str = "script",
    unit: str = "ms"
) -> bool:
    """Track a performance metric.

    Args:
        metric_name: The metric name.
        metric_value: The metric value.
        component: The component name.
        unit: The unit of measurement.

    Returns:
        True if successfully sent to Datadog.
    """
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return False

    payload = {
        "timestamp": _get_timestamp(),
        "service": DD_SERVICE,
        "env": DD_ENV,
        "version": DD_VERSION,
        "message": f"Performance metric: {metric_name} = {metric_value} {unit}",
        "context": {
            "component": component,
            "metric_name": metric_name,
            "metric_value": str(metric_value),
            "metric_unit": unit,
            "script_name": SCRIPT_NAME,
            "hostname": _get_hostname(),
            "user": _get_username(),
            "working_directory": os.getcwd()
        },
        "tags": [
            f"service:{DD_SERVICE}",
            f"env:{DD_ENV}",
            f"component:{component}",
            f"script:{SCRIPT_NAME}",
            f"metric_name:{metric_name}",
            "event_type:performance_metric"
        ]
    }

    return _send_to_datadog(payload)


@dataclass
class ErrorTracker:
    """Context manager for error tracking."""

    component: str = "script"
    start_time: float = field(default_factory=time.time, init=False)

    def __enter__(self) -> "ErrorTracker":
        """Start error tracking."""
        track_script_start(self.component, "start")
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        """End error tracking and log any errors."""
        duration = time.time() - self.start_time
        exit_code = 0 if exc_type is None else 1

        if exc_type is not None:
            log_error_to_datadog(
                str(exc_val),
                exit_code,
                self.component,
                "execution",
                f"exception:{exc_type.__name__}"
            )

        track_script_completion(exit_code, self.component, "completion", f"{duration:.2f}s")
        return False  # Don't suppress exceptions


def init_error_tracking(component: str = "script") -> ErrorTracker:
    """Initialize error tracking for a script.

    Args:
        component: The component name.

    Returns:
        An ErrorTracker context manager.
    """
    return ErrorTracker(component)


def check_error_tracking_availability() -> bool:
    """Check if error tracking is available.

    Returns:
        True if error tracking is configured and enabled.
    """
    if DD_ERROR_TRACKING_ENABLED and DD_API_KEY:
        return True
    else:
        print("Warning: Datadog Error Tracking is disabled or not configured")
        print("   Set DD_ERROR_TRACKING_ENABLED=true and DD_API_KEY to enable")
        return False
