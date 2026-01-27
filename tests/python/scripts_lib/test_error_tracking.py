from __future__ import annotations

import subprocess
import sys
import time

import pytest

from scripts.lib import error_tracking


class StubTransport(error_tracking.HTTPTransport):
    def __init__(self):
        self.calls = []

    def post(self, url, payload, headers, timeout=5):
        self.calls.append(payload)


@pytest.fixture(autouse=True)
def _argv(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["script.py", "--flag"])


def build_tracker(monkeypatch) -> tuple[error_tracking.ErrorTracker, StubTransport]:
    transport = StubTransport()
    tracker = error_tracking.ErrorTracker(api_key="abc", transport=transport)
    return tracker, transport


def test_track_script_start_emits_payload(monkeypatch):
    tracker, transport = build_tracker(monkeypatch)
    tracker.track_script_start("component")

    assert transport.calls
    payload = transport.calls[0]
    assert payload["context"]["component"] == "component"
    assert payload["tags"][0].startswith("service:")


def test_safe_execute_tracks_command(monkeypatch):
    tracker, transport = build_tracker(monkeypatch)

    class DummyProcess:
        def __init__(self):
            self.returncode = 0
            self.stdout = "ok"
            self.stderr = ""

        def check_returncode(self):
            return None

    called = {}

    def fake_run(cmd, capture_output, text):
        called["cmd"] = cmd
        return DummyProcess()

    monkeypatch.setattr(subprocess, "run", fake_run)
    tracker.safe_execute(["echo", "hi"])

    assert called["cmd"] == ["echo", "hi"]
    assert transport.calls  # command execution payload


def test_safe_execute_raises_on_failure(monkeypatch):
    tracker, transport = build_tracker(monkeypatch)

    class DummyProcess:
        def __init__(self):
            self.returncode = 2
            self.stdout = ""
            self.stderr = "boom"

        def check_returncode(self):
            raise subprocess.CalledProcessError(self.returncode, ["cmd"], self.stdout, self.stderr)

    monkeypatch.setattr(subprocess, "run", lambda *a, **k: DummyProcess())

    with pytest.raises(subprocess.CalledProcessError):
        tracker.safe_execute("echo hi")

    # Should capture both command execution and error payloads
    assert len(transport.calls) >= 2


def test_track_execution_context_manager(monkeypatch):
    tracker, transport = build_tracker(monkeypatch)

    times = iter([100.0, 100.5, 100.5])
    monkeypatch.setattr(time, "time", lambda: next(times))

    with tracker.track_execution("component"):
        pass

    assert len(transport.calls) >= 2
    completion = transport.calls[-1]
    assert completion["context"]["duration"] == pytest.approx(0.5)
