
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

"""Python equivalent of fast-openvscode-handshake.sh implemented as a pytest."""

from __future__ import annotations

import datetime as dt
import os
import time
from pathlib import Path

import pytest

from python_helpers import http_request_safe


@pytest.mark.network
def test_fast_openvscode_handshake(tmp_path):
    host = os.getenv("FAST_OPENVSCODE_HOST")
    if not host:
        pytest.skip("FAST_OPENVSCODE_HOST not set (e.g., http://localhost:8080)")

    attempts = int(os.getenv("HANDSHAKE_ATTEMPTS", "3"))
    sleep_seconds = float(os.getenv("HANDSHAKE_SLEEP", "1"))
    log_dir = Path(os.getenv("HANDSHAKE_LOG_DIR", "./artifacts")).resolve()
    log_dir.mkdir(parents=True, exist_ok=True)

    errors: list[str] = []
    for attempt in range(1, attempts + 1):
        timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        log_file = log_dir / f"handshake_{timestamp}_{attempt}.log"
        status, headers, body = http_request_safe(host, timeout=2)
        if status is not None and 200 <= status < 300:
            log_file.write_text(
                f"Attempt {attempt}/{attempts}: HTTP {status}\n"
                f"Headers: {headers}\n"
                "Handshake succeeded.\n"
            )
            return

        errors.append(
            f"Attempt {attempt}/{attempts} failed: status={status}, body_snippet={body[:200]}"
        )
        log_file.write_text("\n".join(errors) + "\n")
        time.sleep(sleep_seconds)

    pytest.fail("Handshake failed after all attempts:\n" + "\n".join(errors))