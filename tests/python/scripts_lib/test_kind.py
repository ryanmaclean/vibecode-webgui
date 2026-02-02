

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

from pathlib import Path

import pytest

from scripts.lib import kind


class DummyProcess:
    def __init__(self, returncode=0):
        self.returncode = returncode


def test_run_step_executes_script(tmp_path, monkeypatch):
    scripts_dir = tmp_path / "kind"
    scripts_dir.mkdir()
    script = scripts_dir / "step.sh"
    script.write_text("echo hi")

    called = {}

    def fake_run(cmd, check=False):
        called["cmd"] = cmd
        return DummyProcess()

    monkeypatch.setattr(kind.subprocess, "run", fake_run)

    runner = kind.KindRunner(scripts_dir)
    assert runner.run_step("Run step", "step.sh") is True
    assert Path(called["cmd"][0]).name == "step.sh"


def test_run_step_handles_missing_optional(tmp_path):
    scripts_dir = tmp_path / "kind"
    scripts_dir.mkdir()
    runner = kind.KindRunner(scripts_dir)
    assert runner.run_step("missing optional", "none.sh", requirement="optional") is False


def test_run_step_missing_required_raises(tmp_path):
    scripts_dir = tmp_path / "kind"
    scripts_dir.mkdir()
    runner = kind.KindRunner(scripts_dir)
    with pytest.raises(kind.KindError):
        runner.run_step("missing required", "none.sh")


def test_run_step_failure_raises(tmp_path, monkeypatch):
    scripts_dir = tmp_path / "kind"
    scripts_dir.mkdir()
    script = scripts_dir / "step.sh"
    script.write_text("echo hi")

    monkeypatch.setattr(kind.subprocess, "run", lambda *a, **k: DummyProcess(returncode=1))

    runner = kind.KindRunner(scripts_dir)
    with pytest.raises(kind.KindError):
        runner.run_step("fail", "step.sh")


def test_module_level_helpers(tmp_path, monkeypatch):
    scripts_dir = tmp_path / "kind"
    scripts_dir.mkdir()
    script = scripts_dir / "step.sh"
    script.write_text("echo")

    monkeypatch.setattr(kind.subprocess, "run", lambda *a, **k: DummyProcess())

    kind.kind_set_scripts_dir(scripts_dir)
    assert kind.kind_run_step("run", "step.sh")
