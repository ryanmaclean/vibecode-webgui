
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

"""pytest conversion of test-claims-validation.sh."""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Dict

import pytest


Claim = Callable[[Dict[str, Path]], bool]


def _ctx(root_path: Path, scripts_path: Path, bootstrap_scripts) -> Dict[str, Path]:
    return {
        "root": root_path,
        "scripts": scripts_path,
        "bootstrap": bootstrap_scripts,
    }


def _script_text(path: Path) -> str:
    return path.read_text() if path.exists() else ""


CLAIMS: Dict[str, Claim] = {
    "deployment manager defined": lambda ctx: "class AKSDeploymentManager" in _script_text(
        ctx["scripts"] / "deploy_aks.py"
    ),
    "datadog helper exists": lambda ctx: (ctx["scripts"] / "datadog_setup.py").exists(),
    "postgres helper exists": lambda ctx: (ctx["scripts"] / "postgres_setup.py").exists(),
    "app deployment helper exists": lambda ctx: (ctx["scripts"] / "app_deploy.py").exists(),
    "bootstrap wrapper delegates": lambda ctx: "deploy_aks.py" in _script_text(ctx["bootstrap"]["bootstrap"]),
    "datadog wrapper delegates": lambda ctx: "datadog_setup.py" in _script_text(ctx["bootstrap"]["datadog"]),
    "postgres wrapper delegates": lambda ctx: "postgres_setup.py" in _script_text(ctx["bootstrap"]["postgres"]),
    "app wrapper delegates": lambda ctx: "app_deploy.py" in _script_text(ctx["bootstrap"]["app"]),
    "datadog logging library present": lambda ctx: (ctx["scripts"] / "lib" / "datadog-logging.sh").exists(),
}


@pytest.mark.parametrize("claim_name", sorted(CLAIMS.keys()))
def test_bootstrap_claims(claim_name: str, root_path: Path, scripts_path: Path, bootstrap_scripts):
    assert CLAIMS[claim_name](_ctx(root_path, scripts_path, bootstrap_scripts)), f"Claim failed: {claim_name}"