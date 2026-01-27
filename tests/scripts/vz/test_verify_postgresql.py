"""Unit tests for verify_postgresql script."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from scripts.vz import verify_postgresql as vp


CONFIG = vp.PostgresConfig(host="localhost", port=5432, user="user", database="db")


def cp(stdout: str = "", stderr: str = "", returncode: int = 0):
    return SimpleNamespace(stdout=stdout, stderr=stderr, returncode=returncode)


def test_check_port_listening_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vp, "run_command", lambda cmd: cp(stderr="succeeded"))
    ok, message = vp.check_port_listening(CONFIG)
    assert ok
    assert "listening" in message


def test_check_port_listening_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vp, "run_command", lambda cmd: cp(stderr="failed"))
    ok, message = vp.check_port_listening(CONFIG)
    assert not ok
    assert "not" in message


def test_check_version_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vp, "run_psql", lambda *args, **kwargs: cp(stdout="PostgreSQL 15"))
    ok, message = vp.check_version(CONFIG)
    assert ok
    assert "PostgreSQL" in message


def test_check_version_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vp, "run_psql", lambda *args, **kwargs: cp(returncode=1))
    ok, message = vp.check_version(CONFIG)
    assert not ok
    assert "Ensure" in message


def test_check_pgvector_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vp, "run_psql", lambda *args, **kwargs: cp(stdout=""))
    ok, message = vp.check_pgvector(CONFIG)
    assert not ok
    assert "not found" in message


def test_list_extensions_formats(monkeypatch: pytest.MonkeyPatch) -> None:
    output = "vector (0.6.0)\ncitext (1.7)\n"
    monkeypatch.setattr(vp, "run_psql", lambda *args, **kwargs: cp(stdout=output))
    ok, message = vp.list_extensions(CONFIG)
    assert ok
    assert "vector" in message
    assert message.count("-") == 2


def test_check_active_connections(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(vp, "run_psql", lambda *args, **kwargs: cp(stdout=" 3 \n"))
    ok, message = vp.check_active_connections(CONFIG)
    assert ok
    assert "3" in message

