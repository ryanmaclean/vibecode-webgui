#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Test Runner Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system for running tests and tracking coverage:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_test_runner.py "run all tests with coverage"
    python scripts/agents/level3_test_runner.py --python-only
    python scripts/agents/level3_test_runner.py --coverage-threshold 80
    python scripts/agents/level3_test_runner.py --node-only
    python scripts/agents/level3_test_runner.py --shell-only
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# Datadog Unified Service Tagging (self-instrumented)
try:
    from ddtrace import config, patch_all, tracer
    config.service = os.environ.get("DD_SERVICE", "level3-test-runner")
    config.env = os.environ.get("DD_ENV", "development")
    config.version = os.environ.get("DD_VERSION", "3.0.0")
    tracer.set_tags({
        "team": "platform",
        "component": "autonomous-agent",
        "agent_level": "3",
    })
    patch_all()
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    tracer = None


class AgentState(Enum):
    """Agent execution states."""
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    REFLECTING = "reflecting"
    ADAPTING = "adapting"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionType(Enum):
    """Available agent actions."""
    DISCOVER = "discover"
    RUN_PYTHON = "run_python"
    RUN_NODE = "run_node"
    RUN_SHELL = "run_shell"
    MEASURE_COVERAGE = "measure_coverage"
    IDENTIFY_GAPS = "identify_gaps"
    SUGGEST_TESTS = "suggest_tests"
    REPORT = "report"


@dataclass
class Action:
    """A single action in the execution plan."""
    type: ActionType
    description: str
    params: dict = field(default_factory=dict)
    result: Optional[dict] = None
    success: bool = False
    error: Optional[str] = None


@dataclass
class Plan:
    """Execution plan with actions."""
    intent: str
    actions: list[Action] = field(default_factory=list)
    created_at: str = ""
    iteration: int = 1

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class Reflection:
    """Reflection on execution results."""
    success: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    should_retry: bool = False
    new_actions: list[Action] = field(default_factory=list)


@dataclass
class GovernanceCheck:
    """Safety and compliance check."""
    passed: bool
    violations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class TestResult:
    """Individual test result."""
    name: str
    passed: bool
    duration_ms: float
    error: Optional[str] = None
    file_path: Optional[str] = None


@dataclass
class CoverageData:
    """Coverage measurement data."""
    total_lines: int = 0
    covered_lines: int = 0
    percent: float = 0.0
    uncovered_files: list[str] = field(default_factory=list)
    file_coverage: dict[str, float] = field(default_factory=dict)


class Level3TestRunner:
    """
    Level 3 Autonomous Agent for Test Execution and Coverage.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 3
    COVERAGE_THRESHOLD = 70.0  # Minimum coverage percentage
    FAIL_ON_ERROR = True

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        coverage_threshold: float = 70.0,
        python_only: bool = False,
        node_only: bool = False,
        shell_only: bool = False,
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.COVERAGE_THRESHOLD = coverage_threshold
        self.python_only = python_only
        self.node_only = node_only
        self.shell_only = shell_only
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []

        # Aggregated results
        self.test_results: list[TestResult] = []
        self.coverage_data = CoverageData()
        self.discovered_tests: dict[str, list[Path]] = {
            "python": [],
            "node": [],
            "shell": [],
            "go": [],
        }

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.utcnow().isoformat()
        entry = {"timestamp": timestamp, "level": level, "message": message, "state": self.state.value}
        self.execution_log.append(entry)

        if self.verbose:
            print(f"[{level}] [{self.state.value}] {message}")

        if DDTRACE_AVAILABLE and tracer:
            span = tracer.current_span()
            if span:
                span.set_tag(f"agent.log.{len(self.execution_log)}", message[:100])

    # ==================== PLANNING ====================

    def plan(self, intent: str) -> Plan:
        """
        PLAN PHASE: Analyze intent and create execution plan.

        This is where Level 3 autonomy begins - the agent decides
        what actions to take based on the given intent.
        """
        self.state = AgentState.PLANNING
        self.log(f"Planning for intent: {intent}")

        plan = Plan(intent=intent)
        intent_lower = intent.lower()

        # Determine which test types to run
        run_python = not self.node_only and not self.shell_only
        run_node = not self.python_only and not self.shell_only
        run_shell = not self.python_only and not self.node_only

        # Override based on intent
        if "python" in intent_lower:
            run_python, run_node, run_shell = True, False, False
        elif "node" in intent_lower or "javascript" in intent_lower or "typescript" in intent_lower:
            run_python, run_node, run_shell = False, True, False
        elif "shell" in intent_lower or "bats" in intent_lower or "bash" in intent_lower:
            run_python, run_node, run_shell = False, False, True

        # Always start with discovery
        plan.actions.append(
            Action(ActionType.DISCOVER, "Discover all test files")
        )

        # Add test execution actions based on intent
        if any(word in intent_lower for word in ["run", "execute", "test", "all"]):
            if run_python:
                plan.actions.append(
                    Action(ActionType.RUN_PYTHON, "Run pytest with coverage")
                )
            if run_node:
                plan.actions.append(
                    Action(ActionType.RUN_NODE, "Run jest/vitest with coverage")
                )
            if run_shell:
                plan.actions.append(
                    Action(ActionType.RUN_SHELL, "Run bats tests for shell scripts")
                )

        # Coverage-related actions
        if any(word in intent_lower for word in ["coverage", "measure", "analyze"]):
            plan.actions.append(
                Action(ActionType.MEASURE_COVERAGE, "Calculate coverage percentages")
            )
            plan.actions.append(
                Action(ActionType.IDENTIFY_GAPS, "Find untested critical paths")
            )

        # Suggestion actions
        if any(word in intent_lower for word in ["suggest", "recommend", "improve"]):
            plan.actions.append(
                Action(ActionType.SUGGEST_TESTS, "Recommend tests for uncovered code")
            )

        # Always end with report
        plan.actions.append(
            Action(ActionType.REPORT, "Generate test report")
        )

        self.log(f"Created plan with {len(plan.actions)} actions")
        return plan

    # ==================== EXECUTION ====================

    def execute(self, plan: Plan) -> Plan:
        """
        EXECUTE PHASE: Run all actions in the plan.

        Each action is executed with error handling and results tracking.
        """
        self.state = AgentState.EXECUTING
        self.log(f"Executing plan iteration {plan.iteration}")

        for i, action in enumerate(plan.actions):
            self.log(f"Action {i+1}/{len(plan.actions)}: {action.type.value} - {action.description}")

            try:
                result = self._execute_action(action)
                action.result = result
                action.success = result.get("success", False)

                if not action.success:
                    action.error = result.get("error", "Unknown error")
                    self.log(f"Action failed: {action.error}", "WARN")

            except Exception as e:
                action.success = False
                action.error = str(e)
                self.log(f"Action exception: {e}", "ERROR")

        return plan

    def _execute_action(self, action: Action) -> dict:
        """Execute a single action and return results."""

        if action.type == ActionType.DISCOVER:
            return self._action_discover()

        elif action.type == ActionType.RUN_PYTHON:
            return self._action_run_python()

        elif action.type == ActionType.RUN_NODE:
            return self._action_run_node()

        elif action.type == ActionType.RUN_SHELL:
            return self._action_run_shell()

        elif action.type == ActionType.MEASURE_COVERAGE:
            return self._action_measure_coverage()

        elif action.type == ActionType.IDENTIFY_GAPS:
            return self._action_identify_gaps()

        elif action.type == ActionType.SUGGEST_TESTS:
            return self._action_suggest_tests()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_discover(self) -> dict:
        """Discover all test files by type."""
        # Python tests: test_*.py
        python_tests = list(self.root_dir.rglob("test_*.py"))
        # Also check for *_test.py pattern
        python_tests.extend(self.root_dir.rglob("*_test.py"))
        # Filter out duplicates and __pycache__
        python_tests = [
            p for p in set(python_tests)
            if "__pycache__" not in str(p) and ".venv" not in str(p)
        ]
        self.discovered_tests["python"] = python_tests

        # Node.js tests: *.test.ts, *.test.js, *.spec.ts, *.spec.js
        node_tests = []
        for pattern in ["*.test.ts", "*.test.js", "*.spec.ts", "*.spec.js"]:
            node_tests.extend(self.root_dir.rglob(pattern))
        # Filter node_modules
        node_tests = [
            p for p in set(node_tests)
            if "node_modules" not in str(p)
        ]
        self.discovered_tests["node"] = node_tests

        # Shell tests: *.bats
        shell_tests = list(self.root_dir.rglob("*.bats"))
        self.discovered_tests["shell"] = shell_tests

        # Go tests: *_test.go
        go_tests = list(self.root_dir.rglob("*_test.go"))
        self.discovered_tests["go"] = go_tests

        total = sum(len(tests) for tests in self.discovered_tests.values())

        return {
            "success": True,
            "total": total,
            "python": len(python_tests),
            "node": len(node_tests),
            "shell": len(shell_tests),
            "go": len(go_tests),
        }

    def _action_run_python(self) -> dict:
        """Run pytest with coverage."""
        if not self.discovered_tests["python"]:
            return {"success": True, "skipped": True, "reason": "No Python tests found"}

        # Check if pytest is available
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "--version"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return {"success": False, "error": "pytest not installed"}

        # Check for pytest-cov
        has_cov = subprocess.run(
            [sys.executable, "-c", "import pytest_cov"],
            capture_output=True,
            text=True
        ).returncode == 0

        # Build pytest command
        cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short"]
        if has_cov:
            cmd.extend(["--cov=.", "--cov-report=json", "--cov-report=term-missing"])

        # Run pytest
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.root_dir,
                timeout=300
            )
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "pytest timed out after 300s"}

        # Parse results
        passed = failed = skipped = 0
        duration_ms = 0.0

        # Parse pytest output
        for line in result.stdout.split("\n"):
            # Match summary line: "=== X passed, Y failed, Z skipped in N.NNs ==="
            match = re.search(r"(\d+) passed", line)
            if match:
                passed = int(match.group(1))
            match = re.search(r"(\d+) failed", line)
            if match:
                failed = int(match.group(1))
            match = re.search(r"(\d+) skipped", line)
            if match:
                skipped = int(match.group(1))
            match = re.search(r"in ([\d.]+)s", line)
            if match:
                duration_ms = float(match.group(1)) * 1000

        # Load coverage data if available
        cov_file = self.root_dir / "coverage.json"
        if cov_file.exists():
            try:
                cov_data = json.loads(cov_file.read_text())
                self.coverage_data.percent = cov_data.get("totals", {}).get("percent_covered", 0.0)
                self.coverage_data.total_lines = cov_data.get("totals", {}).get("num_statements", 0)
                self.coverage_data.covered_lines = cov_data.get("totals", {}).get("covered_lines", 0)
                # Track file coverage
                for file_path, file_data in cov_data.get("files", {}).items():
                    self.coverage_data.file_coverage[file_path] = file_data.get("summary", {}).get("percent_covered", 0.0)
            except (json.JSONDecodeError, KeyError):
                pass

        return {
            "success": result.returncode == 0 or failed == 0,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "duration_ms": duration_ms,
            "coverage_percent": self.coverage_data.percent,
            "stdout": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
            "stderr": result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr,
        }

    def _action_run_node(self) -> dict:
        """Run jest/vitest with coverage."""
        if not self.discovered_tests["node"]:
            return {"success": True, "skipped": True, "reason": "No Node.js tests found"}

        # Check for package.json and test script
        package_json = self.root_dir / "package.json"
        if not package_json.exists():
            return {"success": False, "error": "No package.json found"}

        try:
            pkg = json.loads(package_json.read_text())
            scripts = pkg.get("scripts", {})
        except (json.JSONDecodeError, KeyError):
            return {"success": False, "error": "Failed to parse package.json"}

        # Determine test command
        if "test:coverage" in scripts:
            cmd = ["npm", "run", "test:coverage"]
        elif "test" in scripts:
            cmd = ["npm", "test", "--", "--coverage"]
        else:
            # Try running jest directly
            cmd = ["npx", "jest", "--coverage", "--json"]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.root_dir,
                timeout=300
            )
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Node tests timed out after 300s"}
        except FileNotFoundError:
            return {"success": False, "error": "npm/npx not found"}

        # Parse results
        passed = failed = skipped = 0
        coverage_percent = 0.0

        # Try to parse jest JSON output
        try:
            # Jest outputs JSON when using --json flag
            json_match = re.search(r'\{.*"numPassedTests".*\}', result.stdout, re.DOTALL)
            if json_match:
                jest_data = json.loads(json_match.group())
                passed = jest_data.get("numPassedTests", 0)
                failed = jest_data.get("numFailedTests", 0)
                skipped = jest_data.get("numPendingTests", 0)
        except (json.JSONDecodeError, AttributeError):
            # Fallback: parse text output
            for line in result.stdout.split("\n"):
                match = re.search(r"Tests:\s+(\d+) passed", line)
                if match:
                    passed = int(match.group(1))
                match = re.search(r"(\d+) failed", line)
                if match:
                    failed = int(match.group(1))

        # Parse coverage from output
        for line in result.stdout.split("\n"):
            if "All files" in line and "%" in line:
                match = re.search(r"(\d+\.?\d*)\s*%", line)
                if match:
                    coverage_percent = float(match.group(1))
                    break

        return {
            "success": result.returncode == 0 or failed == 0,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "coverage_percent": coverage_percent,
            "stdout": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
            "stderr": result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr,
        }

    def _action_run_shell(self) -> dict:
        """Run bats tests for shell scripts."""
        if not self.discovered_tests["shell"]:
            return {"success": True, "skipped": True, "reason": "No shell tests found"}

        # Check if bats is available
        result = subprocess.run(
            ["which", "bats"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return {"success": False, "error": "bats not installed"}

        passed = failed = 0
        all_output = []

        for test_file in self.discovered_tests["shell"]:
            try:
                result = subprocess.run(
                    ["bats", str(test_file)],
                    capture_output=True,
                    text=True,
                    cwd=self.root_dir,
                    timeout=120
                )
                all_output.append(result.stdout)

                # Parse bats output
                for line in result.stdout.split("\n"):
                    if line.startswith("ok "):
                        passed += 1
                    elif line.startswith("not ok "):
                        failed += 1

            except subprocess.TimeoutExpired:
                failed += 1
                all_output.append(f"TIMEOUT: {test_file}")
            except Exception as e:
                failed += 1
                all_output.append(f"ERROR: {test_file}: {e}")

        return {
            "success": failed == 0,
            "passed": passed,
            "failed": failed,
            "skipped": 0,
            "stdout": "\n".join(all_output)[-2000:],
        }

    def _action_measure_coverage(self) -> dict:
        """Calculate coverage percentages from all sources."""
        # Aggregate coverage from Python and Node runs
        total_coverage = self.coverage_data.percent

        # Read coverage files if they exist
        coverage_sources = []

        # Python coverage
        py_cov = self.root_dir / "coverage.json"
        if py_cov.exists():
            try:
                data = json.loads(py_cov.read_text())
                py_percent = data.get("totals", {}).get("percent_covered", 0.0)
                coverage_sources.append(("python", py_percent))
            except (json.JSONDecodeError, KeyError):
                pass

        # Node.js coverage (Istanbul format)
        node_cov = self.root_dir / "coverage" / "coverage-summary.json"
        if node_cov.exists():
            try:
                data = json.loads(node_cov.read_text())
                node_percent = data.get("total", {}).get("lines", {}).get("pct", 0.0)
                coverage_sources.append(("node", node_percent))
            except (json.JSONDecodeError, KeyError):
                pass

        # Calculate weighted average if multiple sources
        if coverage_sources:
            total_coverage = sum(pct for _, pct in coverage_sources) / len(coverage_sources)

        self.coverage_data.percent = total_coverage
        meets_threshold = total_coverage >= self.COVERAGE_THRESHOLD

        return {
            "success": True,
            "coverage_percent": round(total_coverage, 2),
            "threshold": self.COVERAGE_THRESHOLD,
            "meets_threshold": meets_threshold,
            "sources": coverage_sources,
        }

    def _action_identify_gaps(self) -> dict:
        """Find untested critical paths."""
        uncovered = []
        critical_paths = [
            "src/lib",
            "src/app/api",
            "scripts/lib",
            "scripts/agents",
        ]

        for critical_path in critical_paths:
            path = self.root_dir / critical_path
            if not path.exists():
                continue

            # Find Python files without tests
            for py_file in path.rglob("*.py"):
                if "__pycache__" in str(py_file):
                    continue
                if py_file.name.startswith("test_"):
                    continue

                # Check if there's a corresponding test
                test_name = f"test_{py_file.stem}.py"
                has_test = any(
                    t.name == test_name
                    for t in self.discovered_tests["python"]
                )
                if not has_test:
                    uncovered.append(str(py_file.relative_to(self.root_dir)))

            # Find TypeScript files without tests
            for ts_file in path.rglob("*.ts"):
                if "node_modules" in str(ts_file):
                    continue
                if ts_file.name.endswith(".test.ts") or ts_file.name.endswith(".spec.ts"):
                    continue

                # Check for corresponding test
                test_patterns = [
                    ts_file.stem + ".test.ts",
                    ts_file.stem + ".spec.ts",
                ]
                has_test = any(
                    t.name in test_patterns
                    for t in self.discovered_tests["node"]
                )
                if not has_test:
                    uncovered.append(str(ts_file.relative_to(self.root_dir)))

        self.coverage_data.uncovered_files = uncovered[:50]  # Limit to 50

        return {
            "success": True,
            "uncovered_count": len(uncovered),
            "uncovered_files": uncovered[:20],  # Show first 20
            "critical_paths_checked": critical_paths,
        }

    def _action_suggest_tests(self) -> dict:
        """Recommend tests for uncovered code."""
        suggestions = []

        for file_path in self.coverage_data.uncovered_files[:10]:
            path = Path(file_path)

            if path.suffix == ".py":
                test_path = f"tests/unit/{path.stem}/test_{path.name}"
                suggestions.append({
                    "file": file_path,
                    "suggested_test": test_path,
                    "framework": "pytest",
                    "priority": "high" if "lib" in file_path else "medium",
                })

            elif path.suffix in [".ts", ".tsx"]:
                test_path = str(path).replace(".ts", ".test.ts").replace(".tsx", ".test.tsx")
                suggestions.append({
                    "file": file_path,
                    "suggested_test": test_path,
                    "framework": "jest/vitest",
                    "priority": "high" if "api" in file_path else "medium",
                })

            elif path.suffix == ".sh":
                test_path = f"tests/scripts/{path.stem}.bats"
                suggestions.append({
                    "file": file_path,
                    "suggested_test": test_path,
                    "framework": "bats",
                    "priority": "medium",
                })

        return {
            "success": True,
            "suggestions": suggestions,
            "total_suggestions": len(suggestions),
        }

    def _action_report(self) -> dict:
        """Generate comprehensive test report."""
        # Aggregate all test results
        total_passed = sum(
            action.result.get("passed", 0)
            for action in self.execution_log
            if isinstance(action, dict) and "passed" in action
        )

        # Build report from action results
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage_percent": round(self.coverage_data.percent, 2),
            "coverage_threshold": self.COVERAGE_THRESHOLD,
            "threshold_met": self.coverage_data.percent >= self.COVERAGE_THRESHOLD,
            "discovered_tests": {
                k: len(v) for k, v in self.discovered_tests.items()
            },
            "uncovered_files": self.coverage_data.uncovered_files[:10],
            "slowest_tests": [],
            "recommendations": [],
        }

        # Add recommendations
        if self.coverage_data.percent < self.COVERAGE_THRESHOLD:
            report["recommendations"].append(
                f"Coverage ({self.coverage_data.percent:.1f}%) is below threshold ({self.COVERAGE_THRESHOLD}%)"
            )

        if len(self.coverage_data.uncovered_files) > 0:
            report["recommendations"].append(
                f"Add tests for {len(self.coverage_data.uncovered_files)} uncovered critical files"
            )

        return {
            "success": True,
            "report": report,
        }

    # ==================== REFLECTION ====================

    def reflect(self, plan: Plan) -> Reflection:
        """
        REFLECT PHASE: Analyze execution results and determine next steps.

        This is the key differentiator for Level 3 - the ability to
        evaluate success and decide whether to adapt the plan.
        """
        self.state = AgentState.REFLECTING
        self.log("Reflecting on execution results")

        reflection = Reflection(success=True)

        # Analyze each action's results
        for action in plan.actions:
            if not action.success:
                reflection.success = False
                reflection.issues.append(f"{action.type.value}: {action.error}")

            if action.result:
                # Check for specific issues
                if action.type in [ActionType.RUN_PYTHON, ActionType.RUN_NODE, ActionType.RUN_SHELL]:
                    failed = action.result.get("failed", 0)
                    if failed > 0:
                        reflection.issues.append(f"{action.type.value}: {failed} tests failed")
                        if self.FAIL_ON_ERROR:
                            reflection.success = False

                if action.type == ActionType.MEASURE_COVERAGE:
                    if not action.result.get("meets_threshold", True):
                        reflection.issues.append(
                            f"Coverage {action.result.get('coverage_percent', 0)}% below threshold {self.COVERAGE_THRESHOLD}%"
                        )
                        reflection.suggestions.append("Add tests for uncovered critical paths")
                        # Don't fail on coverage - just warn
                        # reflection.should_retry = True

                if action.type == ActionType.IDENTIFY_GAPS:
                    uncovered = action.result.get("uncovered_count", 0)
                    if uncovered > 10:
                        reflection.suggestions.append(f"Consider adding tests for {uncovered} uncovered files")

        # Determine if we should retry
        if reflection.issues and plan.iteration < self.MAX_ITERATIONS:
            # Only retry if there are fixable issues
            for issue in reflection.issues:
                if "timeout" in issue.lower():
                    reflection.should_retry = True
                    reflection.new_actions.append(
                        Action(ActionType.RUN_PYTHON, "Retry timed out tests")
                    )

        self.log(f"Reflection: success={reflection.success}, retry={reflection.should_retry}")
        return reflection

    # ==================== ADAPTATION ====================

    def adapt(self, plan: Plan, reflection: Reflection) -> Plan:
        """
        ADAPT PHASE: Modify plan based on reflection.

        Creates a new plan iteration with adjusted actions.
        """
        self.state = AgentState.ADAPTING
        self.log(f"Adapting plan (iteration {plan.iteration} -> {plan.iteration + 1})")

        new_plan = Plan(
            intent=plan.intent,
            iteration=plan.iteration + 1
        )

        # Add new actions from reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Add report at the end
        new_plan.actions.append(Action(ActionType.REPORT, "Generate updated report"))

        self.log(f"Adapted plan with {len(new_plan.actions)} actions")
        return new_plan

    # ==================== GOVERNANCE ====================

    def check_governance(self, plan: Plan) -> GovernanceCheck:
        """
        GOVERNANCE: Safety and compliance checks.

        Ensures the agent operates within defined constraints.
        """
        check = GovernanceCheck(passed=True)

        # Check iteration limit
        if plan.iteration > self.MAX_ITERATIONS:
            check.passed = False
            check.violations.append(f"Exceeded max iterations ({self.MAX_ITERATIONS})")

        # Validate all actions are known
        for action in plan.actions:
            if action.type not in ActionType:
                check.passed = False
                check.violations.append(f"Unknown action type: {action.type}")

        # Warn about potentially slow actions
        test_actions = [ActionType.RUN_PYTHON, ActionType.RUN_NODE, ActionType.RUN_SHELL]
        if any(a.type in test_actions for a in plan.actions):
            check.warnings.append("Test execution may take several minutes")

        return check

    # ==================== MAIN LOOP ====================

    def run(self, intent: str) -> dict:
        """
        Main autonomous execution loop.

        PLAN -> EXECUTE -> REFLECT -> ADAPT (repeat until success or max iterations)
        """
        self.log(f"Starting Level 3 test runner with intent: {intent}")
        start_time = time.time()

        # Create initial plan
        plan = self.plan(intent)

        while True:
            # Governance check
            governance = self.check_governance(plan)
            if not governance.passed:
                self.state = AgentState.FAILED
                self.log(f"Governance violation: {governance.violations}", "ERROR")
                return {
                    "success": False,
                    "error": "Governance violation",
                    "violations": governance.violations
                }

            if governance.warnings:
                for warning in governance.warnings:
                    self.log(f"Governance warning: {warning}", "WARN")

            # Execute plan
            plan = self.execute(plan)

            # Reflect on results
            reflection = self.reflect(plan)

            # Check if we should continue
            if reflection.success or not reflection.should_retry:
                break

            if plan.iteration >= self.MAX_ITERATIONS:
                self.log(f"Max iterations ({self.MAX_ITERATIONS}) reached", "WARN")
                break

            # Adapt plan and continue
            plan = self.adapt(plan, reflection)

        # Final state
        self.state = AgentState.COMPLETED if reflection.success else AgentState.FAILED
        duration = time.time() - start_time

        # Get final report
        final_report = self._action_report()

        # Aggregate test results from actions
        total_passed = 0
        total_failed = 0
        total_skipped = 0

        for action in plan.actions:
            if action.result:
                total_passed += action.result.get("passed", 0)
                total_failed += action.result.get("failed", 0)
                total_skipped += action.result.get("skipped", 0)

        report_data = final_report.get("report", {})
        report_data.update({
            "total_tests": total_passed + total_failed + total_skipped,
            "passed": total_passed,
            "failed": total_failed,
            "skipped": total_skipped,
        })

        result = {
            "success": reflection.success,
            "iterations": plan.iteration,
            "duration_seconds": round(duration, 2),
            "final_state": self.state.value,
            "total_tests": total_passed + total_failed + total_skipped,
            "passed": total_passed,
            "failed": total_failed,
            "skipped": total_skipped,
            "coverage_percent": round(self.coverage_data.percent, 2),
            "uncovered_files": self.coverage_data.uncovered_files[:10],
            "slowest_tests": [],
            "recommendations": report_data.get("recommendations", []),
            "issues": reflection.issues,
            "execution_log_entries": len(self.execution_log)
        }

        self.log(f"Agent completed: success={result['success']}, tests={result['total_tests']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Test Runner Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="run all tests with coverage",
        help="The intent/goal for the agent to achieve"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress verbose output"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON"
    )
    parser.add_argument(
        "--coverage-threshold",
        type=float,
        default=70.0,
        help="Minimum coverage percentage (default: 70.0)"
    )
    parser.add_argument(
        "--python-only",
        action="store_true",
        help="Run only Python tests"
    )
    parser.add_argument(
        "--node-only",
        action="store_true",
        help="Run only Node.js tests"
    )
    parser.add_argument(
        "--shell-only",
        action="store_true",
        help="Run only shell tests (bats)"
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / "scripts").is_dir():
            break
        root = root.parent

    agent = Level3TestRunner(
        root,
        verbose=not args.quiet,
        coverage_threshold=args.coverage_threshold,
        python_only=args.python_only,
        node_only=args.node_only,
        shell_only=args.shell_only,
    )
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 Test Runner - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:            {args.intent}")
        print(f"Success:           {result['success']}")
        print(f"Iterations:        {result['iterations']}")
        print(f"Duration:          {result['duration_seconds']}s")
        print(f"\nTest Results:")
        print(f"  Total:           {result['total_tests']}")
        print(f"  Passed:          {result['passed']}")
        print(f"  Failed:          {result['failed']}")
        print(f"  Skipped:         {result['skipped']}")
        print(f"\nCoverage:")
        print(f"  Percent:         {result['coverage_percent']}%")
        print(f"  Threshold:       {args.coverage_threshold}%")
        print(f"  Met Threshold:   {result['coverage_percent'] >= args.coverage_threshold}")
        if result.get("uncovered_files"):
            print(f"\nUncovered Critical Files:")
            for f in result["uncovered_files"][:5]:
                print(f"  - {f}")
        if result.get("recommendations"):
            print(f"\nRecommendations:")
            for rec in result["recommendations"]:
                print(f"  - {rec}")
        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
