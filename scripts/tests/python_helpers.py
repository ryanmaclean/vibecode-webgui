

"""Shared helpers for Python-based system tests previously implemented as shell scripts."""

from __future__ import annotations
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

import datetime as _dt
import importlib.util
import os
import shutil
import subprocess
from pathlib import Path
import re
from typing import Dict, Iterable, Mapping, MutableMapping, Optional, Sequence, Tuple
import urllib.error
import urllib.request

SCRIPTS_TESTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_TESTS_DIR.parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


def repo_root() -> Path:
    return REPO_ROOT


def scripts_dir() -> Path:
    return SCRIPTS_DIR


def tests_dir() -> Path:
    return SCRIPTS_TESTS_DIR


def command_available(command: str) -> bool:
    """Return True when *command* is available on PATH."""

    return shutil.which(command) is not None


def run_command(
    command: Sequence[str],
    *,
    check: bool = True,
    cwd: Optional[Path] = None,
    env: Optional[Mapping[str, str]] = None,
    timeout: Optional[int] = None,
) -> subprocess.CompletedProcess[str]:
    """Run *command* and return the completed process while capturing output."""

    completed = subprocess.run(  # noqa: S603,S607 - trusted inputs
        list(command),
        check=False,
        cwd=str(cwd) if cwd else None,
        env=dict(env) if env else None,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if check and completed.returncode != 0:
        cmd_display = " ".join(command)
        raise RuntimeError(
            f"Command failed ({completed.returncode}): {cmd_display}\n"
            f"stdout: {completed.stdout}\nstderr: {completed.stderr}"
        )
    return completed


def import_module_from_path(module_name: str, path: Path):
    """Load a module from an arbitrary *path* without requiring package imports."""

    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise ImportError(f"Cannot import module {module_name} from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_env_lines(lines: Iterable[str]) -> Dict[str, str]:
    env: Dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def load_env_file(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    return parse_env_lines(path.read_text().splitlines())


def apply_env(values: Mapping[str, str], *, overwrite: bool = False) -> MutableMapping[str, str]:
    target = os.environ
    for key, value in values.items():
        if overwrite or key not in target:
            target[key] = value
    return target


def env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def timestamped_name(prefix: str) -> str:
    return f"{prefix}-{_dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


def http_request(
    url: str,
    *,
    method: str = "GET",
    headers: Optional[Mapping[str, str]] = None,
    timeout: int = 5,
) -> Tuple[int, Mapping[str, str], str]:
    request = urllib.request.Request(url, method=method, headers=dict(headers or {}))
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
        body = response.read().decode("utf-8", errors="replace")
        return response.status, dict(response.headers), body


def http_request_safe(
    url: str,
    *,
    method: str = "GET",
    headers: Optional[Mapping[str, str]] = None,
    timeout: int = 5,
):
    try:
        return http_request(url, method=method, headers=headers, timeout=timeout)
    except urllib.error.URLError as exc:  # pragma: no cover - depends on network
        return None, {}, str(exc)


_FUNCTION_DEF_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\)\s*\{", re.MULTILINE)


def count_function_definitions(path: Path) -> int:
    return len(_FUNCTION_DEF_RE.findall(path.read_text()))


def extract_function_body(path: Path, function_name: str) -> str:
    text = path.read_text()
    pattern = re.compile(rf"^{re.escape(function_name)}\s*\(\)\s*\{{", re.MULTILINE)
    match = pattern.search(text)
    if not match:
        raise ValueError(f"Function {function_name} not found in {path}")

    start = match.start()
    brace_depth = 0
    end = start
    for index in range(start, len(text)):
        char = text[index]
        if char == "{":
            brace_depth += 1
        elif char == "}":
            brace_depth -= 1
            if brace_depth == 0:
                end = index + 1
                break
    else:  # pragma: no cover - indicates malformed script
        raise ValueError(f"Could not find end of {function_name} in {path}")

    return text[start:end]