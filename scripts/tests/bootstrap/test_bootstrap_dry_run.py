
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

"""Pytest conversion of test-bootstrap-dry-run.sh."""

from __future__ import annotations

import os

import pytest

from python_helpers import run_command

WRAPPER_TARGETS = {
    "bootstrap": "deploy_aks.py",
    "datadog": "datadog_setup.py",
    "postgres": "postgres_setup.py",
    "app": "app_deploy.py",
}


@pytest.mark.parametrize("wrapper", WRAPPER_TARGETS.keys())
def test_wrapper_scripts_are_executable(bootstrap_scripts, wrapper):
    script = bootstrap_scripts[wrapper]
    assert script.exists(), f"Missing wrapper script: {script}"
    assert os.access(script, os.X_OK), f"Script not executable: {script}"


@pytest.mark.parametrize("wrapper", WRAPPER_TARGETS.keys())
def test_wrapper_scripts_have_valid_syntax(bootstrap_scripts, wrapper):
    run_command(["bash", "-n", str(bootstrap_scripts[wrapper])])


@pytest.mark.parametrize("wrapper,target", WRAPPER_TARGETS.items())
def test_wrapper_scripts_delegate_to_python_helpers(bootstrap_scripts, wrapper, target):
    env = os.environ.copy()
    env["PYTHON"] = "echo"
    result = run_command(["bash", str(bootstrap_scripts[wrapper]), "--dry-run"], env=env)
    assert target in result.stdout + result.stderr