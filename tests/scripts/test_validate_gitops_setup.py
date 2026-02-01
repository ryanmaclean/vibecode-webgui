

from __future__ import annotations
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

import os
from pathlib import Path

import pytest

from scripts.validate_gitops_setup import (
    check_file,
    load_env_file,
    run_command,
)


def test_load_env_file_sets_variables(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_file = tmp_path / ".env.local"
    env_file.write_text("FOO=bar\nBAR=baz\n# comment\nEMPTY=\n")
    monkeypatch.delenv("FOO", raising=False)
    monkeypatch.delenv("BAR", raising=False)

    assert load_env_file(env_file) is True
    assert os.environ["FOO"] == "bar"
    assert os.environ["BAR"] == "baz"


def test_load_env_file_missing() -> None:
    assert load_env_file(Path("/nonexistent/.env")) is False


def test_check_file(tmp_path: Path) -> None:
    existing = tmp_path / "example.txt"
    existing.write_text("hello")
    missing = tmp_path / "other.txt"

    assert check_file(existing) is True
    assert check_file(missing) is False


def test_run_command_success() -> None:
    success, stdout, stderr = run_command(["/bin/echo", "hi"])
    assert success is True
    assert stdout.strip() == "hi"
    assert stderr == ""


def test_run_command_missing_binary() -> None:
    success, _, stderr = run_command(["/nonexistent/binary"])
    assert success is False
    assert "No such file" in stderr or "not found" in stderr
