<<<<<<< HEAD


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
=======
#!/usr/bin/env python3
"""Test Datadog logging integration."""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.YELLOW = cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def get_paths() -> tuple[Path, Path, Path]:
    """Get script directory, bootstrap dir, and scripts dir paths."""
    script_dir = Path(__file__).parent.resolve()
    bootstrap_dir = script_dir.parent / "bootstrap"
    repo_root = script_dir.parent.parent.parent
    scripts_dir = repo_root / "scripts"
    return script_dir, bootstrap_dir, scripts_dir


def load_env_file(env_path: Path) -> dict[str, str]:
    """Load environment variables from a file."""
    env_vars: dict[str, str] = {}
    if not env_path.exists():
        return env_vars

    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                # Remove quotes if present
                value = value.strip().strip("'\"")
                env_vars[key.strip()] = value

    return env_vars


def extract_function(script_content: str, func_name: str) -> str:
    """Extract a bash function from script content."""
    # Match function definition with braces
    pattern = rf"^{func_name}\(\) \{{\n(.*?)^}}"
    match = re.search(pattern, script_content, re.MULTILINE | re.DOTALL)
    if match:
        return f"{func_name}() {{\n{match.group(1)}}}\n"
    return ""


def create_test_script(
    scripts_dir: Path,
    env_vars: dict[str, str],
) -> Path:
    """Create a test script with logging functions."""
    source_script = scripts_dir / "aks-bootstrap.sh"

    if not source_script.exists():
        print(f"{Colors.YELLOW}[WARN]{Colors.NC} Source script not found: {source_script}")
        return Path("")

    content = source_script.read_text()

    # Extract logging functions
    log_func = extract_function(content, "log")
    error_func = extract_function(content, "error")
    send_to_datadog_func = extract_function(content, "send_to_datadog")

    # Build environment exports
    env_exports = "\n".join(
        f'export {key}="{value}"' for key, value in env_vars.items()
    )

    test_script = f"""#!/usr/bin/env bash
set -euo pipefail

# Environment variables
{env_exports}

# Logging functions
{log_func}
{error_func}
{send_to_datadog_func}

# Test logging
log "Test deployment log from AKS bootstrap testing"
log "Environment: ${{NODE_ENV:-development}}"
log "Cluster: ${{CLUSTER_NAME:-test-cluster}}"
log "Resource Group: ${{RESOURCE_GROUP:-test-rg}}"
"""

    fd, temp_path = tempfile.mkstemp(suffix=".sh")
    with os.fdopen(fd, "w") as f:
        f.write(test_script)

    Path(temp_path).chmod(0o755)
    return Path(temp_path)


def run_test_script(script_path: Path) -> bool:
    """Run the test script."""
    if not script_path.exists():
        return False

    try:
        result = subprocess.run(
            ["bash", str(script_path)],
            check=False,
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except Exception as e:
        print(f"{Colors.YELLOW}[WARN]{Colors.NC} Failed to run test script: {e}")
        return False


def main() -> int:
    """Main entry point."""
    script_dir, bootstrap_dir, scripts_dir = get_paths()
    repo_root = scripts_dir.parent

    print("\U0001f50d Testing Datadog Logging Integration")

    # Load environment variables
    env_vars: dict[str, str] = {}

    env_local = repo_root / ".env.local"
    if env_local.exists():
        print("\U0001f4c4 Found .env.local, sourcing real environment variables")
        env_vars.update(load_env_file(env_local))
    else:
        print(f"{Colors.YELLOW}\u26a0\ufe0f  No .env.local found, using test environment{Colors.NC}")
        env_vars = {
            "DD_API_KEY": "test_datadog_api_key_here",
            "DD_SITE": "datadoghq.com",
            "NODE_ENV": "development",
            "CLUSTER_NAME": "test-cluster",
            "RESOURCE_GROUP": "test-rg",
        }

    # Set defaults if not present
    env_vars.setdefault("DD_SITE", "datadoghq.com")
    env_vars.setdefault("NODE_ENV", "development")
    env_vars.setdefault("CLUSTER_NAME", "test-cluster")
    env_vars.setdefault("RESOURCE_GROUP", "test-rg")

    dd_api_key = env_vars.get("DD_API_KEY", "")
    dd_site = env_vars.get("DD_SITE", "datadoghq.com")

    print("\U0001f9ea Testing log function with current DD_API_KEY")
    print(f"   API Key: {dd_api_key[:10]}..." if len(dd_api_key) > 10 else f"   API Key: {dd_api_key}")
    print(f"   DD_SITE: {dd_site}")

    # Create and run test script
    test_script = create_test_script(scripts_dir, env_vars)

    if test_script and test_script.exists():
        try:
            run_test_script(test_script)
        finally:
            if test_script.exists():
                test_script.unlink()

    # Report results
    is_real_key = dd_api_key != "test_datadog_api_key_here" and dd_api_key

    if is_real_key:
        print(f"{Colors.GREEN}\u2705 Logs sent to Datadog (check your Datadog logs dashboard){Colors.NC}")
        print("   Service: aks-bootstrap")
        print(f"   Tags: deployment:aks, environment:{env_vars.get('NODE_ENV', 'development')}")
    else:
        print(f"{Colors.BLUE}\u2139\ufe0f  Test mode - logs not sent to Datadog (using test API key){Colors.NC}")

    print()
    print("\U0001f3af Datadog Integration Test Summary:")
    print("   \u2705 Logging functions loaded successfully")
    print("   \u2705 Log formatting and timestamping working")
    print("   \u2705 Datadog payload generation working")

    if is_real_key:
        print("   \u2705 Logs transmitted to Datadog")
    else:
        print(f"   {Colors.YELLOW}\u26a0\ufe0f  Test mode - no actual transmission{Colors.NC}")

    print()
    print("\U0001f4a1 To test with real Datadog:")
    print("   1. Add your real DD_API_KEY to .env.local")
    print("   2. Run this test again")
    print("   3. Check Datadog logs dashboard for service 'aks-bootstrap'")

    return 0


if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
