
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

"""Pytest alternative to test-updated-bootstrap.sh."""

from __future__ import annotations

import importlib.util

import pytest

from python_helpers import command_available, run_command

PYTHON_HELPERS = [
    "deploy_aks.py",
    "datadog_setup.py",
    "postgres_setup.py",
    "app_deploy.py",
]


@pytest.mark.skipif(not command_available("python3"), reason="python3 is required for compilation checks")
@pytest.mark.parametrize("helper", PYTHON_HELPERS)
def test_python_helpers_compile(scripts_path, helper):
    helper_path = scripts_path / helper
    assert helper_path.exists(), f"Missing helper {helper}"
    run_command(["python3", "-m", "py_compile", str(helper_path)])


def test_deploy_module_exports_manager(scripts_path):
    spec = importlib.util.spec_from_file_location("deploy_aks", scripts_path / "deploy_aks.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    assert hasattr(module, "AKSDeploymentManager")
    assert hasattr(module, "DeploymentConfig")