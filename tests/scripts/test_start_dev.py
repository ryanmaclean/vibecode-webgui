"""Tests for the Python replacement of scripts/start-dev.sh."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Dict, Iterable, Tuple

import pytest

from scripts import start_dev


class RunRecorder:
    """Test helper that mimics run_command while recording invocations."""

    def __init__(self, return_map: Dict[Tuple[str, ...], int]):
        self.return_map = return_map
        self.commands: list[Tuple[Tuple[str, ...], bool, bool]] = []

    def __call__(self, command: Iterable[str], *, check: bool = True, silent: bool = False):
        command_tuple = tuple(command)
        self.commands.append((command_tuple, check, silent))
        key = self._key(command_tuple)
        returncode = self.return_map.get(key, 0)
        if check and returncode != 0:
            raise subprocess.CalledProcessError(returncode, list(command_tuple))
        return subprocess.CompletedProcess(command_tuple, returncode)

    @staticmethod
    def _key(command: Tuple[str, ...]) -> Tuple[str, ...]:
        if command and command[0] in {"npm", "npx"} and len(command) >= 2:
            return (command[0], command[1])
        if command:
            return (command[0],)
        return tuple()


def _prepare_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    for key in ("DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "NODE_ENV"):
        monkeypatch.delenv(key, raising=False)


def test_main_returns_error_when_postgres_unavailable(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _prepare_env(monkeypatch, tmp_path)
    runner = RunRecorder({("pg_isready",): 1})
    monkeypatch.setattr(start_dev, "run_command", runner)

    assert start_dev.main() == 1
    assert len(runner.commands) == 1
    assert runner.commands[0][0][:1] == ("pg_isready",)


def test_happy_path_invokes_expected_commands(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _prepare_env(monkeypatch, tmp_path)
    runner = RunRecorder(
        {
            ("pg_isready",): 0,
            ("psql",): 0,
            ("npm", "install"): 0,
            ("npx", "prisma"): 0,
            ("npm", "run"): 0,
        }
    )
    monkeypatch.setattr(start_dev, "run_command", runner)

    assert start_dev.main() == 0
    recorded_commands = [cmd for cmd, *_ in runner.commands]
    assert recorded_commands == [
        ("pg_isready", "-h", "localhost", "-p", "5432"),
        ("psql", "-h", "localhost", "-U", "test", "-d", "testdb", "-c", "SELECT 1;"),
        ("npm", "install"),
        ("npx", "prisma", "db", "push", "--force-reset"),
        ("npm", "run", "dev:simple"),
    ]
    assert os.environ["DATABASE_URL"] == start_dev.DATABASE_URL
    assert os.environ["NODE_ENV"] == "development"


def test_creates_database_when_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _prepare_env(monkeypatch, tmp_path)
    runner = RunRecorder(
        {
            ("pg_isready",): 0,
            ("psql",): 1,
            ("createdb",): 0,
            ("npm", "install"): 0,
            ("npx", "prisma"): 0,
            ("npm", "run"): 0,
        }
    )
    monkeypatch.setattr(start_dev, "run_command", runner)

    assert start_dev.main() == 0
    command_names = [cmd[0] for cmd, *_ in runner.commands]
    assert "createdb" in command_names
