#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Datadog Tagging Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system exhibiting constrained autonomy:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_tagging_agent.py "ensure all scripts have proper datadog tagging"
    python scripts/agents/level3_tagging_agent.py "fix tagging compliance issues"
    python scripts/agents/level3_tagging_agent.py "audit and report tagging status"
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
    config.service = os.environ.get("DD_SERVICE", "level3-tagging-agent")
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
    SCAN = "scan"
    VALIDATE = "validate"
    FIX_SYNTAX = "fix_syntax"
    APPLY_TAGGING = "apply_tagging"
    ADD_CLUSTER_TAG = "add_cluster_tag"
    VERIFY = "verify"
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


class Level3TaggingAgent:
    """
    Level 3 Autonomous Agent for Datadog Tagging.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 5
    COMPLIANCE_THRESHOLD = 95.0  # Minimum compliance percentage

    def __init__(self, root_dir: Path, verbose: bool = True):
        self.root_dir = root_dir
        self.scripts_dir = root_dir / "scripts"
        self.verbose = verbose
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []

        # Load skill knowledge
        self.skill_path = Path.home() / ".claude/skills/datadog-tagging-best-practices.md"
        self.skill_knowledge = self._load_skill()

    def _load_skill(self) -> dict:
        """Load tagging best practices from skill file."""
        knowledge = {
            "core_tags": ["env", "service", "version"],
            "additional_tags": ["team", "component", "cluster"],
            "naming_rules": [
                "lowercase only",
                "start with letter",
                "max 200 characters",
                "use colons for namespacing"
            ],
            "anti_patterns": [
                "over-tagging",
                "high-cardinality values",
                "inconsistent naming",
                "missing core tags"
            ]
        }

        if self.skill_path.exists():
            content = self.skill_path.read_text()
            # Extract patterns from skill
            if "cluster" in content:
                knowledge["has_cluster_tag"] = True
            if "tundra-dome" in content:
                knowledge["default_cluster"] = "tundra-dome"

        return knowledge

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

        # Analyze intent and determine required actions
        intent_lower = intent.lower()

        if any(word in intent_lower for word in ["audit", "status", "report", "check"]):
            # Audit/reporting intent
            plan.actions = [
                Action(ActionType.SCAN, "Scan all scripts for tagging status"),
                Action(ActionType.VALIDATE, "Validate compliance with best practices"),
                Action(ActionType.REPORT, "Generate detailed report"),
            ]

        elif any(word in intent_lower for word in ["fix", "repair", "correct"]):
            # Fix/repair intent
            plan.actions = [
                Action(ActionType.SCAN, "Scan for issues"),
                Action(ActionType.FIX_SYNTAX, "Fix syntax errors"),
                Action(ActionType.VALIDATE, "Validate fixes"),
                Action(ActionType.VERIFY, "Verify all scripts pass"),
            ]

        elif any(word in intent_lower for word in ["ensure", "apply", "tag", "implement"]):
            # Full tagging implementation intent
            plan.actions = [
                Action(ActionType.SCAN, "Initial compliance scan"),
                Action(ActionType.FIX_SYNTAX, "Fix any syntax issues first"),
                Action(ActionType.APPLY_TAGGING, "Apply unified service tagging"),
                Action(ActionType.ADD_CLUSTER_TAG, "Add cluster tags to K8s scripts"),
                Action(ActionType.VALIDATE, "Validate compliance"),
                Action(ActionType.VERIFY, "Final verification"),
                Action(ActionType.REPORT, "Generate completion report"),
            ]

        else:
            # Default: full audit and fix
            plan.actions = [
                Action(ActionType.SCAN, "Scan current state"),
                Action(ActionType.VALIDATE, "Check compliance"),
                Action(ActionType.REPORT, "Report findings"),
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

        if action.type == ActionType.SCAN:
            return self._action_scan()

        elif action.type == ActionType.VALIDATE:
            return self._action_validate()

        elif action.type == ActionType.FIX_SYNTAX:
            return self._action_fix_syntax()

        elif action.type == ActionType.APPLY_TAGGING:
            return self._action_apply_tagging()

        elif action.type == ActionType.ADD_CLUSTER_TAG:
            return self._action_add_cluster_tags()

        elif action.type == ActionType.VERIFY:
            return self._action_verify()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_scan(self) -> dict:
        """Scan all scripts for tagging status."""
        scripts = list(self.scripts_dir.rglob("*.py"))
        compliant = 0
        non_compliant = 0
        syntax_errors = 0

        for script in scripts:
            # Check syntax
            result = subprocess.run(
                [sys.executable, "-m", "py_compile", str(script)],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                syntax_errors += 1
                continue

            # Check tagging
            content = script.read_text()
            has_service = bool(re.search(r'config\.service|DD_SERVICE|_dd_service', content))
            has_env = bool(re.search(r'config\.env|DD_ENV|_dd_env', content))
            has_version = bool(re.search(r'config\.version|DD_VERSION|_dd_version', content))

            if has_service and has_env and has_version:
                compliant += 1
            else:
                non_compliant += 1

        return {
            "success": True,
            "total": len(scripts),
            "compliant": compliant,
            "non_compliant": non_compliant,
            "syntax_errors": syntax_errors,
            "compliance_rate": 100 * compliant / len(scripts) if scripts else 0
        }

    def _action_validate(self) -> dict:
        """Validate compliance against best practices."""
        scan_result = self._action_scan()

        issues = []
        if scan_result["syntax_errors"] > 0:
            issues.append(f"{scan_result['syntax_errors']} scripts have syntax errors")
        if scan_result["non_compliant"] > 0:
            issues.append(f"{scan_result['non_compliant']} scripts missing required tags")

        compliance_rate = scan_result["compliance_rate"]
        passed = compliance_rate >= self.COMPLIANCE_THRESHOLD

        return {
            "success": passed,
            "compliance_rate": compliance_rate,
            "threshold": self.COMPLIANCE_THRESHOLD,
            "issues": issues,
            "passed": passed
        }

    def _action_fix_syntax(self) -> dict:
        """Fix syntax errors (from __future__ ordering)."""
        scripts = list(self.scripts_dir.rglob("*.py"))
        fixed = 0

        for script in scripts:
            result = subprocess.run(
                [sys.executable, "-m", "py_compile", str(script)],
                capture_output=True, text=True
            )
            if result.returncode != 0 and "from __future__" in result.stderr:
                if self._fix_future_import(script):
                    fixed += 1

        return {"success": True, "fixed": fixed}

    def _fix_future_import(self, script: Path) -> bool:
        """Fix from __future__ import ordering."""
        try:
            content = script.read_text()
            lines = content.split('\n')

            future_idx = None
            shebang_idx = None

            for i, line in enumerate(lines):
                if line.startswith('#!/'):
                    shebang_idx = i
                if line.strip().startswith('from __future__ import'):
                    future_idx = i
                    break

            if future_idx is not None and future_idx > (shebang_idx or -1) + 1:
                future_line = lines.pop(future_idx)
                insert_at = (shebang_idx or -1) + 1
                lines.insert(insert_at, future_line)
                script.write_text('\n'.join(lines))
                return True

            return False
        except Exception:
            return False

    def _action_apply_tagging(self) -> dict:
        """Apply unified service tagging to non-compliant scripts."""
        # Use the existing tagging agent
        result = subprocess.run(
            [sys.executable, "scripts/agents/datadog_tagging_agent.py", "apply", "--json"],
            capture_output=True, text=True, cwd=self.root_dir
        )

        try:
            data = json.loads(result.stdout)
            return {"success": True, "updated": data.get("updated", 0)}
        except json.JSONDecodeError:
            return {"success": result.returncode == 0, "updated": 0}

    def _action_add_cluster_tags(self) -> dict:
        """Add cluster tags to K8s-related scripts."""
        k8s_paths = [
            self.scripts_dir / "python/tundra_automation",
            self.scripts_dir / "cloud/kind",
        ]

        updated = 0
        for k8s_path in k8s_paths:
            if not k8s_path.exists():
                continue

            for script in k8s_path.rglob("*.py"):
                content = script.read_text()

                if '"cluster":' in content or "'cluster':" in content:
                    continue

                # Add cluster tag
                pattern = r'(_dd_tracer\.set_tags\(\{[^}]+)\}\)'
                if re.search(pattern, content):
                    new_content = re.sub(
                        pattern,
                        r'\1, "cluster": "tundra-dome"})',
                        content
                    )
                    if new_content != content:
                        script.write_text(new_content)
                        updated += 1

        return {"success": True, "updated": updated}

    def _action_verify(self) -> dict:
        """Final verification of all scripts."""
        scripts = list(self.scripts_dir.rglob("*.py"))
        all_valid = True
        errors = []

        for script in scripts:
            result = subprocess.run(
                [sys.executable, "-m", "py_compile", str(script)],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                all_valid = False
                errors.append(str(script))

        return {
            "success": all_valid,
            "total": len(scripts),
            "valid": len(scripts) - len(errors),
            "errors": errors[:10]
        }

    def _action_report(self) -> dict:
        """Generate final report."""
        scan = self._action_scan()
        validate = self._action_validate()

        return {
            "success": True,
            "report": {
                "total_scripts": scan["total"],
                "compliant": scan["compliant"],
                "non_compliant": scan["non_compliant"],
                "syntax_errors": scan["syntax_errors"],
                "compliance_rate": f"{scan['compliance_rate']:.1f}%",
                "threshold_met": validate["passed"],
                "timestamp": datetime.utcnow().isoformat()
            }
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
                if action.type == ActionType.VALIDATE:
                    if not action.result.get("passed", True):
                        reflection.issues.extend(action.result.get("issues", []))
                        reflection.should_retry = True
                        reflection.suggestions.append("Re-run tagging application")

                if action.type == ActionType.VERIFY:
                    if action.result.get("errors"):
                        reflection.issues.append(f"Verification found {len(action.result['errors'])} invalid scripts")
                        reflection.should_retry = True
                        reflection.suggestions.append("Fix remaining syntax errors")

                if action.type == ActionType.SCAN:
                    if action.result.get("syntax_errors", 0) > 0:
                        reflection.issues.append(f"Found {action.result['syntax_errors']} syntax errors")
                        reflection.new_actions.append(
                            Action(ActionType.FIX_SYNTAX, "Fix detected syntax errors")
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
            iteration=plan.iteration + 1
        )

        # Add new actions from reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Add verification steps
        new_plan.actions.append(Action(ActionType.VALIDATE, "Re-validate after fixes"))
        new_plan.actions.append(Action(ActionType.VERIFY, "Verify all scripts"))

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

        # Check for destructive actions
        for action in plan.actions:
            if action.type in [ActionType.APPLY_TAGGING, ActionType.FIX_SYNTAX]:
                check.warnings.append(f"Action {action.type.value} modifies files")

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
        self.log(f"Starting Level 3 agent with intent: {intent}")
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

        result = {
            "success": reflection.success,
            "iterations": plan.iteration,
            "duration_seconds": round(duration, 2),
            "final_state": self.state.value,
            "report": final_report.get("report", {}),
            "issues": reflection.issues,
            "execution_log_entries": len(self.execution_log)
        }

        self.log(f"Agent completed: success={result['success']}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Datadog Tagging Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="ensure all scripts have proper datadog tagging",
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

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / "scripts").is_dir():
            break
        root = root.parent

    agent = Level3TaggingAgent(root, verbose=not args.quiet)
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 Tagging Agent - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {args.intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")
        print(f"\nReport:")
        for key, value in result.get("report", {}).items():
            print(f"  {key}: {value}")
        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
