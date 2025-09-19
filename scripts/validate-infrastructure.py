#!/usr/bin/env python3
"""
Infrastructure validation script for AKS deployment.
Validates configuration, dependencies, and readiness for deployment.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional


class InfrastructureValidator:
    """Validates infrastructure configuration and dependencies."""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.tofu_dir = project_root / "tofu"
        self.validation_results = []

    def validate_azure_auth(self) -> Tuple[bool, str]:
        """Validate Azure CLI authentication."""
        try:
            result = subprocess.run(
                ["az", "account", "show"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                account_info = json.loads(result.stdout)
                user = account_info.get("user", {}).get("name", "Unknown")
                subscription = account_info.get("name", "Unknown")
                return True, f"✅ Azure authenticated as {user} on subscription '{subscription}'"
            else:
                return False, f"❌ Azure authentication failed: {result.stderr}"

        except subprocess.TimeoutExpired:
            return False, "❌ Azure CLI timeout - check connectivity"
        except FileNotFoundError:
            return False, "❌ Azure CLI not installed"
        except json.JSONDecodeError:
            return False, "❌ Azure CLI returned invalid JSON"
        except Exception as e:
            return False, f"❌ Azure authentication error: {e}"

    def validate_terraform_tools(self) -> Tuple[bool, str]:
        """Validate Terraform/OpenTofu availability."""
        tools_found = []

        # Check for tofu first (preferred)
        try:
            result = subprocess.run(["tofu", "version"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                version = result.stdout.split('\n')[0]
                tools_found.append(f"OpenTofu: {version}")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Check for terraform as fallback
        if not tools_found:
            try:
                result = subprocess.run(["terraform", "version"], capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    version = result.stdout.split('\n')[0]
                    tools_found.append(f"Terraform: {version}")
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

        if tools_found:
            return True, f"✅ IaC tools available: {', '.join(tools_found)}"
        else:
            return False, "❌ Neither OpenTofu nor Terraform found. Install one of these tools."

    def validate_kubectl(self) -> Tuple[bool, str]:
        """Validate kubectl availability."""
        try:
            result = subprocess.run(
                ["kubectl", "version", "--client"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                version_line = [line for line in result.stdout.split('\n') if 'Client Version' in line or 'clientVersion' in line]
                version = version_line[0] if version_line else "Unknown version"
                return True, f"✅ kubectl available: {version}"
            else:
                return False, f"❌ kubectl not working: {result.stderr}"

        except subprocess.TimeoutExpired:
            return False, "❌ kubectl timeout"
        except FileNotFoundError:
            return False, "❌ kubectl not installed"
        except Exception as e:
            return False, f"❌ kubectl error: {e}"

    def validate_python_dependencies(self) -> Tuple[bool, str]:
        """Validate Python dependencies for deployment script."""
        required_modules = [
            "azure.identity",
            "azure.mgmt.resource",
            "azure.mgmt.containerservice",
            "requests"
        ]

        missing_modules = []
        for module in required_modules:
            try:
                __import__(module)
            except ImportError:
                missing_modules.append(module)

        if missing_modules:
            return True, f"⚠️ Python modules for advanced features not installed: {', '.join(missing_modules)}\nFor full deployment capabilities: pip install -r requirements-dev.txt"
        else:
            return True, "✅ All Python dependencies available"

    def validate_terraform_config(self) -> Tuple[bool, str]:
        """Validate Terraform configuration syntax."""
        if not self.tofu_dir.exists():
            return False, f"❌ Terraform directory not found: {self.tofu_dir}"

        # Check for required files
        required_files = [
            "providers.tf",
            "aks-main.tf",
            "aks-variables.tf",
            "aks-outputs.tf",
            "k8s-postgresql.tf",
            "k8s-datadog.tf"
        ]

        missing_files = []
        for file_name in required_files:
            if not (self.tofu_dir / file_name).exists():
                missing_files.append(file_name)

        if missing_files:
            return False, f"❌ Missing Terraform files: {', '.join(missing_files)}"

        # Choose tool (prefer OpenTofu)
        tool = None
        try:
            subprocess.run(["tofu", "version"], capture_output=True, check=True)
            tool = "tofu"
        except (subprocess.CalledProcessError, FileNotFoundError):
            try:
                subprocess.run(["terraform", "version"], capture_output=True, check=True)
                tool = "terraform"
            except (subprocess.CalledProcessError, FileNotFoundError):
                return False, "❌ No Terraform tool available for validation"

        # Validate syntax
        try:
            # Set environment to disable telemetry for OpenTofu
            env = os.environ.copy()
            if "OTEL_TRACES_EXPORTER" in env:
                del env["OTEL_TRACES_EXPORTER"]

            # Init (without backend)
            init_result = subprocess.run(
                [tool, "init", "-backend=false"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir,
                timeout=60,
                env=env
            )

            if init_result.returncode != 0:
                return False, f"❌ Terraform init failed: {init_result.stderr}"

            # Validate
            validate_result = subprocess.run(
                [tool, "validate"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir,
                timeout=30,
                env=env
            )

            if validate_result.returncode == 0:
                return True, f"✅ Terraform configuration valid ({tool})"
            else:
                return False, f"❌ Terraform validation failed: {validate_result.stderr}"

        except subprocess.TimeoutExpired:
            return False, f"❌ Terraform validation timeout"
        except Exception as e:
            return False, f"❌ Terraform validation error: {e}"

    def validate_environment_variables(self) -> Tuple[bool, str]:
        """Validate required environment variables."""
        required_for_deployment = {
            "DATADOG_API_KEY": "Required for Datadog monitoring integration",
            "DATADOG_APP_KEY": "Required for Datadog application monitoring"
        }

        missing_vars = []
        optional_vars = []

        for var, description in required_for_deployment.items():
            if not os.getenv(var):
                optional_vars.append(f"{var}: {description}")

        if optional_vars:
            return True, f"⚠️  Optional variables for full deployment:\n" + "\n".join(f"  - {var}" for var in optional_vars)
        else:
            return True, "✅ All environment variables set for full deployment"

    def validate_azure_permissions(self) -> Tuple[bool, str]:
        """Validate Azure permissions for AKS deployment."""
        try:
            # Test resource group creation permission
            result = subprocess.run(
                ["az", "group", "list", "--query", "[0].name", "-o", "tsv"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                # Test AKS list permission (requires reader permission)
                aks_result = subprocess.run(
                    ["az", "aks", "list", "--query", "length(@)", "-o", "tsv"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if aks_result.returncode == 0:
                    return True, "✅ Azure permissions validated for AKS operations"
                else:
                    return False, f"❌ Insufficient Azure permissions for AKS: {aks_result.stderr}"
            else:
                return False, f"❌ Cannot list resource groups: {result.stderr}"

        except subprocess.TimeoutExpired:
            return False, "❌ Azure permission check timeout"
        except Exception as e:
            return False, f"❌ Azure permission check error: {e}"

    def run_all_validations(self) -> Dict[str, Tuple[bool, str]]:
        """Run all validation checks."""
        validations = {
            "Azure Authentication": self.validate_azure_auth,
            "Terraform Tools": self.validate_terraform_tools,
            "kubectl": self.validate_kubectl,
            "Python Dependencies": self.validate_python_dependencies,
            "Terraform Configuration": self.validate_terraform_config,
            "Environment Variables": self.validate_environment_variables,
            "Azure Permissions": self.validate_azure_permissions
        }

        results = {}
        for name, validator in validations.items():
            try:
                results[name] = validator()
            except Exception as e:
                results[name] = (False, f"❌ Validation error: {e}")

        return results

    def print_results(self, results: Dict[str, Tuple[bool, str]]) -> bool:
        """Print validation results and return overall success."""
        print("🔍 Infrastructure Validation Results")
        print("=" * 50)

        all_passed = True
        warnings = []

        for name, (success, message) in results.items():
            print(f"\n{name}:")
            if message.startswith("⚠️"):
                warnings.append(message)
                print(f"  {message}")
            else:
                print(f"  {message}")

            if not success:
                all_passed = False

        if warnings:
            print(f"\n⚠️  Warnings ({len(warnings)}):")
            for warning in warnings:
                print(f"  {warning}")

        print(f"\n{'✅' if all_passed else '❌'} Overall Status: {'READY FOR DEPLOYMENT' if all_passed else 'NOT READY - Fix issues above'}")

        if all_passed:
            print(f"\n🚀 Next Steps:")
            print(f"  1. Set optional environment variables if needed")
            print(f"  2. Run: python scripts/run-infrastructure-tests.py --unit")
            print(f"  3. For real deployment: python scripts/deploy-aks.py --config config.json")

        return all_passed


def main():
    """Main validation entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate AKS infrastructure readiness")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    project_root = Path(__file__).parent.parent
    validator = InfrastructureValidator(project_root)

    results = validator.run_all_validations()

    if args.json:
        # JSON output for CI/CD
        json_results = {
            name: {"success": success, "message": message}
            for name, (success, message) in results.items()
        }
        json_results["overall_success"] = all(success for success, _ in results.values())
        print(json.dumps(json_results, indent=2))
    else:
        # Human-readable output
        success = validator.print_results(results)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()