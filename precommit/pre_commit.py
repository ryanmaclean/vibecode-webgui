
"""Python implementation of the repository pre-commit checks."""

from __future__ import annotations

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Iterator, List, Sequence, Tuple

CHUNK_SIZE = 8192
BLOCKED_PATH_PATTERNS = (
    re.compile(r"(^|/)(?:test-results|\.test-results)/.*\.xml$"),
    re.compile(r"(^|/)junit\.xml$"),
)
SECRET_PATTERNS: Tuple[Tuple[str, re.Pattern[str]], ...] = (
    ("OpenAI/OpenRouter API key", re.compile(r"sk-[a-zA-Z0-9]{40,}")),
    ("Anthropic API key", re.compile(r"sk-ant-[a-zA-Z0-9]{40,}")),
    ("GitHub token", re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}")),
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
)
ENV_FILE_PATTERN = re.compile(r"\.env(\.local|\..+)?$", re.IGNORECASE)
JS_TS_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}
SRC_PREFIX = "src/"
SECRET_FIXTURE_PREFIXES = ("tests/precommit/fixtures/",)


def _run(cmd: Sequence[str], *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    """Run a subprocess command and return the completed process."""

    return subprocess.run(cmd, text=True, capture_output=False, env=env, check=False)


def _git_staged_files() -> List[str]:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        print("❌ Unable to read staged files. Aborting pre-commit checks.")
        raise SystemExit(result.returncode or 1)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _blocked_files(files: Sequence[str]) -> List[str]:
    blocked: List[str] = []
    for file in files:
        if any(pattern.search(file) for pattern in BLOCKED_PATH_PATTERNS):
            blocked.append(file)
    return blocked


def _iter_candidate_secret_files(files: Sequence[str]) -> Iterator[Path]:
    for file in files:
        path = Path(file)
        if not path.is_file():
            continue
        relative = path.as_posix()
        if ENV_FILE_PATTERN.search(relative) or "node_modules" in path.parts:
            continue
        if relative.startswith(SECRET_FIXTURE_PREFIXES):
            continue
        yield path


def _scan_file(path: Path) -> Tuple[str, str] | None:
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for chunk in iter(lambda: handle.read(CHUNK_SIZE), ""):
                for description, pattern in SECRET_PATTERNS:
                    if pattern.search(chunk):
                        return description, path.as_posix()
    except OSError as exc:
        print(f"⚠️  Skipping {path}: {exc}")
    return None


def _is_js_ts_file(file: str) -> bool:
    return Path(file).suffix in JS_TS_EXTENSIONS


def _is_src_code_file(file: str) -> bool:
    if not file.startswith(SRC_PREFIX):
        return False
    if "__tests__" in file or ".test." in file or ".spec." in file:
        return False
    return _is_js_ts_file(file)


def _run_eslint(files: Sequence[str]) -> None:
    result = _run(["npx", "eslint", "--fix", "--quiet", *files])
    if result.returncode != 0:
        print("⚠️ ESLint found issues. Please fix them before committing.")


def _run_type_check() -> None:
    result = _run(["npm", "run", "type-check"])
    if result.returncode != 0:
        print("⚠️ TypeScript type check failed. Please fix type errors before committing.")


def _run_quick_tests() -> None:
    env = os.environ.copy()
    env.update({"SKIP_DOCKER_TESTS": "1", "SKIP_K8S_TESTS": "1"})
    result = _run(["npm", "run", "quick-test"], env=env)
    if result.returncode != 0:
        print("❌ Tests failed. Run 'npm test' to see details.")
        raise SystemExit(result.returncode or 1)


def _run_full_checks(staged_files: Sequence[str]) -> None:
    print("🔍 Running full pre-commit checks...")
    staged_js_ts = [file for file in staged_files if _is_js_ts_file(file)]
    if staged_js_ts:
        print("📝 Linting JavaScript/TypeScript files...")
        _run_eslint(staged_js_ts)
        _run_type_check()
    staged_src_files = [file for file in staged_files if _is_src_code_file(file)]
    if staged_src_files:
        print("🧪 Running tests...")
        _run_quick_tests()
    print("✅ Full checks completed")


def _run_security_scan(staged_files: Sequence[str]) -> None:
    print("🔒 Scanning for API keys and sensitive data...")
    for path in _iter_candidate_secret_files(staged_files):
        result = _scan_file(path)
        if result:
            description, file_path = result
            print(f"❌ ERROR: Potential {description} found in {file_path}")
            raise SystemExit(1)
    print("✅ Security scan passed")


def main() -> int:
    print("🚀 Running pre-commit checks (light mode)...")
    staged_files = _git_staged_files()

    blocked = _blocked_files(staged_files)
    if blocked:
        print("❌ Blocking commit: test result report files must not be committed:")
        for file in blocked:
            print(f" - {file}")
        print(
            "Ensure test-results/ and .test-results/ are ignored and remove these files from staging."
        )
        return 1

    _run_security_scan(staged_files)

    if os.environ.get("PRECOMMIT_FULL") == "1":
        _run_full_checks(staged_files)

    print()
    print("✅ Pre-commit checks passed! Ready to commit.")
    print("💡 Tip: Set PRECOMMIT_FULL=1 for full local validation, or rely on CI.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
