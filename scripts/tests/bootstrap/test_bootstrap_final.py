

"""Converts test-bootstrap-final.sh into pytest checks."""

from __future__ import annotations
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
from pathlib import Path

import pytest

from python_helpers import command_available, count_function_definitions, run_command


def test_modular_scripts_present_and_executable(bootstrap_scripts):
    for name, script in bootstrap_scripts.items():
        assert script.exists(), f"Missing {name} script"
        assert os.access(script, os.X_OK), f"Script {script} must be executable"


def test_modular_scripts_reference_python_helpers(bootstrap_scripts, scripts_path: Path):
    mapping = {
        "bootstrap": "deploy_aks.py",
        "datadog": "datadog_setup.py",
        "postgres": "postgres_setup.py",
        "app": "app_deploy.py",
    }
    for name, target in mapping.items():
        content = bootstrap_scripts[name].read_text()
        assert target in content, f"{name} script should delegate to {target}"


@pytest.mark.parametrize("command", ["az", "kubectl", "helm", "openssl", "curl"])
def test_cli_dependencies_available(command: str):
    if not command_available(command):
        pytest.skip(f"{command} not available in PATH")


def test_bootstrap_script_syntax_and_structure(bootstrap_scripts):
    bootstrap_script = bootstrap_scripts["bootstrap"]
    run_command(["bash", "-n", str(bootstrap_script)])
    assert count_function_definitions(bootstrap_script) == 0


def test_configuration_files(root_path: Path):
    candidates = [
        root_path / ".env.local",
        root_path / ".env.azure",
        root_path / "scripts" / "tests" / "bootstrap" / "test_env.py",
        root_path / "scripts" / "tests" / "bootstrap" / "test_env_example.py",
    ]
    assert any(path.exists() for path in candidates), "At least one configuration file must exist"


def test_helm_chart_structure(root_path: Path):
    chart_dir = root_path / "charts" / "vibecode"
    platform_dir = root_path / "charts" / "vibecode-platform"
    if not chart_dir.exists() and not platform_dir.exists():
        pytest.skip("No Helm chart directory found")
    target = chart_dir if chart_dir.exists() else platform_dir
    assert (target / "Chart.yaml").exists()
    assert (target / "templates").exists()