

"""Pytest replacements for test-datadog-logging.sh."""

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

from python_helpers import command_available, run_command


@pytest.fixture(scope="module")
def logging_library(scripts_path: Path) -> Path:
    lib_path = scripts_path / "lib" / "datadog-logging.sh"
    if not lib_path.exists():
        pytest.skip("Datadog logging library missing")
    return lib_path


def test_logging_library_has_expected_functions(logging_library: Path):
    content = logging_library.read_text()
    for func in ("dd_log", "dd_info", "dd_metric"):
        assert func in content, f"{func} not defined in {logging_library}"


@pytest.mark.skipif(not command_available("bash"), reason="bash is required for integration test")
def test_dd_logging_outputs_locally(logging_library: Path, tmp_path):
    runner = tmp_path / "datadog_log_test.sh"
    runner.write_text(
        f"""#!/usr/bin/env bash
set -euo pipefail
source "{logging_library}"
dd_info "info" "🧪 Test deployment log from AKS bootstrap testing"
dd_warn "warn" "Environment: ${{NODE_ENV:-development}}"
dd_error "error" "Cluster: ${{CLUSTER_NAME:-test-cluster}}"
"""
    )
    runner.chmod(0o755)

    env = os.environ.copy()
    env.setdefault("DD_API_KEY", "test_datadog_api_key_here")
    env.setdefault("NODE_ENV", "development")

    result = run_command(["bash", str(runner)], check=True, env=env)
    combined = (result.stdout + result.stderr).strip()
    assert "[DD-BASH] info" in combined
    assert "Environment" in combined


@pytest.mark.skipif(not command_available("bash"), reason="bash is required for integration test")
def test_dd_metric_function_handles_missing_api_key(logging_library: Path, tmp_path):
    runner = tmp_path / "datadog_metric_test.sh"
    runner.write_text(
        f"""#!/usr/bin/env bash
set -euo pipefail
source "{logging_library}"
dd_metric "aks.bootstrap.test" 1 gauge "deployment:aks" "environment:${{NODE_ENV:-development}}"
"""
    )
    runner.chmod(0o755)

    env = os.environ.copy()
    env.pop("DD_API_KEY", None)

    result = run_command(["bash", str(runner)], check=True, env=env)
    assert "[DD-METRIC]" in result.stderr + result.stdout
