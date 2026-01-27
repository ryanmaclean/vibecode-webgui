"""Python port of test-aks-bootstrap.sh."""

from __future__ import annotations

import os
import shutil

import pytest

from .bootstrap_env import BootstrapContext
from .utils import run_command, script_contains


def test_bootstrap_wrapper_contains_defaults(bootstrap_context: BootstrapContext) -> None:
    contents = bootstrap_context.bootstrap_script.read_text()
    for var in ("RESOURCE_GROUP", "CLUSTER_NAME", "PROJECT_NAME", "LOCATION"):
        assert var in contents


def test_bootstrap_invocation_outputs_expected_flags(
    bootstrap_context: BootstrapContext,
) -> None:
    true_cmd = shutil.which("true") or "true"
    env = dict(os.environ)
    env.update({"PYTHON": true_cmd})
    result = run_command([str(bootstrap_context.bootstrap_script), "--help"], env=env)
    assert result.returncode == 0
    rendered = (result.stderr or "") + (result.stdout or "")
    assert "--resource-group" in rendered
    assert "deploy_aks.py" in rendered


def test_bootstrap_script_mentions_datadog_logging(bootstrap_context: BootstrapContext) -> None:
    assert script_contains(bootstrap_context.bootstrap_script, "datadog-logging.sh")

