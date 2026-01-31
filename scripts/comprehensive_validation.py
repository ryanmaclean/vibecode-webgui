#!/usr/bin/env python3
"""Vibecode WebGUI - Comprehensive validation harness.

Runs health checks, unit tests, and optional integration smoke tests.

Validation steps:
  1. Configuration validation
  2. Mock telemetry server startup (optional)
  3. Lint & type checks
  4. Targeted unit tests
  5. Playwright smoke listing (ensures config loads)
"""
from __future__ import annotations

import argparse
import atexit
import os
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


# ANSI color codes
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log(msg: str) -> None:
    """Log an info message."""
    print(f"{Colors.BLUE}{msg}{Colors.NC}")


def ok(msg: str) -> None:
    """Log a success message."""
    print(f"{Colors.GREEN}\u2713 {msg}{Colors.NC}")


def warn(msg: str) -> None:
    """Log a warning message."""
    print(f"{Colors.YELLOW}\u26a0 {msg}{Colors.NC}")


def err(msg: str) -> None:
    """Log an error message."""
    print(f"{Colors.RED}\u2717 {msg}{Colors.NC}")


@dataclass
class ValidationConfig:
    """Configuration for validation run."""

    skip_tests: bool = False
    skip_mock: bool = False
    project_root: Path = Path.cwd()


@dataclass
class ValidationResult:
    """Result of validation run."""

    exit_code: int = 0
    config_validated: bool = False
    lint_passed: bool = False
    tests_passed: bool = False
    playwright_ok: bool = False


# Global for cleanup
_mock_process: subprocess.Popen | None = None


def cleanup() -> None:
    """Clean up mock server process."""
    global _mock_process
    if _mock_process is not None:
        try:
            _mock_process.terminate()
            _mock_process.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            try:
                _mock_process.kill()
            except OSError:
                pass
        _mock_process = None


def run_cmd(
    cmd: list[str],
    check: bool = False,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=check,
        cwd=cwd,
    )


def run_cmd_live(
    cmd: list[str],
    cwd: Path | None = None,
) -> int:
    """Run a command with live output and return exit code."""
    result = subprocess.run(cmd, cwd=cwd)
    return result.returncode


def validate_configuration(project_root: Path) -> bool:
    """Validate project configuration."""
    log("Validating configuration")

    validate_script = project_root / "scripts" / "vibecode-cli" / "validate-config.sh"

    if not validate_script.exists():
        warn(f"Validation script not found: {validate_script}")
        return True  # Not a failure, just skip

    result = run_cmd(["bash", str(validate_script)], cwd=project_root)

    if result.returncode == 0:
        ok("Configuration validated")
        return True
    else:
        warn("Configuration checks reported issues. Review output above.")
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return True  # Warn but don't fail


def start_mock_server(project_root: Path) -> subprocess.Popen | None:
    """Start the mock telemetry server."""
    global _mock_process

    if not shutil.which("python3"):
        warn("python3 not available; skipping mock telemetry server")
        return None

    mock_script = project_root / "scripts" / "mock-services" / "mock-telemetry-server.py"

    if not mock_script.exists():
        warn(f"Mock server script not found: {mock_script}")
        return None

    log("Starting mock telemetry server on 0.0.0.0:8080")

    try:
        proc = subprocess.Popen(
            ["python3", str(mock_script), "--http-port", "8080", "--statsd-port", "0"],
            cwd=project_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(1)

        # Check if process is still running
        if proc.poll() is None:
            ok(f"Mock telemetry server PID {proc.pid}")
            _mock_process = proc
            return proc
        else:
            warn("Mock telemetry server failed to start")
            return None
    except OSError as e:
        warn(f"Could not start mock server: {e}")
        return None


def run_lint_checks(project_root: Path) -> bool:
    """Run lint and type checks."""
    log("Running lint & type checks (npm run check)")

    if not shutil.which("npm"):
        warn("npm not available; skipping lint checks")
        return True

    exit_code = run_cmd_live(["npm", "run", "check"], cwd=project_root)

    if exit_code == 0:
        ok("Lint + type check passed")
        return True
    else:
        err("Lint or type check failed")
        return False


def run_unit_tests(project_root: Path) -> bool:
    """Run focused unit tests."""
    log("Executing focused unit tests")

    if not shutil.which("npm"):
        warn("npm not available; skipping unit tests")
        return True

    exit_code = run_cmd_live(
        ["npm", "run", "test:unit", "--", "--runInBand", "--bail"],
        cwd=project_root,
    )

    if exit_code == 0:
        ok("Unit tests passed")
        return True
    else:
        err("Unit tests failed")
        return False


def check_playwright(project_root: Path) -> bool:
    """Ensure Playwright config loads."""
    log("Ensuring Playwright config loads")

    if not shutil.which("npx"):
        warn("npx not available; skipping Playwright check")
        return True

    exit_code = run_cmd_live(["npx", "playwright", "test", "--list"], cwd=project_root)

    if exit_code == 0:
        ok("Playwright project detected")
        return True
    else:
        warn("Playwright command failed. Install dependencies if UI tests are required.")
        return False


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip Jest and Playwright checks",
    )
    parser.add_argument(
        "--skip-mock",
        action="store_true",
        help="Do not launch mock telemetry server",
    )
    parser.add_argument(
        "-C", "--directory",
        type=Path,
        default=None,
        help="Project root directory (default: auto-detect)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    # Determine project root
    if args.directory:
        project_root = args.directory.resolve()
    else:
        # Auto-detect: script is in scripts/, so parent is project root
        script_dir = Path(__file__).resolve().parent
        project_root = script_dir.parent

    config = ValidationConfig(
        skip_tests=args.skip_tests,
        skip_mock=args.skip_mock,
        project_root=project_root,
    )

    result = ValidationResult()

    # Register cleanup handler
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(1))
    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(1))

    log("Vibecode WebGUI comprehensive validation")
    log(f"Project root: {project_root}")

    # Check node_modules
    node_modules = project_root / "node_modules"
    if not node_modules.is_dir():
        warn("node_modules missing. Run scripts/vibecode-cli/install.sh first.")

    # Step 1: Configuration validation
    result.config_validated = validate_configuration(project_root)

    # Step 2: Mock telemetry server
    mock_proc = None
    if not config.skip_mock:
        mock_proc = start_mock_server(project_root)
    else:
        warn("Skipping mock telemetry server (--skip-mock)")

    # Step 3: Lint & type checks
    result.lint_passed = run_lint_checks(project_root)
    if not result.lint_passed:
        result.exit_code = 1

    # Step 4 & 5: Tests (if not skipped)
    if not config.skip_tests:
        # Unit tests
        result.tests_passed = run_unit_tests(project_root)
        if not result.tests_passed:
            result.exit_code = 1

        # Playwright
        result.playwright_ok = check_playwright(project_root)
        if not result.playwright_ok:
            result.exit_code = 1
    else:
        warn("Skipping tests (--skip-tests)")
        result.tests_passed = True
        result.playwright_ok = True

    # Final summary
    if result.exit_code == 0:
        log("Validation complete")
    else:
        err("Validation completed with failures")

    return result.exit_code


if __name__ == "__main__":
    sys.exit(main())
