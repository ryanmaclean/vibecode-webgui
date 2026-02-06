#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 GitHub Operations Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system for automating GitHub issues and pull requests:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    # Create issues from agent report (e.g., secret scanner findings)
    python scripts/agents/level3_github_ops.py --from-report secrets_report.json

    # Create a single issue
    python scripts/agents/level3_github_ops.py --create-issue "Title" --body "Description" --labels security,high-priority

    # Create a PR
    python scripts/agents/level3_github_ops.py --create-pr --branch fix/secrets --title "Fix exposed secrets" --body "..."

    # Dry run mode (preview without creating)
    python scripts/agents/level3_github_ops.py --from-report report.json --dry-run

    # Create issues from stdin
    cat report.json | python scripts/agents/level3_github_ops.py --from-stdin
"""

import argparse
import json
import os
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
    config.service = os.environ.get("DD_SERVICE", "level3-github-ops")
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
    """Available agent actions."""
    CHECK_AUTH = "check_auth"
    LIST_ISSUES = "list_issues"
    CREATE_ISSUE = "create_issue"
    CREATE_ISSUES_BATCH = "create_issues_batch"
    LIST_PRS = "list_prs"
    CREATE_BRANCH = "create_branch"
    CREATE_PR = "create_pr"
    ADD_COMMENT = "add_comment"
    CLOSE_ISSUE = "close_issue"
    LINK_PR_TO_ISSUE = "link_pr_to_issue"
    REPORT = "report"


class Severity(Enum):
    """Finding severity levels."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# Mapping of severity to GitHub labels
SEVERITY_LABELS = {
    Severity.CRITICAL: ["critical", "security", "high-priority"],
    Severity.HIGH: ["high-priority", "security"],
    Severity.MEDIUM: ["medium-priority"],
    Severity.LOW: ["low-priority"],
}

# Category icons for issue titles
CATEGORY_ICONS = {
    "security": "\U0001F512",  # Lock
    "secret": "\U0001F512",
    "dead_code": "\U0001F480",  # Skull
    "drift": "\U0001F4CA",  # Chart
    "cve": "\U0001F6A8",  # Rotating light
    "vulnerability": "\U0001F6A8",
    "dependency": "\U0001F4E6",  # Package
    "compliance": "\U0001F4CB",  # Clipboard
    "default": "\U0001F41B",  # Bug
}

# Available labels
LABELS = [
    "security",
    "bug",
    "enhancement",
    "automation",
    "high-priority",
    "medium-priority",
    "low-priority",
    "critical",
    "dead-code",
    "infrastructure",
    "dependencies",
    "documentation",
]


@dataclass
class Finding:
    """A finding from another agent's report."""
    file: str
    line: int
    type: str
    severity: str
    description: str = ""
    recommendation: str = ""
    agent: str = ""
    category: str = "default"


@dataclass
class CreatedItem:
    """Represents a created GitHub item (issue or PR)."""
    type: str  # "issue" or "pr"
    number: int
    url: str
    title: str


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


class Level3GitHubOps:
    """
    Level 3 Autonomous Agent for GitHub Operations.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 3
    DRY_RUN = False

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        dry_run: bool = False,
        repo: Optional[str] = None,
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.dry_run = dry_run or self.DRY_RUN
        self.repo = repo  # Optional: owner/repo format
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []
        self.created_issues: list[CreatedItem] = []
        self.created_prs: list[CreatedItem] = []
        self.errors: list[str] = []
        self.dry_run_preview: list[dict] = []
        self.existing_issues: list[dict] = []
        self.existing_prs: list[dict] = []
        self.findings: list[Finding] = []

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.utcnow().isoformat()
        entry = {"timestamp": timestamp, "level": level, "message": message, "state": self.state.value}
        self.execution_log.append(entry)

        if self.verbose:
            prefix = "[DRY-RUN] " if self.dry_run else ""
            print(f"{prefix}[{level}] [{self.state.value}] {message}")

        if DDTRACE_AVAILABLE and tracer:
            span = tracer.current_span()
            if span:
                span.set_tag(f"agent.log.{len(self.execution_log)}", message[:100])

    def _run_gh_command(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        """Run a gh CLI command."""
        cmd = ["gh"] + args
        if self.repo:
            cmd.extend(["--repo", self.repo])

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=self.root_dir,
        )

        if check and result.returncode != 0:
            raise RuntimeError(f"gh command failed: {result.stderr}")

        return result

    def _format_security_issue_body(self, finding: Finding) -> str:
        """Format issue body for security findings."""
        return f"""## \U0001F512 Security Finding: {finding.type}

**Severity:** {finding.severity}
**File:** `{finding.file}:{finding.line}`
**Found by:** {finding.agent or 'Level 3 Agent'}

### Description
{finding.description or 'Security issue detected in the specified file.'}

### Recommendation
{finding.recommendation or 'Review and remediate the security finding.'}

### Auto-generated
This issue was automatically created by the Level 3 GitHub Ops Agent.
"""

    def _format_generic_issue_body(self, finding: Finding) -> str:
        """Format issue body for generic findings (dead code, drift, CVEs)."""
        icon = CATEGORY_ICONS.get(finding.category, CATEGORY_ICONS["default"])
        return f"""## {icon} {finding.category.title()}: {finding.type}

**Severity:** {finding.severity}
**Source:** {finding.agent or 'Level 3 Agent'}

### Details
{finding.description or 'Issue detected by automated analysis.'}

**File:** `{finding.file}:{finding.line}`

### Recommended Action
{finding.recommendation or 'Review and address this finding.'}

### Auto-generated
This issue was automatically created by the Level 3 GitHub Ops Agent.
"""

    def _get_issue_title(self, finding: Finding) -> str:
        """Generate issue title from finding."""
        icon = CATEGORY_ICONS.get(finding.category, CATEGORY_ICONS["default"])
        severity_prefix = f"[{finding.severity}]" if finding.severity else ""
        return f"{icon} {severity_prefix} {finding.type}: {finding.file}"

    def _get_labels_for_finding(self, finding: Finding) -> list[str]:
        """Get appropriate labels for a finding."""
        labels = ["automation"]

        # Add severity-based labels
        try:
            severity = Severity(finding.severity)
            labels.extend(SEVERITY_LABELS.get(severity, []))
        except ValueError:
            pass

        # Add category-based labels
        category_lower = finding.category.lower()
        if category_lower in ["security", "secret"]:
            labels.append("security")
        elif category_lower in ["dead_code"]:
            labels.append("dead-code")
        elif category_lower in ["cve", "vulnerability", "dependency"]:
            labels.extend(["security", "dependencies"])
        elif category_lower in ["drift", "infrastructure"]:
            labels.append("infrastructure")

        # Deduplicate and filter to available labels
        return list(set(l for l in labels if l in LABELS))

    def _is_duplicate_issue(self, title: str) -> bool:
        """Check if an issue with similar title already exists."""
        for issue in self.existing_issues:
            existing_title = issue.get("title", "").lower()
            # Check for exact match or significant overlap
            if title.lower() == existing_title:
                return True
            # Check if key parts match (file path and type)
            if title.split(":")[-1].strip() in existing_title:
                return True
        return False

    def load_report(self, report_path: str) -> list[Finding]:
        """Load findings from an agent report file."""
        path = Path(report_path)
        if not path.exists():
            raise FileNotFoundError(f"Report file not found: {report_path}")

        with open(path) as f:
            data = json.load(f)

        return self._parse_report(data)

    def load_report_from_stdin(self) -> list[Finding]:
        """Load findings from stdin."""
        data = json.load(sys.stdin)
        return self._parse_report(data)

    def _parse_report(self, data: dict) -> list[Finding]:
        """Parse agent report data into findings."""
        findings = []
        agent_name = data.get("agent", "unknown")

        # Handle different report formats
        raw_findings = data.get("findings", [])
        if not raw_findings:
            # Try nested format
            report = data.get("report", {})
            file_locations = report.get("file_locations", {})
            for file_path, file_findings in file_locations.items():
                for f in file_findings:
                    findings.append(Finding(
                        file=file_path,
                        line=f.get("line", 0),
                        type=f.get("type", "Unknown"),
                        severity=f.get("severity", "MEDIUM"),
                        description=f.get("match", ""),
                        recommendation=f.get("recommendation", ""),
                        agent=agent_name,
                        category=self._detect_category(f.get("type", "")),
                    ))
        else:
            for f in raw_findings:
                findings.append(Finding(
                    file=f.get("file", "unknown"),
                    line=f.get("line", 0),
                    type=f.get("type", "Unknown"),
                    severity=f.get("severity", "MEDIUM"),
                    description=f.get("description", ""),
                    recommendation=f.get("recommendation", ""),
                    agent=agent_name,
                    category=self._detect_category(f.get("type", "")),
                ))

        return findings

    def _detect_category(self, type_str: str) -> str:
        """Detect category from finding type string."""
        type_lower = type_str.lower()
        if any(kw in type_lower for kw in ["secret", "key", "token", "password", "credential"]):
            return "security"
        if any(kw in type_lower for kw in ["cve", "vulnerability"]):
            return "cve"
        if any(kw in type_lower for kw in ["dead", "unused"]):
            return "dead_code"
        if any(kw in type_lower for kw in ["drift", "diff"]):
            return "drift"
        if any(kw in type_lower for kw in ["dependency", "package"]):
            return "dependency"
        return "default"

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

        # Always start with auth check
        plan.actions.append(Action(ActionType.CHECK_AUTH, "Verify gh CLI authentication"))

        if "from-report" in intent_lower or "from-stdin" in intent_lower or "batch" in intent_lower:
            # Batch issue creation from report
            plan.actions.extend([
                Action(ActionType.LIST_ISSUES, "List existing issues to avoid duplicates"),
                Action(ActionType.CREATE_ISSUES_BATCH, "Create issues from findings report"),
                Action(ActionType.REPORT, "Generate operations report"),
            ])

        elif "create-issue" in intent_lower or "issue" in intent_lower:
            # Single issue creation
            plan.actions.extend([
                Action(ActionType.LIST_ISSUES, "Check for existing similar issues"),
                Action(ActionType.CREATE_ISSUE, "Create new issue"),
                Action(ActionType.REPORT, "Generate operations report"),
            ])

        elif "create-pr" in intent_lower or "pull request" in intent_lower:
            # PR creation
            plan.actions.extend([
                Action(ActionType.LIST_PRS, "Check for existing PRs"),
                Action(ActionType.CREATE_BRANCH, "Create or switch to branch"),
                Action(ActionType.CREATE_PR, "Create pull request"),
                Action(ActionType.REPORT, "Generate operations report"),
            ])

        elif "close" in intent_lower:
            # Close issue
            plan.actions.extend([
                Action(ActionType.CLOSE_ISSUE, "Close the specified issue"),
                Action(ActionType.REPORT, "Generate operations report"),
            ])

        elif "comment" in intent_lower:
            # Add comment
            plan.actions.extend([
                Action(ActionType.ADD_COMMENT, "Add comment to issue/PR"),
                Action(ActionType.REPORT, "Generate operations report"),
            ])

        elif "link" in intent_lower:
            # Link PR to issue
            plan.actions.extend([
                Action(ActionType.LINK_PR_TO_ISSUE, "Link PR to close issue"),
                Action(ActionType.REPORT, "Generate operations report"),
            ])

        else:
            # Default: list issues and PRs
            plan.actions.extend([
                Action(ActionType.LIST_ISSUES, "List open issues"),
                Action(ActionType.LIST_PRS, "List open PRs"),
                Action(ActionType.REPORT, "Generate status report"),
            ])

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
                self.errors.append(str(e))

        return plan

    def _execute_action(self, action: Action) -> dict:
        """Execute a single action and return results."""

        if action.type == ActionType.CHECK_AUTH:
            return self._action_check_auth()

        elif action.type == ActionType.LIST_ISSUES:
            return self._action_list_issues()

        elif action.type == ActionType.CREATE_ISSUE:
            return self._action_create_issue(action.params)

        elif action.type == ActionType.CREATE_ISSUES_BATCH:
            return self._action_create_issues_batch()

        elif action.type == ActionType.LIST_PRS:
            return self._action_list_prs()

        elif action.type == ActionType.CREATE_BRANCH:
            return self._action_create_branch(action.params)

        elif action.type == ActionType.CREATE_PR:
            return self._action_create_pr(action.params)

        elif action.type == ActionType.ADD_COMMENT:
            return self._action_add_comment(action.params)

        elif action.type == ActionType.CLOSE_ISSUE:
            return self._action_close_issue(action.params)

        elif action.type == ActionType.LINK_PR_TO_ISSUE:
            return self._action_link_pr_to_issue(action.params)

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_check_auth(self) -> dict:
        """Verify gh CLI is authenticated."""
        try:
            result = self._run_gh_command(["auth", "status"], check=False)
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": "gh CLI not authenticated. Run: gh auth login",
                }
            return {"success": True, "message": "GitHub CLI authenticated"}
        except FileNotFoundError:
            return {
                "success": False,
                "error": "gh CLI not found. Install from: https://cli.github.com",
            }

    def _action_list_issues(self) -> dict:
        """List existing issues to avoid duplicates."""
        try:
            result = self._run_gh_command([
                "issue", "list",
                "--state", "all",
                "--limit", "100",
                "--json", "number,title,state,labels,url",
            ])

            issues = json.loads(result.stdout) if result.stdout else []
            self.existing_issues = issues

            return {
                "success": True,
                "count": len(issues),
                "issues": issues,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_create_issue(self, params: dict) -> dict:
        """Create a single issue."""
        title = params.get("title", "")
        body = params.get("body", "")
        labels = params.get("labels", [])
        assignees = params.get("assignees", [])

        if not title:
            return {"success": False, "error": "Issue title is required"}

        # Check for duplicates
        if self._is_duplicate_issue(title):
            self.log(f"Skipping duplicate issue: {title}", "WARN")
            return {"success": True, "skipped": True, "reason": "duplicate"}

        if self.dry_run:
            preview = {
                "action": "create_issue",
                "title": title,
                "body": body[:200] + "..." if len(body) > 200 else body,
                "labels": labels,
                "assignees": assignees,
            }
            self.dry_run_preview.append(preview)
            return {"success": True, "dry_run": True, "preview": preview}

        try:
            cmd = ["issue", "create", "--title", title, "--body", body]

            for label in labels:
                cmd.extend(["--label", label])

            for assignee in assignees:
                cmd.extend(["--assignee", assignee])

            result = self._run_gh_command(cmd)

            # Parse the issue URL from output
            url = result.stdout.strip()
            issue_number = int(url.split("/")[-1]) if url else 0

            created = CreatedItem(
                type="issue",
                number=issue_number,
                url=url,
                title=title,
            )
            self.created_issues.append(created)

            return {
                "success": True,
                "issue_number": issue_number,
                "url": url,
            }
        except Exception as e:
            self.errors.append(f"Failed to create issue '{title}': {e}")
            return {"success": False, "error": str(e)}

    def _action_create_issues_batch(self) -> dict:
        """Create multiple issues from loaded findings."""
        if not self.findings:
            return {"success": True, "created": 0, "message": "No findings to process"}

        created_count = 0
        skipped_count = 0
        failed_count = 0

        for finding in self.findings:
            title = self._get_issue_title(finding)

            # Check for duplicates
            if self._is_duplicate_issue(title):
                self.log(f"Skipping duplicate: {title}", "INFO")
                skipped_count += 1
                continue

            # Format body based on category
            if finding.category in ["security", "secret"]:
                body = self._format_security_issue_body(finding)
            else:
                body = self._format_generic_issue_body(finding)

            labels = self._get_labels_for_finding(finding)

            result = self._action_create_issue({
                "title": title,
                "body": body,
                "labels": labels,
            })

            if result.get("success"):
                if not result.get("skipped"):
                    created_count += 1
                else:
                    skipped_count += 1
            else:
                failed_count += 1

            # Rate limiting - be nice to GitHub API
            if not self.dry_run:
                time.sleep(0.5)

        return {
            "success": failed_count == 0,
            "created": created_count,
            "skipped": skipped_count,
            "failed": failed_count,
            "total_findings": len(self.findings),
        }

    def _action_list_prs(self) -> dict:
        """List existing pull requests."""
        try:
            result = self._run_gh_command([
                "pr", "list",
                "--state", "all",
                "--limit", "50",
                "--json", "number,title,state,headRefName,url",
            ])

            prs = json.loads(result.stdout) if result.stdout else []
            self.existing_prs = prs

            return {
                "success": True,
                "count": len(prs),
                "prs": prs,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_create_branch(self, params: dict) -> dict:
        """Create a new branch for changes."""
        branch_name = params.get("branch", "")
        if not branch_name:
            return {"success": False, "error": "Branch name is required"}

        if self.dry_run:
            preview = {"action": "create_branch", "branch": branch_name}
            self.dry_run_preview.append(preview)
            return {"success": True, "dry_run": True, "preview": preview}

        try:
            # Check if branch exists
            result = subprocess.run(
                ["git", "rev-parse", "--verify", branch_name],
                capture_output=True,
                text=True,
                cwd=self.root_dir,
            )

            if result.returncode == 0:
                # Branch exists, switch to it
                subprocess.run(
                    ["git", "checkout", branch_name],
                    capture_output=True,
                    text=True,
                    cwd=self.root_dir,
                    check=True,
                )
                return {"success": True, "branch": branch_name, "action": "switched"}
            else:
                # Create new branch
                subprocess.run(
                    ["git", "checkout", "-b", branch_name],
                    capture_output=True,
                    text=True,
                    cwd=self.root_dir,
                    check=True,
                )
                return {"success": True, "branch": branch_name, "action": "created"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_create_pr(self, params: dict) -> dict:
        """Create a pull request."""
        title = params.get("title", "")
        body = params.get("body", "")
        base = params.get("base", "main")
        draft = params.get("draft", False)

        if not title:
            return {"success": False, "error": "PR title is required"}

        if self.dry_run:
            preview = {
                "action": "create_pr",
                "title": title,
                "body": body[:200] + "..." if len(body) > 200 else body,
                "base": base,
                "draft": draft,
            }
            self.dry_run_preview.append(preview)
            return {"success": True, "dry_run": True, "preview": preview}

        try:
            cmd = [
                "pr", "create",
                "--title", title,
                "--body", body,
                "--base", base,
            ]

            if draft:
                cmd.append("--draft")

            result = self._run_gh_command(cmd)

            # Parse PR URL from output
            url = result.stdout.strip()
            pr_number = int(url.split("/")[-1]) if url else 0

            created = CreatedItem(
                type="pr",
                number=pr_number,
                url=url,
                title=title,
            )
            self.created_prs.append(created)

            return {
                "success": True,
                "pr_number": pr_number,
                "url": url,
            }
        except Exception as e:
            self.errors.append(f"Failed to create PR '{title}': {e}")
            return {"success": False, "error": str(e)}

    def _action_add_comment(self, params: dict) -> dict:
        """Add comment to issue or PR."""
        number = params.get("number")
        body = params.get("body", "")
        item_type = params.get("type", "issue")  # "issue" or "pr"

        if not number or not body:
            return {"success": False, "error": "Issue/PR number and body are required"}

        if self.dry_run:
            preview = {
                "action": "add_comment",
                "type": item_type,
                "number": number,
                "body": body[:200] + "..." if len(body) > 200 else body,
            }
            self.dry_run_preview.append(preview)
            return {"success": True, "dry_run": True, "preview": preview}

        try:
            cmd = [item_type, "comment", str(number), "--body", body]
            self._run_gh_command(cmd)
            return {"success": True, "commented": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_close_issue(self, params: dict) -> dict:
        """Close an issue."""
        number = params.get("number")
        comment = params.get("comment", "")

        if not number:
            return {"success": False, "error": "Issue number is required"}

        if self.dry_run:
            preview = {"action": "close_issue", "number": number, "comment": comment}
            self.dry_run_preview.append(preview)
            return {"success": True, "dry_run": True, "preview": preview}

        try:
            cmd = ["issue", "close", str(number)]
            if comment:
                cmd.extend(["--comment", comment])

            self._run_gh_command(cmd)
            return {"success": True, "closed": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_link_pr_to_issue(self, params: dict) -> dict:
        """Link a PR to close an issue."""
        pr_number = params.get("pr_number")
        issue_number = params.get("issue_number")

        if not pr_number or not issue_number:
            return {"success": False, "error": "Both PR and issue numbers are required"}

        # Add a comment to link them
        body = f"Closes #{issue_number}"

        return self._action_add_comment({
            "number": pr_number,
            "body": body,
            "type": "pr",
        })

    def _action_report(self) -> dict:
        """Generate final operations report."""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "dry_run": self.dry_run,
            "issues_created": {
                "count": len(self.created_issues),
                "items": [
                    {"number": i.number, "url": i.url, "title": i.title}
                    for i in self.created_issues
                ],
            },
            "prs_created": {
                "count": len(self.created_prs),
                "items": [
                    {"number": p.number, "url": p.url, "title": p.title}
                    for p in self.created_prs
                ],
            },
            "errors": self.errors,
        }

        if self.dry_run:
            report["dry_run_preview"] = self.dry_run_preview

        return {"success": True, "report": report}

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

                # Specific recovery suggestions
                if action.type == ActionType.CHECK_AUTH:
                    reflection.issues.append("GitHub CLI authentication required")
                    reflection.suggestions.append("Run: gh auth login")
                    # Auth failure is fatal, don't retry
                    reflection.should_retry = False

                elif action.type == ActionType.CREATE_ISSUES_BATCH:
                    if action.result and action.result.get("failed", 0) > 0:
                        reflection.issues.append(
                            f"Failed to create {action.result['failed']} issues"
                        )
                        reflection.suggestions.append("Check GitHub API rate limits")

            if action.result:
                # Check batch creation results
                if action.type == ActionType.CREATE_ISSUES_BATCH:
                    result = action.result
                    if result.get("skipped", 0) > 0:
                        self.log(
                            f"Skipped {result['skipped']} duplicate issues", "INFO"
                        )

        # Check for errors
        if self.errors:
            reflection.success = False
            reflection.issues.extend(self.errors[:5])  # Limit reported errors

        # Determine if retry is warranted
        if not reflection.success and plan.iteration < self.MAX_ITERATIONS:
            # Only retry for transient errors, not auth or validation issues
            if not any("auth" in issue.lower() for issue in reflection.issues):
                reflection.should_retry = True
                reflection.suggestions.append("Retry failed operations")

        self.log(
            f"Reflection: success={reflection.success}, "
            f"issues={len(reflection.issues)}, retry={reflection.should_retry}"
        )
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

        # Add new actions from reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Retry failed actions (except auth which is fatal)
        for action in plan.actions:
            if not action.success and action.type != ActionType.CHECK_AUTH:
                # Re-add failed action
                new_plan.actions.append(
                    Action(action.type, f"Retry: {action.description}", action.params)
                )

        # Always end with report
        new_plan.actions.append(Action(ActionType.REPORT, "Generate retry report"))

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

        # Warn about operations that create items
        create_actions = [
            ActionType.CREATE_ISSUE,
            ActionType.CREATE_ISSUES_BATCH,
            ActionType.CREATE_PR,
            ActionType.CREATE_BRANCH,
        ]
        for action in plan.actions:
            if action.type in create_actions:
                if self.dry_run:
                    check.warnings.append(
                        f"DRY RUN: {action.type.value} will be simulated"
                    )
                else:
                    check.warnings.append(
                        f"Action {action.type.value} will create GitHub items"
                    )

        # Rate limit warning
        if any(a.type == ActionType.CREATE_ISSUES_BATCH for a in plan.actions):
            if len(self.findings) > 10:
                check.warnings.append(
                    f"Creating {len(self.findings)} issues - rate limiting applied"
                )

        return check

    # ==================== MAIN LOOP ====================

    def run(self, intent: str) -> dict:
        """
        Main autonomous execution loop.

        PLAN -> EXECUTE -> REFLECT -> ADAPT (repeat until success or max iterations)
        """
        self.log(f"Starting Level 3 GitHub Ops Agent with intent: {intent}")
        if self.dry_run:
            self.log("DRY RUN MODE - No changes will be made", "WARN")

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
                    self.log(f"Governance note: {warning}", "INFO")

            # Execute plan
            plan = self.execute(plan)

            # Reflect on results
            reflection = self.reflect(plan)

            # Check if we should continue
            if not reflection.should_retry:
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
            "execution_log_entries": len(self.execution_log),
        }

        self.log(
            f"Agent completed: success={result['success']}, "
            f"iterations={result['iterations']}"
        )
        return result


def run_with_params(
    agent: Level3GitHubOps,
    intent: str,
    action_params: dict[ActionType, dict],
) -> dict:
    """
    Run the agent with pre-configured action parameters.

    This allows CLI arguments to configure specific action parameters
    before the autonomous execution loop runs.
    """
    agent.log(f"Starting Level 3 GitHub Ops Agent with intent: {intent}")
    if agent.dry_run:
        agent.log("DRY RUN MODE - No changes will be made", "WARN")

    start_time = time.time()

    # Create initial plan
    plan = agent.plan(intent)

    # Inject action params from CLI
    for action in plan.actions:
        if action.type in action_params:
            action.params = action_params[action.type]

    while True:
        # Governance check
        governance = agent.check_governance(plan)
        if not governance.passed:
            agent.state = AgentState.FAILED
            agent.log(f"Governance violation: {governance.violations}", "ERROR")
            return {
                "success": False,
                "error": "Governance violation",
                "violations": governance.violations,
            }

        if governance.warnings:
            for warning in governance.warnings:
                agent.log(f"Governance note: {warning}", "INFO")

        # Execute plan
        plan = agent.execute(plan)

        # Reflect on results
        reflection = agent.reflect(plan)

        # Check if we should continue
        if not reflection.should_retry:
            break

        if plan.iteration >= agent.MAX_ITERATIONS:
            agent.log(f"Max iterations ({agent.MAX_ITERATIONS}) reached", "WARN")
            break

        # Adapt plan and continue
        plan = agent.adapt(plan, reflection)

        # Re-inject params for adapted plan
        for action in plan.actions:
            if action.type in action_params:
                action.params = action_params[action.type]

    # Final state
    agent.state = AgentState.COMPLETED if reflection.success else AgentState.FAILED
    duration = time.time() - start_time

    # Get final report
    final_report = agent._action_report()

    result = {
        "success": reflection.success,
        "iterations": plan.iteration,
        "duration_seconds": round(duration, 2),
        "final_state": agent.state.value,
        "dry_run": agent.dry_run,
        "report": final_report.get("report", {}),
        "issues": reflection.issues,
        "execution_log_entries": len(agent.execution_log),
    }

    agent.log(
        f"Agent completed: success={result['success']}, "
        f"iterations={result['iterations']}"
    )
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 GitHub Operations Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Input sources
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        "--from-report",
        metavar="FILE",
        help="Create issues from agent report JSON file",
    )
    input_group.add_argument(
        "--from-stdin",
        action="store_true",
        help="Read agent report from stdin",
    )

    # Issue creation
    parser.add_argument(
        "--create-issue",
        metavar="TITLE",
        help="Create a single issue with the given title",
    )
    parser.add_argument(
        "--body",
        default="",
        help="Body text for issue or PR",
    )
    parser.add_argument(
        "--labels",
        default="",
        help="Comma-separated list of labels",
    )
    parser.add_argument(
        "--assignees",
        default="",
        help="Comma-separated list of assignees",
    )

    # PR creation
    parser.add_argument(
        "--create-pr",
        action="store_true",
        help="Create a pull request",
    )
    parser.add_argument(
        "--branch",
        default="",
        help="Branch name for PR",
    )
    parser.add_argument(
        "--title",
        default="",
        help="Title for PR",
    )
    parser.add_argument(
        "--base",
        default="main",
        help="Base branch for PR (default: main)",
    )
    parser.add_argument(
        "--draft",
        action="store_true",
        help="Create PR as draft",
    )

    # Other actions
    parser.add_argument(
        "--close-issue",
        type=int,
        metavar="NUMBER",
        help="Close an issue by number",
    )
    parser.add_argument(
        "--add-comment",
        type=int,
        metavar="NUMBER",
        help="Add comment to issue/PR by number",
    )
    parser.add_argument(
        "--comment-body",
        default="",
        help="Comment body text",
    )

    # Options
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview actions without creating anything",
    )
    parser.add_argument(
        "--repo",
        metavar="OWNER/REPO",
        help="Target repository (default: current repo)",
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

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / ".git").is_dir():
            break
        root = root.parent

    # Create agent
    agent = Level3GitHubOps(
        root,
        verbose=not args.quiet,
        dry_run=args.dry_run,
        repo=args.repo,
    )

    # Determine intent and configure based on arguments
    intent = "status check"
    action_params: dict[ActionType, dict] = {}

    if args.from_report:
        intent = "from-report batch issue creation"
        agent.findings = agent.load_report(args.from_report)
    elif args.from_stdin:
        intent = "from-stdin batch issue creation"
        agent.findings = agent.load_report_from_stdin()
    elif args.create_issue:
        intent = "create-issue single issue"
        labels = [l.strip() for l in args.labels.split(",") if l.strip()]
        assignees = [a.strip() for a in args.assignees.split(",") if a.strip()]
        action_params[ActionType.CREATE_ISSUE] = {
            "title": args.create_issue,
            "body": args.body,
            "labels": labels,
            "assignees": assignees,
        }
    elif args.create_pr:
        intent = "create-pr pull request"
        action_params[ActionType.CREATE_BRANCH] = {"branch": args.branch}
        action_params[ActionType.CREATE_PR] = {
            "title": args.title or f"PR from {args.branch}",
            "body": args.body,
            "base": args.base,
            "draft": args.draft,
        }
    elif args.close_issue:
        intent = "close issue"
        action_params[ActionType.CLOSE_ISSUE] = {"number": args.close_issue}
    elif args.add_comment:
        intent = "add comment"
        action_params[ActionType.ADD_COMMENT] = {
            "number": args.add_comment,
            "body": args.comment_body or args.body,
            "type": "issue",
        }

    # Run with custom execution that injects params
    result = run_with_params(agent, intent, action_params)

    # Output results
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 GitHub Ops Agent - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")
        print(f"Dry Run:     {result['dry_run']}")

        report = result.get("report", {})

        issues_created = report.get("issues_created", {})
        print(f"\nIssues Created: {issues_created.get('count', 0)}")
        for item in issues_created.get("items", [])[:5]:
            print(f"  - #{item['number']}: {item['title'][:50]}")
            print(f"    {item['url']}")

        prs_created = report.get("prs_created", {})
        print(f"\nPRs Created: {prs_created.get('count', 0)}")
        for item in prs_created.get("items", [])[:5]:
            print(f"  - #{item['number']}: {item['title'][:50]}")
            print(f"    {item['url']}")

        errors = report.get("errors", [])
        if errors:
            print(f"\nErrors:")
            for error in errors[:5]:
                print(f"  - {error}")

        if result.get("dry_run"):
            preview = report.get("dry_run_preview", [])
            if preview:
                print(f"\nDry Run Preview ({len(preview)} actions):")
                for action in preview[:10]:
                    print(f"  - {action.get('action')}: {action.get('title', action.get('number', ''))}")

        if result.get("issues"):
            print(f"\nIssues Encountered:")
            for issue in result["issues"][:5]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
