#!/usr/bin/env python3
"""Datadog logging helpers used by Python automation scripts."""

from __future__ import annotations

import json
import os
import socket
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Optional, Sequence
from urllib import error, request


LOG_LEVELS = {
    "debug": 0,
    "info": 1,
    "warn": 2,
    "error": 3,
}


class HTTPTransport:
    """Tiny wrapper around ``urllib`` so tests can stub network calls."""

    def post(self, url: str, payload: Dict, headers: Dict[str, str], timeout: int = 5) -> None:
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(url, data=data, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=timeout):  # nosec B310 - Datadog endpoint
                pass
        except error.URLError:
            # Logging should never crash the calling workflow, so swallow failures.
            pass


@dataclass
class DatadogLogger:
    api_key: Optional[str] = None
    site: str = os.getenv("DD_SITE", "datadoghq.com")
    service: str = os.getenv("DD_SERVICE", "vibecode-scripts")
    env: str = os.getenv("DD_ENV", os.getenv("NODE_ENV", "development"))
    version: str = os.getenv("DD_VERSION", "1.0.0")
    log_level: str = os.getenv("DD_LOG_LEVEL", "info")
    timeout: int = 5
    transport: HTTPTransport = field(default_factory=HTTPTransport)

    def __post_init__(self) -> None:
        self.api_key = self.api_key or os.getenv("DD_API_KEY") or os.getenv("DATADOG_API_KEY")
        self.current_level = LOG_LEVELS.get(self.log_level.lower(), LOG_LEVELS["info"])

    # ------------------------------------------------------------------
    # Logging helpers
    # ------------------------------------------------------------------
    def _should_emit(self, level: str) -> bool:
        return LOG_LEVELS.get(level.lower(), LOG_LEVELS["info"]) >= self.current_level

    def _log_locally(self, level: str, message: str) -> None:
        print(f"[DD-BASH] {level.upper()}: {message}")

    def _ddtags(self, extra_tags: Optional[Iterable[str]]) -> str:
        base_tags = [
            f"env:{self.env}",
            f"service:{self.service}",
            f"version:{self.version}",
            f"script:{Path(sys.argv[0]).name}",
        ]
        if extra_tags:
            base_tags.extend(extra_tags)
        return ",".join(base_tags)

    def _log_payload(self, level: str, message: str, tags: Optional[Iterable[str]]) -> Dict:
        return {
            "ddsource": "python",
            "ddtags": self._ddtags(tags),
            "hostname": socket.gethostname(),
            "message": message,
            "level": level,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    @property
    def _logs_endpoint(self) -> str:
        return f"https://http-intake.logs.{self.site}/v1/input/{self.api_key}"

    def log(self, level: str, message: str, tags: Optional[Iterable[str]] = None) -> None:
        normalized = level.lower()
        if not self._should_emit(normalized):
            return

        if not self.api_key:
            self._log_locally(normalized, message)
            return

        payload = self._log_payload(normalized, message, tags)
        headers = {"Content-Type": "application/json"}
        self.transport.post(self._logs_endpoint, payload, headers, timeout=self.timeout)
        self._log_locally(normalized, message)

    def debug(self, message: str, tags: Optional[Iterable[str]] = None) -> None:
        self.log("debug", message, tags)

    def info(self, message: str, tags: Optional[Iterable[str]] = None) -> None:
        self.log("info", message, tags)

    def warn(self, message: str, tags: Optional[Iterable[str]] = None) -> None:
        self.log("warn", message, tags)

    def error(self, message: str, tags: Optional[Iterable[str]] = None) -> None:
        self.log("error", message, tags)

    # ------------------------------------------------------------------
    # Metrics helpers
    # ------------------------------------------------------------------
    def metric(
        self,
        metric_name: str,
        value: float,
        metric_type: str = "gauge",
        tags: Optional[Sequence[str]] = None,
    ) -> None:
        if not self.api_key:
            print(f"[DD-METRIC] {metric_name} = {value} ({metric_type})")
            return

        payload = {
            "series": [
                {
                    "metric": metric_name,
                    "points": [[int(datetime.utcnow().timestamp()), value]],
                    "type": metric_type,
                    "host": socket.gethostname(),
                    "tags": list(tags or []),
                }
            ]
        }

        headers = {
            "Content-Type": "application/json",
            "DD-API-KEY": self.api_key,
        }
        url = f"https://api.{self.site}/api/v1/series"
        self.transport.post(url, payload, headers, timeout=self.timeout)


__all__ = [
    "DatadogLogger",
    "HTTPTransport",
]
