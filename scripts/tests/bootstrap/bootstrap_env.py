
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

"""Python port of bootstrap-env.sh for pytest-based system tests."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict

BOOTSTRAP_TEST_DIR = Path(__file__).resolve().parent
SCRIPTS_TESTS_DIR = BOOTSTRAP_TEST_DIR.parent
if str(SCRIPTS_TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_TESTS_DIR))

from python_helpers import (  # noqa: E402
    apply_env,
    import_module_from_path,
    load_env_file,
    repo_root,
    scripts_dir,
)

BOOTSTRAP_TEST_REPO_ROOT = repo_root()
BOOTSTRAP_TEST_SCRIPTS_DIR = scripts_dir()

BOOTSTRAP_TEST_ENV_FILE = BOOTSTRAP_TEST_DIR / "test_env.py"
BOOTSTRAP_TEST_ENV_EXAMPLE = BOOTSTRAP_TEST_DIR / "test_env_example.py"

_ENV_LOADED = False
_LAST_ENV: Dict[str, str] = {}


def _load_env_module(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    module = import_module_from_path(f"bootstrap_env_{path.stem}", path)
    for attr_name in ("TEST_ENV", "DEFAULT_TEST_ENV", "ENV", "ENVIRON"):
        value = getattr(module, attr_name, None)
        if isinstance(value, dict):
            return {key: str(val) for key, val in value.items()}
    return {}


def load_test_environment(*, overwrite: bool = False) -> Dict[str, str]:
    """Load environment variables used by the bootstrap validation tests."""

    global _ENV_LOADED, _LAST_ENV
    if _ENV_LOADED and not overwrite:
        return dict(_LAST_ENV)

    env_values: Dict[str, str] = {}

    env_local = BOOTSTRAP_TEST_REPO_ROOT / ".env.local"
    env_values.update(load_env_file(env_local))

    user_env = _load_env_module(BOOTSTRAP_TEST_ENV_FILE)
    example_env = _load_env_module(BOOTSTRAP_TEST_ENV_EXAMPLE)

    if user_env:
        env_values.update(user_env)
    elif example_env:
        env_values.update(example_env)

    _LAST_ENV = env_values
    apply_env(env_values, overwrite=overwrite)
    _ENV_LOADED = True
    return dict(env_values)


__all__ = [
    "BOOTSTRAP_TEST_DIR",
    "BOOTSTRAP_TEST_REPO_ROOT",
    "BOOTSTRAP_TEST_SCRIPTS_DIR",
    "BOOTSTRAP_TEST_ENV_FILE",
    "BOOTSTRAP_TEST_ENV_EXAMPLE",
    "load_test_environment",
]