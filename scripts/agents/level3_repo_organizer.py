#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Repository Organizer Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system exhibiting constrained autonomy for repository
structure reorganization:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and governance for file operations

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    # Analyze and propose (dry run)
    python3 scripts/agents/level3_repo_organizer.py "analyze and propose reorganization"

    # Execute with approval
    python3 scripts/agents/level3_repo_organizer.py --execute "reorganize scripts directory"

    # Target specific directory
    python3 scripts/agents/level3_repo_organizer.py --target scripts/ "organize scripts"
"""

import argparse
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
    config.service = os.environ.get("DD_SERVICE", "level3-repo-organizer")
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
    """Available agent actions for repository organization."""
    SCAN_STRUCTURE = "scan_structure"
    IDENTIFY_ISSUES = "identify_issues"
    PROPOSE_MOVES = "propose_moves"
    VALIDATE_MOVES = "validate_moves"
    CREATE_BACKUP = "create_backup"
    EXECUTE_MOVES = "execute_moves"
    UPDATE_IMPORTS = "update_imports"
    VALIDATE_BUILD = "validate_build"
    REPORT = "report"


@dataclass
class FileMove:
    """Represents a proposed file/directory move."""
    source: str
    destination: str
    reason: str
    is_directory: bool = False
    file_count: int = 1
    affected_imports: list[str] = field(default_factory=list)
    confidence: float = 0.0
    executed: bool = False
    error: Optional[str] = None


@dataclass
class StructuralIssue:
    """Represents a structural issue in the repository."""
    path: str
    issue_type: str  # scattered, misplaced, orphaned, inconsistent, duplicate
    description: str
    severity: str  # low, medium, high
    suggested_location: Optional[str] = None


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


class Level3RepoOrganizer:
    """
    Level 3 Autonomous Agent for Repository Reorganization.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance for file operations

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 5
    DRY_RUN = True  # Default: no actual file moves
    BACKUP_BRANCH = True  # Create backup before changes
    LARGE_MOVE_THRESHOLD = 10  # Files requiring confirmation

    # Standard directory structure to enforce
    STANDARD_STRUCTURE = {
        "src": {
            "description": "Source code",
            "subdirs": ["app", "components", "lib", "types"],
        },
        "scripts": {
            "description": "Utility scripts",
            "subdirs": ["agents", "lib", "python", "cloud", "benchmarks", "monitoring"],
        },
        "config": {
            "description": "Configuration files",
            "subdirs": ["docker", "env-examples"],
        },
        "infrastructure": {
            "description": "Infrastructure as Code",
            "subdirs": ["terraform", "opentofu", "kubernetes", "services"],
        },
        "platforms": {
            "description": "Platform-specific configs",
            "subdirs": ["kubernetes", "docker"],
        },
        "tests": {
            "description": "Test files",
            "subdirs": [],
        },
        "docs": {
            "description": "Documentation",
            "subdirs": [],
        },
        ".github": {
            "description": "GitHub configs",
            "subdirs": ["workflows", "ISSUE_TEMPLATE"],
        },
    }

    # Directories/files to never move
    PROTECTED_PATHS = {
        ".git",
        "node_modules",
        ".next",
        "dist",
        "build",
        "__pycache__",
        ".venv",
        "venv",
        ".env",
        ".env.local",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
    }

    # File patterns for categorization
    FILE_PATTERNS = {
        "config": [
            r".*\.config\.(js|ts|json)$",
            r".*\.env.*",
            r"tsconfig.*\.json$",
            r"\..*rc(\.json)?$",
        ],
        "docker": [
            r"[Dd]ockerfile.*",
            r"docker-compose.*\.ya?ml$",
            r"\.dockerignore$",
        ],
        "terraform": [
            r".*\.tf$",
            r".*\.tfvars$",
        ],
        "kubernetes": [
            r".*\.ya?ml$",  # Context-dependent
            r".*-deployment\.ya?ml$",
            r".*-service\.ya?ml$",
        ],
        "scripts": [
            r".*\.sh$",
            r".*\.py$",
        ],
        "docs": [
            r".*\.md$",
            r"LICENSE.*",
            r"CHANGELOG.*",
        ],
    }

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        dry_run: bool = True,
        target_dir: Optional[str] = None,
        execute_moves: bool = False,
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.dry_run = dry_run and not execute_moves
        self.target_dir = Path(target_dir) if target_dir else None
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []
        self.proposed_moves: list[FileMove] = []
        self.structural_issues: list[StructuralIssue] = []
        self.backup_branch: Optional[str] = None

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

    def _is_protected_path(self, path: Path) -> bool:
        """Check if path is protected from moves."""
        path_str = str(path)
        for protected in self.PROTECTED_PATHS:
            if protected in path_str:
                return True
        return False

    def _get_file_category(self, file_path: Path) -> Optional[str]:
        """Determine category of a file based on patterns."""
        filename = file_path.name
        for category, patterns in self.FILE_PATTERNS.items():
            for pattern in patterns:
                if re.match(pattern, filename, re.IGNORECASE):
                    return category
        return None

    def _count_files_in_dir(self, dir_path: Path) -> int:
        """Count files in a directory recursively."""
        if not dir_path.is_dir():
            return 0
        return sum(1 for _ in dir_path.rglob("*") if _.is_file())

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

        if any(word in intent_lower for word in ["analyze", "scan", "check", "audit"]):
            # Analysis intent
            plan.actions = [
                Action(ActionType.SCAN_STRUCTURE, "Scan current repository structure"),
                Action(ActionType.IDENTIFY_ISSUES, "Identify structural issues"),
                Action(ActionType.PROPOSE_MOVES, "Generate proposed moves"),
                Action(ActionType.REPORT, "Generate analysis report"),
            ]

        elif any(word in intent_lower for word in ["reorganize", "organize", "restructure", "move"]):
            # Reorganization intent
            plan.actions = [
                Action(ActionType.SCAN_STRUCTURE, "Scan current repository structure"),
                Action(ActionType.IDENTIFY_ISSUES, "Identify structural issues"),
                Action(ActionType.PROPOSE_MOVES, "Generate proposed moves"),
                Action(ActionType.VALIDATE_MOVES, "Validate moves for breakages"),
            ]
            if not self.dry_run:
                plan.actions.append(Action(ActionType.CREATE_BACKUP, "Create backup branch"))
                plan.actions.append(Action(ActionType.EXECUTE_MOVES, "Execute file moves"))
                plan.actions.append(Action(ActionType.UPDATE_IMPORTS, "Update affected imports"))
                plan.actions.append(Action(ActionType.VALIDATE_BUILD, "Validate build"))
            plan.actions.append(Action(ActionType.REPORT, "Generate reorganization report"))

        elif any(word in intent_lower for word in ["fix", "cleanup", "clean"]):
            # Cleanup intent
            plan.actions = [
                Action(ActionType.SCAN_STRUCTURE, "Scan for cleanup opportunities"),
                Action(ActionType.IDENTIFY_ISSUES, "Identify issues to fix"),
                Action(ActionType.PROPOSE_MOVES, "Propose cleanup moves"),
                Action(ActionType.VALIDATE_MOVES, "Validate cleanup moves"),
            ]
            if not self.dry_run:
                plan.actions.append(Action(ActionType.CREATE_BACKUP, "Create backup"))
                plan.actions.append(Action(ActionType.EXECUTE_MOVES, "Execute cleanup"))
            plan.actions.append(Action(ActionType.REPORT, "Generate cleanup report"))

        elif any(word in intent_lower for word in ["report", "status"]):
            # Reporting intent
            plan.actions = [
                Action(ActionType.SCAN_STRUCTURE, "Scan structure"),
                Action(ActionType.REPORT, "Generate status report"),
            ]

        else:
            # Default: analyze and propose
            plan.actions = [
                Action(ActionType.SCAN_STRUCTURE, "Scan repository structure"),
                Action(ActionType.IDENTIFY_ISSUES, "Identify issues"),
                Action(ActionType.PROPOSE_MOVES, "Generate proposals"),
                Action(ActionType.REPORT, "Generate report"),
            ]

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

        if action.type == ActionType.SCAN_STRUCTURE:
            return self._action_scan_structure()

        elif action.type == ActionType.IDENTIFY_ISSUES:
            return self._action_identify_issues()

        elif action.type == ActionType.PROPOSE_MOVES:
            return self._action_propose_moves()

        elif action.type == ActionType.VALIDATE_MOVES:
            return self._action_validate_moves()

        elif action.type == ActionType.CREATE_BACKUP:
            return self._action_create_backup()

        elif action.type == ActionType.EXECUTE_MOVES:
            return self._action_execute_moves()

        elif action.type == ActionType.UPDATE_IMPORTS:
            return self._action_update_imports()

        elif action.type == ActionType.VALIDATE_BUILD:
            return self._action_validate_build()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_scan_structure(self) -> dict:
        """Scan and analyze current repository structure."""
        scan_root = self.target_dir if self.target_dir else self.root_dir
        if self.target_dir and not self.target_dir.is_absolute():
            scan_root = self.root_dir / self.target_dir

        self.log(f"Scanning structure at: {scan_root}")

        structure = {
            "total_files": 0,
            "total_directories": 0,
            "by_extension": {},
            "by_directory": {},
            "top_level_dirs": [],
            "depth_analysis": {},
        }

        # Scan directories
        for item in scan_root.iterdir():
            if item.is_dir() and not self._is_protected_path(item):
                structure["top_level_dirs"].append(item.name)
                file_count = self._count_files_in_dir(item)
                structure["by_directory"][item.name] = {
                    "file_count": file_count,
                    "subdirs": [d.name for d in item.iterdir() if d.is_dir()],
                }

        # Scan files
        for file_path in scan_root.rglob("*"):
            if file_path.is_file() and not self._is_protected_path(file_path):
                structure["total_files"] += 1
                ext = file_path.suffix.lower() or "(no extension)"
                structure["by_extension"][ext] = structure["by_extension"].get(ext, 0) + 1

                # Track depth
                depth = len(file_path.relative_to(scan_root).parts)
                structure["depth_analysis"][depth] = structure["depth_analysis"].get(depth, 0) + 1

        # Count directories
        structure["total_directories"] = sum(
            1 for p in scan_root.rglob("*")
            if p.is_dir() and not self._is_protected_path(p)
        )

        return {
            "success": True,
            "structure": structure,
            "scan_root": str(scan_root),
        }

    def _action_identify_issues(self) -> dict:
        """Identify structural issues in the repository."""
        self.structural_issues = []
        scan_root = self.target_dir if self.target_dir else self.root_dir
        if self.target_dir and not self.target_dir.is_absolute():
            scan_root = self.root_dir / self.target_dir

        # Check for scattered files at root level
        root_files = [f for f in scan_root.iterdir() if f.is_file() and not f.name.startswith(".")]
        for root_file in root_files:
            category = self._get_file_category(root_file)
            if category and category != "config":
                self.structural_issues.append(StructuralIssue(
                    path=str(root_file),
                    issue_type="scattered",
                    description=f"File should be in {category}/ directory",
                    severity="medium",
                    suggested_location=f"{category}/{root_file.name}",
                ))

        # Check for inconsistent naming
        for dir_path in scan_root.iterdir():
            if dir_path.is_dir() and not self._is_protected_path(dir_path):
                # Check for mixed case directories
                if dir_path.name != dir_path.name.lower() and dir_path.name not in [".github"]:
                    self.structural_issues.append(StructuralIssue(
                        path=str(dir_path),
                        issue_type="inconsistent",
                        description=f"Directory name should be lowercase: {dir_path.name}",
                        severity="low",
                        suggested_location=str(dir_path.parent / dir_path.name.lower()),
                    ))

        # Check for orphaned directories (empty or nearly empty)
        for dir_path in scan_root.rglob("*"):
            if dir_path.is_dir() and not self._is_protected_path(dir_path):
                file_count = self._count_files_in_dir(dir_path)
                if file_count == 0:
                    self.structural_issues.append(StructuralIssue(
                        path=str(dir_path),
                        issue_type="orphaned",
                        description="Empty directory",
                        severity="low",
                    ))

        # Check for misplaced files based on standard structure
        for category, config in self.STANDARD_STRUCTURE.items():
            expected_dir = scan_root / category
            if not expected_dir.exists():
                continue

            for subdir in config.get("subdirs", []):
                subdir_path = expected_dir / subdir
                if not subdir_path.exists():
                    # Check if content exists elsewhere
                    for other_dir in scan_root.iterdir():
                        if other_dir.is_dir() and other_dir.name == subdir:
                            self.structural_issues.append(StructuralIssue(
                                path=str(other_dir),
                                issue_type="misplaced",
                                description=f"Should be under {category}/",
                                severity="medium",
                                suggested_location=str(subdir_path),
                            ))

        # Check for duplicate or redundant directories
        dir_names = {}
        for dir_path in scan_root.rglob("*"):
            if dir_path.is_dir() and not self._is_protected_path(dir_path):
                name = dir_path.name.lower()
                if name not in dir_names:
                    dir_names[name] = []
                dir_names[name].append(str(dir_path))

        for name, paths in dir_names.items():
            if len(paths) > 1 and name not in ["lib", "utils", "types", "tests", "__pycache__"]:
                for path in paths[1:]:
                    self.structural_issues.append(StructuralIssue(
                        path=path,
                        issue_type="duplicate",
                        description=f"Multiple directories named '{name}' - consider consolidating",
                        severity="low",
                        suggested_location=paths[0],
                    ))

        return {
            "success": True,
            "issues_found": len(self.structural_issues),
            "by_type": self._count_issues_by_type(),
            "by_severity": self._count_issues_by_severity(),
        }

    def _count_issues_by_type(self) -> dict:
        """Count issues by type."""
        counts = {}
        for issue in self.structural_issues:
            counts[issue.issue_type] = counts.get(issue.issue_type, 0) + 1
        return counts

    def _count_issues_by_severity(self) -> dict:
        """Count issues by severity."""
        counts = {}
        for issue in self.structural_issues:
            counts[issue.severity] = counts.get(issue.severity, 0) + 1
        return counts

    def _action_propose_moves(self) -> dict:
        """Generate list of proposed file/directory moves."""
        self.proposed_moves = []

        for issue in self.structural_issues:
            if issue.suggested_location:
                source = Path(issue.path)
                destination = Path(issue.suggested_location)

                move = FileMove(
                    source=issue.path,
                    destination=issue.suggested_location,
                    reason=issue.description,
                    is_directory=source.is_dir() if source.exists() else False,
                    file_count=self._count_files_in_dir(source) if source.is_dir() else 1,
                    confidence=self._calculate_move_confidence(issue),
                )
                self.proposed_moves.append(move)

        # Sort by confidence (highest first)
        self.proposed_moves.sort(key=lambda m: -m.confidence)

        return {
            "success": True,
            "proposed_moves": len(self.proposed_moves),
            "total_files_affected": sum(m.file_count for m in self.proposed_moves),
        }

    def _calculate_move_confidence(self, issue: StructuralIssue) -> float:
        """Calculate confidence score for a proposed move."""
        confidence = 50.0

        # Severity affects confidence
        if issue.severity == "high":
            confidence += 30
        elif issue.severity == "medium":
            confidence += 15

        # Issue type affects confidence
        if issue.issue_type == "scattered":
            confidence += 20
        elif issue.issue_type == "misplaced":
            confidence += 15
        elif issue.issue_type == "orphaned":
            confidence += 10

        # Cap at 95 (always leave room for human review)
        return min(confidence, 95.0)

    def _action_validate_moves(self) -> dict:
        """Validate proposed moves for potential breakages."""
        validated = 0
        rejected = 0
        warnings = []

        for move in self.proposed_moves:
            source = Path(move.source)
            if not source.exists():
                move.error = "Source does not exist"
                rejected += 1
                continue

            # Check for import references
            if source.suffix in [".py", ".ts", ".tsx", ".js", ".jsx"]:
                affected = self._find_affected_imports(source)
                move.affected_imports = affected
                if affected:
                    warnings.append(f"{move.source} has {len(affected)} import references")

            # Check destination doesn't exist
            dest = Path(move.destination)
            if dest.exists():
                move.error = "Destination already exists"
                rejected += 1
                continue

            validated += 1

        return {
            "success": True,
            "validated": validated,
            "rejected": rejected,
            "warnings": warnings,
        }

    def _find_affected_imports(self, file_path: Path) -> list[str]:
        """Find files that import from the given file."""
        affected = []
        file_stem = file_path.stem
        parent_name = file_path.parent.name

        # Search for import patterns
        patterns = [
            f"from.*{file_stem}",
            f"import.*{file_stem}",
            f"from.*{parent_name}.*import",
        ]

        for pattern in patterns:
            try:
                result = subprocess.run(
                    ["grep", "-r", "-l", pattern, str(self.root_dir)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result.returncode == 0:
                    for line in result.stdout.strip().split("\n"):
                        if line and line != str(file_path):
                            affected.append(line)
            except (subprocess.TimeoutExpired, Exception):
                pass

        return list(set(affected))[:10]  # Limit to 10 files

    def _action_create_backup(self) -> dict:
        """Create git stash or branch backup before changes."""
        if self.dry_run:
            return {"success": True, "message": "Dry run - no backup needed"}

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        branch_name = f"backup/repo-org-{timestamp}"

        try:
            # Check for uncommitted changes
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True,
                text=True,
                cwd=self.root_dir,
            )

            if result.stdout.strip():
                # Stash uncommitted changes
                subprocess.run(
                    ["git", "stash", "push", "-m", f"Repo organizer backup {timestamp}"],
                    capture_output=True,
                    cwd=self.root_dir,
                )

            # Create backup branch
            subprocess.run(
                ["git", "branch", branch_name],
                capture_output=True,
                cwd=self.root_dir,
            )

            self.backup_branch = branch_name
            self.log(f"Created backup branch: {branch_name}")

            return {
                "success": True,
                "backup_branch": branch_name,
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to create backup: {e}",
            }

    def _action_execute_moves(self) -> dict:
        """Execute the proposed file/directory moves."""
        if self.dry_run:
            return {
                "success": True,
                "message": "Dry run - no moves executed",
                "would_move": len(self.proposed_moves),
            }

        # Check for large moves requiring confirmation
        total_files = sum(m.file_count for m in self.proposed_moves)
        if total_files > self.LARGE_MOVE_THRESHOLD:
            self.log(f"Large move operation: {total_files} files", "WARN")

        executed = 0
        failed = 0

        for move in self.proposed_moves:
            if move.error:
                continue

            source = Path(move.source)
            dest = Path(move.destination)

            try:
                # Create destination directory if needed
                dest.parent.mkdir(parents=True, exist_ok=True)

                # Move file/directory
                shutil.move(str(source), str(dest))
                move.executed = True
                executed += 1
                self.log(f"Moved: {source} -> {dest}")

            except Exception as e:
                move.error = str(e)
                failed += 1
                self.log(f"Failed to move {source}: {e}", "ERROR")

        return {
            "success": failed == 0,
            "executed": executed,
            "failed": failed,
        }

    def _action_update_imports(self) -> dict:
        """Update import statements affected by moves."""
        if self.dry_run:
            return {"success": True, "message": "Dry run - no imports updated"}

        updated_files = 0
        errors = []

        for move in self.proposed_moves:
            if not move.executed or not move.affected_imports:
                continue

            old_import = self._path_to_import(Path(move.source))
            new_import = self._path_to_import(Path(move.destination))

            for affected_file in move.affected_imports:
                try:
                    file_path = Path(affected_file)
                    if not file_path.exists():
                        continue

                    content = file_path.read_text()
                    new_content = content.replace(old_import, new_import)

                    if new_content != content:
                        file_path.write_text(new_content)
                        updated_files += 1
                        self.log(f"Updated imports in: {affected_file}")

                except Exception as e:
                    errors.append(f"Error updating {affected_file}: {e}")

        return {
            "success": len(errors) == 0,
            "updated_files": updated_files,
            "errors": errors,
        }

    def _path_to_import(self, file_path: Path) -> str:
        """Convert file path to import path."""
        # Remove extension and convert separators
        rel_path = file_path.relative_to(self.root_dir)
        import_path = str(rel_path.with_suffix("")).replace("/", ".")
        return import_path

    def _action_validate_build(self) -> dict:
        """Run build to ensure nothing broke."""
        if self.dry_run:
            return {"success": True, "message": "Dry run - no build validation"}

        build_results = {
            "python_syntax": True,
            "typescript_check": True,
            "npm_build": True,
        }

        # Check Python syntax
        try:
            for py_file in self.root_dir.rglob("*.py"):
                if self._is_protected_path(py_file):
                    continue
                result = subprocess.run(
                    [sys.executable, "-m", "py_compile", str(py_file)],
                    capture_output=True,
                    timeout=5,
                )
                if result.returncode != 0:
                    build_results["python_syntax"] = False
                    break
        except Exception:
            build_results["python_syntax"] = False

        # Check TypeScript (if tsconfig exists)
        tsconfig = self.root_dir / "tsconfig.json"
        if tsconfig.exists():
            try:
                result = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    capture_output=True,
                    cwd=self.root_dir,
                    timeout=60,
                )
                build_results["typescript_check"] = result.returncode == 0
            except Exception:
                build_results["typescript_check"] = False

        # Run npm build (if package.json exists)
        package_json = self.root_dir / "package.json"
        if package_json.exists():
            try:
                result = subprocess.run(
                    ["npm", "run", "build"],
                    capture_output=True,
                    cwd=self.root_dir,
                    timeout=120,
                )
                build_results["npm_build"] = result.returncode == 0
            except Exception:
                build_results["npm_build"] = False

        all_passed = all(build_results.values())

        return {
            "success": all_passed,
            "results": build_results,
        }

    def _action_report(self) -> dict:
        """Generate reorganization report."""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "dry_run": self.dry_run,
            "target_directory": str(self.target_dir) if self.target_dir else "entire repository",
            "summary": {
                "structural_issues_found": len(self.structural_issues),
                "proposed_moves": len(self.proposed_moves),
                "total_files_affected": sum(m.file_count for m in self.proposed_moves),
                "executed_moves": sum(1 for m in self.proposed_moves if m.executed),
            },
            "issues": [
                {
                    "path": issue.path,
                    "type": issue.issue_type,
                    "severity": issue.severity,
                    "description": issue.description,
                    "suggested_location": issue.suggested_location,
                }
                for issue in self.structural_issues
            ],
            "proposed_moves": [
                {
                    "source": move.source,
                    "destination": move.destination,
                    "reason": move.reason,
                    "file_count": move.file_count,
                    "confidence": move.confidence,
                    "executed": move.executed,
                    "error": move.error,
                    "affected_imports": move.affected_imports[:5],  # Limit
                }
                for move in self.proposed_moves
            ],
            "recommendations": self._generate_recommendations(),
        }

        if self.backup_branch:
            report["backup_branch"] = self.backup_branch

        return {
            "success": True,
            "report": report,
        }

    def _generate_recommendations(self) -> list[str]:
        """Generate recommendations based on analysis."""
        recommendations = []

        # Based on issues found
        issue_counts = self._count_issues_by_type()

        if issue_counts.get("scattered", 0) > 5:
            recommendations.append(
                "Consider consolidating scattered files into appropriate directories"
            )

        if issue_counts.get("orphaned", 0) > 3:
            recommendations.append(
                "Clean up empty directories to reduce clutter"
            )

        if issue_counts.get("inconsistent", 0) > 0:
            recommendations.append(
                "Standardize directory naming to lowercase for consistency"
            )

        if issue_counts.get("misplaced", 0) > 0:
            recommendations.append(
                "Move misplaced directories to their standard locations"
            )

        # Based on moves
        high_confidence_moves = [m for m in self.proposed_moves if m.confidence >= 80]
        if high_confidence_moves and self.dry_run:
            recommendations.append(
                f"Run with --execute to apply {len(high_confidence_moves)} high-confidence moves"
            )

        moves_with_imports = [m for m in self.proposed_moves if m.affected_imports]
        if moves_with_imports:
            recommendations.append(
                f"{len(moves_with_imports)} moves will require import updates - review carefully"
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
                if action.type == ActionType.EXECUTE_MOVES:
                    if action.result.get("failed", 0) > 0:
                        reflection.issues.append(
                            f"Failed to execute {action.result['failed']} moves"
                        )
                        reflection.should_retry = True

                if action.type == ActionType.VALIDATE_BUILD:
                    results = action.result.get("results", {})
                    for check, passed in results.items():
                        if not passed:
                            reflection.issues.append(f"Build validation failed: {check}")
                            reflection.suggestions.append(f"Review and fix {check} errors")

                if action.type == ActionType.VALIDATE_MOVES:
                    if action.result.get("rejected", 0) > 0:
                        reflection.suggestions.append(
                            "Some moves were rejected - review conflicts"
                        )

        # Check if we achieved meaningful results
        if not self.structural_issues and not self.proposed_moves:
            reflection.suggestions.append(
                "No issues found - repository structure appears clean"
            )

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

        # Re-validate and report
        new_plan.actions.append(Action(ActionType.VALIDATE_MOVES, "Re-validate remaining moves"))
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

        # Check for moves in protected paths
        for action in plan.actions:
            if action.type == ActionType.EXECUTE_MOVES:
                for move in self.proposed_moves:
                    if self._is_protected_path(Path(move.source)):
                        check.passed = False
                        check.violations.append(f"Cannot move protected path: {move.source}")

        # Check for large operations without explicit approval
        total_files = sum(m.file_count for m in self.proposed_moves)
        if total_files > self.LARGE_MOVE_THRESHOLD and not self.dry_run:
            check.warnings.append(
                f"Large operation: {total_files} files affected. Consider reviewing first."
            )

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
        self.log(f"Starting Level 3 Repo Organizer with intent: {intent}")
        self.log(f"Dry run: {self.dry_run}")
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
            "dry_run": self.dry_run,
            "report": final_report.get("report", {}),
            "issues": reflection.issues,
            "suggestions": reflection.suggestions,
            "execution_log_entries": len(self.execution_log),
        }

        self.log(f"Agent completed: success={result['success']}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Repository Organizer Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="analyze and propose reorganization",
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
        "--execute",
        action="store_true",
        help="Execute moves (disable dry run)",
    )
    parser.add_argument(
        "--target", "-t",
        type=str,
        help="Target specific directory to organize",
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / ".git").is_dir():
            break
        root = root.parent

    agent = Level3RepoOrganizer(
        root,
        verbose=not args.quiet,
        dry_run=not args.execute,
        target_dir=args.target,
        execute_moves=args.execute,
    )
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 Repository Organizer - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {args.intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")
        print(f"Dry Run:     {result['dry_run']}")

        report = result.get("report", {})
        if report:
            summary = report.get("summary", {})
            print(f"\nSummary:")
            print(f"  Issues found:        {summary.get('structural_issues_found', 0)}")
            print(f"  Proposed moves:      {summary.get('proposed_moves', 0)}")
            print(f"  Files affected:      {summary.get('total_files_affected', 0)}")
            print(f"  Executed moves:      {summary.get('executed_moves', 0)}")

            if report.get("issues"):
                print(f"\nStructural Issues ({len(report['issues'])}):")
                for issue in report["issues"][:10]:
                    severity_icon = {"high": "!", "medium": "*", "low": "-"}.get(issue["severity"], "-")
                    print(f"  [{severity_icon}] {issue['type']}: {issue['path']}")
                    if issue.get("suggested_location"):
                        print(f"      -> {issue['suggested_location']}")

            if report.get("proposed_moves"):
                print(f"\nProposed Moves ({len(report['proposed_moves'])}):")
                for move in report["proposed_moves"][:10]:
                    status = "DONE" if move["executed"] else ("FAIL" if move["error"] else "PENDING")
                    print(f"  [{status}] {move['source']}")
                    print(f"      -> {move['destination']} ({move['confidence']:.0f}% confidence)")

            if report.get("recommendations"):
                print(f"\nRecommendations:")
                for rec in report["recommendations"]:
                    print(f"  - {rec}")

        if result.get("issues"):
            print(f"\nAgent Issues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

        if result.get("suggestions"):
            print(f"\nSuggestions:")
            for suggestion in result["suggestions"]:
                print(f"  - {suggestion}")

        if result.get("dry_run"):
            print(f"\n{'-'*60}")
            print("This was a DRY RUN - no files were moved.")
            print("Run with --execute to apply changes.")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
