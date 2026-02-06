#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "run-infrastructure-tests"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Test runner for AKS infrastructure tests.
Orchestrates unit, integration, and E2E tests with proper environment setup.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")

import argparse
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from typing import Dict, Optional
import time


class InfrastructureTestRunner:
    """Test runner for infrastructure testing pipeline."""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.tests_dir = project_root / "tests"
        self.scripts_dir = project_root / "scripts"
        self.tofu_dir = project_root / "tofu"

        self.test_results = {
            "unit": {"passed": 0, "failed": 0, "skipped": 0},
            "integration": {"passed": 0, "failed": 0, "skipped": 0},
            "e2e": {"passed": 0, "failed": 0, "skipped": 0}
        }

    def validate_environment(self) -> bool:
        """Validate test environment prerequisites."""
        print("🔍 Validating test environment...")

        # Check required directories
        required_dirs = [self.tests_dir, self.tofu_dir, self.scripts_dir]
        for directory in required_dirs:
            if not directory.exists():
                print(f"❌ Required directory missing: {directory}")
                return False

        # Check for Azure CLI
        try:
            result = subprocess.run(["az", "--version"], capture_output=True)
            if result.returncode != 0:
                print("❌ Azure CLI not found or not working")
                return False
        except FileNotFoundError:
            print("❌ Azure CLI not installed")
            return False

        # Check for kubectl
        try:
            result = subprocess.run(["kubectl", "version", "--client"], capture_output=True)
            if result.returncode != 0:
                print("❌ kubectl not found or not working")
                return False
        except FileNotFoundError:
            print("❌ kubectl not installed")
            return False

        # Check for tofu or terraform
        has_tofu = subprocess.run(["tofu", "version"], capture_output=True).returncode == 0
        has_terraform = subprocess.run(["terraform", "version"], capture_output=True).returncode == 0

        if not (has_tofu or has_terraform):
            print("❌ Neither tofu nor terraform found")
            return False

        print("✅ Environment validation passed")
        return True

    def run_unit_tests(self) -> bool:
        """Run unit tests for Terraform configurations."""
        print("\n🧪 Running unit tests...")

        unit_test_dir = self.tests_dir / "tofu"
        if not unit_test_dir.exists():
            print("⚠️  No unit test directory found, skipping")
            return True

        # Discover and run unit tests
        loader = unittest.TestLoader()
        suite = loader.discover(str(unit_test_dir), pattern="test_*.py")

        if suite.countTestCases() == 0:
            print("⚠️  No unit tests found")
            return True

        # Run tests with custom result handler
        runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
        result = runner.run(suite)

        self.test_results["unit"]["passed"] = result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)
        self.test_results["unit"]["failed"] = len(result.failures) + len(result.errors)
        self.test_results["unit"]["skipped"] = len(result.skipped)

        success = len(result.failures) == 0 and len(result.errors) == 0
        print(f"{'✅' if success else '❌'} Unit tests: {result.testsRun} total, "
              f"{self.test_results['unit']['passed']} passed, "
              f"{self.test_results['unit']['failed']} failed, "
              f"{self.test_results['unit']['skipped']} skipped")

        return success

    def run_integration_tests(self, enable_deployment: bool = False) -> bool:
        """Run integration tests for deployment scripts."""
        print("\n🔧 Running integration tests...")

        integration_test_dir = self.tests_dir / "integration"
        if not integration_test_dir.exists():
            print("⚠️  No integration test directory found, skipping")
            return True

        # Set environment for integration tests
        test_env = os.environ.copy()
        if enable_deployment:
            test_env["ENABLE_REAL_DEPLOYMENT"] = "true"

        # Run integration tests
        try:
            result = subprocess.run(
                [sys.executable, "-m", "unittest", "discover", "-s", str(integration_test_dir), "-p", "test_*.py", "-v"],
                env=test_env,
                capture_output=True,
                text=True
            )

            # Parse results from output
            lines = result.stderr.split('\n')
            test_lines = [line for line in lines if 'test_' in line and '...' in line]

            passed = len([line for line in test_lines if 'ok' in line])
            failed = len([line for line in test_lines if 'FAIL' in line or 'ERROR' in line])
            skipped = len([line for line in test_lines if 'skipped' in line])

            self.test_results["integration"]["passed"] = passed
            self.test_results["integration"]["failed"] = failed
            self.test_results["integration"]["skipped"] = skipped

            success = result.returncode == 0
            print(f"{'✅' if success else '❌'} Integration tests: "
                  f"{passed} passed, {failed} failed, {skipped} skipped")

            if not success:
                print(f"Integration test output:\n{result.stdout}")
                print(f"Integration test errors:\n{result.stderr}")

            return success

        except Exception as e:
            print(f"❌ Failed to run integration tests: {e}")
            return False

    def run_e2e_tests(self, enable_deployment: bool = False, cleanup: bool = True) -> bool:
        """Run end-to-end deployment tests."""
        print("\n🚀 Running E2E tests...")

        e2e_test_dir = self.tests_dir / "e2e"
        if not e2e_test_dir.exists():
            print("⚠️  No E2E test directory found, skipping")
            return True

        # Check for required environment variables for E2E tests
        required_env_vars = ["DATADOG_API_KEY", "DATADOG_APP_KEY"]
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]

        if missing_vars and enable_deployment:
            print(f"⚠️  Missing required environment variables for E2E tests: {', '.join(missing_vars)}")
            print("E2E deployment tests will be skipped")
            enable_deployment = False

        # Set environment for E2E tests
        test_env = os.environ.copy()
        test_env["ENABLE_AKS_E2E_TESTS"] = "true"

        if enable_deployment:
            test_env["ENABLE_REAL_DEPLOYMENT"] = "true"

        if not cleanup:
            test_env["AKS_TEST_CLEANUP"] = "false"

        # Run E2E tests
        try:
            e2e_script = e2e_test_dir / "test_aks_e2e_deployment.py"
            if not e2e_script.exists():
                print("⚠️  E2E test script not found, skipping")
                return True

            result = subprocess.run(
                [sys.executable, str(e2e_script)],
                env=test_env,
                capture_output=True,
                text=True,
                cwd=str(e2e_test_dir)
            )

            # Parse results
            output_lines = result.stderr.split('\n')
            test_lines = [line for line in output_lines if 'test_' in line and '...' in line]

            passed = len([line for line in test_lines if 'ok' in line])
            failed = len([line for line in test_lines if 'FAIL' in line or 'ERROR' in line])
            skipped = len([line for line in test_lines if 'skipped' in line])

            self.test_results["e2e"]["passed"] = passed
            self.test_results["e2e"]["failed"] = failed
            self.test_results["e2e"]["skipped"] = skipped

            success = result.returncode == 0
            print(f"{'✅' if success else '❌'} E2E tests: "
                  f"{passed} passed, {failed} failed, {skipped} skipped")

            if not success:
                print(f"E2E test output:\n{result.stdout}")
                print(f"E2E test errors:\n{result.stderr}")

            return success

        except Exception as e:
            print(f"❌ Failed to run E2E tests: {e}")
            return False

    def generate_test_report(self, output_file: Optional[Path] = None) -> Dict:
        """Generate comprehensive test report."""
        total_passed = sum(result["passed"] for result in self.test_results.values())
        total_failed = sum(result["failed"] for result in self.test_results.values())
        total_skipped = sum(result["skipped"] for result in self.test_results.values())
        total_tests = total_passed + total_failed + total_skipped

        report = {
            "summary": {
                "total_tests": total_tests,
                "passed": total_passed,
                "failed": total_failed,
                "skipped": total_skipped,
                "success_rate": round((total_passed / total_tests * 100) if total_tests > 0 else 0, 2)
            },
            "details": self.test_results,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        if output_file:
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)

        return report

    def print_summary(self):
        """Print test execution summary."""
        print("\n" + "="*60)
        print("📊 TEST EXECUTION SUMMARY")
        print("="*60)

        for test_type, results in self.test_results.items():
            total = results["passed"] + results["failed"] + results["skipped"]
            if total > 0:
                success_rate = round((results["passed"] / total * 100), 1)
                status = "✅" if results["failed"] == 0 else "❌"
                print(f"{status} {test_type.upper()}: {results['passed']}/{total} passed "
                      f"({success_rate}%) - {results['failed']} failed, {results['skipped']} skipped")

        total_passed = sum(result["passed"] for result in self.test_results.values())
        total_failed = sum(result["failed"] for result in self.test_results.values())
        total_skipped = sum(result["skipped"] for result in self.test_results.values())
        total_tests = total_passed + total_failed + total_skipped

        if total_tests > 0:
            overall_success_rate = round((total_passed / total_tests * 100), 1)
            overall_status = "✅" if total_failed == 0 else "❌"
            print(f"\n{overall_status} OVERALL: {total_passed}/{total_tests} passed "
                  f"({overall_success_rate}%) - {total_failed} failed, {total_skipped} skipped")
        else:
            print("\n⚠️  No tests were executed")

        print("="*60)


def main():
    """Main test runner entry point."""
    parser = argparse.ArgumentParser(description="Run AKS infrastructure tests")

    parser.add_argument("--unit", action="store_true",
                       help="Run unit tests only")
    parser.add_argument("--integration", action="store_true",
                       help="Run integration tests only")
    parser.add_argument("--e2e", action="store_true",
                       help="Run E2E tests only")
    parser.add_argument("--all", action="store_true", default=True,
                       help="Run all test types (default)")

    parser.add_argument("--enable-deployment", action="store_true",
                       help="Enable real Azure deployment in tests")
    parser.add_argument("--no-cleanup", action="store_true",
                       help="Don't clean up resources after E2E tests")

    parser.add_argument("--report", type=str,
                       help="Generate JSON test report to specified file")

    args = parser.parse_args()

    # Determine which tests to run
    run_unit = args.unit or args.all
    run_integration = args.integration or args.all
    run_e2e = args.e2e or args.all

    # If specific test types are selected, don't run all
    if args.unit or args.integration or args.e2e:
        run_unit = args.unit
        run_integration = args.integration
        run_e2e = args.e2e

    project_root = Path(__file__).parent.parent
    runner = InfrastructureTestRunner(project_root)

    print("🏗️  AKS Infrastructure Test Runner")
    print("="*50)

    # Validate environment
    if not runner.validate_environment():
        print("❌ Environment validation failed")
        sys.exit(1)

    # Run tests
    all_passed = True

    if run_unit:
        if not runner.run_unit_tests():
            all_passed = False

    if run_integration:
        if not runner.run_integration_tests(enable_deployment=args.enable_deployment):
            all_passed = False

    if run_e2e:
        if not runner.run_e2e_tests(enable_deployment=args.enable_deployment,
                                   cleanup=not args.no_cleanup):
            all_passed = False

    # Generate report
    report_file = Path(args.report) if args.report else None
    runner.generate_test_report(report_file)

    # Print summary
    runner.print_summary()

    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()