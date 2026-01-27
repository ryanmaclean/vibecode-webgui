"""Pytest replacement for test-bootstrap-dry-run.sh."""

from __future__ import annotations

import shutil

import pytest

from .bootstrap_env import BootstrapContext
from .utils import run_command


def test_deploy_aks_help_runs(bootstrap_context: BootstrapContext) -> None:
    python = shutil.which("python3") or shutil.which("python")
    if python is None:
        pytest.skip("Python interpreter not found")
    deploy_script = bootstrap_context.scripts_dir / "deploy_aks.py"
    result = run_command([python, str(deploy_script), "--help"], timeout=20)
    assert result.returncode == 0, result.stderr


def test_component_helpers_exist(bootstrap_context: BootstrapContext) -> None:
    helpers = [
        bootstrap_context.scripts_dir / "datadog_setup.py",
        bootstrap_context.scripts_dir / "postgres_setup.py",
        bootstrap_context.scripts_dir / "app_deploy.py",
    ]
    for helper in helpers:
        assert helper.exists(), f"Missing helper: {helper}"
