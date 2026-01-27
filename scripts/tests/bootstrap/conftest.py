"""Common pytest fixtures for bootstrap script conversions."""

from __future__ import annotations

import pytest

from .bootstrap_env import BootstrapContext, ensure_scripts_exist, load_bootstrap_context


@pytest.fixture(scope="module")
def bootstrap_context() -> BootstrapContext:
    context = load_bootstrap_context()
    ensure_scripts_exist(context)
    return context

