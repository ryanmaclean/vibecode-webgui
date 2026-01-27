"""Python version of test-datadog-logging.sh."""

from __future__ import annotations

from pathlib import Path

import pytest

from ..bootstrap.utils import run_command


REPO_ROOT = Path(__file__).resolve().parents[3]
LOGGING_LIB = REPO_ROOT / "scripts" / "lib" / "datadog-logging.sh"


def _run_logging_snippet(env: dict[str, str], body: str):
    snippet = f"set -euo pipefail\nsource '{LOGGING_LIB}'\n{body}\n"
    return run_command(["bash", "-lc", snippet], env=env, timeout=10)


def test_logging_without_api_key_prints_locally() -> None:
    result = _run_logging_snippet({}, "dd_info 'pytest message' 'component:test'")
    combined = (result.stdout or "") + (result.stderr or "")
    assert "[DD-BASH] info: pytest message" in combined


def test_metric_logging_without_api_key_is_noop() -> None:
    result = _run_logging_snippet({}, "dd_metric 'pytest.metric' 42 gauge 'component:test'")
    combined = (result.stdout or "") + (result.stderr or "")
    assert "[DD-METRIC]" in combined
