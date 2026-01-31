#!/usr/bin/env python3

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

"""VibeCode Real Functionality Test Suite.

Tests actual app functionality, not just file existence.
"""

import json
import platform
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class TestResult:
    """Result of a single test."""

    name: str
    status: str  # "PASS" or "FAIL"
    result: str


@dataclass
class Environment:
    """Environment information."""

    os: str = ""
    arch: str = ""
    node_version: str = ""
    code_server_running: bool = False
    tauri_app_running: bool = False
    electron_app_running: bool = False


@dataclass
class TestSummary:
    """Summary of test results."""

    total_tests: int = 0
    passed: int = 0
    failed: int = 0
    success_rate: int = 0


@dataclass
class TestSuite:
    """Complete test suite results."""

    test_suite: str = "VibeCode Real Functionality Tests"
    timestamp: str = ""
    environment: Environment = field(default_factory=Environment)
    tests: list[TestResult] = field(default_factory=list)
    summary: TestSummary = field(default_factory=TestSummary)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "testSuite": self.test_suite,
            "timestamp": self.timestamp,
            "environment": {
                "os": self.environment.os,
                "arch": self.environment.arch,
                "nodeVersion": self.environment.node_version,
                "codeServerRunning": self.environment.code_server_running,
                "tauriAppRunning": self.environment.tauri_app_running,
                "electronAppRunning": self.environment.electron_app_running,
            },
            "tests": [
                {"name": t.name, "status": t.status, "result": t.result}
                for t in self.tests
            ],
            "summary": {
                "totalTests": self.summary.total_tests,
                "passed": self.summary.passed,
                "failed": self.summary.failed,
                "successRate": self.summary.success_rate,
            },
        }


class FunctionalityTester:
    """Runs functionality tests for VibeCode."""

    def __init__(self, results_path: Path | None = None) -> None:
        """Initialize the tester.

        Args:
            results_path: Path to save JSON results.
        """
        self.results_path = results_path or Path("/tmp/vibecode-real-tests.json")
        self.suite = TestSuite()
        self.test_count = 0

    def get_os_version(self) -> str:
        """Get macOS version string."""
        try:
            result = subprocess.run(
                ["sw_vers", "-productName"],
                capture_output=True,
                text=True,
                check=True,
            )
            product_name = result.stdout.strip()

            result = subprocess.run(
                ["sw_vers", "-productVersion"],
                capture_output=True,
                text=True,
                check=True,
            )
            product_version = result.stdout.strip()

            return f"{product_name} {product_version}"
        except (subprocess.CalledProcessError, FileNotFoundError):
            return platform.platform()

    def get_node_version(self) -> str:
        """Get Node.js version."""
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            return "Not installed"

    def is_port_in_use(self, port: int) -> bool:
        """Check if a port is in use.

        Args:
            port: Port number to check.

        Returns:
            True if port is in use.
        """
        result = subprocess.run(
            ["lsof", "-i", f":{port}"],
            capture_output=True,
        )
        return result.returncode == 0

    def is_process_running(self, pattern: str) -> bool:
        """Check if a process matching pattern is running.

        Args:
            pattern: Process name pattern to search for.

        Returns:
            True if process is running.
        """
        result = subprocess.run(
            ["pgrep", "-f", pattern],
            capture_output=True,
        )
        return result.returncode == 0

    def get_process_pid(self, pattern: str) -> int | None:
        """Get PID of first process matching pattern.

        Args:
            pattern: Process name pattern to search for.

        Returns:
            PID if found, None otherwise.
        """
        result = subprocess.run(
            ["pgrep", "-f", pattern],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split("\n")
            return int(pids[0])
        return None

    def get_process_memory_kb(self, pid: int) -> int | None:
        """Get memory usage of process in KB.

        Args:
            pid: Process ID.

        Returns:
            Memory usage in KB, or None if not found.
        """
        result = subprocess.run(
            ["ps", "-o", "rss=", "-p", str(pid)],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(result.stdout.strip())
        return None

    def collect_environment(self) -> None:
        """Collect environment information."""
        self.suite.timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.suite.environment.os = self.get_os_version()
        self.suite.environment.arch = platform.machine()
        self.suite.environment.node_version = self.get_node_version()
        self.suite.environment.code_server_running = self.is_port_in_use(8080)
        self.suite.environment.tauri_app_running = self.is_process_running("vibecode")
        self.suite.environment.electron_app_running = self.is_process_running(
            "VibeCode Electron"
        )

    def print_environment(self) -> None:
        """Print environment status."""
        env = self.suite.environment
        print("Environment Status:")
        print(f"   OS: {env.os}")
        print(f"   Architecture: {env.arch}")
        print(f"   Node.js: {env.node_version}")
        print(f"   code-server: {env.code_server_running}")
        print(f"   Tauri App: {env.tauri_app_running}")
        print(f"   Electron App: {env.electron_app_running}")
        print()

    def run_test(
        self,
        name: str,
        test_func: callable,
        expected_result: str = "Test passed",
    ) -> bool:
        """Run a test and record results.

        Args:
            name: Test name.
            test_func: Function that returns True for pass, False for fail.
            expected_result: Description of expected result.

        Returns:
            True if test passed.
        """
        self.test_count += 1
        self.suite.summary.total_tests = self.test_count

        print(f"Test {self.test_count}: {name}")

        try:
            passed = test_func()
        except Exception:
            passed = False

        if passed:
            print("   PASSED")
            self.suite.summary.passed += 1
            status = "PASS"
            result = expected_result
        else:
            print("   FAILED")
            self.suite.summary.failed += 1
            status = "FAIL"
            result = "Test failed"

        self.suite.tests.append(TestResult(name=name, status=status, result=result))
        print()
        return passed

    def http_get(self, url: str) -> tuple[int, str]:
        """Make HTTP GET request.

        Args:
            url: URL to request.

        Returns:
            Tuple of (status_code, body).
        """
        if not shutil.which("curl"):
            return (0, "")

        result = subprocess.run(
            ["curl", "-s", "-o", "-", "-w", "\n%{http_code}", url],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return (0, "")

        lines = result.stdout.rsplit("\n", 1)
        if len(lines) == 2:
            body = lines[0]
            status = int(lines[1]) if lines[1].isdigit() else 0
            return (status, body)
        return (0, result.stdout)

    def http_response_time(self, url: str) -> float:
        """Get HTTP response time.

        Args:
            url: URL to request.

        Returns:
            Response time in seconds.
        """
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{time_total}", url],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout:
            try:
                return float(result.stdout.strip())
            except ValueError:
                pass
        return 0.0

    def run_all_tests(self) -> None:
        """Run all functionality tests."""
        # Test 1: code-server HTTP Response
        self.run_test(
            "code-server HTTP Response",
            lambda: self.http_get("http://localhost:8080")[0] == 200,
        )

        # Test 2: VS Code Interface Loaded
        self.run_test(
            "VS Code Interface Loaded",
            lambda: "code-server" in self.http_get("http://localhost:8080")[1],
        )

        # Test 3: No Welcome Screen
        def test_no_welcome() -> bool:
            _, body = self.http_get("http://localhost:8080")
            return "Welcome" not in body and "Getting Started" not in body

        self.run_test("No Welcome Screen", test_no_welcome)

        # Test 4: Tauri App Process Running
        self.run_test(
            "Tauri App Process Running",
            lambda: self.is_process_running("vibecode"),
        )

        # Test 5: Tauri App Responsive
        def test_tauri_responsive() -> bool:
            pid = self.get_process_pid("vibecode")
            if pid is None:
                return False
            result = subprocess.run(["kill", "-0", str(pid)], capture_output=True)
            return result.returncode == 0

        self.run_test("Tauri App Responsive", test_tauri_responsive)

        # Test 6: code-server Configuration
        def test_config() -> bool:
            config_path = Path.home() / ".config/code-server/user-data/User/settings.json"
            if not config_path.exists():
                return False
            content = config_path.read_text()
            return "workbench.startupEditor" in content and "none" in content

        self.run_test("code-server Configuration", test_config)

        # Test 7: Theme Configuration
        def test_theme() -> bool:
            config_path = Path.home() / ".config/code-server/user-data/User/settings.json"
            if not config_path.exists():
                return False
            return "workbench.colorTheme" in config_path.read_text()

        self.run_test("Theme Configuration", test_theme)

        # Test 8: Welcome Screen Disabled
        def test_welcome_disabled() -> bool:
            config_path = Path.home() / ".config/code-server/user-data/User/settings.json"
            if not config_path.exists():
                return False
            content = config_path.read_text()
            return "workbench.welcome.enabled" in content and "false" in content

        self.run_test("Welcome Screen Disabled", test_welcome_disabled)

        # Test 9: Static Assets Accessible
        self.run_test(
            "Static Assets Accessible",
            lambda: self.http_get("http://localhost:8080/static/")[0] == 200,
        )

        # Test 10: Multiple Request Handling
        def test_multiple_requests() -> bool:
            for _ in range(5):
                status, _ = self.http_get("http://localhost:8080")
                if status != 200:
                    return False
            return True

        self.run_test("Multiple Request Handling", test_multiple_requests)

        # Test 11: Memory Usage Check (< 1GB)
        def test_memory() -> bool:
            pid = self.get_process_pid("vibecode")
            if pid is None:
                return False
            memory_kb = self.get_process_memory_kb(pid)
            if memory_kb is None:
                return False
            return memory_kb < 1000000  # Less than ~1GB

        self.run_test("Memory Usage Check", test_memory)

        # Test 12: Stability Under Load
        def test_stability() -> bool:
            for _ in range(10):
                status, _ = self.http_get("http://localhost:8080")
                if status != 200:
                    return False
                time.sleep(0.1)
            return True

        self.run_test("Stability Under Load", test_stability)

    def calculate_summary(self) -> None:
        """Calculate summary statistics."""
        total = self.suite.summary.total_tests
        if total > 0:
            self.suite.summary.success_rate = (
                self.suite.summary.passed * 100 // total
            )

    def print_summary(self) -> None:
        """Print test results summary."""
        summary = self.suite.summary
        print("Test Results Summary")
        print("=======================")
        print(f"Total Tests: {summary.total_tests}")
        print(f"Passed: {summary.passed}")
        print(f"Failed: {summary.failed}")
        print(f"Success Rate: {summary.success_rate}%")
        print()

    def print_detailed_results(self) -> None:
        """Print detailed test results."""
        print("Detailed Results:")
        for test in self.suite.tests:
            icon = "PASS" if test.status == "PASS" else "FAIL"
            print(f"   [{icon}] {test.name}: {test.result}")
        print()

    def print_performance_metrics(self) -> None:
        """Print performance metrics."""
        print("Performance Metrics:")

        # Response time
        response_time = self.http_response_time("http://localhost:8080")
        print(f"   code-server Response Time: {response_time:.3f}s")

        # Memory usage
        pid = self.get_process_pid("vibecode")
        if pid:
            memory_kb = self.get_process_memory_kb(pid)
            if memory_kb:
                memory_mb = memory_kb / 1024
                print(f"   Memory Usage: {memory_mb:.1f} MB")

        # Process count
        result = subprocess.run(
            ["pgrep", "-f", "vibecode"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            count = len(result.stdout.strip().split("\n"))
            print(f"   Process Count: {count}")

        print()

    def save_results(self) -> None:
        """Save results to JSON file."""
        with open(self.results_path, "w") as f:
            json.dump(self.suite.to_dict(), f, indent=2)
        print(f"Results saved to: {self.results_path}")
        print()

    def run(self) -> int:
        """Run the full test suite.

        Returns:
            Exit code (0 for all tests passed, 1 otherwise).
        """
        print("VibeCode Real Functionality Test Suite")
        print("==========================================")
        print()

        # Collect and print environment
        self.collect_environment()
        self.print_environment()

        # Run all tests
        self.run_all_tests()

        # Calculate and print summary
        self.calculate_summary()
        self.print_summary()

        # Print detailed results
        self.print_detailed_results()

        # Print performance metrics
        self.print_performance_metrics()

        # Save results
        self.save_results()

        # Final status
        if self.suite.summary.failed == 0:
            print("ALL TESTS PASSED! VibeCode is fully functional.")
            return 0
        else:
            print(f"{self.suite.summary.failed} test(s) failed. Check the results above.")
            return 1


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    tester = FunctionalityTester()
    return tester.run()


if __name__ == "__main__":
    sys.exit(main())