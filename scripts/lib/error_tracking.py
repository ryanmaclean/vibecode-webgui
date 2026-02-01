#!/usr/bin/env python3
"""Datadog error tracking helpers for Python automation scripts."""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import json
import os
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Union
from urllib import error, request


class HTTPTransport:
    def post(self, url: str, payload: Dict[str, Any], headers: Dict[str, str], timeout: int = 5) -> None:
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(url, data=data, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=timeout):  # nosec B310 - Datadog endpoint
                pass
        except error.URLError:
            # Error tracking should never crash the main workflow.
            pass


@dataclass
class ErrorTracker:
    api_key: Optional[str] = None
    service: str = os.getenv("DD_SERVICE", "vibecode-webgui")
    env: str = os.getenv("DD_ENV", os.getenv("NODE_ENV", "development"))
    version: str = os.getenv("DD_VERSION", "1.0.0")
    enabled: bool = os.getenv("DD_ERROR_TRACKING_ENABLED", "true").lower() == "true"
    site: str = os.getenv("DD_SITE", "datadoghq.com")
    timeout: int = 5
    transport: HTTPTransport = field(default_factory=HTTPTransport)

    def __post_init__(self) -> None:
        self.api_key = self.api_key or os.getenv("DD_API_KEY")
        self.enabled = self.enabled and bool(self.api_key)
        self.script_name = Path(sys.argv[0]).name
        self.script_path = str(Path(sys.argv[0]).resolve())
        self.script_args = sys.argv[1:]

    # ------------------------------------------------------------------
    @property
    def _endpoint(self) -> str:
        return f"https://http-intake.logs.{self.site}/v1/input/{self.api_key}"

    def _base_payload(self) -> Dict[str, Any]:
        return {
            "timestamp": datetime_utc_iso(),
            "service": self.service,
            "env": self.env,
            "version": self.version,
        }

    def _metadata(self) -> Dict[str, Any]:
        return {
            "script_name": self.script_name,
            "script_path": self.script_path,
            "script_args": " ".join(self.script_args),
            "hostname": socket.gethostname(),
            "user": os.getenv("USER", "unknown"),
            "working_directory": str(Path.cwd()),
        }

    def _post_event(self, payload: Dict[str, Any]) -> None:
        if not self.enabled:
            return
        headers = {"Content-Type": "application/json"}
        self.transport.post(self._endpoint, payload, headers, timeout=self.timeout)

    def _tags(self, additional: Iterable[str]) -> List[str]:
        tags = [
            f"service:{self.service}",
            f"env:{self.env}",
            f"script:{self.script_name}",
        ]
        tags.extend(additional)
        return tags

    # ------------------------------------------------------------------
    def track_script_start(self, component: str = "script", action: str = "start") -> None:
        payload = self._base_payload()
        payload["message"] = f"Script started: {self.script_name}"
        payload["context"] = {**self._metadata(), "component": component, "action": action}
        payload["tags"] = self._tags([f"component:{component}", "event_type:script_start"])
        self._post_event(payload)

    def track_script_completion(
        self,
        exit_code: int = 0,
        component: str = "script",
        action: str = "completion",
        duration_seconds: Optional[float] = None,
    ) -> None:
        payload = self._base_payload()
        payload["message"] = f"Script completed: {self.script_name}"
        payload["context"] = {
            **self._metadata(),
            "component": component,
            "action": action,
            "exit_code": exit_code,
            "duration": duration_seconds,
        }
        payload["tags"] = self._tags(
            [f"component:{component}", "event_type:script_completion", f"exit_code:{exit_code}"]
        )
        self._post_event(payload)

    def log_error(
        self,
        error_message: str,
        error_code: int = 1,
        component: str = "script",
        action: str = "execution",
        additional_context: Optional[str] = None,
    ) -> None:
        payload = self._base_payload()
        payload["error"] = {
            "message": error_message,
            "type": "ScriptError",
            "stack": f"Script: {self.script_name}\nArgs: {' '.join(self.script_args)}\nExit Code: {error_code}",
        }
        payload["context"] = {
            **self._metadata(),
            "component": component,
            "action": action,
            "exit_code": error_code,
            "additional_context": additional_context,
        }
        payload["tags"] = self._tags(
            [f"component:{component}", "event_type:script_error", f"exit_code:{error_code}"]
        )
        self._post_event(payload)

    def track_command_execution(
        self,
        command: Union[Sequence[str], str],
        exit_code: int,
        component: str = "script",
        action: str = "command_execution",
        output: Optional[str] = None,
    ) -> None:
        command_list = _normalize_command(command)
        payload = self._base_payload()
        payload["message"] = f"Command executed: {' '.join(command_list)}"
        payload["context"] = {
            **self._metadata(),
            "component": component,
            "action": action,
            "command": " ".join(command_list),
            "exit_code": exit_code,
            "output": output,
        }
        payload["tags"] = self._tags(
            [f"component:{component}", "event_type:command_execution", f"exit_code:{exit_code}"]
        )
        self._post_event(payload)

    def track_performance_metric(
        self,
        metric_name: str,
        metric_value: float,
        component: str = "script",
        unit: str = "ms",
    ) -> None:
        payload = self._base_payload()
        payload["message"] = f"Performance metric: {metric_name} = {metric_value} {unit}"
        payload["context"] = {
            **self._metadata(),
            "component": component,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "metric_unit": unit,
        }
        payload["tags"] = self._tags(
            [f"component:{component}", "event_type:performance_metric", f"metric_name:{metric_name}"]
        )
        self._post_event(payload)

    def safe_execute(
        self,
        command: Union[Sequence[str], str],
        component: str = "script",
        action: str = "command_execution",
        check: bool = True,
    ) -> subprocess.CompletedProcess:
        command_list = _normalize_command(command)
        print(f"🔧 Executing: {' '.join(command_list)}")
        completed = subprocess.run(command_list, capture_output=True, text=True)  # nosec B603
        self.track_command_execution(command_list, completed.returncode, component, action, completed.stdout)
        if check and completed.returncode != 0:
            self.log_error(
                f"Command failed: {' '.join(command)}",
                error_code=completed.returncode,
                component=component,
                action=action,
                additional_context=completed.stderr,
            )
            completed.check_returncode()
        return completed

    def check_availability(self) -> bool:
        if not self.enabled:
            print("⚠️  Datadog Error Tracking is disabled or not configured")
        return self.enabled

    @contextmanager
    def track_execution(self, component: str = "script"):
        start = time.time()
        self.track_script_start(component)
        try:
            yield
        except Exception as exc:
            self.log_error(str(exc), component=component)
            self.track_script_completion(1, component, duration_seconds=time.time() - start)
            raise
        else:
            self.track_script_completion(0, component, duration_seconds=time.time() - start)


def datetime_utc_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())


def _normalize_command(command: Union[Sequence[str], str]) -> List[str]:
    if isinstance(command, str):
        return command.split()
    return list(command)


__all__ = ["ErrorTracker", "HTTPTransport"]
