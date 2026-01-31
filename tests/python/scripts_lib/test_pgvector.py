from __future__ import annotations

import subprocess

import pytest

from scripts.lib import pgvector


class DummyProcess:
    def __init__(self, returncode=0):
        self.returncode = returncode


def test_start_container_invokes_docker(monkeypatch):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        return DummyProcess()

    monkeypatch.setattr(subprocess, "run", fake_run)
    pgvector.start_container("pg", 5433, "db", "user", "pass", image="img", docker_bin="docker")

    assert calls[0][:3] == ["docker", "rm", "-f"]
    assert calls[1][0:2] == ["docker", "run"]


def test_wait_for_start_succeeds(monkeypatch):
    attempts = iter([DummyProcess(returncode=1), DummyProcess(returncode=0)])

    def fake_run(*args, **kwargs):
        return next(attempts)

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(pgvector.time, "sleep", lambda *_: None)

    assert pgvector.wait_for_start("pg", "user", "db") is True


def test_wait_for_start_times_out(monkeypatch):
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: DummyProcess(returncode=1))
    monkeypatch.setattr(pgvector.time, "sleep", lambda *_: None)

    with pytest.raises(pgvector.PgVectorError):
        pgvector.wait_for_start("pg", "user", "db", retries=2, delay_seconds=0)


def test_exec_sql_calls_docker_exec(monkeypatch):
    called = {}

    def fake_run(cmd, **kwargs):
        called["cmd"] = cmd
        return DummyProcess()

    monkeypatch.setattr(subprocess, "run", fake_run)

    pgvector.exec_sql("pg", "user", "db", "SELECT 1")
    assert called["cmd"][0:3] == ["docker", "exec", "pg"]

