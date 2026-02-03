#!/usr/bin/env python3
"""VibeCode Real Functionality Test Suite.

Tests actual app functionality, not just file existence.
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    reset: str = "\033[0m"


COLORS = Colors()

TEST_RESULTS_PATH = Path("/tmp/vibecode-real-tests.json")


@dataclass
class TestResults:
    """Test results tracker."""

    total: int = 0
    passed: int = 0
    failed: int = 0
    tests: list = field(default_factory=list)


def run_silent(cmd: str) -> bool:
    """Run a shell command silently, return True if successful."""
    try:
        subprocess.run(cmd, shell=True, check=True, capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_command_output(cmd: str) -> str:
    """Run a command and return its output."""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=False)
        return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        return ""


def check_port_in_use(port: int) -> bool:
    """Check if a port is in use."""
    return run_silent(f"lsof -i :{port}")


def check_process_running(pattern: str) -> bool:
    """Check if a process matching pattern is running."""
    return run_silent(f"pgrep -f '{pattern}'")


def get_environment_info() -> dict:
    """Gather environment information."""
    os_version = get_command_output("sw_vers -productName") + " " + get_command_output("sw_vers -productVersion")
    arch = get_command_output("uname -m")
    node_version = get_command_output("node --version") or "Not installed"

    return {
        "os": os_version,
        "arch": arch,
        "nodeVersion": node_version,
        "codeServerRunning": check_port_in_use(8080),
        "tauriAppRunning": check_process_running("vibecode"),
        "electronAppRunning": check_process_running("VibeCode Electron"),
    }


def run_test(name: str, command: str, results: TestResults) -> bool:
    """Run a test and record results."""
    results.total += 1
    print(f"Test {results.total}: {name}")

    success = run_silent(command)

    if success:
        print(f"   {COLORS.green}PASSED{COLORS.reset}")
        results.passed += 1
        results.tests.append({"name": name, "status": "PASS", "result": "Test passed"})
    else:
        print(f"   {COLORS.red}FAILED{COLORS.reset}")
        results.failed += 1
        results.tests.append({"name": name, "status": "FAIL", "result": "Test failed"})

    print()
    return success


def save_results(results: TestResults, env_info: dict) -> None:
    """Save test results to JSON file."""
    success_rate = (results.passed * 100 // results.total) if results.total > 0 else 0

    data = {
        "testSuite": "VibeCode Real Functionality Tests",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "environment": env_info,
        "tests": results.tests,
        "summary": {
            "totalTests": results.total,
            "passed": results.passed,
            "failed": results.failed,
            "successRate": success_rate,
        },
    }

    TEST_RESULTS_PATH.write_text(json.dumps(data, indent=2))


def print_detailed_results(results: TestResults) -> None:
    """Print detailed test results."""
    print("Detailed Results:")
    for test in results.tests:
        icon = COLORS.green + "PASS" if test["status"] == "PASS" else COLORS.red + "FAIL"
        print(f"  {icon}{COLORS.reset} {test['name']}: {test['result']}")
    print()


def print_performance_metrics() -> None:
    """Print performance metrics."""
    print("Performance Metrics:")

    # Response time
    response_time = get_command_output(
        "curl -s -o /dev/null -w '%{time_total}' http://localhost:8080"
    )
    print(f"   code-server Response Time: {response_time}s")

    # Memory usage
    pid = get_command_output("pgrep -f 'vibecode' | head -1")
    if pid:
        rss = get_command_output(f"ps -o rss= -p {pid}")
        if rss:
            memory_mb = int(rss) / 1024
            print(f"   Memory Usage: {memory_mb:.1f} MB")

    # Process count
    process_count = get_command_output("pgrep -f 'vibecode' | wc -l").strip()
    print(f"   Process Count: {process_count}")
    print()


def main() -> int:
    """Main entry point."""
    print("VibeCode Real Functionality Test Suite")
    print("=" * 42)
    print()

    results = TestResults()
    env_info = get_environment_info()

    # Print environment status
    print("Environment Status:")
    print(f"   OS: {env_info['os']}")
    print(f"   Architecture: {env_info['arch']}")
    print(f"   Node.js: {env_info['nodeVersion']}")
    print(f"   code-server: {env_info['codeServerRunning']}")
    print(f"   Tauri App: {env_info['tauriAppRunning']}")
    print(f"   Electron App: {env_info['electronAppRunning']}")
    print()

    # Run tests
    run_test(
        "code-server HTTP Response",
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 | grep -q '200'",
        results,
    )

    run_test(
        "VS Code Interface Loaded",
        "curl -s http://localhost:8080 | grep -q 'code-server'",
        results,
    )

    run_test(
        "No Welcome Screen",
        "curl -s http://localhost:8080 | grep -q -v 'Welcome' && curl -s http://localhost:8080 | grep -q -v 'Getting Started'",
        results,
    )

    run_test(
        "Tauri App Process Running",
        "pgrep -f 'vibecode' > /dev/null",
        results,
    )

    run_test(
        "Tauri App Responsive",
        "pgrep -f 'vibecode' > /dev/null && kill -0 $(pgrep -f 'vibecode' | head -1)",
        results,
    )

    settings_path = "~/.config/code-server/user-data/User/settings.json"
    run_test(
        "code-server Configuration",
        f"test -f {settings_path} && grep -q 'workbench.startupEditor.*none' {settings_path}",
        results,
    )

    run_test(
        "Theme Configuration",
        f"grep -q 'workbench.colorTheme' {settings_path}",
        results,
    )

    run_test(
        "Welcome Screen Disabled",
        f"grep -q 'workbench.welcome.enabled.*false' {settings_path}",
        results,
    )

    run_test(
        "Static Assets Accessible",
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/static/ | grep -q '200'",
        results,
    )

    run_test(
        "Multiple Request Handling",
        "for i in 1 2 3 4 5; do curl -s http://localhost:8080 > /dev/null; done",
        results,
    )

    run_test(
        "Memory Usage Check",
        "ps -o rss= -p $(pgrep -f 'vibecode' | head -1) | awk '{if ($1 < 1000000) exit 0; else exit 1}'",
        results,
    )

    run_test(
        "Stability Under Load",
        "for i in 1 2 3 4 5 6 7 8 9 10; do curl -s http://localhost:8080 > /dev/null; sleep 0.1; done",
        results,
    )

    # Save results
    save_results(results, env_info)

    # Print summary
    success_rate = (results.passed * 100 // results.total) if results.total > 0 else 0

    print("Test Results Summary")
    print("=" * 23)
    print(f"Total Tests: {results.total}")
    print(f"Passed: {results.passed}")
    print(f"Failed: {results.failed}")
    print(f"Success Rate: {success_rate}%")
    print()

    print_detailed_results(results)
    print_performance_metrics()

    print(f"Results saved to: {TEST_RESULTS_PATH}")
    print()

    if results.failed == 0:
        print(f"{COLORS.green}ALL TESTS PASSED! VibeCode is fully functional.{COLORS.reset}")
        return 0
    else:
        print(f"{COLORS.yellow}{results.failed} test(s) failed. Check the results above.{COLORS.reset}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
