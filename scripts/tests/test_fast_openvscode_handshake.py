"""Python port of fast-openvscode-handshake.sh."""

from __future__ import annotations

import os
import time
from pathlib import Path
from urllib import error, request

import pytest


def _write_log(log_dir: Path, name: str, content: str) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    (log_dir / name).write_text(content, encoding="utf-8")


def _attempt_handshake(host: str, timeout: float) -> tuple[int, str, list[tuple[str, str]]]:
    with request.urlopen(host, timeout=timeout) as response:  # nosec B310 - integration test
        body = response.read().decode("utf-8", errors="replace")
        headers = list(response.getheaders())
        return response.status, body, headers


def test_fast_openvscode_handshake(tmp_path: Path) -> None:
    host = os.getenv("FAST_OPENVSCODE_HOST")
    if not host:
        pytest.skip("FAST_OPENVSCODE_HOST not configured")

    attempts = int(os.getenv("HANDSHAKE_ATTEMPTS", "3"))
    sleep_seconds = float(os.getenv("HANDSHAKE_SLEEP", "1"))
    timeout = float(os.getenv("HANDSHAKE_TIMEOUT", "2"))
    log_dir = Path(os.getenv("HANDSHAKE_LOG_DIR") or tmp_path)

    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        timestamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        stdout_name = f"handshake_{timestamp}_{attempt}.out"
        log_name = f"handshake_{timestamp}_{attempt}.log"
        try:
            status, body, headers = _attempt_handshake(host, timeout)
        except error.URLError as exc:  # pragma: no cover - network failure path
            last_error = exc
            _write_log(log_dir, log_name, f"Attempt {attempt}/{attempts} failed: {exc}\n")
        else:
            header_lines = "\n".join(f"{k}: {v}" for k, v in headers)
            _write_log(log_dir, log_name, f"HTTP {status}\n{header_lines}\n")
            _write_log(log_dir, stdout_name, body)
            if status == 200:
                return
        time.sleep(sleep_seconds)

    pytest.fail(
        f"Handshake to {host} failed after {attempts} attempts"
        + (f": {last_error}" if last_error else "")
    )
