"""Pytest conversion of test-claims-validation.sh."""

from __future__ import annotations

import os

import pytest

from .bootstrap_env import BootstrapContext
from .utils import file_line_count, script_contains


def test_scripts_use_strict_mode(bootstrap_context: BootstrapContext) -> None:
    for script in bootstrap_context.bootstrap_scripts:
        assert "set -euo pipefail" in script.read_text(), f"Strict mode missing from {script.name}"


def test_wrappers_include_deprecation_notice(bootstrap_context: BootstrapContext) -> None:
    for script in bootstrap_context.bootstrap_scripts:
        assert "NOTICE: this script is deprecated" in script.read_text()


def test_helper_scripts_exist(bootstrap_context: BootstrapContext) -> None:
    helpers = [
        bootstrap_context.scripts_dir / "deploy_aks.py",
        bootstrap_context.scripts_dir / "datadog_setup.py",
        bootstrap_context.scripts_dir / "postgres_setup.py",
        bootstrap_context.scripts_dir / "app_deploy.py",
    ]
    for helper in helpers:
        assert helper.exists(), f"Missing helper script: {helper}"


def test_wrapper_lengths_remain_minimal(bootstrap_context: BootstrapContext) -> None:
    caps = {
        "aks-bootstrap.sh": 80,
        "aks-datadog-setup.sh": 60,
        "aks-postgresql-setup.sh": 60,
        "aks-app-deploy.sh": 220,
    }
    for script in bootstrap_context.bootstrap_scripts:
        lines = file_line_count(script)
        assert lines <= caps[script.name], f"{script.name} should remain a thin wrapper"


def test_bootstrap_wrapper_loads_logging_lib(bootstrap_context: BootstrapContext) -> None:
    assert script_contains(bootstrap_context.bootstrap_script, "datadog-logging.sh")


def test_app_wrapper_requires_acr_env(bootstrap_context: BootstrapContext) -> None:
    contents = bootstrap_context.app_script.read_text()
    assert "ACR_NAME environment variable is required" in contents

