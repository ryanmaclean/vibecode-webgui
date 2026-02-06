#!/usr/bin/env python3
"""Fast OpenVSCode handshake test with retry logic."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def get_timestamp() -> str:
    """Get UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def test_handshake(host: str, log_dir: Path, attempt: int) -> bool:
    """Test handshake with OpenVSCode server.

    Args:
        host: The OpenVSCode server URL.
        log_dir: Directory for log files.
        attempt: Current attempt number.

    Returns:
        True if handshake succeeded (HTTP 200), False otherwise.
    """
    timestamp = get_timestamp()
    logfile = log_dir / f"handshake_{timestamp}_{attempt}.log"
    outfile = log_dir / f"handshake_{timestamp}_{attempt}.log.out"

    print(f"Attempt {attempt}")

    try:
        # Run curl with verbose output
        with open(outfile, "w") as out_f, open(logfile, "w") as log_f:
            result = subprocess.run(
                ["curl", "-sv", "--max-time", "2", host],
                stdout=out_f,
                stderr=log_f,
                check=False,
            )

        # Check if response contains HTTP/1.1 200
        log_content = logfile.read_text()
        if "HTTP/1.1 200" in log_content or "HTTP/2 200" in log_content:
            print(f"Handshake succeeded on attempt {attempt}")
            with open(logfile, "a") as f:
                f.write(f"\nHandshake succeeded on attempt {attempt}\n")
            return True

    except (OSError, subprocess.SubprocessError) as e:
        print(f"Error on attempt {attempt}: {e}", file=sys.stderr)

    return False


def main() -> int:
    """Main entry point."""
    # Get configuration from environment
    host = os.environ.get("FAST_OPENVSCODE_HOST")
    if not host:
        print("FAST_OPENVSCODE_HOST not set (e.g., http://localhost:8080)", file=sys.stderr)
        return 1

    attempts = int(os.environ.get("HANDSHAKE_ATTEMPTS", "3"))
    sleep_seconds = int(os.environ.get("HANDSHAKE_SLEEP", "1"))
    log_dir = Path(os.environ.get("HANDSHAKE_LOG_DIR", "./artifacts"))

    # Create log directory
    log_dir.mkdir(parents=True, exist_ok=True)

    # Try handshake with retries
    for attempt in range(1, attempts + 1):
        if test_handshake(host, log_dir, attempt):
            return 0

        if attempt < attempts:
            time.sleep(sleep_seconds)

    print(f"Handshake failed after {attempts} attempts", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
