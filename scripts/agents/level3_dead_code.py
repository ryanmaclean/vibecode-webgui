#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Dead Code Detection Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system exhibiting constrained autonomy for detecting and
cleaning up unused code:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and governance for code removal

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_dead_code.py "find and report dead code"
    python scripts/agents/level3_dead_code.py --cleanup  # Enable auto-removal
    python scripts/agents/level3_dead_code.py --python-only
    python scripts/agents/level3_dead_code.py --typescript-only
    python scripts/agents/level3_dead_code.py --json
"""

import argparse
import ast
import json
import os
import re
import shutil
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
    config.service = os.environ.get("DD_SERVICE", "level3-dead-code-agent")
    config.env = os.environ.get("DD_ENV", "development")
    config.version = os.environ.get("DD_VERSION", "1.0.0")
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
    """Available agent actions for dead code detection."""
    SCAN_PYTHON = "scan_python"
    SCAN_TYPESCRIPT = "scan_typescript"
    SCAN_IMPORTS = "scan_imports"
    SCAN_FUNCTIONS = "scan_functions"
    SCAN_VARIABLES = "scan_variables"
    VALIDATE = "validate"
    CLEANUP = "cleanup"
    REPORT = "report"


@dataclass
class DeadCodeItem:
    """Represents a piece of detected dead code."""
    file_path: str
    line_number: int
    code_type: str  # import, function, variable, class
    name: str
    confidence: float  # 0-100
    reason: str
    bytes_size: int = 0
    can_remove: bool = True


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


class Level3DeadCodeAgent:
    """
    Level 3 Autonomous Agent for Dead Code Detection and Cleanup.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance for code removal

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 3
    CONFIDENCE_THRESHOLD = 90  # Minimum confidence percentage before suggesting removal
    AUTO_CLEANUP = False  # Default: require explicit approval for cleanup

    # Exclusion patterns for files/directories
    EXCLUSIONS = {
        "directories": [
            "__pycache__",
            ".git",
            "node_modules",
            ".venv",
            "venv",
            ".tox",
            ".pytest_cache",
            ".mypy_cache",
            "dist",
            "build",
            ".next",
            "coverage",
        ],
        "files": [
            "__init__.py",  # May have intentional re-exports
            "conftest.py",  # pytest fixtures may appear unused
            "setup.py",
            "setup.cfg",
            "pyproject.toml",
        ],
        "patterns": [
            r".*_test\.py$",
            r".*test_.*\.py$",
            r".*\.spec\.ts$",
            r".*\.test\.ts$",
            r".*\.d\.ts$",  # TypeScript declarations
        ],
    }

    # Dynamic import patterns that should reduce confidence
    DYNAMIC_PATTERNS = [
        r"importlib\.import_module",
        r"__import__\s*\(",
        r"getattr\s*\(",
        r"globals\s*\(\)",
        r"locals\s*\(\)",
        r"eval\s*\(",
        r"exec\s*\(",
        r"require\s*\(",
        r"import\s*\(",  # Dynamic import in JS/TS
    ]

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        auto_cleanup: bool = False,
        python_only: bool = False,
        typescript_only: bool = False,
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.auto_cleanup = auto_cleanup
        self.python_only = python_only
        self.typescript_only = typescript_only
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []
        self.dead_code_items: list[DeadCodeItem] = []

        # Track tool availability
        self._check_tools()

    def _check_tools(self):
        """Check availability of detection tools."""
        self.tools = {
            "vulture": shutil.which("vulture") is not None,
            "autoflake": shutil.which("autoflake") is not None,
            "ts_prune": shutil.which("ts-prune") is not None,
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

    def _should_exclude_file(self, file_path: Path) -> bool:
        """Check if file should be excluded from analysis."""
        path_str = str(file_path)

        # Check directory exclusions
        for excluded_dir in self.EXCLUSIONS["directories"]:
            if f"/{excluded_dir}/" in path_str or path_str.endswith(f"/{excluded_dir}"):
                return True

        # Check file exclusions
        if file_path.name in self.EXCLUSIONS["files"]:
            return True

        # Check pattern exclusions
        for pattern in self.EXCLUSIONS["patterns"]:
            if re.match(pattern, file_path.name):
                return True

        return False

    def _has_dynamic_imports(self, content: str) -> bool:
        """Check if file uses dynamic imports/reflection."""
        for pattern in self.DYNAMIC_PATTERNS:
            if re.search(pattern, content):
                return True
        return False

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

        # Determine which scans to include
        scan_python = not self.typescript_only
        scan_typescript = not self.python_only

        if any(word in intent_lower for word in ["report", "find", "detect", "scan", "analyze"]):
            # Detection and reporting intent
            if scan_python:
                plan.actions.append(Action(ActionType.SCAN_PYTHON, "Scan Python files for dead code"))
            if scan_typescript:
                plan.actions.append(Action(ActionType.SCAN_TYPESCRIPT, "Scan TypeScript files for dead code"))
            plan.actions.append(Action(ActionType.SCAN_IMPORTS, "Find unused imports"))
            plan.actions.append(Action(ActionType.VALIDATE, "Validate detected dead code"))
            plan.actions.append(Action(ActionType.REPORT, "Generate dead code report"))

        elif any(word in intent_lower for word in ["clean", "remove", "delete", "fix"]):
            # Cleanup intent
            if scan_python:
                plan.actions.append(Action(ActionType.SCAN_PYTHON, "Scan Python files for dead code"))
            if scan_typescript:
                plan.actions.append(Action(ActionType.SCAN_TYPESCRIPT, "Scan TypeScript files for dead code"))
            plan.actions.append(Action(ActionType.SCAN_IMPORTS, "Find unused imports"))
            plan.actions.append(Action(ActionType.VALIDATE, "Validate detected dead code"))
            if self.auto_cleanup:
                plan.actions.append(Action(ActionType.CLEANUP, "Remove confirmed dead code"))
            plan.actions.append(Action(ActionType.REPORT, "Generate cleanup report"))

        elif any(word in intent_lower for word in ["import", "imports"]):
            # Import-focused intent
            plan.actions.append(Action(ActionType.SCAN_IMPORTS, "Find unused imports in all files"))
            plan.actions.append(Action(ActionType.VALIDATE, "Validate unused imports"))
            if self.auto_cleanup:
                plan.actions.append(Action(ActionType.CLEANUP, "Remove unused imports"))
            plan.actions.append(Action(ActionType.REPORT, "Generate import cleanup report"))

        elif any(word in intent_lower for word in ["function", "functions", "method"]):
            # Function-focused intent
            plan.actions.append(Action(ActionType.SCAN_FUNCTIONS, "Find unused functions"))
            plan.actions.append(Action(ActionType.VALIDATE, "Validate unused functions"))
            plan.actions.append(Action(ActionType.REPORT, "Generate function usage report"))

        elif any(word in intent_lower for word in ["variable", "variables"]):
            # Variable-focused intent
            plan.actions.append(Action(ActionType.SCAN_VARIABLES, "Find unused variables"))
            plan.actions.append(Action(ActionType.VALIDATE, "Validate unused variables"))
            plan.actions.append(Action(ActionType.REPORT, "Generate variable usage report"))

        else:
            # Default: full scan and report
            if scan_python:
                plan.actions.append(Action(ActionType.SCAN_PYTHON, "Scan Python files"))
            if scan_typescript:
                plan.actions.append(Action(ActionType.SCAN_TYPESCRIPT, "Scan TypeScript files"))
            plan.actions.append(Action(ActionType.SCAN_IMPORTS, "Scan imports"))
            plan.actions.append(Action(ActionType.VALIDATE, "Validate findings"))
            plan.actions.append(Action(ActionType.REPORT, "Generate report"))

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

        if action.type == ActionType.SCAN_PYTHON:
            return self._action_scan_python()

        elif action.type == ActionType.SCAN_TYPESCRIPT:
            return self._action_scan_typescript()

        elif action.type == ActionType.SCAN_IMPORTS:
            return self._action_scan_imports()

        elif action.type == ActionType.SCAN_FUNCTIONS:
            return self._action_scan_functions()

        elif action.type == ActionType.SCAN_VARIABLES:
            return self._action_scan_variables()

        elif action.type == ActionType.VALIDATE:
            return self._action_validate()

        elif action.type == ActionType.CLEANUP:
            return self._action_cleanup()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_scan_python(self) -> dict:
        """Scan Python files for dead code using vulture or AST analysis."""
        python_files = [
            f for f in self.root_dir.rglob("*.py")
            if not self._should_exclude_file(f)
        ]

        self.log(f"Scanning {len(python_files)} Python files")

        dead_code_count = 0
        scanned_files = 0

        # Try vulture first
        if self.tools["vulture"]:
            dead_code_count += self._scan_with_vulture(python_files)
            scanned_files = len(python_files)
        else:
            # Fallback to AST analysis
            for py_file in python_files:
                try:
                    found = self._scan_python_ast(py_file)
                    dead_code_count += found
                    scanned_files += 1
                except Exception as e:
                    self.log(f"Error scanning {py_file}: {e}", "WARN")

        return {
            "success": True,
            "files_scanned": scanned_files,
            "dead_code_found": dead_code_count,
            "tool_used": "vulture" if self.tools["vulture"] else "ast",
        }

    def _scan_with_vulture(self, python_files: list[Path]) -> int:
        """Use vulture to find dead code."""
        if not python_files:
            return 0

        # Run vulture on the root directory
        result = subprocess.run(
            ["vulture", str(self.root_dir), "--min-confidence", "80"],
            capture_output=True,
            text=True,
            cwd=self.root_dir,
        )

        count = 0
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue

            # Parse vulture output: file.py:10: unused function 'foo' (90% confidence)
            match = re.match(
                r"(.+):(\d+): unused (\w+) '([^']+)' \((\d+)% confidence\)",
                line,
            )
            if match:
                file_path = match.group(1)
                line_num = int(match.group(2))
                code_type = match.group(3)
                name = match.group(4)
                confidence = int(match.group(5))

                # Skip excluded files
                if self._should_exclude_file(Path(file_path)):
                    continue

                item = DeadCodeItem(
                    file_path=file_path,
                    line_number=line_num,
                    code_type=code_type,
                    name=name,
                    confidence=confidence,
                    reason="Detected by vulture",
                )
                self.dead_code_items.append(item)
                count += 1

        return count

    def _scan_python_ast(self, py_file: Path) -> int:
        """Scan a Python file using AST analysis."""
        try:
            content = py_file.read_text()
            tree = ast.parse(content)
        except (SyntaxError, UnicodeDecodeError):
            return 0

        count = 0
        defined_names = set()
        used_names = set()

        # First pass: collect all defined names
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                defined_names.add(node.name)
            elif isinstance(node, ast.ClassDef):
                defined_names.add(node.name)
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        defined_names.add(target.id)

        # Second pass: collect all used names
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    used_names.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    used_names.add(node.func.attr)

        # Find unused
        unused = defined_names - used_names

        # Check for dynamic usage
        has_dynamic = self._has_dynamic_imports(content)
        confidence = 70 if has_dynamic else 85

        for name in unused:
            # Skip private/dunder names in __init__.py context
            if name.startswith("_"):
                continue

            item = DeadCodeItem(
                file_path=str(py_file),
                line_number=0,  # AST doesn't give easy line numbers for this
                code_type="name",
                name=name,
                confidence=confidence,
                reason="Defined but never used in file",
            )
            self.dead_code_items.append(item)
            count += 1

        return count

    def _action_scan_typescript(self) -> dict:
        """Scan TypeScript files for dead code."""
        ts_files = [
            f for f in self.root_dir.rglob("*.ts")
            if not self._should_exclude_file(f) and not f.name.endswith(".d.ts")
        ]
        tsx_files = [
            f for f in self.root_dir.rglob("*.tsx")
            if not self._should_exclude_file(f)
        ]

        all_files = ts_files + tsx_files
        self.log(f"Scanning {len(all_files)} TypeScript files")

        dead_code_count = 0
        scanned_files = 0

        # Try ts-prune first
        if self.tools["ts_prune"]:
            dead_code_count += self._scan_with_ts_prune()
            scanned_files = len(all_files)
        else:
            # Fallback to regex-based analysis
            for ts_file in all_files:
                try:
                    found = self._scan_typescript_regex(ts_file)
                    dead_code_count += found
                    scanned_files += 1
                except Exception as e:
                    self.log(f"Error scanning {ts_file}: {e}", "WARN")

        return {
            "success": True,
            "files_scanned": scanned_files,
            "dead_code_found": dead_code_count,
            "tool_used": "ts-prune" if self.tools["ts_prune"] else "regex",
        }

    def _scan_with_ts_prune(self) -> int:
        """Use ts-prune to find unused exports."""
        result = subprocess.run(
            ["ts-prune"],
            capture_output=True,
            text=True,
            cwd=self.root_dir,
        )

        count = 0
        for line in result.stdout.strip().split("\n"):
            if not line or "used in module" in line:
                continue

            # Parse ts-prune output: src/file.ts:10 - someExport
            match = re.match(r"(.+):(\d+) - (.+)", line)
            if match:
                file_path = match.group(1)
                line_num = int(match.group(2))
                name = match.group(3).strip()

                if self._should_exclude_file(Path(file_path)):
                    continue

                item = DeadCodeItem(
                    file_path=file_path,
                    line_number=line_num,
                    code_type="export",
                    name=name,
                    confidence=85,
                    reason="Unused export detected by ts-prune",
                )
                self.dead_code_items.append(item)
                count += 1

        return count

    def _scan_typescript_regex(self, ts_file: Path) -> int:
        """Scan TypeScript file using regex patterns."""
        try:
            content = ts_file.read_text()
        except (UnicodeDecodeError, OSError):
            return 0

        count = 0
        lines = content.split("\n")

        # Find exported but potentially unused items
        export_pattern = re.compile(
            r"^export\s+(const|let|function|class|interface|type|enum)\s+(\w+)"
        )

        for i, line in enumerate(lines, 1):
            match = export_pattern.match(line.strip())
            if match:
                item_type = match.group(1)
                name = match.group(2)

                # Check if used elsewhere in file (simple heuristic)
                use_count = content.count(name) - 1  # Exclude definition

                if use_count == 0:
                    item = DeadCodeItem(
                        file_path=str(ts_file),
                        line_number=i,
                        code_type=f"export_{item_type}",
                        name=name,
                        confidence=60,  # Lower confidence for regex
                        reason="Export with no apparent usage",
                    )
                    self.dead_code_items.append(item)
                    count += 1

        return count

    def _action_scan_imports(self) -> dict:
        """Find unused imports across Python and TypeScript."""
        count = 0

        if not self.typescript_only:
            count += self._scan_python_imports()

        if not self.python_only:
            count += self._scan_typescript_imports()

        return {
            "success": True,
            "unused_imports_found": count,
        }

    def _scan_python_imports(self) -> int:
        """Find unused Python imports."""
        python_files = [
            f for f in self.root_dir.rglob("*.py")
            if not self._should_exclude_file(f)
        ]

        count = 0

        # Try autoflake for import analysis
        if self.tools["autoflake"]:
            for py_file in python_files:
                result = subprocess.run(
                    ["autoflake", "--check", str(py_file)],
                    capture_output=True,
                    text=True,
                )
                if result.returncode != 0:
                    # Has unused imports
                    for line in result.stdout.split("\n"):
                        if "unused import" in line.lower():
                            item = DeadCodeItem(
                                file_path=str(py_file),
                                line_number=0,
                                code_type="import",
                                name=line,
                                confidence=95,
                                reason="Unused import detected by autoflake",
                            )
                            self.dead_code_items.append(item)
                            count += 1
        else:
            # AST-based import analysis
            for py_file in python_files:
                count += self._scan_python_imports_ast(py_file)

        return count

    def _scan_python_imports_ast(self, py_file: Path) -> int:
        """Scan Python imports using AST."""
        try:
            content = py_file.read_text()
            tree = ast.parse(content)
        except (SyntaxError, UnicodeDecodeError):
            return 0

        count = 0
        imported_names = {}
        used_names = set()

        # Collect imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    name = alias.asname or alias.name
                    imported_names[name] = (alias.name, node.lineno)
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    name = alias.asname or alias.name
                    imported_names[name] = (f"{node.module}.{alias.name}", node.lineno)

        # Collect used names
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)
            elif isinstance(node, ast.Attribute):
                # Handle module.attr access
                if isinstance(node.value, ast.Name):
                    used_names.add(node.value.id)

        # Find unused imports
        for name, (full_name, lineno) in imported_names.items():
            if name not in used_names:
                # Skip if dynamic imports are used
                if self._has_dynamic_imports(content):
                    continue

                item = DeadCodeItem(
                    file_path=str(py_file),
                    line_number=lineno,
                    code_type="import",
                    name=full_name,
                    confidence=85,
                    reason="Import not used in file",
                )
                self.dead_code_items.append(item)
                count += 1

        return count

    def _scan_typescript_imports(self) -> int:
        """Find unused TypeScript imports."""
        ts_files = list(self.root_dir.rglob("*.ts")) + list(self.root_dir.rglob("*.tsx"))
        ts_files = [f for f in ts_files if not self._should_exclude_file(f)]

        count = 0
        import_pattern = re.compile(
            r"import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"]"
        )

        for ts_file in ts_files:
            try:
                content = ts_file.read_text()
            except (UnicodeDecodeError, OSError):
                continue

            for match in import_pattern.finditer(content):
                imports = [i.strip() for i in match.group(1).split(",")]
                for imp in imports:
                    # Handle aliased imports
                    name = imp.split(" as ")[-1].strip()
                    if not name:
                        continue

                    # Count usage (excluding the import itself)
                    use_pattern = rf"\b{re.escape(name)}\b"
                    uses = len(re.findall(use_pattern, content)) - 1

                    if uses == 0:
                        item = DeadCodeItem(
                            file_path=str(ts_file),
                            line_number=0,
                            code_type="import",
                            name=name,
                            confidence=75,
                            reason="Import not used in file",
                        )
                        self.dead_code_items.append(item)
                        count += 1

        return count

    def _action_scan_functions(self) -> dict:
        """Find unused functions."""
        count = 0

        if not self.typescript_only:
            python_files = [
                f for f in self.root_dir.rglob("*.py")
                if not self._should_exclude_file(f)
            ]

            for py_file in python_files:
                try:
                    content = py_file.read_text()
                    tree = ast.parse(content)

                    functions = []
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef):
                            if not node.name.startswith("_"):  # Skip private
                                functions.append((node.name, node.lineno))

                    # Check each function for usage
                    for func_name, lineno in functions:
                        # Count calls (simple heuristic)
                        pattern = rf"\b{func_name}\s*\("
                        calls = len(re.findall(pattern, content)) - 1

                        if calls == 0:
                            item = DeadCodeItem(
                                file_path=str(py_file),
                                line_number=lineno,
                                code_type="function",
                                name=func_name,
                                confidence=70,
                                reason="Function defined but never called",
                            )
                            self.dead_code_items.append(item)
                            count += 1

                except (SyntaxError, UnicodeDecodeError):
                    continue

        return {
            "success": True,
            "unused_functions_found": count,
        }

    def _action_scan_variables(self) -> dict:
        """Find unused variables."""
        count = 0

        if not self.typescript_only:
            python_files = [
                f for f in self.root_dir.rglob("*.py")
                if not self._should_exclude_file(f)
            ]

            for py_file in python_files:
                try:
                    content = py_file.read_text()
                    tree = ast.parse(content)

                    # Find module-level assignments
                    for node in ast.iter_child_nodes(tree):
                        if isinstance(node, ast.Assign):
                            for target in node.targets:
                                if isinstance(target, ast.Name):
                                    name = target.id
                                    if name.startswith("_"):
                                        continue

                                    # Count usage
                                    pattern = rf"\b{name}\b"
                                    uses = len(re.findall(pattern, content)) - 1

                                    if uses == 0:
                                        item = DeadCodeItem(
                                            file_path=str(py_file),
                                            line_number=node.lineno,
                                            code_type="variable",
                                            name=name,
                                            confidence=80,
                                            reason="Variable assigned but never used",
                                        )
                                        self.dead_code_items.append(item)
                                        count += 1

                except (SyntaxError, UnicodeDecodeError):
                    continue

        return {
            "success": True,
            "unused_variables_found": count,
        }

    def _action_validate(self) -> dict:
        """Validate detected dead code to reduce false positives."""
        validated = 0
        removed = 0
        original_count = len(self.dead_code_items)

        validated_items = []

        for item in self.dead_code_items:
            # Read file and check context
            try:
                file_path = Path(item.file_path)
                if not file_path.exists():
                    removed += 1
                    continue

                content = file_path.read_text()

                # Reduce confidence for dynamic imports
                if self._has_dynamic_imports(content):
                    item.confidence = min(item.confidence, 60)
                    item.reason += " (dynamic imports detected)"

                # Check for public API markers
                if self._is_public_api(item.name, content):
                    item.confidence = min(item.confidence, 50)
                    item.reason += " (may be public API)"

                # Check if it's part of __all__ export
                if f"'{item.name}'" in content or f'"{item.name}"' in content:
                    all_match = re.search(r"__all__\s*=\s*\[([^\]]+)\]", content)
                    if all_match and item.name in all_match.group(1):
                        item.confidence = min(item.confidence, 30)
                        item.can_remove = False
                        item.reason += " (exported in __all__)"

                # Keep items above minimum confidence
                if item.confidence >= 50:
                    validated_items.append(item)
                    validated += 1
                else:
                    removed += 1

            except Exception:
                removed += 1

        self.dead_code_items = validated_items

        return {
            "success": True,
            "original_count": original_count,
            "validated_count": validated,
            "removed_count": removed,
        }

    def _is_public_api(self, name: str, content: str) -> bool:
        """Check if name appears to be part of public API."""
        # Check for decorator patterns
        api_decorators = [
            "@app.route",
            "@router",
            "@api",
            "@exposed",
            "@public",
            "@property",
        ]
        for decorator in api_decorators:
            if decorator in content:
                # Find if decorator is near the name
                pattern = rf"{re.escape(decorator)}.*\n.*def {name}"
                if re.search(pattern, content, re.MULTILINE):
                    return True

        return False

    def _action_cleanup(self) -> dict:
        """Remove confirmed dead code with governance approval."""
        if not self.auto_cleanup:
            return {
                "success": True,
                "message": "Cleanup disabled. Run with --cleanup to enable.",
                "items_to_remove": len([i for i in self.dead_code_items if i.confidence >= self.CONFIDENCE_THRESHOLD]),
            }

        removed_count = 0
        bytes_removed = 0
        errors = []

        # Only remove high-confidence items
        to_remove = [
            item for item in self.dead_code_items
            if item.confidence >= self.CONFIDENCE_THRESHOLD and item.can_remove
        ]

        for item in to_remove:
            try:
                if item.code_type == "import":
                    success, bytes_saved = self._remove_import(item)
                else:
                    # For non-import items, use autoflake or manual removal
                    success = False
                    bytes_saved = 0

                if success:
                    removed_count += 1
                    bytes_removed += bytes_saved

            except Exception as e:
                errors.append(f"Error removing {item.name}: {e}")

        return {
            "success": len(errors) == 0,
            "removed_count": removed_count,
            "bytes_removed": bytes_removed,
            "errors": errors,
        }

    def _remove_import(self, item: DeadCodeItem) -> tuple[bool, int]:
        """Remove an unused import."""
        file_path = Path(item.file_path)
        if not file_path.exists():
            return False, 0

        original_content = file_path.read_text()
        lines = original_content.split("\n")

        # Find and remove the import line
        if item.line_number > 0 and item.line_number <= len(lines):
            line = lines[item.line_number - 1]
            if item.name in line:
                lines.pop(item.line_number - 1)
                new_content = "\n".join(lines)
                file_path.write_text(new_content)
                return True, len(original_content) - len(new_content)

        return False, 0

    def _action_report(self) -> dict:
        """Generate dead code report."""
        # Group by type
        by_type = {
            "imports": [],
            "functions": [],
            "variables": [],
            "classes": [],
            "other": [],
        }

        for item in self.dead_code_items:
            if item.code_type == "import":
                by_type["imports"].append(item)
            elif item.code_type == "function":
                by_type["functions"].append(item)
            elif item.code_type == "variable":
                by_type["variables"].append(item)
            elif item.code_type == "class":
                by_type["classes"].append(item)
            else:
                by_type["other"].append(item)

        # Calculate metrics
        high_confidence = [i for i in self.dead_code_items if i.confidence >= self.CONFIDENCE_THRESHOLD]
        total_bytes = sum(i.bytes_size for i in self.dead_code_items)

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_files_scanned": len(set(i.file_path for i in self.dead_code_items)),
            "dead_code_found": {
                "imports": len(by_type["imports"]),
                "functions": len(by_type["functions"]),
                "variables": len(by_type["variables"]),
                "classes": len(by_type["classes"]),
                "other": len(by_type["other"]),
                "total": len(self.dead_code_items),
            },
            "confidence_scores": {
                "high_confidence_count": len(high_confidence),
                "threshold": self.CONFIDENCE_THRESHOLD,
                "average_confidence": (
                    sum(i.confidence for i in self.dead_code_items) / len(self.dead_code_items)
                    if self.dead_code_items else 0
                ),
            },
            "bytes_removable": total_bytes,
            "recommendations": self._generate_recommendations(by_type),
            "items": [
                {
                    "file": item.file_path,
                    "line": item.line_number,
                    "type": item.code_type,
                    "name": item.name,
                    "confidence": item.confidence,
                    "reason": item.reason,
                    "can_remove": item.can_remove,
                }
                for item in sorted(self.dead_code_items, key=lambda x: -x.confidence)
            ],
        }

        return {
            "success": True,
            "report": report,
        }

    def _generate_recommendations(self, by_type: dict) -> list[str]:
        """Generate cleanup recommendations."""
        recommendations = []

        if by_type["imports"]:
            recommendations.append(
                f"Remove {len(by_type['imports'])} unused imports to reduce file size and improve clarity"
            )

        if by_type["functions"]:
            recommendations.append(
                f"Review {len(by_type['functions'])} potentially unused functions - some may be entry points"
            )

        if by_type["variables"]:
            recommendations.append(
                f"Clean up {len(by_type['variables'])} unused variables for better code hygiene"
            )

        if by_type["classes"]:
            recommendations.append(
                f"Verify {len(by_type['classes'])} unused classes are not loaded dynamically"
            )

        if not self.auto_cleanup:
            recommendations.append(
                "Run with --cleanup flag to enable automatic removal of high-confidence dead code"
            )

        return recommendations

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
                if action.type == ActionType.VALIDATE:
                    validated_count = action.result.get("validated_count", 0)
                    removed_count = action.result.get("removed_count", 0)
                    if removed_count > validated_count:
                        reflection.suggestions.append("Many items had low confidence - may need better analysis")

                if action.type == ActionType.CLEANUP:
                    if action.result.get("errors"):
                        reflection.issues.extend(action.result["errors"])
                        reflection.should_retry = True

                if action.type in [ActionType.SCAN_PYTHON, ActionType.SCAN_TYPESCRIPT]:
                    if action.result.get("files_scanned", 0) == 0:
                        reflection.issues.append(f"No files scanned for {action.type.value}")

        # Check if we found meaningful results
        if not self.dead_code_items:
            reflection.suggestions.append("No dead code found - codebase may be clean or tools need configuration")

        # Determine if we should retry
        if reflection.issues and plan.iteration < self.MAX_ITERATIONS:
            reflection.should_retry = True

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
            iteration=plan.iteration + 1,
        )

        # Add new actions based on reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Add validation and reporting
        new_plan.actions.append(Action(ActionType.VALIDATE, "Re-validate after adaptation"))
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

        # Check for cleanup without explicit approval
        for action in plan.actions:
            if action.type == ActionType.CLEANUP and not self.auto_cleanup:
                check.warnings.append("Cleanup action requires --cleanup flag")

        # Validate all actions are known
        for action in plan.actions:
            if action.type not in ActionType:
                check.passed = False
                check.violations.append(f"Unknown action type: {action.type}")

        return check

    # ==================== MAIN LOOP ====================

    def run(self, intent: str) -> dict:
        """
        Main autonomous execution loop.

        PLAN -> EXECUTE -> REFLECT -> ADAPT (repeat until success or max iterations)
        """
        self.log(f"Starting Level 3 Dead Code Agent with intent: {intent}")
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
                    "violations": governance.violations,
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

        result = {
            "success": reflection.success,
            "iterations": plan.iteration,
            "duration_seconds": round(duration, 2),
            "final_state": self.state.value,
            "report": final_report.get("report", {}),
            "issues": reflection.issues,
            "execution_log_entries": len(self.execution_log),
            "tools_available": self.tools,
        }

        self.log(f"Agent completed: success={result['success']}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Dead Code Detection Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="find and report dead code",
        help="The intent/goal for the agent to achieve",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress verbose output",
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Enable automatic removal of dead code (governance approval)",
    )
    parser.add_argument(
        "--python-only",
        action="store_true",
        help="Only scan Python files",
    )
    parser.add_argument(
        "--typescript-only",
        action="store_true",
        help="Only scan TypeScript files",
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / "scripts").is_dir() or (root / "src").is_dir():
            break
        root = root.parent

    agent = Level3DeadCodeAgent(
        root,
        verbose=not args.quiet,
        auto_cleanup=args.cleanup,
        python_only=args.python_only,
        typescript_only=args.typescript_only,
    )
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 Dead Code Agent - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {args.intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")

        report = result.get("report", {})
        if report:
            print(f"\nDead Code Found:")
            for code_type, count in report.get("dead_code_found", {}).items():
                if count > 0:
                    print(f"  {code_type}: {count}")

            print(f"\nConfidence:")
            confidence = report.get("confidence_scores", {})
            print(f"  High confidence items: {confidence.get('high_confidence_count', 0)}")
            print(f"  Average confidence: {confidence.get('average_confidence', 0):.1f}%")

            if report.get("recommendations"):
                print(f"\nRecommendations:")
                for rec in report["recommendations"]:
                    print(f"  - {rec}")

        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

        print(f"\nTools Available:")
        for tool, available in result.get("tools_available", {}).items():
            status = "installed" if available else "not found"
            print(f"  {tool}: {status}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
