#!/usr/bin/env python3
"""
Generate consolidated test report from multiple test result sources.
Combines unit, integration, E2E, and security test results into unified report.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional
import xml.etree.ElementTree as ET


class TestReportGenerator:
    """Generate consolidated test reports from multiple sources."""

    def __init__(self):
        self.report = {
            "unit": {"passed": 0, "failed": 0, "skipped": 0},
            "integration": {"passed": 0, "failed": 0, "skipped": 0},
            "e2e": {"passed": 0, "failed": 0, "skipped": 0},
            "security": {"issues": 0, "severity": {}},
            "summary": {}
        }

    def parse_junit_xml(self, xml_path: Path) -> Dict:
        """Parse JUnit XML test results."""
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()

            results = {"passed": 0, "failed": 0, "skipped": 0}

            # Handle both <testsuite> and <testsuites> root elements
            testsuites = root.findall('.//testsuite')
            if not testsuites:
                testsuites = [root] if root.tag == 'testsuite' else []

            for testsuite in testsuites:
                results["passed"] += int(testsuite.get("tests", 0)) - \
                                   int(testsuite.get("failures", 0)) - \
                                   int(testsuite.get("errors", 0)) - \
                                   int(testsuite.get("skipped", 0))
                results["failed"] += int(testsuite.get("failures", 0)) + \
                                   int(testsuite.get("errors", 0))
                results["skipped"] += int(testsuite.get("skipped", 0))

            return results

        except Exception as e:
            print(f"⚠️  Warning: Failed to parse {xml_path}: {e}", file=sys.stderr)
            return {"passed": 0, "failed": 0, "skipped": 0}

    def parse_pytest_json(self, json_path: Path) -> Dict:
        """Parse pytest JSON report."""
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)

            results = {"passed": 0, "failed": 0, "skipped": 0}

            if "summary" in data:
                results["passed"] = data["summary"].get("passed", 0)
                results["failed"] = data["summary"].get("failed", 0)
                results["skipped"] = data["summary"].get("skipped", 0)

            return results

        except Exception as e:
            print(f"⚠️  Warning: Failed to parse {json_path}: {e}", file=sys.stderr)
            return {"passed": 0, "failed": 0, "skipped": 0}

    def parse_security_sarif(self, sarif_path: Path) -> Dict:
        """Parse security scan SARIF results."""
        try:
            with open(sarif_path, 'r') as f:
                data = json.load(f)

            issues = 0
            severity = {"error": 0, "warning": 0, "note": 0}

            for run in data.get("runs", []):
                for result in run.get("results", []):
                    issues += 1
                    level = result.get("level", "warning")
                    severity[level] = severity.get(level, 0) + 1

            return {"issues": issues, "severity": severity}

        except Exception as e:
            print(f"⚠️  Warning: Failed to parse {sarif_path}: {e}", file=sys.stderr)
            return {"issues": 0, "severity": {}}

    def process_test_results(self, results_dir: Path, test_type: str):
        """Process test results from a directory."""
        if not results_dir or not results_dir.exists():
            print(f"⚠️  No results found for {test_type} in {results_dir}")
            return

        # Look for various test result formats
        for xml_file in results_dir.glob("**/*.xml"):
            if "coverage" not in xml_file.name:
                results = self.parse_junit_xml(xml_file)
                self.report[test_type]["passed"] += results["passed"]
                self.report[test_type]["failed"] += results["failed"]
                self.report[test_type]["skipped"] += results["skipped"]

        for json_file in results_dir.glob("**/*.json"):
            results = self.parse_pytest_json(json_file)
            self.report[test_type]["passed"] += results["passed"]
            self.report[test_type]["failed"] += results["failed"]
            self.report[test_type]["skipped"] += results["skipped"]

    def process_security_results(self, results_dir: Path):
        """Process security scan results."""
        if not results_dir or not results_dir.exists():
            print(f"⚠️  No security results found in {results_dir}")
            return

        for sarif_file in results_dir.glob("**/*.sarif"):
            results = self.parse_security_sarif(sarif_file)
            self.report["security"]["issues"] += results["issues"]

            for level, count in results["severity"].items():
                self.report["security"]["severity"][level] = \
                    self.report["security"]["severity"].get(level, 0) + count

    def calculate_summary(self):
        """Calculate overall test summary."""
        total_tests = 0
        total_passed = 0
        total_failed = 0
        total_skipped = 0

        for test_type in ["unit", "integration", "e2e"]:
            total_tests += sum(self.report[test_type].values())
            total_passed += self.report[test_type]["passed"]
            total_failed += self.report[test_type]["failed"]
            total_skipped += self.report[test_type]["skipped"]

        success_rate = round((total_passed / total_tests * 100), 2) if total_tests > 0 else 0

        self.report["summary"] = {
            "total": total_tests,
            "passed": total_passed,
            "failed": total_failed,
            "skipped": total_skipped,
            "success_rate": success_rate,
            "security_issues": self.report["security"]["issues"]
        }

    def generate_report(self, output_file: Path):
        """Generate and save the consolidated report."""
        self.calculate_summary()

        with open(output_file, 'w') as f:
            json.dump(self.report, f, indent=2)

        print(f"✅ Generated consolidated report: {output_file}")
        return self.report

    def print_summary(self):
        """Print test summary to console."""
        print("\n" + "="*60)
        print("📊 CONSOLIDATED TEST REPORT")
        print("="*60)

        for test_type in ["unit", "integration", "e2e"]:
            results = self.report[test_type]
            total = sum(results.values())
            if total > 0:
                status = "✅" if results["failed"] == 0 else "❌"
                print(f"{status} {test_type.upper()}: "
                      f"{results['passed']}/{total} passed - "
                      f"{results['failed']} failed, {results['skipped']} skipped")

        if self.report["security"]["issues"] > 0:
            print(f"\n⚠️  SECURITY: {self.report['security']['issues']} issues found")
            for level, count in self.report["security"]["severity"].items():
                print(f"   - {level}: {count}")

        summary = self.report["summary"]
        print(f"\n{'✅' if summary['failed'] == 0 else '❌'} OVERALL: "
              f"{summary['passed']}/{summary['total']} passed "
              f"({summary['success_rate']}%)")
        print("="*60)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate consolidated test report"
    )

    parser.add_argument("--unit-results", type=Path,
                       help="Path to unit test results directory")
    parser.add_argument("--integration-results", type=Path,
                       help="Path to integration test results directory")
    parser.add_argument("--e2e-results", type=Path,
                       help="Path to E2E test results directory")
    parser.add_argument("--security-results", type=Path,
                       help="Path to security scan results directory")
    parser.add_argument("--output", type=Path, required=True,
                       help="Output file path for consolidated report")

    args = parser.parse_args()

    generator = TestReportGenerator()

    # Process test results
    if args.unit_results:
        generator.process_test_results(args.unit_results, "unit")

    if args.integration_results:
        generator.process_test_results(args.integration_results, "integration")

    if args.e2e_results:
        generator.process_test_results(args.e2e_results, "e2e")

    if args.security_results:
        generator.process_security_results(args.security_results)

    # Generate report
    generator.generate_report(args.output)
    generator.print_summary()

    # Exit with error code if tests failed
    sys.exit(1 if generator.report["summary"]["failed"] > 0 else 0)


if __name__ == "__main__":
    main()
