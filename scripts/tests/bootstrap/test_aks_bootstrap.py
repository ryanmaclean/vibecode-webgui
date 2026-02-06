


"""Pytest version of test-aks-bootstrap.sh."""

from __future__ import annotations
# Datadog Unified Service Tagging
_dd_service = "test-aks-bootstrap"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "testing"})
    _dd_patch()
except ImportError:
    pass

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

import os

import pytest

from bootstrap.bootstrap_env import load_test_environment
from python_helpers import command_available, run_command


def test_bootstrap_script_exists_and_is_executable(bootstrap_scripts):
    script = bootstrap_scripts["bootstrap"]
    assert script.exists(), f"Missing script: {script}"
    assert os.access(script, os.X_OK), f"Script not executable: {script}"


def test_bootstrap_script_has_valid_syntax(bootstrap_scripts):
    run_command(["bash", "-n", str(bootstrap_scripts["bootstrap"])])


def test_bootstrap_environment_loaded():
    env = load_test_environment()
    for key in ("RESOURCE_GROUP", "CLUSTER_NAME", "DD_API_KEY", "NAMESPACE"):
        assert key in env or key in os.environ


def test_bootstrap_delegates_to_python(bootstrap_scripts):
    env = os.environ.copy()
    env["PYTHON"] = "echo"
    result = run_command(["bash", str(bootstrap_scripts["bootstrap"]), "--dry-run"], env=env)
    assert "deploy_aks.py" in result.stdout + result.stderr


@pytest.mark.parametrize("command", ["bash", "python3", "curl"])
def test_local_dependencies_available(command: str):
    if not command_available(command):
        pytest.skip(f"{command} not available in PATH")