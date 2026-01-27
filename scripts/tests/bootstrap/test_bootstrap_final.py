"""Pytest port of test-bootstrap-final.sh."""

from __future__ import annotations

import json
import os

import pytest

from .bootstrap_env import BootstrapContext, have_command
from .utils import bash_syntax_ok, run_command, script_contains


def test_required_scripts_are_executable(bootstrap_context: BootstrapContext) -> None:
    for script in bootstrap_context.bootstrap_scripts:
        assert script.exists(), f"Missing script: {script}"
        assert os.access(script, os.X_OK), f"Script not executable: {script}"


@pytest.mark.parametrize(
    "script_attr",
    ["bootstrap_script", "datadog_script", "postgres_script", "app_script"],
)
def test_bash_syntax_is_valid(
    bootstrap_context: BootstrapContext, script_attr: str
) -> None:
    script = getattr(bootstrap_context, script_attr)
    ok, stderr = bash_syntax_ok(script)
    assert ok, f"bash -n failed for {script}: {stderr}"


def test_environment_variables_referenced(bootstrap_context: BootstrapContext) -> None:
    expectations = {
        "aks-bootstrap.sh": ["CLUSTER_NAME", "RESOURCE_GROUP", "LOCATION"],
        "aks-app-deploy.sh": ["NAMESPACE", "ACR_NAME", "LOCATION"],
    }
    for script in bootstrap_context.bootstrap_scripts:
        required_vars = expectations.get(script.name)
        if not required_vars:
            continue
        contents = script.read_text()
        for var in required_vars:
            assert var in contents, f"{var} missing from {script.name}"


def test_scripts_delegate_to_python_helpers(bootstrap_context: BootstrapContext) -> None:
    assert script_contains(bootstrap_context.bootstrap_script, "deploy_aks.py")
    assert script_contains(bootstrap_context.datadog_script, "datadog_setup.py")
    assert script_contains(bootstrap_context.postgres_script, "postgres_setup.py")
    assert script_contains(bootstrap_context.app_script, "app_deploy.py")


@pytest.mark.parametrize("dependency", ["az", "kubectl", "helm", "docker", "openssl"])
def test_dependency_presence(dependency: str) -> None:
    if not have_command(dependency):
        pytest.skip(f"{dependency} not available in PATH")
    result = run_command([dependency, "--version"])
    assert result.returncode == 0, result.stderr


def test_azure_cli_connectivity() -> None:
    if not have_command("az"):
        pytest.skip("Azure CLI not installed")
    result = run_command(["az", "account", "show"], timeout=20)
    if result.returncode != 0:
        pytest.skip("Azure CLI not authenticated")
    account = json.loads(result.stdout or "{}")
    assert "id" in account


def test_bootstrap_python_delegate_exists(bootstrap_context: BootstrapContext) -> None:
    delegate = bootstrap_context.scripts_dir / "deploy_aks.py"
    assert delegate.exists(), "deploy_aks.py missing"


def test_configuration_files_present(bootstrap_context: BootstrapContext) -> None:
    candidates = [
        bootstrap_context.repo_root / ".env.local",
        bootstrap_context.repo_root / ".env.azure",
        bootstrap_context.test_dir / "test-env",
        bootstrap_context.test_dir / "test_env_example.py",
    ]
    assert any(path.exists() for path in candidates), "No bootstrap configuration files found"


def test_helm_structure_if_present(bootstrap_context: BootstrapContext) -> None:
    charts_dir = bootstrap_context.repo_root / "charts"
    if not charts_dir.exists():
        pytest.skip("No charts directory present")
    candidate = charts_dir / "vibecode"
    if not candidate.exists():
        pytest.skip("vibecode chart not present")
    assert (candidate / "Chart.yaml").exists()
    templates_dir = candidate / "templates"
    assert templates_dir.exists()
    assert any(templates_dir.glob("*.yaml"))

