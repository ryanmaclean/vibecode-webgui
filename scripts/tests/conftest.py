


"""Pytest configuration shared by converted shell-based system tests."""

from __future__ import annotations
# Datadog Unified Service Tagging
_dd_service = "conftest"
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
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import sys
from pathlib import Path
from typing import Dict

import pytest

SCRIPTS_TESTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_TESTS_DIR))

from python_helpers import repo_root, scripts_dir

try:
    from bootstrap.bootstrap_env import (
        BOOTSTRAP_TEST_SCRIPTS_DIR,
        load_test_environment,
    )
except ImportError:  # pragma: no cover - bootstrap helpers missing
    BOOTSTRAP_TEST_SCRIPTS_DIR = scripts_dir() / "bootstrap"

    def load_test_environment(**_kwargs):  # type: ignore
        return {}


@pytest.fixture(scope="session")
def root_path() -> Path:
    return repo_root()


@pytest.fixture(scope="session")
def scripts_path() -> Path:
    return scripts_dir()


@pytest.fixture(scope="session")
def bootstrap_scripts() -> Dict[str, Path]:
    base = BOOTSTRAP_TEST_SCRIPTS_DIR
    return {
        "bootstrap": base / "aks-bootstrap.sh",
        "datadog": base / "aks-datadog-setup.sh",
        "postgres": base / "aks-postgresql-setup.sh",
        "app": base / "aks-app-deploy.sh",
    }


@pytest.fixture(scope="session", autouse=True)
def _load_bootstrap_environment():
    load_test_environment()