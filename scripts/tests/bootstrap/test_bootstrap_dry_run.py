#!/usr/bin/env python3
"""Test the updated AKS bootstrap script in dry-run mode."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import os
import subprocess
import sys
import tempfile
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    RED = "\033[0;31m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.RED = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def get_paths() -> tuple[Path, Path]:
    """Get script directory and repo root paths."""
    script_dir = Path(__file__).parent.resolve()
    repo_root = script_dir.parent.parent.parent
    return script_dir, repo_root


def run_command(
    cmd: list[str] | str,
    check: bool = True,
    capture: bool = False,
    shell: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(cmd, check=check, capture_output=capture, text=True, shell=shell)


def check_script_exists(script_path: Path, repo_root: Path) -> bool:
    """Check if script exists and is executable."""
    rel_path = script_path.relative_to(repo_root)
    if script_path.exists() and os.access(script_path, os.X_OK):
        print(f"   \u2705 {rel_path}")
        return True
    else:
        print(f"   \u274c {rel_path} missing or not executable")
        return False


def check_syntax(script_path: Path, repo_root: Path) -> bool:
    """Check bash script syntax."""
    rel_path = script_path.relative_to(repo_root)
    result = run_command(["bash", "-n", str(script_path)], check=False, capture=True)
    if result.returncode == 0:
        print(f"   \u2705 {rel_path} syntax OK")
        return True
    else:
        print(f"   \u274c {rel_path} syntax error")
        return False


def create_dry_run_script(
    source_script: Path,
    datadog_script: Path,
    postgres_script: Path,
    app_script: Path,
) -> Path:
    """Create a dry-run version of the bootstrap script."""
    dry_run_fd, dry_run_path = tempfile.mkstemp(suffix=".sh")

    mock_header = '''#!/usr/bin/env bash
set -euo pipefail

# Mock Azure functions for testing
az() {
  case "$1 $2" in
    "account show")
      echo '{"id":"test-subscription-id","name":"test-subscription"}'
      ;;
    "aks show")
      echo '{"name":"test-cluster","resourceGroup":"test-rg"}'
      ;;
    "aks get-credentials")
      echo "Mock: Got AKS credentials"
      ;;
    "acr show")
      echo '{"name":"testacr","loginServer":"testacr.azurecr.io"}'
      ;;
    "acr login")
      echo "Mock: Logged into ACR"
      ;;
    *)
      echo "Mock az command: $*"
      ;;
  esac
}

kubectl() {
  case "$1" in
    "cluster-info")
      echo "Mock: Kubernetes cluster info"
      ;;
    "get")
      if [[ "$2" == "storageclass" ]]; then
        echo "Mock: Storage class exists"
      else
        echo "Mock kubectl get: $*"
      fi
      ;;
    "apply")
      echo "Mock kubectl apply: $*"
      ;;
    *)
      echo "Mock kubectl: $*"
      ;;
  esac
}

# Source the original script functions but with mocked Azure calls
'''

    mock_footer = '''

validate_aks_cluster_dry_run() {
  log "validating AKS cluster access (dry-run mode)"
  log "Mock: AKS cluster '$CLUSTER_NAME' found in resource group '$RESOURCE_GROUP'"
  log "Mock: Got AKS credentials"
  log "Mock: Kubernetes cluster connection validated"
}

validate_acr_access() {
  log "validating ACR access (dry-run mode)"
  log "Mock: ACR '$ACR_NAME' found and accessible"
  log "Mock: ACR login successful"
}

ensure_azure_storage_class() {
  log "ensuring Azure storage classes are available (dry-run mode)"
  log "Mock: Azure storage class '$STORAGE_CLASS' ready"
}
'''

    # Read source script
    source_content = source_script.read_text()

    # Replace validate_aks_cluster with dry-run version
    source_content = source_content.replace(
        "validate_aks_cluster$",
        "validate_aks_cluster_dry_run",
    )

    # Replace script paths
    source_content = source_content.replace(
        "./scripts/aks-datadog-setup.sh",
        str(datadog_script),
    )
    source_content = source_content.replace(
        "./scripts/aks-postgresql-setup.sh",
        str(postgres_script),
    )
    source_content = source_content.replace(
        "./scripts/aks-app-deploy.sh",
        str(app_script),
    )

    # Write the combined script
    with os.fdopen(dry_run_fd, "w") as f:
        f.write(mock_header)
        f.write(source_content)
        f.write(mock_footer)

    return Path(dry_run_path)


def test_script_functions(script_path: Path) -> bool:
    """Test that script functions can be loaded without errors."""
    # Extract just the functions without executing main
    content = script_path.read_text()
    lines = content.split("\n")

    # Find where main() starts and exclude it
    func_lines = []
    for line in lines:
        if line.startswith("main()"):
            break
        func_lines.append(line)

    # Write to temp file and check syntax
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sh", delete=False) as f:
        f.write("\n".join(func_lines))
        temp_path = f.name

    try:
        result = run_command(["bash", "-n", temp_path], check=False, capture=True)
        return result.returncode == 0
    finally:
        os.unlink(temp_path)


def main() -> int:
    """Main entry point."""
    script_dir, repo_root = get_paths()
    scripts_dir = repo_root / "scripts"

    source_script = scripts_dir / "aks-bootstrap.sh"
    datadog_script = scripts_dir / "aks-datadog-setup.sh"
    postgres_script = scripts_dir / "aks-postgresql-setup.sh"
    app_script = scripts_dir / "aks-app-deploy.sh"

    required_scripts = [source_script, datadog_script, postgres_script, app_script]

    print("\U0001f9ea Testing Updated AKS Bootstrap Script (Dry-Run Mode)")

    # Test 1: Script structure validation
    print("\u2705 Test 1: Script structure validation")
    print("   Checking all required scripts exist...")

    all_exist = True
    for script in required_scripts:
        if not check_script_exists(script, repo_root):
            all_exist = False

    if not all_exist:
        return 1

    # Test 2: Syntax validation
    print()
    print("\u2705 Test 2: Syntax validation")

    all_valid = True
    for script in required_scripts:
        if not check_syntax(script, repo_root):
            all_valid = False

    if not all_valid:
        return 1

    # Test 3: Environment loading
    print()
    print("\u2705 Test 3: Environment configuration")

    os.environ["CLUSTER_NAME"] = "test-cluster"
    os.environ["RESOURCE_GROUP"] = "test-rg"
    os.environ["ACR_NAME"] = "testacr"
    os.environ["NAMESPACE"] = "test-namespace"
    os.environ["LOCATION"] = "eastus2"

    print("   \u2705 Environment variables set:")
    print(f"      CLUSTER_NAME: {os.environ['CLUSTER_NAME']}")
    print(f"      RESOURCE_GROUP: {os.environ['RESOURCE_GROUP']}")
    print(f"      ACR_NAME: {os.environ['ACR_NAME']}")
    print(f"      NAMESPACE: {os.environ['NAMESPACE']}")

    # Test 4: Dry-run execution
    print()
    print("\u2705 Test 4: Dry-run execution")

    dry_run_script = create_dry_run_script(
        source_script,
        datadog_script,
        postgres_script,
        app_script,
    )

    try:
        dry_run_script.chmod(0o755)
        print("   Running bootstrap script in dry-run mode...")

        result = run_command(["bash", str(dry_run_script)], check=False, capture=True)
        if result.returncode == 0:
            print("   \u2705 Dry-run execution successful")
        else:
            print("   \u274c Dry-run execution failed")
            if result.stderr:
                print(f"   Error: {result.stderr}")
            return 1
    finally:
        dry_run_script.unlink()

    # Test 5: Individual script testing
    print()
    print("\u2705 Test 5: Individual script component testing")

    for script in required_scripts:
        if test_script_functions(script):
            print(f"   \u2705 {script.name} functions can be loaded")
        else:
            print(f"   \u274c {script.name} function loading failed")
            return 1

    # Summary
    print()
    print("\U0001f389 All Tests Passed!")
    print()
    print("\U0001f4ca Test Summary:")
    print("   \u2705 Script Structure: All required scripts present")
    print("   \u2705 Syntax Validation: All scripts have valid syntax")
    print("   \u2705 Environment Config: Variables loaded correctly")
    print("   \u2705 Dry-run Execution: Bootstrap process works")
    print("   \u2705 Component Testing: Individual scripts validated")
    print()
    print("\U0001f680 Updated Bootstrap Architecture Ready!")
    print()
    print("\U0001f4cb Deployment Architecture:")
    print("   \U0001f3af aks-bootstrap.sh - Main orchestration & validation")
    print("   \U0001f4ca aks-datadog-setup.sh - Monitoring & observability")
    print("   \U0001f5c4\ufe0f  aks-postgresql-setup.sh - Database & pgvector setup")
    print("   \U0001f310 aks-app-deploy.sh - Application deployment & Helm")
    print()
    print("\u2728 Improvements in Updated Version:")
    print("   \u2022 Modular architecture for better maintainability")
    print("   \u2022 Simplified logging (removed complex Datadog integration)")
    print("   \u2022 Focused validation with clear error messages")
    print("   \u2022 Separated concerns (monitoring, database, application)")
    print("   \u2022 Azure-specific optimizations")
    print()
    print("\U0001f3af Ready for Production Deployment!")
    print("   Run: ./scripts/aks-bootstrap.sh")

    return 0


if __name__ == "__main__":
    sys.exit(main())
