"""Pytest replacement for test-env.example.sh."""

from __future__ import annotations

import pytest

from .bootstrap_env import DEFAULT_BOOTSTRAP_ENV, load_bootstrap_context


def test_default_environment_values(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure the bootstrap context falls back to documented defaults."""

    for key in DEFAULT_BOOTSTRAP_ENV:
        monkeypatch.delenv(key, raising=False)

    context = load_bootstrap_context()
    for key, expected in DEFAULT_BOOTSTRAP_ENV.items():
        assert context.env[key] == expected


def test_environment_overrides_take_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
    marker = "pytest-override"
    monkeypatch.setenv("CLUSTER_NAME", marker)
    context = load_bootstrap_context()
    assert context.env["CLUSTER_NAME"] == marker
