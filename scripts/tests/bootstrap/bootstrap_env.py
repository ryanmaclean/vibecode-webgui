"""Test context helpers shared across converted bootstrap tests."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Mapping, MutableMapping, Optional


DEFAULT_BOOTSTRAP_ENV: Dict[str, str] = {
    "CLUSTER_NAME": "vibecode-test",
    "RESOURCE_GROUP": "vibecode-rg",
    "ACR_NAME": "vibecodeacr",
    "NAMESPACE": "vibecode",
    "LOCATION": "eastus2",
    "STORAGE_CLASS": "default",
    "DD_API_KEY": "test_datadog_api_key",
    "DD_SITE": "datadoghq.com",
}


BOOTSTRAP_SCRIPT_NAMES = {
    "bootstrap": "aks-bootstrap.sh",
    "datadog": "aks-datadog-setup.sh",
    "postgres": "aks-postgresql-setup.sh",
    "app": "aks-app-deploy.sh",
}


def _parse_env_file(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip().strip('"')
    return env


def _resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _resolve_env_source(test_dir: Path, repo_root: Path) -> Optional[Path]:
    candidates = [
        test_dir / "test-env",
        repo_root / ".env.local",
        repo_root / ".env.azure",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


@dataclass(frozen=True)
class BootstrapContext:
    """Bundle of commonly used bootstrap test paths and env data."""

    repo_root: Path
    scripts_dir: Path
    test_dir: Path
    env_file: Optional[Path]
    env: Dict[str, str]

    @property
    def bootstrap_script(self) -> Path:
        return self.scripts_dir / BOOTSTRAP_SCRIPT_NAMES["bootstrap"]

    @property
    def datadog_script(self) -> Path:
        return self.scripts_dir / BOOTSTRAP_SCRIPT_NAMES["datadog"]

    @property
    def postgres_script(self) -> Path:
        return self.scripts_dir / BOOTSTRAP_SCRIPT_NAMES["postgres"]

    @property
    def app_script(self) -> Path:
        return self.scripts_dir / BOOTSTRAP_SCRIPT_NAMES["app"]

    @property
    def bootstrap_scripts(self) -> Iterable[Path]:
        return (
            self.bootstrap_script,
            self.datadog_script,
            self.postgres_script,
            self.app_script,
        )


def load_bootstrap_context(
    env_overrides: Mapping[str, str] | None = None,
) -> BootstrapContext:
    """Return context for bootstrap-related assertions."""

    repo_root = _resolve_repo_root()
    test_dir = Path(__file__).resolve().parent
    scripts_dir = repo_root / "scripts"

    env_data: MutableMapping[str, str] = dict(DEFAULT_BOOTSTRAP_ENV)
    env_file = _resolve_env_source(test_dir, repo_root)
    if env_file is not None:
        try:
            env_data.update(_parse_env_file(env_file))
        except OSError:
            # Keep defaults when the file cannot be read (e.g., permissions or encoding).
            pass

    source_env = dict(os.environ)
    if env_overrides is not None:
        source_env.update(env_overrides)

    for key, default in DEFAULT_BOOTSTRAP_ENV.items():
        env_data[key] = source_env.get(key, env_data.get(key, default))

    return BootstrapContext(
        repo_root=repo_root,
        scripts_dir=scripts_dir,
        test_dir=test_dir,
        env_file=env_file,
        env=dict(env_data),
    )


def have_command(binary: str) -> bool:
    """Return True when a binary is discoverable on PATH."""

    from shutil import which

    return which(binary) is not None


def ensure_scripts_exist(context: BootstrapContext) -> None:
    """Raise FileNotFoundError if any referenced bootstrap script is missing."""

    missing = [str(script) for script in context.bootstrap_scripts if not script.exists()]
    if missing:
        raise FileNotFoundError(
            "Missing bootstrap scripts: " + ", ".join(sorted(missing))
        )


__all__ = [
    "BootstrapContext",
    "DEFAULT_BOOTSTRAP_ENV",
    "BOOTSTRAP_SCRIPT_NAMES",
    "ensure_scripts_exist",
    "have_command",
    "load_bootstrap_context",
]

